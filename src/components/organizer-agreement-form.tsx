
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ShieldCheck, UserCheck } from "lucide-react";
import { createAndRequestOrganizerAccess } from "@/app/actions";
import { auth } from "@/lib/firebase";
import { useSignInWithEmailAndPassword } from "react-firebase-hooks/auth";
import { useRouter } from "next/navigation";
import { Separator } from "./ui/separator";
import Link from "next/link";
import { useEffect } from "react";

const formSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters."),
  email: z.string().email("A valid email is required."),
  password: z.string().min(6, "Password must be at least 6 characters."),
  confirmPassword: z.string().min(6, "Password must be at least 6 characters."),
  consent: z.boolean().refine((val) => val === true, {
    message: "You must agree to the terms to proceed.",
  }),
}).superRefine((data, ctx) => {
    if (data.password !== data.confirmPassword) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Passwords do not match.",
        path: ["confirmPassword"],
      });
    }
});

const organizerRules = [
  "Assist with event setup, check-in, and breakdown.",
  "Help guide and support riders along the route.",
  "Communicate clearly and respectfully with all participants.",
  "Follow all instructions from the lead event coordinators.",
  "Be available for the entire duration of the event schedule.",
  "Uphold a positive and helpful attitude at all times."
];

export function OrganizerAgreementForm() {
  const { toast } = useToast();
  const router = useRouter();
  const [signInWithEmailAndPassword] = useSignInWithEmailAndPassword(auth);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    mode: "onChange",
    defaultValues: {
      name: "",
      email: "",
      password: "",
      confirmPassword: "",
      consent: false,
    },
  });

  const { formState: { isSubmitting }, watch } = form;
  const password = watch("password");
  const confirmPassword = watch("confirmPassword");

  const passwordsMatch = password && confirmPassword && password === confirmPassword;
  const passwordsDoNotMatch = password && confirmPassword && password !== confirmPassword;


  async function onSubmit(values: z.infer<typeof formSchema>) {
    try {
      const result = await createAndRequestOrganizerAccess(values);

      if (result.success) {
        toast({
          title: "Request Submitted!",
          description: result.message,
          action: <ShieldCheck className="text-primary" />,
        });
        
        // Log the new user in and redirect to dashboard
        const userCredential = await signInWithEmailAndPassword(values.email, values.password);
        if (userCredential) {
            router.push('/dashboard');
        }

      } else {
        throw new Error(result.message || "An unknown error occurred.");
      }
    } catch (e) {
      toast({
        variant: "destructive",
        title: "Uh oh! Something went wrong.",
        description: (e as Error).message,
      });
    }
  }
  
  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="font-headline text-3xl">Organizer Access Request</CardTitle>
        <CardDescription>
          Create a new account to request access to event management tools. If you already have an account, please <Link href="/login" className="text-primary underline">log in</Link> and request access from your dashboard.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">

             <h3 className="text-lg font-medium text-primary flex items-center gap-2"><UserCheck /> New Account Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                    <FormItem>
                        <FormLabel>Full Name</FormLabel>
                        <FormControl>
                        <Input placeholder="John Doe" {...field} />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                    )}
                />
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
                         {passwordsMatch && <p className="text-xs text-green-600">Passwords match.</p>}
                         {passwordsDoNotMatch && <p className="text-xs text-destructive">Passwords do not match.</p>}
                        <FormMessage />
                    </FormItem>
                    )}
                />
            </div>

            <Separator />
            
            <div className="space-y-4">
              <div className="space-y-2 rounded-md border p-4">
                <h4 className="font-medium text-base">Organizer Responsibilities</h4>
                <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                  {organizerRules.map(rule => <li key={rule}>{rule}</li>)}
                </ul>
              </div>
              <FormField
                control={form.control}
                name="consent"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4 shadow-sm">
                    <FormControl>
                      <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel>I have read and agree to the organizer responsibilities.</FormLabel>
                      <FormMessage />
                    </div>
                  </FormItem>
                )}
              />
            </div>
            <Button type="submit" className="w-full" disabled={isSubmitting || !form.formState.isValid}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isSubmitting ? "Submitting..." : "Create Account & Submit Request"}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
