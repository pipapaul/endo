"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useState } from "react";
import type { ReactNode } from "react";

import type { DailyEntry } from "@/lib/types";
import { formatIsoWeek, getIsoWeekCalendarDates } from "@/lib/isoWeek";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { DailyEntry as AggregateDailyEntry, WeeklyStats } from "@/lib/weekly/aggregate";
import { computeWeeklyStats } from "@/lib/weekly/aggregate";
import { WeeklySummaryCard } from "./components/WeeklySummaryCard";
import { WeeklyPrompts, type PromptAnswers } from "./components/WeeklyPrompts";
import type { WeeklyDraft } from "@/lib/weekly/drafts";
import { loadWeeklyDraft, saveWeeklyDraft } from "@/lib/weekly/drafts";

type WeeklyState = {
  year: number;
  week: number;
  isoWeek: string;
  calendarDays: string[];
  dailyEntries: DailyEntry[];
  notes: string;
};

type WeeklyInitializePayload = {
  year: number;
  week: number;
  dailyEntries: DailyEntry[];
};

type WeeklyAction =
  | { type: "initialize"; payload: WeeklyInitializePayload }
  | { type: "setNotes"; payload: string };

type WeeklyProviderProps = WeeklyInitializePayload & { children: ReactNode };

const WeeklyStateContext = createContext<WeeklyState | null>(null);
const WeeklyDispatchContext = createContext<React.Dispatch<WeeklyAction> | null>(null);

function createState(payload: WeeklyInitializePayload): WeeklyState {
  const isoWeek = formatIsoWeek(payload.year, payload.week);
  return {
    year: payload.year,
    week: payload.week,
    isoWeek,
    calendarDays: getIsoWeekCalendarDates(payload.year, payload.week),
    dailyEntries: payload.dailyEntries,
    notes: "",
  };
}

function weeklyReducer(state: WeeklyState, action: WeeklyAction): WeeklyState {
  switch (action.type) {
    case "initialize": {
      const next = createState(action.payload);
      if (next.isoWeek === state.isoWeek) {
        return {
          ...state,
          year: action.payload.year,
          week: action.payload.week,
          calendarDays: next.calendarDays,
          dailyEntries: action.payload.dailyEntries,
        };
      }
      return next;
    }
    case "setNotes":
      return { ...state, notes: action.payload };
    default:
      return state;
  }
}

function createDefaultWeeklyDraft(isoWeekKey: string): WeeklyDraft {
  return {
    isoWeekKey,
    confirmedSummary: false,
    answers: { helped: [], worsened: [], nextWeekTry: [], freeText: "" },
    progress: 0,
    updatedAt: Date.now(),
  };
}

function mapBleedingSeverity(pbacScore?: number): "light" | "medium" | "strong" {
  if (typeof pbacScore !== "number") {
    return "light";
  }
  if (pbacScore >= 250) {
    return "strong";
  }
  if (pbacScore >= 100) {
    return "medium";
  }
  return "light";
}

function toAggregateDailyEntry(entry: DailyEntry): AggregateDailyEntry {
  return {
    dateISO: entry.date,
    pain0to10: typeof entry.painNRS === "number" ? entry.painNRS : undefined,
    bleeding: entry.bleeding.isBleeding ? mapBleedingSeverity(entry.bleeding.pbacScore) : "none",
    sleepQuality0to10: typeof entry.sleep?.quality === "number" ? entry.sleep.quality : undefined,
    medicationsChanged: undefined,
  };
}

export function WeeklyProvider({ children, year, week, dailyEntries }: WeeklyProviderProps) {
  const [state, dispatch] = useReducer(weeklyReducer, { year, week, dailyEntries }, createState);

  useEffect(() => {
    dispatch({ type: "initialize", payload: { year, week, dailyEntries } });
  }, [dailyEntries, week, year]);

  const stateValue = useMemo(() => state, [state]);

  return (
    <WeeklyStateContext.Provider value={stateValue}>
      <WeeklyDispatchContext.Provider value={dispatch}>{children}</WeeklyDispatchContext.Provider>
    </WeeklyStateContext.Provider>
  );
}

function useWeeklyState() {
  const context = useContext(WeeklyStateContext);
  if (!context) {
    throw new Error("useWeeklyState muss innerhalb eines WeeklyProvider verwendet werden");
  }
  return context;
}

function useWeeklyDispatch() {
  const context = useContext(WeeklyDispatchContext);
  if (!context) {
    throw new Error("useWeeklyDispatch muss innerhalb eines WeeklyProvider verwendet werden");
  }
  return context;
}

function formatDayLabel(isoDate: string): string {
  const date = new Date(`${isoDate}T00:00:00.000Z`);
  return date.toLocaleDateString("de-DE", {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
  });
}

export default function WeeklyForm(props: { year: number; week: number }): JSX.Element {
  const state = useWeeklyState();
  const dispatch = useWeeklyDispatch();

  const [weeklyDraft, setWeeklyDraft] = useState<WeeklyDraft>(() => createDefaultWeeklyDraft(state.isoWeek));
  const [draftReady, setDraftReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const baseDraft = createDefaultWeeklyDraft(state.isoWeek);
    setDraftReady(false);
    setWeeklyDraft(baseDraft);

    loadWeeklyDraft(state.isoWeek)
      .then((loaded) => {
        if (cancelled) return;
        if (loaded) {
          setWeeklyDraft({
            ...baseDraft,
            ...loaded,
            isoWeekKey: state.isoWeek,
            answers: {
              helped: loaded.answers.helped ?? baseDraft.answers.helped,
              worsened: loaded.answers.worsened ?? baseDraft.answers.worsened,
              nextWeekTry: loaded.answers.nextWeekTry ?? baseDraft.answers.nextWeekTry,
              freeText: loaded.answers.freeText ?? baseDraft.answers.freeText,
            },
          });
        }
        setDraftReady(true);
      })
      .catch((error) => {
        if (cancelled) return;
        console.error("Wochenentwurf konnte nicht geladen werden", error);
        setDraftReady(true);
      });

    return () => {
      cancelled = true;
    };
  }, [state.isoWeek]);

  useEffect(() => {
    if (!draftReady) return;
    saveWeeklyDraft({ ...weeklyDraft, isoWeekKey: state.isoWeek }).catch((error) => {
      console.error("Wochenentwurf konnte nicht gespeichert werden", error);
    });
  }, [draftReady, state.isoWeek, weeklyDraft]);

  const entriesByDate = useMemo(() => {
    const map = new Map<string, DailyEntry>();
    for (const entry of state.dailyEntries) {
      map.set(entry.date, entry);
    }
    return map;
  }, [state.dailyEntries]);

  const weeklyStats = useMemo<WeeklyStats | null>(() => {
    if (!state.calendarDays.length) return null;
    const startISO = state.calendarDays[0];
    const endISO = state.calendarDays[state.calendarDays.length - 1];
    const aggregateEntries: AggregateDailyEntry[] = state.dailyEntries.map(toAggregateDailyEntry);
    return computeWeeklyStats(aggregateEntries, startISO, endISO);
  }, [state.calendarDays, state.dailyEntries]);

  const handleConfirmChange = useCallback(
    (value: boolean) => {
      setWeeklyDraft((prev) => ({
        ...prev,
        isoWeekKey: state.isoWeek,
        confirmedSummary: value,
        updatedAt: Date.now(),
      }));
    },
    [state.isoWeek]
  );

  const handlePromptChange = useCallback(
    (next: PromptAnswers) => {
      setWeeklyDraft((prev) => ({
        ...prev,
        isoWeekKey: state.isoWeek,
        answers: {
          helped: [...next.helped],
          worsened: [...next.worsened],
          nextWeekTry: [...next.nextWeekTry],
          freeText: next.freeText ?? "",
        },
        updatedAt: Date.now(),
      }));
    },
    [state.isoWeek]
  );

  const weekRangeLabel = useMemo(() => {
    if (!state.calendarDays.length) return "";
    const first = formatDayLabel(state.calendarDays[0]);
    const last = formatDayLabel(state.calendarDays[state.calendarDays.length - 1]);
    return `${first} – ${last}`;
  }, [state.calendarDays]);

  return (
    <section className="space-y-6">
      <header className="space-y-2">
        <p className="text-sm uppercase tracking-wide text-rose-500">Wöchentliche Übersicht</p>
        <h1 className="text-3xl font-semibold text-rose-900">
          Kalenderwoche {String(props.week).padStart(2, "0")} / {props.year}
        </h1>
        {weekRangeLabel ? <p className="text-sm text-rose-900/70">{weekRangeLabel}</p> : null}
        <p className="text-sm text-rose-900/80">
          Die Tagesdaten dieser Woche werden automatisch zusammengefasst. Ergänze deine wöchentlichen Angaben und Notizen.
        </p>
      </header>

      {weeklyStats ? (
        <WeeklySummaryCard
          stats={weeklyStats}
          confirmed={weeklyDraft.confirmedSummary}
          onConfirmChange={handleConfirmChange}
        />
      ) : null}

      <WeeklyPrompts value={weeklyDraft.answers} onChange={handlePromptChange} />

      <div className="space-y-3">
        {state.calendarDays.map((isoDate) => {
          const entry = entriesByDate.get(isoDate);
          return (
            <article key={isoDate} className="rounded-lg border border-rose-200 bg-white p-4 shadow-sm">
              <header className="flex items-center justify-between">
                <h2 className="text-base font-medium text-rose-900">{formatDayLabel(isoDate)}</h2>
                <span className="text-sm text-rose-900/60">
                  {entry ? "Eintrag vorhanden" : "Kein Eintrag"}
                </span>
              </header>
              {entry ? (
                <dl className="mt-3 grid gap-1 text-sm text-rose-900/80">
                  <div className="flex items-baseline gap-2">
                    <dt className="font-medium">Schmerz-NRS:</dt>
                    <dd>{entry.painNRS}</dd>
                  </div>
                  <div className="flex items-baseline gap-2">
                    <dt className="font-medium">PBAC-Score:</dt>
                    <dd>{entry.bleeding?.pbacScore ?? "–"}</dd>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <dt className="font-medium">Symptome:</dt>
                    <dd className="flex flex-wrap gap-1">
                      {Object.entries(entry.symptoms)
                        .filter(([, value]) => Boolean(value?.present))
                        .map(([key]) => (
                          <span
                            key={key}
                            className="rounded-full bg-rose-100 px-2 py-0.5 text-xs font-medium text-rose-900"
                          >
                            {key}
                          </span>
                        ))}
                      {!Object.values(entry.symptoms).some((value) => value?.present) ? (
                        <span className="text-rose-900/60">keine aktiven Symptome</span>
                      ) : null}
                    </dd>
                  </div>
                </dl>
              ) : (
                <p className="mt-3 text-sm text-rose-900/70">Für diesen Tag liegen keine Angaben vor.</p>
              )}
            </article>
          );
        })}
      </div>

      <div className="space-y-2">
        <Label htmlFor="weekly-notes" className="text-base text-rose-900">
          Notizen zur Woche
        </Label>
        <Textarea
          id="weekly-notes"
          value={state.notes}
          onChange={(event) => dispatch({ type: "setNotes", payload: event.target.value })}
          placeholder="Zusammenfassung, Besonderheiten oder Fragen für dein nächstes Arztgespräch"
          className="min-h-[120px] bg-white text-rose-900"
        />
        <p className="text-xs text-rose-900/60">Die Notizen werden nur lokal gespeichert.</p>
      </div>
    </section>
  );
}

export { useWeeklyState, useWeeklyDispatch };
