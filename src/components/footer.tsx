"use client";

import { usePathname } from 'next/navigation';
import { useEventSettings } from '@/hooks/use-event-settings';
import { Heart } from 'lucide-react';

export function Footer() {
    const pathname = usePathname();
    const { settings } = useEventSettings();

    // Hide footer on admin routes
    if (pathname?.startsWith('/admin')) return null;

    const developerName = settings?.developerName || "Rathan.dev";
    const developerLink = settings?.developerLink || "https://www.instagram.com/rathan_hn";

    return (
        <footer className="w-full py-6 mt-auto border-t bg-card/50 backdrop-blur-sm">
            <div className="container mx-auto px-4 flex flex-col items-center justify-center gap-2 text-center">
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                    Designed & Developed with <Heart className="w-3 h-3 text-red-500 fill-red-500 animate-pulse" /> by{' '}
                    <a
                        href={developerLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-medium text-primary hover:underline underline-offset-4 transition-colors"
                    >
                        {developerName}
                    </a>
                </p>
                <p className="text-xs text-muted-foreground/60">
                    © {new Date().getFullYear()} {settings?.ticketTitle || "RideRegister"}. All rights reserved.
                </p>
            </div>
        </footer>
    );
}
