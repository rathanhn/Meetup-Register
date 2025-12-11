
"use client";

import { Header } from "@/components/header";
import { Announcements } from "@/components/announcements";
import { Offers } from "@/components/offers";
import { CountdownTimer } from "@/components/countdown-timer";
import { StoreDetails } from "@/components/store-details";
import { RouteMap } from "@/components/route-map";
import { MapPin, Info, Phone, Award } from "lucide-react";
import { Organizers } from "@/components/organizers";
import { EventSchedule } from "@/components/event-schedule";
import { Hero } from "@/components/hero";
import { Faq } from "@/components/faq";
import { QnaSection } from "@/components/qna-section";
import { RegisteredRiders } from "@/components/registered-riders";
import Link from "next/link";
import { useDocument } from "react-firebase-hooks/firestore";
import { doc, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useMemo } from "react";
import type { EventSettings } from "@/lib/types";
import { GoogleReviews } from "@/components/google-reviews";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { LocationPartnerCard } from "@/components/location-partner-card";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";


export default function Home() {
  const [eventSettingsDoc, loading, error] = useDocument(doc(db, 'settings', 'event'));

  const eventSettings = useMemo(() => {
    if (loading || error || !eventSettingsDoc?.exists()) {
      return {
        startTime: new Date("2025-08-15T06:00:00"),
        registrationsOpen: true,
        showSchedule: true,
        showReviews: true,
        showOrganizers: true,
        showPromotions: true,
      } as EventSettings;
    }
    const data = eventSettingsDoc.data() as EventSettings;
    return {
      ...data,
      startTime: data.startTime instanceof Timestamp ? data.startTime.toDate() : new Date(data.startTime),
    };
  }, [eventSettingsDoc, loading, error]);

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <Header />
       <div className="bg-secondary text-secondary-foreground py-2 border-b">
        <div className="container mx-auto flex justify-center items-center gap-2 text-center px-4">
          <MapPin className="h-4 w-4 flex-shrink-0" />
          <p className="text-xs sm:text-sm font-medium">
            Designed & Developed by Rathan H N
          </p>
        </div>
      </div>
      <CountdownTimer targetDate={eventSettings.startTime} />
      <main className="flex-grow container mx-auto p-4 md:p-8 space-y-8">
        {!eventSettings.registrationsOpen && !loading && (
          <Alert variant="destructive" className="border-2">
            <Info className="h-4 w-4" />
            <AlertTitle className="font-bold text-lg">Registration is Closed</AlertTitle>
            <AlertDescription className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mt-2">
              <span>For inquiries, please contact the event head.</span>
               <Button asChild className="shrink-0">
                  <Link href="tel:+910000000000">
                    <Phone className="mr-2 h-4 w-4" />
                    Call Event Head
                  </Link>
               </Button>
            </AlertDescription>
          </Alert>
        )}

        {loading ? (
            <div className="rounded-lg bg-card shadow-lg overflow-hidden p-12 space-y-4">
                <Skeleton className="h-10 w-3/4 mx-auto" />
                <Skeleton className="h-6 w-full max-w-2xl mx-auto" />
                <Skeleton className="h-64 w-full max-w-xl mx-auto" />
                 <div className="flex justify-center gap-4">
                    <Skeleton className="h-12 w-32" />
                    <Skeleton className="h-12 w-32" />
                </div>
            </div>
        ) : (
             <Hero 
                registrationsOpen={eventSettings.registrationsOpen ?? true}
                settings={eventSettings}
            />
        )}
       
        <RegisteredRiders />
        
        <Card className="bg-primary/5 border-primary/20">
          <CardHeader className="items-center text-center">
              <Award className="h-10 w-10 text-primary mb-2" />
              <CardTitle className="font-headline">Get Your Digital Certificate!</CardTitle>
              <CardDescription>
                  All riders who successfully complete the ride will receive a personalized digital certificate of completion to commemorate their achievement.
              </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
              <Button asChild>
                  <Link href="/register">Register to Ride</Link>
              </Button>
          </CardContent>
        </Card>
        
         <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {eventSettings.showSchedule && <EventSchedule />}
            <RouteMap />
        </div>
        
        {eventSettings.showOrganizers && <Organizers />}
        
        <LocationPartnerCard />
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
            <Announcements />
            <QnaSection />
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="md:col-span-3">
                <Faq />
            </div>
            <div className="md:col-span-3 lg:col-span-1 flex flex-col gap-8">
                {eventSettings.showReviews && <GoogleReviews />}
                {eventSettings.showOrganizers && <StoreDetails />}
            </div>
        </div>
        
        {eventSettings.showPromotions && <Offers />}

      </main>
      <footer className="text-center p-4 text-muted-foreground text-sm">
        <p>&copy; {new Date().getFullYear()} RideRegister. All Rights Reserved.</p>
         <p>Follow us on <Link href="https://www.instagram.com/your-profile" target="_blank" className="text-primary hover:underline">Instagram</Link></p>
         <p className="mt-2">Designed & Developed by Rathan H N</p>
      </footer>
    </div>
  );
}
