
"use client";

import { useState, useEffect, useMemo } from 'react';
import { useCollection } from '@/firebase/firestore/use-collection';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { collection, query, orderBy, doc, getDoc, where } from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from '@/components/ui/badge';
import { Loader2, AlertTriangle, Check, X, Ban, Trash2, Users, Phone, User as UserIcon, ShieldAlert } from 'lucide-react';
import type { Registration, UserRole } from '@/lib/types';
import { Button } from '../ui/button';
import { updateRegistrationStatus, deleteRegistration } from '@/app/actions';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '../ui/skeleton';
import { Separator } from '../ui/separator';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '../ui/alert-dialog';
import { Card, CardContent } from '../ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { useMemoFirebase } from '@/firebase/memo';

const TableSkeleton = () => (
    [...Array(3)].map((_, i) => (
        <TableRow key={i}>
            <TableCell><Skeleton className="h-10 w-10 rounded-full" /></TableCell>
            <TableCell><Skeleton className="h-5 w-32" /></TableCell>
            <TableCell><Skeleton className="h-5 w-16" /></TableCell>
            <TableCell><Skeleton className="h-5 w-24" /></TableCell>
            <TableCell className="text-right">
                <div className="flex justify-end gap-2">
                    <Skeleton className="h-8 w-8" />
                    <Skeleton className="h-8 w-8" />
                </div>
            </TableCell>
        </TableRow>
    ))
);

const CardSkeleton = () => (
    [...Array(2)].map((_, i) => (
         <Card key={i}>
            <CardContent className="p-4 space-y-4">
                 <div className="flex justify-between items-start">
                    <div className="flex items-center gap-3">
                        <Skeleton className="h-12 w-12 rounded-full" />
                        <div className="space-y-1">
                            <Skeleton className="h-5 w-24" />
                            <Skeleton className="h-4 w-20" />
                        </div>
                    </div>
                    <Skeleton className="h-6 w-20" />
                </div>
                <div className="flex justify-end gap-2">
                    <Skeleton className="h-9 w-24" />
                    <Skeleton className="h-9 w-24" />
                </div>
            </CardContent>
        </Card>
    ))
)

export function RegistrationsTable() {
  const registrationsQuery = useMemoFirebase(() => query(collection(db, 'registrations'), orderBy('createdAt', 'desc')), []);
  const { data: registrations, loading, error } = useCollection<Registration>(registrationsQuery);
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const { toast } = useToast();
  const [isUpdating, setIsUpdating] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
        setUser(user);
        setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const fetchUserRole = async () => {
      if (user) {
        const userDoc = await getDoc(doc(db, "users", user.uid));
        if (userDoc.exists()) {
          setUserRole(userDoc.data().role as UserRole);
        }
      }
    };
    fetchUserRole();
  }, [user]);
  
  const { pendingRegistrations, cancellationRequests } = useMemo(() => {
    if (!registrations) return { pendingRegistrations: [], cancellationRequests: [] };
    const allRegs = registrations;
    return {
        pendingRegistrations: allRegs.filter(reg => reg.status === 'pending'),
        cancellationRequests: allRegs.filter(reg => reg.status === 'cancellation_requested')
    }
  }, [registrations]);

  const isSuperAdmin = userRole === 'superadmin';

  const handleUpdateStatus = async (id: string, status: 'approved' | 'rejected') => {
    if (!user || !isSuperAdmin) {
      toast({ variant: "destructive", title: "Error", description: "You don't have permission to perform this action." });
      return;
    }

    setIsUpdating(id);
    const result = await updateRegistrationStatus({ registrationId: id, status, adminId: user.uid });
    if (result.success) {
        toast({ title: "Success", description: result.message });
    } else {
        toast({ variant: "destructive", title: "Error", description: result.message });
    }
    setIsUpdating(null);
  }

  const handleCancellation = async (id: string, approve: boolean) => {
    if (!user || !isSuperAdmin) {
      toast({ variant: "destructive", title: "Error", description: "You don't have permission to perform this action." });
      return;
    }
    setIsUpdating(id);
    if (approve) {
        const result = await updateRegistrationStatus({ registrationId: id, status: 'cancelled', adminId: user.uid });
        if (result.success) {
            toast({ title: "Cancellation Approved", description: "The registration has been cancelled." });
        } else {
            toast({ variant: "destructive", title: "Error", description: result.message });
        }
    } else {
        const result = await updateRegistrationStatus({ registrationId: id, status: 'approved', adminId: user.uid });
        if (result.success) {
            toast({ title: "Cancellation Rejected", description: "The registration status has been reverted to approved." });
        } else {
            toast({ variant: "destructive", title: "Error", description: result.message });
        }
    }
    setIsUpdating(null);
  }


  if (error) {
    return (
      <div className="text-destructive flex items-center gap-2 p-4">
        <AlertTriangle />
        <p>Error loading registrations: {error.message}</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
        <div>
            <h4 className="font-semibold text-lg mb-2">Pending Approvals</h4>
            {!isSuperAdmin && (
                 <div className="text-muted-foreground flex items-center gap-2 p-2 bg-secondary rounded-md text-xs mb-4">
                    <ShieldAlert className="h-4 w-4" />
                    <p>Only Super Admins can approve or reject registrations.</p>
                </div>
            )}
            <div className="md:hidden space-y-4">
                 {(loading || authLoading) ? <CardSkeleton /> : pendingRegistrations.length > 0 ? (
                    pendingRegistrations.map((reg) => (
                        <Card key={reg.id}>
                            <CardContent className="p-4 space-y-3">
                                <div className="flex justify-between items-start">
                                    <div className="flex items-center gap-3">
                                        <Avatar>
                                            <AvatarImage src={reg.photoURL} alt={reg.fullName} />
                                            <AvatarFallback><UserIcon /></AvatarFallback>
                                        </Avatar>
                                        <div>
                                            <p className="font-semibold">{reg.fullName}</p>
                                            <p className="text-sm text-muted-foreground">{reg.phoneNumber}</p>
                                        </div>
                                    </div>
                                    <Badge variant='secondary' className="capitalize mt-1">{reg.registrationType}</Badge>
                                </div>
                                {isSuperAdmin && (
                                    <div className="flex justify-end gap-2 pt-2 border-t">
                                        <Button size="sm" className="bg-green-600 hover:bg-green-700" onClick={() => handleUpdateStatus(reg.id, 'approved')} disabled={isUpdating === reg.id}>
                                            {isUpdating === reg.id ? <Loader2 className="h-4 w-4 animate-spin"/> : <Check className="h-4 w-4" />}<span className="ml-2">Approve</span>
                                        </Button>
                                        <Button size="sm" variant="destructive" onClick={() => handleUpdateStatus(reg.id, 'rejected')} disabled={isUpdating === reg.id}>
                                            {isUpdating === reg.id ? <Loader2 className="h-4 w-4 animate-spin"/> : <X className="h-4 w-4" />}<span className="ml-2">Reject</span>
                                        </Button>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    ))
                 ) : (
                    <p className="text-muted-foreground text-center py-4">No pending registrations.</p>
                 )}
            </div>
            <div className="hidden md:block border rounded-lg">
                <Table>
                    <TableHeader>
                    <TableRow>
                        <TableHead>Photo</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Phone</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                    </TableHeader>
                    <TableBody>
                    {(loading || authLoading) ? (
                        <TableSkeleton />
                    ) : pendingRegistrations.length > 0 ? (
                        pendingRegistrations.map((reg) => (
                        <TableRow key={reg.id}>
                            <TableCell>
                                <Avatar>
                                    <AvatarImage src={reg.photoURL} alt={reg.fullName} />
                                    <AvatarFallback><UserIcon className="h-4 w-4" /></AvatarFallback>
                                </Avatar>
                            </TableCell>
                            <TableCell className="font-medium">{reg.fullName}</TableCell>
                            <TableCell>
                            <Badge variant='secondary' className="capitalize">
                                {reg.registrationType}
                            </Badge>
                            </TableCell>
                            <TableCell>{reg.phoneNumber}</TableCell>
                            <TableCell className="text-right">
                            {!isSuperAdmin ? (
                                <span className='text-muted-foreground text-sm'>View Only</span>
                            ) : (
                                <div className="flex justify-end gap-2">
                                    <Button 
                                        variant="outline" 
                                        size="icon" 
                                        className="h-8 w-8 bg-green-50 hover:bg-green-100 text-green-700"
                                        onClick={() => handleUpdateStatus(reg.id, 'approved')}
                                        disabled={isUpdating === reg.id}
                                    >
                                        {isUpdating === reg.id ? <Loader2 className="h-4 w-4 animate-spin"/> : <Check className="h-4 w-4" />}
                                        <span className="sr-only">Approve</span>
                                    </Button>
                                    <Button 
                                        variant="outline" 
                                        size="icon" 
                                        className="h-8 w-8 bg-red-50 hover:bg-red-100 text-red-700"
                                        onClick={() => handleUpdateStatus(reg.id, 'rejected')}
                                        disabled={isUpdating === reg.id}
                                    >
                                        {isUpdating === reg.id ? <Loader2 className="h-4 w-4 animate-spin"/> : <X className="h-4 w-4" />}
                                        <span className="sr-only">Reject</span>
                                    </Button>
                                </div>
                            )}
                            </TableCell>
                        </TableRow>
                        ))
                    ) : (
                        <TableRow>
                        <TableCell colSpan={5} className="text-center h-24">
                            No pending registrations to approve.
                        </TableCell>
                        </TableRow>
                    )}
                    </TableBody>
                </Table>
            </div>
        </div>

        <Separator />
        
        <div>
            <h4 className="font-semibold text-lg mb-2">Cancellation Requests</h4>
             {!isSuperAdmin && (
                 <div className="text-muted-foreground flex items-center gap-2 p-2 bg-secondary rounded-md text-xs mb-4">
                    <ShieldAlert className="h-4 w-4" />
                    <p>Only Super Admins can manage cancellation requests.</p>
                </div>
            )}
            <div className="border rounded-lg">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Name</TableHead>
                            <TableHead>Reason</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                    {(loading || authLoading) ? (
                        <TableSkeleton />
                    ) : cancellationRequests.length > 0 ? (
                        cancellationRequests.map((reg) => (
                        <TableRow key={reg.id}>
                            <TableCell className="font-medium">{reg.fullName}</TableCell>
                            <TableCell className="text-muted-foreground max-w-sm truncate">{reg.cancellationReason}</TableCell>
                            <TableCell className="text-right">
                                {!isSuperAdmin ? (
                                    <span className='text-muted-foreground text-sm'>View Only</span>
                                ) : (
                                    <div className="flex justify-end gap-2">
                                      <AlertDialog>
                                        <AlertDialogTrigger asChild>
                                           <Button 
                                              variant="outline" 
                                              size="sm" 
                                              className="h-8 bg-green-50 hover:bg-green-100 text-green-700"
                                              disabled={isUpdating === reg.id}
                                          >
                                              {isUpdating === reg.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Check className="mr-2 h-4 w-4" />}
                                              Approve
                                          </Button>
                                        </AlertDialogTrigger>
                                        <AlertDialogContent>
                                            <AlertDialogHeader>
                                                <AlertDialogTitle>Approve Cancellation?</AlertDialogTitle>
                                                <AlertDialogDescription>
                                                    This will mark the registration as "Cancelled". The user record will remain.
                                                </AlertDialogDescription>
                                            </AlertDialogHeader>
                                            <AlertDialogFooter>
                                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                <AlertDialogAction onClick={() => handleCancellation(reg.id, true)} className="bg-destructive hover:bg-destructive/90">
                                                    Yes, Cancel Registration
                                                </AlertDialogAction>
                                            </AlertDialogFooter>
                                        </AlertDialogContent>
                                      </AlertDialog>
                                        
                                        <Button 
                                            variant="outline" 
                                            size="sm" 
                                            className="h-8 bg-amber-50 hover:bg-amber-100 text-amber-700"
                                            onClick={() => handleCancellation(reg.id, false)}
                                            disabled={isUpdating === reg.id}
                                        >
                                            {isUpdating === reg.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Ban className="mr-2 h-4 w-4" />}
                                            Reject
                                        </Button>
                                    </div>
                                )}
                            </TableCell>
                        </TableRow>
                        ))
                    ) : (
                        <TableRow>
                        <TableCell colSpan={3} className="text-center h-24">
                            No pending cancellation requests.
                        </TableCell>
                        </TableRow>
                    )}
                    </TableBody>
                </Table>
            </div>
        </div>
    </div>
  );
}
