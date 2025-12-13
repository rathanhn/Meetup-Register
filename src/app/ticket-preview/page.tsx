
"use client";

import { useSearchParams } from 'next/navigation';
import React, { Suspense } from 'react';
import { DigitalTicket } from '@/components/digital-ticket';
import { Loader2 } from 'lucide-react';
import { Registration } from '@/lib/types';
import { User } from 'firebase/auth';

function TicketPreviewContent() {
    const searchParams = useSearchParams();

    // Mock Data for Preview
    const mockRegistration: Registration = {
        id: "PREVIEW-12345",
        uid: "preview-user",
        registrationType: "bike",
        fullName: searchParams.get('name') || "John Doe",
        age: 25,
        phoneNumber: searchParams.get('phone') || "+91 98765 43210",
        photoURL: searchParams.get('photo') || undefined,
        createdAt: new Date(),
        status: 'approved',
        rider1CheckedIn: true,
    };

    const mockUser = {
        uid: "preview-user",
        email: "john@example.com",
        displayName: "John Doe",
    } as User;

    return (
        <div className="min-h-screen bg-black/90 flex flex-col items-center justify-center p-4">
            <div className="w-full max-w-sm">
                <DigitalTicket registration={mockRegistration} user={mockUser} />
            </div>
            <p className="text-white mt-8 text-sm opacity-50">Ticket Preview Mode</p>
        </div>
    );
}

export default function TicketPreviewPage() {
    return (
        <Suspense fallback={<div className="flex items-center justify-center h-screen"><Loader2 className="h-8 w-8 animate-spin" /></div>}>
            <TicketPreviewContent />
        </Suspense>
    );
}
