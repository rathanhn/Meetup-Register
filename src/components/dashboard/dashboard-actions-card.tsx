
"use client";

import { useState } from 'react';
import type { Registration, AppUser } from "@/lib/types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Gift, Ban, Loader2, Send, UserPlus, Shield } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Textarea } from '../ui/textarea';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { cancelRegistration, requestOrganizerAccess } from '@/app/actions';
import { useToast } from '@/hooks/use-toast';
import { AddCoRiderForm } from './add-co-rider-form';
import Link from 'next/link';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '../ui/form';

interface DashboardActionsCardProps {
    registration: Registration | null;
    user: AppUser | null;
}

const cancelSchema = z.object({
    reason: z.string().min(10, "Please provide a reason (min 10 characters).").max(500),
});

export function DashboardActionsCard({ registration, user }: DashboardActionsCardProps) {
    const { toast } = useToast();
    const [isCancelling, setIsCancelling] = useState(false);
    const [isRequestingAccess, setIsRequestingAccess] = useState(false);
    const [isCancelDialogOpen, setIsCancelDialogOpen] = useState(false);
    const [isAddCoRiderOpen, setIsAddCoRiderOpen] = useState(false);


    const form = useForm<z.infer<typeof cancelSchema>>({
        resolver: zodResolver(cancelSchema),
        defaultValues: { reason: "" },
    });
    
    const handleCancellation = async (values: z.infer<typeof cancelSchema>) => {
        if (!registration) return;
        setIsCancelling(true);
        const result = await cancelRegistration({
            registrationId: registration.id,
            reason: values.reason
        });
        if (result.success) {
            toast({ title: "Success", description: result.message });
            setIsCancelDialogOpen(false);
            form.reset();
        } else {
            toast({ variant: 'destructive', title: 'Error', description: result.message });
        }
        setIsCancelling(false);
    }

    const handleAccessRequest = async () => {
        if (!user) return;
        setIsRequestingAccess(true);
        const result = await requestOrganizerAccess({ userId: user.id });
        if (result.success) {
            toast({ title: "Success", description: result.message });
        } else {
            toast({ variant: 'destructive', title: 'Error', description: result.message });
        }
        setIsRequestingAccess(false);
    }
    
    const canCancel = registration && (registration.status === 'approved' || registration.status === 'pending');
    const canRequestAccess = user && !user.accessRequest && user.role === 'user';


    return (
        <Card>
            <CardHeader>
                <CardTitle>Special Actions</CardTitle>
                <CardDescription>Other event-related actions are available here.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                 {canRequestAccess && (
                    <div className="p-4 border rounded-md flex items-center justify-between">
                        <div>
                            <h4 className="font-semibold flex items-center gap-2"><Shield className="text-primary"/> Become an Organizer</h4>
                            <p className="text-sm text-muted-foreground">Request access to the event admin tools.</p>
                        </div>
                        <Button onClick={handleAccessRequest} disabled={isRequestingAccess}>
                            {isRequestingAccess ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : null}
                            Request Access
                        </Button>
                    </div>
                )}


                <div className="p-4 border rounded-md flex items-center justify-between">
                     <div>
                        <h4 className="font-semibold flex items-center gap-2"><Ban className="text-destructive"/> Cancel Registration</h4>
                        <p className="text-sm text-muted-foreground">Request to withdraw your participation from the event.</p>
                    </div>
                    <AlertDialog open={isCancelDialogOpen} onOpenChange={setIsCancelDialogOpen}>
                        <AlertDialogTrigger asChild>
                            <Button variant="destructive" disabled={!canCancel}>
                                Request Cancellation
                            </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                             <Form {...form}>
                                <form onSubmit={form.handleSubmit(handleCancellation)}>
                                    <AlertDialogHeader>
                                        <AlertDialogTitle>Are you sure you want to cancel?</AlertDialogTitle>
                                        <AlertDialogDescription>
                                            This action cannot be undone. Please provide a reason for your cancellation. This will be sent to an admin for review.
                                        </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    
                                    <div className="py-4">
                                        <FormField
                                            control={form.control}
                                            name="reason"
                                            render={({ field }) => (
                                                <FormItem>
                                                <FormLabel>Reason for Cancellation</FormLabel>
                                                <FormControl>
                                                    <Textarea placeholder="e.g., Personal emergency, unable to attend..." {...field} />
                                                </FormControl>
                                                <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                    </div>

                                    <AlertDialogFooter>
                                        <AlertDialogCancel disabled={isCancelling}>Back</AlertDialogCancel>
                                        <Button type="submit" disabled={isCancelling}>
                                            {isCancelling ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                                            Submit Request
                                        </Button>
                                    </AlertDialogFooter>
                                </form>
                            </Form>
                        </AlertDialogContent>
                    </AlertDialog>
                </div>

                <div className="p-4 border rounded-md flex items-center justify-between bg-secondary/50">
                    <div>
                        <h4 className="font-semibold flex items-center gap-2"><Gift className="text-primary"/> Special Giveaway</h4>
                        <p className="text-sm text-muted-foreground">Participate for a chance to win exciting prizes!</p>
                    </div>
                    <Button disabled>Coming Soon</Button>
                </div>
            </CardContent>
        </Card>
    );
}
