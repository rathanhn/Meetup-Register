
'use client';

import { useEffect, useState } from 'react';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { auth } from '@/lib/firebase';

export function FirebaseErrorListener() {
    const [user, setUser] = useState<User | null>(null);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            setUser(user);
        });
        return () => unsubscribe();
    }, []);

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
