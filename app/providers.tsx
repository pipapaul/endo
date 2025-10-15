"use client";

import { useEffect } from "react";

import { EndoDataProvider } from "@/lib/hooks/useEndoData";

export function Providers({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch((error) => {
        console.warn("Service Worker Registrierung fehlgeschlagen", error);
      });
    }
  }, []);

  return <EndoDataProvider>{children}</EndoDataProvider>;
}
