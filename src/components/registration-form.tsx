
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect, useRef } from "react";
import { Loader2, PartyPopper, User, Upload, Bike, Tractor, Car } from "lucide-react";
import { createAccountAndRegisterRider } from "@/app/actions";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "./ui/separator";
import { auth, db } from "@/lib/firebase";
import { useSignInWithEmailAndPassword } from 'react-firebase-hooks/auth';
import Image from "next/image";
import { useRouter } from "next/navigation";
import { doc, serverTimestamp, setDoc, getDoc } from "firebase/firestore";
import { getRedirectResult, GoogleAuthProvider, signInWithRedirect } from "firebase/auth";

const phoneRegex = new RegExp(
  /^([+]?[\s0-9]+)?(\d{3}|[(]?[0-9]+[)])?([-]?[\s]?[0-9])+$/
);

const rideRules = [
    { id: 'rule1', text: "A helmet is compulsory for all riders." },
    { id: 'rule2', text: "Obey all traffic laws and signals." },
    { id: 'rule3', text: "Maintain a safe distance from other riders." },
    { id: 'rule4', text: "No racing or dangerous stunts are allowed." },
    { id: 'rule5', text: "Follow instructions from event organizers at all times." },
    { id: 'rule6', text: "Ensure your vehicle is in good working condition." },
    { id: 'rule7', text: "Riders are recommended to wear necessary gear like a jacket, shoes, and suitable pants." }
];

const formSchema = z
  .object({
    email: z.string().email("A valid email is required."),
    password: z.string().min(6, "Password must be at least 6 characters."),
    confirmPassword: z.string().min(6, "Password must be at least 6 characters."),
    
    registrationType: z.enum(["bike", "jeep", "car"], {
      required_error: "You need to select a vehicle type.",
    }),
    fullName: z.string().min(2, "Full name must be at least 2 characters."),
    age: z.coerce.number().min(18, "You must be at least 18 years old.").max(100),
    phoneNumber: z.string().regex(phoneRegex, "Invalid phone number."),
    whatsappNumber: z.string().optional(),
    photoURL: z.any().optional(),

    rule1: z.boolean().refine(val => val, { message: "You must agree to this rule." }),
    rule2: z.boolean().refine(val => val, { message: "You must agree to this rule." }),
    rule3: z.boolean().refine(val => val, { message: "You must agree to this rule." }),
    rule4: z.boolean().refine(val => val, { message: "You must agree to this rule." }),
    rule5: z.boolean().refine(val => val, { message: "You must agree to this rule." }),
    rule6: z.boolean().refine(val => val, { message: "You must agree to this rule." }),
    rule7: z.boolean().refine(val => val, { message: "You must agree to this rule." }),

  })
  .superRefine((data, ctx) => {
    if (data.password !== data.confirmPassword) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Passwords do not match.",
        path: ["confirmPassword"],
      });
    }
  });


// Helper to convert file to Base64 Data URI
const fileToDataUri = (file: File) => {
    return new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
};

const GoogleIcon = () => (
    <svg className="mr-2 h-4 w-4" viewBox="0 0 48 48">
        <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8c-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4C12.955 4 4 12.955 4 24s8.955 20 20 20s20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"></path>
        <path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4C16.318 4 9.656 8.337 6.306 14.691z"></path>
        <path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.211 35.091 26.715 36 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"></path>
        <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303c-.792 2.237-2.231 4.16-4.082 5.571l6.19 5.238C42.021 35.591 44 30.134 44 24c0-1.341-.138-2.65-.389-3.917z"></path>
    </svg>
)

export function RegistrationForm() {
  const { toast } = useToast();
  const router = useRouter();
  const [signInWithEmailAndPassword, , , signInError] = useSignInWithEmailAndPassword(auth);
  const [sameAsPhone, setSameAsPhone] = useState(false);
  
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);

  const [isProcessing, setIsProcessing] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(true);
  
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    mode: "onChange",
    defaultValues: {
      registrationType: "bike",
      email: "",
      password: "",
      confirmPassword: "",
      fullName: "",
      age: 18,
      phoneNumber: "",
      whatsappNumber: "",
      rule1: false,
      rule2: false,
      rule3: false,
      rule4: false,
      rule5: false,
      rule6: false,
      rule7: false,
    },
  });

  const { isSubmitting } = form.formState;
  const phoneNumber = form.watch("phoneNumber");

  useEffect(() => {
    if (sameAsPhone) {
      form.setValue("whatsappNumber", phoneNumber, { shouldValidate: true });
    }
  }, [sameAsPhone, phoneNumber, form]);

  const handlePhotoChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
        setPhotoPreview(URL.createObjectURL(file));
        form.setValue('photoURL', file, { shouldValidate: true });
    }
  };
  
  async function handleGoogleSignIn() {
    setIsGoogleLoading(true);
    const provider = new GoogleAuthProvider();
    try {
        await signInWithRedirect(auth, provider);
    } catch (e: any) {
        toast({
            variant: "destructive",
            title: "Google Sign-In Failed",
            description: e.message?.replace('Firebase: ', ''),
        });
        setIsGoogleLoading(false);
    }
  }

  useEffect(() => {
    const handleGoogleRedirect = async () => {
        try {
            const result = await getRedirectResult(auth);
            if (result && result.user) {
                const { user } = result;
                form.reset({
                    ...form.getValues(),
                    email: user.email || '',
                    fullName: user.displayName || '',
                    password: 'temp-password', // Prefill for validation
                    confirmPassword: 'temp-password',
                });
                if (user.photoURL) {
                    setPhotoPreview(user.photoURL);
                }
                 toast({
                    title: "Google Account Linked!",
                    description: "Please fill in the rest of your registration details.",
                });
            }
        } catch (error) {
             console.error("Error handling Google redirect:", error);
        } finally {
            setIsGoogleLoading(false);
        }
    }
    handleGoogleRedirect();
  }, [form, toast]);

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsProcessing(true);

    try {
        let finalPhotoUrl: string | undefined = undefined;

        if (values.photoURL && values.photoURL instanceof File) {
            const dataUri = await fileToDataUri(values.photoURL);
            const uploadResponse = await fetch('/api/upload', {
                method: 'POST', body: JSON.stringify({ file: dataUri }), headers: { 'Content-Type': 'application/json' },
            });
            const { url, error } = await uploadResponse.json();
            if (error || !url) throw new Error(error || 'Failed to upload photo.');
            finalPhotoUrl = url;
        } else if (typeof photoPreview === 'string' && photoPreview.startsWith('http')) {
            // Use the photo from Google if it exists and wasn't replaced
            finalPhotoUrl = photoPreview;
        }
      
      const submissionData = { ...values, photoURL: finalPhotoUrl };

      const result = await createAccountAndRegisterRider(submissionData);
      
      if (result.success) {
        toast({
          title: "Success!",
          description: result.message,
          action: <PartyPopper className="text-primary" />,
        });

        const userCredential = await signInWithEmailAndPassword(values.email, values.password);

        if (userCredential) {
            if (result.existingUser && result.dataForExistingUser) {
                const uid = userCredential.user.uid;
                const registrationRef = doc(db, "registrations", uid);
                const dataToSave = Object.fromEntries(Object.entries(result.dataForExistingUser).filter(([_, v]) => v !== null));
                await setDoc(registrationRef, { ...dataToSave, uid, createdAt: serverTimestamp() });
            }
            router.push('/dashboard');
        } else {
             throw new Error(signInError?.message || "Registration succeeded, but login failed. Please go to the login page.");
        }

      } else {
        throw new Error(result.message || "An unknown error occurred.");
      }
    } catch (e) {
      console.error("[Client] Error in onSubmit:", e);
      toast({
        variant: "destructive",
        title: "Uh oh! Something went wrong.",
        description: (e as Error).message || "There was a problem with your registration.",
      });
    } finally {
      setIsProcessing(false);
    }
  }


  return (
    <>
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="font-headline text-3xl">Create Account &amp; Register</CardTitle>
        <CardDescription>Fill in your details below to join the ride. Already have an account? <a href="/login" className="text-primary hover:underline">Login here</a>.</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            
            <h3 className="text-lg font-medium text-primary">Account Details</h3>
            <div className="grid grid-cols-1 gap-2">
                <Button variant="outline" className="w-full" disabled={isProcessing || isGoogleLoading} onClick={handleGoogleSignIn}>
                    {isGoogleLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <GoogleIcon />}
                    Continue with Google
                </Button>
            </div>
             <div className="relative my-4">
                <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
                <div className="relative flex justify-center text-xs uppercase"><span className="bg-background px-2 text-muted-foreground">Or with an email</span></div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                    <FormItem>
                        <FormLabel>Email Address</FormLabel>
                        <FormControl>
                        <Input placeholder="you@example.com" {...field} />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                    )}
                />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 <FormField
                    control={form.control}
                    name="password"
                    render={({ field }) => (
                    <FormItem>
                        <FormLabel>Password</FormLabel>
                        <FormControl>
                        <Input type="password" placeholder="Min. 6 characters" {...field} />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                    )}
                />
                 <FormField
                    control={form.control}
                    name="confirmPassword"
                    render={({ field }) => (
                    <FormItem>
                        <FormLabel>Confirm Password</FormLabel>
                        <FormControl>
                        <Input type="password" placeholder="Re-enter your password" {...field} />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                    )}
                />
            </div>
            
            <Separator />
            <h3 className="text-lg font-medium text-primary">Participant Details</h3>
            
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
            
            <FormItem>
              <FormLabel>Profile Photo</FormLabel>
              <FormControl>
                  <div className="flex items-center gap-4">
                      <div className="relative w-24 h-24 rounded-full border-2 border-dashed flex items-center justify-center bg-muted overflow-hidden">
                        {photoPreview ? (
                            <Image src={photoPreview} alt="Profile preview" width={96} height={96} className="w-full h-full object-cover" />
                        ) : (
                            <User className="w-10 h-10 text-muted-foreground" />
                        )}
                      </div>
                      <Button type="button" variant="outline" onClick={() => photoInputRef.current?.click() } disabled={isSubmitting || isProcessing}>
                         <Upload className="mr-2 h-4 w-4" /> Change Photo
                      </Button>
                      <Input
                        type="file"
                        className="hidden"
                        ref={photoInputRef}
                        onChange={handlePhotoChange}
                        accept="image/png, image/jpeg, image/heic, image/heif"
                      />
                  </div>
              </FormControl>
              <FormDescription>Upload a clear photo of yourself. This will appear on your digital ticket.</FormDescription>
              <FormMessage />
            </FormItem>

            <FormField control={form.control} name="fullName" render={({ field }) => (<FormItem><FormLabel>Full Name</FormLabel><FormControl><Input placeholder="John Doe" {...field} /></FormControl><FormDescription>This will be your account display name.</FormDescription><FormMessage /></FormItem>)} />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField control={form.control} name="age" render={({ field }) => (<FormItem><FormLabel>Age</FormLabel><FormControl><Input type="number" placeholder="18" {...field} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="phoneNumber" render={({ field }) => (<FormItem><FormLabel>Phone Number</FormLabel><FormControl><Input placeholder="9876543210" {...field} /></FormControl><FormMessage /></FormItem>)} />
            </div>
            
            <div className="space-y-2">
                <FormField
                    control={form.control}
                    name="whatsappNumber"
                    render={({ field }) => (
                    <FormItem>
                        <FormLabel>WhatsApp Number (Optional)</FormLabel>
                        <FormControl>
                        <Input placeholder="Same as phone" {...field} disabled={sameAsPhone} />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                    )}
                />
                <div className="flex items-center space-x-2">
                    <Checkbox
                        id="sameAsPhone"
                        checked={sameAsPhone}
                        onCheckedChange={(checked) => setSameAsPhone(!!checked)}
                    />
                    <label
                        htmlFor="sameAsPhone"
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                    >
                        Same as phone number
                    </label>
                </div>
            </div>

            <div className="space-y-4">
                <div className="space-y-2 rounded-md border p-4">
                    <h4 className="font-medium text-base">General Ride Rules &amp; Consent</h4>
                     <p className="text-sm text-muted-foreground">Please read and agree to all rules to continue.</p>
                     <div className="space-y-4 pt-2">
                        {rideRules.map((rule) => (
                             <FormField
                                key={rule.id}
                                control={form.control}
                                name={rule.id as 'rule1'}
                                render={({ field }) => (
                                    <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                                    <FormControl>
                                        <Checkbox
                                            checked={field.value}
                                            onCheckedChange={field.onChange}
                                        />
                                    </FormControl>
                                    <div className="space-y-1 leading-none">
                                        <FormLabel className="font-normal">{rule.text}</FormLabel>
                                        <FormMessage />
                                    </div>
                                    </FormItem>
                                )}
                                />
                        ))}
                    </div>
                </div>
            </div>
            <Button type="submit" className="w-full" disabled={isSubmitting || !form.formState.isValid || isProcessing}>
              {(isSubmitting || isProcessing) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isProcessing ? "Submitting..." : "Create Account & Register"}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
    </>
  );
}
