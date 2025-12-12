
"use client";

import Image from "next/image";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Gift, Loader2, AlertTriangle, MessageCircle } from "lucide-react";
import type { Offer } from "@/lib/types";
import { useCollection } from "@/firebase/firestore/use-collection";
import { collection, query, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Button } from "./ui/button";
import Link from "next/link";
import { useMemoFirebase } from "@/firebase/memo";

const OfferSkeleton = () => (
    <Card className="overflow-hidden">
        <div className="w-full h-[200px] bg-muted animate-pulse" />
        <CardHeader>
            <div className="h-6 w-3/4 bg-muted animate-pulse rounded-md" />
            <div className="h-4 w-full bg-muted animate-pulse rounded-md mt-2" />
        </CardHeader>
        <CardFooter>
            <div className="h-6 w-1/4 bg-muted animate-pulse rounded-full" />
        </CardFooter>
    </Card>
);


export function Offers() {
  const promotionsQuery = useMemoFirebase(
    () => query(collection(db, 'promotions'), orderBy('createdAt', 'desc')),
    []
  );
  const { data: promotions, loading, error } = useCollection<Offer>(promotionsQuery);

  const offers = promotions || [];

  const shopWhatsappNumber = "916363148287";

  const generateWhatsappMessage = (offer: Offer) => {
    const message = `Hi TeleFun, I'm interested in the "${offer.title}" offer. Could you please provide more details?`;
    return `https://wa.me/${shopWhatsappNumber}?text=${encodeURIComponent(message)}`;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 font-headline">
          <Gift className="h-6 w-6 text-primary" />
          Shop Promotions
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <OfferSkeleton />
            <OfferSkeleton />
          </div>
        )}
        {error && <p className="text-sm text-destructive flex items-center gap-2"><AlertTriangle className="h-4 w-4"/> Error loading promotions.</p>}
        {!loading && offers.length === 0 && <p className="text-sm text-center text-muted-foreground">No active promotions.</p>}
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {offers.map((offer) => (
            <Card key={offer.id} className="overflow-hidden flex flex-col">
              <Image
                  alt={offer.title}
                  className="w-full h-auto object-cover aspect-[3/2]"
                  height="200"
                  src={offer.imageUrl}
                  width="400"
                  data-ai-hint={offer.imageHint}
                />
              <div className="flex-grow flex flex-col p-6">
                <CardHeader className="p-0">
                  <CardTitle>{offer.title}</CardTitle>
                  <CardDescription className="whitespace-pre-wrap">
                    {offer.description}
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex-grow flex items-baseline gap-2 p-0 pt-4">
                    {offer.offerPrice && (
                        <>
                            <p className="text-2xl font-bold">₹{offer.offerPrice}</p>
                            {offer.actualPrice && <p className="text-md text-muted-foreground line-through">₹{offer.actualPrice}</p>}
                        </>
                    )}
                </CardContent>
                <CardFooter className="p-0 pt-4 flex-wrap gap-2 justify-between">
                  <Badge variant="outline">{offer.validity}</Badge>
                   <Button asChild size="sm" className="bg-green-500 hover:bg-green-600">
                      <Link href={generateWhatsappMessage(offer)} target="_blank">
                        <MessageCircle className="mr-2 h-4 w-4" /> Enquire on WhatsApp
                      </Link>
                    </Button>
                </CardFooter>
              </div>
            </Card>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
