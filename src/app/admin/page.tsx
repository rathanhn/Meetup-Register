
"use client";

import { useEffect, useState } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { Header } from '@/components/header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { RegistrationsTable } from '@/components/admin/registrations-table';
import { AdminQna } from '@/components/admin/admin-qna';
import { StatsOverview } from '@/components/admin/stats-overview';
import { QrScanner } from '@/components/admin/qr-scanner';
import { ScanLine, Users, Loader2, List, FileCheck, MessageSquare, Megaphone, UserCheck, Flag, Settings, Blocks, ShieldAlert } from 'lucide-react';
import { UserRolesManager } from '@/components/admin/user-roles-manager';
import type { UserRole } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { RidersListTable } from '@/components/admin/riders-list-table';
import { AnnouncementManager } from '@/components/admin/announcement-manager';
import { CheckedInListTable } from '@/components/admin/checked-in-list-table';
import { FinishersListTable } from '@/components/admin/finishers-list-table';
import Link from 'next/link';

export default function AdminPage() {
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

    return (
        <div className="flex flex-col min-h-screen bg-secondary/50">
            <Header />
            <main className="flex-grow container mx-auto p-4 md:p-8">
                <div className="w-full max-w-7xl mx-auto space-y-8">
                    <div className="space-y-2">
                        <h1 className="text-2xl md:text-3xl font-bold font-headline">Admin Management</h1>
                        {loading ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                        ) : userRole ? (
                            <Badge variant="outline">Logged in as: <span className="capitalize ml-1 font-semibold">{userRole}</span></Badge>
                        ) : null}
                    </div>

                    {!loading && canManageContent ? (
                        <>
                            <StatsOverview />

                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
                                <div className="space-y-8">
                                    <Card>
                                        <CardHeader>
                                            <CardTitle className='flex items-center gap-2'><FileCheck className="h-6 w-6 text-primary" /> Manage Registrations</CardTitle>
                                        </CardHeader>
                                        <CardContent>
                                            <RegistrationsTable />
                                        </CardContent>
                                    </Card>

                                    <Card>
                                        <CardHeader>
                                            <CardTitle className='flex items-center gap-2'><Megaphone className="h-6 w-6 text-primary" />Announcements</CardTitle>
                                        </CardHeader>
                                        <CardContent>
                                            <AnnouncementManager />
                                        </CardContent>
                                    </Card>

                                    <Card>
                                        <CardHeader>
                                            <CardTitle className='flex items-center justify-between'>
                                                <span className='flex items-center gap-2'><Blocks className="h-6 w-6 text-primary" /> Website Content</span>
                                            </CardTitle>
                                            <CardDescription>Manage schedule, organizers, promotions, and more.</CardDescription>
                                        </CardHeader>
                                        <CardContent>
                                            <Link href="/admin/content">
                                                <Button className="w-full">Manage Content</Button>
                                            </Link>
                                        </CardContent>
                                    </Card>
                                </div>

                                <div className="space-y-8">
                                    <Card>
                                        <CardHeader>
                                            <CardTitle className="flex items-center gap-2">
                                                <ScanLine className="h-6 w-6 text-primary" />
                                                Ticket Scanner
                                            </CardTitle>
                                        </CardHeader>
                                        <CardContent>
                                            <QrScanner />
                                        </CardContent>
                                    </Card>

                                    {userRole === 'superadmin' && (
                                        <Card>
                                            <CardHeader>
                                                <CardTitle className='flex items-center gap-2'><Users className="h-6 w-6 text-primary" /> User Role Management</CardTitle>
                                            </CardHeader>
                                            <CardContent>
                                                <UserRolesManager />
                                            </CardContent>
                                        </Card>
                                    )}
                                </div>
                            </div>

                            <Card>
                                <CardHeader>
                                    <CardTitle className='flex items-center gap-2'><List className="h-6 w-6 text-primary" />Approved Riders List</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <RidersListTable />
                                </CardContent>
                            </Card>

                            <Card>
                                <CardHeader>
                                    <CardTitle className='flex items-center gap-2'><UserCheck className="h-6 w-6 text-primary" />Checked-In Riders</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <CheckedInListTable />
                                </CardContent>
                            </Card>

                            <Card>
                                <CardHeader>
                                    <CardTitle className='flex items-center gap-2'><Flag className="h-6 w-6 text-primary" />Finishers List</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <FinishersListTable />
                                </CardContent>
                            </Card>

                            <Card>
                                <CardHeader>
                                    <CardTitle className='flex items-center gap-2'><MessageSquare className="h-6 w-6 text-primary" />Community Q&amp;A</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <AdminQna />
                                </CardContent>
                            </Card>
                        </>
                    ) : !loading && (
                        <div className="flex flex-col items-center justify-center p-8 text-center space-y-4">
                            <ShieldAlert className="h-12 w-12 text-destructive" />
                            <h2 className="text-xl font-bold">Access Denied</h2>
                            <p className="text-muted-foreground">You do not have permission to view this page.</p>
                            <Button asChild variant="outline">
                                <Link href="/dashboard">Return to Dashboard</Link>
                            </Button>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}
