"use client";

import { useMemo, useState } from "react";
import { Check, ChevronRight, ListChecks } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useData } from "@/lib/data/DataProvider";
import { createEmptyDailyEntry } from "@/lib/data/factory";
import { Sheet } from "./ui";
import { QuickCheckIn } from "./QuickCheckIn";
import { visibleSections, type CheckInSection, type StepId } from "./checkin/sections";
import type { DailyEntry } from "@/lib/types";

/**
 * Compact, scannable overview of one day. Every check-in section is shown with
 * its current value; tapping a row opens just that section for editing, and the
 * footer offers a full wizard pass. This is the journal's primary interaction:
 * review a day at a glance, then amend single points as needed.
 */
export function DayDetailSheet({
  open,
  onClose,
  date,
}: {
  open: boolean;
  onClose: () => void;
  date: string;
}) {
  const { getDailyEntry, flags } = useData();
  const [editing, setEditing] = useState<StepId | null>(null);
  const [wizard, setWizard] = useState(false);

  const sections = useMemo(() => visibleSections(flags), [flags]);
  const entry = getDailyEntry(date);

  const dateLabel = useMemo(() => {
    const [y, m, dd] = date.split("-").map(Number);
    return new Date(y, m - 1, dd).toLocaleDateString("de-DE", {
      weekday: "long",
      day: "numeric",
      month: "long",
    });
  }, [date]);

  if (!open) return null;

  // While the full wizard is open, let it own the screen.
  if (wizard) {
    return (
      <QuickCheckIn
        open
        date={date}
        onClose={() => {
          setWizard(false);
          onClose();
        }}
      />
    );
  }

  return (
    <>
      <Sheet
        open={editing === null}
        onClose={onClose}
        title={<span className="capitalize">{dateLabel}</span>}
        footer={
          <Button
            type="button"
            variant="outline"
            onClick={() => setWizard(true)}
            className="w-full rounded-2xl"
          >
            <ListChecks className="mr-2 h-4 w-4" /> Alles durchgehen
          </Button>
        }
      >
        <ul className="space-y-2">
          {sections.map((section) => {
            const parts = entry ? section.summary(entry) : [];
            const filled = parts.length > 0;
            const Icon = section.icon;
            const c = section.color;
            return (
              <li key={section.id}>
                <button
                  type="button"
                  onClick={() => setEditing(section.id)}
                  className="flex w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left transition active:scale-[0.99]"
                  style={
                    filled
                      ? { borderColor: c.border, background: c.pastel }
                      : { borderColor: "rgb(255 228 230)", background: "rgba(255,255,255,0.6)" }
                  }
                >
                  <span
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
                    style={{
                      backgroundColor: filled ? "#fff" : "#fff5f6",
                      color: filled ? c.saturated : "#fda4af",
                    }}
                  >
                    <Icon className="h-5 w-5" strokeWidth={2} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span
                      className="block text-sm font-semibold"
                      style={{ color: filled ? c.saturated : "#9f1239" }}
                    >
                      {section.title}
                    </span>
                    {filled ? (
                      <span className="block truncate text-xs text-gray-600">{parts.join(" · ")}</span>
                    ) : (
                      <span className="block text-xs text-rose-300">noch nichts erfasst</span>
                    )}
                  </span>
                  <ChevronRight
                    className="h-5 w-5 shrink-0"
                    style={{ color: filled ? c.saturated : "#fda4af" }}
                  />
                </button>
              </li>
            );
          })}
        </ul>
      </Sheet>

      {editing ? (
        <SectionEditSheet
          date={date}
          section={sections.find((s) => s.id === editing)!}
          onClose={() => setEditing(null)}
        />
      ) : null}
    </>
  );
}

/** Edits a single check-in section in isolation and saves just that change. */
function SectionEditSheet({
  date,
  section,
  onClose,
}: {
  date: string;
  section: CheckInSection;
  onClose: () => void;
}) {
  const { getDailyEntry, upsertDailyEntry, flags, productSettings } = useData();
  const [draft, setDraft] = useState<DailyEntry>(
    () => getDailyEntry(date) ?? createEmptyDailyEntry(date)
  );
  const Editor = section.Editor;
  const Icon = section.icon;
  const c = section.color;
  const error = section.validate?.(draft) ?? null;

  const save = () => {
    if (error) return;
    upsertDailyEntry({ ...draft, notesFree: draft.notesFree?.trim() || undefined });
    onClose();
  };

  return (
    <Sheet
      open
      onClose={onClose}
      title={
        <span className="flex items-center gap-2" style={{ color: c.saturated }}>
          <Icon className="h-5 w-5" /> {section.title}
        </span>
      }
      footer={
        <div>
          {error ? <p className="mb-2 text-center text-xs font-medium text-red-500">{error}</p> : null}
          <Button
            type="button"
            onClick={save}
            disabled={!!error}
            className="w-full rounded-2xl py-3"
            style={{ backgroundColor: c.saturated }}
          >
            <Check className="mr-1 h-4 w-4" /> Speichern
          </Button>
        </div>
      }
    >
      <p className="mb-4 text-sm font-medium text-rose-700">{section.question}</p>
      <Editor draft={draft} setDraft={setDraft} flags={flags} productSettings={productSettings} />
    </Sheet>
  );
}
