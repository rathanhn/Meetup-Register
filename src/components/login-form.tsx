
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { auth, db } from '@/lib/firebase';
import { useSignInWithEmailAndPassword } from 'react-firebase-hooks/auth';
import { useRouter } from "next/navigation";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { getRedirectResult, GoogleAuthProvider, signInWithRedirect } from "firebase/auth";

const formSchema = z.object({
  email: z.string().email("Please enter a valid email address."),
  password: z.string().min(1, "Password cannot be empty."),
});

const GoogleIcon = () => (
    <svg className="mr-2 h-4 w-4" viewBox="0 0 48 48">
        <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8c-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4C12.955 4 4 12.955 4 24s8.955 20 20 20s20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"></path>
        <path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4C16.318 4 9.656 8.337 6.306 14.691z"></path>
        <path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.211 35.091 26.715 36 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"></path>
        <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303c-.792 2.237-2.231 4.16-4.082 5.571l6.19 5.238C42.021 35.591 44 30.134 44 24c0-1.341-.138-2.65-.389-3.917z"></path>
    </svg>
)

export function LoginForm() {
  const { toast } = useToast();
  const router = useRouter();
  const [
    signInWithEmailAndPassword,
    user,
    loading,
    error,
  ] = useSignInWithEmailAndPassword(auth);
  
  const [googleLoading, setGoogleLoading] = useState(false);
  const [isProcessingRedirect, setIsProcessingRedirect] = useState(true);
  
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const isSubmitting = loading || googleLoading || isProcessingRedirect;

  async function onSubmit(values: z.infer<typeof formSchema>) {
    await signInWithEmailAndPassword(values.email, values.password);
  }

  useEffect(() => {
    if (user) {
      router.push('/dashboard');
    }
  }, [user, router]);
  
  useEffect(() => {
    const processRedirectResult = async () => {
      try {
        const result = await getRedirectResult(auth);
        if (result?.user) {
          const user = result.user;
          const userRef = doc(db, "users", user.uid);
          const userDoc = await getDoc(userRef);

          if (!userDoc.exists()) {
              await setDoc(userRef, {
                  email: user.email,
                  displayName: user.displayName || user.email?.split('@')[0],
                  role: 'user',
                  photoURL: user.photoURL,
                  createdAt: serverTimestamp(),
              });
          }
          // The user object is now available from the hook, so the above useEffect will trigger redirect
        }
      } catch (error: any) {
        console.error("Error processing redirect result:", error);
         toast({
            variant: "destructive",
            title: "Google Sign-In Failed",
            description: error.message?.replace('Firebase: ', ''),
        });
      } finally {
        setIsProcessingRedirect(false);
      }
    };
    processRedirectResult();
  }, [toast]);
  
  useEffect(() => {
    if (error) {
      toast({
        variant: "destructive",
        title: "Login Failed",
        description: error.message.replace('Firebase: ', ''),
      });
    }
  }, [error, toast]);

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    const provider = new GoogleAuthProvider();
    try {
        await signInWithRedirect(auth, provider);
    } catch(e: any) {
        toast({
            variant: "destructive",
            title: "Google Sign-In Failed",
            description: e.message?.replace('Firebase: ', ''),
        });
        setGoogleLoading(false);
    }
  }

  if (isProcessingRedirect) {
    return (
        <Card className="w-full">
            <CardHeader>
                <CardTitle className="font-headline text-2xl">Welcome Back</CardTitle>
                <CardDescription>Sign in to access your dashboard and ticket.</CardDescription>
            </CardHeader>
            <CardContent className="flex justify-center items-center h-48">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </CardContent>
        </Card>
    )
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="font-headline text-2xl">Welcome Back</CardTitle>
        <CardDescription>Sign in to access your dashboard and ticket.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 gap-2">
            <Button variant="outline" className="w-full" disabled={isSubmitting} onClick={handleGoogleSignIn}>
                {googleLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <GoogleIcon />}
                Sign in with Google
            </Button>
        </div>
        
        <div className="relative my-4">
            <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">
                Or continue with email
                </span>
            </div>
        </div>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input placeholder="you@example.com" {...field} type="email"/>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Password</FormLabel>
                  <FormControl>
                    <Input type="password" placeholder="••••••••" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Sign In with Email
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
