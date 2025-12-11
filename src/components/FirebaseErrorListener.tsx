
'use client';

import { useEffect } from 'react';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '@/lib/firebase';

export function FirebaseErrorListener() {
    const [user] = useAuthState(auth);

    useEffect(() => {
        const handler = (error: FirestorePermissionError) => {
            const enhancedError = new Error(
                `FirestoreError: Missing or insufficient permissions: The following request was denied by Firestore Security Rules:\n${JSON.stringify(
                    {
                        auth: user
                            ? {
                                  uid: user.uid,
                                  email: user.email,
                                  displayName: user.displayName,
                              }
                            : null,
                        ...error.context,
                    },
                    null,
                    2
                )}`
            );
            
            // This will be caught by Next.js's development error overlay
            throw enhancedError;
        };

        errorEmitter.on('permission-error', handler);

        return () => {
            errorEmitter.off('permission-error', handler);
        };
    }, [user]);

    return null;
}
