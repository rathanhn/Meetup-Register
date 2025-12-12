
'use client';

import { useState, useEffect } from 'react';
import {
  type DocumentData,
  type Query,
  onSnapshot,
  QuerySnapshot,
} from 'firebase/firestore';
import { errorEmitter } from '../error-emitter';
import { FirestorePermissionError } from '../errors';

// A modified version of react-firebase-hooks' useCollection
// that integrates with our custom error handling architecture.

export const useCollection = <T extends DocumentData>(query: Query<T> | null) => {
  const [data, setData] = useState<T[] | undefined>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | undefined>();

  useEffect(() => {
    if (!query) {
      setData(undefined);
      setLoading(false);
      setError(undefined);
      return;
    }

    setLoading(true);

    const unsubscribe = onSnapshot(
      query,
      (snapshot: QuerySnapshot<T>) => {
        const docs = snapshot.docs.map(
          (doc) => ({ id: doc.id, ...doc.data() } as T)
        );
        setData(docs);
        setLoading(false);
        setError(undefined);
      },
      async (err) => {
        const permissionError = new FirestorePermissionError({
          path: query.path,
          operation: 'list',
        });
        errorEmitter.emit('permission-error', permissionError);
        setError(permissionError);
        setLoading(false);
      }
    );

    return () => {
      unsubscribe();
    };
  }, [query]);

  return { data, loading, error };
};
