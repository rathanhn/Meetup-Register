
"use client";

import { useState, useMemo } from 'react';
import { useCollection } from '@/firebase/firestore/use-collection';
import { collection, query, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from '@/components/ui/badge';
import { Loader2, AlertTriangle, Download, CheckCircle, Clock, User } from 'lucide-react';
import type { Registration } from '@/lib/types';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Skeleton } from '../ui/skeleton';
import { Card, CardContent } from '../ui/card';
import { format } from 'date-fns';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { useMemoFirebase } from '@/firebase/memo';

type CheckedInParticipant = {
    id: string;
    registrationId: string;
    name: string;
    phone: string;
    photoUrl?: string;
    type: Registration['registrationType'];
    checkedInAt?: Date; // Assuming we might add this later
}

const TableSkeleton = () => (
    [...Array(5)].map((_, i) => (
        <TableRow key={i}>
            <TableCell><Skeleton className="h-10 w-10 rounded-full" /></TableCell>
            <TableCell><Skeleton className="h-5 w-32" /></TableCell>
            <TableCell className="hidden md:table-cell"><Skeleton className="h-5 w-24" /></TableCell>
            <TableCell className="hidden lg:table-cell"><Skeleton className="h-5 w-16" /></TableCell>
        </TableRow>
    ))
);


export function CheckedInListTable() {
  const registrationsQuery = useMemoFirebase(() => query(collection(db, 'registrations'), orderBy('createdAt', 'desc')), []);
  const { data: registrations, loading, error } = useCollection<Registration>(registrationsQuery);
  const [searchTerm, setSearchTerm] = useState('');

  const checkedInParticipants = useMemo(() => {
    if (!registrations) return [];
    
    const participants: CheckedInParticipant[] = [];
    registrations.forEach(reg => {
      if (reg.status !== 'approved') return;

      if (reg.rider1CheckedIn) {
          participants.push({
              id: `${reg.id}-1`,
              registrationId: reg.id,
              name: reg.fullName,
              phone: reg.phoneNumber,
              photoUrl: reg.photoURL,
              type: reg.registrationType
          });
      }
    });

    return participants;
  }, [registrations]);

  const filteredParticipants = useMemo(() => {
    if (!searchTerm) return checkedInParticipants;
    return checkedInParticipants.filter(p => 
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.phone.includes(searchTerm)
    );
  }, [checkedInParticipants, searchTerm]);
  
  const handleExport = () => {
    if (!filteredParticipants.length) return;

    const headers = [
      "Participant ID", "Registration ID", "Name", "Phone", "Type",
    ];

    const csvRows = [
      headers.join(','),
      ...filteredParticipants.map(p => {
        const row = [
          p.id, p.registrationId, `"${p.name}"`, p.phone, p.type
        ];
        return row.join(',');
      })
    ];

    const csvString = csvRows.join('\n');
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'checked_in_riders.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };


  if (error) {
    return (
      <div className="text-destructive flex items-center gap-2 p-4">
        <AlertTriangle />
        <p>Error loading data: {error.message}</p>
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
            <Button onClick={handleExport} disabled={filteredParticipants.length === 0} className="w-full sm:w-auto">
                <Download className="mr-2 h-4 w-4" />
                Export as CSV
            </Button>
        </div>
        
        {/* Mobile View - Cards */}
        <div className="md:hidden space-y-4">
           {loading ? (
                [...Array(3)].map((_, i) => (
                    <Card key={i}>
                        <CardContent className="p-4 space-y-4">
                             <div className="flex justify-between items-start">
                                <div className="flex items-center gap-3">
                                    <Skeleton className="h-12 w-12 rounded-full" />
                                    <div className="space-y-1">
                                        <Skeleton className="h-5 w-32" />
                                        <Skeleton className="h-4 w-24" />
                                    </div>
                                </div>
                                <Skeleton className="h-6 w-20" />
                            </div>
                        </CardContent>
                    </Card>
                ))
            ) : filteredParticipants.length > 0 ? (
                filteredParticipants.map((p) => (
                    <Card key={p.id}>
                        <CardContent className="p-4 space-y-3">
                            <div className="flex items-center gap-3">
                                <Avatar className="h-12 w-12">
                                    <AvatarImage src={p.photoUrl} alt={p.name} />
                                    <AvatarFallback><User /></AvatarFallback>
                                </Avatar>
                                <div>
                                    <p className="font-semibold">{p.name}</p>
                                    <p className="text-sm text-muted-foreground">{p.phone}</p>
                                    <Badge variant="secondary" className="mt-1 capitalize">{p.type}</Badge>
                                </div>
                            </div>
                            <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                                <CheckCircle className="mr-2 h-4 w-4" />
                                Checked-In
                            </Badge>
                        </CardContent>
                    </Card>
                ))
            ) : (
                <div className="text-center py-10 text-muted-foreground">
                   {searchTerm ? 'No checked-in riders match your search.' : 'No participants have checked in yet.'}
                </div>
            )}
        </div>

        {/* Desktop View - Table */}
        <div className="hidden md:block border rounded-lg">
            <Table>
                <TableHeader>
                <TableRow>
                    <TableHead>Photo</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Status</TableHead>
                </TableRow>
                </TableHeader>
                <TableBody>
                {loading ? (
                    <TableSkeleton />
                ) : filteredParticipants.length > 0 ? (
                    filteredParticipants.map((p) => (
                    <TableRow key={p.id}>
                        <TableCell>
                            <Avatar>
                                <AvatarImage src={p.photoUrl} alt={p.name} />
                                <AvatarFallback><User /></AvatarFallback>
                            </Avatar>
                        </TableCell>
                        <TableCell className="font-medium">{p.name}</TableCell>
                        <TableCell>{p.phone}</TableCell>
                        <TableCell><Badge variant="outline" className="capitalize">{p.type}</Badge></TableCell>
                        <TableCell className="text-right">
                             <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                                <CheckCircle className="mr-2 h-4 w-4" />
                                Checked-In
                            </Badge>
                        </TableCell>
                    </TableRow>
                    ))
                ) : (
                    <TableRow>
                    <TableCell colSpan={5} className="text-center h-24">
                        {searchTerm ? 'No checked-in riders match your search.' : 'No participants have checked in yet.'}
                    </TableCell>
                    </TableRow>
                )}
                </TableBody>
            </Table>
        </div>
    </div>
  );
}
