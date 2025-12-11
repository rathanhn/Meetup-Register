
"use client";

import type { AppUser, Registration } from "@/lib/types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { User, Phone, Calendar, Ticket, Bike, Tractor, Car } from "lucide-react";
import { useState } from "react";

interface DashboardProfileCardProps {
    user: AppUser | null;
    registration: Registration | null;
}

const VehicleIcon = ({ type }: { type: Registration['registrationType'] }) => {
    switch (type) {
        case 'bike': return <Bike className="h-4 w-4 text-muted-foreground" />;
        case 'jeep': return <Tractor className="h-4 w-4 text-muted-foreground" />;
        case 'car': return <Car className="h-4 w-4 text-muted-foreground" />;
        default: return <Ticket className="h-4 w-4 text-muted-foreground" />;
    }
}

export function DashboardProfileCard({ user, registration }: DashboardProfileCardProps) {
    if (!user) return null;

    const photoSrc = registration?.photoURL || user.photoURL || undefined;

    return (
        <Card>
            <CardHeader className="flex flex-row items-center gap-4">
                <Avatar className="h-16 w-16 border-2 border-primary">
                    <AvatarImage src={photoSrc} alt={user.displayName ?? 'User'} />
                    <AvatarFallback><User className="w-8 h-8"/></AvatarFallback>
                </Avatar>
                <div className="pt-2">
                    <CardTitle>{registration?.fullName || user.displayName}</CardTitle>
                    <CardDescription>{user.email}</CardDescription>
                </div>
            </CardHeader>
            <CardContent>
                {registration ? (
                    <div className="space-y-4 pt-4 border-t">
                        <div className="grid grid-cols-2 gap-4 text-sm">
                            <div className="flex items-center gap-2">
                                <Phone className="h-4 w-4 text-muted-foreground" />
                                <span>{registration.phoneNumber}</span>
                            </div>
                             <div className="flex items-center gap-2">
                                <Calendar className="h-4 w-4 text-muted-foreground" />
                                <span>{registration.age} years old</span>
                            </div>
                            <div className="flex items-center gap-2 col-span-2">
                                <VehicleIcon type={registration.registrationType} />
                                <span className="capitalize">{registration.registrationType} Registration</span>
                            </div>
                        </div>
                    </div>
                ) : (
                   <div className="space-y-2 text-center text-muted-foreground border-t pt-4">
                        <p>You haven't registered for the ride yet.</p>
                   </div>
                )}
            </CardContent>
        </Card>
    );
}
