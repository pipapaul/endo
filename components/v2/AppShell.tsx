"use client";

import { useState } from "react";
import { BottomNav, type ScreenId } from "./BottomNav";
import { StartScreen } from "./screens/StartScreen";
import { JournalScreen } from "./screens/JournalScreen";
import { KalenderScreen } from "./screens/KalenderScreen";
import { MehrScreen } from "./screens/MehrScreen";
import { useData } from "@/lib/data/DataProvider";

export function AppShell() {
  const { ready } = useData();
  const [screen, setScreen] = useState<ScreenId>("start");

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col">
      <main className="flex-1 px-4 pb-24 pt-2">
        {!ready ? (
          <div className="flex h-[60vh] flex-col items-center justify-center gap-3 text-rose-400">
            <span className="h-8 w-8 animate-spin rounded-full border-2 border-rose-200 border-t-rose-500" />
            <span className="text-sm">lädt…</span>
          </div>
        ) : (
          <>
            {screen === "start" && <StartScreen />}
            {screen === "journal" && <JournalScreen />}
            {screen === "kalender" && <KalenderScreen />}
            {screen === "mehr" && <MehrScreen />}
          </>
        )}
      </main>
      <BottomNav active={screen} onChange={setScreen} />
    </div>
  );
}
