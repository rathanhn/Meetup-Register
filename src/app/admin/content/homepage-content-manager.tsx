
"use client";

import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { manageHomepageContent } from "@/app/actions";
import type { EventSettings, UserRole } from "@/lib/types";
import { onAuthStateChanged, type User } from 'firebase/auth';
import { useDoc } from '@/firebase/firestore/use-doc';
import { doc, getDoc } from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';
import { Loader2, AlertTriangle, Save, ShieldAlert, Upload } from "lucide-react";
import { useEffect, useState, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import Image from "next/image";
import { useMemoFirebase } from "@/firebase/memo";

const formSchema = z.object({
  heroTitle: z.string().min(5, "Title is required."),
  heroDescription: z.string().min(10, "Description is required."),
  heroImageUrl: z.string().url("Must be a valid URL").or(z.literal("")),
  heroImageHint: z.string().optional(),
  perk1Title: z.string().min(3),
  perk1Description: z.string().min(3),
  perk2Title: z.string().min(3),
  perk2Description: z.string().min(3),
  perk3Title: z.string().min(3),
  perk3Description: z.string().min(3),
});

const fileToDataUri = (file: File) => {
    return new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
};

export function HomepageContentManager() {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const { toast } = useToast();
  
  const settingsDocRef = useMemoFirebase(() => doc(db, 'settings', 'event'), []);
  const { data: settingsDoc, loading, error } = useDoc<EventSettings>(settingsDocRef);
  
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
        heroTitle: "", heroDescription: "", heroImageUrl: "", heroImageHint: "",
        perk1Title: "Free Lunch", perk1Description: "Enjoy a complimentary meal.",
        perk2Title: "Awesome Gifts", perk2Description: "Win exciting prizes & goodies.",
        perk3Title: "Exclusive Discounts", perk3Description: "Get special offers.",
    },
  });

  const photoInputRef = useRef<HTMLInputElement>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

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
          heroTitle: data.heroTitle || "Annual Community Bike Ride",
          heroDescription: data.heroDescription || "Join us for an exhilarating bike ride to celebrate the spirit of community and adventure. Register now and be part of the excitement!",
          heroImageUrl: data.heroImageUrl || "",
          heroImageHint: data.heroImageHint || "",
          perk1Title: data.perk1Title || "Free Lunch",
          perk1Description: data.perk1Description || "Enjoy a complimentary meal.",
          perk2Title: data.perk2Title || "Awesome Gifts",
          perk2Description: data.perk2Description || "Win exciting prizes & goodies.",
          perk3Title: data.perk3Title || "Exclusive Discounts",
          perk3Description: data.perk3Description || "Get special offers.",
      });
      setPhotoPreview(data.heroImageUrl || null);
    }
  }, [settingsDoc, form]);

  const { isSubmitting } = form.formState;

  const handlePhotoChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setIsUploading(true);
      setPhotoPreview(URL.createObjectURL(file));
      try {
        const dataUri = await fileToDataUri(file);
        const uploadResponse = await fetch('/api/upload', {
            method: 'POST', body: JSON.stringify({ file: dataUri }), headers: { 'Content-Type': 'application/json' },
        });
        const { url, error } = await uploadResponse.json();
        if (error || !url) throw new Error(error || 'Failed to upload photo.');
        form.setValue('heroImageUrl', url, { shouldValidate: true });
        setPhotoPreview(url);
      } catch (e) {
        toast({ variant: 'destructive', title: 'Upload Failed', description: (e as Error).message });
        setPhotoPreview(settingsDoc?.heroImageUrl || null);
      } finally {
        setIsUploading(false);
      }
    }
  };

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    if (!user) return;
    try {
        const result = await manageHomepageContent({ ...values, adminId: user.uid });
        if (result.success) {
            toast({ title: "Success", description: result.message });
        }
    } catch(e: any) {
        toast({ variant: "destructive", title: "Error", description: e.message });
    }
  };

  const isLoading = loading || authLoading;
  const canEdit = userRole === 'admin' || userRole === 'superadmin';

  return (
    <Card>
      <CardHeader>
        <CardTitle>Manage Homepage Content</CardTitle>
        <CardDescription>Edit the main title, description, image, and perks on the homepage.</CardDescription>
      </CardHeader>
      <CardContent>
         {isLoading ? (
            <div className="flex justify-center items-center h-40"><Loader2 className="h-8 w-8 animate-spin" /></div>
        ) : error ? (
            <div className="text-destructive flex items-center gap-2"><AlertTriangle/> Error loading data.</div>
        ) : !canEdit ? (
             <div className="text-muted-foreground flex items-center gap-2 p-4 bg-secondary rounded-md h-full text-sm"><ShieldAlert className="h-5 w-5" /><p>Only Admins can edit homepage content.</p></div>
        ) : (
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <FormField name="heroTitle" control={form.control} render={({ field }) => (
                  <FormItem><FormLabel>Hero Title</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                 <FormField name="heroDescription" control={form.control} render={({ field }) => (
                  <FormItem><FormLabel>Hero Description</FormLabel><FormControl><Textarea {...field} rows={3} /></FormControl><FormMessage /></FormItem>
                )} />

                <FormItem>
                    <FormLabel>Hero Image</FormLabel>
                    <FormControl>
                        <div className="space-y-2">
                            <div className="relative w-full aspect-video rounded-md border-2 border-dashed flex items-center justify-center bg-muted overflow-hidden">
                            {photoPreview ? <Image src={photoPreview} alt="Hero preview" fill className="object-cover" /> : <span className="text-muted-foreground">No Image</span>}
                            {isUploading && <div className="absolute inset-0 bg-black/50 flex items-center justify-center rounded-md"><Loader2 className="w-8 h-8 text-white animate-spin" /></div>}
                            </div>
                            <Button type="button" variant="outline" className="w-full" onClick={() => photoInputRef.current?.click()} disabled={isUploading}><Upload className="mr-2 h-4 w-4" /> {photoPreview ? 'Change Image' : 'Upload Image'}</Button>
                            <Input type="file" className="hidden" ref={photoInputRef} onChange={handlePhotoChange} accept="image/png, image/jpeg" disabled={isUploading}/>
                        </div>
                    </FormControl>
                    <FormMessage>{form.formState.errors.heroImageUrl?.message}</FormMessage>
                </FormItem>
                 <FormField name="heroImageHint" control={form.control} render={({ field }) => (
                  <FormItem><FormLabel>Hero Image Hint</FormLabel><FormControl><Input {...field} placeholder="e.g. motorcycle ride" /></FormControl><FormMessage /></FormItem>
                )} />
                
                <div className="space-y-4 pt-4 border-t">
                    <h4 className="font-medium text-lg">Perks Section</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4"><FormField name="perk1Title" control={form.control} render={({ field }) => (<FormItem><FormLabel>Perk 1 Title</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} /><FormField name="perk1Description" control={form.control} render={({ field }) => (<FormItem><FormLabel>Perk 1 Description</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} /></div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4"><FormField name="perk2Title" control={form.control} render={({ field }) => (<FormItem><FormLabel>Perk 2 Title</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} /><FormField name="perk2Description" control={form.control} render={({ field }) => (<FormItem><FormLabel>Perk 2 Description</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} /></div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4"><FormField name="perk3Title" control={form.control} render={({ field }) => (<FormItem><FormLabel>Perk 3 Title</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} /><FormField name="perk3Description" control={form.control} render={({ field }) => (<FormItem><FormLabel>Perk 3 Description</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} /></div>
                </div>

                <Button type="submit" disabled={isSubmitting || !canEdit || isUploading}>
                  {(isSubmitting || isUploading) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  <Save className="mr-2 h-4 w-4"/>
                  Save Homepage Content
                </Button>
              </form>
            </Form>
        )}
      </CardContent>
    </Card>
  );
}

    