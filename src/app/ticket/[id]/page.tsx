
"use client";

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Registration } from '@/lib/types';
import { Header } from '@/components/header';
import { Loader2, AlertTriangle, Ticket, Download, CheckCircle, Award } from 'lucide-react';
import { SingleTicket } from '@/components/digital-ticket';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import * as htmlToImage from 'html-to-image';
import jsPDF from 'jspdf';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';

function filter(node: HTMLElement): boolean {
  if (node.tagName === 'i') return false;
  if (node.tagName === 'LINK' && (node as HTMLLinkElement).href.includes('fonts.googleapis.com')) {
    return false;
  }
  return true;
}


export default function PublicTicketPage() {
    const params = useParams();
    const id = params.id as string;
    const [registration, setRegistration] = useState<Registration | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isDownloading, setIsDownloading] = useState(false);
    const { toast } = useToast();

    useEffect(() => {
        if (!id) {
            setError("No ticket ID provided.");
            setLoading(false);
            return;
        }

        const fetchTicket = async () => {
            try {
                const regDocRef = doc(db, 'registrations', id);
                const regDoc = await getDoc(regDocRef);

                if (regDoc.exists()) {
                    const data = { id: regDoc.id, ...regDoc.data() } as Registration;
                    if (data.status === 'approved' || data.status === 'cancelled') {
                        setRegistration(data);
                    } else {
                        setError("This ticket is not currently valid or has been cancelled.");
                    }
                } else {
                    setError("This ticket could not be found.");
                }
            } catch (err) {
                console.error("Error fetching ticket:", err);
                setError("An error occurred while trying to load the ticket.");
            } finally {
                setLoading(false);
            }
        };

        fetchTicket();
    }, [id]);
    
    const handleDownload = async () => {
        const ticketId = `ticket-1`;
        const node = document.getElementById(ticketId);
        if (!node || !registration) return;

        setIsDownloading(true);

        try {
            await document.fonts.ready;
            
            const dataUrl = await htmlToImage.toPng(node, {
                pixelRatio: 3,
                useCORS: true,
                cacheBust: true,
                filter: filter
            });
            
            const pdf = new jsPDF({
                orientation: 'p',
                unit: 'px',
                format: [node.offsetWidth, node.offsetHeight]
            });
            
            pdf.addImage(dataUrl, 'PNG', 0, 0, pdf.internal.pageSize.getWidth(), pdf.internal.pageSize.getHeight());
            
            const riderName = registration.fullName;
            pdf.save(`${riderName}-ticket.pdf`);
        } catch (e) {
            console.error(e);
            toast({ variant: 'destructive', title: 'Download Failed', 'description': 'Could not download the ticket.' });
        } finally {
            setIsDownloading(false);
        }
    }


    const renderTicket = () => {
        if (!registration) return null;

        return (
            <div className="space-y-4">
                <SingleTicket id="ticket-1" registration={registration} />
                 <div className="w-full flex flex-col gap-2 pt-2">
                    <Button onClick={handleDownload} variant="outline" className="w-full" disabled={isDownloading}>
                        {isDownloading ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Download className="mr-2 h-4 w-4" />}
                        Download Ticket
                    </Button>
                </div>
            </div>
        )
    }

    return (
        <div className="flex flex-col min-h-screen bg-secondary/50">
            <Header />
            <main className="flex-grow container mx-auto p-4 md:p-8 flex items-center justify-center">
                <div className="w-full max-w-sm mx-auto space-y-4">
                    {loading && (
                        <Card className="text-center">
                           <CardContent className="p-12 flex flex-col items-center justify-center gap-4">
                                <Loader2 className="h-10 w-10 animate-spin text-primary" />
                                <p className="text-muted-foreground">Loading Ticket...</p>
                           </CardContent>
                        </Card>
                    )}
                    {error && (
                         <Card className="text-center">
                            <CardHeader>
                                <CardTitle className="flex items-center justify-center gap-2 text-destructive"><AlertTriangle /> Error</CardTitle>
                            </CardHeader>
                            <CardContent>
                               <p>{error}</p>
                            </CardContent>
                        </Card>
                    )}
                    {registration && (
                         <div className="space-y-4">
                             <Card className="bg-green-50 border-green-200 text-green-900">
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2"><CheckCircle /> Valid Registration</CardTitle>
                                    <CardDescription className="text-green-800">
                                        This is a public, shareable link for a valid ride registration.
                                    </CardDescription>
                                </CardHeader>
                                {registration.certificateGranted && (
                                     <CardContent>
                                        <Badge>
                                            <Award className="mr-2 h-4 w-4"/> Certificate Granted
                                        </Badge>
                                    </CardContent>
                                )}
                            </Card>
                             {renderTicket()}
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}
