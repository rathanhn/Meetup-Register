
"use client";

import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { manageEventTime } from "@/app/actions";
import type { EventSettings, UserRole } from "@/lib/types";
import { onAuthStateChanged, type User } from 'firebase/auth';
import { useDoc } from '@/firebase/firestore/use-doc';
import { doc, Timestamp, getDoc } from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';
import { Loader2, AlertTriangle, Save, Calendar as CalendarIcon, ShieldAlert } from "lucide-react";
import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { useMemoFirebase } from "@/firebase/memo";

const formSchema = z.object({
  eventDate: z.date({
    required_error: "A date for the event is required.",
  }),
});

export function EventTimeManager() {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const { toast } = useToast();

  // Lint fix: cast to DocumentReference<EventSettings>
  const eventSettingsRef = useMemoFirebase(() => doc(db, 'settings', 'event') as any as import('firebase/firestore').DocumentReference<EventSettings>, []);
  const { data: eventSettings, loading, error } = useDoc<EventSettings>(eventSettingsRef);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { eventDate: new Date() },
  });

  useEffect(() => {
    if (user) {
      const userDocRef = doc(db, 'users', user.uid);
      getDoc(userDocRef).then(doc => {
        if (doc.exists()) {
          setUserRole(doc.data().role as UserRole);
        }
      })
    }
  }, [user]);

  useEffect(() => {
    if (eventSettings) {
      const data = eventSettings;
      if (data.startTime instanceof Timestamp) {
        form.reset({ eventDate: data.startTime.toDate() });
      }
    }
  }, [eventSettings, form]);

  const { isSubmitting } = form.formState;

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    if (!user) return;
    try {
      const token = await user.getIdToken();
      const result = await manageEventTime({ ...values, adminId: user.uid, token });
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
        <CardTitle>Manage Event Start Time</CardTitle>
        <CardDescription>Set the official start date and time for the countdown clock.</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center items-center h-40">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : error ? (
          <div className="text-destructive flex items-center gap-2">
            <AlertTriangle /> Error loading event time data.
          </div>
        ) : !canEdit ? (
          <div className="text-muted-foreground flex items-center gap-2 p-4 bg-secondary rounded-md h-full text-sm">
            <ShieldAlert className="h-5 w-5" />
            <p>Only Admins can change the event time.</p>
          </div>
        ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                name="eventDate"
                control={form.control}
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Event Date & Time</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant={"outline"}
                            className={cn(
                              "w-[240px] pl-3 text-left font-normal",
                              !field.value && "text-muted-foreground"
                            )}
                          >
                            {field.value ? (
                              format(field.value, "PPP p")
                            ) : (
                              <span>Pick a date</span>
                            )}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value}
                          onSelect={field.onChange}
                          disabled={(date) => date < new Date("1900-01-01")}
                          initialFocus
                        />
                        <div className="p-2 border-t border-border">
                          <input
                            type="time"
                            className="w-full border-input bg-background p-2 rounded-md"
                            value={format(field.value || new Date(), 'HH:mm')}
                            onChange={(e) => {
                              const [hours, minutes] = e.target.value.split(':').map(Number);
                              const newDate = field.value ? new Date(field.value) : new Date();
                              newDate.setHours(hours, minutes);
                              field.onChange(newDate);
                            }}
                          />
                        </div>
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" disabled={isSubmitting || !canEdit}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <Save className="mr-2 h-4 w-4" />
                Save Event Time
              </Button>
            </form>
          </Form>
        )}
      </CardContent>
    </Card>
  );
}

