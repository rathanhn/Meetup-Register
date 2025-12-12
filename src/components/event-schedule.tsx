
"use client";

import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import type { ScheduleEvent } from "@/lib/types";
import { Flag, Coffee, Medal, Users, Cake, Map, CheckCircle, Loader2, AlertTriangle } from "lucide-react";
import { useCollection } from '@/firebase/firestore/use-collection';
import { collection, query, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Skeleton } from "./ui/skeleton";
import { useMemoFirebase } from "@/firebase/memo";

const iconMap: { [key: string]: React.ElementType } = {
    Users,
    Flag,
    Coffee,
    CheckCircle,
    Medal,
    Cake,
    Map,
    Default: Map,
};

const ScheduleSkeleton = () => (
    <div className="relative pl-6">
        <div className="absolute left-6 top-0 h-full w-0.5 bg-border -translate-x-1/2"></div>
        {[...Array(3)].map((_, i) => (
            <div key={i} className="relative mb-8 pl-8">
                 <div className="absolute -left-0.5 top-1 h-5 w-5 rounded-full bg-muted ring-4 ring-background flex items-center justify-center">
                    <Skeleton className="h-3 w-3 rounded-full" />
                </div>
                <div className="flex flex-col gap-1">
                    <Skeleton className="h-5 w-20" />
                    <Skeleton className="h-5 w-32" />
                    <Skeleton className="h-4 w-48" />
                </div>
            </div>
        ))}
    </div>
)


export function EventSchedule() {
    const scheduleQuery = useMemoFirebase(
      () => query(collection(db, 'schedule'), orderBy('createdAt', 'asc')),
      []
    );
    const { data: scheduleEvents, loading, error } = useCollection<ScheduleEvent>(scheduleQuery);

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2 font-headline">
                    <Map className="h-6 w-6 text-primary" />
                    Event Schedule
                </CardTitle>
            </CardHeader>
            <CardContent>
                 {loading && <ScheduleSkeleton />}
                {error && <p className="text-destructive flex items-center gap-2"><AlertTriangle /> Error loading schedule.</p>}
                {!loading && !error && scheduleEvents && (
                    <div className="relative pl-6">
                        <div className="absolute left-6 top-0 h-full w-0.5 bg-border -translate-x-1/2"></div>
                        {scheduleEvents.map((item, index) => {
                            const Icon = iconMap[item.icon] || iconMap.Default;
                            return (
                                <div key={item.id} className="relative mb-8 pl-8">
                                    <div className="absolute -left-0.5 top-1 h-5 w-5 rounded-full bg-primary ring-4 ring-background flex items-center justify-center">
                                        <Icon className="h-3 w-3 text-primary-foreground" />
                                    </div>
                                    <div className="flex flex-col">
                                        <p className="font-semibold text-primary">{item.time}</p>
                                        <h4 className="font-bold">{item.title}</h4>
                                        <p className="text-sm text-muted-foreground">{item.description}</p>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
