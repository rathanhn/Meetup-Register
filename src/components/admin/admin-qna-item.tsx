
"use client";

import type { QnaQuestion, QnaReply, UserRole } from "@/lib/types";
import { onAuthStateChanged, type User } from 'firebase/auth';
import { useCollection } from '@/firebase/firestore/use-collection';
import { collection, query, orderBy, doc, getDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { formatDistanceToNow } from 'date-fns';
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormMessage } from '@/components/ui/form';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { addReply, deleteQuestion, togglePinQuestion } from "@/app/actions";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Pin, PinOff, ShieldCheck, Trash2, User as UserIcon } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { Badge } from "../ui/badge";
import { useEffect, useState } from "react";
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
import { useMemoFirebase } from "@/firebase/memo";

const replyFormSchema = z.object({
  text: z.string().min(1, "Reply cannot be empty.").max(500),
});

interface AdminQnaItemProps {
  question: QnaQuestion;
}

export function AdminQnaItem({ question }: AdminQnaItemProps) {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const { toast } = useToast();
  const form = useForm<z.infer<typeof replyFormSchema>>({
    resolver: zodResolver(replyFormSchema),
    defaultValues: { text: "" },
  });
  const { isSubmitting } = form.formState;

  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [adminDisplayName, setAdminDisplayName] = useState("Admin");

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
        setUser(user);
        setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

   useEffect(() => {
    const fetchUserData = async () => {
      if (user) {
        const userDoc = await getDoc(doc(db, "users", user.uid));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          setUserRole(userData.role);
          setAdminDisplayName(userData.displayName || "Admin");
        }
      }
    };
    fetchUserData();
  }, [user]);

  const canModerate = userRole === 'admin' || userRole === 'superadmin';

  const repliesQuery = useMemoFirebase(() => query(collection(db, 'qna', question.id, 'replies'), orderBy('createdAt', 'asc')), [question.id]);
  const { data: replies, loading: repliesLoading } = useCollection<QnaReply>(repliesQuery);
  
  async function onReplySubmit(values: z.infer<typeof replyFormSchema>) {
    if (!user) {
        toast({ variant: "destructive", title: "Error", description: "You must be logged in to reply." });
        return;
    };
    if (!canModerate) {
       toast({ variant: "destructive", title: "Error", description: "You don't have permission to reply." });
        return;
    }
    
    const result = await addReply({
      ...values,
      questionId: question.id,
      userId: user.uid,
      userName: adminDisplayName,
      userPhotoURL: user.photoURL,
    });

    if (result.success) {
      form.reset();
    } else {
      toast({ variant: "destructive", title: "Error", description: result.message });
    }
  }

  const handlePin = async () => {
    if (!user || !canModerate) return;
    setIsProcessing(true);
    const result = await togglePinQuestion({ adminId: user.uid, questionId: question.id });
    if (!result.success) {
      toast({ variant: "destructive", title: "Error", description: result.message });
    }
    setIsProcessing(false);
  }

  const handleDelete = async () => {
    if (!user || !canModerate) return;
    setIsProcessing(true);
    const result = await deleteQuestion({ adminId: user.uid, questionId: question.id });
    if (result.success) {
       toast({ title: "Success", description: "Question has been deleted." });
    } else {
       toast({ variant: "destructive", title: "Error", description: result.message });
    }
    // No need to set isProcessing to false, as the component will unmount
  }
  
  if (authLoading) return <Loader2 className="h-5 w-5 animate-spin" />

  return (
    <div className="p-4 border rounded-lg bg-background space-y-4">
        {/* Question */}
        <div className="flex gap-3 sm:gap-4">
            <Avatar>
                <AvatarImage src={question.userPhotoURL ?? undefined} alt={question.userName} />
                <AvatarFallback><UserIcon /></AvatarFallback>
            </Avatar>
            <div className="w-full">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-2">
                        <p className="font-semibold">{question.userName}</p>
                        {question.isPinned && <Badge variant="secondary" className="bg-primary/10 text-primary"><Pin className="h-3 w-3 mr-1"/> Pinned</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 sm:mt-0">
                        {question.createdAt ? formatDistanceToNow(question.createdAt.toDate(), { addSuffix: true }) : 'just now'}
                    </p>
                </div>
                <p className="text-muted-foreground mt-1">{question.text}</p>
            </div>
        </div>

        {/* Replies */}
        {(replies && replies.length > 0) && (
            <div className="pl-4 sm:pl-16 space-y-4">
                <Separator />
                {replies.map(reply => {
                    return (
                        <div key={reply.id} className="flex gap-3 sm:gap-4">
                            <Avatar className="h-8 w-8">
                                <AvatarImage src={reply.userPhotoURL ?? undefined} alt={reply.userName} />
                                <AvatarFallback><UserIcon className="h-4 w-4"/></AvatarFallback>
                            </Avatar>
                            <div className="w-full">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <p className="font-semibold text-sm">{reply.userName}</p>
                                    {reply.isAdmin && <Badge variant="secondary"><ShieldCheck className="h-3 w-3 mr-1"/> Admin</Badge>}
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
        {repliesLoading && <div className="flex justify-center pl-4 sm:pl-16"><Loader2 className="h-5 w-5 animate-spin" /></div>}

        {/* Reply Form & Actions */}
       {canModerate && (
         <div className="pl-0 sm:pl-16">
            <Separator />
            <div className="flex flex-col-reverse sm:flex-row sm:justify-between sm:items-end pt-4 gap-4">
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onReplySubmit)} className="space-y-2 flex-grow">
                        <FormField
                        control={form.control}
                        name="text"
                        render={({ field }) => (
                            <FormItem>
                            <FormControl>
                                <Textarea placeholder="Write an official reply..." {...field} rows={2}/>
                            </FormControl>
                            <FormMessage />
                            </FormItem>
                        )}
                        />
                        <Button type="submit" size="sm" disabled={isSubmitting || isProcessing}>
                            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Post Reply
                        </Button>
                    </form>
                </Form>
                <div className="flex gap-2 self-end sm:self-auto">
                    <Button onClick={handlePin} variant="outline" size="icon" disabled={isProcessing}>
                        {question.isPinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
                    </Button>
                     <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button variant="destructive" size="icon" disabled={isProcessing}>
                                <Trash2 className="h-4 w-4" />
                            </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                            <AlertDialogDescription>
                                This will permanently delete the question and all of its replies. This action cannot be undone.
                            </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">Delete</AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                </div>
            </div>
        </div>
       )}
    </div>
  );
}
