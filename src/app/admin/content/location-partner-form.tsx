
"use client";

import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { manageLocationPartner, deleteLocationPartner } from "@/app/actions";
import type { LocationPartner, UserRole } from "@/lib/types";
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
} from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";

const formSchema = z.object({
  name: z.string().min(3, "Name is required."),
  websiteUrl: z.string().url("A valid Instagram profile URL is required.").optional(),
  imageUrl: z.string().url("A valid promotion photo is required."),
  imageHint: z.string().min(2, "Image hint is required"),
});

interface LocationPartnerFormProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  partner: LocationPartner | null;
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

export function LocationPartnerForm({ isOpen, setIsOpen, partner, user }: LocationPartnerFormProps) {
  const { toast } = useToast();
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { name: "", websiteUrl: "", imageUrl: "", imageHint: "" },
  });

  const photoInputRef = useRef<HTMLInputElement>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
     if (isOpen) {
        if (partner) {
          form.reset(partner);
          setPhotoPreview(partner.imageUrl);
        } else {
          form.reset({ name: "", websiteUrl: "", imageUrl: "", imageHint: "" });
          setPhotoPreview(null);
        }
    }
  }, [partner, form, isOpen]);

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
        setPhotoPreview(partner?.imageUrl || null);
      } finally {
        setIsUploading(false);
      }
    }
  };

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    if (!user) return;
    try {
        const result = await manageLocationPartner({ ...values, adminId: user.uid, partnerId: partner?.id });
        if (result.success) {
          toast({ title: "Success", description: result.message });
          setIsOpen(false);
        }
    } catch (e: any) {
        toast({ variant: "destructive", title: "Error", description: e.message });
    }
  };
  
  const handleDelete = async () => {
    if (!user || !partner) return;
    try {
        const result = await deleteLocationPartner(partner.id, user.uid);
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
          <DialogTitle>{partner ? "Edit Location Partner" : "Add Location Partner"}</DialogTitle>
          <DialogDescription>Fill in the details for the location partner.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 px-1">
            <FormField name="name" control={form.control} render={({ field }) => (
              <FormItem><FormLabel>Partner Name</FormLabel><FormControl><Input {...field} placeholder="e.g., 5G Holiday Escape Resort" /></FormControl><FormMessage /></FormItem>
            )} />
             <FormField name="websiteUrl" control={form.control} render={({ field }) => (
              <FormItem><FormLabel>Instagram URL (Optional)</FormLabel><FormControl><Input {...field} placeholder="https://instagram.com/profilename" /></FormControl><FormMessage /></FormItem>
            )} />
            
            <FormItem>
              <FormLabel>Partner Photo/Logo</FormLabel>
              <FormControl>
                <div className="space-y-2">
                    <div className="relative w-full aspect-video rounded-md border-2 border-dashed flex items-center justify-center bg-muted overflow-hidden">
                    {photoPreview ? (
                        <Image src={photoPreview} alt="Partner preview" fill className="object-cover" />
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
              <FormItem><FormLabel>Image Hint</FormLabel><FormControl><Input {...field} placeholder="e.g., resort building" /></FormControl><FormMessage /></FormItem>
            )} />

            <DialogFooter className="flex-col-reverse sm:flex-row sm:justify-between w-full pt-4 sticky bottom-0 bg-background/95 py-3 -mx-1 px-1">
                {partner ? (
                     <AlertDialog>
                        <AlertDialogTrigger asChild><Button type="button" variant="destructive" disabled={isSubmitting}><Trash2 className="mr-2 h-4 w-4" /> Delete</Button></AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader><AlertDialogTitle>Are you sure?</AlertDialogTitle><AlertDialogDescription>This will permanently delete this partner.</AlertDialogDescription></AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">Delete</AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                ) : <div />}
              <Button type="submit" disabled={isSubmitting || isUploading}>
                {(isSubmitting || isUploading) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {partner ? "Save Changes" : "Create Partner"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

    