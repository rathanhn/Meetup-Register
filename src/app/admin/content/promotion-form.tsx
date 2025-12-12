
"use client";

import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { managePromotion, deletePromotion } from "@/app/actions";
import type { Offer } from "@/lib/types";
import type { User } from 'firebase/auth';
import { Loader2, Trash2, Upload } from "lucide-react";
import { useEffect, useState, useRef } from "react";
import Image from "next/image";
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
import { Textarea } from "@/components/ui/textarea";

const formSchema = z.object({
  title: z.string().min(3, "Title is required."),
  description: z.string().min(10, "Description is required."),
  validity: z.string().min(3, "Validity is required."),
  imageUrl: z.string().url("A valid promotion photo is required."),
  imageHint: z.string().min(2, "Image hint is required"),
  actualPrice: z.coerce.number().optional(),
  offerPrice: z.coerce.number().optional(),
});

interface PromotionFormProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  promotion: Offer | null;
  user: User | null | undefined;
}

const fileToDataUri = (file: File) => {
    return new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
};

export function PromotionForm({ isOpen, setIsOpen, promotion, user }: PromotionFormProps) {
  const { toast } = useToast();
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { title: "", description: "", validity: "", imageUrl: "", imageHint: "", actualPrice: undefined, offerPrice: undefined },
  });

  const photoInputRef = useRef<HTMLInputElement>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
     if (isOpen) {
        if (promotion) {
          form.reset(promotion);
          setPhotoPreview(promotion.imageUrl);
        } else {
          form.reset({ title: "", description: "", validity: "", imageUrl: "", imageHint: "", actualPrice: undefined, offerPrice: undefined });
          setPhotoPreview(null);
        }
    }
  }, [promotion, form, isOpen]);

  const { isSubmitting } = form.formState;

  const handlePhotoChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setIsUploading(true);
      setPhotoPreview(URL.createObjectURL(file));
      try {
        const dataUri = await fileToDataUri(file);
        const uploadResponse = await fetch('/api/upload', {
            method: 'POST',
            body: JSON.stringify({ file: dataUri }),
            headers: { 'Content-Type': 'application/json' },
        });
        const { url, error } = await uploadResponse.json();
        if (error || !url) {
            throw new Error(error || 'Failed to upload photo.');
        }
        form.setValue('imageUrl', url, { shouldValidate: true });
        setPhotoPreview(url);
      } catch (e) {
        toast({ variant: 'destructive', title: 'Upload Failed', description: (e as Error).message });
        setPhotoPreview(promotion?.imageUrl || null);
      } finally {
        setIsUploading(false);
      }
    }
  };

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    if (!user) return;
    try {
        const result = await managePromotion({ ...values, adminId: user.uid, promotionId: promotion?.id });
        if (result.success) {
          toast({ title: "Success", description: result.message });
          setIsOpen(false);
        }
    } catch (e: any) {
        toast({ variant: "destructive", title: "Error", description: e.message });
    }
  };
  
  const handleDelete = async () => {
    if (!user || !promotion) return;
    try {
        const result = await deletePromotion(promotion.id, user.uid);
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
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{promotion ? "Edit Promotion" : "Add Promotion"}</DialogTitle>
          <DialogDescription>Fill in the details for the shop promotion.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 px-1">
            <FormField name="title" control={form.control} render={({ field }) => (
              <FormItem><FormLabel>Title</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
            )} />
             <FormField name="description" control={form.control} render={({ field }) => (
              <FormItem><FormLabel>Description</FormLabel><FormControl><Textarea {...field} rows={4} /></FormControl><FormMessage /></FormItem>
            )} />
             <FormField name="validity" control={form.control} render={({ field }) => (
              <FormItem><FormLabel>Validity</FormLabel><FormControl><Input {...field} placeholder="e.g., Valid until August 15th" /></FormControl><FormMessage /></FormItem>
            )} />
            
            <FormItem>
              <FormLabel>Promotion Photo</FormLabel>
              <FormControl>
                <div className="space-y-2">
                    <div className="relative w-full aspect-video rounded-md border-2 border-dashed flex items-center justify-center bg-muted overflow-hidden">
                    {photoPreview ? (
                        <Image src={photoPreview} alt="Promotion preview" fill className="object-cover" />
                    ) : null}
                     {isUploading && <div className="absolute inset-0 bg-black/50 flex items-center justify-center rounded-md"><Loader2 className="w-8 h-8 text-white animate-spin" /></div>}
                    </div>
                    <Button type="button" variant="outline" className="w-full" onClick={() => photoInputRef.current?.click()} disabled={isUploading}>
                        <Upload className="mr-2 h-4 w-4" /> {photoPreview ? 'Change Photo' : 'Upload Photo'}
                    </Button>
                    <Input
                    type="file"
                    className="hidden"
                    ref={photoInputRef}
                    onChange={handlePhotoChange}
                    accept="image/png, image/jpeg"
                    disabled={isUploading}
                    />
                </div>
              </FormControl>
               <FormMessage>{form.formState.errors.imageUrl?.message}</FormMessage>
            </FormItem>

             <FormField name="imageHint" control={form.control} render={({ field }) => (
              <FormItem><FormLabel>Image Hint</FormLabel><FormControl><Input {...field} placeholder="riding gloves" /></FormControl><FormMessage /></FormItem>
            )} />
             <div className="grid grid-cols-2 gap-4">
                 <FormField name="actualPrice" control={form.control} render={({ field }) => (
                  <FormItem><FormLabel>Actual Price (Optional)</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField name="offerPrice" control={form.control} render={({ field }) => (
                  <FormItem><FormLabel>Offer Price (Optional)</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
            </div>

            <DialogFooter className="flex-col-reverse sm:flex-row sm:justify-between w-full pt-4 sticky bottom-0 bg-background/95 py-3 -mx-1 px-1">
                {promotion ? (
                     <AlertDialog>
                        <AlertDialogTrigger asChild><Button type="button" variant="destructive" disabled={isSubmitting}><Trash2 className="mr-2 h-4 w-4" /> Delete</Button></AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader><AlertDialogTitle>Are you sure?</AlertDialogTitle><AlertDialogDescription>This action will permanently delete this promotion.</AlertDialogDescription></AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">Delete</AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                ) : <div />}
              <Button type="submit" disabled={isSubmitting || isUploading}>
                {(isSubmitting || isUploading) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {promotion ? "Save Changes" : "Create Promotion"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

    