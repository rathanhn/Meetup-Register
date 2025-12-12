
"use client";

import {
  Card,
  CardContent,
} from "@/components/ui/card";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import type { Organizer } from "@/lib/types";
import { Users, AlertTriangle, Phone, User } from "lucide-react";
import { CardHeader, CardTitle } from "./ui/card";
import { useCollection } from '@/firebase/firestore/use-collection';
import { collection, query, orderBy } from 'firebase/firestore';
import { db } from "@/lib/firebase";
import { Button } from "./ui/button";
import Link from "next/link";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { Skeleton } from "./ui/skeleton";
import { useMemoFirebase } from "@/firebase/memo";

const OrganizerSkeleton = () => (
    <CarouselItem className="md:basis-1/2 lg:basis-1/3">
        <div className="p-1">
            <Card className="text-center">
                <CardContent className="flex flex-col items-center aspect-square justify-center p-6">
                    <Skeleton className="h-24 w-24 rounded-full mb-4" />
                    <Skeleton className="h-6 w-3/4 rounded-md" />
                    <Skeleton className="h-4 w-1/2 rounded-md mt-2" />
                </CardContent>
            </Card>
        </div>
    </CarouselItem>
);

export function Organizers() {
  const organizersQuery = useMemoFirebase(
    () => query(collection(db, 'organizers'), orderBy('createdAt', 'asc')),
    []
  );
  const { data: organizers, loading, error } = useCollection<Organizer>(organizersQuery);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 font-headline">
          <Users className="h-6 w-6 text-primary" />
          Meet the Organizers
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Carousel
          opts={{
            align: "start",
          }}
          className="w-full"
        >
          <CarouselContent>
             {loading && [...Array(3)].map((_, i) => <OrganizerSkeleton key={i} />)}
            {error && <p className="text-destructive"><AlertTriangle/> Error loading organizers.</p>}
            {organizers && organizers.map((organizer) => (
              <CarouselItem key={organizer.id} className="md:basis-1/2 lg:basis-1/3">
                <div className="p-1">
                  <Card className="text-center">
                    <CardContent className="flex flex-col items-center justify-center p-6 gap-2">
                       <Avatar className="h-[120px] w-[120px] border-4 border-primary/50 text-4xl">
                           <AvatarImage src={organizer.imageUrl} alt={organizer.name} className="object-cover"/>
                           <AvatarFallback><User /></AvatarFallback>
                       </Avatar>
                      <h3 className="text-lg font-semibold">{organizer.name}</h3>
                      <p className="text-sm text-muted-foreground">{organizer.role}</p>
                      {organizer.contactNumber && (
                        <Button asChild variant="outline" size="sm" className="mt-2">
                            <Link href={`tel:${organizer.contactNumber}`}>
                                <Phone className="mr-2 h-4 w-4" />
                                Contact
                            </Link>
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </CarouselItem>
            ))}
          </CarouselContent>
          <CarouselPrevious />
          <CarouselNext />
        </Carousel>
      </CardContent>
    </Card>
  );
}
