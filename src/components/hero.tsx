
import { Button } from "@/components/ui/button";
import Link from "next/link";
import Image from "next/image";
import HeroImage from "@/hero.png";
import { Gift, UtensilsCrossed, BadgePercent, Calendar, MapPin, Rocket } from "lucide-react";
import { StuntPerformers } from "./stunt-performers";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "./ui/card";

export function Hero({ registrationsOpen }: { registrationsOpen: boolean }) {
    return (
        <div className="rounded-lg bg-card shadow-lg overflow-hidden">
            <div className="p-6 sm:p-8 md:p-12 text-center">
                 <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold font-headline text-primary tracking-tight">
                    Annual Bike Ride
                </h2>
                <p className="mt-4 text-base sm:text-lg text-foreground/80 max-w-2xl mx-auto">
                    Join us for an exhilarating bike ride to celebrate the spirit of community and freedom. Register now and be part of the excitement!
                </p>

                 <div className="mt-8 mb-6 grid grid-cols-1 sm:grid-cols-3 gap-6 max-w-2xl mx-auto text-left">
                    <div className="flex items-center gap-3 p-3 bg-secondary/50 rounded-lg">
                        <UtensilsCrossed className="h-6 w-6 text-primary flex-shrink-0" />
                        <div>
                            <h4 className="font-semibold">Free Lunch</h4>
                            <p className="text-sm text-muted-foreground">Enjoy a complimentary meal.</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3 p-3 bg-secondary/50 rounded-lg">
                        <Gift className="h-6 w-6 text-primary flex-shrink-0" />
                        <div>
                            <h4 className="font-semibold">Awesome Gifts</h4>
                            <p className="text-sm text-muted-foreground">Win exciting prizes & goodies.</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3 p-3 bg-secondary/50 rounded-lg">
                        <BadgePercent className="h-6 w-6 text-primary flex-shrink-0" />
                        <div>
                            <h4 className="font-semibold">Exclusive Discounts</h4>
                            <p className="text-sm text-muted-foreground">Get special offers from our partners.</p>
                        </div>
                    </div>
                </div>

                <div className="my-6 md:my-8 flex justify-center">
                    <Image
                        src={HeroImage}
                        alt="Motorcyclists on a ride with flags"
                        width={600}
                        height={400}
                        className="rounded-lg shadow-md object-cover"
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

                <Card className="mt-12 text-center">
                    <CardHeader>
                        <CardTitle className="flex items-center justify-center gap-2 font-headline">
                           <Rocket className="h-6 w-6 text-primary"/> Get Ready for the Thrill!
                        </CardTitle>
                        <CardDescription>
                            Get ready for jaw-dropping stunts and adrenaline-pumping action at the ride!
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="text-center">
                             <p className="mt-2 text-muted-foreground">
                                Special Highlight: Professional Bike Stunt Show
                            </p>
                        </div>
                        <StuntPerformers />
                         <p className="mt-4 font-bold text-lg text-primary">
                            Come for the ride, stay for the thrill!
                        </p>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
