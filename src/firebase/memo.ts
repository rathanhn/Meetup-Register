
'use client';

import { useMemo } from 'react';

// This hook is crucial for preventing infinite loops when using
// useCollection or useDoc with queries/references that are created inline.
// It stabilizes the query/reference object so it doesn't trigger a re-render
// on every component render.
export const useMemoFirebase = <T>(
  factory: () => T,
  deps: React.DependencyList
): T => {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(factory, deps);
};
