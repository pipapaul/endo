"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useState,
} from "react";
import type { ReactNode } from "react";

import { hasBleedingForEntry } from "@/lib/dailyEntries";
import type { DailyEntry } from "@/lib/types";
import { formatIsoWeek, getIsoWeekCalendarDates } from "@/lib/isoWeek";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { DailyEntry as AggregateDailyEntry, WeeklyStats } from "@/lib/weekly/aggregate";
import { computeWeeklyStats } from "@/lib/weekly/aggregate";
import { WeeklySummaryCard } from "./components/WeeklySummaryCard";
import { WeeklyPrompts, type PromptAnswers } from "./components/WeeklyPrompts";
import type { WeeklyDraft } from "@/lib/weekly/drafts";
import { deleteWeeklyDraft, loadWeeklyDraft, saveWeeklyDraft } from "@/lib/weekly/drafts";
import { Stepper } from "./components/Stepper";
import { Button } from "@/components/ui/button";
import BackButton from "@/components/ui/back-button";
import { useRouter } from "next/navigation";
import { storeWeeklyReport } from "@/lib/weekly/reports";
import InfoTip from "@/components/InfoTip";
import {
  DEFAULT_WPAI,
  normalizeWpai,
  WPAI_CARD_TOOLTIP,
  WPAI_FIELD_DEFINITIONS,
} from "@/lib/weekly/wpai";

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
    answers: { helped: [], worsened: [], nextWeekTry: [], freeText: "", wpai: { ...DEFAULT_WPAI } },
    progress: 1,
    updatedAt: Date.now(),
  };
}

type Step = 1 | 2 | 3;

function normalizeStep(progress: WeeklyDraft["progress"]): Step {
  if (progress === 2) return 2;
  if (progress === 3) return 3;
  return 1;
}

function clampScore(value: number | undefined): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }
  return Math.max(0, Math.min(10, Math.round(value)));
}

type PromptListKey = "helped" | "worsened" | "nextWeekTry";

const REVIEW_SECTIONS: Array<{ key: PromptListKey; title: string }> = [
  { key: "helped", title: "Was hat geholfen?" },
  { key: "worsened", title: "Was hat verschlechtert?" },
  { key: "nextWeekTry", title: "Was probiere ich nächste Woche?" },
];

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

function deriveMaxPain(entry: DailyEntry): number | undefined {
  const values: number[] = [];

  const overallPain = clampScore(entry.painNRS);
  if (overallPain !== null) {
    values.push(overallPain);
  }

  (entry.painRegions ?? []).forEach((region) => {
    const score = clampScore(region?.nrs);
    if (score !== null) {
      values.push(score);
    }
  });

  (entry.quickPainEvents ?? []).forEach((event) => {
    const score = clampScore(event?.intensity);
    if (score !== null) {
      values.push(score);
    }
  });

  return values.length ? Math.max(...values) : undefined;
}

function toAggregateDailyEntry(entry: DailyEntry): AggregateDailyEntry {
  const bleedingActive = hasBleedingForEntry(entry);
  return {
    dateISO: entry.date,
    pain0to10: deriveMaxPain(entry),
    bleeding: bleedingActive ? mapBleedingSeverity(entry.bleeding.pbacScore) : "none",
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
  const router = useRouter();

  const [weeklyDraft, setWeeklyDraft] = useState<WeeklyDraft>(() => createDefaultWeeklyDraft(state.isoWeek));
  const [draftReady, setDraftReady] = useState(false);
  const [activeStep, setActiveStep] = useState<Step>(() => normalizeStep(weeklyDraft.progress));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const baseDraft = createDefaultWeeklyDraft(state.isoWeek);
    setDraftReady(false);
    setWeeklyDraft(baseDraft);
    setActiveStep(normalizeStep(baseDraft.progress));
    setSubmitError(null);

    loadWeeklyDraft(state.isoWeek)
      .then((loaded) => {
        if (cancelled) return;
        if (loaded) {
          const normalizedProgress = normalizeStep(loaded.progress ?? baseDraft.progress);
          setWeeklyDraft({
            ...baseDraft,
            ...loaded,
            isoWeekKey: state.isoWeek,
            answers: {
              helped: loaded.answers.helped ?? baseDraft.answers.helped,
              worsened: loaded.answers.worsened ?? baseDraft.answers.worsened,
              nextWeekTry: loaded.answers.nextWeekTry ?? baseDraft.answers.nextWeekTry,
              freeText: loaded.answers.freeText ?? baseDraft.answers.freeText,
              wpai: normalizeWpai(loaded.answers.wpai, baseDraft.answers.wpai),
            },
            progress: normalizedProgress,
          });
          setActiveStep(normalizedProgress);
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
          wpai: normalizeWpai(next.wpai, prev.answers.wpai),
        },
        updatedAt: Date.now(),
      }));
    },
    [state.isoWeek]
  );

  const handleStepChange = useCallback(
    (step: Step) => {
      if (isSubmitting) return;
      setActiveStep((current) => (current === step ? current : step));
      setSubmitError(null);
      setWeeklyDraft((prev) => {
        if (prev.progress === step && prev.isoWeekKey === state.isoWeek) {
          return prev;
        }
        return {
          ...prev,
          isoWeekKey: state.isoWeek,
          progress: step,
          updatedAt: Date.now(),
        };
      });
    },
    [isSubmitting, state.isoWeek]
  );

  const handleCancel = useCallback(() => {
    router.push("/");
  }, [router]);

  const reviewAnswers = useMemo(
    () => ({
      helped: Array.isArray(weeklyDraft.answers.helped) ? [...weeklyDraft.answers.helped] : [],
      worsened: Array.isArray(weeklyDraft.answers.worsened) ? [...weeklyDraft.answers.worsened] : [],
      nextWeekTry: Array.isArray(weeklyDraft.answers.nextWeekTry) ? [...weeklyDraft.answers.nextWeekTry] : [],
      freeText: weeklyDraft.answers.freeText ?? "",
      wpai: normalizeWpai(weeklyDraft.answers.wpai),
    }),
    [weeklyDraft.answers]
  );

  const handleSubmit = useCallback(async () => {
    if (!weeklyStats) return;

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      await storeWeeklyReport({
        isoWeekKey: state.isoWeek,
        stats: weeklyStats,
        answers: {
          helped: [...reviewAnswers.helped],
          worsened: [...reviewAnswers.worsened],
          nextWeekTry: [...reviewAnswers.nextWeekTry],
          freeText: reviewAnswers.freeText,
          wpai: { ...reviewAnswers.wpai },
        },
        submittedAt: Date.now(),
      });
      await deleteWeeklyDraft(state.isoWeek);
      router.push(`/weekly/danke?year=${state.year}&week=${state.week}`);
    } catch (error) {
      console.error("Wöchentlicher Bericht konnte nicht gespeichert werden", error);
      setSubmitError("Bitte versuche es später erneut.");
    } finally {
      setIsSubmitting(false);
    }
  }, [reviewAnswers, router, state.isoWeek, state.week, state.year, weeklyStats]);

  const weekRangeLabel = useMemo(() => {
    if (!state.calendarDays.length) return "";
    const first = formatDayLabel(state.calendarDays[0]);
    const last = formatDayLabel(state.calendarDays[state.calendarDays.length - 1]);
    return `${first} – ${last}`;
  }, [state.calendarDays]);

  const canSubmit = Boolean(weeklyStats && weeklyDraft.confirmedSummary);

  let stepContent: JSX.Element;

  if (activeStep === 1) {
    stepContent = (
      <div className="space-y-6">
        <p className="text-sm text-rose-900/70">
          Bitte bestätige die automatisch erstellte Wochenübersicht. Du kannst Werte jederzeit korrigieren.
        </p>
        {weeklyStats ? (
          <WeeklySummaryCard
            stats={weeklyStats}
            confirmed={weeklyDraft.confirmedSummary}
            onConfirmChange={handleConfirmChange}
          />
        ) : (
          <p className="text-sm text-rose-900/70">
            Für diese Woche konnten keine zusammengefassten Werte berechnet werden.
          </p>
        )}

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

        <div className="flex flex-wrap items-center justify-between gap-3">
          <Button type="button" variant="ghost" onClick={handleCancel}>
            Abbrechen
          </Button>
          <div className="flex gap-3">
            <Button type="button" onClick={() => handleStepChange(2)}>
              Weiter zu Leitfragen
            </Button>
          </div>
        </div>
      </div>
    );
  } else if (activeStep === 2) {
    stepContent = (
      <div className="space-y-6">
        <WeeklyPrompts value={weeklyDraft.answers} onChange={handlePromptChange} />

        <div className="flex flex-wrap items-center justify-between gap-3">
          <Button type="button" variant="ghost" onClick={handleCancel}>
            Abbrechen
          </Button>
          <div className="flex gap-3">
            <BackButton type="button" onClick={() => handleStepChange(1)}>
              Zurück zur Zusammenfassung
            </BackButton>
            <Button type="button" onClick={() => handleStepChange(3)}>
              Weiter zum Prüfen
            </Button>
          </div>
        </div>
      </div>
    );
  } else {
    stepContent = (
      <div className="space-y-6">
        <header className="space-y-1">
          <h2 className="text-xl font-semibold text-rose-900">Überprüfen und Absenden</h2>
          <p className="text-sm text-rose-900/70">
            Kontrolliere deine Angaben bevor du sie absendest. Du kannst jederzeit einen Schritt zurückgehen.
          </p>
        </header>

        <p className="text-sm text-rose-900/70">
          Bitte bestätige die automatisch erstellte Wochenübersicht. Du kannst Werte jederzeit korrigieren.
        </p>

        {weeklyStats ? (
          <WeeklySummaryCard
            stats={weeklyStats}
            confirmed={weeklyDraft.confirmedSummary}
            onConfirmChange={handleConfirmChange}
          />
        ) : (
          <p className="text-sm text-rose-900/70">
            Für diese Woche konnten keine zusammengefassten Werte berechnet werden.
          </p>
        )}

        <div className="space-y-4 rounded-xl border border-rose-100 bg-white/80 p-4 shadow-sm">
          <h3 className="text-lg font-semibold text-rose-900">Ausgewählte Leitfragen</h3>
          {REVIEW_SECTIONS.map((section) => {
            const items = reviewAnswers[section.key];
            return (
              <div key={section.key} className="space-y-2">
                <p className="text-sm font-medium text-rose-900">{section.title}</p>
                {items.length > 0 ? (
                  <ul className="flex flex-wrap gap-2">
                    {items.map((item) => (
                      <li key={item} className="rounded-full bg-rose-100 px-3 py-1 text-sm text-rose-900">
                        {item}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-rose-900/60">Keine Angaben gespeichert.</p>
                )}
              </div>
            );
          })}
          {reviewAnswers.freeText ? (
            <div className="space-y-2">
              <p className="text-sm font-medium text-rose-900">Weitere Gedanken</p>
              <p className="whitespace-pre-line text-sm text-rose-900/80">{reviewAnswers.freeText}</p>
            </div>
          ) : null}
        </div>

        <div className="space-y-4 rounded-xl border border-rose-100 bg-white/80 p-4 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <h3 className="text-lg font-semibold text-rose-900">WPAI – 7-Tage-Rückblick</h3>
            <InfoTip tech={WPAI_CARD_TOOLTIP.tech} help={WPAI_CARD_TOOLTIP.help} />
          </div>
          <dl className="space-y-3">
            {WPAI_FIELD_DEFINITIONS.map((field) => {
              const value = reviewAnswers.wpai[field.key];
              return (
                <div key={field.key} className="space-y-1">
                  <dt className="flex items-center gap-2 text-sm font-medium text-rose-900">
                    {field.label}
                    <InfoTip tech={field.label} help={field.tooltip} />
                  </dt>
                  <dd className="text-sm text-rose-900/80">
                    <span className="font-semibold text-rose-900">{value} %</span>
                    <span className="ml-2 text-rose-900/60">{field.description}</span>
                  </dd>
                </div>
              );
            })}
          </dl>
        </div>

        <div className="space-y-2 rounded-xl border border-rose-100 bg-white/80 p-4 shadow-sm">
          <h3 className="text-lg font-semibold text-rose-900">Notizen zur Woche</h3>
          {state.notes ? (
            <p className="whitespace-pre-line text-sm text-rose-900/80">{state.notes}</p>
          ) : (
            <p className="text-sm text-rose-900/60">Keine zusätzlichen Notizen erfasst.</p>
          )}
        </div>

        {!weeklyDraft.confirmedSummary ? (
          <p className="text-sm text-rose-900">
            Bitte bestätige die automatisch erstellte Wochenübersicht im ersten Schritt, bevor du absendest.
          </p>
        ) : null}
        {submitError ? (
          <p className="text-sm text-rose-900">
            Absenden fehlgeschlagen: <span className="font-medium">{submitError}</span>
          </p>
        ) : null}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <Button type="button" variant="ghost" onClick={handleCancel} disabled={isSubmitting}>
            Abbrechen
          </Button>
          <div className="flex gap-3">
            <BackButton type="button" onClick={() => handleStepChange(2)} disabled={isSubmitting}>
              Zurück zu den Leitfragen
            </BackButton>
            <Button type="button" onClick={handleSubmit} disabled={!canSubmit || isSubmitting}>
              {isSubmitting ? "Wird gesendet …" : "Absenden"}
            </Button>
          </div>
        </div>
      </div>
    );
  }

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

      <Stepper current={activeStep} onStepChange={handleStepChange} />

      {stepContent}
    </section>
  );
}

export { useWeeklyState, useWeeklyDispatch };
