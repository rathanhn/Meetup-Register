
"use client";

import React, { useState, useEffect, useMemo } from 'react';
import type { AppUser, Registration } from "@/lib/types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Award, Download, Share2, Loader2 } from "lucide-react";
import Link from 'next/link';

interface CertificateCardProps {
    user: AppUser;
    registration: Registration;
}

export function CertificateCard({ user, registration }: CertificateCardProps) {
    const [origin, setOrigin] = useState('');

    useEffect(() => {
        if (typeof window !== 'undefined') {
            setOrigin(window.location.origin);
        }
    }, []);

    const certificatePreviewUrl = useMemo(() => {
        if (!origin) return '';

        const params = new URLSearchParams();
        params.set('name', registration.fullName);
        if (registration.photoURL) {
            params.set('photo', registration.photoURL);
        }
        params.set('regId', registration.id);
        
        return `${origin}/certificate-preview?${params.toString()}`;
    }, [origin, registration]);


    if (!origin) {
         return (
             <Card className="border-primary/50 bg-primary/5">
                 <CardHeader>
                    <CardTitle className="flex items-center gap-2"><Award className="h-6 w-6 text-primary" /> Certificate of Completion</CardTitle>
                 </CardHeader>
                 <CardContent>
                    <div className="w-full flex justify-center">
                        <Loader2 className="h-5 w-5 animate-spin"/>
                    </div>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="border-primary/50 bg-primary/5">
            <CardHeader>
                <CardTitle className="flex items-center gap-2"><Award className="h-6 w-6 text-primary" /> Certificate of Completion</CardTitle>
                <CardDescription>
                    Congratulations on completing the ride! View, download, or share your certificate.
                </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col sm:flex-row gap-2">
                <Button asChild className="w-full">
                    <Link href={certificatePreviewUrl} target="_blank" rel="noopener noreferrer">
                        <Download className="mr-2 h-4 w-4" />
                        View / Download
                    </Link>
                </Button>
                {navigator.share && (
                    <Button asChild variant="outline" className="w-full">
                         <Link href={certificatePreviewUrl} target="_blank" rel="noopener noreferrer">
                            <Share2 className="mr-2 h-4 w-4" />
                            Share Certificate
                        </Link>
                    </Button>
                )}
            </CardContent>
        </Card>
    );
}
