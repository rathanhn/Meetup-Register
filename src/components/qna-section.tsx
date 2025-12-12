
"use client";

import { useState, useEffect } from 'react';
import { useAuthState } from 'react-firebase-hooks/auth';
import { useCollection } from '@/firebase/firestore/use-collection';
import { collection, query, orderBy, getDoc, doc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Form, FormControl, FormField, FormItem, FormMessage } from '@/components/ui/form';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { addQuestion } from '@/app/actions';
import { useToast } from '@/hooks/use-toast';
import { Loader2, MessageSquare } from 'lucide-react';
import type { QnaQuestion } from '@/lib/types';
import { QnaItem } from './qna-item';
import Link from 'next/link';
import { Skeleton } from './ui/skeleton';
import { useMemoFirebase } from '@/firebase/memo';

const questionFormSchema = z.object({
  text: z.string().min(10, "Question must be at least 10 characters.").max(500, "Question cannot be longer than 500 characters."),
});

const QnaItemSkeleton = () => (
    <div className="p-4 border rounded-lg space-y-4">
        <div className="flex gap-4">
            <Skeleton className="h-10 w-10 rounded-full" />
            <div className="w-full space-y-2">
                 <Skeleton className="h-4 w-1/4" />
                 <Skeleton className="h-4 w-3/4" />
            </div>
        </div>
    </div>
);


export function QnaSection() {
  const [user, authLoading] = useAuthState(auth);
  const { toast } = useToast();
  const [userDisplayName, setUserDisplayName] = useState("Rider");

  const form = useForm<z.infer<typeof questionFormSchema>>({
    resolver: zodResolver(questionFormSchema),
    defaultValues: {
      text: "",
    },
  });
  const { isSubmitting } = form.formState;

  useEffect(() => {
    const fetchDisplayName = async () => {
        if (user) {
            const userDoc = await getDoc(doc(db, 'users', user.uid));
            if (userDoc.exists()) {
                setUserDisplayName(userDoc.data().displayName || "Rider");
            }
        }
    };
    fetchDisplayName();
  }, [user]);

  const questionsQuery = useMemoFirebase(
    () => query(collection(db, 'qna'), orderBy('isPinned', 'desc')),
    []
  );
  const { data: questions, loading: questionsLoading, error: questionsError } = useCollection<QnaQuestion>(questionsQuery);

  async function onSubmit(values: z.infer<typeof questionFormSchema>) {
    if (!user) {
      toast({
        variant: "destructive",
        title: "Not logged in",
        description: "You must be logged in to ask a question.",
      });
      return;
    }

    const result = await addQuestion({
      ...values,
      userId: user.uid,
      userName: userDisplayName,
      userPhotoURL: user.photoURL,
    });

    if (result.success) {
      toast({
        title: "Success!",
        description: result.message,
      });
      form.reset();
    } else {
      toast({
        variant: "destructive",
        title: "Error",
        description: result.message,
      });
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 font-headline">
          <MessageSquare className="h-6 w-6 text-primary" />
          Community Q&amp;A
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <Card className="bg-secondary/50 p-4">
          {authLoading ? (
            <div className="flex justify-center items-center h-24">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : user ? (
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="text"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <Textarea placeholder="Ask a question about the event..." {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Post Question
                </Button>
              </form>
            </Form>
          ) : (
            <div className="text-center text-sm text-muted-foreground flex flex-col items-center justify-center h-24">
              <p>Have a question? Join the conversation!</p>
              <Button asChild variant="link" className="px-1">
                <Link href="/login">Log in to ask a question.</Link>
              </Button>
            </div>
          )}
        </Card>

        <div className="space-y-4">
          {questionsLoading && (
            <div className="space-y-4">
                <QnaItemSkeleton />
                <QnaItemSkeleton />
            </div>
          )}
          {questionsError && <p className="text-destructive">Error loading questions.</p>}
          {questions && questions.length === 0 && (
             <p className="text-muted-foreground text-center py-4">No questions yet. Be the first to ask!</p>
          )}
          {questions?.map(q => (
            <QnaItem key={q.id} question={q} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
