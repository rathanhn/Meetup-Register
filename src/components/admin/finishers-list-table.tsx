
"use client";

import { useState, useMemo, useEffect } from 'react';
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
import { Badge } from '@/components/ui/badge';
import { Loader2, AlertTriangle, Download, Flag, User as UserIcon, Award, Eye, RotateCcw, CheckCircle } from 'lucide-react';
import type { Registration, UserRole } from '@/lib/types';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Skeleton } from '../ui/skeleton';
import { Card, CardContent } from '../ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import Link from 'next/link';
import { useToast } from '@/hooks/use-toast';
import { grantCertificate, revokeCertificate } from '@/app/actions';
import { useMemoFirebase } from '@/firebase/memo';


type FinishedParticipant = {
    id: string;
    registrationId: string;
    name: string;
    phone: string;
    photoUrl?: string;
    type: Registration['registrationType'];
    certificateGranted?: boolean;
}

const TableSkeleton = () => (
    [...Array(5)].map((_, i) => (
        <TableRow key={i}>
            <TableCell><Skeleton className="h-10 w-10 rounded-full" /></TableCell>
            <TableCell><Skeleton className="h-5 w-32" /></TableCell>
            <TableCell className="hidden md:table-cell"><Skeleton className="h-5 w-24" /></TableCell>
            <TableCell className="hidden lg:table-cell"><Skeleton className="h-5 w-16" /></TableCell>
            <TableCell className="text-right space-x-2"><Skeleton className="h-8 w-20 inline-block" /><Skeleton className="h-8 w-20 inline-block" /></TableCell>
        </TableRow>
    ))
);


export function FinishersListTable() {
  const registrationsQuery = useMemoFirebase(() => query(collection(db, 'registrations'), orderBy('createdAt', 'desc')), []);
  const { data: registrations, loading, error } = useCollection<Registration>(registrationsQuery);
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
        setUser(user);
        setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

   useEffect(() => {
    if (user) {
      const fetchUserRole = async () => {
        const userDoc = await getDoc(doc(db, "users", user.uid));
        if (userDoc.exists()) {
          setUserRole(userDoc.data().role as UserRole);
        }
      };
      fetchUserRole();
    }
  }, [user]);

  const canEdit = userRole === 'admin' || userRole === 'superadmin';

  const finishedParticipants = useMemo(() => {
    if (!registrations) return [];
    
    const participants: FinishedParticipant[] = [];
    registrations.forEach(reg => {
      if (reg.status !== 'approved') return;

      if (reg.rider1Finished) {
          participants.push({
              id: `${reg.id}-1`,
              registrationId: reg.id,
              name: reg.fullName,
              phone: reg.phoneNumber,
              photoUrl: reg.photoURL,
              type: reg.registrationType,
              certificateGranted: reg.certificateGranted,
          });
      }
    });

    return participants;
  }, [registrations]);

  const filteredParticipants = useMemo(() => {
    if (!searchTerm) return finishedParticipants;
    return finishedParticipants.filter(p => 
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.phone.includes(searchTerm)
    );
  }, [finishedParticipants, searchTerm]);
  
  const handleExport = () => {
    if (!filteredParticipants.length) return;

    const headers = ["Participant ID", "Registration ID", "Name", "Phone", "Type", "Certificate Granted"];
    const csvRows = [
      headers.join(','),
      ...filteredParticipants.map(p => {
        const row = [p.id, p.registrationId, `"${p.name}"`, p.phone, p.type, p.certificateGranted ? 'Yes' : 'No'];
        return row.join(',');
      })
    ];

    const csvString = csvRows.join('\n');
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'finishers_list.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
   
  const handleCertificateToggle = async (participant: FinishedParticipant) => {
    if (!user || !canEdit) return;

    setIsProcessing(participant.registrationId);
    const action = participant.certificateGranted ? revokeCertificate : grantCertificate;
    const result = await action({ adminId: user.uid, registrationId: participant.registrationId });
    
    if (result.success) {
      toast({ title: 'Success', description: result.message });
    } else {
      toast({ variant: 'destructive', title: 'Error', description: result.message });
    }
    setIsProcessing(null);
  };

  if (error) {
    return (
      <div className="text-destructive flex items-center gap-2 p-4">
        <AlertTriangle />
        <p>Error loading data: {error.message}</p>
      </div>
    );
  }

  const generatePreviewUrl = (participant: FinishedParticipant) => {
    const params = new URLSearchParams({
      name: participant.name,
      regId: participant.registrationId
    });
    if (participant.photoUrl) {
      params.append('photo', participant.photoUrl);
    }
    return `/certificate-preview?${params.toString()}`;
  }

  const isLoading = loading || authLoading;

  return (
    <>
        <div className="flex flex-col sm:flex-row justify-between items-center mb-4 gap-4">
            <Input 
                placeholder="Search by name or phone..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full sm:max-w-sm"
            />
            <Button onClick={handleExport} disabled={filteredParticipants.length === 0} className="w-full sm:w-auto">
                <Download className="mr-2 h-4 w-4" />
                Export as CSV
            </Button>
        </div>
        
        {/* Mobile View - Cards */}
        <div className="md:hidden space-y-4">
           {isLoading ? (
                [...Array(3)].map((_, i) => (
                    <Card key={i}><CardContent className="p-4 flex items-center gap-3"><Skeleton className="h-12 w-12 rounded-full" /><div className="space-y-1 flex-grow"><Skeleton className="h-5 w-32" /><Skeleton className="h-4 w-24" /></div></CardContent></Card>
                ))
            ) : filteredParticipants.length > 0 ? (
                filteredParticipants.map((p) => (
                    <Card key={p.id}>
                        <CardContent className="p-4 space-y-3">
                             <div className="flex items-center gap-3">
                                <Avatar className="h-12 w-12">
                                    <AvatarImage src={p.photoUrl} alt={p.name} />
                                    <AvatarFallback><UserIcon /></AvatarFallback>
                                </Avatar>
                                <div>
                                    <p className="font-semibold">{p.name}</p>
                                    <p className="text-sm text-muted-foreground">{p.phone}</p>
                                    <Badge variant="secondary" className="mt-1 capitalize">{p.type}</Badge>
                                </div>
                            </div>
                            <div className="flex flex-col sm:flex-row gap-2">
                                <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"><Flag className="mr-2 h-4 w-4" />Finished</Badge>
                                {p.certificateGranted && <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 w-fit"><CheckCircle className="mr-2 h-4 w-4" />Certificate Granted</Badge>}
                            </div>
                            <div className="flex flex-col gap-2 pt-2 border-t">
                                <Button asChild size="sm" variant="outline">
                                    <Link href={generatePreviewUrl(p)} target="_blank">
                                        <Eye className="mr-2 h-4 w-4" /> View Certificate
                                    </Link>
                                </Button>
                                {canEdit && (
                                    <Button size="sm" variant="outline" disabled={isProcessing === p.registrationId} onClick={() => handleCertificateToggle(p)}>
                                        {isProcessing === p.registrationId ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : (p.certificateGranted ? <RotateCcw className="mr-2 h-4 w-4" /> : <Award className="mr-2 h-4 w-4"/>)}
                                        {p.certificateGranted ? 'Revoke Certificate' : 'Grant Certificate'}
                                    </Button>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                ))
            ) : (
                <div className="text-center py-10 text-muted-foreground">{searchTerm ? 'No finishers match your search.' : 'No participants have finished yet.'}</div>
            )}
        </div>

        {/* Desktop View - Table */}
        <div className="hidden md:block border rounded-lg">
            <Table>
                <TableHeader><TableRow><TableHead>Photo</TableHead><TableHead>Name</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
                <TableBody>
                {isLoading ? (<TableSkeleton />) : filteredParticipants.length > 0 ? (
                    filteredParticipants.map((p) => (
                    <TableRow key={p.id}>
                        <TableCell>
                            <Avatar>
                                <AvatarImage src={p.photoUrl} alt={p.name} />
                                <AvatarFallback><UserIcon /></AvatarFallback>
                            </Avatar>
                        </TableCell>
                        <TableCell className="font-medium">{p.name}</TableCell>
                        <TableCell>
                            <div className="flex flex-col gap-1">
                                <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 w-fit"><Flag className="mr-2 h-4 w-4" />Finished</Badge>
                                {p.certificateGranted && <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 w-fit"><CheckCircle className="mr-2 h-4 w-4" />Certificate Granted</Badge>}
                            </div>
                        </TableCell>
                        <TableCell className="text-right space-x-2">
                            <Button asChild size="sm" variant="outline">
                                <Link href={generatePreviewUrl(p)} target="_blank">
                                    <Eye className="mr-2 h-4 w-4" /> View
                                </Link>
                            </Button>
                             {canEdit && (
                                <Button size="sm" variant="outline" disabled={isProcessing === p.registrationId} onClick={() => handleCertificateToggle(p)}>
                                    {isProcessing === p.registrationId ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : (p.certificateGranted ? <RotateCcw className="mr-2 h-4 w-4" /> : <Award className="mr-2 h-4 w-4"/>)}
                                    {p.certificateGranted ? 'Revoke' : 'Grant'}
                                </Button>
                            )}
                        </TableCell>
                    </TableRow>
                    ))
                ) : (
                    <TableRow><TableCell colSpan={4} className="text-center h-24">{searchTerm ? 'No finishers match your search.' : 'No participants have finished yet.'}</TableCell></TableRow>
                )}
                </TableBody>
            </Table>
        </div>
    </>
  );
}
