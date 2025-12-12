
"use client";

import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { manageHomepageVisibility } from "@/app/actions";
import type { EventSettings, UserRole } from "@/lib/types";
import { onAuthStateChanged, type User } from 'firebase/auth';
import { useDoc } from '@/firebase/firestore/use-doc';
import { doc, getDoc } from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';
import { Loader2, AlertTriangle, Save, ShieldAlert, Eye, EyeOff } from "lucide-react";
import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { useMemoFirebase } from "@/firebase/memo";

const formSchema = z.object({
  showSchedule: z.boolean(),
  showReviews: z.boolean(),
  showOrganizers: z.boolean(),
  showPromotions: z.boolean(),
});

export function HomepageVisibilityManager() {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const { toast } = useToast();
  
  const settingsDocRef = useMemoFirebase(() => doc(db, 'settings', 'event'), []);
  const { data: settingsDoc, loading, error } = useDoc<EventSettings>(settingsDocRef);
  
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
        showSchedule: true,
        showReviews: true,
        showOrganizers: true,
        showPromotions: true,
    },
  });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (user) {
        const userDocRef = doc(db, 'users', user.uid);
        getDoc(userDocRef).then(doc => {
            if (doc.exists()) setUserRole(doc.data().role as UserRole);
        })
    }
  }, [user]);

  useEffect(() => {
    if (settingsDoc) {
      const data = settingsDoc;
      form.reset({
          showSchedule: data.showSchedule ?? true,
          showReviews: data.showReviews ?? true,
          showOrganizers: data.showOrganizers ?? true,
          showPromotions: data.showPromotions ?? true,
      });
    }
  }, [settingsDoc, form]);

  const { isSubmitting } = form.formState;

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    if (!user) return;
    try {
        const result = await manageHomepageVisibility({ ...values, adminId: user.uid });
        if (result.success) {
          toast({ title: "Success", description: result.message });
        }
    } catch (e: any) {
        toast({ variant: "destructive", title: "Error", description: e.message });
    }
  };

  const isLoading = loading || authLoading;
  const canEdit = userRole === 'admin' || userRole === 'superadmin';

  return (
    <Card>
      <CardHeader>
        <CardTitle>Homepage Section Visibility</CardTitle>
        <CardDescription>Show or hide specific sections on the homepage.</CardDescription>
      </CardHeader>
      <CardContent>
         {isLoading ? (
            <div className="flex justify-center items-center h-40"><Loader2 className="h-8 w-8 animate-spin" /></div>
        ) : error ? (
            <div className="text-destructive flex items-center gap-2"><AlertTriangle/> Error loading data.</div>
        ) : !canEdit ? (
             <div className="text-muted-foreground flex items-center gap-2 p-4 bg-secondary rounded-md h-full text-sm"><ShieldAlert className="h-5 w-5" /><p>Only Admins can change visibility.</p></div>
        ) : (
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <FormField name="showSchedule" control={form.control} render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4"><div className="space-y-0.5"><FormLabel className="text-base">Schedule</FormLabel></div><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl></FormItem>
                    )}/>
                     <FormField name="showReviews" control={form.control} render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4"><div className="space-y-0.5"><FormLabel className="text-base">Reviews</FormLabel></div><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl></FormItem>
                    )}/>
                     <FormField name="showOrganizers" control={form.control} render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4"><div className="space-y-0.5"><FormLabel className="text-base">Organizers</FormLabel></div><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl></FormItem>
                    )}/>
                     <FormField name="showPromotions" control={form.control} render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4"><div className="space-y-0.5"><FormLabel className="text-base">Promotions</FormLabel></div><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl></FormItem>
                    )}/>
                </div>
                
                <Button type="submit" disabled={isSubmitting || !canEdit}>
                  {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  <Save className="mr-2 h-4 w-4"/>
                  Save Visibility Settings
                </Button>
              </form>
            </Form>
        )}
      </CardContent>
    </Card>
  );
}

    