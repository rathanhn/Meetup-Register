
"use client";

import { useState, useEffect } from 'react';
import { useCollection } from '@/firebase/firestore/use-collection';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { collection, query, orderBy, getDoc, doc } from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { Loader2, AlertTriangle, Edit, PlusCircle, ShieldAlert } from 'lucide-react';
import type { LocationPartner, UserRole } from '@/lib/types';
import { LocationPartnerForm } from './location-partner-form';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import Image from 'next/image';
import { useMemoFirebase } from '@/firebase/memo';

export function LocationPartnerManager() {
  const partnersQuery = useMemoFirebase(() => query(collection(db, 'locationPartners'), orderBy('createdAt', 'asc')), []);
  const { data: partners, loading, error } = useCollection<LocationPartner>(partnersQuery);
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<LocationPartner | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
        setUser(user);
        setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (user) {
        const userDocRef = doc(db, 'users', user.uid);
        getDoc(userDocRef).then(doc => {
            if (doc.exists()) {
                setUserRole(doc.data().role as UserRole);
            }
        })
    }
  }, [user]);

  const partnerItems = partners || [];

  const handleEdit = (item: LocationPartner) => {
    setSelectedItem(item);
    setIsFormOpen(true);
  };

  const handleAddNew = () => {
    setSelectedItem(null);
    setIsFormOpen(true);
  };
  
  const canEdit = userRole === 'admin' || userRole === 'superadmin';

  return (
    <div className="space-y-4">
      <CardHeader className="p-0">
        <CardTitle>Manage Location Partner</CardTitle>
        <CardDescription>Add or edit the event's location partner details.</CardDescription>
      </CardHeader>
      
      {canEdit && (
        <Button onClick={handleAddNew} size="sm"><PlusCircle className="mr-2 h-4 w-4" /> Add/Edit Partner</Button>
      )}

      <LocationPartnerForm
        isOpen={isFormOpen}
        setIsOpen={setIsFormOpen}
        partner={selectedItem}
        user={user}
      />

      <div className="border rounded-lg">
        {loading || authLoading ? (
            <div className="p-4 text-center"><Loader2 className="animate-spin mx-auto" /></div>
        ) : error ? (
            <div className="p-4 text-center text-destructive"><AlertTriangle/> Error loading data.</div>
        ) : partnerItems.length === 0 ? (
            <p className="p-4 text-center text-muted-foreground">No location partner added yet.</p>
        ) : (
            partnerItems.map(item => (
                <Card key={item.id} className="p-4 flex flex-col sm:flex-row items-center gap-4">
                    <Image src={item.imageUrl} alt={item.name} width={150} height={100} className="rounded-md object-cover" data-ai-hint={item.imageHint} />
                    <div className="flex-grow">
                        <h4 className="font-bold">{item.name}</h4>
                        <a href={item.websiteUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline">{item.websiteUrl}</a>
                    </div>
                    {canEdit && (
                        <Button variant="ghost" size="icon" onClick={() => handleEdit(item)}><Edit className="h-4 w-4" /></Button>
                    )}
                </Card>
            ))
        )}
      </div>
       {!canEdit && (
            <div className="text-muted-foreground flex items-center gap-2 p-2 bg-secondary rounded-md text-xs">
                <ShieldAlert className="h-4 w-4" />
                <p>Only Admins can add or edit the location partner.</p>
            </div>
        )}
    </div>
  );
}
