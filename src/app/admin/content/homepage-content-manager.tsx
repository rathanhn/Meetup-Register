
"use client";

import { z } from "zod";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { manageHomepageContent } from "@/app/actions";
import type { EventSettings, UserRole } from "@/lib/types";
import { onAuthStateChanged, type User } from 'firebase/auth';
import { useDoc } from '@/firebase/firestore/use-doc';
import { doc, getDoc, DocumentReference } from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, AlertTriangle, Save, ShieldAlert, Upload, Plus, Trash2, Wand2 } from "lucide-react";
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
  perks: z.array(z.object({
    title: z.string().min(3, "Title required"),
    description: z.string().min(3, "Description required"),
    icon: z.string().optional(),
  })),
  sponsorTitle: z.string().optional(),
  sponsorSubtitle: z.string().optional(),
  sponsorLocation: z.string().optional(),
  sponsorDescription: z.string().optional(),
  sponsorWhatsapp: z.string().optional(),
  sponsorInstagram: z.string().optional(),
  sponsorImageUrl: z.string().url("Must be a valid URL").or(z.literal("")).optional(),
  developerName: z.string().optional(),
  developerLink: z.string().optional(),
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

  const settingsDocRef = useMemoFirebase(() => doc(db, 'settings', 'event') as DocumentReference<EventSettings>, []);
  const { data: settingsDoc, loading, error } = useDoc<EventSettings>(settingsDocRef);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      heroTitle: "", heroDescription: "", heroImageUrl: "", heroImageHint: "",
      perks: [
        { title: "Free Lunch", description: "Enjoy a complimentary meal.", icon: "UtensilsCrossed" },
        { title: "Awesome Gifts", description: "Win exciting prizes & goodies.", icon: "Gift" }
      ],
      sponsorTitle: "Sponsors / Collaborators", sponsorSubtitle: "", sponsorLocation: "", sponsorDescription: "Your platform for community rides.",
      sponsorWhatsapp: "", sponsorInstagram: "", sponsorImageUrl: "",
      developerName: "Rathan H N", developerLink: "https://www.instagram.com/rathan_hn",
    },
  });

  const { fields: perkFields, append: appendPerk, remove: removePerk } = useFieldArray({
    control: form.control,
    name: "perks",
  });

  const photoInputRef = useRef<HTMLInputElement>(null);
  const sponsorPhotoInputRef = useRef<HTMLInputElement>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [sponsorPhotoPreview, setSponsorPhotoPreview] = useState<string | null>(null);
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

      const existingPerks = data.perks && data.perks.length > 0 ? data.perks : [
        { title: data.perk1Title || "Free Lunch", description: data.perk1Description || "Enjoy a complimentary meal.", icon: "UtensilsCrossed" },
        { title: data.perk2Title || "Awesome Gifts", description: data.perk2Description || "Win exciting prizes & goodies.", icon: "Gift" },
        { title: data.perk3Title || "Exclusive Discounts", description: data.perk3Description || "Get special offers.", icon: "BadgePercent" },
      ];

      form.reset({
        heroTitle: data.heroTitle || "Annual Community Bike Ride",
        heroDescription: data.heroDescription || "Join us for an exhilarating bike ride to celebrate the spirit of community and adventure. Register now and be part of the excitement!",
        heroImageUrl: data.heroImageUrl || "",
        heroImageHint: data.heroImageHint || "",
        perks: existingPerks,
        sponsorTitle: data.sponsorTitle || "Sponsors / Collaborators",
        sponsorSubtitle: data.sponsorSubtitle || "",
        sponsorLocation: data.sponsorLocation || "",
        sponsorDescription: data.sponsorDescription || "Your platform for organizing and participating in exciting community bike rides.",
        sponsorWhatsapp: data.sponsorWhatsapp || "https://wa.me/910000000000",
        sponsorInstagram: data.sponsorInstagram || "",
        sponsorImageUrl: data.sponsorImageUrl || "",
        developerName: data.developerName || "Rathan H N",
        developerLink: data.developerLink || "",
      });
      setPhotoPreview(data.heroImageUrl || null);
      setSponsorPhotoPreview(data.sponsorImageUrl || null);
    }
  }, [settingsDoc, form]);

  const { isSubmitting } = form.formState;

  const handlePhotoChange = async (event: React.ChangeEvent<HTMLInputElement>, fieldName: 'heroImageUrl' | 'sponsorImageUrl') => {
    const file = event.target.files?.[0];
    if (file) {
      setIsUploading(true);
      const isHero = fieldName === 'heroImageUrl';
      if (isHero) setPhotoPreview(URL.createObjectURL(file));
      else setSponsorPhotoPreview(URL.createObjectURL(file));

      try {
        const dataUri = await fileToDataUri(file);
        const uploadResponse = await fetch('/api/upload', {
          method: 'POST', body: JSON.stringify({ file: dataUri }), headers: { 'Content-Type': 'application/json' },
        });
        const { url, error } = await uploadResponse.json();
        if (error || !url) throw new Error(error || 'Failed to upload photo.');
        form.setValue(fieldName, url, { shouldValidate: true });
        if (isHero) setPhotoPreview(url); else setSponsorPhotoPreview(url);
      } catch (e) {
        toast({ variant: 'destructive', title: 'Upload Failed', description: (e as Error).message });
        if (isHero) setPhotoPreview(settingsDoc?.heroImageUrl || null);
        else setSponsorPhotoPreview(settingsDoc?.sponsorImageUrl || null);
      } finally {
        setIsUploading(false);
      }
    }
  };

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    if (!user) return;
    try {
      const token = await user.getIdToken();
      const result = await manageHomepageContent({ ...values, adminId: user.uid, token });
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
        <CardTitle>Manage Homepage Content</CardTitle>
        <CardDescription>Edit main content, perks, and sponsors.</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center items-center h-40"><Loader2 className="h-8 w-8 animate-spin" /></div>
        ) : error ? (
          <div className="text-destructive flex items-center gap-2"><AlertTriangle /> Error loading data.</div>
        ) : !canEdit ? (
          <div className="text-muted-foreground flex items-center gap-2 p-4 bg-secondary rounded-md h-full text-sm"><ShieldAlert className="h-5 w-5" /><p>Only Admins can edit homepage content.</p></div>
        ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              {/* Hero Section */}
              <div className="space-y-4">
                <h3 className="font-semibold text-lg border-b pb-2">Hero Section</h3>
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
                      <Input type="file" className="hidden" ref={photoInputRef} onChange={(e) => handlePhotoChange(e, 'heroImageUrl')} accept="image/png, image/jpeg" disabled={isUploading} />
                    </div>
                  </FormControl>
                  <FormMessage>{form.formState.errors.heroImageUrl?.message}</FormMessage>
                </FormItem>
                <FormField name="heroImageHint" control={form.control} render={({ field }) => (
                  <FormItem><FormLabel>Hero Image Hint</FormLabel><FormControl><Input {...field} placeholder="e.g. motorcycle ride" /></FormControl><FormMessage /></FormItem>
                )} />
              </div>

              {/* Perks Section */}
              <div className="space-y-4 pt-4 border-t">
                <div className="flex items-center justify-between border-b pb-2">
                  <h3 className="font-semibold text-lg">Perks Section</h3>
                  <Button type="button" variant="outline" size="sm" onClick={() => appendPerk({ title: "New Perk", description: "Description", icon: "Gift" })}>
                    <Plus className="h-4 w-4 mr-2" /> Add Perk
                  </Button>
                </div>

                <div className="space-y-4">
                  {perkFields.map((field, index) => (
                    <div key={field.id} className="flex gap-4 items-start border p-4 rounded-md bg-card/50">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-grow">
                        <FormField
                          control={form.control}
                          name={`perks.${index}.title`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs">Title</FormLabel>
                              <FormControl>
                                <Input {...field} placeholder="Title" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name={`perks.${index}.description`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs">Description</FormLabel>
                              <FormControl>
                                <Input {...field} placeholder="Description" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name={`perks.${index}.icon`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs flex justify-between items-center">
                                Icon
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-5 w-5 text-muted-foreground hover:text-primary"
                                  title="Auto-detect icon"
                                  onClick={() => {
                                    const desc = form.getValues(`perks.${index}.description`);
                                    const title = form.getValues(`perks.${index}.title`);
                                    const text = `${title} ${desc}`.toLowerCase();
                                    let suggestedIcon = "Rocket";

                                    if (text.match(/food|lunch|dinner|meal|breakfast|snack|eat/)) suggestedIcon = "UtensilsCrossed";
                                    else if (text.match(/gift|prize|win|reward|goodie|swag/)) suggestedIcon = "Gift";
                                    else if (text.match(/discount|offer|save|percent|deal|coupon/)) suggestedIcon = "BadgePercent";
                                    else if (text.match(/date|time|schedule|calendar|day/)) suggestedIcon = "Calendar";
                                    else if (text.match(/map|location|route|place|where/)) suggestedIcon = "MapPin";

                                    field.onChange(suggestedIcon);
                                    toast({ description: `Icon set to ${suggestedIcon}` });
                                  }}
                                >
                                  <Wand2 className="h-3 w-3" />
                                </Button>
                              </FormLabel>
                              <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value}>
                                <FormControl>
                                  <SelectTrigger><SelectValue placeholder="Select Icon" /></SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="Rocket">Rocket</SelectItem>
                                  <SelectItem value="UtensilsCrossed">Food (Utensils)</SelectItem>
                                  <SelectItem value="Gift">Gift</SelectItem>
                                  <SelectItem value="BadgePercent">Discount (%)</SelectItem>
                                  <SelectItem value="Calendar">Calendar</SelectItem>
                                  <SelectItem value="MapPin">Map Pin</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                      <Button type="button" variant="destructive" size="icon" className="shrink-0 mt-6" onClick={() => removePerk(index)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  {perkFields.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">No perks added yet.</p>}
                </div>
              </div>

              {/* Sponsor Section */}
              <div className="space-y-4 pt-4 border-t">
                <h3 className="font-semibold text-lg border-b pb-2">Sponsors / Collaborators</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField name="sponsorTitle" control={form.control} render={({ field }) => (
                    <FormItem><FormLabel>Section Title (e.g. Sponsors)</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField name="sponsorSubtitle" control={form.control} render={({ field }) => (
                    <FormItem><FormLabel>Sponsor Subtitle (e.g. A Retail Mobile Store)</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField name="sponsorLocation" control={form.control} render={({ field }) => (
                    <FormItem><FormLabel>Sponsor Location (e.g. Madikeri)</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField name="sponsorWhatsapp" control={form.control} render={({ field }) => (
                    <FormItem><FormLabel>WhatsApp Link</FormLabel><FormControl><Input {...field} placeholder="https://wa.me/..." /></FormControl><FormMessage /></FormItem>
                  )} />
                </div>
                <FormField name="sponsorDescription" control={form.control} render={({ field }) => (
                  <FormItem><FormLabel>Description</FormLabel><FormControl><Textarea {...field} rows={2} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField name="sponsorInstagram" control={form.control} render={({ field }) => (
                  <FormItem><FormLabel>Instagram Link</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormItem>
                  <FormLabel>Sponsor Image (Horizontal)</FormLabel>
                  <FormControl>
                    <div className="space-y-2">
                      <div className="relative w-full aspect-video max-w-sm rounded-md border-2 border-dashed flex items-center justify-center bg-muted overflow-hidden">
                        {sponsorPhotoPreview ? <Image src={sponsorPhotoPreview} alt="Sponsor preview" fill className="object-cover" /> : <span className="text-muted-foreground">No Image</span>}
                        {isUploading && <div className="absolute inset-0 bg-black/50 flex items-center justify-center rounded-md"><Loader2 className="w-8 h-8 text-white animate-spin" /></div>}
                      </div>
                      <Button type="button" variant="outline" onClick={() => sponsorPhotoInputRef.current?.click()} disabled={isUploading}><Upload className="mr-2 h-4 w-4" /> {sponsorPhotoPreview ? 'Change Image' : 'Upload Image'}</Button>
                      <Input type="file" className="hidden" ref={sponsorPhotoInputRef} onChange={(e) => handlePhotoChange(e, 'sponsorImageUrl')} accept="image/png, image/jpeg" disabled={isUploading} />
                    </div>
                  </FormControl>
                  <FormMessage>{form.formState.errors.sponsorImageUrl?.message}</FormMessage>
                </FormItem>
              </div>

              {/* Footer / Developer Section */}
              <div className="space-y-4 pt-4 border-t">
                <h3 className="font-semibold text-lg border-b pb-2">Footer / Developer Info</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField name="developerName" control={form.control} render={({ field }) => (
                    <FormItem><FormLabel>Developer Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField name="developerLink" control={form.control} render={({ field }) => (
                    <FormItem><FormLabel>Developer Website/Link</FormLabel><FormControl><Input {...field} placeholder="https://..." /></FormControl><FormMessage /></FormItem>
                  )} />
                </div>
              </div>

              <Button type="submit" disabled={isSubmitting || !canEdit || isUploading}>
                {(isSubmitting || isUploading) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <Save className="mr-2 h-4 w-4" />
                Save Content
              </Button>
            </form>
          </Form>
        )}
      </CardContent>
    </Card >
  );
}

