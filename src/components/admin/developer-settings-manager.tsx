"use client";

import { useState, useEffect } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { doc, onSnapshot, getDoc } from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';
import { Loader2, Save, Lock, Code } from 'lucide-react';
import type { EventSettings, UserRole } from "@/lib/types";
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { manageGeneralSettings } from '@/app/actions';

export function DeveloperSettingsManager() {
    const [user, setUser] = useState<User | null>(null);
    const [userRole, setUserRole] = useState<UserRole | null>(null);
    const [eventSettings, setEventSettings] = useState<EventSettings | null>(null);
    const [loading, setLoading] = useState(true);
    const [isUpdating, setIsUpdating] = useState(false);
    const { toast } = useToast();
    const [formData, setFormData] = useState<Partial<EventSettings>>({});

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            setUser(user);
        });
        return () => unsubscribe();
    }, []);

    useEffect(() => {
        if (user) {
            const userDocRef = doc(db, 'users', user.uid);
            getDoc(userDocRef).then(doc => {
                if (doc.exists()) {
                    setUserRole(doc.data().role as UserRole);
                }
            })
        }
    }, [user]);

    useEffect(() => {
        const docRef = doc(db, 'settings', 'event');
        const unsubscribe = onSnapshot(docRef, (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data() as EventSettings;
                setEventSettings(data);
                setFormData(data);
            }
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSwitchChange = (checked: boolean) => {
        setFormData(prev => ({ ...prev, showDeveloperBranding: checked }));
    };

    const handleSaveSettings = async () => {
        if (!user) return;
        setIsUpdating(true);

        try {
            const token = await user.getIdToken();
            // Only Super Admin can save these
            if (userRole !== 'superadmin') {
                throw new Error("Unauthorized: Super Admin access required.");
            }

            // Sanitize formData to ensure no non-serializable objects (like Timestamps) are passed
            const sanitizedData = { ...formData };
            if (sanitizedData.startTime && typeof (sanitizedData.startTime as any).toDate === 'function') {
                sanitizedData.startTime = (sanitizedData.startTime as any).toDate().toISOString();
            } else if (sanitizedData.startTime instanceof Date) {
                sanitizedData.startTime = sanitizedData.startTime.toISOString(); // Convert Date to ISO String
            }

            const result = await manageGeneralSettings({
                adminId: user.uid,
                token,
                ...sanitizedData
            });

            if (result.success) {
                toast({ title: "Developer Settings Saved", description: "System defaults updated." });
            } else {
                throw new Error(result.message);
            }
        } catch (e: any) {
            toast({ variant: "destructive", title: "Error", description: e.message });
        } finally {
            setIsUpdating(false);
        }
    };

    if (loading) return <Loader2 className="animate-spin" />;

    if (userRole !== 'superadmin') {
        return (
            <Card className="border-destructive/50 bg-destructive/10">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-destructive"><Lock className="h-5 w-5" /> Restricted Access</CardTitle>
                    <CardDescription>Only Super Admins can access developer settings.</CardDescription>
                </CardHeader>
            </Card>
        )
    }

    return (
        <div className="space-y-6">
            <Card className="border-primary/20 bg-primary/5">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><Code className="h-5 w-5 text-primary" /> Developer Configuration</CardTitle>
                    <CardDescription>Manage strict system defaults and branding.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex items-center justify-between p-4 border rounded-lg bg-background">
                        <div className="space-y-0.5">
                            <Label>Developer Branding</Label>
                            <p className="text-sm text-muted-foreground">Show "Powered by..." footer on critical pages.</p>
                        </div>
                        <Switch
                            checked={formData.showDeveloperBranding ?? true}
                            onCheckedChange={handleSwitchChange}
                        />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Developer Name</Label>
                            <Input name="developerName" value={formData.developerName || ''} onChange={handleInputChange} placeholder="Your Name / Agency" />
                        </div>
                        <div className="space-y-2">
                            <Label>Developer Website</Label>
                            <Input name="developerWebsite" value={formData.developerWebsite || ''} onChange={handleInputChange} placeholder="https://your-portfolio.com" />
                        </div>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>System Fallbacks</CardTitle>
                    <CardDescription>These values are used when the Event Organizer hasn't configured their own links.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Default WhatsApp Group</Label>
                            <Input name="defaultWhatsAppGroupUrl" value={formData.defaultWhatsAppGroupUrl || ''} onChange={handleInputChange} placeholder="Fallback Group Link" />
                        </div>
                        <div className="space-y-2">
                            <Label>Default Organizer Contact</Label>
                            <Input name="defaultOrganizerWhatsAppUrl" value={formData.defaultOrganizerWhatsAppUrl || ''} onChange={handleInputChange} placeholder="Fallback Organizer Link" />
                        </div>
                        <div className="space-y-2">
                            <Label>Default Instagram</Label>
                            <Input name="defaultInstagramUrl" value={formData.defaultInstagramUrl || ''} onChange={handleInputChange} placeholder="Fallback Instagram Link" />
                        </div>
                    </div>
                </CardContent>
            </Card>

            <div className="flex justify-end">
                <Button onClick={handleSaveSettings} disabled={isUpdating}>
                    {isUpdating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                    Save Developer Settings
                </Button>
            </div>
        </div>
    );
}
