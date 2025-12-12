
"use client";

import { useState, useEffect } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { doc, onSnapshot, getDoc } from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';
import { Loader2, AlertTriangle, ToggleLeft, ToggleRight, Settings, ShieldAlert } from 'lucide-react';
import type { EventSettings, UserRole } from "@/lib/types";
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { manageGeneralSettings } from '@/app/actions';

export function GeneralSettingsManager() {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [eventSettings, setEventSettings] = useState<EventSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
        setUser(user);
        setAuthLoading(false);
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
    const unsubscribe = onSnapshot(docRef, 
      (docSnap) => {
        if (docSnap.exists()) {
          setEventSettings(docSnap.data() as EventSettings);
        } else {
          // Default settings if document doesn't exist
          setEventSettings({ startTime: new Date(), registrationsOpen: true });
        }
        setLoading(false);
      },
      (err) => {
        setError("Failed to load settings.");
        console.error(err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  const handleToggleRegistration = async () => {
    if (!user || !eventSettings) return;
    setIsUpdating(true);
    
    const newStatus = !eventSettings.registrationsOpen;
    
    const result = await manageGeneralSettings({
        adminId: user.uid,
        registrationsOpen: newStatus
    });

    if (result.success) {
      toast({
        title: "Success",
        description: `Registrations are now ${newStatus ? 'OPEN' : 'CLOSED'}.`,
      });
    } else {
      toast({
        variant: "destructive",
        title: "Error",
        description: result.message || "Failed to update registration status.",
      });
    }
    
    setIsUpdating(false);
  };
  
  const isLoading = loading || authLoading;
  const isRegistrationsOpen = eventSettings?.registrationsOpen ?? true;
  const canEdit = userRole === 'admin' || userRole === 'superadmin';


  if (isLoading) {
    return <div className="flex justify-center items-center h-20"><Loader2 className="h-8 w-8 animate-spin" /></div>
  }
  
  if (error) {
     return <div className="text-destructive flex items-center gap-2"><AlertTriangle/> {error}</div>
  }

  return (
    <div className="border rounded-lg p-4 flex flex-col sm:flex-row justify-between items-center bg-secondary/50">
        <div>
            <h4 className="font-semibold">Registration Status</h4>
            <p className="text-sm text-muted-foreground">
                Control whether new users can register for the event.
            </p>
        </div>
        <div className="flex items-center gap-4 mt-4 sm:mt-0">
             <Badge variant={isRegistrationsOpen ? "default" : "destructive"}>
                {isRegistrationsOpen ? 'Open' : 'Closed'}
             </Badge>
            <Button onClick={handleToggleRegistration} disabled={isUpdating || !canEdit} variant="outline">
                {isUpdating ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : isRegistrationsOpen ? (
                    <ToggleLeft className="mr-2 h-4 w-4" />
                ) : (
                    <ToggleRight className="mr-2 h-4 w-4" />
                )}
                {isRegistrationsOpen ? 'Close Registrations' : 'Open Registrations'}
            </Button>
        </div>
    </div>
  );
}
