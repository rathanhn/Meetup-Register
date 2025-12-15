"use client";

import { useEffect, useState, Suspense } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { Header } from '@/components/header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { RegistrationsTable } from '@/components/admin/registrations-table';
import { AdminQna } from '@/components/admin/admin-qna';
import { StatsOverview } from '@/components/admin/stats-overview';
import { QrScanner } from '@/components/admin/qr-scanner';
import { ScanLine, Users, Loader2, List, FileCheck, MessageSquare, Megaphone, UserCheck, Flag, Blocks, ShieldAlert, Settings2 } from 'lucide-react';
import { UserRolesManager } from '@/components/admin/user-roles-manager';
import type { UserRole } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { RidersListTable } from '@/components/admin/riders-list-table';
import { AnnouncementManager } from '@/components/admin/announcement-manager';
import { CheckedInListTable } from '@/components/admin/checked-in-list-table';
import { FinishersListTable } from '@/components/admin/finishers-list-table';
import Link from 'next/link';
import { SidebarProvider, SidebarTrigger, SidebarInset } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/app-sidebar"
import { useSearchParams } from 'next/navigation';
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb"
import { Separator } from "@/components/ui/separator"

import { ThemeToggle } from '@/components/theme-toggle';
import { AuthButton } from '@/components/auth-button';
import { ScheduleManager } from "./content/schedule-manager";
import { OrganizerManager } from "./content/organizer-manager";
import { PromotionManager } from "./content/promotion-manager";
import { LocationManager } from "./content/location-manager";
import { EventTimeManager } from "./content/event-time-manager";
import { GeneralSettingsManager } from "@/components/admin/general-settings-manager";
import { LocationPartnerManager } from "./content/location-partner-manager";
import { FaqManager } from "./content/faq-manager";
import { HomepageContentManager } from "./content/homepage-content-manager";
import { HomepageVisibilityManager } from "./content/homepage-visibility-manager";
import { DeveloperSettingsManager } from "@/components/admin/developer-settings-manager";

function AdminDashboardContent() {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [userRole, setUserRole] = useState<UserRole | null>(null);
    const searchParams = useSearchParams();
    const currentTab = searchParams.get('tab') || 'overview';

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
            setUser(currentUser);

            if (currentUser) {
                // Determine role before setting loading to false
                try {
                    const userDocRef = doc(db, "users", currentUser.uid);
                    const userDoc = await getDoc(userDocRef);
                    if (userDoc.exists()) {
                        setUserRole(userDoc.data().role as UserRole);
                    }
                } catch (e) {
                    console.error("Error fetching user role:", e);
                }
            } else {
                setUserRole(null);
            }

            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    const canManageContent = userRole === 'superadmin' || userRole === 'admin';

    const renderContent = () => {
        switch (currentTab) {
            case 'content-general':
                return (
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2"><Settings2 className="h-6 w-6 text-primary" /> General Settings</CardTitle>
                        </CardHeader>
                        <CardContent><GeneralSettingsManager /></CardContent>
                    </Card>
                );
            case 'content-visibility':
                return (
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2"><ScanLine className="h-6 w-6 text-primary" /> Brand Visibility</CardTitle>
                        </CardHeader>
                        <CardContent><HomepageVisibilityManager /></CardContent>
                    </Card>
                );
            case 'content-homepage':
                return (
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2"><Blocks className="h-6 w-6 text-primary" /> Homepage Content</CardTitle>
                        </CardHeader>
                        <CardContent><HomepageContentManager /></CardContent>
                    </Card>
                )
            case 'content-schedule':
                return (
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2"><List className="h-6 w-6 text-primary" /> Schedule Management</CardTitle>
                        </CardHeader>
                        <CardContent><ScheduleManager /></CardContent>
                    </Card>
                )
            case 'content-organizers':
                return (
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2"><Users className="h-6 w-6 text-primary" /> Organizer Management</CardTitle>
                        </CardHeader>
                        <CardContent><OrganizerManager /></CardContent>
                    </Card>
                )
            case 'content-partners':
                return (
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2"><Users className="h-6 w-6 text-primary" /> Partner Management</CardTitle>
                        </CardHeader>
                        <CardContent><LocationPartnerManager /></CardContent>
                    </Card>
                )
            case 'content-promotions':
                return (
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2"><Megaphone className="h-6 w-6 text-primary" /> Promotion Management</CardTitle>
                        </CardHeader>
                        <CardContent><PromotionManager /></CardContent>
                    </Card>
                )
            case 'content-faq':
                return (
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2"><MessageSquare className="h-6 w-6 text-primary" /> FAQ Management</CardTitle>
                        </CardHeader>
                        <CardContent><FaqManager /></CardContent>
                    </Card>
                )
            case 'content-locations':
                return (
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2"><ScanLine className="h-6 w-6 text-primary" /> Location Management</CardTitle>
                        </CardHeader>
                        <CardContent><LocationManager /></CardContent>
                    </Card>
                )
            case 'content-time':
                return (
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2"><ScanLine className="h-6 w-6 text-primary" /> Event Time Management</CardTitle>
                        </CardHeader>
                        <CardContent><EventTimeManager /></CardContent>
                    </Card>
                )

            case 'developer':
                if (userRole !== 'superadmin') return <Card><CardContent className="p-6 text-destructive">Unauthorized</CardContent></Card>;
                return <DeveloperSettingsManager />;

            case 'roles':
                if (userRole !== 'superadmin') return <Card><CardContent className="p-6 text-destructive">Unauthorized</CardContent></Card>;
                return (
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2"><Users className="h-6 w-6 text-primary" /> User Role Management</CardTitle>
                        </CardHeader>
                        <CardContent><UserRolesManager /></CardContent>
                    </Card>
                )

            case 'announcements':
                return (
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2"><Megaphone className="h-6 w-6 text-primary" /> Announcement Management</CardTitle>
                        </CardHeader>
                        <CardContent><AnnouncementManager /></CardContent>
                    </Card>
                )

            case 'registrations':
                return (
                    <Card>
                        <CardHeader>
                            <CardTitle className='flex items-center gap-2'><FileCheck className="h-6 w-6 text-primary" /> Manage Registrations</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <RegistrationsTable />
                        </CardContent>
                    </Card>
                )
            case 'announcements':
                return (
                    <Card>
                        <CardHeader>
                            <CardTitle className='flex items-center gap-2'><Megaphone className="h-6 w-6 text-primary" />Announcements</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <AnnouncementManager />
                        </CardContent>
                    </Card>
                )
            case 'approved':
                return (
                    <Card>
                        <CardHeader>
                            <CardTitle className='flex items-center gap-2'><List className="h-6 w-6 text-primary" />Approved Riders List</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <RidersListTable />
                        </CardContent>
                    </Card>
                )
            case 'checked-in':
                return (
                    <Card>
                        <CardHeader>
                            <CardTitle className='flex items-center gap-2'><UserCheck className="h-6 w-6 text-primary" />Checked-In Riders</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <CheckedInListTable />
                        </CardContent>
                    </Card>
                )
            case 'finishers':
                return (
                    <Card>
                        <CardHeader>
                            <CardTitle className='flex items-center gap-2'><Flag className="h-6 w-6 text-primary" />Finishers List</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <FinishersListTable />
                        </CardContent>
                    </Card>
                )
            case 'scanner':
                return (
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
                )
            case 'qna':
                return (
                    <Card>
                        <CardHeader>
                            <CardTitle className='flex items-center gap-2'><MessageSquare className="h-6 w-6 text-primary" />Community Q&amp;A</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <AdminQna />
                        </CardContent>
                    </Card>
                )
            case 'roles':
                if (userRole !== 'superadmin') return <div>Access Denied</div>
                return (
                    <Card>
                        <CardHeader>
                            <CardTitle className='flex items-center gap-2'><Users className="h-6 w-6 text-primary" /> User Role Management</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <UserRolesManager />
                        </CardContent>
                    </Card>
                )

            case 'developer':
                if (userRole !== 'superadmin') return <div>Access Denied</div>
                return <DeveloperSettingsManager />;

            case 'overview':
            default:
                return (
                    <div className="space-y-6">
                        <StatsOverview />
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            <Card className="hover:bg-accent/50 transition-colors cursor-pointer" onClick={() => window.location.href = '/admin?tab=registrations'}>
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2 text-base"><FileCheck className="h-5 w-5" /> Registrations</CardTitle>
                                    <CardDescription>Review pending signups</CardDescription>
                                </CardHeader>
                            </Card>
                            <Card className="hover:bg-accent/50 transition-colors cursor-pointer" onClick={() => window.location.href = '/admin?tab=scanner'}>
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2 text-base"><ScanLine className="h-5 w-5" /> Scanner</CardTitle>
                                    <CardDescription>Scan tickets at venue</CardDescription>
                                </CardHeader>
                            </Card>
                            <Card className="hover:bg-accent/50 transition-colors cursor-pointer" onClick={() => window.location.href = '/admin/content'}>
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2 text-base"><Blocks className="h-5 w-5" /> Content</CardTitle>
                                    <CardDescription>Edit website content</CardDescription>
                                </CardHeader>
                            </Card>
                        </div>
                    </div>
                );
        }
    }

    if (loading) return <div className="flex h-screen w-full items-center justify-center"><Loader2 className="animate-spin h-8 w-8" /></div>;

    if (!userRole || !canManageContent) {
        return (
            <div className="flex flex-col min-h-screen bg-secondary/50">
                <Header />
                <div className="flex flex-col items-center justify-center p-8 text-center space-y-4 flex-grow">
                    <ShieldAlert className="h-12 w-12 text-destructive" />
                    <h2 className="text-xl font-bold">Access Denied</h2>
                    <p className="text-muted-foreground">You do not have permission to view this page.</p>
                    <Button asChild variant="outline">
                        <Link href="/dashboard">Return to Dashboard</Link>
                    </Button>
                </div>
            </div>
        )
    }

    return (
        <SidebarProvider>
            <AppSidebar userRole={userRole} />
            <SidebarInset>
                <header className="flex h-16 shrink-0 items-center justify-between gap-2 border-b px-4 transition-[width,height] ease-linear group-has-[[data-collapsible=icon]]/sidebar-wrapper:h-12">
                    <div className="flex items-center gap-2 px-4">
                        <SidebarTrigger className="-ml-1" />
                        <Separator orientation="vertical" className="mr-2 h-4" />
                        <Breadcrumb>
                            <BreadcrumbList>
                                <BreadcrumbItem className="hidden md:block">
                                    <BreadcrumbLink href="/admin">
                                        Admin Panel
                                    </BreadcrumbLink>
                                </BreadcrumbItem>
                                {currentTab !== 'overview' && (
                                    <>
                                        <BreadcrumbSeparator className="hidden md:block" />
                                        <BreadcrumbItem>
                                            <BreadcrumbPage className="capitalize">{currentTab}</BreadcrumbPage>
                                        </BreadcrumbItem>
                                    </>
                                )}
                            </BreadcrumbList>
                        </Breadcrumb>
                    </div>
                    <div className="flex items-center gap-4">
                        {userRole !== 'superadmin' && (
                            <Button variant="outline" size="sm" className="hidden md:flex border-yellow-500/50 text-yellow-600 dark:text-yellow-400 bg-yellow-500/10 hover:bg-yellow-500/20">
                                <ShieldAlert className="w-4 h-4 mr-2" />
                                Purchase Full Version
                            </Button>
                        )}
                        <ThemeToggle />
                        <AuthButton />
                    </div>
                </header>
                <div className="flex flex-1 flex-col gap-4 p-4 md:p-8 max-w-7xl w-full mx-auto">
                    {renderContent()}
                </div>
            </SidebarInset>
        </SidebarProvider>
    );
}

export default function AdminPage() {
    return (
        <Suspense fallback={<div className="flex h-screen w-full items-center justify-center"><Loader2 className="animate-spin h-8 w-8" /></div>}>
            <AdminDashboardContent />
        </Suspense>
    );
}
