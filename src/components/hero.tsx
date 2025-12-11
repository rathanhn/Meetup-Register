

import { Button } from "@/components/ui/button";
import Link from "next/link";
import Image from "next/image";
import { Gift, UtensilsCrossed, BadgePercent, Calendar, MapPin, Rocket } from "lucide-react";
import type { EventSettings } from "@/lib/types";

interface HeroProps {
    registrationsOpen: boolean;
    settings: EventSettings;
}

export function Hero({ registrationsOpen, settings }: HeroProps) {
    const defaultPerks = [
        { title: "Free Lunch", description: "Enjoy a complimentary meal.", icon: "UtensilsCrossed" },
        { title: "Awesome Gifts", description: "Win exciting prizes & goodies.", icon: "Gift" },
        { title: "Exclusive Discounts", description: "Get special offers from our partners.", icon: "BadgePercent" },
    ];

    const perks = [
        { title: settings.perk1Title || defaultPerks[0].title, description: settings.perk1Description || defaultPerks[0].description, icon: UtensilsCrossed },
        { title: settings.perk2Title || defaultPerks[1].title, description: settings.perk2Description || defaultPerks[1].description, icon: Gift },
        { title: settings.perk3Title || defaultPerks[2].title, description: settings.perk3Description || defaultPerks[2].description, icon: BadgePercent },
    ];

    return (
        <div className="rounded-lg bg-card shadow-lg overflow-hidden">
            <div className="p-6 sm:p-8 md:p-12 text-center">
                 <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold font-headline text-primary tracking-tight">
                    {settings.heroTitle || "Annual Community Bike Ride"}
                </h2>
                <p className="mt-4 text-base sm:text-lg text-foreground/80 max-w-2xl mx-auto">
                    {settings.heroDescription || "Join us for an exhilarating bike ride to celebrate the spirit of community and adventure. Register now and be part of the excitement!"}
                </p>

                 <div className="mt-8 mb-6 grid grid-cols-1 sm:grid-cols-3 gap-6 max-w-2xl mx-auto text-left">
                    {perks.map((perk, index) => {
                        const Icon = perk.icon;
                        return (
                             <div key={index} className="flex items-center gap-3 p-3 bg-secondary/50 rounded-lg">
                                <Icon className="h-6 w-6 text-primary flex-shrink-0" />
                                <div>
                                    <h4 className="font-semibold">{perk.title}</h4>
                                    <p className="text-sm text-muted-foreground">{perk.description}</p>
                                </div>
                            </div>
                        )
                    })}
                </div>

                <div className="my-6 md:my-8 flex justify-center">
                    <Image
                        src={settings.heroImageUrl || "https://picsum.photos/seed/motorcycle-hero/600/400"}
                        alt={settings.heroImageHint || "motorcycle ride"}
                        width={600}
                        height={400}
                        className="rounded-lg shadow-md object-cover"
                        data-ai-hint={settings.heroImageHint || "motorcycle ride"}
                        priority
                    />
                </div>
                
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                    <Button asChild size="lg" disabled={!registrationsOpen}>
                        {registrationsOpen ? (
                             <Link href="/register">Register Now</Link>
                        ) : (
                            <span>Registrations Closed</span>
                        )}
                    </Button>
                    <Button asChild variant="outline" size="lg">
                        <Link href="/login">Check Status / Login</Link>
                    </Button>
                </div>
            </div>
        </div>
    );
}
