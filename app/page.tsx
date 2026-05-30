"use client";

import { DataProvider } from "@/lib/data/DataProvider";
import { AppShell } from "@/components/v2/AppShell";

export default function HomePage() {
  return (
    <DataProvider>
      <AppShell />
    </DataProvider>
  );
}
