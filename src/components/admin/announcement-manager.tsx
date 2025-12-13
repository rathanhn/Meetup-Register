
"use client";

import { useCollection } from '@/firebase/firestore/use-collection';
import { collection, query, orderBy, doc, getDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { Loader2, Trash2, AlertTriangle, Send, User as UserIcon } from 'lucide-react';
import type { Announcement, UserRole } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Form, FormControl, FormField, FormItem, FormMessage } from '@/components/ui/form';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { addAnnouncement, deleteAnnouncement } from '@/app/actions';
import { useToast } from '@/hooks/use-toast';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { Separator } from '@/components/ui/separator';
import { formatDistanceToNow } from 'date-fns';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useEffect, useState } from 'react';
import { Badge } from '../ui/badge';
import { Skeleton } from '../ui/skeleton';
import { useMemoFirebase } from '@/firebase/memo';

const announcementSchema = z.object({
  message: z.string().min(5, "Min 5 characters.").max(280, "Max 280 characters."),
});

const AnnouncementSkeleton = () => (
  <div className="flex items-start justify-between gap-4 p-3 border rounded-lg bg-background">
    <div className="flex-grow space-y-2">
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-2/3" />
      <Skeleton className="h-4 w-1/3" />
    </div>
    <Skeleton className="h-8 w-8" />
  </div>
)

export function AnnouncementManager() {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [adminDisplayName, setAdminDisplayName] = useState("Admin");
  const { toast } = useToast();

  const form = useForm<z.infer<typeof announcementSchema>>({
    resolver: zodResolver(announcementSchema),
    defaultValues: { message: "" },
  });
  const { isSubmitting } = form.formState;

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const fetchUserData = async () => {
      if (user) {
        const userDoc = await getDoc(doc(db, "users", user.uid));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          setUserRole(userData.role as UserRole);
          setAdminDisplayName(userData.displayName || "Admin");
        }
      }
    };
    fetchUserData();
  }, [user]);

  const announcementsQuery = useMemoFirebase(() => query(collection(db, 'announcements'), orderBy('createdAt', 'desc')), []);
  const { data: announcements, loading: announcementsLoading, error } = useCollection<Announcement>(announcementsQuery);

  const canPost = userRole === 'admin' || userRole === 'superadmin';

  const handleDelete = async (id: string) => {
    if (!user || !canPost) return;
    try {
      const token = await user.getIdToken();
      const result = await deleteAnnouncement({ adminId: user.uid, announcementId: id, token });
      if (!result.success) {
        toast({ variant: 'destructive', title: 'Error', description: result.message });
      }
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Error', description: e.message });
    }
  };

  async function onSubmit(values: z.infer<typeof announcementSchema>) {
    if (!user || !userRole || !canPost) {
      toast({ variant: 'destructive', title: 'Error', description: "You don't have permission to post." });
      return;
    };

    try {
      const token = await user.getIdToken();
      const result = await addAnnouncement({
        adminId: user.uid,
        adminName: adminDisplayName,
        message: values.message,
        token,
      });
      if (result.success) {
        toast({ title: 'Success', description: 'Announcement posted.' });
        form.reset();
      } else {
        toast({ variant: 'destructive', title: 'Error', description: result.message });
      }
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Error', description: e.message });
    }
  }

  const isLoading = authLoading || announcementsLoading;
  const announcementDocs = announcements || [];

  return (
    <div className="space-y-4">
      {canPost && (
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-2">
            <FormField
              control={form.control}
              name="message"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <Textarea placeholder="Type your announcement here..." {...field} rows={3} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" disabled={isSubmitting || isLoading}>
              {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
              Post Announcement
            </Button>
          </form>
        </Form>
      )}

      <Separator />

      <h4 className="text-sm font-medium text-muted-foreground">Posted Announcements</h4>

      <ScrollArea className="h-64 pr-4">
        <div className="space-y-3">
          {isLoading && (
            <div className="space-y-3">
              <AnnouncementSkeleton />
              <AnnouncementSkeleton />
            </div>
          )}
          {error && <p className="text-sm text-destructive flex items-center gap-2"><AlertTriangle className="h-4 w-4" /> Error loading.</p>}
          {!isLoading && announcementDocs.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">No announcements have been posted yet.</p>
          )}
          {announcementDocs.map(announcement => (
            <div key={announcement.id} className="flex items-start justify-between gap-4 p-3 border rounded-lg bg-background">
              <div className="flex-grow">
                <p className="text-sm">{announcement.message}</p>
                <div className="text-xs text-muted-foreground mt-2 space-y-1">
                  <div className="flex items-center gap-2">
                    <UserIcon className="h-3 w-3" />
                    <span>Posted by: {announcement.adminName} <Badge variant="secondary" className="capitalize">{announcement.adminRole}</Badge></span>
                  </div>
                  <p>{announcement.createdAt ? formatDistanceToNow(announcement.createdAt.toDate(), { addSuffix: true }) : 'just now'}</p>
                </div>
              </div>
              {canPost && (
                <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0" onClick={() => handleDelete(announcement.id)} disabled={!user}>
                  <Trash2 className="h-4 w-4" />
                  <span className="sr-only">Delete</span>
                </Button>
              )}
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
