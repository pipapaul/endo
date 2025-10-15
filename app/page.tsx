"use client";

import { useEffect, useMemo, useState } from "react";
import { useMachine } from "@xstate/react";
import { nanoid } from "nanoid";
import { CalendarIcon, CheckCircle2, FileText, HomeIcon, ListChecks } from "lucide-react";

import { BodyMapSimple } from "@/components/BodyMapSimple";
import { BristolCards } from "@/components/BristolCards";
import { ConsentDialog } from "@/components/ConsentDialog";
import { ExportPdf } from "@/components/ExportPdf";
import { MedicationQuick } from "@/components/MedicationQuick";
import { NrsSlider } from "@/components/NrsSlider";
import { PbacMini } from "@/components/PbacMini";
import { SleepScale } from "@/components/SleepScale";
import { SymptomPicker } from "@/components/SymptomPicker";
import { Tooltip } from "@/components/Tooltip";
import { TrendCharts } from "@/components/TrendCharts";
import microcopy from "@/lib/i18n/de.json";
import { useEndoData } from "@/lib/hooks/useEndoData";
import { entryFlowMachine } from "@/lib/state/entryFlowMachine";
import type { BodyZoneId, DayEntry, FlowMode, Nrs } from "@/lib/types";
import { validateDayEntry } from "@/lib/validation";

const tabs = [
  { id: "today", label: "Heute", icon: HomeIcon },
  { id: "history", label: "Verlauf", icon: CalendarIcon },
  { id: "entries", label: "Einträge", icon: ListChecks },
  { id: "export", label: "Export", icon: FileText },
] as const;

export default function HomePage() {
  const {
    dayEntries,
    monthEntries,
    saveDayEntry,
    saveMonthEntry,
    settings,
    updateSettings,
    lockedDayEntries,
    panicClear,
  } = useEndoData();
  const [tab, setTab] = useState<(typeof tabs)[number]["id"]>("today");
  const [mode, setMode] = useState<FlowMode>(settings?.quickMode ? "quick" : "detail");
  const [showConsent, setShowConsent] = useState(false);
  const [state, send] = useMachine(entryFlowMachine);

  useEffect(() => {
    const last = dayEntries[0];
    send({ type: "START", mode, lastSubmitted: last });
  }, [dayEntries, mode, send]);

  const steps = state.context.steps;
  const currentStep = steps[state.context.currentIndex];
  const answers = state.context.answers as Partial<DayEntry>;
  const progress = steps.length > 1 ? (state.context.currentIndex / (steps.length - 1)) * 100 : 0;

  const todayIso = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const handleAnswer = <K extends keyof DayEntry>(field: K, value: DayEntry[K]) => {
    send({ type: "ANSWER", field, value });
  };

  const handleSubmit = async () => {
    const entry: DayEntry = {
      id: (answers.id as string) ?? nanoid(),
      date: (answers.date as string) ?? todayIso,
      mode: (state.context.mode === "quick" || state.context.mode === "detail" ? state.context.mode : "quick"),
      nrs: answers.nrs as Nrs | undefined,
      pbac: answers.pbac as DayEntry["pbac"],
      zones: (answers.zones as DayEntry["zones"]) ?? [],
      symptoms: (answers.symptoms as DayEntry["symptoms"]) ?? [],
      medication: (answers.medication as DayEntry["medication"]) ?? [],
      sleep: answers.sleep as Nrs | undefined,
      bowel: answers.bowel as DayEntry["bowel"],
      bladder: answers.bladder as DayEntry["bladder"],
      triggerTags: answers.triggerTags as string[] | undefined,
      helped: answers.helped as string[] | undefined,
      notes: answers.notes as string | undefined,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const issues = validateDayEntry(entry);
    if (issues.length) {
      alert(`Bitte prüfen: ${issues[0].message}`);
      return;
    }

    await saveDayEntry(entry);

    if (entry.pbac?.dayScore) {
      const monthKey = entry.date.slice(0, 7);
      const existing = monthEntries.find((item) => item.month === monthKey);
      await saveMonthEntry({
        id: existing?.id ?? nanoid(),
        month: monthKey,
        pbacTotal: (existing?.pbacTotal ?? 0) + entry.pbac.dayScore,
        ehp5: existing?.ehp5,
        createdAt: existing?.createdAt ?? Date.now(),
        updatedAt: existing?.updatedAt ?? Date.now(),
      });
    }

    send({ type: "RESET" });
    send({ type: "START", mode, lastSubmitted: entry });
  };

  const quickActions = (
    <div className="mt-4 flex flex-wrap gap-2">
      <button
        type="button"
        onClick={() => send({ type: "APPLY_TEMPLATE", template: "yesterday", entry: dayEntries[0] })}
        className="rounded-full border border-rose-200 bg-white px-3 py-1.5 text-sm font-semibold text-rose-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400"
      >
        {microcopy.btn_like_yesterday}
      </button>
      <button
        type="button"
        onClick={() => send({ type: "APPLY_TEMPLATE", template: "pain_bleed" })}
        className="rounded-full border border-rose-200 bg-white px-3 py-1.5 text-sm font-semibold text-rose-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400"
      >
        {microcopy.btn_quick_only}
      </button>
      <button
        type="button"
        onClick={() => send({ type: "APPLY_TEMPLATE", template: "symptom_free" })}
        className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-sm font-semibold text-emerald-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
      >
        {microcopy.btn_symptom_free}
      </button>
    </div>
  );

  const todayContent = (
    <div className="mx-auto w-full max-w-xl space-y-6 pb-32">
      <header className="rounded-3xl bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-slate-500">{todayIso}</p>
            <h1 className="text-2xl font-semibold">{microcopy.today_title}</h1>
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <span>Schnellmodus</span>
            <input
              type="checkbox"
              checked={mode === "quick"}
              onChange={(event) => {
                const nextMode: FlowMode = event.target.checked ? "quick" : "detail";
                setMode(nextMode);
                updateSettings({ quickMode: event.target.checked });
                send({ type: "SET_MODE", mode: nextMode });
              }}
              className="h-5 w-10 rounded-full bg-rose-200 accent-rose-500"
            />
          </label>
        </div>
        {quickActions}
        <div className="mt-4 flex items-center justify-between">
          <span className="text-sm text-slate-600">Fortschritt</span>
          <div className="flex items-center gap-1">
            {steps.map((step, index) => (
              <span
                key={step.id}
                className={`h-2 w-2 rounded-full ${index <= state.context.currentIndex ? "bg-rose-500" : "bg-rose-200"}`}
              />
            ))}
          </div>
        </div>
        <div className="mt-2 h-2 w-full rounded-full bg-rose-100">
          <div className="h-2 rounded-full bg-rose-500" style={{ width: `${progress}%` }} />
        </div>
      </header>
      <WizardStep
        stepId={currentStep?.id}
        answers={answers}
        onAnswer={handleAnswer}
        mode={mode}
      />
      <div className="sticky bottom-0 z-20 -mx-4 bg-gradient-to-t from-rose-50 via-rose-50/95 to-transparent px-4 pb-6 pt-4">
        <div className="mx-auto flex w-full max-w-xl items-center gap-3">
          <button
            type="button"
            onClick={() => send({ type: "PREV" })}
            className="flex-1 rounded-full border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400"
            disabled={state.context.currentIndex === 0}
          >
            Zurück
          </button>
          <button
            type="button"
            onClick={currentStep?.id === "summary" ? handleSubmit : () => send({ type: "NEXT" })}
            className="flex-1 rounded-full bg-rose-500 px-4 py-3 text-sm font-semibold text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400"
          >
            {currentStep?.id === "summary" ? "Speichern" : "Weiter"}
          </button>
        </div>
      </div>
    </div>
  );

  const historyContent = (
    <div className="mx-auto w-full max-w-4xl space-y-6 pb-24">
      <TrendCharts dayEntries={dayEntries} monthEntries={monthEntries} />
    </div>
  );

  const entriesContent = (
    <div className="mx-auto w-full max-w-2xl space-y-4 pb-24">
      <section className="rounded-3xl bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold">Einträge</h2>
        {lockedDayEntries ? (
          <p className="mt-2 text-sm text-rose-600">
            {lockedDayEntries} Einträge sind verschlüsselt. Bitte mit deinem PIN entsperren.
          </p>
        ) : null}
        <ul className="mt-4 space-y-3">
          {dayEntries.slice(0, 30).map((entry) => (
            <li key={entry.id} className="rounded-2xl border border-slate-100 p-4">
              <div className="flex items-center justify-between text-sm text-slate-600">
                <span>{entry.date}</span>
                <span>NRS {entry.nrs ?? "–"}</span>
              </div>
              <div className="mt-2 text-sm text-slate-700">
                PBAC: {entry.pbac?.dayScore ?? 0} · {entry.symptoms?.map((symptom) => symptom.label).join(", ") || "keine"}
              </div>
              {entry.notes ? <p className="mt-2 text-sm text-slate-600">Notiz: {entry.notes}</p> : null}
            </li>
          ))}
        </ul>
      </section>
      <section className="rounded-3xl bg-white p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-700">Daten & Schutz</h3>
        <p className="mt-2 text-sm text-slate-600">{microcopy.privacy_local}</p>
        <p className="text-sm text-slate-600">{microcopy.privacy_lock}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setShowConsent(true)}
            className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400"
          >
            FSFI freischalten
          </button>
          {settings?.fsfiOptIn ? (
            <span className="inline-flex items-center rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
              Aktiv
            </span>
          ) : null}
        </div>
        <button
          type="button"
          onClick={panicClear}
          className="mt-4 rounded-full border border-rose-300 px-4 py-2 text-sm font-semibold text-rose-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400"
        >
          Alles löschen (Panik)
        </button>
      </section>
    </div>
  );

  const exportContent = (
    <div className="mx-auto w-full max-w-2xl space-y-4 pb-24">
      <h2 className="text-lg font-semibold">{microcopy.export_title}</h2>
      <ExportPdf type="arzt-1pager" dayEntries={dayEntries} monthEntries={monthEntries} />
      <ExportPdf type="pbac" dayEntries={dayEntries} monthEntries={monthEntries} />
      <ExportPdf type="timeline6m" dayEntries={dayEntries} monthEntries={monthEntries} />
    </div>
  );

  return (
    <div className="flex min-h-screen flex-col bg-rose-50">
      <main className="flex-1 px-4 pt-6">
        {tab === "today" && todayContent}
        {tab === "history" && historyContent}
        {tab === "entries" && entriesContent}
        {tab === "export" && exportContent}
      </main>
      <nav className="sticky bottom-0 z-30 border-t border-rose-100 bg-white/95 backdrop-blur">
        <ul className="mx-auto flex max-w-xl justify-between px-4 py-3">
          {tabs.map((item) => {
            const Icon = item.icon;
            const active = tab === item.id;
            return (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => setTab(item.id)}
                  className={`flex flex-col items-center gap-1 rounded-full px-4 py-1 text-xs font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 ${
                    active ? "text-rose-600" : "text-slate-500"
                  }`}
                >
                  <Icon className="h-5 w-5" />
                  {item.label}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>
      <ConsentDialog
        kind="FSFI"
        open={showConsent}
        onAccept={() => {
          setShowConsent(false);
          updateSettings({ fsfiOptIn: true });
        }}
        onDecline={() => setShowConsent(false)}
      />
    </div>
  );
}

interface WizardStepProps {
  stepId?: string;
  answers: Partial<DayEntry>;
  onAnswer: <K extends keyof DayEntry>(field: K, value: DayEntry[K]) => void;
  mode: FlowMode;
}

function WizardStep({ stepId, answers, onAnswer, mode }: WizardStepProps) {
  if (!stepId) return null;
  switch (stepId) {
    case "nrs":
      return (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <span>{microcopy.nrs_question}</span>
            <Tooltip term="nrs_hint" />
          </div>
          <NrsSlider
            value={(answers.nrs as Nrs) ?? 0}
            onChange={(value) => onAnswer("nrs", value)}
            hint={microcopy.nrs_hint}
            label={microcopy.nrs_question}
            labelHidden
          />
        </div>
      );
    case "pbac":
      return <PbacMini value={answers.pbac} onChange={(value) => onAnswer("pbac", value)} />;
    case "zones":
      return (
        <BodyMapSimple
          selected={(answers.zones as BodyZoneId[]) ?? []}
          onChange={(zones) => onAnswer("zones", zones)}
        />
      );
    case "symptoms":
      return <SymptomPicker value={(answers.symptoms as DayEntry["symptoms"]) ?? []} onChange={(value) => onAnswer("symptoms", value)} max={mode === "quick" ? 2 : 5} />;
    case "medication":
      return <MedicationQuick value={(answers.medication as DayEntry["medication"]) ?? []} onChange={(value) => onAnswer("medication", value)} />;
    case "sleep":
      return <SleepScale value={(answers.sleep as Nrs) ?? 5} onChange={(value) => onAnswer("sleep", value)} />;
    case "bowel":
      return (
        <div className="space-y-4">
          <BristolCards value={answers.bowel?.bristol as 1 | 2 | 3 | 4 | 5 | 6 | 7 | undefined} onChange={(bristol) => onAnswer("bowel", { ...(answers.bowel ?? {}), bristol })} />
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="h-5 w-5 rounded border-rose-200 text-rose-500 focus:ring-rose-500"
              checked={Boolean(answers.bowel?.dyschezia)}
              onChange={(event) => onAnswer("bowel", { ...(answers.bowel ?? {}), dyschezia: event.target.checked })}
            />
            Dyschezia heute?
          </label>
        </div>
      );
    case "bladder":
      return (
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="h-5 w-5 rounded border-rose-200 text-rose-500 focus:ring-rose-500"
            checked={Boolean(answers.bladder?.dysuria)}
            onChange={(event) => onAnswer("bladder", { ...(answers.bladder ?? {}), dysuria: event.target.checked })}
          />
          Brennen beim Wasserlassen heute?
        </label>
      );
    case "triggers":
      return (
        <label className="block text-sm">
          Trigger-Tags
          <textarea
            className="mt-2 w-full rounded-xl border border-slate-200 p-3"
            rows={3}
            value={(answers.triggerTags as string[])?.join(", ") ?? ""}
            onChange={(event) => onAnswer("triggerTags", event.target.value.split(",").map((tag) => tag.trim()).filter(Boolean))}
          />
        </label>
      );
    case "helped":
      return (
        <label className="block text-sm">
          Was hat geholfen?
          <textarea
            className="mt-2 w-full rounded-xl border border-slate-200 p-3"
            rows={3}
            value={(answers.helped as string[])?.join(", ") ?? ""}
            onChange={(event) => onAnswer("helped", event.target.value.split(",").map((tag) => tag.trim()).filter(Boolean))}
          />
        </label>
      );
    case "notes":
      return (
        <label className="block text-sm">
          Notiz
          <textarea
            className="mt-2 w-full rounded-xl border border-slate-200 p-3"
            rows={4}
            maxLength={500}
            value={(answers.notes as string) ?? ""}
            onChange={(event) => onAnswer("notes", event.target.value)}
          />
        </label>
      );
    case "summary":
      return (
        <div className="space-y-3 rounded-3xl bg-white p-4 shadow-sm">
          <h3 className="text-lg font-semibold">Zusammenfassung</h3>
          <p className="text-sm text-slate-600">NRS: {answers.nrs ?? "–"}</p>
          <p className="text-sm text-slate-600">PBAC: {answers.pbac?.dayScore ?? 0}</p>
          <p className="text-sm text-slate-600">
            Symptome: {((answers.symptoms as DayEntry["symptoms"]) ?? []).map((symptom) => `${symptom.label} (${symptom.intensity})`).join(", ") || "keine"}
          </p>
          {answers.notes ? <p className="text-sm text-slate-600">Notiz: {answers.notes}</p> : null}
          <div className="flex items-center gap-2 text-sm text-emerald-600">
            <CheckCircle2 className="h-4 w-4" />
            Speichern & später offline ansehen.
          </div>
        </div>
      );
    default:
      return null;
  }
}
