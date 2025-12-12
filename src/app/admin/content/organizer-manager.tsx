
"use client";

import { useState, useEffect } from 'react';
import { useCollection } from '@/firebase/firestore/use-collection';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { collection, query, orderBy, getDoc, doc } from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from '@/components/ui/button';
import { Loader2, AlertTriangle, Edit, PlusCircle, ShieldAlert } from 'lucide-react';
import type { Organizer, UserRole } from '@/lib/types';
import { OrganizerForm } from './organizer-form';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useMemoFirebase } from '@/firebase/memo';

export function OrganizerManager() {
  const organizersQuery = useMemoFirebase(() => query(collection(db, 'organizers'), orderBy('createdAt', 'asc')), []);
  const { data: organizers, loading, error } = useCollection<Organizer>(organizersQuery);
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<Organizer | null>(null);

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

  const organizerItems = organizers || [];

  const handleEdit = (item: Organizer) => {
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
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium">Manage Organizers</h3>
        {canEdit && (
            <Button onClick={handleAddNew} size="sm"><PlusCircle className="mr-2 h-4 w-4" /> Add New Organizer</Button>
        )}
      </div>

      <OrganizerForm
        isOpen={isFormOpen}
        setIsOpen={setIsFormOpen}
        organizer={selectedItem}
        user={user}
        userRole={userRole}
      />

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Photo</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Contact</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading || authLoading ? (
              <TableRow><TableCell colSpan={5} className="text-center"><Loader2 className="animate-spin mx-auto" /></TableCell></TableRow>
            ) : error ? (
              <TableRow><TableCell colSpan={5} className="text-center text-destructive"><AlertTriangle/> Error loading data.</TableCell></TableRow>
            ) : organizerItems.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center h-24">No organizers found.</TableCell></TableRow>
            ) : (
              organizerItems.map(item => (
                <TableRow key={item.id}>
                    <TableCell>
                        <Avatar>
                            <AvatarImage src={item.imageUrl} alt={item.name} />
                            <AvatarFallback>{item.name.charAt(0)}</AvatarFallback>
                        </Avatar>
                    </TableCell>
                  <TableCell className="font-medium">{item.name}</TableCell>
                  <TableCell>{item.role}</TableCell>
                   <TableCell>{item.contactNumber || 'N/A'}</TableCell>
                  <TableCell className="text-right">
                    {canEdit ? (
                        <Button variant="ghost" size="icon" onClick={() => handleEdit(item)}><Edit className="h-4 w-4" /></Button>
                    ) : (
                        <span className='text-muted-foreground text-xs'>View Only</span>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
       {!canEdit && (
            <div className="text-muted-foreground flex items-center gap-2 p-2 bg-secondary rounded-md text-xs">
                <ShieldAlert className="h-4 w-4" />
                <p>Only Admins can add, edit, or delete organizers.</p>
            </div>
        )}
    </div>
  );
}
