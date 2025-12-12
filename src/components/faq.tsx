
"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { HelpCircle, Loader2, AlertTriangle } from "lucide-react"
import { useCollection } from '@/firebase/firestore/use-collection';
import { collection, query, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { FaqItem } from "@/lib/types";
import { Skeleton } from "./ui/skeleton";
import { useMemoFirebase } from "@/firebase/memo";


const FaqSkeleton = () => (
    <div className="space-y-6">
        {[...Array(3)].map((_, i) => (
            <div key={i} className="space-y-1">
                <Skeleton className="h-5 w-1/3" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
            </div>
        ))}
    </div>
)


export function Faq() {
  const faqsQuery = useMemoFirebase(
    () => query(collection(db, 'faqs'), orderBy('createdAt', 'asc')),
    []
  );
  const { data: faqItems, loading, error } = useCollection<FaqItem>(faqsQuery);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 font-headline">
          <HelpCircle className="h-6 w-6 text-primary" />
          Frequently Asked Questions
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading && <FaqSkeleton />}
        {error && <p className="text-destructive"><AlertTriangle className="inline h-4 w-4 mr-2"/>Error loading FAQs.</p>}
        {!loading && faqItems && faqItems.length === 0 && (
            <p className="text-muted-foreground text-center">No FAQs have been added yet.</p>
        )}
        <div className="space-y-6">
          {faqItems && faqItems.map((faq) => (
            <div key={faq.id}>
              <h4 className="font-semibold">{faq.question}</h4>
              <p className="text-muted-foreground mt-1">{faq.answer}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
