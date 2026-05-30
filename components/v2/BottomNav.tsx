"use client";

import { CalendarDays, Home, NotebookPen, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

export type ScreenId = "start" | "journal" | "kalender" | "mehr";

const TABS: { id: ScreenId; label: string; icon: typeof Home }[] = [
  { id: "start", label: "Start", icon: Home },
  { id: "journal", label: "Journal", icon: NotebookPen },
  { id: "kalender", label: "Kalender", icon: CalendarDays },
  { id: "mehr", label: "Mehr", icon: Settings },
];

export function BottomNav({
  active,
  onChange,
}: {
  active: ScreenId;
  onChange: (id: ScreenId) => void;
}) {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-rose-100 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-md items-stretch justify-around px-2 pb-[env(safe-area-inset-bottom)]">
        {TABS.map(({ id, label, icon: Icon }) => {
          const isActive = active === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => onChange(id)}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium transition",
                isActive ? "text-rose-600" : "text-rose-400 hover:text-rose-500"
              )}
            >
              <Icon className={cn("h-5 w-5 transition", isActive && "scale-110")} strokeWidth={isActive ? 2.4 : 2} />
              {label}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
