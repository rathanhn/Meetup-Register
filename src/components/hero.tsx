

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
    const iconMap: Record<string, any> = {
        "UtensilsCrossed": UtensilsCrossed,
        "Gift": Gift,
        "BadgePercent": BadgePercent,
        "Calendar": Calendar,
        "MapPin": MapPin,
        "Rocket": Rocket
    };

    const hasDynamicPerks = settings.perks && settings.perks.length > 0;

    // Fallback to legacy fields if no dynamic perks exist (for backward compatibility)
    const displayPerks = hasDynamicPerks ? settings.perks : [
        { title: settings.perk1Title || "Free Lunch", description: settings.perk1Description || "Enjoy a complimentary meal.", icon: "UtensilsCrossed" },
        { title: settings.perk2Title || "Awesome Gifts", description: settings.perk2Description || "Win exciting prizes & goodies.", icon: "Gift" },
        { title: settings.perk3Title || "Exclusive Discounts", description: settings.perk3Description || "Get special offers from our partners.", icon: "BadgePercent" },
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

                <div className="mt-8 mb-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-6 max-w-4xl mx-auto text-left justify-center">
                    {displayPerks?.map((perk, index) => {
                        // Resolve icon: if it's a string, look it up in map, else default to Rocket. 
                        // If it came from legacy local array it might be a component already or string.
                        // The legacy array above uses strings for uniformity in this new logic.
                        let Icon = Rocket;
                        if (typeof perk.icon === 'string') {
                            Icon = iconMap[perk.icon] || Rocket;
                        }

                        return (
                            <div key={index} className="flex items-center gap-3 p-3 bg-secondary/50 rounded-lg shadow-sm border border-border/50">
                                <Icon className="h-6 w-6 text-primary flex-shrink-0" />
                                <div>
                                    <h4 className="font-semibold text-sm sm:text-base">{perk.title}</h4>
                                    <p className="text-xs sm:text-sm text-muted-foreground">{perk.description}</p>
                                </div>
                            </div>
                        )
                    })}
                </div>

                <div className="my-6 md:my-8 flex justify-center w-full">
                    <div className="relative w-full max-w-4xl aspect-video rounded-lg shadow-md overflow-hidden">
                        <Image
                            src={settings.heroImageUrl || "https://picsum.photos/seed/motorcycle-hero/600/400"}
                            alt={settings.heroImageHint || "motorcycle ride"}
                            fill
                            className="object-cover"
                            data-ai-hint={settings.heroImageHint || "motorcycle ride"}
                            priority
                        />
                    </div>
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
