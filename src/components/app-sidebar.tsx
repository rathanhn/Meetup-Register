"use client"

import * as React from "react"
import {
    AudioWaveform,
    BookOpen,
    Bot,
    Command,
    Frame,
    GalleryVerticalEnd,
    Map,
    PieChart,
    Settings2,
    SquareTerminal,
    FileCheck,
    Megaphone,
    Blocks,
    ScanLine,
    Users,
    List,
    UserCheck,
    Flag,
    MessageSquare,
    Bike
} from "lucide-react"

import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarHeader,
    SidebarRail,
    SidebarGroup,
    SidebarGroupLabel,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    SidebarMenuSub,
    SidebarMenuSubButton,
    SidebarMenuSubItem,
    useSidebar,
} from "@/components/ui/sidebar"

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { cn } from "@/lib/utils";
import type { UserRole } from "@/lib/types";
import { useEventSettings } from "@/hooks/use-event-settings";

// This is sample data.
const data = {
    navMain: [
        {
            title: "Overview",
            url: "/admin",
            icon: SquareTerminal,
            items: [
                {
                    title: "Dashboard",
                    url: "/admin",
                },
            ],
        },
        {
            title: "Management",
            url: "#",
            icon: Users,
            items: [
                {
                    title: "Registrations",
                    url: "/admin?tab=registrations",
                    icon: FileCheck,
                },
                {
                    title: "Announcements",
                    url: "/admin?tab=announcements",
                    icon: Megaphone,
                },
            ],
        },
        {
            title: "Website Content",
            url: "#",
            icon: Blocks,
            items: [
                {
                    title: "General Settings",
                    url: "/admin?tab=content-general",
                },
                {
                    title: "Brand Visibility",
                    url: "/admin?tab=content-visibility",
                },
                {
                    title: "Homepage Content",
                    url: "/admin?tab=content-homepage",
                },
                {
                    title: "Schedule",
                    url: "/admin?tab=content-schedule",
                },
                {
                    title: "Organizers",
                    url: "/admin?tab=content-organizers",
                },
                {
                    title: "Partners",
                    url: "/admin?tab=content-partners",
                },
                {
                    title: "Promotions",
                    url: "/admin?tab=content-promotions",
                },
                {
                    title: "FAQ",
                    url: "/admin?tab=content-faq",
                },
                {
                    title: "Locations",
                    url: "/admin?tab=content-locations",
                },
                {
                    title: "Event Time",
                    url: "/admin?tab=content-time",
                },
            ],
        },
        {
            title: "Rider Lists",
            url: "#",
            icon: List,
            items: [
                {
                    title: "Approved Riders",
                    url: "/admin?tab=approved",
                    icon: List,
                },
                {
                    title: "Checked-In",
                    url: "/admin?tab=checked-in",
                    icon: UserCheck
                },
                {
                    title: "Finishers",
                    url: "/admin?tab=finishers",
                    icon: Flag
                },
            ],
        },
        {
            title: "Tools",
            url: "#",
            icon: Settings2,
            items: [
                {
                    title: "Ticket Scanner",
                    url: "/admin?tab=scanner",
                    icon: ScanLine,
                },
                {
                    title: "Community Q&A",
                    url: "/admin?tab=qna",
                    icon: MessageSquare,
                },
            ],
        },
    ],
}

interface AppSidebarProps extends React.ComponentProps<typeof Sidebar> {
    userRole?: UserRole | null;
}

export function AppSidebar({ userRole, ...props }: AppSidebarProps) {
    const pathname = usePathname();
    const { state } = useSidebar();
    const { settings } = useEventSettings();
    const title = settings?.headerTitle || "RideRegister";
    const logoUrl = settings?.headerLogoUrl;

    return (
        <Sidebar collapsible="icon" {...props}>
            <SidebarHeader>
                <div className="flex items-center gap-2 px-2 py-2">
                    <div className="flex aspect-square size-10 items-center justify-center rounded-lg  text-sidebar-primary-foreground overflow-hidden">
                        {logoUrl ? (
                            <img src={logoUrl} alt="Logo" className="w-full h-full object-contain" />
                        ) : (
                            <div className="flex items-center justify-center w-full h-full bg-primary/10 rounded-full">
                                <Bike className="w-6 h-6 text-primary" />
                            </div>
                        )}
                    </div>
                    <div className="flex flex-col gap-0.5 leading-none">
                        <span className="font-semibold">{title}</span>
                        <span className="text-xs text-muted-foreground">Admin Panel</span>
                    </div>
                </div>
            </SidebarHeader>
            <SidebarContent>
                {data.navMain.map((group) => (
                    <SidebarGroup key={group.title}>
                        <SidebarGroupLabel>{group.title}</SidebarGroupLabel>
                        <SidebarMenu>
                            {group.items.map((item) => (
                                <SidebarMenuItem key={item.title}>
                                    <SidebarMenuButton asChild tooltip={item.title} isActive={pathname === item.url}>
                                        <Link href={item.url}>
                                            {'icon' in item && item.icon ? (() => {
                                                const Icon = item.icon as any;
                                                return <Icon />
                                            })() : null}
                                            <span>{item.title}</span>
                                        </Link>
                                    </SidebarMenuButton>
                                </SidebarMenuItem>
                            ))}
                        </SidebarMenu>
                    </SidebarGroup>
                ))}

                {userRole === 'superadmin' && (
                    <SidebarGroup>
                        <SidebarGroupLabel>Super Admin</SidebarGroupLabel>
                        <SidebarMenu>
                            <SidebarMenuItem>
                                <SidebarMenuButton asChild tooltip="User Roles">
                                    <Link href="/admin?tab=roles">
                                        <Users />
                                        <span>User Roles</span>
                                    </Link>
                                </SidebarMenuButton>
                            </SidebarMenuItem>
                            <SidebarMenuItem>
                                <SidebarMenuButton asChild tooltip="Developer Settings">
                                    <Link href="/admin?tab=developer">
                                        <Settings2 />
                                        <span>Developer Settings</span>
                                    </Link>
                                </SidebarMenuButton>
                            </SidebarMenuItem>
                        </SidebarMenu>
                    </SidebarGroup>
                )}
            </SidebarContent>
            <SidebarFooter>
                {/* User Profile or Logout could go here */}
            </SidebarFooter>
            <SidebarRail />
        </Sidebar>
    )
}
