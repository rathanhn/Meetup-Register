
"use client";

import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { manageSchedule, deleteScheduleItem } from "@/app/actions";
import type { ScheduleEvent, UserRole } from "@/lib/types";
import type { User } from 'firebase/auth';
import { Loader2, Trash2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useEffect } from "react";
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
} from "@/components/ui/alert-dialog"

const formSchema = z.object({
  time: z.string().min(1, "Time is required."),
  title: z.string().min(3, "Title is required."),
  description: z.string().min(10, "Description is required."),
  icon: z.string().min(1, "Icon is required."),
});

const icons = ["Users", "Flag", "Coffee", "CheckCircle", "Medal", "Cake", "Map", "Utensils"];

interface ScheduleFormProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  scheduleItem: ScheduleEvent | null;
  user: User | null | undefined;
  userRole: UserRole | null;
}

export function ScheduleForm({ isOpen, setIsOpen, scheduleItem, user, userRole }: ScheduleFormProps) {
  const { toast } = useToast();
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { time: "", title: "", description: "", icon: "Default" },
  });

  const isSuperAdmin = userRole === 'superadmin';

  useEffect(() => {
    if (scheduleItem) {
      form.reset(scheduleItem);
    } else {
      form.reset({ time: "", title: "", description: "", icon: "Default" });
    }
  }, [scheduleItem, form, isOpen]);

  const { isSubmitting } = form.formState;

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    if (!user) return;
    try {
      const token = await user.getIdToken();
      const result = await manageSchedule({ ...values, adminId: user.uid, scheduleId: scheduleItem?.id, token });
      if (result.success) {
        toast({ title: "Success", description: result.message });
        setIsOpen(false);
      }
    } catch (e: any) {
      toast({ variant: "destructive", title: "Error", description: e.message });
    }
  };

  const handleDelete = async () => {
    if (!user || !scheduleItem) return;
    try {
      const token = await user.getIdToken();
      const result = await deleteScheduleItem(scheduleItem.id, user.uid, token);
      if (result.success) {
        toast({ title: "Success", description: result.message });
        setIsOpen(false);
      }
    } catch (e: any) {
      toast({ variant: "destructive", title: "Error", description: e.message });
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{scheduleItem ? "Edit Schedule Item" : "Add Schedule Item"}</DialogTitle>
          <DialogDescription>Fill in the details for the event schedule item.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField name="time" control={form.control} render={({ field }) => (
              <FormItem><FormLabel>Time</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
            )} />
            <FormField name="title" control={form.control} render={({ field }) => (
              <FormItem><FormLabel>Title</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
            )} />
            <FormField name="description" control={form.control} render={({ field }) => (
              <FormItem><FormLabel>Description</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
            )} />
            <FormField name="icon" control={form.control} render={({ field }) => (
              <FormItem><FormLabel>Icon</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl><SelectTrigger><SelectValue placeholder="Select an icon" /></SelectTrigger></FormControl>
                  <SelectContent>{icons.map(icon => <SelectItem key={icon} value={icon}>{icon}</SelectItem>)}</SelectContent>
                </Select>
                <FormMessage /></FormItem>
            )} />
            <DialogFooter className="flex-col-reverse sm:flex-row sm:justify-between w-full">
              {scheduleItem ? (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button type="button" variant="destructive" disabled={isSubmitting}><Trash2 className="mr-2 h-4 w-4" /> Delete</Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader><AlertDialogTitle>Are you sure?</AlertDialogTitle><AlertDialogDescription>This action will permanently delete this schedule item.</AlertDialogDescription></AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">Delete</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              ) : <div></div>}
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {scheduleItem ? "Save Changes" : "Create Item"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

