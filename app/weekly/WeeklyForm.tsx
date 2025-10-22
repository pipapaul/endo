"use client";

import { createContext, useContext, useEffect, useMemo, useReducer } from "react";
import type { ReactNode } from "react";

import type { DailyEntry } from "@/lib/types";
import { formatIsoWeek, getIsoWeekCalendarDates } from "@/lib/isoWeek";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

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

  const entriesByDate = useMemo(() => {
    const map = new Map<string, DailyEntry>();
    for (const entry of state.dailyEntries) {
      map.set(entry.date, entry);
    }
    return map;
  }, [state.dailyEntries]);

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
