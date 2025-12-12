
"use client";

import { useState, useRef, useEffect, useCallback } from 'react';
import jsQR from 'jsqr';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Loader2, AlertTriangle, Camera, CameraOff, UserCheck, ShieldAlert, CheckCircle, Flag, RotateCcw } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { doc, getDoc } from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';
import type { Registration, UserRole } from '@/lib/types';
import { onAuthStateChanged, type User } from 'firebase/auth';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { checkInRider, finishRider, revertCheckIn, revertFinish } from '@/app/actions';
import { Badge } from '../ui/badge';
import { Separator } from '../ui/separator';


type ScannedQrData = {
  registrationId: string;
  rider: 1 | 2;
};

export function QrScanner() {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [scannedData, setScannedData] = useState<ScannedQrData | null>(null);
  const [scannedRegistration, setScannedRegistration] = useState<Registration | null>(null);
  const [isFetching, setIsFetching] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameId = useRef<number>();
  
  const { toast } = useToast();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
        setUser(user);
        setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const fetchUserRole = async () => {
      if (user) {
        const userDoc = await getDoc(doc(db, "users", user.uid));
        if (userDoc.exists()) {
          setUserRole(userDoc.data().role as UserRole);
        }
      }
    };
    fetchUserRole();
  }, [user]);

  const canEdit = userRole === 'admin' || userRole === 'superadmin';

  const getCameraPermission = async () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setError('Camera access is not supported by your browser.');
        setHasCameraPermission(false);
        return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      setHasCameraPermission(true);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error('Error accessing camera:', err);
      setHasCameraPermission(false);
      setError('Camera permission denied. Please enable it in your browser settings.');
    }
  };
  
  const stopScan = useCallback(() => {
    setIsScanning(false);
    if (animationFrameId.current) {
      cancelAnimationFrame(animationFrameId.current);
    }
    if (videoRef.current && videoRef.current.srcObject) {
      (videoRef.current.srcObject as MediaStream).getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
  }, []);

  const handleScanResult = (result: string) => {
    // Attempt to parse as JSON for ticket data
    try {
      const data = JSON.parse(result) as ScannedQrData;
      if (data.registrationId && data.rider) {
        setScannedData(data);
        return;
      }
    } catch (e) {
      // Not a JSON object, proceed to check if it's a URL
    }

    // Check if it's a verification URL
    try {
      const url = new URL(result);
      if (url.pathname.startsWith('/ticket/')) {
        toast({
          title: "Certificate Scanned",
          description: "Opening verification page...",
        });
        window.open(result, '_blank');
        return;
      }
    } catch (e) {
       // Not a valid URL, proceed to error
    }

    // If neither format is matched
    setError("Invalid QR code. Please scan a valid ride ticket or certificate.");
  };

  const startScan = async () => {
    await getCameraPermission();
    setError(null);
    setScannedData(null);
    setScannedRegistration(null);
    setIsScanning(true);
  };

  const tick = useCallback(() => {
    if (videoRef.current && videoRef.current.readyState === videoRef.current.HAVE_ENOUGH_DATA && canvasRef.current) {
      const canvas = canvasRef.current;
      const video = videoRef.current;
      const ctx = canvas.getContext('2d');
      
      if (ctx) {
        canvas.height = video.videoHeight;
        canvas.width = video.videoWidth;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: 'dontInvert',
        });

        if (code) {
          stopScan();
          handleScanResult(code.data);
        }
      }
    }
    if (isScanning) {
        animationFrameId.current = requestAnimationFrame(tick);
    }
  }, [isScanning, stopScan]);

  useEffect(() => {
    if (isScanning) {
      animationFrameId.current = requestAnimationFrame(tick);
    }
    return () => {
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
      }
    };
  }, [isScanning, tick]);

  useEffect(() => {
    if (scannedData) {
        const fetchRegistration = async () => {
            setIsFetching(true);
            setError(null);
            try {
                const docRef = doc(db, 'registrations', scannedData.registrationId);
                const docSnap = await getDoc(docRef);
                if (docSnap.exists()) {
                    setScannedRegistration({ id: docSnap.id, ...docSnap.data() } as Registration);
                } else {
                    setError('Registration not found.');
                }
            } catch (err) {
                setError('Failed to fetch registration data.');
            } finally {
                setIsFetching(false);
            }
        };
        fetchRegistration();
    }
  }, [scannedData]);
  
  const handleCheckIn = async () => {
    if (!scannedData || !scannedRegistration || !user) return;
    setIsProcessing(true);
    const result = await checkInRider({
        registrationId: scannedData.registrationId,
        adminId: user.uid,
    });
    if (result.success) {
        toast({
            title: "Success",
            description: result.message,
            action: <UserCheck className="text-primary" />,
        });
        setScannedRegistration(null); // Close dialog
    } else {
        toast({ variant: 'destructive', title: 'Error', description: result.message });
    }
    setIsProcessing(false);
  }

  const handleFinish = async () => {
    if (!scannedData || !scannedRegistration || !user) return;
    setIsProcessing(true);
    const result = await finishRider({
        registrationId: scannedData.registrationId,
        adminId: user.uid,
    });
    if (result.success) {
        toast({
            title: "Success!",
            description: result.message,
            action: <Flag className="text-primary" />,
        });
        setScannedRegistration(null); // Close dialog
    } else {
        toast({ variant: 'destructive', title: 'Error', description: result.message });
    }
    setIsProcessing(false);
  }

  const handleRevertCheckIn = async () => {
    if (!scannedData || !scannedRegistration || !user) return;
    setIsProcessing(true);
    const result = await revertCheckIn({
        registrationId: scannedData.registrationId,
        adminId: user.uid,
    });
    if (result.success) {
        toast({ title: "Success", description: result.message });
        setScannedRegistration(null);
    } else {
        toast({ variant: 'destructive', title: 'Error', description: result.message });
    }
    setIsProcessing(false);
  }
  
  const handleRevertFinish = async () => {
    if (!scannedData || !scannedRegistration || !user) return;
    setIsProcessing(true);
    const result = await revertFinish({
        registrationId: scannedData.registrationId,
        adminId: user.uid,
    });
    if (result.success) {
        toast({ title: "Success", description: result.message });
        setScannedRegistration(null);
    } else {
        toast({ variant: 'destructive', title: 'Error', description: result.message });
    }
    setIsProcessing(false);
  }

  const riderIsCheckedIn = scannedRegistration?.rider1CheckedIn;
  const riderIsFinished = scannedRegistration?.rider1Finished;


  if (authLoading) {
    return <Loader2 className="h-6 w-6 animate-spin mx-auto" />
  }

  if (!canEdit) {
     return (
      <div className="text-muted-foreground flex items-center justify-center gap-2 p-4 bg-secondary rounded-md h-full">
        <ShieldAlert className="h-5 w-5" />
        <p>You do not have permission to use the scanner.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
        {!isScanning ? (
            <Button onClick={startScan} className="w-full">
                <Camera className="mr-2 h-4 w-4" /> Start Scanning
            </Button>
        ) : (
            <Button onClick={stopScan} variant="outline" className="w-full">
                <CameraOff className="mr-2 h-4 w-4" /> Stop Scanning
            </Button>
        )}

        <div className="relative w-full max-w-sm mx-auto aspect-square bg-muted rounded-md overflow-hidden flex items-center justify-center">
            <video ref={videoRef} className="w-full h-full object-cover" autoPlay muted playsInline />
            <canvas ref={canvasRef} className="hidden" />
            {isScanning && (
                <div className="absolute inset-0 border-8 border-primary/50 rounded-md animate-pulse" />
            )}
             {hasCameraPermission === false && !isScanning && (
                <div className="text-muted-foreground text-center p-4">
                    <CameraOff className="h-10 w-10 mx-auto mb-2" />
                    <p>Camera not available</p>
                </div>
            )}
        </div>
        
        {error && <Alert variant="destructive"><AlertTriangle className="h-4 w-4" /><AlertTitle>Scan Error</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>}

        <AlertDialog open={!!scannedRegistration && !isFetching} onOpenChange={() => { setScannedRegistration(null); setScannedData(null); }}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Rider Details & Actions</AlertDialogTitle>
                    <AlertDialogDescription>
                        {scannedRegistration?.status !== 'approved' && <Badge variant="destructive" className="mb-2">Registration Not Approved!</Badge>}
                        Verify rider information and perform an action.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                {isFetching ? (
                    <Loader2 className="h-8 w-8 animate-spin mx-auto" />
                ) : scannedRegistration && (
                    <div className="space-y-4 text-sm">
                        <div>
                            <p><strong>Name:</strong> {scannedRegistration.fullName}</p>
                            <p><strong>Age:</strong> {scannedRegistration.age}</p>
                            <p><strong>Phone:</strong> {scannedRegistration.phoneNumber}</p>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                             <div><strong>Checked-in:</strong> {riderIsCheckedIn ? <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"><CheckCircle className="mr-1 h-3 w-3" />Yes</Badge> : <Badge variant="secondary">No</Badge>}</div>
                             <div><strong>Finished:</strong> {riderIsFinished ? <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"><CheckCircle className="mr-1 h-3 w-3" />Yes</Badge> : <Badge variant="secondary">No</Badge>}</div>
                        </div>
                    </div>
                )}
                <Separator />
                 <AlertDialogFooter className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                     <Button variant="outline" onClick={() => setScannedRegistration(null)}>Cancel</Button>
                    
                     {!riderIsCheckedIn ? (
                        <Button 
                            onClick={handleCheckIn} 
                            disabled={isProcessing || scannedRegistration?.status !== 'approved' || !canEdit}
                            className="bg-green-600 hover:bg-green-700"
                        >
                            {isProcessing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Check-In
                        </Button>
                     ) : (
                        <Button 
                            onClick={handleRevertCheckIn} 
                            disabled={isProcessing || !canEdit}
                            variant="destructive"
                        >
                            {isProcessing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                             <RotateCcw className="mr-2 h-4 w-4" />
                            Revert Check-In
                        </Button>
                     )}

                     {!riderIsFinished ? (
                        <Button 
                            onClick={handleFinish} 
                            disabled={isProcessing || !riderIsCheckedIn || scannedRegistration?.status !== 'approved' || !canEdit}
                        >
                            {isProcessing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Mark as Finished
                        </Button>
                     ) : (
                        <Button 
                            onClick={handleRevertFinish} 
                            disabled={isProcessing || !canEdit}
                            variant="destructive"
                        >
                            {isProcessing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                             <RotateCcw className="mr-2 h-4 w-4" />
                            Revert Finish
                        </Button>
                     )}
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    </div>
  );
}
