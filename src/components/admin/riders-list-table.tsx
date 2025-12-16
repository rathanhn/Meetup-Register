
"use client";

import React, { useState, useMemo, useEffect } from 'react';
import { useCollection } from '@/firebase/firestore/use-collection';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { collection, query, orderBy, doc, getDoc } from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from '@/components/ui/badge';
import { Loader2, AlertTriangle, Download, MessageCircle, Trash2, Send, Eye, MoreVertical, User as UserIcon, Edit, Ticket, Award, RotateCcw, CheckCircle } from 'lucide-react';
import type { Registration, UserRole } from '@/lib/types';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import Link from 'next/link';
import { Skeleton } from '../ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { deleteRegistration, grantCertificate, revokeCertificate } from '@/app/actions';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '../ui/alert-dialog';
import { Separator } from '../ui/separator';
import { Card, CardContent } from '../ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { EditRegistrationForm } from './edit-registration-form';
import { useMemoFirebase } from '@/firebase/memo';


// Helper function to format WhatsApp links
const formatWhatsAppLink = (phone: string, message?: string) => {
    let cleanedPhone = phone.replace(/\D/g, '');
    if (cleanedPhone.length === 10) {
        cleanedPhone = `91${cleanedPhone}`;
    }
    const url = `https://wa.me/${cleanedPhone}`;
    if (message) {
        return `${url}?text=${encodeURIComponent(message)}`;
    }
    return url;
};

const getTicketMessage = (name: string, ticketUrl: string) => `Hi ${name}, your registration for the TeleFun Mobiles Freedom Ride is confirmed! You can view and download your digital ticket here: ${ticketUrl}`;

const TableSkeleton = () => (
    [...Array(5)].map((_, i) => (
        <TableRow key={i}>
            <TableCell><Skeleton className="h-10 w-10 rounded-full" /></TableCell>
            <TableCell><Skeleton className="h-5 w-3/4" /></TableCell>
            <TableCell className="hidden md:table-cell"><Skeleton className="h-5 w-1/4" /></TableCell>
            <TableCell className="text-right"><Skeleton className="h-9 w-9" /></TableCell>
        </TableRow>
    ))
);

export function RidersListTable() {
    const registrationsQuery = useMemoFirebase(() => query(collection(db, 'registrations'), orderBy('createdAt', 'desc')), []);
    const { data: registrationsData, loading, error } = useCollection<Registration>(registrationsQuery);
    const [user, setUser] = useState<User | null>(null);
    const [authLoading, setAuthLoading] = useState(true);
    const [userRole, setUserRole] = useState<UserRole | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const { toast } = useToast();
    const [isDeleting, setIsDeleting] = useState<string | null>(null);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [selectedRegistration, setSelectedRegistration] = useState<Registration | null>(null);
    const [isProcessing, setIsProcessing] = useState<string | null>(null);
    const [origin, setOrigin] = useState('');

    useEffect(() => {
        if (typeof window !== 'undefined') {
            setOrigin(window.location.origin);
        }
    }, []);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
            setUser(currentUser);
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

    const canEdit = userRole === 'admin' || userRole === 'superadmin';

    const approvedRegistrations = useMemo(() => {
        if (!registrationsData) return [];
        return registrationsData.filter(reg => reg.status === 'approved');
    }, [registrationsData]);

    const filteredRegistrations = useMemo(() => {
        if (!searchTerm) return approvedRegistrations;
        return approvedRegistrations.filter(reg =>
            reg.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
            reg.phoneNumber.includes(searchTerm)
        );
    }, [approvedRegistrations, searchTerm]);

    const handleEdit = (reg: Registration) => {
        setSelectedRegistration(reg);
        setIsFormOpen(true);
    };

    const handleDelete = async (id: string) => {
        if (!user || !canEdit) {
            toast({ variant: 'destructive', title: 'Error', description: "Permission denied." });
            return;
        }
        setIsDeleting(id);
        try {
            const token = await user.getIdToken();
            const result = await deleteRegistration({ adminId: user.uid, registrationId: id, token });
            if (result.success) {
                toast({ title: 'Success', description: result.message });
            } else {
                toast({ variant: 'destructive', title: 'Error', description: result.message });
            }
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Error', description: e.message });
        }
        setIsDeleting(null);
    };

    const handleExport = () => {
        if (!filteredRegistrations.length) return;

        const headers = [
            "ID", "Status",
            "Rider Name", "Rider Age", "Rider Phone", "Rider Checked-In",
            "Registered On"
        ];

        const csvRows = [
            headers.join(','),
            ...filteredRegistrations.map(reg => {
                const row = [
                    reg.id, reg.status,
                    `"${reg.fullName}"`, reg.age, reg.phoneNumber, reg.rider1CheckedIn ? 'Yes' : 'No',
                    reg.createdAt?.toDate().toISOString() ?? 'N/A'
                ];
                return row.join(',');
            })
        ];

        const csvString = csvRows.join('\n');
        const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', 'approved_riders.csv');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const generateCertificatePreviewUrl = (name: string, photoUrl: string | undefined, regId: string) => {
        const params = new URLSearchParams({
            name: name,
            regId: regId,
        });
        if (photoUrl) {
            params.append('photo', photoUrl);
        }
        return `/certificate-preview?${params.toString()}`;
    }

    const handleCertificateToggle = async (reg: Registration) => {
        if (!user || !canEdit) return;

        setIsProcessing(reg.id);
        try {
            const token = await user.getIdToken();
            const action = reg.certificateGranted ? revokeCertificate : grantCertificate;
            const result = await action({ adminId: user.uid, registrationId: reg.id, token });

            if (result.success) {
                toast({ title: 'Success', description: result.message });
            } else {
                toast({ variant: 'destructive', title: 'Error', description: result.message });
            }
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Error', description: e.message });
        }
        setIsProcessing(null);
    };

    if (error) {
        return (
            <div className="text-destructive flex items-center gap-2 p-4">
                <AlertTriangle />
                <p>Error loading registrations: {error.message}</p>
            </div>
        );
    }

    return (
        <div>
            <div className="flex flex-col sm:flex-row justify-between items-center mb-4 gap-4">
                <Input
                    placeholder="Search by name or phone..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full sm:max-w-sm"
                />
                <Button onClick={handleExport} disabled={filteredRegistrations.length === 0} className="w-full sm:w-auto">
                    <Download className="mr-2 h-4 w-4" />
                    Export as CSV
                </Button>
            </div>

            <EditRegistrationForm
                isOpen={isFormOpen}
                setIsOpen={setIsFormOpen}
                registration={selectedRegistration}
                user={user}
            />

            {/* Mobile card view */}
            <div className="md:hidden space-y-4">
                {(loading || authLoading) ? (
                    [...Array(3)].map((_, i) => (
                        <Card key={i}><CardContent className="p-4"><Skeleton className="h-24 w-full" /></CardContent></Card>
                    ))
                ) : filteredRegistrations.length > 0 ? (
                    filteredRegistrations.map((reg) => {
                        const ticketUrl = origin ? `${origin}/ticket/${reg.id}` : '';
                        return (
                            <Card key={reg.id}>
                                <CardContent className="p-4">
                                    <div className="flex justify-between items-start">
                                        <div className="flex items-center gap-3">
                                            <Avatar>
                                                <AvatarImage src={reg.photoURL} alt={reg.fullName} />
                                                <AvatarFallback><UserIcon /></AvatarFallback>
                                            </Avatar>
                                            <div>
                                                <p className="font-semibold">{reg.fullName}</p>
                                                <Badge variant={'secondary'} className="capitalize mt-1">{reg.registrationType}</Badge>
                                            </div>
                                        </div>
                                        <Dialog>
                                            <DialogTrigger asChild>
                                                <Button variant="ghost" size="icon"><MoreVertical className="h-4 w-4" /></Button>
                                            </DialogTrigger>
                                            <DialogContent className="max-h-[80vh] overflow-y-auto">
                                                <DialogHeader>
                                                    <DialogTitle>Rider Actions</DialogTitle>
                                                    <DialogDescription>{reg.fullName}</DialogDescription>
                                                </DialogHeader>
                                                {origin ? (
                                                    <div className="space-y-4 py-4">
                                                        <div className="p-3 border rounded-md bg-background space-y-2">
                                                            <p className="font-semibold">{reg.fullName}</p>
                                                            <p className="text-sm text-muted-foreground">{reg.phoneNumber}</p>
                                                            <div className="flex items-center gap-2">
                                                                <Badge variant="outline" className={`justify-center ${reg.rider1CheckedIn ? 'bg-green-100 text-green-800' : ''}`}>P1: {reg.rider1CheckedIn ? 'Checked-in' : 'Pending'}</Badge>
                                                                <Badge variant="outline" className={`justify-center ${reg.rider1Finished ? 'bg-blue-100 text-blue-800' : ''}`}>P1: {reg.rider1Finished ? 'Finished' : 'Pending'}</Badge>
                                                            </div>
                                                            <div className="flex items-center gap-2 pt-2">
                                                                <Button asChild variant="outline" size="sm"><Link href={formatWhatsAppLink(reg.phoneNumber, getTicketMessage(reg.fullName, ticketUrl))} target="_blank"><Send /> Send</Link></Button>
                                                                <Button asChild variant="outline" size="sm"><Link href={formatWhatsAppLink(reg.phoneNumber)} target="_blank"><MessageCircle /> Message</Link></Button>
                                                            </div>
                                                        </div>

                                                        <Separator />

                                                        <div className="p-3 border rounded-md bg-background space-y-2">
                                                            <p className="font-semibold">Certificate Management</p>
                                                            {reg.certificateGranted && (
                                                                <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 w-fit"><CheckCircle className="mr-2 h-4 w-4" />Certificate Granted</Badge>
                                                            )}
                                                            <div className="flex flex-col gap-2 pt-2">
                                                                <Button asChild size="sm" variant="outline"><Link href={generateCertificatePreviewUrl(reg.fullName, reg.photoURL, reg.id)} target="_blank"><Eye className="mr-2 h-4 w-4" /> View Certificate</Link></Button>
                                                                {canEdit && (
                                                                    <Button size="sm" variant="outline" disabled={isProcessing === reg.id} onClick={() => handleCertificateToggle(reg)}>
                                                                        {isProcessing === reg.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : (reg.certificateGranted ? <RotateCcw className="mr-2 h-4 w-4" /> : <Award className="mr-2 h-4 w-4" />)}
                                                                        {reg.certificateGranted ? 'Revoke Certificate' : 'Grant Certificate'}
                                                                    </Button>
                                                                )}
                                                            </div>
                                                        </div>

                                                        <Separator />

                                                        <div className="flex flex-col gap-2">
                                                            <Button asChild variant="secondary"><Link href={ticketUrl} target="_blank"><Eye className="mr-2 h-4 w-4" /> View Ticket</Link></Button>
                                                            {canEdit && (
                                                                <>
                                                                    <Button variant="outline" onClick={() => handleEdit(reg)}><Edit className="mr-2 h-4 w-4" />Edit Info</Button>
                                                                    <AlertDialog>
                                                                        <AlertDialogTrigger asChild>
                                                                            <Button variant="destructive" disabled={isDeleting === reg.id}><Trash2 className="mr-2 h-4 w-4" />Delete</Button>
                                                                        </AlertDialogTrigger>
                                                                        <AlertDialogContent>
                                                                            <AlertDialogHeader><AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle><AlertDialogDescription>This action cannot be undone. This will permanently delete the registration for <span className="font-bold">{reg.fullName}</span>.</AlertDialogDescription></AlertDialogHeader>
                                                                            <AlertDialogFooter>
                                                                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                                                <AlertDialogAction onClick={() => handleDelete(reg.id)} className="bg-destructive hover:bg-destructive/90">Yes, delete</AlertDialogAction>
                                                                            </AlertDialogFooter>
                                                                        </AlertDialogContent>
                                                                    </AlertDialog>
                                                                </>
                                                            )}
                                                        </div>
                                                    </div>
                                                ) : (<div className="flex justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>)}
                                            </DialogContent>
                                        </Dialog>
                                    </div>
                                </CardContent>
                            </Card>
                        )
                    })
                ) : (
                    <div className="text-center py-10 text-muted-foreground">
                        {searchTerm ? 'No approved riders match your search.' : 'No approved riders found.'}
                    </div>
                )}
            </div>

            {/* Desktop table view */}
            <div className="hidden md:block border rounded-lg">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Photo</TableHead>
                            <TableHead>Rider</TableHead>
                            <TableHead>Type</TableHead>
                            <TableHead>Certificate</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {(loading || authLoading) ? (
                            <TableSkeleton />
                        ) : filteredRegistrations.length > 0 ? (
                            filteredRegistrations.map((reg) => {
                                const ticketUrl = origin ? `${origin}/ticket/${reg.id}` : '';
                                return (
                                    <TableRow key={reg.id}>
                                        <TableCell>
                                            <Avatar>
                                                <AvatarImage src={reg.photoURL} alt={reg.fullName} />
                                                <AvatarFallback><UserIcon /></AvatarFallback>
                                            </Avatar>
                                        </TableCell>
                                        <TableCell className="font-medium">
                                            {reg.fullName}
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant={'secondary'} className="capitalize">
                                                {reg.registrationType}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            {reg.certificateGranted ? (
                                                <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">Granted</Badge>
                                            ) : (
                                                <Badge variant="outline">None</Badge>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Dialog>
                                                <DialogTrigger asChild>
                                                    <Button variant="ghost" size="icon"><MoreVertical className="h-4 w-4" /></Button>
                                                </DialogTrigger>
                                                <DialogContent className="max-h-[80vh] overflow-y-auto">
                                                    <DialogHeader>
                                                        <DialogTitle>Rider Actions</DialogTitle>
                                                        <DialogDescription>{reg.fullName}</DialogDescription>
                                                    </DialogHeader>
                                                    {origin ? (
                                                        <div className="space-y-4 py-4">
                                                            <div className="p-3 border rounded-md bg-background space-y-2">
                                                                <p className="font-semibold">{reg.fullName}</p>
                                                                <p className="text-sm text-muted-foreground">{reg.phoneNumber}</p>
                                                                <div className="flex items-center gap-2">
                                                                    <Badge variant="outline" className={`justify-center ${reg.rider1CheckedIn ? 'bg-green-100 text-green-800' : ''}`}>P1: {reg.rider1CheckedIn ? 'Checked-in' : 'Pending'}</Badge>
                                                                    <Badge variant="outline" className={`justify-center ${reg.rider1Finished ? 'bg-blue-100 text-blue-800' : ''}`}>P1: {reg.rider1Finished ? 'Finished' : 'Pending'}</Badge>
                                                                </div>
                                                                <div className="flex items-center gap-2 pt-2">
                                                                    <Button asChild variant="outline" size="sm"><Link href={formatWhatsAppLink(reg.phoneNumber, getTicketMessage(reg.fullName, ticketUrl))} target="_blank"><Send /> Send</Link></Button>
                                                                    <Button asChild variant="outline" size="sm"><Link href={formatWhatsAppLink(reg.phoneNumber)} target="_blank"><MessageCircle /> Message</Link></Button>
                                                                </div>
                                                            </div>

                                                            <Separator />

                                                            <div className="p-3 border rounded-md bg-background space-y-2">
                                                                <p className="font-semibold">Certificate Management</p>
                                                                {reg.certificateGranted && <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 w-fit"><CheckCircle className="mr-2 h-4 w-4" />Certificate Granted</Badge>}
                                                                <div className="flex flex-col sm:flex-row gap-2 pt-2">
                                                                    <Button asChild size="sm" variant="outline"><Link href={generateCertificatePreviewUrl(reg.fullName, reg.photoURL, reg.id)} target="_blank"><Eye className="mr-2 h-4 w-4" /> View Cert</Link></Button>
                                                                </div>
                                                                {canEdit && (
                                                                    <Button className="mt-2" size="sm" variant="outline" disabled={isProcessing === reg.id} onClick={() => handleCertificateToggle(reg)}>
                                                                        {isProcessing === reg.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : (reg.certificateGranted ? <RotateCcw className="mr-2 h-4 w-4" /> : <Award className="mr-2 h-4 w-4" />)}
                                                                        {reg.certificateGranted ? 'Revoke' : 'Grant'}
                                                                    </Button>
                                                                )}
                                                            </div>

                                                            <Separator />

                                                            <div className="flex gap-2 justify-end">
                                                                <Button asChild variant="secondary" size="sm"><Link href={ticketUrl} target="_blank"><Eye /> View Ticket</Link></Button>
                                                                {canEdit && (
                                                                    <>
                                                                        <Button variant="outline" size="sm" onClick={() => handleEdit(reg)}><Edit className="mr-2 h-4 w-4" />Edit Info</Button>
                                                                        <AlertDialog>
                                                                            <AlertDialogTrigger asChild>
                                                                                <Button variant="destructive" size="sm" disabled={isDeleting === reg.id}><Trash2 className="mr-2 h-4 w-4" />Delete</Button>
                                                                            </AlertDialogTrigger>
                                                                            <AlertDialogContent>
                                                                                <AlertDialogHeader><AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle><AlertDialogDescription>This action cannot be undone. This will permanently delete the registration for <span className="font-bold">{reg.fullName}</span>.</AlertDialogDescription></AlertDialogHeader>
                                                                                <AlertDialogFooter>
                                                                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                                                    <AlertDialogAction onClick={() => handleDelete(reg.id)} className="bg-destructive hover:bg-destructive/90">Yes, delete</AlertDialogAction>
                                                                                </AlertDialogFooter>
                                                                            </AlertDialogContent>
                                                                        </AlertDialog>
                                                                    </>
                                                                )}
                                                            </div>
                                                        </div>
                                                    ) : (<div className="flex justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>)}
                                                </DialogContent>
                                            </Dialog>
                                        </TableCell>
                                    </TableRow>
                                )
                            })
                        ) : (
                            <TableRow>
                                <TableCell colSpan={5} className="text-center h-24">
                                    {searchTerm ? 'No approved riders match your search.' : 'No approved riders found.'}
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
}

