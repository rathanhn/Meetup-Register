
"use client";

import { Header } from "@/components/header";
import { Announcements } from "@/components/announcements";
import { CountdownTimer } from "@/components/countdown-timer";
import { StoreDetails } from "@/components/store-details";
import { RouteMap } from "@/components/route-map";
import { MapPin, Info, Phone, Award, Code } from "lucide-react";
import { Organizers } from "@/components/organizers";
import { EventSchedule } from "@/components/event-schedule";
import { Hero } from "@/components/hero";
import { Faq } from "@/components/faq";
import { QnaSection } from "@/components/qna-section";
import { RegisteredRiders } from "@/components/registered-riders";
import Link from "next/link";
import { useDoc } from "@/firebase/firestore/use-doc";
import { doc, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useMemo } from "react";
import type { EventSettings } from "@/lib/types";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { LocationPartnerCard } from "@/components/location-partner-card";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useMemoFirebase } from "@/firebase/memo";


export default function Home() {
  const settingsDocRef = useMemoFirebase(() => doc(db, 'settings', 'event') as any, []);
  const { data: eventSettingsDoc, loading, error } = useDoc<EventSettings>(settingsDocRef);

  const eventSettings = useMemo(() => {
    const defaultSettings = {
      startTime: new Date("2025-08-15T06:00:00"),
      registrationsOpen: true,
      showSchedule: true,
      showReviews: true,
      showOrganizers: true,
      showPromotions: true,
    } as EventSettings;

    if (!eventSettingsDoc) {
      return defaultSettings;
    }

    const data = eventSettingsDoc;
    return {
      ...defaultSettings,
      ...data,
      startTime: data.startTime instanceof Timestamp ? data.startTime.toDate() : new Date(data.startTime || "2025-08-15T06:00:00"),
    };
  }, [eventSettingsDoc]);

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <Header />

      <CountdownTimer targetDate={eventSettings.startTime} />
      <main className="flex-grow container mx-auto p-2 md:p-4">
        <div className="w-full max-w-7xl mx-auto space-y-6">
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

          <div className="w-full max-w-7xl mx-auto space-y-6">
            {/* Hero Section with Loading State */}
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

            {/* Registered Riders Section */}
            <section>
              <RegisteredRiders />
            </section>

            {/* Certificate Teaser - Full Width Card */}
            <section>
              <Card className="bg-primary/5 border-primary/20 hover:shadow-lg transition-shadow duration-300">
                <CardHeader className="items-center text-center pb-2">
                  <div className="p-3 rounded-full bg-primary/10 mb-4">
                    <Award className="h-8 w-8 text-primary" />
                  </div>
                  <CardTitle className="font-headline text-2xl">Get Your Digital Certificate!</CardTitle>
                  <CardDescription className="text-base max-w-2xl mx-auto mt-2">
                    All riders who successfully complete the ride will receive a personalized digital certificate of completion to commemorate their achievement.
                  </CardDescription>
                </CardHeader>
                <CardContent className="text-center pt-4">
                  <Button asChild size="lg" className="px-8">
                    <Link href="/register">Register to Ride</Link>
                  </Button>
                </CardContent>
              </Card>
            </section>

            {/* Sponsors / Store Details - Moved Here */}
            {eventSettings.showOrganizers && (
              <section>
                <StoreDetails settings={eventSettings} />
              </section>
            )}

            {/* Route Map - Full Width as requested */}
            <section className="space-y-4">
              <div className="flex items-center gap-2 mb-2 px-1">
                {/* Optional Section Header if we want one outside the card, otherwise the card has it */}
              </div>
              <RouteMap />
            </section>

            {/* Event Schedule */}
            {eventSettings.showSchedule && (
              <section>
                <EventSchedule />
              </section>
            )}

            {/* Organizers */}
            {eventSettings.showOrganizers && (
              <section>
                <Organizers />
              </section>
            )}

            {/* Location Partner */}
            <section>
              <LocationPartnerCard />
            </section>

            {/* Announcements */}
            <section>
              <Announcements />
            </section>

            {/* Community Q&A - Full Width */}
            <section>
              <QnaSection />
            </section>

            {/* FAQs */}
            <section>
              <Faq />
            </section>


          </div>


        </div>
      </main>

    </div>
  );
}
