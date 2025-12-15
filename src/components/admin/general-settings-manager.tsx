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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Upload, Save } from 'lucide-react';

const fileToDataUri = (file: File) => {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

export function GeneralSettingsManager() {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [eventSettings, setEventSettings] = useState<EventSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const { toast } = useToast();

  const [formData, setFormData] = useState<Partial<EventSettings>>({});

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
          const data = docSnap.data() as EventSettings;
          setEventSettings(data);
          setFormData(data);
        } else {
          setEventSettings({ startTime: new Date(), registrationsOpen: true });
        }
        setLoading(false);
      },
      (err) => {
        setError("Failed to load settings.");
        setLoading(false);
      }
    );
    return () => unsubscribe();
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleToggleRegistration = async () => {
    if (!user || !eventSettings) return;
    setIsUpdating(true);
    const newStatus = !eventSettings.registrationsOpen;
    // ... existing logic but using new token based auth if possible ...
    // re-using the logic from before for simple toggle
    const token = await user.getIdToken();
    const result = await manageGeneralSettings({
      adminId: user.uid,
      token,
      registrationsOpen: newStatus
    });

    if (result.success) {
      toast({ title: "Success", description: `Registrations ${newStatus ? 'OPEN' : 'CLOSED'}.` });
    } else {
      toast({ variant: "destructive", title: "Error", description: result.message });
    }
    setIsUpdating(false);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, fieldName: keyof EventSettings) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      toast({ title: "Uploading...", description: "Please wait." });
      const dataUri = await fileToDataUri(file);
      const uploadResponse = await fetch('/api/upload', {
        method: 'POST', body: JSON.stringify({ file: dataUri }), headers: { 'Content-Type': 'application/json' },
      });
      const { url, error } = await uploadResponse.json();
      if (error || !url) throw new Error(error || 'Failed to upload.');

      setFormData(prev => ({ ...prev, [fieldName]: url }));
      toast({ title: "Uploaded!", description: "Image uploaded successfully. Don't forget to save." });

    } catch (err: any) {
      toast({ variant: "destructive", title: "Upload Failed", description: err.message });
    }
  };

  const handleSaveSettings = async () => {
    if (!user) return;
    setIsUpdating(true);

    try {
      const token = await user.getIdToken();
      const result = await manageGeneralSettings({
        adminId: user.uid,
        token,
        ...formData
      });

      if (result.success) {
        toast({ title: "Settings Saved", description: "Dashboard updated successfully." });
      } else {
        throw new Error(result.message);
      }
    } catch (e: any) {
      toast({ variant: "destructive", title: "Error saving settings", description: e.message });
    } finally {
      setIsUpdating(false);
    }
  };


  const isLoading = loading || authLoading;
  const isRegistrationsOpen = eventSettings?.registrationsOpen ?? true;
  const canEdit = userRole === 'admin' || userRole === 'superadmin';

  if (isLoading) return <div className="p-8 flex justify-center"><Loader2 className="animate-spin" /></div>;
  if (error) return <div className="p-4 text-destructive">{error}</div>;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Global Event Settings</CardTitle>
        <CardDescription>Manage tickets, certificates, and main event controls.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">

        {/* Registration Toggle Section */}
        <div className="flex items-center justify-between p-4 border rounded-lg bg-secondary/20">
          <div>
            <h4 className="font-semibold">Registration Status</h4>
            <p className="text-sm text-muted-foreground">{isRegistrationsOpen ? "Users can register." : "New registrations are paused."}</p>
          </div>
          <div className="flex items-center gap-4">
            <Badge variant={isRegistrationsOpen ? "default" : "destructive"}>
              {isRegistrationsOpen ? 'Open' : 'Closed'}
            </Badge>
            <Button onClick={handleToggleRegistration} disabled={isUpdating || !canEdit} variant="outline" size="sm">
              {isRegistrationsOpen ? <ToggleLeft className="mr-2 h-4 w-4" /> : <ToggleRight className="mr-2 h-4 w-4" />}
              {isRegistrationsOpen ? 'Close' : 'Open'}
            </Button>
          </div>
        </div>

        <Tabs defaultValue="ticket">
          <TabsList className="grid w-full grid-cols-3 h-auto min-h-[40px]">
            <TabsTrigger value="ticket">Digital Ticket</TabsTrigger>
            <TabsTrigger value="certificate">Certificate</TabsTrigger>
            <TabsTrigger value="header">Website Header</TabsTrigger>
            <TabsTrigger value="community">Community Links</TabsTrigger>
          </TabsList>

          <TabsContent value="header" className="space-y-4 pt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Header Title</Label>
                <Input name="headerTitle" value={formData.headerTitle || ''} onChange={handleInputChange} placeholder="e.g. RideRegister" />
                <p className="text-xs text-muted-foreground">The name displayed in the top navigation bar.</p>
              </div>
              <div className="space-y-2">
                <Label>Header Logo</Label>
                <div className="flex gap-2 items-center">
                  {formData.headerLogoUrl && <img src={formData.headerLogoUrl} className="h-10 w-10 object-contain rounded border" />}
                  <Input type="file" onChange={(e) => handleFileUpload(e, 'headerLogoUrl')} accept="image/*" />
                </div>
                <p className="text-xs text-muted-foreground">The logo displayed in the top navigation bar.</p>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="ticket" className="space-y-4 pt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Ticket Title</Label>
                <Input name="ticketTitle" value={formData.ticketTitle || ''} onChange={handleInputChange} placeholder="e.g. RideRegister" />
              </div>
              <div className="space-y-2">
                <Label>Ticket Subtitle</Label>
                <Input name="ticketSubtitle" value={formData.ticketSubtitle || ''} onChange={handleInputChange} placeholder="e.g. Event Ticket" />
              </div>
              <div className="space-y-2">
                <Label>Event Location Name</Label>
                <Input name="originShort" value={formData.originShort || ''} onChange={handleInputChange} placeholder="e.g. City Center Plaza" />
                <p className="text-xs text-muted-foreground">This location name appears on the Digital Ticket.</p>
              </div>
              <div className="space-y-2">
                <Label>Event Date (Display Only)</Label>
                {/* We are simplifying here by just letting them type a string for now, OR we can bind to real date if we parse. 
                     The user asked for Date/Time in settings. 
                     However, 'startTime' is a Timestamp object in DB. 
                     Let's add a proper Date/Time picker or reuse the logic.
                     Actually, to keep it simple and consistent with the request "Date / time / location is missing", 
                     let's add editable fields that OVERRIDE the complex logic if present, or better yet, simply expose the timestamp editing here.
                  */}
                <div className="flex gap-2">
                  <Input
                    type="datetime-local"
                    name="startTime"
                    // This requires conversion to/from Date object for input value
                    value={(() => {
                      if (!formData.startTime) return '';
                      try {
                        const date = (formData.startTime as any).seconds
                          ? (formData.startTime as any).toDate()
                          : new Date(formData.startTime);

                        // Convert to local ISO string for input [type=datetime-local]
                        // "YYYY-MM-DDThh:mm"
                        const offset = date.getTimezoneOffset();
                        const localDate = new Date(date.getTime() - (offset * 60 * 1000));
                        return localDate.toISOString().slice(0, 16);
                      } catch (e) {
                        return '';
                      }
                    })()}
                    onChange={(e) => {
                      if (!e.target.value) return;
                      const dateObj = new Date(e.target.value);
                      setFormData(prev => ({ ...prev, startTime: dateObj }));
                    }}
                  />
                </div>
                <p className="text-xs text-muted-foreground">This sets the main event date and time for Tickets, Certificates, and Countdown.</p>
              </div>
              <div className="space-y-2">
                <Label>Ticket Logo</Label>
                <div className="flex gap-2 items-center">
                  {formData.ticketLogoUrl && <img src={formData.ticketLogoUrl} className="h-10 w-10 object-contain rounded border" />}
                  <Input type="file" onChange={(e) => handleFileUpload(e, 'ticketLogoUrl')} accept="image/*" />
                </div>
              </div>
            </div>
            <div className="pt-2">
              <Button variant="secondary" onClick={() => window.open('/ticket-preview?name=Preview%20Rider', '_blank')}>
                Open Ticket Preview
              </Button>
              <p className="text-xs text-muted-foreground mt-1">Save changes before previewing.</p>
            </div>
          </TabsContent>

          <TabsContent value="certificate" className="space-y-4 pt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Certificate Title</Label>
                <Input name="certificateTitle" value={formData.certificateTitle || ''} onChange={handleInputChange} placeholder="e.g. Certificate of Completion" />
              </div>
              <div className="space-y-2">
                <Label>Certificate Subtitle</Label>
                <Input name="certificateSubtitle" value={formData.certificateSubtitle || ''} onChange={handleInputChange} placeholder="e.g. Annual Community Ride" />
              </div>
              <div className="space-y-2">
                <Label>Signatory Name</Label>
                <Input name="certificateSignatoryName" value={formData.certificateSignatoryName || ''} onChange={handleInputChange} placeholder="e.g. John Organizer" />
              </div>
              <div className="space-y-2">
                <Label>Signatory Role / Footer Title</Label>
                <Input name="certificateSignatoryRole" value={formData.certificateSignatoryRole || ''} onChange={handleInputChange} placeholder="e.g. Event Organizer" />
              </div>
              <div className="space-y-2">
                <Label>Certificate Logo</Label>
                <div className="flex gap-2 items-center">
                  {formData.certificateLogoUrl && <img src={formData.certificateLogoUrl} className="h-10 w-10 object-contain rounded border" />}
                  <Input type="file" onChange={(e) => handleFileUpload(e, 'certificateLogoUrl')} accept="image/*" />
                </div>
              </div>
            </div>
            <div className="pt-2">
              <Button variant="secondary" onClick={() => window.open('/certificate-preview?name=Preview%20Rider', '_blank')}>
                Open Certificate Preview
              </Button>
              <p className="text-xs text-muted-foreground mt-1">Save changes before previewing.</p>
            </div>
          </TabsContent>
          <TabsContent value="community" className="space-y-4 pt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>WhatsApp Group URL</Label>
                <Input name="communityWhatsAppGroupUrl" value={formData.communityWhatsAppGroupUrl || ''} onChange={handleInputChange} placeholder="https://chat.whatsapp.com/..." />
                <p className="text-xs text-muted-foreground">Link for the riders' community group.</p>
              </div>
              <div className="space-y-2">
                <Label>Organizer WhatsApp URL</Label>
                <Input name="communityOrganizerWhatsAppUrl" value={formData.communityOrganizerWhatsAppUrl || ''} onChange={handleInputChange} placeholder="https://wa.me/..." />
                <p className="text-xs text-muted-foreground">Direct contact link for the organizer.</p>
              </div>
              <div className="space-y-2">
                <Label>Instagram URL</Label>
                <Input name="communityInstagramUrl" value={formData.communityInstagramUrl || ''} onChange={handleInputChange} placeholder="https://instagram.com/..." />
                <p className="text-xs text-muted-foreground">Link to the event or organizer's Instagram profile.</p>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <div className="flex justify-end pt-4">
          <Button onClick={handleSaveSettings} disabled={isUpdating || !canEdit}>
            {isUpdating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Save Settings
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
