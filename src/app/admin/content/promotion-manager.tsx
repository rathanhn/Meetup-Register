
"use client";

import { useState, useEffect } from 'react';
import { useCollection } from '@/firebase/firestore/use-collection';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { collection, query, orderBy } from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Loader2, AlertTriangle, Edit, Trash2, PlusCircle } from 'lucide-react';
import type { Offer } from '@/lib/types';
import { PromotionForm } from './promotion-form';
import Image from 'next/image';
import { useMemoFirebase } from '@/firebase/memo';

export function PromotionManager() {
  const promotionsQuery = useMemoFirebase(() => query(collection(db, 'promotions'), orderBy('createdAt', 'asc')), []);
  const { data: promotions, loading, error } = useCollection<Offer>(promotionsQuery);
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const { toast } = useToast();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<Offer | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
        setUser(user);
        setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const promotionItems = promotions || [];

  const handleEdit = (item: Offer) => {
    setSelectedItem(item);
    setIsFormOpen(true);
  };

  const handleAddNew = () => {
    setSelectedItem(null);
    setIsFormOpen(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium">Manage Promotions</h3>
        <Button onClick={handleAddNew} size="sm"><PlusCircle className="mr-2 h-4 w-4" /> Add New Promotion</Button>
      </div>

      <PromotionForm
        isOpen={isFormOpen}
        setIsOpen={setIsFormOpen}
        promotion={selectedItem}
        user={user}
      />

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Image</TableHead>
              <TableHead>Title</TableHead>
              <TableHead>Price</TableHead>
              <TableHead>Offer Price</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading || authLoading ? (
              <TableRow><TableCell colSpan={5} className="text-center"><Loader2 className="animate-spin mx-auto" /></TableCell></TableRow>
            ) : error ? (
              <TableRow><TableCell colSpan={5} className="text-center text-destructive"><AlertTriangle/> Error loading data.</TableCell></TableRow>
            ) : promotionItems.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center h-24">No promotions found.</TableCell></TableRow>
            ) : (
              promotionItems.map(item => (
                <TableRow key={item.id}>
                  <TableCell>
                    <Image 
                        src={item.imageUrl} 
                        alt={item.title} 
                        width={40} 
                        height={40} 
                        className="rounded-md object-cover"
                        data-ai-hint={item.imageHint}
                    />
                  </TableCell>
                  <TableCell className="font-medium">{item.title}</TableCell>
                  <TableCell>{item.actualPrice ? `₹${item.actualPrice}` : 'N/A'}</TableCell>
                  <TableCell>{item.offerPrice ? `₹${item.offerPrice}` : 'N/A'}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => handleEdit(item)}><Edit className="h-4 w-4" /></Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
