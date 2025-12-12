
'use client';

import { useState, useEffect } from 'react';
import {
  type DocumentData,
  type DocumentReference,
  onSnapshot,
  DocumentSnapshot,
} from 'firebase/firestore';
import { errorEmitter } from '../error-emitter';
import { FirestorePermissionError } from '../errors';

// A modified version of react-firebase-hooks' useDocument
// that integrates with our custom error handling architecture.

export const useDoc = <T extends DocumentData>(ref: DocumentReference<T> | null) => {
  const [data, setData] = useState<T | undefined>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | undefined>();

  useEffect(() => {
    if (!ref) {
      setData(undefined);
      setLoading(false);
      setError(undefined);
      return;
    }
    setLoading(true);

    const unsubscribe = onSnapshot(
      ref,
      (snapshot: DocumentSnapshot<T>) => {
        if (snapshot.exists()) {
          setData({ id: snapshot.id, ...snapshot.data() } as T);
        } else {
          setData(undefined);
        }
        setLoading(false);
        setError(undefined);
      },
      async (err) => {
        const permissionError = new FirestorePermissionError({
          path: ref.path,
          operation: 'get',
        });
        errorEmitter.emit('permission-error', permissionError);
        setError(permissionError);
        setLoading(false);
      }
    );

    return () => {
      unsubscribe();
    };
  }, [ref]);

  return { data, loading, error };
};
