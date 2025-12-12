
"use client";

import { useState } from 'react';
import { RegistrationForm } from '@/components/registration-form';
import { Header } from '@/components/header';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { OrganizerAgreementForm } from '@/components/organizer-agreement-form';
import { useDoc } from '@/firebase/firestore/use-doc';
import { doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { EventSettings } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Info, Loader2, Phone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { useMemoFirebase } from '@/firebase/memo';

export default function RegisterPage() {
  const [isOrganizer, setIsOrganizer] = useState(false);
  const settingsDocRef = useMemoFirebase(() => doc(db, 'settings', 'event'), []);
  const { data: eventSettings, loading, error } = useDoc<EventSettings>(settingsDocRef);

  const registrationsOpen = eventSettings?.registrationsOpen ?? true;

  const renderContent = () => {
    if (loading) {
        return (
            <div className="w-full max-w-2xl mx-auto py-8 flex justify-center items-center h-64">
                <Loader2 className="h-8 w-8 animate-spin" />
            </div>
        );
    }
    
    if (!registrationsOpen) {
        return (
            <div className="w-full max-w-2xl mx-auto py-8">
                 <Card>
                    <CardHeader className="text-center">
                         <Info className="h-12 w-12 mx-auto text-destructive" />
                        <CardTitle className="text-2xl mt-4">Registrations Are Currently Closed</CardTitle>
                        <CardDescription>
                            We are not accepting new registrations at this time.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="text-center space-y-4">
                        <p className="text-muted-foreground">For any inquiries, please contact the event organizer.</p>
                         <Button asChild className="shrink-0">
                            <Link href="tel:7899359217">
                                <Phone className="mr-2 h-4 w-4" />
                                Call Event Head
                            </Link>
                        </Button>
                    </CardContent>
                 </Card>
            </div>
        )
    }

    return (
        <div className="w-full max-w-2xl mx-auto py-8 space-y-6">
            <div className="flex items-center justify-center space-x-3">
            <Label htmlFor="form-toggle" className={!isOrganizer ? 'text-primary' : 'text-muted-foreground'}>
                Register as Rider
            </Label>
            <Switch
                id="form-toggle"
                checked={isOrganizer}
                onCheckedChange={setIsOrganizer}
                aria-label="Toggle between rider and organizer registration"
            />
            <Label htmlFor="form-toggle" className={isOrganizer ? 'text-primary' : 'text-muted-foreground'}>
                Become an Organizer
            </Label>
        </div>
        
        {isOrganizer ? <OrganizerAgreementForm /> : <RegistrationForm />}

        </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />
      <div className="flex-grow flex items-center justify-center p-4">
         {renderContent()}
      </div>
    </div>
  );
}
