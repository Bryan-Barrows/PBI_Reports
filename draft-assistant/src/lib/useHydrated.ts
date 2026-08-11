"use client";

import { useEffect, useState } from "react";
import { useAppStore } from "./store";

// The store uses skipHydration so Next.js doesn't try to read localStorage
// during server rendering (which would mismatch). Call this once from any
// client page that needs the persisted state before rendering it.
export function useHydrated(): boolean {
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    useAppStore.persist.rehydrate()?.then(() => setHydrated(true));
  }, []);

  return hydrated;
}
