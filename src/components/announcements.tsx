
"use client";

import { Megaphone, CalendarClock, Loader2, AlertTriangle, User } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import type { Announcement } from "@/lib/types";
import { useCollection } from '@/firebase/firestore/use-collection';
import { collection, query, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { formatDistanceToNow } from "date-fns";
import { Badge } from "./ui/badge";
import { Skeleton } from "./ui/skeleton";
import { useMemoFirebase } from "@/firebase/memo";

const AnnouncementSkeleton = () => (
    <div className="space-y-4">
        {[...Array(2)].map((_, i) => (
            <div key={i} className="p-1 space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
                {i === 0 && <Separator className="mt-4" />}
            </div>
        ))}
    </div>
);

export function Announcements() {
  const announcementsQuery = useMemoFirebase(
    () => query(collection(db, 'announcements'), orderBy('createdAt', 'desc')),
    []
  );
  const { data: announcements, loading, error } = useCollection<Announcement>(announcementsQuery);

  const announcementDocs = announcements || [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 font-headline">
          <Megaphone className="h-6 w-6 text-primary" />
          Announcements
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-48 w-full">
          <div className="space-y-4">
            {loading && <AnnouncementSkeleton />}
            {error && <p className="text-sm text-destructive flex items-center gap-2"><AlertTriangle className="h-4 w-4" /> Error loading.</p>}
            {!loading && announcementDocs.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">No announcements yet. Check back soon!</p>
            )}
            {announcementDocs.map((announcement, index) => (
              <div key={announcement.id}>
                <div className="flex flex-col gap-2 p-1">
                  <p className="text-sm">{announcement.message}</p>
                  <div className="flex items-center text-xs text-muted-foreground gap-2 mt-1">
                    <User className="h-3 w-3" />
                    <span>
                      {announcement.adminName}
                    </span>
                    <Badge variant="secondary" className="capitalize text-xs">{announcement.adminRole}</Badge>
                    <span>&middot;</span>
                     <span>
                      {announcement.createdAt ? formatDistanceToNow(announcement.createdAt.toDate(), { addSuffix: true }) : 'just now'}
                    </span>
                  </div>
                </div>
                {index < announcementDocs.length - 1 && <Separator className="mt-4" />}
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
