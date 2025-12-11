
"use client";

import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { updateRegistrationDetails } from "@/app/actions";
import type { Registration } from "@/lib/types";
import type { User } from 'firebase/auth';
import { Loader2, User as UserIcon, Upload, Save } from "lucide-react";
import { useEffect, useState, useRef } from "react";
import Image from "next/image";
import { Separator } from "../ui/separator";
import { RadioGroup, RadioGroupItem } from "../ui/radio-group";
import { Bike, Car, Tractor } from "lucide-react";

const phoneRegex = new RegExp(
  /^([+]?[\s0-9]+)?(\d{3}|[(]?[0-9]+[)])?([-]?[\s]?[0-9])+$/
);

const formSchema = z.object({
  fullName: z.string().min(2, "Full name must be at least 2 characters."),
  age: z.coerce.number().min(18, "You must be at least 18 years old.").max(100),
  phoneNumber: z.string().regex(phoneRegex, "Invalid phone number."),
  photoURL: z.string().url().optional(),
  registrationType: z.enum(["bike", "jeep", "car"]),
});

interface EditRegistrationFormProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  registration: Registration | null;
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

export function EditRegistrationForm({ isOpen, setIsOpen, registration, user }: EditRegistrationFormProps) {
  const { toast } = useToast();
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {},
  });

  const photoInputRef1 = useRef<HTMLInputElement>(null);
  const [photoPreview1, setPhotoPreview1] = useState<string | null>(null);
  const [isUploading1, setIsUploading1] = useState(false);
  

  useEffect(() => {
    if (isOpen && registration) {
        form.reset({
            ...registration,
            age: registration.age,
        });
        setPhotoPreview1(registration.photoURL || null);
    }
  }, [registration, form, isOpen]);

  const { isSubmitting } = form.formState;

  const handlePhotoChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploading1(true);
    setPhotoPreview1(URL.createObjectURL(file));

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
      form.setValue('photoURL', url, { shouldValidate: true });
      setPhotoPreview1(url);
    } catch (e) {
      toast({ variant: 'destructive', title: 'Upload Failed', description: (e as Error).message });
      setPhotoPreview1(registration?.photoURL || null);
    } finally {
      setIsUploading1(false);
    }
  };

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    if (!user || !registration) return;
    
    const result = await updateRegistrationDetails({ 
        ...values, 
        adminId: user.uid, 
        registrationId: registration.id 
    });

    if (result.success) {
      toast({ title: "Success", description: result.message });
      setIsOpen(false);
    } else {
      toast({ variant: "destructive", title: "Error", description: result.message });
    }
  };
  
  const isUploading = isUploading1;

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Registration</DialogTitle>
          <DialogDescription>
            Update participant information for: <span className="font-semibold">{registration?.fullName}</span>
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 pt-4">
             <h3 className="text-md font-semibold text-primary">Participant Information</h3>
             <FormItem>
              <FormLabel>Profile Photo</FormLabel>
              <FormControl>
                  <div className="flex items-center gap-4">
                      <div className="relative w-24 h-24 rounded-full border-2 border-dashed flex items-center justify-center bg-muted overflow-hidden">
                        {photoPreview1 ? (
                            <Image src={photoPreview1} alt="Profile preview" fill sizes="96px" className="rounded-full object-cover" />
                        ) : ( <UserIcon className="w-10 h-10 text-muted-foreground" /> )}
                         {isUploading1 && <div className="absolute inset-0 bg-black/50 flex items-center justify-center rounded-full"><Loader2 className="w-8 h-8 text-white animate-spin" /></div>}
                      </div>
                      <Button type="button" variant="outline" onClick={() => photoInputRef1.current?.click()} disabled={isUploading}>
                         <Upload className="mr-2 h-4 w-4" /> {photoPreview1 ? 'Change' : 'Upload'}
                      </Button>
                      <Input
                        type="file" className="hidden" ref={photoInputRef1}
                        onChange={handlePhotoChange}
                        accept="image/png, image/jpeg" disabled={isUploading}
                      />
                  </div>
              </FormControl>
               <FormMessage>{form.formState.errors.photoURL?.message}</FormMessage>
            </FormItem>
             <FormField name="fullName" control={form.control} render={({ field }) => (
              <FormItem><FormLabel>Full Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
            )} />
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField control={form.control} name="age" render={({ field }) => (<FormItem><FormLabel>Age</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="phoneNumber" render={({ field }) => (<FormItem><FormLabel>Phone Number</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
            </div>
            
            <FormField
              control={form.control}
              name="registrationType"
              render={({ field }) => (
                <FormItem className="space-y-3">
                  <FormLabel>Vehicle Type</FormLabel>
                  <FormControl>
                    <RadioGroup onValueChange={field.onChange} defaultValue={field.value} className="grid grid-cols-3 gap-4">
                      <FormItem className="flex items-center space-x-3 space-y-0">
                        <FormControl><RadioGroupItem value="bike" id="bike" className="peer sr-only" /></FormControl>
                        <FormLabel htmlFor="bike" className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary w-full cursor-pointer">
                            <Bike className="mb-3 h-6 w-6" /> Bike
                        </FormLabel>
                      </FormItem>
                      <FormItem className="flex items-center space-x-3 space-y-0">
                        <FormControl><RadioGroupItem value="jeep" id="jeep" className="peer sr-only" /></FormControl>
                        <FormLabel htmlFor="jeep" className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary w-full cursor-pointer">
                           <Tractor className="mb-3 h-6 w-6" /> Jeep
                        </FormLabel>
                      </FormItem>
                       <FormItem className="flex items-center space-x-3 space-y-0">
                        <FormControl><RadioGroupItem value="car" id="car" className="peer sr-only" /></FormControl>
                        <FormLabel htmlFor="car" className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary w-full cursor-pointer">
                           <Car className="mb-3 h-6 w-6" /> Car
                        </FormLabel>
                      </FormItem>
                    </RadioGroup>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="submit" disabled={isSubmitting || isUploading}>
                {(isSubmitting || isUploading) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <Save className="mr-2 h-4 w-4" /> Save Changes
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
