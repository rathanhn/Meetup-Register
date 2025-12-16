
"use client";

import { onAuthStateChanged, signOut, type User } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import { Button } from './ui/button';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { LayoutDashboard, LogOut, User as UserIcon, ShieldCheck } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { UserRole } from '@/lib/types';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';

export function AuthButton() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const [userRole, setUserRole] = useState<UserRole | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleLogout = async () => {
    await signOut(auth);
    setUserRole(null);
    router.push('/');
  };

  useEffect(() => {
    let unsubscribeUserDoc: (() => void) | undefined;

    const fetchUserRole = async () => {
      if (user) {
        console.log("AuthButton: Fetching role for user", user.uid);
        unsubscribeUserDoc = onSnapshot(doc(db, "users", user.uid), (userDoc) => {
          if (userDoc.exists()) {
            const role = userDoc.data().role as UserRole;
            setUserRole(role);

            // Detailed Permission Logging
            const rolePermissions: Record<string, any> = {
              superadmin: {
                description: "👑 Super Admin: Full System Access",
                canManageUserRoles: true,
                canManageDeveloperSettings: true,
                canManageContent: true,
                canManageRegistrations: true,
                canScanTickets: true,
                canManageQna: true,
              },
              admin: {
                description: "🛡️ Admin: Event Manager Access",
                canManageUserRoles: false,
                canManageDeveloperSettings: false,
                canManageContent: true,
                canManageRegistrations: true,
                canScanTickets: true,
                canManageQna: true,
              },
              viewer: {
                description: "👁️ Viewer: Read-Only Access",
                canManageUserRoles: false,
                canManageDeveloperSettings: false,
                canManageContent: false,
                canManageRegistrations: false,
                canScanTickets: false,
                canManageQna: false,
              },
              user: {
                description: "👤 User: Participant Access",
                canManageUserRoles: false,
                canManageDeveloperSettings: false,
                canManageContent: false,
                canManageRegistrations: false,
                canScanTickets: false,
                canManageQna: false,
              }
            };

            const permissions = rolePermissions[role] || rolePermissions['user'];

            console.group(`🔐 User Access Level: ${role.toUpperCase()}`);
            console.log(`User ID: ${user.uid}`);
            console.log(`Role Description: ${permissions.description}`);
            console.table(permissions);
            console.groupEnd();

          } else {
            console.log("AuthButton: User doc not found, defaulting to user");
            setUserRole('user');
          }
        }, (error) => {
          console.error("AuthButton: Error fetching user role:", error);
        });
      } else {
        setUserRole(null);
      }
    };

    fetchUserRole();

    return () => {
      if (unsubscribeUserDoc) unsubscribeUserDoc();
    }
  }, [user]);

  const isAdmin = userRole === 'admin' || userRole === 'superadmin';

  if (loading) {
    return <Button variant="outline" size="sm" disabled>...</Button>;
  }

  if (user) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="relative h-8 w-8 rounded-full">
            <Avatar className="h-8 w-8">
              <AvatarImage src={user.photoURL ?? ''} alt={user.displayName ?? 'User'} />
              <AvatarFallback>
                <UserIcon />
              </AvatarFallback>
            </Avatar>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-56" align="end" forceMount>
          <DropdownMenuLabel className="font-normal">
            <div className="flex flex-col space-y-1">
              <p className="text-sm font-medium leading-none">
                {user.displayName || 'Welcome'}
              </p>
              <p className="text-xs leading-none text-muted-foreground">
                {user.email}
              </p>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => router.push('/dashboard')}>
            <LayoutDashboard className="mr-2 h-4 w-4" />
            <span>User Dashboard</span>
          </DropdownMenuItem>
          {isAdmin && (
            <DropdownMenuItem onClick={() => router.push('/admin')}>
              <ShieldCheck className="mr-2 h-4 w-4" />
              <span>Admin Dashboard</span>
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleLogout}>
            <LogOut className="mr-2 h-4 w-4" />
            <span>Log out</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    )
  }

  return (
    <div className="flex items-center gap-2">
      <Button asChild size="sm">
        <Link href="/login">Login</Link>
      </Button>
      <Button asChild variant="outline" size="sm" className="hidden sm:inline-flex">
        <Link href="/register">Register</Link>
      </Button>
    </div>
  );
}
