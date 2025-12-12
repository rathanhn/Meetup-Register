
"use client";

import type { QnaQuestion, QnaReply } from "@/lib/types";
import { useState, useEffect } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { useCollection } from '@/firebase/firestore/use-collection';
import { collection, query, orderBy, doc, getDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { formatDistanceToNow } from 'date-fns';
import { Button } from "./ui/button";
import { Textarea } from "./ui/textarea";
import { Form, FormControl, FormField, FormItem, FormMessage } from '@/components/ui/form';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { addReply } from "@/app/actions";
import { useToast } from "@/hooks/use-toast";
import { CornerDownRight, Loader2, Pin, ShieldCheck, User as UserIcon } from "lucide-react";
import { Separator } from "./ui/separator";
import { Badge } from "./ui/badge";
import { useMemoFirebase } from "@/firebase/memo";

const replyFormSchema = z.object({
  text: z.string().min(1, "Reply cannot be empty.").max(500, "Reply cannot be longer than 500 characters."),
});

interface QnaItemProps {
  question: QnaQuestion;
}

export function QnaItem({ question }: QnaItemProps) {
  const [user, setUser] = useState<User | null>(null);
  const [isReplying, setIsReplying] = useState(false);
  const { toast } = useToast();
  const [userDisplayName, setUserDisplayName] = useState("Rider");

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
    });
    return () => unsubscribe();
  }, []);

  const form = useForm<z.infer<typeof replyFormSchema>>({
    resolver: zodResolver(replyFormSchema),
    defaultValues: { text: "" },
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

  const repliesQuery = useMemoFirebase(() => query(collection(db, 'qna', question.id, 'replies'), orderBy('createdAt', 'asc')), [question.id]);
  const { data: replies, loading: repliesLoading } = useCollection<QnaReply>(repliesQuery);

  async function onReplySubmit(values: z.infer<typeof replyFormSchema>) {
    if (!user) return;

    try {
      const token = await user.getIdToken();
      const result = await addReply({
        ...values,
        questionId: question.id,
        userId: user.uid,
        userName: userDisplayName,
        userPhotoURL: user.photoURL,
        token,
      });

      if (result.success) {
        form.reset();
        setIsReplying(false);
      } else {
        toast({ variant: "destructive", title: "Error", description: result.message });
      }
    } catch (e: any) {
      toast({ variant: "destructive", title: "Error", description: e.message });
    }
  }

  return (
    <div className="p-4 border rounded-lg space-y-4">
      {/* Question */}
      <div className="flex flex-col sm:flex-row gap-4">
        <Avatar>
          <AvatarImage src={question.userPhotoURL ?? undefined} alt={question.userName} />
          <AvatarFallback><UserIcon /></AvatarFallback>
        </Avatar>
        <div className="w-full">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <p className="font-semibold">{question.userName}</p>
              {question.isPinned && <Badge variant="secondary" className="bg-primary/10 text-primary"><Pin className="h-3 w-3 mr-1" /> Pinned</Badge>}
            </div>
            <p className="text-xs text-muted-foreground flex-shrink-0">
              {question.createdAt ? formatDistanceToNow(question.createdAt.toDate(), { addSuffix: true }) : 'just now'}
            </p>
          </div>
          <p className="text-muted-foreground mt-1">{question.text}</p>
          {user && (
            <Button variant="ghost" size="sm" className="mt-2 -ml-2" onClick={() => setIsReplying(!isReplying)}>
              <CornerDownRight className="mr-2 h-4 w-4" />
              Reply
            </Button>
          )}
        </div>
      </div>

      {/* Reply Form */}
      {isReplying && (
        <div className="pl-0 sm:pl-14">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onReplySubmit)} className="space-y-2">
              <FormField
                control={form.control}
                name="text"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <Textarea placeholder="Write a reply..." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex gap-2">
                <Button type="submit" size="sm" disabled={isSubmitting}>
                  {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Post Reply
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => setIsReplying(false)}>
                  Cancel
                </Button>
              </div>
            </form>
          </Form>
        </div>
      )}

      {/* Replies */}
      {replies && replies.length > 0 && (
        <div className="pl-0 sm:pl-14 space-y-4">
          <Separator />
          {replies.map(reply => {
            return (
              <div key={reply.id} className="flex gap-4">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={reply.userPhotoURL ?? undefined} alt={reply.userName} />
                  <AvatarFallback><UserIcon className="h-4 w-4" /></AvatarFallback>
                </Avatar>
                <div className="w-full">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-sm">{reply.userName}</p>
                    {reply.isAdmin && <Badge variant="secondary"><ShieldCheck className="h-3 w-3 mr-1" /> Admin</Badge>}
                    <p className="text-xs text-muted-foreground">
                      {reply.createdAt ? formatDistanceToNow(reply.createdAt.toDate(), { addSuffix: true }) : 'just now'}
                    </p>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">{reply.text}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
      {repliesLoading && <div className="flex justify-center pl-16"><Loader2 className="h-5 w-5 animate-spin" /></div>}
    </div>
  );
}
