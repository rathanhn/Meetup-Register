
"use client";

import { useEffect, useState } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { Loader2, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import type { UserRole } from '@/lib/types';

import { ScheduleManager } from "./schedule-manager";
import { OrganizerManager } from "./organizer-manager";
import { PromotionManager } from "./promotion-manager";
import { LocationManager } from "./location-manager";
import { EventTimeManager } from "./event-time-manager";
import { GeneralSettingsManager } from "@/components/admin/general-settings-manager";
import { LocationPartnerManager } from "./location-partner-manager";
import { FaqManager } from "./faq-manager";
import { HomepageContentManager } from "./homepage-content-manager";
import { HomepageVisibilityManager } from "./homepage-visibility-manager";


export default function ContentManagement() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<UserRole | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (user) {
      const fetchUserRole = async () => {
        const userDocRef = doc(db, "users", user.uid);
        const userDoc = await getDoc(userDocRef);
        if (userDoc.exists()) {
          setUserRole(userDoc.data().role as UserRole);
        }
      };
      fetchUserRole();
    }
  }, [user]);

  const canManageContent = userRole === 'superadmin' || userRole === 'admin';

  if (loading) {
    return <div className="flex justify-center items-center h-screen"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  if (!canManageContent) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-4">
        <ShieldAlert className="h-12 w-12 text-destructive" />
        <h2 className="text-xl font-bold">Access Denied</h2>
        <p className="text-muted-foreground">You do not have permission to view this page.</p>
        <Button asChild variant="outline">
          <Link href="/dashboard">Return to Dashboard</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <GeneralSettingsManager />
      <HomepageVisibilityManager />
      <HomepageContentManager />
      <ScheduleManager />
      <OrganizerManager />
      <LocationPartnerManager />
      <PromotionManager />
      <FaqManager />
      <LocationManager />
      <EventTimeManager />
    </div>
  );
}
