
"use client";

import { useState, useEffect } from 'react';
import { useCollection } from '@/firebase/firestore/use-collection';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { collection, query, orderBy, getDoc, doc } from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { Loader2, AlertTriangle, Edit, PlusCircle, ShieldAlert } from 'lucide-react';
import type { FaqItem, UserRole } from '@/lib/types';
import { FaqForm } from './faq-form';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { useMemoFirebase } from '@/firebase/memo';

export function FaqManager() {
  const faqsQuery = useMemoFirebase(() => query(collection(db, 'faqs'), orderBy('createdAt', 'asc')), []);
  const { data: faqs, loading, error } = useCollection<FaqItem>(faqsQuery);
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<FaqItem | null>(null);

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

  const faqItems = faqs || [];

  const handleEdit = (item: FaqItem) => {
    setSelectedItem(item);
    setIsFormOpen(true);
  };

  const handleAddNew = () => {
    setSelectedItem(null);
    setIsFormOpen(true);
  };
  
  const canEdit = userRole === 'admin' || userRole === 'superadmin';

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <div>
            <CardTitle>Manage FAQs</CardTitle>
            <CardDescription>Add or edit frequently asked questions for the homepage.</CardDescription>
          </div>
          {canEdit && (
            <Button onClick={handleAddNew} size="sm"><PlusCircle className="mr-2 h-4 w-4" /> Add New FAQ</Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <FaqForm
          isOpen={isFormOpen}
          setIsOpen={setIsFormOpen}
          faqItem={selectedItem}
          user={user}
        />

        <div className="border rounded-lg p-4">
          {loading || authLoading ? (
              <div className="p-4 text-center"><Loader2 className="animate-spin mx-auto" /></div>
          ) : error ? (
              <div className="p-4 text-center text-destructive"><AlertTriangle/> Error loading data.</div>
          ) : faqItems.length === 0 ? (
              <p className="p-4 text-center text-muted-foreground">No FAQs added yet.</p>
          ) : (
            <Accordion type="single" collapsible className="w-full">
              {faqItems.map(item => (
                  <AccordionItem value={item.id} key={item.id}>
                    <AccordionTrigger className="flex justify-between items-center w-full text-left">
                       <span>{item.question}</span>
                    </AccordionTrigger>
                    <AccordionContent className="pt-2">
                      <div className="space-y-4">
                        <p className="text-muted-foreground">{item.answer}</p>
                        {canEdit && (
                            <Button variant="outline" size="sm" onClick={() => handleEdit(item)}><Edit className="mr-2 h-3 w-3" /> Edit</Button>
                        )}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
              ))}
            </Accordion>
          )}
        </div>
         {!canEdit && !loading && (
              <div className="text-muted-foreground flex items-center gap-2 p-2 bg-secondary rounded-md text-xs mt-4">
                  <ShieldAlert className="h-4 w-4" />
                  <p>Only Admins can add or edit FAQs.</p>
              </div>
          )}
      </CardContent>
    </Card>
  );
}
