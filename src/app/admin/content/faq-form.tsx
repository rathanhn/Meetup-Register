
"use client";

import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { manageFaq, deleteFaq } from "@/app/actions";
import type { FaqItem } from "@/lib/types";
import type { User } from 'firebase/auth';
import { Loader2, Trash2 } from "lucide-react";
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
} from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";

const formSchema = z.object({
  question: z.string().min(10, "Question must be at least 10 characters."),
  answer: z.string().min(10, "Answer must be at least 10 characters."),
});

interface FaqFormProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  faqItem: FaqItem | null;
  user: User | null | undefined;
}

export function FaqForm({ isOpen, setIsOpen, faqItem, user }: FaqFormProps) {
  const { toast } = useToast();
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { question: "", answer: "" },
  });

  useEffect(() => {
    if (isOpen) {
        if (faqItem) {
          form.reset(faqItem);
        } else {
          form.reset({ question: "", answer: "" });
        }
    }
  }, [faqItem, form, isOpen]);

  const { isSubmitting } = form.formState;

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    if (!user) return;
    const result = await manageFaq({ ...values, adminId: user.uid, faqId: faqItem?.id });
    if (result.success) {
      toast({ title: "Success", description: result.message });
      setIsOpen(false);
    } else {
      toast({ variant: "destructive", title: "Error", description: result.message });
    }
  };
  
  const handleDelete = async () => {
    if (!user || !faqItem) return;
    const result = await deleteFaq(faqItem.id, user.uid);
     if (result.success) {
      toast({ title: "Success", description: result.message });
      setIsOpen(false);
    } else {
      toast({ variant: "destructive", title: "Error", description: result.message });
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{faqItem ? "Edit FAQ" : "Add FAQ"}</DialogTitle>
          <DialogDescription>Fill in the question and answer for the FAQ section.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField name="question" control={form.control} render={({ field }) => (
              <FormItem><FormLabel>Question</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
            )} />
             <FormField name="answer" control={form.control} render={({ field }) => (
              <FormItem><FormLabel>Answer</FormLabel><FormControl><Textarea rows={5} {...field} /></FormControl><FormMessage /></FormItem>
            )} />
            
            <DialogFooter className="flex-col-reverse sm:flex-row sm:justify-between w-full pt-2">
                {faqItem ? (
                     <AlertDialog>
                        <AlertDialogTrigger asChild><Button type="button" variant="destructive" disabled={isSubmitting}><Trash2 className="mr-2 h-4 w-4" /> Delete</Button></AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader><AlertDialogTitle>Are you sure?</AlertDialogTitle><AlertDialogDescription>This will permanently delete this FAQ item.</AlertDialogDescription></AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">Delete</AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                ) : <div />}
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {faqItem ? "Save Changes" : "Create FAQ"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
