import { initializeApp, getApps, getApp, cert, type ServiceAccount } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

const serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;

if (!getApps().length) {
    if (serviceAccountKey) {
        try {
            const serviceAccount = JSON.parse(serviceAccountKey) as ServiceAccount;
            console.log("Firebase Admin: Parsing service account key successful. Project ID:", (serviceAccount as any).project_id);
            initializeApp({
                credential: cert(serviceAccount),
                // Replace with your bucket if needed, or load from env
                storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "meetup-register-35fb2.firebasestorage.app"
            });
            console.log("Firebase Admin: Initialized successfully with service account.");
        } catch (e) {
            console.error("Failed to parse FIREBASE_SERVICE_ACCOUNT_KEY");
            if (e instanceof Error) console.error(e.message);
            // Fallback or re-throw? 
            // If we can't auth, admin actions won't work.
            // Try default init in case they used GOOGLE_APPLICATION_CREDENTIALS
            try {
                console.log("Firebase Admin: Attempting default initialization...");
                initializeApp();
                console.log("Firebase Admin: Initialized with default credentials.");
            } catch (initError) {
                console.error("Failed to initialize firebase-admin with default credentials too.", initError);
            }
        }
    } else {
        // Fallback to application default (e.g. GOOGLE_APPLICATION_CREDENTIALS)
        try {
            initializeApp();
        } catch (e) {
            console.warn("Firebase Admin initialized without explicit credentials. Expect failures if no implicit credentials found.");
        }
    }
}

export const adminDb = getFirestore();
export const adminAuth = getAuth();
