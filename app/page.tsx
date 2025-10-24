"use client";

import { createContext, useCallback, useContext, useEffect, useId, useMemo, useRef, useState } from "react";
import type { ChangeEvent, ReactNode } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
  BarChart,
  Bar,
  ScatterChart,
  Scatter,
} from "recharts";
import type { TooltipProps } from "recharts";
import {
  AlertTriangle,
  Calendar,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Download,
  HardDrive,
  Home,
  ShieldCheck,
  Smartphone,
  Upload,
} from "lucide-react";

import { DailyEntry, FeatureFlags, MonthlyEntry } from "@/lib/types";
import { TERMS } from "@/lib/terms";
import type { ModuleTerms, TermDescriptor, TermKey } from "@/lib/terms";
import { validateDailyEntry, validateMonthlyEntry, type ValidationIssue } from "@/lib/validation";
import InfoTip from "@/components/InfoTip";
import { Labeled } from "@/components/Labeled";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import Checkbox from "@/components/ui/checkbox";

import { cn } from "@/lib/utils";
import { touchLastActive } from "@/lib/persistence";
import { usePersistentState } from "@/lib/usePersistentState";
import WeeklyTabShell from "@/components/weekly/WeeklyTabShell";
import {
  listWeeklyReports,
  replaceWeeklyReports,
  type WeeklyReport,
  type PromptAnswers,
} from "@/lib/weekly/reports";
import { normalizeWpai, type WeeklyWpai } from "@/lib/weekly/wpai";

type SymptomKey = keyof DailyEntry["symptoms"];

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

type BackupPayload = {
  version: number;
  exportedAt: string;
  dailyEntries: DailyEntry[];
  weeklyReports: WeeklyReport[];
  monthlyEntries: MonthlyEntry[];
  featureFlags: FeatureFlags;
};

const PAIN_QUALITIES: DailyEntry["painQuality"] = [
  "krampfend",
  "stechend",
  "brennend",
  "dumpf",
  "ziehend",
  "anders",
];

type BodyRegion = { id: string; label: string };

const BODY_REGION_GROUPS: { id: string; label: string; regions: BodyRegion[] }[] = [
  {
    id: "head-neck",
    label: "Kopf & Nacken",
    regions: [
      { id: "head", label: "Kopf" },
      { id: "neck", label: "Nacken / Hals" },
    ],
  },
  {
    id: "back",
    label: "Rücken",
    regions: [
      { id: "upper_back_left", label: "Oberer Rücken links" },
      { id: "upper_back_right", label: "Oberer Rücken rechts" },
      { id: "mid_back_left", label: "Mittlerer Rücken links" },
      { id: "mid_back_right", label: "Mittlerer Rücken rechts" },
      { id: "lower_back", label: "LWS / Kreuzbein" },
    ],
  },
  {
    id: "upper-body",
    label: "Brust & Oberbauch",
    regions: [
      { id: "chest_left", label: "Brust links" },
      { id: "chest_right", label: "Brust rechts" },
      { id: "upper_abdomen_left", label: "Oberbauch links" },
      { id: "upper_abdomen", label: "Oberbauch Mitte" },
      { id: "upper_abdomen_right", label: "Oberbauch rechts" },
    ],
  },
  {
    id: "abdomen",
    label: "Unterleib & Becken",
    regions: [
      { id: "lower_abdomen_left", label: "Unterbauch links" },
      { id: "lower_abdomen", label: "Unterbauch Mitte" },
      { id: "lower_abdomen_right", label: "Unterbauch rechts" },
      { id: "pelvis_left", label: "Becken links" },
      { id: "pelvis_right", label: "Becken rechts" },
      { id: "uterus", label: "Uterus" },
      { id: "rectal", label: "Rektalbereich" },
      { id: "vaginal", label: "Vaginalbereich" },
    ],
  },
  {
    id: "arms",
    label: "Schultern, Arme & Hände",
    regions: [
      { id: "shoulder_left", label: "Schulter links" },
      { id: "shoulder_right", label: "Schulter rechts" },
      { id: "upper_arm_left", label: "Oberarm links" },
      { id: "upper_arm_right", label: "Oberarm rechts" },
      { id: "forearm_left", label: "Unterarm links" },
      { id: "forearm_right", label: "Unterarm rechts" },
      { id: "hand_left", label: "Hand links" },
      { id: "hand_right", label: "Hand rechts" },
    ],
  },
  {
    id: "legs",
    label: "Beine & Füße",
    regions: [
      { id: "hip_left", label: "Hüfte links" },
      { id: "hip_right", label: "Hüfte rechts" },
      { id: "thigh_left", label: "Oberschenkel links" },
      { id: "thigh_right", label: "Oberschenkel rechts" },
      { id: "knee_left", label: "Knie links" },
      { id: "knee_right", label: "Knie rechts" },
      { id: "calf_left", label: "Unterschenkel links" },
      { id: "calf_right", label: "Unterschenkel rechts" },
      { id: "ankle_left", label: "Sprunggelenk links" },
      { id: "ankle_right", label: "Sprunggelenk rechts" },
      { id: "foot_left", label: "Fuß links" },
      { id: "foot_right", label: "Fuß rechts" },
    ],
  },
];

const SYMPTOM_ITEMS: { key: SymptomKey; termKey: TermKey }[] = [
  { key: "dysmenorrhea", termKey: "dysmenorrhea" },
  { key: "deepDyspareunia", termKey: "deepDyspareunia" },
  { key: "pelvicPainNonMenses", termKey: "pelvicPainNonMenses" },
  { key: "dyschezia", termKey: "dyschezia" },
  { key: "dysuria", termKey: "dysuria" },
  { key: "fatigue", termKey: "fatigue" },
  { key: "bloating", termKey: "bloating" },
];

const PBAC_PRODUCT_ITEMS = [
  { id: "pad_light", label: "Binde – leicht", score: 1, product: "pad", saturation: "light" },
  { id: "pad_medium", label: "Binde – mittel", score: 5, product: "pad", saturation: "medium" },
  { id: "pad_heavy", label: "Binde – stark", score: 20, product: "pad", saturation: "heavy" },
  { id: "tampon_light", label: "Tampon – leicht", score: 1, product: "tampon", saturation: "light" },
  { id: "tampon_medium", label: "Tampon – mittel", score: 5, product: "tampon", saturation: "medium" },
  { id: "tampon_heavy", label: "Tampon – stark", score: 10, product: "tampon", saturation: "heavy" },
] as const;

const PBAC_CLOT_ITEMS = [
  { id: "clot_small", label: "Koagel <2 cm", score: 1 },
  { id: "clot_large", label: "Koagel ≥2 cm", score: 5 },
] as const;

const PBAC_ITEMS = [...PBAC_PRODUCT_ITEMS, ...PBAC_CLOT_ITEMS] as const;

type PbacProductItem = (typeof PBAC_PRODUCT_ITEMS)[number];
type PbacProduct = PbacProductItem["product"];
type PbacSaturation = PbacProductItem["saturation"];
type PbacCounts = Record<(typeof PBAC_ITEMS)[number]["id"], number>;

const PBAC_PRODUCT_OPTIONS: { id: PbacProduct; label: string }[] = [
  { id: "pad", label: "Binde" },
  { id: "tampon", label: "Tampon" },
];

const PBAC_SATURATION_OPTIONS: { id: PbacSaturation; label: string }[] = [
  { id: "light", label: "leicht" },
  { id: "medium", label: "mittel" },
  { id: "heavy", label: "stark" },
];

const PBAC_FLOODING_SCORE = 5;
const HEAVY_BLEED_PBAC = 100;

const isHeavyBleedToday = (entry: DailyEntry) => (entry.bleeding?.pbacScore ?? 0) >= HEAVY_BLEED_PBAC;

const DEFAULT_PAGE_BG = "#fff1f2";
const SAVED_PAGE_BG = "#fff7ed";

const EHP5_ITEMS = [
  "Schmerz schränkt Alltagstätigkeiten ein",
  "Arbeit oder Studium litten unter Beschwerden",
  "Emotionale Belastung durch Endometriose",
  "Beziehungen und soziale Aktivitäten beeinflusst",
  "Energielevel/Erschöpfung im Alltag",
] as const;

const PHQ9_ITEMS = [
  "Wenig Interesse oder Freude an Tätigkeiten",
  "Niedergeschlagen, deprimiert oder hoffnungslos",
  "Einschlaf- oder Durchschlafprobleme bzw. zu viel Schlaf",
  "Müdigkeit oder Energiemangel",
  "Appetitmangel oder übermäßiges Essen",
  "Schlechtes Gefühl über sich selbst oder das Gefühl, versagt zu haben",
  "Schwierigkeiten, sich zu konzentrieren (z. B. Zeitung lesen, Fernsehen)",
  "Bewegungs- oder Sprechverlangsamung bzw. Unruhe",
  "Gedanken, dass es besser wäre, tot zu sein oder sich selbst Schaden zuzufügen",
] as const;

const GAD7_ITEMS = [
  "Nervosität, innere Unruhe oder Anspannung",
  "Unfähigkeit, Sorgen zu kontrollieren",
  "Übermäßige Sorgen über verschiedene Dinge",
  "Schwierigkeit, sich zu entspannen",
  "Ruhelosigkeit, so dass man nicht still sitzen kann",
  "Leicht reizbar oder verärgert",
  "Angst, dass etwas Schlimmes passieren könnte",
] as const;

const SCALE_OPTIONS_0_4 = [0, 1, 2, 3, 4] as const;
const SCALE_OPTIONS_0_3 = [0, 1, 2, 3] as const;

const PBAC_DEFAULT_COUNTS = PBAC_ITEMS.reduce<PbacCounts>((acc, item) => {
  acc[item.id] = 0;
  return acc;
}, {} as PbacCounts);

const BRISTOL_TYPES = [
  { value: 1, label: "Typ 1" },
  { value: 2, label: "Typ 2" },
  { value: 3, label: "Typ 3" },
  { value: 4, label: "Typ 4" },
  { value: 5, label: "Typ 5" },
  { value: 6, label: "Typ 6" },
  { value: 7, label: "Typ 7" },
] as const;

const formatDate = (date: Date) => {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const parseIsoDate = (iso: string) => {
  const [year, month, day] = iso.split("-").map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
};

const createEmptyDailyEntry = (date: string): DailyEntry => ({
  date,
  painNRS: 0,
  painQuality: [],
  painMapRegionIds: [],
  bleeding: { isBleeding: false },
  symptoms: {},
  meds: [],
  ovulation: {},
});

const createEmptyMonthlyEntry = (month: string): MonthlyEntry => ({
  month,
  qol: {},
  mental: {},
  promis: {},
});

const SectionScopeContext = createContext<string | number | null>(null);

type SectionCompletionState = Record<string, Record<string, boolean>>;

type SectionCompletionContextValue = {
  getCompletion: (scope: string | number | null, key: string) => boolean;
  setCompletion: (scope: string | number | null, key: string, completed: boolean) => void;
};

const SectionCompletionContext = createContext<SectionCompletionContextValue | null>(null);

function Section({
  title,
  description,
  aside,
  children,
  completionEnabled = true,
  variant = "card",
}: {
  title: string;
  description?: string;
  aside?: ReactNode;
  children: ReactNode;
  completionEnabled?: boolean;
  variant?: "card" | "plain";
}) {
  const scope = useContext(SectionScopeContext);
  const completionContext = useContext(SectionCompletionContext);
  const cardRef = useRef<HTMLDivElement | null>(null);
  const timeoutRef = useRef<number | null>(null);
  const [isCompleted, setIsCompleted] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const confettiPieces = useMemo(
    () =>
      CONFETTI_PIECES.map((piece, index) => ({
        ...piece,
        color: CONFETTI_COLORS[index % CONFETTI_COLORS.length],
      })),
    []
  );

  const completedFromContext = useMemo(() => {
    if (!completionEnabled) return false;
    if (!completionContext) return false;
    if (scope === null || scope === undefined) return false;
    return completionContext.getCompletion(scope, title);
  }, [completionContext, completionEnabled, scope, title]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current !== null) {
        window.clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const cancelTimeout = () => {
      if (timeoutRef.current !== null) {
        window.clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };

    if (!completionEnabled) {
      cancelTimeout();
      setIsCompleted(false);
      setShowConfetti(false);
      return;
    }

    if (!completedFromContext) {
      cancelTimeout();
      setIsCompleted(false);
      setShowConfetti(false);
      return;
    }

    setIsCompleted(true);
  }, [completedFromContext, completionEnabled]);

  const scrollToNextSection = () => {
    if (!cardRef.current) return;
    const sections = Array.from(document.querySelectorAll<HTMLElement>("[data-section-card]"));
    const currentIndex = sections.indexOf(cardRef.current);
    if (currentIndex === -1) return;
    for (let index = currentIndex + 1; index < sections.length; index += 1) {
      const next = sections[index];
      if (next) {
        next.scrollIntoView({ behavior: "smooth", block: "start" });
        break;
      }
    }
  };

  const handleComplete = () => {
    if (!completionEnabled || isCompleted || showConfetti) return;
    setIsCompleted(true);
    if (completionContext && scope !== null && scope !== undefined) {
      completionContext.setCompletion(scope, title, true);
    }
    setShowConfetti(true);
    timeoutRef.current = window.setTimeout(() => {
      setShowConfetti(false);
      scrollToNextSection();
      timeoutRef.current = null;
    }, 400);
  };

  return (
    <section
      ref={cardRef}
      data-section-card
      data-section-completed={isCompleted ? "true" : "false"}
      className={cn(
        "relative",
        variant === "card"
          ? "space-y-4 rounded-2xl border border-rose-100 bg-white p-4 shadow-sm transition-colors sm:p-6"
          : "space-y-4 sm:space-y-5",
        variant === "card" && isCompleted ? "border-amber-200 shadow-md" : null
      )}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <h2 className="text-base font-semibold text-rose-900">{title}</h2>
          {description && <p className="text-sm text-rose-600">{description}</p>}
        </div>
        {aside ? <div className="flex-shrink-0 sm:self-start">{aside}</div> : null}
      </div>
      <div className="space-y-4">
        {children}
        {completionEnabled ? (
          <div className="flex justify-end pt-2">
            <div className="relative inline-flex">
              {completionEnabled && showConfetti ? (
                <div className="pointer-events-none absolute -inset-x-4 -inset-y-3 overflow-visible">
                  {confettiPieces.map((piece, index) => (
                    <span
                      key={index}
                      className="confetti-piece absolute h-3 w-3 rounded-sm"
                      style={{
                        left: piece.left,
                        top: piece.top,
                        backgroundColor: piece.color,
                        animationDelay: `${piece.delay}ms`,
                      }}
                    />
                  ))}
                </div>
              ) : null}
              <Button
                type="button"
                variant="outline"
                className={cn(isCompleted ? "cursor-default" : "")}
                onClick={handleComplete}
                disabled={isCompleted}
              >
                {isCompleted ? (
                  <span className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4" />
                    Erledigt
                  </span>
                ) : (
                  "Fertig"
                )}
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function TermField({ termKey, htmlFor, children }: { termKey: TermKey; htmlFor?: string; children: ReactNode }) {
  const term: TermDescriptor = TERMS[termKey];
  const meta = term.optional ? (
    <Badge className="bg-amber-100 text-amber-800">
      {term.deviceNeeded ? `Optional (Hilfsmittel nötig: ${term.deviceNeeded})` : "Optional"}
    </Badge>
  ) : null;
  return (
    <Labeled label={term.label} tech={term.tech} help={term.help} htmlFor={htmlFor} meta={meta}>
      {children}
    </Labeled>
  );
}

function TermHeadline({ termKey }: { termKey: TermKey }) {
  const term: TermDescriptor = TERMS[termKey];
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-rose-900">
      <span>{term.label}</span>
      {term.optional ? (
        <Badge className="bg-amber-100 text-amber-800">
          {term.deviceNeeded ? `Optional (Hilfsmittel nötig: ${term.deviceNeeded})` : "Optional"}
        </Badge>
      ) : null}
      {term.help ? <InfoTip tech={term.tech ?? term.label} help={term.help} /> : null}
    </div>
  );
}

function ScoreInput({
  id,
  label,
  termKey,
  tech,
  help,
  value,
  onChange,
  min = 0,
  max = 10,
  step = 1,
  disabled = false,
}: {
  id: string;
  label: string;
  termKey?: TermKey;
  tech?: string;
  help?: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
}) {
  const rangeDescriptionId = `${id}-range-hint`;
  const content = (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:gap-4">
      <div className="flex flex-1 flex-col gap-1">
        <Slider
          value={[value]}
          min={min}
          max={max}
          step={step}
          onValueChange={([v]) => {
            if (!disabled) {
              onChange(v);
            }
          }}
          id={id}
          aria-describedby={rangeDescriptionId}
          disabled={disabled}
        />
        <div
          id={rangeDescriptionId}
          className="flex justify-between text-xs text-rose-600"
        >
          <span>{min}</span>
          <span>{max}</span>
        </div>
      </div>
      <Input
        className="w-20"
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-describedby={rangeDescriptionId}
        onChange={(event) => {
          if (!disabled) {
            onChange(Number(event.target.value));
          }
        }}
        disabled={disabled}
      />
    </div>
  );
  if (termKey) {
    return (
      <TermField termKey={termKey} htmlFor={id}>
        {content}
      </TermField>
    );
  }
  return (
    <Labeled label={label} tech={tech} help={help} htmlFor={id}>
      {content}
    </Labeled>
  );
}

function MultiSelectChips({
  options,
  value,
  onToggle,
}: {
  options: { value: string; label: string }[];
  value: string[];
  onToggle: (next: string[]) => void;
}) {
  const toggle = (option: string) => {
    const set = new Set(value);
    if (set.has(option)) {
      set.delete(option);
    } else {
      set.add(option);
    }
    onToggle(Array.from(set));
  };
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => toggle(option.value)}
          aria-pressed={value.includes(option.value)}
          className={cn(
            "rounded-full border px-3 py-1 text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-2",
            value.includes(option.value)
              ? "border-rose-500 bg-rose-500 text-white shadow-sm"
              : "border-rose-200 bg-white text-rose-700 hover:border-rose-400 hover:bg-rose-50"
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

const MODULE_TERMS: ModuleTerms = {
  urinaryOpt: TERMS.urinaryOpt,
  headacheOpt: TERMS.headacheOpt,
  dizzinessOpt: TERMS.dizzinessOpt,
};

const CONFETTI_COLORS = ["#fb7185", "#f97316", "#facc15", "#4ade80", "#38bdf8"] as const;

const CONFETTI_VERTICAL_POSITIONS = ["20%", "50%", "80%"] as const;

const CONFETTI_PIECES = Array.from({ length: 8 }, (_, index) => ({
  left: `${5 + index * 12}%`,
  top: CONFETTI_VERTICAL_POSITIONS[index % CONFETTI_VERTICAL_POSITIONS.length],
  delay: index * 30,
}));

const SYMPTOM_MODULE_TOGGLES: Array<{
  key: keyof FeatureFlags;
  label: string;
  term: TermDescriptor;
}> = [
  { key: "moduleHeadache", label: "Kopfschmerz/Migräne", term: MODULE_TERMS.headacheOpt.present },
  { key: "moduleDizziness", label: "Schwindel", term: MODULE_TERMS.dizzinessOpt.present },
];

type HeadacheMed = NonNullable<NonNullable<DailyEntry["headacheOpt"]>["meds"]>[number];

function ModuleToggleRow({
  label,
  tech,
  help,
  checked,
  onCheckedChange,
  className,
}: {
  label: string;
  tech?: string;
  help: string;
  checked: boolean;
  onCheckedChange: (value: boolean) => void;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-lg border border-rose-100 bg-rose-50 p-4 sm:flex-row sm:items-center sm:justify-between",
        className,
      )}
    >
      <div className="flex flex-wrap items-center gap-2 text-sm font-medium text-rose-900">
        <span>{label}</span>
        <InfoTip tech={tech ?? label} help={help} />
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}

function NrsInput({ id, value, onChange }: { id: string; value: number; onChange: (value: number) => void }) {
  const rangeDescriptionId = `${id}-nrs-range`;
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:gap-4">
      <div className="flex flex-1 flex-col gap-1">
        <Slider
          id={id}
          value={[value]}
          min={0}
          max={10}
          step={1}
          aria-describedby={rangeDescriptionId}
          onValueChange={([next]) => onChange(Math.max(0, Math.min(10, Math.round(next))))}
        />
        <div id={rangeDescriptionId} className="flex justify-between text-xs text-rose-600">
          <span>0 Kein Schmerz</span>
          <span>10 Stärkster Schmerz</span>
        </div>
      </div>
      <Input
        className="w-20"
        type="number"
        inputMode="numeric"
        min={0}
        max={10}
        step={1}
        value={value}
        aria-describedby={rangeDescriptionId}
        onChange={(event) => {
          const parsed = Number(event.target.value);
          if (Number.isNaN(parsed)) {
            onChange(0);
            return;
          }
          onChange(Math.max(0, Math.min(10, Math.round(parsed))));
        }}
      />
    </div>
  );
}

function NumberField({
  id,
  value,
  min = 0,
  onChange,
}: {
  id: string;
  value: number | undefined;
  min?: number;
  onChange: (value: number | undefined) => void;
}) {
  return (
    <Input
      id={id}
      type="number"
      min={min}
      value={value ?? ""}
      onChange={(event) => {
        if (event.target.value === "") {
          onChange(undefined);
          return;
        }
        const parsed = Number(event.target.value);
        if (Number.isNaN(parsed)) {
          onChange(undefined);
          return;
        }
        onChange(Math.max(min, Math.round(parsed)));
      }}
    />
  );
}

function MedList({
  items,
  onChange,
  renderIssues,
}: {
  items: HeadacheMed[];
  onChange: (items: HeadacheMed[]) => void;
  renderIssues?: (path: string) => ReactNode;
}) {
  const updateItem = (index: number, patch: Partial<HeadacheMed>) => {
    const next = items.slice();
    next[index] = { ...next[index], ...patch };
    onChange(next);
  };

  return (
    <div className="space-y-3">
      {items.map((item, index) => (
        <div key={index} className="space-y-2 rounded-lg border border-rose-100 bg-white p-3 text-sm text-rose-700">
          <div className="grid gap-2 md:grid-cols-3">
            <div>
              <Label htmlFor={`headache-med-name-${index}`} className="text-xs text-rose-600">
                Name
              </Label>
              <Input
                id={`headache-med-name-${index}`}
                value={item.name}
                onChange={(event) => updateItem(index, { name: event.target.value })}
              />
              {renderIssues?.(`headacheOpt.meds[${index}].name`)}
            </div>
            <div>
              <Label htmlFor={`headache-med-dose-${index}`} className="text-xs text-rose-600">
                Dosis (mg)
              </Label>
              <Input
                id={`headache-med-dose-${index}`}
                type="number"
                min={0}
                value={item.doseMg ?? ""}
                onChange={(event) =>
                  updateItem(index, {
                    doseMg: event.target.value === "" ? undefined : Math.max(0, Math.round(Number(event.target.value))),
                  })
                }
              />
              {renderIssues?.(`headacheOpt.meds[${index}].doseMg`)}
            </div>
            <div>
              <Label htmlFor={`headache-med-time-${index}`} className="text-xs text-rose-600">
                Uhrzeit (optional)
              </Label>
              <Input
                id={`headache-med-time-${index}`}
                placeholder="08:00"
                value={item.time ?? ""}
                onChange={(event) => updateItem(index, { time: event.target.value || undefined })}
              />
              {renderIssues?.(`headacheOpt.meds[${index}].time`)}
            </div>
          </div>
          <div className="flex justify-end">
            <Button
              type="button"
              variant="ghost"
              className="text-xs text-rose-600"
              onClick={() => onChange(items.filter((_, i) => i !== index))}
            >
              Entfernen
            </Button>
          </div>
        </div>
      ))}
      <Button
        type="button"
        variant="secondary"
        onClick={() => onChange([...items, { name: "" } as HeadacheMed])}
      >
        + Mittel ergänzen
      </Button>
    </div>
  );
}

function InlineNotice({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-md border-l-4 border-amber-400 bg-amber-50 p-3 text-sm text-amber-800">
      <p className="font-semibold text-amber-900">{title}</p>
      <p className="mt-1 text-amber-700">{text}</p>
    </div>
  );
}

function normalizeImportedDailyEntry(entry: DailyEntry & Record<string, unknown>): DailyEntry {
  const clone: DailyEntry = { ...entry };
  const extra = clone as unknown as Record<string, unknown>;

  const importedBowelPain = (() => {
    const giSource = entry.gi as (DailyEntry["gi"] & { bowelPain?: number }) | undefined;
    return typeof giSource?.bowelPain === "number" ? giSource.bowelPain : undefined;
  })();
  if (typeof importedBowelPain === "number") {
    const normalized = Math.max(0, Math.min(10, Math.round(importedBowelPain)));
    const nextSymptoms: DailyEntry["symptoms"] = { ...(clone.symptoms ?? {}) };
    const existing = nextSymptoms.dyschezia;
    if (!existing) {
      nextSymptoms.dyschezia = { present: true, score: normalized };
    } else if (existing.present && typeof existing.score !== "number") {
      nextSymptoms.dyschezia = { present: true, score: normalized };
    }
    clone.symptoms = nextSymptoms;
  }
  if (clone.gi) {
    const giRecord = { ...(clone.gi as Record<string, unknown>) };
    if ("bowelPain" in giRecord) {
      delete giRecord.bowelPain;
    }
    clone.gi = Object.keys(giRecord).length ? (giRecord as DailyEntry["gi"]) : undefined;
    if (!clone.gi) {
      delete (clone as { gi?: DailyEntry["gi"] }).gi;
    }
  }

  const importedUrinaryPain = (() => {
    const urinarySource = entry.urinary as (DailyEntry["urinary"] & { pain?: number }) | undefined;
    return typeof urinarySource?.pain === "number" ? urinarySource.pain : undefined;
  })();
  if (typeof importedUrinaryPain === "number") {
    const normalized = Math.max(0, Math.min(10, Math.round(importedUrinaryPain)));
    const nextSymptoms: DailyEntry["symptoms"] = { ...(clone.symptoms ?? {}) };
    const existing = nextSymptoms.dysuria;
    if (!existing) {
      nextSymptoms.dysuria = { present: true, score: normalized };
    } else if (existing.present && typeof existing.score !== "number") {
      nextSymptoms.dysuria = { present: true, score: normalized };
    }
    clone.symptoms = nextSymptoms;
  }
  if (clone.urinary) {
    const urinaryRecord = { ...(clone.urinary as Record<string, unknown>) };
    if ("pain" in urinaryRecord) {
      delete urinaryRecord.pain;
    }
    clone.urinary = Object.keys(urinaryRecord).length ? (urinaryRecord as DailyEntry["urinary"]) : undefined;
    if (!clone.urinary) {
      delete (clone as { urinary?: DailyEntry["urinary"] }).urinary;
    }
  }

  const urinaryOpt: NonNullable<DailyEntry["urinaryOpt"]> = { ...(entry.urinaryOpt ?? {}) };
  if (typeof extra["urinary_urgency"] === "number") {
    urinaryOpt.urgency = extra["urinary_urgency"] as number;
  }
  if (typeof extra["urinary_leaks"] === "number") {
    urinaryOpt.leaksCount = extra["urinary_leaks"] as number;
  }
  if (typeof extra["urinary_nocturia"] === "number") {
    urinaryOpt.nocturia = extra["urinary_nocturia"] as number;
  }
  if (Object.keys(urinaryOpt).length) {
    clone.urinaryOpt = urinaryOpt;
  }
  delete extra["urinary_urgency"];
  delete extra["urinary_leaks"];
  delete extra["urinary_nocturia"];

  const headacheOpt: NonNullable<DailyEntry["headacheOpt"]> = { ...(entry.headacheOpt ?? {}) };
  if (typeof extra["headache_present"] === "boolean") {
    headacheOpt.present = extra["headache_present"] as boolean;
  }
  if (typeof extra["headache_nrs"] === "number") {
    headacheOpt.nrs = extra["headache_nrs"] as number;
  }
  if (typeof extra["headache_aura"] === "boolean") {
    headacheOpt.aura = extra["headache_aura"] as boolean;
  }
  if (Object.keys(headacheOpt).length) {
    clone.headacheOpt = headacheOpt;
  }
  delete extra["headache_present"];
  delete extra["headache_nrs"];
  delete extra["headache_aura"];

  const dizzinessOpt: NonNullable<DailyEntry["dizzinessOpt"]> = { ...(entry.dizzinessOpt ?? {}) };
  if (typeof extra["dizziness_present"] === "boolean") {
    dizzinessOpt.present = extra["dizziness_present"] as boolean;
  }
  if (typeof extra["dizziness_nrs"] === "number") {
    dizzinessOpt.nrs = extra["dizziness_nrs"] as number;
  }
  if (typeof extra["dizziness_orthostatic"] === "boolean") {
    dizzinessOpt.orthostatic = extra["dizziness_orthostatic"] as boolean;
  }
  if (Object.keys(dizzinessOpt).length) {
    clone.dizzinessOpt = dizzinessOpt;
  }
  delete extra["dizziness_present"];
  delete extra["dizziness_nrs"];
  delete extra["dizziness_orthostatic"];

  const ovulationPain: NonNullable<DailyEntry["ovulationPain"]> = { ...(entry.ovulationPain ?? {}) };
  const side = extra["ovulation_pain_side"];
  if (typeof side === "string" && ["links", "rechts", "beidseitig", "unsicher"].includes(side)) {
    ovulationPain.side = side as NonNullable<DailyEntry["ovulationPain"]>["side"];
  }
  if (typeof extra["ovulation_pain_intensity"] === "number") {
    ovulationPain.intensity = extra["ovulation_pain_intensity"] as number;
  }
  if (Object.keys(ovulationPain).length) {
    clone.ovulationPain = ovulationPain;
  }
  delete extra["ovulation_pain_side"];
  delete extra["ovulation_pain_intensity"];

  return clone;
}

type RawWeeklyReport = Record<string, unknown> & { stats?: Record<string, unknown> };

function normalizeImportedWeeklyReport(entry: RawWeeklyReport): WeeklyReport | null {
  if (!entry || typeof entry !== "object") {
    return null;
  }

  const isoWeekKey = typeof entry.isoWeekKey === "string" ? entry.isoWeekKey : "";
  const submittedAtRaw = entry.submittedAt;
  const submittedAt =
    typeof submittedAtRaw === "number" && Number.isFinite(submittedAtRaw) ? submittedAtRaw : Date.now();

  const statsSource = entry.stats;
  if (!statsSource || typeof statsSource !== "object") {
    return null;
  }

  const startISO = typeof statsSource.startISO === "string" ? statsSource.startISO : "";
  const endISO = typeof statsSource.endISO === "string" ? statsSource.endISO : "";
  if (!startISO || !endISO) {
    return null;
  }

  const sparkline = Array.isArray(statsSource.sparkline)
    ? statsSource.sparkline
        .map((point) => {
          if (!point || typeof point !== "object") return null;
          const dateISO = typeof (point as { dateISO?: unknown }).dateISO === "string" ? point.dateISO : "";
          if (!dateISO) return null;
          const painValue = (point as { pain?: unknown }).pain;
          const pain = typeof painValue === "number" && Number.isFinite(painValue) ? painValue : null;
          return { dateISO, pain };
        })
        .filter((point): point is { dateISO: string; pain: number | null } => point !== null)
    : [];

  const notesSource = statsSource.notes;
  const notes =
    notesSource && typeof notesSource === "object"
      ? {
          medicationChange: Boolean((notesSource as { medicationChange?: unknown }).medicationChange),
          sleepBelowUsual: Boolean((notesSource as { sleepBelowUsual?: unknown }).sleepBelowUsual),
        }
      : { medicationChange: false, sleepBelowUsual: false };

  const stats: WeeklyReport["stats"] = {
    isoWeekKey:
      typeof statsSource.isoWeekKey === "string" && statsSource.isoWeekKey
        ? statsSource.isoWeekKey
        : isoWeekKey,
    startISO,
    endISO,
    avgPain:
      typeof statsSource.avgPain === "number" && Number.isFinite(statsSource.avgPain)
        ? statsSource.avgPain
        : null,
    maxPain:
      typeof statsSource.maxPain === "number" && Number.isFinite(statsSource.maxPain)
        ? statsSource.maxPain
        : null,
    badDaysCount:
      typeof statsSource.badDaysCount === "number" && Number.isFinite(statsSource.badDaysCount)
        ? Math.max(0, Math.trunc(statsSource.badDaysCount))
        : 0,
    bleedingDaysCount:
      typeof statsSource.bleedingDaysCount === "number" && Number.isFinite(statsSource.bleedingDaysCount)
        ? Math.max(0, Math.trunc(statsSource.bleedingDaysCount))
        : 0,
    sparkline,
    notes,
  };

  const answersSource = entry.answers;
  const answers: PromptAnswers = (() => {
    if (answersSource && typeof answersSource === "object") {
      const wpaiSource = (answersSource as { wpai?: unknown }).wpai;
      return {
        helped: Array.isArray((answersSource as { helped?: unknown }).helped)
          ? ((answersSource as { helped?: unknown }).helped as unknown[]).filter(
              (item): item is string => typeof item === "string"
            )
          : [],
        worsened: Array.isArray((answersSource as { worsened?: unknown }).worsened)
          ? ((answersSource as { worsened?: unknown }).worsened as unknown[]).filter(
              (item): item is string => typeof item === "string"
            )
          : [],
        nextWeekTry: Array.isArray((answersSource as { nextWeekTry?: unknown }).nextWeekTry)
          ? ((answersSource as { nextWeekTry?: unknown }).nextWeekTry as unknown[]).filter(
              (item): item is string => typeof item === "string"
            )
          : [],
        freeText:
          typeof (answersSource as { freeText?: unknown }).freeText === "string"
            ? ((answersSource as { freeText?: unknown }).freeText as string)
            : "",
        wpai: normalizeWpai(
          wpaiSource && typeof wpaiSource === "object"
            ? (wpaiSource as Partial<WeeklyWpai>)
            : undefined
        ),
      };
    }
    return { helped: [], worsened: [], nextWeekTry: [], freeText: "", wpai: normalizeWpai() };
  })();

  const resolvedIsoWeek = stats.isoWeekKey || isoWeekKey;
  if (!resolvedIsoWeek) {
    return null;
  }

  return {
    isoWeekKey: resolvedIsoWeek,
    stats,
    answers,
    submittedAt,
  };
}

function normalizeImportedMonthlyEntry(entry: MonthlyEntry & Record<string, unknown>): MonthlyEntry {
  const normalized: MonthlyEntry = {
    month: typeof entry.month === "string" ? entry.month : "",
  };
  if (entry.qol && typeof entry.qol === "object") {
    const qol = entry.qol as Record<string, unknown>;
    normalized.qol = {
      ehp5Items: Array.isArray(qol.ehp5Items)
        ? (qol.ehp5Items as Array<number | undefined>).map((value) =>
            typeof value === "number" ? value : undefined
          )
        : undefined,
      ehp5Total: typeof qol.ehp5Total === "number" ? (qol.ehp5Total as number) : undefined,
      ehp5Transformed:
        typeof qol.ehp5Transformed === "number" ? (qol.ehp5Transformed as number) : undefined,
    };
  }
  if (entry.mental && typeof entry.mental === "object") {
    const mental = entry.mental as Record<string, unknown>;
    normalized.mental = {
      phq9Items: Array.isArray(mental.phq9Items)
        ? (mental.phq9Items as Array<number | undefined>).map((value) =>
            typeof value === "number" ? value : undefined
          )
        : undefined,
      phq9: typeof mental.phq9 === "number" ? (mental.phq9 as number) : undefined,
      phq9Severity: typeof mental.phq9Severity === "string" ? (mental.phq9Severity as SeverityLevel) : undefined,
      gad7Items: Array.isArray(mental.gad7Items)
        ? (mental.gad7Items as Array<number | undefined>).map((value) =>
            typeof value === "number" ? value : undefined
          )
        : undefined,
      gad7: typeof mental.gad7 === "number" ? (mental.gad7 as number) : undefined,
      gad7Severity: typeof mental.gad7Severity === "string" ? (mental.gad7Severity as SeverityLevel) : undefined,
    };
  }
  if (entry.promis && typeof entry.promis === "object") {
    const promis = entry.promis as Record<string, unknown>;
    normalized.promis = {
      fatigueT: typeof promis.fatigueT === "number" ? (promis.fatigueT as number) : undefined,
      painInterferenceT:
        typeof promis.painInterferenceT === "number" ? (promis.painInterferenceT as number) : undefined,
    };
  }
  return normalized;
}

function BodyMap({ value, onChange }: { value: string[]; onChange: (next: string[]) => void }) {
  return (
    <div className="space-y-3">
      {BODY_REGION_GROUPS.map((group) => {
        const selectedCount = group.regions.filter((region) => value.includes(region.id)).length;
        return (
          <details
            key={group.id}
            className="group rounded-lg border border-rose-100 bg-rose-50 text-rose-700 [&[open]>summary]:border-b [&[open]>summary]:bg-rose-100"
          >
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2 text-sm font-semibold text-rose-800 [&::-webkit-details-marker]:hidden">
              <span>{group.label}</span>
              <span className="text-xs font-normal text-rose-500">
                {selectedCount > 0 ? `${selectedCount} ausgewählt` : "Auswählen"}
              </span>
            </summary>
            <div className="border-t border-rose-100 bg-white px-3 py-3">
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {group.regions.map((region) => {
                  const isSelected = value.includes(region.id);
                  return (
                    <button
                      key={region.id}
                      type="button"
                      onClick={() => {
                        const set = new Set(value);
                        if (set.has(region.id)) {
                          set.delete(region.id);
                        } else {
                          set.add(region.id);
                        }
                        onChange(Array.from(set));
                      }}
                      className={cn(
                        "w-full rounded-md border px-3 py-2 text-left text-sm transition",
                        isSelected
                          ? "border-rose-400 bg-rose-100 text-rose-700"
                          : "border-rose-100 bg-white text-rose-600 hover:border-rose-300 hover:bg-rose-50"
                      )}
                    >
                      {region.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </details>
        );
      })}
    </div>
  );
}

function computePbacScore(counts: PbacCounts, flooding: boolean) {
  const base = PBAC_ITEMS.reduce((total, item) => total + counts[item.id] * item.score, 0);
  return base + (flooding ? PBAC_FLOODING_SCORE : 0);
}

function findPbacProductItem(product: PbacProduct, saturation: PbacSaturation) {
  return PBAC_PRODUCT_ITEMS.find((item) => item.product === product && item.saturation === saturation);
}

type SeverityLevel = "mild" | "moderat" | "hoch";

function mapPhqSeverity(score?: number): SeverityLevel | undefined {
  if (typeof score !== "number") return undefined;
  if (score >= 15) return "hoch";
  if (score >= 5) return "moderat";
  return "mild";
}

function mapGadSeverity(score?: number): SeverityLevel | undefined {
  if (typeof score !== "number") return undefined;
  if (score >= 15) return "hoch";
  if (score >= 5) return "moderat";
  return "mild";
}

function severityBadgeClass(level: SeverityLevel) {
  if (level === "hoch") return "bg-rose-200 text-rose-800";
  if (level === "moderat") return "bg-amber-200 text-amber-800";
  return "bg-emerald-200 text-emerald-800";
}

function severityLabel(level: SeverityLevel) {
  return level.charAt(0).toUpperCase() + level.slice(1);
}

function ChartTooltip({ active, payload }: TooltipProps<number, string>) {
  if (!active || !payload?.length) return null;
  const data = payload[0].payload as {
    date: string;
    cycleDay: number | null;
    weekday: string;
    pain: number;
    pbac: number | null;
    symptomAverage: number | null;
    sleepQuality: number | null;
  };
  return (
    <div className="rounded-lg border border-rose-200 bg-white p-3 text-xs text-rose-700 shadow-sm">
      <p className="font-semibold text-rose-800">{data.date}</p>
      <p>Zyklustag: {data.cycleDay ?? "–"}</p>
      <p>Wochentag: {data.weekday}</p>
      <p>{TERMS.nrs.label}: {data.pain}</p>
      <p>{TERMS.pbac.label}: {data.pbac ?? "–"}</p>
      <p>Symptom-Schnitt: {data.symptomAverage?.toFixed(1) ?? "–"}</p>
      <p>{TERMS.sleep_quality.label}: {data.sleepQuality ?? "–"}</p>
    </div>
  );
}

function downloadFile(filename: string, contents: string, mime: string) {
  const blob = new Blob([contents], { type: mime });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}

function toCsv(rows: Record<string, unknown>[]) {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);
  const csv = [headers.join(",")];
  rows.forEach((row) => {
    const values = headers.map((header) => {
      const value = row[header];
      if (value === null || value === undefined) return "";
      if (Array.isArray(value)) {
        return `"${value.join(";")}"`;
      }
      return typeof value === "string" ? `"${value.replace(/"/g, '""')}"` : String(value);
    });
    csv.push(values.join(","));
  });
  return csv.join("\n");
}

function escapePdfText(text: string) {
  return text.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function createPdfDocument(title: string, lines: string[]) {
  const contentLines = [title, "", ...lines];
  const textContent = contentLines
    .map((line, index) => `${index === 0 ? "" : "T* "}(${escapePdfText(line || " ")}) Tj`)
    .join("\n");
  const streamBody = `BT\n/F1 12 Tf\n14 TL\n1 0 0 1 50 780 Tm\n${textContent}\nET`;
  const header = "%PDF-1.3\n";
  const objects = [
    "1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj",
    "2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj",
    "3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >> endobj",
    `4 0 obj << /Length ${streamBody.length} >> stream\n${streamBody}\nendstream endobj`,
    "5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj",
  ];
  let offset = header.length;
  const offsets: number[] = [];
  const body = objects
    .map((obj) => {
      offsets.push(offset);
      const chunk = `${obj}\n`;
      offset += chunk.length;
      return chunk;
    })
    .join("");
  const xrefStart = offset;
  const xrefEntries = offsets
    .map((value) => `${value.toString().padStart(10, "0")} 00000 n `)
    .join("\n");
  const xref = `xref\n0 6\n0000000000 65535 f \n${xrefEntries}\n`;
  const trailer = `trailer << /Size 6 /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;
  return `${header}${body}${xref}${trailer}`;
}

function dateToIsoWeek(date: Date) {
  const target = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNr = target.getUTCDay() || 7;
  target.setUTCDate(target.getUTCDate() + 4 - dayNr);
  const yearStart = new Date(Date.UTC(target.getUTCFullYear(), 0, 1));
  const weekNumber = Math.ceil(((target.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${target.getUTCFullYear()}-W${String(weekNumber).padStart(2, "0")}`;
}

function monthToDate(month: string) {
  const match = month.match(/^(\d{4})-(\d{2})$/);
  if (!match) return null;
  return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, 1));
}

function computePearson(pairs: { x: number; y: number }[]) {
  if (pairs.length < 2) return null;
  const n = pairs.length;
  const sumX = pairs.reduce((sum, pair) => sum + pair.x, 0);
  const sumY = pairs.reduce((sum, pair) => sum + pair.y, 0);
  const sumX2 = pairs.reduce((sum, pair) => sum + pair.x * pair.x, 0);
  const sumY2 = pairs.reduce((sum, pair) => sum + pair.y * pair.y, 0);
  const sumXY = pairs.reduce((sum, pair) => sum + pair.x * pair.y, 0);
  const numerator = n * sumXY - sumX * sumY;
  const denominator = Math.sqrt((n * sumX2 - sumX ** 2) * (n * sumY2 - sumY ** 2));
  if (!denominator) return null;
  return numerator / denominator;
}
export default function HomePage() {
  const today = formatDate(new Date());
  const defaultDailyDraft = useMemo(() => createEmptyDailyEntry(today), [today]);
  const defaultMonthlyDraft = useMemo(() => {
    const now = new Date();
    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    return createEmptyMonthlyEntry(month);
  }, []);
  const [dailyEntries, setDailyEntries, dailyStorage] = usePersistentState<DailyEntry[]>("endo.daily.v2", []);
  const [monthlyEntries, setMonthlyEntries, monthlyStorage] = usePersistentState<MonthlyEntry[]>("endo.monthly.v2", []);
  const [featureFlags, setFeatureFlags, featureStorage] = usePersistentState<FeatureFlags>("endo.flags.v1", {});
  const [sectionCompletionState, setSectionCompletionState, sectionCompletionStorage] =
    usePersistentState<SectionCompletionState>("endo.sectionCompletion.v1", {});

  const [dailyDraft, setDailyDraft, dailyDraftStorage] =
    usePersistentState<DailyEntry>("endo.draft.daily.v1", defaultDailyDraft);
  const [lastSavedDailySnapshot, setLastSavedDailySnapshot] = useState<DailyEntry>(() => createEmptyDailyEntry(today));
  const [pbacCounts, setPbacCounts] = useState<PbacCounts>({ ...PBAC_DEFAULT_COUNTS });
  const [pbacStep, setPbacStep] = useState(1);
  const [pbacSelection, setPbacSelection] = useState<{ product: PbacProduct | null; saturation: PbacSaturation | null }>(
    () => ({ product: null, saturation: null })
  );
  const [pbacCountDraft, setPbacCountDraft] = useState("0");
  const [sensorsVisible, setSensorsVisible] = useState(false);
  const [exploratoryVisible, setExploratoryVisible] = useState(false);
  const [notesTagDraft, setNotesTagDraft] = useState("");
  const [painQualityOther, setPainQualityOther] = useState("");
  const [trendXAxisMode, setTrendXAxisMode] = useState<"date" | "cycleDay">("date");
  const [dailySaveNotice, setDailySaveNotice] = useState<string | null>(null);
  const [weeklyReports, setWeeklyReports] = useState<WeeklyReport[]>([]);
  const [weeklyReportsReady, setWeeklyReportsReady] = useState(false);
  const [weeklyReportsError, setWeeklyReportsError] = useState<string | null>(null);
  const [weeklyReportsRevision, setWeeklyReportsRevision] = useState(0);

  const [monthlyDraft, setMonthlyDraft, monthlyDraftStorage] =
    usePersistentState<MonthlyEntry>("endo.draft.monthly.v1", defaultMonthlyDraft);

  const [draftStatus, setDraftStatus] = useState<string | null>(null);
  const draftStatusTimeoutRef = useRef<number | null>(null);
  const draftRestoredRef = useRef(false);
  const lastDraftSavedAtRef = useRef<number | null>(null);

  const isBirthdayGreetingDay = () => {
    const now = new Date();
    return now.getFullYear() === 2025 && now.getMonth() === 10 && now.getDate() === 10;
  };
  const [showBirthdayGreeting, setShowBirthdayGreeting] = useState(isBirthdayGreetingDay);
  const heartGradientReactId = useId();
  const heartGradientId = useMemo(
    () => `heart-gradient-${heartGradientReactId.replace(/:/g, "")}`,
    [heartGradientReactId]
  );

  const storageMetas = [
    dailyStorage,
    monthlyStorage,
    featureStorage,
    sectionCompletionStorage,
    dailyDraftStorage,
    monthlyDraftStorage,
  ];
  const storageReady = storageMetas.every((meta) => meta.ready);
  const storageErrors = storageMetas.map((meta) => meta.error).filter(Boolean) as string[];
  const storageDrivers = Array.from(new Set(storageMetas.map((meta) => meta.driverLabel)));
  const usesIndexedDb = storageMetas.every((meta) => meta.driver === "indexeddb");
  const hasMemoryFallback = storageMetas.some((meta) => meta.driver === "memory");
  const storageUnavailable = storageMetas.some((meta) => meta.driver === "unavailable");

  useEffect(() => {
    if (!dailyDraftStorage.ready) return;
    if (dailyDraftStorage.restored && !draftRestoredRef.current) {
      draftRestoredRef.current = true;
      setDraftStatus("Wiederhergestellt");
    }
  }, [dailyDraftStorage.ready, dailyDraftStorage.restored]);

  useEffect(() => {
    if (!dailyDraftStorage.ready) return;
    if (!dailyDraftStorage.lastSavedAt) return;
    if (lastDraftSavedAtRef.current && dailyDraftStorage.lastSavedAt <= lastDraftSavedAtRef.current) {
      return;
    }
    lastDraftSavedAtRef.current = dailyDraftStorage.lastSavedAt;
    setDraftStatus("Entwurf gespeichert");
  }, [dailyDraftStorage.lastSavedAt, dailyDraftStorage.ready]);

  useEffect(() => {
    if (!draftStatus) return;
    if (typeof window === "undefined") return;
    if (draftStatusTimeoutRef.current) {
      window.clearTimeout(draftStatusTimeoutRef.current);
    }
    draftStatusTimeoutRef.current = window.setTimeout(() => setDraftStatus(null), 2500);
    return () => {
      if (draftStatusTimeoutRef.current) {
        window.clearTimeout(draftStatusTimeoutRef.current);
        draftStatusTimeoutRef.current = null;
      }
    };
  }, [draftStatus]);

  useEffect(() => {
    let cancelled = false;
    setWeeklyReportsReady(false);
    setWeeklyReportsError(null);
    listWeeklyReports()
      .then((reports) => {
        if (cancelled) return;
        setWeeklyReports(reports);
        setWeeklyReportsReady(true);
      })
      .catch((error) => {
        if (cancelled) return;
        console.error("Wöchentliche Berichte konnten nicht geladen werden", error);
        setWeeklyReportsReady(true);
        setWeeklyReportsError("Wöchentliche Berichte konnten nicht geladen werden.");
      });
    return () => {
      cancelled = true;
    };
  }, [weeklyReportsRevision]);

  const refreshWeeklyReports = useCallback(() => {
    setWeeklyReportsRevision((prev) => prev + 1);
  }, []);

  const sectionCompletionContextValue = useMemo<SectionCompletionContextValue>(
    () => ({
      getCompletion: (scope, key) => {
        if (scope === null || scope === undefined) return false;
        const scopeKey = String(scope);
        return Boolean(sectionCompletionState[scopeKey]?.[key]);
      },
      setCompletion: (scope, key, completed) => {
        if (scope === null || scope === undefined) return;
        setSectionCompletionState((prev) => {
          const scopeKey = String(scope);
          const prevForScope = prev[scopeKey] ?? {};
          if (completed) {
            return {
              ...prev,
              [scopeKey]: { ...prevForScope, [key]: true },
            };
          }
          const { [key]: _removed, ...restForScope } = prevForScope;
          if (Object.keys(restForScope).length === 0) {
            const { [scopeKey]: _scopeRemoved, ...rest } = prev;
            return rest;
          }
          return {
            ...prev,
            [scopeKey]: restForScope,
          };
        });
      },
    }),
    [sectionCompletionState, setSectionCompletionState]
  );

  const [issues, setIssues] = useState<ValidationIssue[]>([]);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [persisted, setPersisted] = useState<boolean | null>(null);
  const [persistWarning, setPersistWarning] = useState<string | null>(null);
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showInstallHint, setShowInstallHint] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  const isDailyDirty = useMemo(
    () => JSON.stringify(dailyDraft) !== JSON.stringify(lastSavedDailySnapshot),
    [dailyDraft, lastSavedDailySnapshot]
  );

  const hasEntryForSelectedDate = useMemo(
    () => dailyEntries.some((entry) => entry.date === dailyDraft.date),
    [dailyEntries, dailyDraft.date]
  );

  useEffect(() => {
    if (!storageReady) return;
    if (isDailyDirty) return;
    if (dailyDraft.date >= today) return;
    const hasDraftEntry = dailyEntries.some((entry) => entry.date === dailyDraft.date);
    if (hasDraftEntry) return;
    const next = createEmptyDailyEntry(today);
    setDailyDraft(next);
    setLastSavedDailySnapshot(next);
  }, [storageReady, isDailyDirty, dailyDraft.date, dailyEntries, today, setDailyDraft, setLastSavedDailySnapshot]);

  useEffect(() => {
    if (typeof navigator === "undefined" || !("storage" in navigator) || !navigator.storage) {
      setPersisted(null);
      setPersistWarning("Persistent Storage API nicht verfügbar.");
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const alreadyPersisted = await navigator.storage.persisted();
        if (cancelled) return;
        setPersisted(alreadyPersisted);
        if (alreadyPersisted) {
          setPersistWarning(null);
          return;
        }
        if (typeof navigator.storage.persist === "function") {
          const granted = await navigator.storage.persist();
          if (cancelled) return;
          setPersisted(granted);
          setPersistWarning(granted ? null : "Persistente Speicherung konnte nicht aktiviert werden.");
        } else {
          setPersistWarning("Persistent Storage API unterstützt kein persist().");
        }
      } catch (error) {
        if (cancelled) return;
        setPersisted(false);
        setPersistWarning((error as Error).message ?? "Persistente Speicherung nicht möglich.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;
    if (!window.isSecureContext && window.location.hostname !== "localhost") return;
    navigator.serviceWorker
      .register("/sw.js")
      .catch((error) => console.warn("Service Worker Registrierung fehlgeschlagen", error));
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const nav = window.navigator as Navigator & { standalone?: boolean };

    const updateStandalone = () => {
      const standalone = Boolean(window.matchMedia?.("(display-mode: standalone)").matches || nav.standalone);
      setIsStandalone(standalone);
      if (!standalone) {
        setShowInstallHint(true);
      }
    };

    updateStandalone();

    const media = window.matchMedia?.("(display-mode: standalone)");
    const handleMediaChange = () => updateStandalone();
    if (media) {
      if (typeof media.addEventListener === "function") {
        media.addEventListener("change", handleMediaChange);
      } else if (typeof media.addListener === "function") {
        media.addListener(handleMediaChange);
      }
    }

    const handleBeforeInstall = (event: Event) => {
      event.preventDefault();
      const promptEvent = event as BeforeInstallPromptEvent;
      setInstallPrompt(promptEvent);
      setShowInstallHint(true);
    };
    const handleInstalled = () => {
      setInstallPrompt(null);
      setShowInstallHint(false);
      updateStandalone();
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstall);
    window.addEventListener("appinstalled", handleInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
      window.removeEventListener("appinstalled", handleInstalled);
      if (media) {
        if (typeof media.removeEventListener === "function") {
          media.removeEventListener("change", handleMediaChange);
        } else if (typeof media.removeListener === "function") {
          media.removeListener(handleMediaChange);
        }
      }
    };
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return;
    let lastWrite = 0;
    const performTouch = () => {
      const now = Date.now();
      if (now - lastWrite < 60000) return;
      lastWrite = now;
      touchLastActive(now).catch((error) => console.warn("Keepalive fehlgeschlagen", error));
    };
    const pointerHandler = () => performTouch();
    const keyHandler = () => performTouch();
    const visibilityHandler = () => {
      if (document.visibilityState === "visible") {
        performTouch();
      }
    };
    document.addEventListener("pointerdown", pointerHandler, { passive: true });
    document.addEventListener("keydown", keyHandler);
    document.addEventListener("visibilitychange", visibilityHandler);
    return () => {
      document.removeEventListener("pointerdown", pointerHandler);
      document.removeEventListener("keydown", keyHandler);
      document.removeEventListener("visibilitychange", visibilityHandler);
    };
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty("--endo-bg", hasEntryForSelectedDate ? SAVED_PAGE_BG : DEFAULT_PAGE_BG);
    return () => {
      root.style.setProperty("--endo-bg", DEFAULT_PAGE_BG);
    };
  }, [hasEntryForSelectedDate]);

  const selectedDateLabel = useMemo(() => {
    const parsed = parseIsoDate(dailyDraft.date);
    if (!parsed) return null;
    return parsed.toLocaleDateString("de-DE", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  }, [dailyDraft.date]);

  const selectedCycleDay = useMemo(() => {
    if (!dailyDraft.date) return null;
    const entries = dailyEntries.slice();
    const draftIndex = entries.findIndex((entry) => entry.date === dailyDraft.date);
    if (draftIndex >= 0) {
      if (isDailyDirty) {
        entries[draftIndex] = dailyDraft;
      }
    } else {
      entries.push(dailyDraft);
    }
    const sorted = entries.slice().sort((a, b) => a.date.localeCompare(b.date));
    let cycleDay: number | null = null;
    let previousDate: Date | null = null;
    let previousBleeding = false;
    for (const entry of sorted) {
      const currentDate = new Date(entry.date);
      if (Number.isNaN(currentDate.getTime())) {
        continue;
      }
      const diffDays = previousDate
        ? Math.round((currentDate.getTime() - previousDate.getTime()) / 86_400_000)
        : 0;
      if (cycleDay !== null && diffDays > 0) {
        cycleDay += diffDays;
      }
      const isBleeding = entry.bleeding.isBleeding;
      const bleedingStartsToday = isBleeding && (!previousBleeding || diffDays > 1 || cycleDay === null);
      if (bleedingStartsToday) {
        cycleDay = 1;
      }
      if (entry.date === dailyDraft.date) {
        return cycleDay;
      }
      previousDate = currentDate;
      previousBleeding = isBleeding;
    }
    return cycleDay;
  }, [dailyEntries, dailyDraft, isDailyDirty]);

  const canGoToNextDay = useMemo(() => dailyDraft.date < today, [dailyDraft.date, today]);

  const currentIsoWeek = useMemo(() => {
    const parsedToday = parseIsoDate(today);
    return parsedToday ? dateToIsoWeek(parsedToday) : dateToIsoWeek(new Date());
  }, [today]);

  const currentMonth = useMemo(() => today.slice(0, 7), [today]);
  const todayDate = useMemo(() => parseIsoDate(today), [today]);

  const isSunday = useMemo(() => {
    if (!todayDate) return false;
    return todayDate.getDay() === 0;
  }, [todayDate]);

  const selectedMonthLabel = useMemo(() => {
    const monthDate = monthToDate(monthlyDraft.month);
    if (!monthDate) return null;
    return monthDate.toLocaleDateString("de-DE", { month: "long", year: "numeric" });
  }, [monthlyDraft.month]);

  const canGoToNextMonth = useMemo(() => {
    const baseMonth = monthlyDraft.month || currentMonth;
    return baseMonth < currentMonth;
  }, [monthlyDraft.month, currentMonth]);

  const hasWeeklyReportForCurrentWeek = useMemo(
    () => weeklyReports.some((report) => report.isoWeekKey === currentIsoWeek),
    [weeklyReports, currentIsoWeek]
  );

  const hasMonthlyEntryForCurrentMonth = useMemo(
    () => monthlyEntries.some((entry) => entry.month === currentMonth),
    [monthlyEntries, currentMonth]
  );

  const goToPreviousDay = useCallback(() => {
    setDailyDraft((prev) => {
      const base = parseIsoDate(prev.date || today);
      if (!base) return prev;
      base.setDate(base.getDate() - 1);
      return { ...prev, date: formatDate(base) };
    });
  }, [setDailyDraft, today]);

  const goToNextDay = useCallback(() => {
    setDailyDraft((prev) => {
      if ((prev.date || today) >= today) {
        return prev;
      }
      const base = parseIsoDate(prev.date || today);
      if (!base) return prev;
      base.setDate(base.getDate() + 1);
      const nextDate = formatDate(base);
      if (nextDate > today) return prev;
      return { ...prev, date: nextDate };
    });
  }, [setDailyDraft, today]);

  const goToPreviousMonth = useCallback(() => {
    setMonthlyDraft((prev) => {
      const baseMonth = prev.month || currentMonth;
      const baseDate = monthToDate(baseMonth);
      if (!baseDate) return prev;
      baseDate.setUTCMonth(baseDate.getUTCMonth() - 1);
      const nextMonth = `${baseDate.getUTCFullYear()}-${String(baseDate.getUTCMonth() + 1).padStart(2, "0")}`;
      return { ...prev, month: nextMonth };
    });
  }, [currentMonth, setMonthlyDraft]);

  const goToNextMonth = useCallback(() => {
    setMonthlyDraft((prev) => {
      const baseMonth = prev.month || currentMonth;
      if (baseMonth >= currentMonth) {
        return prev;
      }
      const baseDate = monthToDate(baseMonth);
      if (!baseDate) return prev;
      baseDate.setUTCMonth(baseDate.getUTCMonth() + 1);
      const nextMonth = `${baseDate.getUTCFullYear()}-${String(baseDate.getUTCMonth() + 1).padStart(2, "0")}`;
      if (nextMonth > currentMonth) {
        return prev;
      }
      return { ...prev, month: nextMonth };
    });
  }, [currentMonth, setMonthlyDraft]);

  const hasEntryForSelectedMonth = useMemo(
    () => monthlyEntries.some((entry) => entry.month === monthlyDraft.month),
    [monthlyEntries, monthlyDraft.month]
  );

  const activeUrinary = Boolean(featureFlags.moduleUrinary);
  const activeHeadache = Boolean(featureFlags.moduleHeadache);
  const activeDizziness = Boolean(featureFlags.moduleDizziness);
  const dyscheziaSymptom = dailyDraft.symptoms.dyschezia;
  const dysuriaSymptom = dailyDraft.symptoms.dysuria;

  const pbacFlooding = dailyDraft.bleeding.flooding ?? false;
  const pbacScore = useMemo(() => computePbacScore(pbacCounts, pbacFlooding), [pbacCounts, pbacFlooding]);
  const currentPbacForNotice = dailyDraft.bleeding.isBleeding ? pbacScore : dailyDraft.bleeding.pbacScore ?? 0;
  const showDizzinessNotice =
    activeDizziness && dailyDraft.dizzinessOpt?.present && currentPbacForNotice >= HEAVY_BLEED_PBAC;
  const selectedPbacItem =
    pbacSelection.product && pbacSelection.saturation
      ? findPbacProductItem(pbacSelection.product, pbacSelection.saturation)
      : null;
  const phqSeverity = monthlyDraft.mental?.phq9Severity ?? mapPhqSeverity(monthlyDraft.mental?.phq9);
  const gadSeverity = monthlyDraft.mental?.gad7Severity ?? mapGadSeverity(monthlyDraft.mental?.gad7);

  useEffect(() => {
    if (!dailySaveNotice) return;
    const timeout = window.setTimeout(() => setDailySaveNotice(null), 3000);
    return () => window.clearTimeout(timeout);
  }, [dailySaveNotice]);

  useEffect(() => {
    if (dailyDraft.bleeding.isBleeding) {
      setDailyDraft((prev) => ({
        ...prev,
        bleeding: {
          ...prev.bleeding,
          pbacScore,
          clots: prev.bleeding.clots ?? false,
          flooding: prev.bleeding.flooding ?? false,
        },
      }));
    }
  }, [pbacScore, dailyDraft.bleeding.isBleeding, setDailyDraft]);

  useEffect(() => {
    const existingEntry = dailyEntries.find((entry) => entry.date === dailyDraft.date);
    if (!existingEntry) return;
    const serializedExisting = JSON.stringify(existingEntry);
    if (serializedExisting === JSON.stringify(lastSavedDailySnapshot)) {
      return;
    }
    if (serializedExisting === JSON.stringify(dailyDraft)) {
      setLastSavedDailySnapshot(existingEntry);
    }
  }, [dailyDraft, dailyEntries, lastSavedDailySnapshot]);

  useEffect(() => {
    if (activeUrinary) {
      setDailyDraft((prev) => {
        const urgency = prev.urinary?.urgency;
        if (urgency === undefined || prev.urinaryOpt?.urgency !== undefined) {
          return prev;
        }
        const nextUrinary = { ...(prev.urinary ?? {}) };
        delete nextUrinary.urgency;
        const cleanedUrinary = Object.keys(nextUrinary).length ? nextUrinary : undefined;
        return {
          ...prev,
          urinary: cleanedUrinary,
          urinaryOpt: { ...(prev.urinaryOpt ?? {}), urgency },
        };
      });
      return;
    }

    setDailyDraft((prev) => {
      if (!prev.urinaryOpt) return prev;
      const nextUrinaryOpt = { ...prev.urinaryOpt };
      const urgency = nextUrinaryOpt.urgency;
      delete nextUrinaryOpt.urgency;
      const cleanedOpt = Object.keys(nextUrinaryOpt).length ? nextUrinaryOpt : undefined;
      const nextUrinary =
        urgency !== undefined ? { ...(prev.urinary ?? {}), urgency } : prev.urinary;
      return {
        ...prev,
        urinary: nextUrinary,
        urinaryOpt: cleanedOpt,
      };
    });
  }, [activeUrinary, setDailyDraft]);

  useEffect(() => {
    if (!activeHeadache) {
      setDailyDraft((prev) => {
        if (!prev.headacheOpt) return prev;
        return { ...prev, headacheOpt: undefined };
      });
    }
  }, [activeHeadache, setDailyDraft]);

  useEffect(() => {
    if (!activeDizziness) {
      setDailyDraft((prev) => {
        if (!prev.dizzinessOpt) return prev;
        return { ...prev, dizzinessOpt: undefined };
      });
    }
  }, [activeDizziness, setDailyDraft]);

  const handleFeatureToggle = (key: keyof FeatureFlags, value: boolean) => {
    setFeatureFlags((prev) => ({ ...prev, [key]: value }));
    if (value) return;
    setDailyDraft((prev) => {
      if (key === "moduleUrinary") {
        return prev;
      }
      if (key === "moduleHeadache" && prev.headacheOpt) {
        return { ...prev, headacheOpt: undefined };
      }
      if (key === "moduleDizziness" && prev.dizzinessOpt) {
        return { ...prev, dizzinessOpt: undefined };
      }
      return prev;
    });
  };

  const handleAddTag = () => {
    if (!notesTagDraft.trim()) return;
    const tag = notesTagDraft.trim();
    setDailyDraft((prev) => ({
      ...prev,
      notesTags: Array.from(new Set([...(prev.notesTags ?? []), tag])),
    }));
    setNotesTagDraft("");
  };

  const handleRemoveTag = (tag: string) => {
    setDailyDraft((prev) => ({
      ...prev,
      notesTags: (prev.notesTags ?? []).filter((entry) => entry !== tag),
    }));
  };

  const buildDailyExportRow = useCallback(
    (entry: DailyEntry) => {
      const symptomScores = Object.entries(entry.symptoms ?? {})
        .map(([key, value]) => (value?.present && typeof value.score === "number" ? `${key}:${value.score}` : null))
        .filter(Boolean)
        .join(";");
      const row: Record<string, unknown> = {
        Datum: entry.date,
        [`${TERMS.nrs.label} (NRS)`]: entry.painNRS,
        Schmerzarten: entry.painQuality.join(";"),
        "Schmerzorte (IDs)": entry.painMapRegionIds.join(";"),
        [`${TERMS.ovulationPain.label} – Seite`]: entry.ovulationPain?.side ?? "",
        [`${TERMS.ovulationPain.label} – Intensität`]:
          typeof entry.ovulationPain?.intensity === "number" ? entry.ovulationPain.intensity : "",
        [`${TERMS.pbac.label}`]: entry.bleeding.pbacScore ?? "",
        "Symptom-Scores": symptomScores,
        [`${TERMS.sleep_quality.label}`]: entry.sleep?.quality ?? "",
        [`${TERMS.urinary_pain.label}`]:
          entry.symptoms?.dysuria?.present && typeof entry.symptoms.dysuria.score === "number"
            ? entry.symptoms.dysuria.score
            : "",
      };
      if (activeUrinary) {
        row.urinary_urgency = entry.urinaryOpt?.urgency ?? "";
        row.urinary_leaks = entry.urinaryOpt?.leaksCount ?? "";
        row.urinary_nocturia = entry.urinaryOpt?.nocturia ?? "";
      }
      if (activeHeadache) {
        row.headache_present = entry.headacheOpt?.present ?? false;
        row.headache_nrs = entry.headacheOpt?.nrs ?? "";
        row.headache_aura = entry.headacheOpt?.aura ?? false;
      }
      if (activeDizziness) {
        row.dizziness_present = entry.dizzinessOpt?.present ?? false;
        row.dizziness_nrs = entry.dizzinessOpt?.nrs ?? "";
        row.dizziness_orthostatic = entry.dizzinessOpt?.orthostatic ?? false;
      }
      return row;
    },
    [activeUrinary, activeHeadache, activeDizziness]
  );

  const goToPbacProduct = (product: PbacProduct, saturation: PbacSaturation) => {
    const item = findPbacProductItem(product, saturation);
    if (!item) return;
    setPbacSelection({ product, saturation });
    setPbacCountDraft(String(pbacCounts[item.id] ?? 0));
    setPbacStep(3);
  };

  const commitPbacCount = () => {
    if (!selectedPbacItem) return;
    const parsed = Math.max(0, Math.round(Number(pbacCountDraft) || 0));
    setPbacCounts((prev) => {
      if (prev[selectedPbacItem.id] === parsed) {
        return prev;
      }
      return { ...prev, [selectedPbacItem.id]: parsed };
    });
    setPbacCountDraft(String(parsed));
  };

  const handleEhp5ItemChange = (index: number, value: number | undefined) => {
    setMonthlyDraft((prev) => {
      const currentItems = prev.qol?.ehp5Items ?? Array(EHP5_ITEMS.length).fill(undefined);
      const nextItems = [...currentItems];
      nextItems[index] = value;
      const total = nextItems.reduce((sum, entry) => (typeof entry === "number" ? sum + entry : sum), 0);
      const allAnswered = nextItems.every((entry) => typeof entry === "number");
      const transformed = allAnswered ? Math.round((total / (EHP5_ITEMS.length * 4)) * 100) : undefined;
      return {
        ...prev,
        qol: {
          ...(prev.qol ?? {}),
          ehp5Items: nextItems,
          ehp5Total: allAnswered ? total : undefined,
          ehp5Transformed: transformed,
        },
      };
    });
  };

  const handlePhqItemChange = (index: number, value: number | undefined) => {
    setMonthlyDraft((prev) => {
      const currentMental = prev.mental ?? {};
      const currentItems = currentMental.phq9Items ?? Array(PHQ9_ITEMS.length).fill(undefined);
      const nextItems = [...currentItems];
      nextItems[index] = value;
      const total = nextItems.reduce((sum, entry) => (typeof entry === "number" ? sum + entry : sum), 0);
      const allAnswered = nextItems.every((entry) => typeof entry === "number");
      const computedTotal = allAnswered ? total : undefined;
      return {
        ...prev,
        mental: {
          ...currentMental,
          phq9Items: nextItems,
          phq9: computedTotal,
          phq9Severity: mapPhqSeverity(computedTotal),
        },
      };
    });
  };

  const handleGadItemChange = (index: number, value: number | undefined) => {
    setMonthlyDraft((prev) => {
      const currentMental = prev.mental ?? {};
      const currentItems = currentMental.gad7Items ?? Array(GAD7_ITEMS.length).fill(undefined);
      const nextItems = [...currentItems];
      nextItems[index] = value;
      const total = nextItems.reduce((sum, entry) => (typeof entry === "number" ? sum + entry : sum), 0);
      const allAnswered = nextItems.every((entry) => typeof entry === "number");
      const computedTotal = allAnswered ? total : undefined;
      return {
        ...prev,
        mental: {
          ...currentMental,
          gad7Items: nextItems,
          gad7: computedTotal,
          gad7Severity: mapGadSeverity(computedTotal),
        },
      };
    });
  };

  const handleDailySubmit = () => {
    const payload: DailyEntry = {
      ...dailyDraft,
      painQuality: dailyDraft.painQuality,
      bleeding: dailyDraft.bleeding.isBleeding
        ? {
            isBleeding: true,
            pbacScore,
            clots: dailyDraft.bleeding.clots ?? false,
            flooding: dailyDraft.bleeding.flooding ?? false,
          }
        : { isBleeding: false },
      meds: dailyDraft.meds.filter((med) => med.name.trim().length > 0),
      notesTags: painQualityOther
        ? Array.from(
            new Set([...(dailyDraft.notesTags ?? []), `Schmerz anders: ${painQualityOther.trim()}`])
          )
        : dailyDraft.notesTags,
    };

    if (payload.ovulationPain) {
      const { side, intensity } = payload.ovulationPain;
      if (!side) {
        delete (payload as { ovulationPain?: DailyEntry["ovulationPain"] }).ovulationPain;
      } else {
        const normalized: NonNullable<DailyEntry["ovulationPain"]> = { side };
        if (typeof intensity === "number") {
          normalized.intensity = Math.max(0, Math.min(10, Math.round(intensity)));
        }
        payload.ovulationPain = normalized;
      }
    }

    if (!activeUrinary) {
      delete (payload as { urinaryOpt?: DailyEntry["urinaryOpt"] }).urinaryOpt;
    } else if (payload.urinaryOpt) {
      const normalized: NonNullable<DailyEntry["urinaryOpt"]> = {};
      if (typeof payload.urinaryOpt.urgency === "number") {
        normalized.urgency = Math.max(0, Math.min(10, Math.round(payload.urinaryOpt.urgency)));
      }
      if (typeof payload.urinaryOpt.leaksCount === "number") {
        normalized.leaksCount = Math.max(0, Math.round(payload.urinaryOpt.leaksCount));
      }
      if (typeof payload.urinaryOpt.nocturia === "number") {
        normalized.nocturia = Math.max(0, Math.round(payload.urinaryOpt.nocturia));
      }
      payload.urinaryOpt = Object.keys(normalized).length ? normalized : undefined;
      if (!payload.urinaryOpt) {
        delete (payload as { urinaryOpt?: DailyEntry["urinaryOpt"] }).urinaryOpt;
      }
    }

    if (!activeHeadache) {
      delete (payload as { headacheOpt?: DailyEntry["headacheOpt"] }).headacheOpt;
    } else if (payload.headacheOpt) {
      const normalized: NonNullable<DailyEntry["headacheOpt"]> = {
        present: Boolean(payload.headacheOpt.present),
      };
      if (normalized.present && typeof payload.headacheOpt.nrs === "number") {
        normalized.nrs = Math.max(0, Math.min(10, Math.round(payload.headacheOpt.nrs)));
      }
      if (typeof payload.headacheOpt.aura === "boolean") {
        normalized.aura = payload.headacheOpt.aura;
      }
      const meds = (payload.headacheOpt.meds ?? [])
        .filter((med) => med.name.trim().length > 0)
        .map((med) => ({
          name: med.name.trim(),
          doseMg: typeof med.doseMg === "number" ? Math.max(0, Math.round(med.doseMg)) : undefined,
          time: med.time,
        }));
      if (meds.length) {
        normalized.meds = meds;
      }
      payload.headacheOpt = normalized;
    }

    if (!activeDizziness) {
      delete (payload as { dizzinessOpt?: DailyEntry["dizzinessOpt"] }).dizzinessOpt;
    } else if (payload.dizzinessOpt) {
      const normalized: NonNullable<DailyEntry["dizzinessOpt"]> = {
        present: Boolean(payload.dizzinessOpt.present),
      };
      if (normalized.present && typeof payload.dizzinessOpt.nrs === "number") {
        normalized.nrs = Math.max(0, Math.min(10, Math.round(payload.dizzinessOpt.nrs)));
      }
      if (typeof payload.dizzinessOpt.orthostatic === "boolean") {
        normalized.orthostatic = payload.dizzinessOpt.orthostatic;
      }
      payload.dizzinessOpt = normalized;
    }

    const validationIssues = validateDailyEntry(payload);
    setIssues(validationIssues);
    if (validationIssues.length) {
      setInfoMessage("Bitte prüfe die markierten Felder.");
      return;
    }

    setDailyEntries((prev) => {
      const filtered = prev.filter((entry) => entry.date !== payload.date);
      return [...filtered, payload].sort((a, b) => a.date.localeCompare(b.date));
    });

    setInfoMessage(null);
    setDailySaveNotice("Tagesdaten gespeichert.");
    const nextEmptyDailyEntry = createEmptyDailyEntry(today);
    setDailyDraft(nextEmptyDailyEntry);
    setLastSavedDailySnapshot(nextEmptyDailyEntry);
    setPbacCounts({ ...PBAC_DEFAULT_COUNTS });
    setPbacStep(1);
    setPbacSelection({ product: null, saturation: null });
    setPbacCountDraft("0");
    setPainQualityOther("");
    setNotesTagDraft("");
    setSensorsVisible(false);
    setExploratoryVisible(false);
    setIssues([]);
  };

  const handleMonthlySubmit = () => {
    const payload: MonthlyEntry = { ...monthlyDraft };
    if (payload.qol) {
      const items = payload.qol.ehp5Items ?? Array(EHP5_ITEMS.length).fill(undefined);
      const total = items.reduce((sum, entry) => (typeof entry === "number" ? sum + entry : sum), 0);
      const allAnswered = items.every((entry) => typeof entry === "number");
      payload.qol = {
        ...payload.qol,
        ehp5Items: items,
        ehp5Total: allAnswered ? total : undefined,
        ehp5Transformed: allAnswered ? Math.round((total / (EHP5_ITEMS.length * 4)) * 100) : undefined,
      };
    }
    if (payload.mental) {
      const phqItems = payload.mental.phq9Items ?? Array(PHQ9_ITEMS.length).fill(undefined);
      const phqAllAnswered = phqItems.every((entry) => typeof entry === "number");
      const phqTotal = phqItems.reduce((sum, entry) => (typeof entry === "number" ? sum + entry : sum), 0);
      const gadItems = payload.mental.gad7Items ?? Array(GAD7_ITEMS.length).fill(undefined);
      const gadAllAnswered = gadItems.every((entry) => typeof entry === "number");
      const gadTotal = gadItems.reduce((sum, entry) => (typeof entry === "number" ? sum + entry : sum), 0);
      payload.mental = {
        ...payload.mental,
        phq9Items: phqItems,
        phq9: phqAllAnswered ? phqTotal : undefined,
        phq9Severity: mapPhqSeverity(phqAllAnswered ? phqTotal : undefined),
        gad7Items: gadItems,
        gad7: gadAllAnswered ? gadTotal : undefined,
        gad7Severity: mapGadSeverity(gadAllAnswered ? gadTotal : undefined),
      };
    }
    const validationIssues = validateMonthlyEntry(payload);
    setIssues(validationIssues);
    if (validationIssues.length) {
      setInfoMessage("Monatliche Fragebögen prüfen.");
      return;
    }

    setMonthlyEntries((prev) => {
      const filtered = prev.filter((entry) => entry.month !== payload.month);
      return [...filtered, payload].sort((a, b) => a.month.localeCompare(b.month));
    });
    setInfoMessage("Monatsdaten gespeichert.");
    setIssues([]);
  };

  const handleDailyImport = (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.target;
    const file = input.files?.[0];
    if (!file) {
      input.value = "";
      return;
    }
    file
      .text()
      .then((text) => {
        try {
          const parsed = JSON.parse(text);
          if (!Array.isArray(parsed)) throw new Error("invalid");
          const normalized = parsed
            .filter((item): item is DailyEntry & Record<string, unknown> => typeof item === "object" && item !== null)
            .map((item) => normalizeImportedDailyEntry(item));
          const invalid = normalized.filter((entry) => validateDailyEntry(entry).length > 0);
          if (invalid.length) throw new Error("invalid");
          setDailyEntries(normalized);
          setInfoMessage("Tagesdaten importiert.");
        } catch {
          setInfoMessage("Import fehlgeschlagen.");
        }
      })
      .finally(() => {
        input.value = "";
      });
  };

  const handleBackupExport = () => {
    downloadFile(
      `endo-backup-${today}.json`,
      JSON.stringify(backupPayload, null, 2),
      "application/json"
    );
  };

  const handleBackupImport = (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.target;
    const file = input.files?.[0];
    if (!file) {
      input.value = "";
      return;
    }
    file
      .text()
      .then(async (text) => {
        try {
          const parsed = JSON.parse(text) as Partial<BackupPayload>;
          if (!parsed || typeof parsed !== "object") throw new Error("invalid");
          if (!Array.isArray(parsed.dailyEntries) || !Array.isArray(parsed.monthlyEntries)) {
            throw new Error("invalid");
          }
          const normalizedDaily = parsed.dailyEntries
            .filter((item): item is DailyEntry & Record<string, unknown> => typeof item === "object" && item !== null)
            .map((item) => normalizeImportedDailyEntry(item));
          if (normalizedDaily.some((entry) => validateDailyEntry(entry).length > 0)) {
            throw new Error("invalid");
          }
          const normalizedMonthly = parsed.monthlyEntries
            .filter((item): item is MonthlyEntry & Record<string, unknown> => typeof item === "object" && item !== null)
            .map((item) => normalizeImportedMonthlyEntry(item));
          if (normalizedMonthly.some((entry) => validateMonthlyEntry(entry).length > 0)) {
            throw new Error("invalid");
          }
          const weeklyReportsSource = Array.isArray(parsed.weeklyReports) ? parsed.weeklyReports : [];
          const normalizedWeeklyReports = weeklyReportsSource
            .map((item) => (item && typeof item === "object" ? normalizeImportedWeeklyReport(item as RawWeeklyReport) : null))
            .filter((report): report is WeeklyReport => report !== null);

          const flagsSource = parsed.featureFlags ?? {};
          const normalizedFlags: FeatureFlags = {};
          if (flagsSource && typeof flagsSource === "object") {
            if (typeof (flagsSource as FeatureFlags).moduleUrinary === "boolean") {
              normalizedFlags.moduleUrinary = (flagsSource as FeatureFlags).moduleUrinary;
            }
            if (typeof (flagsSource as FeatureFlags).moduleHeadache === "boolean") {
              normalizedFlags.moduleHeadache = (flagsSource as FeatureFlags).moduleHeadache;
            }
            if (typeof (flagsSource as FeatureFlags).moduleDizziness === "boolean") {
              normalizedFlags.moduleDizziness = (flagsSource as FeatureFlags).moduleDizziness;
            }
          }

          setDailyEntries(normalizedDaily);
          setMonthlyEntries(normalizedMonthly);
          setFeatureFlags(normalizedFlags);
          await replaceWeeklyReports(normalizedWeeklyReports);
          refreshWeeklyReports();
          setInfoMessage("Backup importiert.");
        } catch {
          setInfoMessage("Backup-Import fehlgeschlagen.");
        }
      })
      .finally(() => {
        input.value = "";
      });
  };

  const handleInstallClick = () => {
    if (!installPrompt) return;
    installPrompt
      .prompt()
      .catch(() => undefined)
      .then(() => installPrompt.userChoice.catch(() => undefined))
      .finally(() => {
        setInstallPrompt(null);
      });
  };

  const handleReportDownload = (months: number) => {
    const threshold = new Date();
    threshold.setHours(0, 0, 0, 0);
    threshold.setMonth(threshold.getMonth() - months);
    const thresholdIso = formatDate(threshold);
    const thresholdMonth = thresholdIso.slice(0, 7);
    const dailyFiltered = dailyEntries.filter((entry) => entry.date >= thresholdIso);
    const weeklyFiltered = weeklyReports
      .filter((report) => report.stats.endISO >= thresholdIso)
      .sort((a, b) => a.stats.startISO.localeCompare(b.stats.startISO));
    const monthlyFiltered = monthlyEntries.filter((entry) => entry.month >= thresholdMonth);

    const lines: string[] = [];
    lines.push(`Zeitraum: ${thresholdIso} bis ${today}`);
    lines.push(`Tagesdatensätze: ${dailyFiltered.length}`);
    if (dailyFiltered.length) {
      const avgPain = dailyFiltered.reduce((sum, entry) => sum + entry.painNRS, 0) / dailyFiltered.length;
      const maxPbac = dailyFiltered.reduce((max, entry) => Math.max(max, entry.bleeding.pbacScore ?? 0), 0);
      const sleepValues = dailyFiltered
        .map((entry) => entry.sleep?.quality)
        .filter((value): value is number => typeof value === "number");
      const avgSleep = sleepValues.length
        ? sleepValues.reduce((sum, value) => sum + value, 0) / sleepValues.length
        : null;
      const symptomCounts = new Map<string, number>();
      dailyFiltered.forEach((entry) => {
        Object.entries(entry.symptoms ?? {}).forEach(([key, value]) => {
          if (value?.present) {
            symptomCounts.set(key, (symptomCounts.get(key) ?? 0) + 1);
          }
        });
      });
      const commonSymptoms = Array.from(symptomCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([key, count]) => `${key}: ${count} Tage`)
        .join(", ");
      lines.push(`Ø ${TERMS.nrs.label}: ${avgPain.toFixed(1)}`);
      lines.push(`Max ${TERMS.pbac.label}: ${maxPbac}`);
      if (avgSleep !== null) {
        lines.push(`Ø ${TERMS.sleep_quality.label}: ${avgSleep.toFixed(1)}`);
      }
      if (commonSymptoms) {
        lines.push(`Häufige Symptome: ${commonSymptoms}`);
      }
      if (activeUrinary && urinaryStats) {
        if (urinaryStats.leakRate !== null) {
          lines.push(`Blase/Drang – Tage mit Leckage: ${urinaryStats.leakRate.toFixed(1)}%`);
        }
        if (urinaryStats.avgUrgency !== null) {
          lines.push(`Blase/Drang – Ø Harndrang: ${urinaryStats.avgUrgency.toFixed(1)}`);
        }
        if (urinaryStats.avgNocturia !== null) {
          lines.push(`Blase/Drang – Ø Nocturia: ${urinaryStats.avgNocturia.toFixed(1)}`);
        }
      }
      if (activeHeadache && headacheStats) {
        if (headacheStats.avgPerMonth !== null) {
          lines.push(`Kopfschmerz-/Migränetage pro Monat: ${headacheStats.avgPerMonth.toFixed(1)}`);
        }
        if (headacheStats.avgNrs !== null) {
          lines.push(`Ø Kopfschmerz (0–10): ${headacheStats.avgNrs.toFixed(1)}`);
        }
      }
      if (activeDizziness && dizzinessStats) {
        if (dizzinessStats.avgPerMonth !== null) {
          lines.push(`Schwindeltage pro Monat: ${dizzinessStats.avgPerMonth.toFixed(1)}`);
        }
        if (dizzinessStats.avgNrs !== null) {
          lines.push(`Ø Schwindel (0–10): ${dizzinessStats.avgNrs.toFixed(1)}`);
        }
        lines.push(
          `Schwindel an starken Blutungstagen: ${dizzinessStats.heavyDays}/${dizzinessStats.presentDays || 0}`
        );
      }
    } else {
      lines.push("Keine Tagesdaten im Zeitraum.");
    }

    if (weeklyFiltered.length) {
      const latest = weeklyFiltered[weeklyFiltered.length - 1];
      lines.push(
        `Letzte Wochenübersicht (${latest.stats.startISO} – ${latest.stats.endISO}): Ø Schmerz ${
          typeof latest.stats.avgPain === "number" ? latest.stats.avgPain.toFixed(1) : "–"
        } | Max Schmerz ${
          typeof latest.stats.maxPain === "number" ? latest.stats.maxPain.toFixed(1) : "–"
        } | Schwere Tage ${latest.stats.badDaysCount} | Blutungstage ${latest.stats.bleedingDaysCount}`
      );
    } else {
      lines.push("Keine wöchentlichen Berichte im Zeitraum.");
    }

    if (monthlyFiltered.length) {
      const latest = monthlyFiltered[monthlyFiltered.length - 1];
      lines.push(`${TERMS.ehp5.label}: ${latest.qol?.ehp5Total ?? "–"}`);
      lines.push(`${TERMS.phq9.label}: ${latest.mental?.phq9 ?? "–"}`);
      lines.push(`${TERMS.gad7.label}: ${latest.mental?.gad7 ?? "–"}`);
      if (latest.promis?.fatigueT !== undefined) {
        lines.push(`${TERMS.promis_fatigue.label}: ${latest.promis.fatigueT}`);
      }
      if (latest.promis?.painInterferenceT !== undefined) {
        lines.push(`${TERMS.promis_painInt.label}: ${latest.promis.painInterferenceT}`);
      }
    } else {
      lines.push("Keine monatlichen Fragebögen im Zeitraum.");
    }

    lines.push("", "Glossar:");
    const glossaryKeys: TermKey[] = ["nrs", "pbac", "ehp5", "phq9", "gad7", "promis_fatigue", "promis_painInt"];
    glossaryKeys.forEach((key) => {
      const term = TERMS[key];
      lines.push(`- ${term.label}: ${term.help}`);
    });

    if (activeUrinary) {
      lines.push(
        `- ${MODULE_TERMS.urinaryOpt.urgency.label}: ${MODULE_TERMS.urinaryOpt.urgency.help}`,
        `- ${MODULE_TERMS.urinaryOpt.leaksCount.label}: ${MODULE_TERMS.urinaryOpt.leaksCount.help}`,
        `- ${MODULE_TERMS.urinaryOpt.nocturia.label}: ${MODULE_TERMS.urinaryOpt.nocturia.help}`
      );
    }
    if (activeHeadache) {
      lines.push(
        `- ${MODULE_TERMS.headacheOpt.present.label}: ${MODULE_TERMS.headacheOpt.present.help}`,
        `- ${MODULE_TERMS.headacheOpt.nrs.label}: ${MODULE_TERMS.headacheOpt.nrs.help}`,
        `- ${MODULE_TERMS.headacheOpt.aura.label}: ${MODULE_TERMS.headacheOpt.aura.help}`
      );
    }
    if (activeDizziness) {
      lines.push(
        `- ${MODULE_TERMS.dizzinessOpt.present.label}: ${MODULE_TERMS.dizzinessOpt.present.help}`,
        `- ${MODULE_TERMS.dizzinessOpt.nrs.label}: ${MODULE_TERMS.dizzinessOpt.nrs.help}`,
        `- ${MODULE_TERMS.dizzinessOpt.orthostatic.label}: ${MODULE_TERMS.dizzinessOpt.orthostatic.help}`
      );
    }

    const pdf = createPdfDocument(`Endo-Report ${months} Monate`, lines);
    downloadFile(`endo-report-${months}m.pdf`, pdf, "application/pdf");
  };

  const annotatedDailyEntries = useMemo(() => {
    const sorted = dailyEntries.slice().sort((a, b) => a.date.localeCompare(b.date));
    let cycleDay: number | null = null;
    let previousDate: Date | null = null;
    let previousBleeding = false;
    return sorted.map((entry) => {
      const currentDate = new Date(entry.date);
      const diffDays = previousDate
        ? Math.round((currentDate.getTime() - previousDate.getTime()) / 86_400_000)
        : 0;
      if (cycleDay !== null && diffDays > 0) {
        cycleDay += diffDays;
      }
      const isBleeding = entry.bleeding.isBleeding;
      const bleedingStartsToday = isBleeding && (!previousBleeding || diffDays > 1 || cycleDay === null);
      if (bleedingStartsToday) {
        cycleDay = 1;
      }
      const assignedCycleDay = cycleDay;
      const weekday = currentDate.toLocaleDateString("de-DE", { weekday: "short" });
      const symptomScores = Object.values(entry.symptoms ?? {}).flatMap((symptom) => {
        if (!symptom || !symptom.present) return [] as number[];
        return typeof symptom.score === "number" ? [symptom.score] : [];
      });
      const symptomAverage = symptomScores.length
        ? symptomScores.reduce((sum, value) => sum + value, 0) / symptomScores.length
        : null;
      previousDate = currentDate;
      previousBleeding = isBleeding;
      return { entry, cycleDay: assignedCycleDay, weekday, symptomAverage };
    });
  }, [dailyEntries]);

  const latestCycleStartDate = useMemo(() => {
    for (let index = annotatedDailyEntries.length - 1; index >= 0; index -= 1) {
      const item = annotatedDailyEntries[index];
      if (item.cycleDay === 1) {
        return parseIsoDate(item.entry.date);
      }
    }
    return null;
  }, [annotatedDailyEntries]);

  const isMonthlyReminderDue = useMemo(() => {
    if (!latestCycleStartDate || !todayDate) return false;
    const diffMs = todayDate.getTime() - latestCycleStartDate.getTime();
    if (diffMs < 0) return false;
    const diffDays = Math.floor(diffMs / 86_400_000);
    return diffDays >= 28;
  }, [latestCycleStartDate, todayDate]);

  const showWeeklyReminderBadge =
    storageReady && weeklyReportsReady && isSunday && !hasWeeklyReportForCurrentWeek;
  const showMonthlyReminderBadge =
    storageReady && isMonthlyReminderDue && !hasMonthlyEntryForCurrentMonth;

  const weeklyBannerText = isSunday
    ? "Es ist Sonntag. Zeit für deinen wöchentlichen Check In."
    : "Fülle diese Fragen möglichst jeden Sonntag aus.";

  const painTrendData = useMemo(
    () =>
      annotatedDailyEntries.map(({ entry, cycleDay, weekday, symptomAverage }) => ({
        date: entry.date,
        cycleDay,
        cycleLabel: cycleDay ? `ZT ${cycleDay}` : "–",
        weekday,
        pain: entry.painNRS,
        pbac: entry.bleeding.pbacScore ?? null,
        symptomAverage,
        sleepQuality: entry.sleep?.quality ?? null,
      })),
    [annotatedDailyEntries]
  );

  const renderIssuesForPath = (path: string) =>
    issues.filter((issue) => issue.path === path).map((issue) => (
      <p key={issue.message} className="text-xs text-rose-600">
        {issue.message}
      </p>
    ));

  const optionalSensorsLabel = sensorsVisible ? "Optional (Hilfsmittel) ausblenden" : "Optional (Hilfsmittel) einblenden";

  const cycleOverlay = useMemo(() => {
    const bucket = new Map<
      number,
      {
        painSum: number;
        symptomSum: number;
        count: number;
        sleepSum: number;
        pbacSum: number;
        pbacCount: number;
        urgencySum: number;
        urgencyCount: number;
        headacheSum: number;
        headacheCount: number;
        dizzinessSum: number;
        dizzinessCount: number;
      }
    >();
    annotatedDailyEntries.forEach(({ entry, cycleDay, symptomAverage }) => {
      if (!cycleDay) return;
      const current =
        bucket.get(cycleDay) ??
        {
          painSum: 0,
          symptomSum: 0,
          count: 0,
          sleepSum: 0,
          pbacSum: 0,
          pbacCount: 0,
          urgencySum: 0,
          urgencyCount: 0,
          headacheSum: 0,
          headacheCount: 0,
          dizzinessSum: 0,
          dizzinessCount: 0,
        };
      current.painSum += entry.painNRS;
      current.count += 1;
      if (typeof symptomAverage === "number") {
        current.symptomSum += symptomAverage;
      }
      if (typeof entry.sleep?.quality === "number") {
        current.sleepSum += entry.sleep.quality;
      }
      if (typeof entry.bleeding.pbacScore === "number") {
        current.pbacSum += entry.bleeding.pbacScore;
        current.pbacCount += 1;
      }
      if (typeof entry.urinaryOpt?.urgency === "number") {
        current.urgencySum += entry.urinaryOpt.urgency;
        current.urgencyCount += 1;
      }
      if (entry.headacheOpt?.present && typeof entry.headacheOpt.nrs === "number") {
        current.headacheSum += entry.headacheOpt.nrs;
        current.headacheCount += 1;
      }
      if (entry.dizzinessOpt?.present && typeof entry.dizzinessOpt.nrs === "number") {
        current.dizzinessSum += entry.dizzinessOpt.nrs;
        current.dizzinessCount += 1;
      }
      bucket.set(cycleDay, current);
    });
    return Array.from(bucket.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([cycleDay, stats]) => ({
        cycleDay,
        painAvg: Number((stats.painSum / stats.count).toFixed(1)),
        symptomAvg: stats.symptomSum ? Number((stats.symptomSum / stats.count).toFixed(1)) : null,
        sleepAvg: stats.sleepSum ? Number((stats.sleepSum / stats.count).toFixed(1)) : null,
        pbacAvg: stats.pbacCount ? Number((stats.pbacSum / stats.pbacCount).toFixed(1)) : null,
        urgencyAvg: stats.urgencyCount ? Number((stats.urgencySum / stats.urgencyCount).toFixed(1)) : null,
        headacheAvg: stats.headacheCount ? Number((stats.headacheSum / stats.headacheCount).toFixed(1)) : null,
        dizzinessAvg: stats.dizzinessCount ? Number((stats.dizzinessSum / stats.dizzinessCount).toFixed(1)) : null,
      }));
  }, [annotatedDailyEntries]);

  const weekdayOverlay = useMemo(() => {
    const order = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
    const bucket = new Map<string, { painSum: number; count: number }>();
    annotatedDailyEntries.forEach(({ entry, weekday }) => {
      if (!weekday) return;
      const current = bucket.get(weekday) ?? { painSum: 0, count: 0 };
      current.painSum += entry.painNRS;
      current.count += 1;
      bucket.set(weekday, current);
    });
    return order
      .filter((day) => bucket.has(day))
      .map((day) => {
        const stats = bucket.get(day)!;
        return { weekday: day, painAvg: Number((stats.painSum / stats.count).toFixed(1)) };
      });
  }, [annotatedDailyEntries]);

  const correlations = useMemo(() => {
    const sleepPairs = annotatedDailyEntries
      .map(({ entry }) => ({ x: entry.sleep?.quality, y: entry.painNRS }))
      .filter((pair): pair is { x: number; y: number } => typeof pair.x === "number");
    const stepsPairs = dailyEntries
      .filter((entry) => typeof entry.activity?.steps === "number")
      .map((entry) => ({ x: entry.activity!.steps as number, y: entry.painNRS }));
    return {
      sleep: { r: computePearson(sleepPairs), n: sleepPairs.length },
      steps: { r: computePearson(stepsPairs), n: stepsPairs.length },
    };
  }, [annotatedDailyEntries, dailyEntries]);

  const dailyCsvRows = useMemo(
    () => dailyEntries.map((entry) => buildDailyExportRow(entry)),
    [dailyEntries, buildDailyExportRow]
  );

  const jsonExportData = useMemo(
    () =>
      dailyEntries.map((entry) => ({
        ...entry,
        urinary_urgency: activeUrinary ? entry.urinaryOpt?.urgency ?? null : undefined,
        urinary_leaks: activeUrinary ? entry.urinaryOpt?.leaksCount ?? null : undefined,
        urinary_nocturia: activeUrinary ? entry.urinaryOpt?.nocturia ?? null : undefined,
        ovulation_pain_side: entry.ovulationPain?.side ?? null,
        ovulation_pain_intensity:
          typeof entry.ovulationPain?.intensity === "number" ? entry.ovulationPain.intensity : null,
        headache_present: activeHeadache ? entry.headacheOpt?.present ?? null : undefined,
        headache_nrs: activeHeadache ? entry.headacheOpt?.nrs ?? null : undefined,
        headache_aura: activeHeadache ? entry.headacheOpt?.aura ?? null : undefined,
        dizziness_present: activeDizziness ? entry.dizzinessOpt?.present ?? null : undefined,
        dizziness_nrs: activeDizziness ? entry.dizzinessOpt?.nrs ?? null : undefined,
        dizziness_orthostatic: activeDizziness ? entry.dizzinessOpt?.orthostatic ?? null : undefined,
      })),
    [dailyEntries, activeUrinary, activeHeadache, activeDizziness]
  );

  const backupPayload = useMemo<BackupPayload>(
    () => ({
      version: 1,
      exportedAt: new Date().toISOString(),
      dailyEntries,
      weeklyReports,
      monthlyEntries,
      featureFlags,
    }),
    [dailyEntries, weeklyReports, monthlyEntries, featureFlags]
  );

  const urinaryTrendData = useMemo(() => {
    if (!activeUrinary) return [] as Array<{ date: string; cycleDay: number | null; urgency: number | null }>;
    return annotatedDailyEntries.map(({ entry, cycleDay }) => ({
      date: entry.date,
      cycleDay,
      urgency: typeof entry.urinaryOpt?.urgency === "number" ? entry.urinaryOpt.urgency : null,
    }));
  }, [annotatedDailyEntries, activeUrinary]);

  const urinaryMonthlyRates = useMemo(() => {
    if (!activeUrinary) return [] as Array<{ month: string; leakRate: number }>;
    const bucket = new Map<string, { days: number; leakDays: number }>();
    dailyEntries.forEach((entry) => {
      if (!entry.urinaryOpt) return;
      const month = entry.date.slice(0, 7);
      const stats = bucket.get(month) ?? { days: 0, leakDays: 0 };
      stats.days += 1;
      if ((entry.urinaryOpt.leaksCount ?? 0) > 0) {
        stats.leakDays += 1;
      }
      bucket.set(month, stats);
    });
    return Array.from(bucket.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([month, stats]) => ({
        month,
        leakRate: stats.days ? Number(((stats.leakDays / stats.days) * 100).toFixed(1)) : 0,
      }));
  }, [dailyEntries, activeUrinary]);

  const urinaryStats = useMemo(() => {
    if (!activeUrinary) return null;
    const relevant = dailyEntries.filter((entry) => entry.urinaryOpt);
    if (!relevant.length) return null;
    const urgencyValues = relevant
      .map((entry) => entry.urinaryOpt?.urgency)
      .filter((value): value is number => typeof value === "number");
    const nocturiaValues = relevant
      .map((entry) => entry.urinaryOpt?.nocturia)
      .filter((value): value is number => typeof value === "number");
    const leakDays = relevant.filter((entry) => (entry.urinaryOpt?.leaksCount ?? 0) > 0).length;
    return {
      avgUrgency: urgencyValues.length
        ? Number((urgencyValues.reduce((sum, value) => sum + value, 0) / urgencyValues.length).toFixed(1))
        : null,
      avgNocturia: nocturiaValues.length
        ? Number((nocturiaValues.reduce((sum, value) => sum + value, 0) / nocturiaValues.length).toFixed(1))
        : null,
      leakRate: relevant.length ? Number(((leakDays / relevant.length) * 100).toFixed(1)) : null,
    };
  }, [activeUrinary, dailyEntries]);

  const headacheTrendData = useMemo(() => {
    if (!activeHeadache) return [] as Array<{ date: string; cycleDay: number | null; nrs: number | null }>;
    return annotatedDailyEntries.map(({ entry, cycleDay }) => ({
      date: entry.date,
      cycleDay,
      nrs:
        entry.headacheOpt?.present && typeof entry.headacheOpt.nrs === "number" ? entry.headacheOpt.nrs : null,
    }));
  }, [annotatedDailyEntries, activeHeadache]);

  const headacheMonthlyRates = useMemo(() => {
    if (!activeHeadache) return [] as Array<{ month: string; rate: number }>;
    const bucket = new Map<string, { days: number; headacheDays: number }>();
    dailyEntries.forEach((entry) => {
      if (!entry.headacheOpt) return;
      const month = entry.date.slice(0, 7);
      const stats = bucket.get(month) ?? { days: 0, headacheDays: 0 };
      stats.days += 1;
      if (entry.headacheOpt.present) {
        stats.headacheDays += 1;
      }
      bucket.set(month, stats);
    });
    return Array.from(bucket.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([month, stats]) => ({
        month,
        rate: stats.days ? Number(((stats.headacheDays / stats.days) * 100).toFixed(1)) : 0,
      }));
  }, [dailyEntries, activeHeadache]);

  const headacheStats = useMemo(() => {
    if (!activeHeadache) return null;
    const relevant = dailyEntries.filter((entry) => entry.headacheOpt);
    if (!relevant.length) return null;
    const months = new Map<string, { headacheDays: number }>();
    let headacheDaysTotal = 0;
    const nrsValues: number[] = [];
    relevant.forEach((entry) => {
      const month = entry.date.slice(0, 7);
      const stats = months.get(month) ?? { headacheDays: 0 };
      if (entry.headacheOpt?.present) {
        stats.headacheDays += 1;
        headacheDaysTotal += 1;
        if (typeof entry.headacheOpt.nrs === "number") {
          nrsValues.push(entry.headacheOpt.nrs);
        }
      }
      months.set(month, stats);
    });
    const avgPerMonth = months.size ? Number((headacheDaysTotal / months.size).toFixed(1)) : null;
    const avgNrs = nrsValues.length
      ? Number((nrsValues.reduce((sum, value) => sum + value, 0) / nrsValues.length).toFixed(1))
      : null;
    return { avgPerMonth, avgNrs };
  }, [activeHeadache, dailyEntries]);

  const dizzinessTrendData = useMemo(() => {
    if (!activeDizziness) return [] as Array<{ date: string; cycleDay: number | null; nrs: number | null }>;
    return annotatedDailyEntries.map(({ entry, cycleDay }) => ({
      date: entry.date,
      cycleDay,
      nrs:
        entry.dizzinessOpt?.present && typeof entry.dizzinessOpt.nrs === "number" ? entry.dizzinessOpt.nrs : null,
    }));
  }, [annotatedDailyEntries, activeDizziness]);

  const dizzinessScatterData = useMemo(() => {
    if (!activeDizziness) return [] as Array<{ date: string; pbac: number; nrs: number }>;
    return dailyEntries
      .filter((entry) => entry.dizzinessOpt?.present && typeof entry.dizzinessOpt.nrs === "number")
      .map((entry) => ({
        date: entry.date,
        pbac: entry.bleeding.pbacScore ?? 0,
        nrs: entry.dizzinessOpt!.nrs!,
      }));
  }, [dailyEntries, activeDizziness]);

  const dizzinessStats = useMemo(() => {
    if (!activeDizziness) return null;
    const relevant = dailyEntries.filter((entry) => entry.dizzinessOpt);
    if (!relevant.length) return null;
    const presentDays = relevant.filter((entry) => entry.dizzinessOpt?.present).length;
    const nrsValues = relevant
      .filter((entry) => entry.dizzinessOpt?.present && typeof entry.dizzinessOpt.nrs === "number")
      .map((entry) => entry.dizzinessOpt!.nrs!);
    const heavyDays = relevant.filter(
      (entry) => entry.dizzinessOpt?.present && isHeavyBleedToday(entry)
    ).length;
    const months = new Map<string, { dizzinessDays: number }>();
    relevant.forEach((entry) => {
      if (!entry.dizzinessOpt) return;
      const month = entry.date.slice(0, 7);
      const stats = months.get(month) ?? { dizzinessDays: 0 };
      if (entry.dizzinessOpt.present) {
        stats.dizzinessDays += 1;
      }
      months.set(month, stats);
    });
    const avgPerMonth = months.size
      ? Number(
          (
            Array.from(months.values()).reduce((sum, value) => sum + value.dizzinessDays, 0) / months.size
          ).toFixed(1)
        )
      : null;
    const avgNrs = nrsValues.length
      ? Number((nrsValues.reduce((sum, value) => sum + value, 0) / nrsValues.length).toFixed(1))
      : null;
    return { avgPerMonth, avgNrs, presentDays, heavyDays };
  }, [activeDizziness, dailyEntries]);

  const storageStatusMessages = useMemo(() => {
    const messages = new Set<string>();
    if (!storageReady) {
      messages.add("Speicher wird initialisiert …");
    }
    storageErrors.forEach((message) => {
      if (message) messages.add(message);
    });
    if (hasMemoryFallback) {
      messages.add("IndexedDB blockiert – Speicherung aktuell nur temporär.");
    }
    if (storageUnavailable) {
      messages.add("Browser erlaubt keinen Zugriff auf persistente Speicherung.");
    }
    if (persistWarning) {
      messages.add(persistWarning);
    }
    return Array.from(messages);
  }, [hasMemoryFallback, persistWarning, storageErrors, storageReady, storageUnavailable]);

  const storageDriverText = storageDrivers.length ? storageDrivers.join(", ") : "unbekannt";
  const persistedLabel =
    persisted === true ? "dauerhaft aktiv" : persisted === false ? "nicht dauerhaft" : "Status unbekannt";
  const persistedBadgeClass =
    persisted === true ? "bg-emerald-100 text-emerald-700" : persisted === false ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-600";
  const storageIsIndexedDb = storageDriverText.toLowerCase() === "indexeddb";
  const storagePersisted = persisted === true;
  const storageCompactPossible = storageIsIndexedDb && storagePersisted && storageStatusMessages.length === 0;
  const [storageDetailsExpanded, setStorageDetailsExpanded] = useState(!storageCompactPossible);

  useEffect(() => {
    if (!storageCompactPossible) {
      setStorageDetailsExpanded(true);
    } else {
      setStorageDetailsExpanded(false);
    }
  }, [storageCompactPossible]);
  const installHintVisible = showInstallHint && !isStandalone;

  return (
    <>
      {showBirthdayGreeting && (
        <div
          className="fixed inset-0 z-[100] flex flex-col bg-gradient-to-br from-rose-50 via-white to-rose-100 px-6 py-12 text-center"
          role="dialog"
          aria-modal="true"
        >
          <div className="flex flex-1 flex-col items-center justify-center gap-8">
            <h1 className="text-4xl font-extrabold tracking-tight text-rose-700 sm:text-5xl">
              Alles Liebe zum Geburtstag!
            </h1>
            <div className="heart-3d-container">
              <div className="heart-3d">
                <svg viewBox="0 0 512 512" className="h-full w-full" aria-hidden="true" focusable="false">
                  <defs>
                    <linearGradient id={heartGradientId} x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#f9a8d4" />
                      <stop offset="50%" stopColor="#f472b6" />
                      <stop offset="100%" stopColor="#db2777" />
                    </linearGradient>
                  </defs>
                  <path
                    d="M256 464l-35.35-32.33C118.6 343.5 48 279.4 48 196.6 48 131 99 80 164.5 80c37.5 0 73.5 17.7 96 45.2C283.9 97.7 319.9 80 357.4 80 423 80 474 131 474 196.6c0 82.8-70.6 146.9-172.7 235.1L256 464z"
                    fill={`url(#${heartGradientId})`}
                  />
                </svg>
              </div>
            </div>
          </div>
          <Button
            type="button"
            onClick={() => setShowBirthdayGreeting(false)}
            className="mx-auto mt-auto w-full max-w-xs rounded-full bg-rose-600 py-4 text-lg font-semibold shadow-lg transition hover:bg-rose-500"
          >
            weiter zur App
          </Button>
        </div>
      )}
      <SectionCompletionContext.Provider value={sectionCompletionContextValue}>
        <main className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-8">
        <header className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold text-rose-900">Endometriose Symptomtracker</h1>
          <p className="text-sm text-rose-700">Dein persönlicher Endometriose tracker</p>
          {infoMessage && <p className="text-sm font-medium text-rose-600">{infoMessage}</p>}
        </header>

        {storageCompactPossible && !storageDetailsExpanded ? (
          <button
            type="button"
            onClick={() => setStorageDetailsExpanded(true)}
            className="flex w-fit items-center gap-2 rounded-full bg-emerald-100 px-4 py-2 text-[11px] font-semibold text-emerald-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:ring-offset-2"
          >
            <ShieldCheck className="h-3.5 w-3.5" /> lokale Speicherung aktiv
          </button>
        ) : (
          <div className="space-y-3 rounded-lg border border-rose-200 bg-white p-4 shadow-sm">
            {storageCompactPossible && (
              <div className="flex items-start justify-between gap-2 rounded-md bg-emerald-50 p-3 text-xs text-emerald-700">
                <p className="font-medium">Solange die App installiert ist, bleiben die Daten dauerhaft gespeichert.</p>
                <button
                  type="button"
                  onClick={() => setStorageDetailsExpanded(false)}
                  className="text-[11px] font-semibold uppercase tracking-wide text-emerald-600 transition hover:text-emerald-700"
                >
                  Ausblenden
                </button>
              </div>
            )}
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="flex flex-wrap items-center gap-3 text-sm text-rose-700">
                <span className="flex items-center gap-2 font-medium text-rose-800">
                  <HardDrive className="h-4 w-4 text-rose-500" /> Speicher: {storageDriverText}
                </span>
                <span className={cn("flex items-center gap-1 rounded-full px-3 py-1 text-[11px] font-semibold", persistedBadgeClass)}>
                  <ShieldCheck className="h-3.5 w-3.5" /> {persistedLabel}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button type="button" variant="outline" className="text-rose-700" onClick={handleBackupExport}>
                  <Download className="mr-2 h-4 w-4" /> Daten exportieren
                </Button>
                <label className="flex cursor-pointer items-center gap-2 rounded-md border border-rose-200 px-3 py-2 text-sm text-rose-700 hover:bg-rose-50">
                  <Upload className="h-4 w-4" /> Daten importieren
                  <input type="file" accept="application/json" className="hidden" onChange={handleBackupImport} />
                </label>
              </div>
            </div>
            {storageStatusMessages.length > 0 && (
              <div className="space-y-1 text-xs text-amber-700">
                {storageStatusMessages.map((message) => (
                  <div key={message} className="flex items-start gap-2">
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-amber-500" />
                    <span>{message}</span>
                  </div>
                ))}
              </div>
            )}
            {installHintVisible && (
              <div className="flex flex-col gap-2 rounded-md bg-rose-50 p-3 text-xs text-rose-700 sm:flex-row sm:items-center sm:justify-between">
                <span className="flex items-center gap-2 font-medium text-rose-700">
                  <Smartphone className="h-4 w-4 text-rose-500" /> Zum Home-Bildschirm hinzufügen für Offline-Nutzung.
                </span>
                {installPrompt ? (
                  <Button type="button" size="sm" onClick={handleInstallClick} className="self-start sm:self-auto">
                    <Home className="mr-2 h-4 w-4" /> Installieren
                  </Button>
                ) : (
                  <span className="rounded-full bg-rose-100 px-3 py-1 text-[11px] font-medium text-rose-600">
                    Im Browser-Menü „Zum Home-Bildschirm“ wählen.
                  </span>
                )}
              </div>
            )}
          </div>
        )}

      <Tabs defaultValue="daily" className="w-full">
        <TabsList className="grid h-auto w-full grid-cols-1 gap-2 bg-rose-100 text-rose-700 sm:h-10 sm:grid-cols-3">
          <TabsTrigger value="daily" className="gap-2">
            Täglicher Check-in
          </TabsTrigger>
          <TabsTrigger value="weekly" className="gap-2">
            Wöchentlich
            {showWeeklyReminderBadge ? (
              <Badge className="bg-amber-400 text-rose-900" aria-label="Wöchentlicher Check-in fällig">
                fällig
              </Badge>
            ) : null}
          </TabsTrigger>
          <TabsTrigger value="monthly" className="gap-2">
            Monatlich
            {showMonthlyReminderBadge ? (
              <Badge className="bg-amber-400 text-rose-900" aria-label="Monatlicher Check-in fällig">
                fällig
              </Badge>
            ) : null}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="daily" className="space-y-6">
          <SectionScopeContext.Provider value={`daily:${dailyDraft.date}`}>
          <Section
            title="Tagescheck-in"
            description="Schmerz → Körperkarte → Symptome → Blutung → Medikation → Schlaf → Darm/Blase → Notizen"
            aside={<Badge className="bg-rose-200 text-rose-700">max. 60 Sekunden</Badge>}
            variant="plain"
            completionEnabled={false}
          >
            <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
              <div className="space-y-6">
                <div className="grid gap-4">
                  <Label className="text-sm font-medium text-rose-800">Datum</Label>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
                    <div className="flex w-full max-w-xl items-center justify-between gap-2 rounded-lg border border-rose-200 bg-white px-3 py-2 shadow-sm">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={goToPreviousDay}
                        aria-label="Vorheriger Tag"
                        className="text-rose-500 hover:text-rose-700"
                      >
                        <ChevronLeft className="h-5 w-5" />
                      </Button>
                      <div className="flex min-w-0 flex-1 items-center gap-3 text-left">
                        <CalendarDays className="h-6 w-6 flex-shrink-0 text-rose-500" />
                        <div className="min-w-0">
                          <p className="text-xs uppercase tracking-wide text-rose-400">Ausgewählter Tag</p>
                          <div className="flex items-center gap-2">
                            <p className="truncate text-sm font-semibold text-rose-700">
                              {selectedDateLabel ?? "Bitte Datum wählen"}
                            </p>
                            {selectedCycleDay !== null && (
                              <Badge className="flex-shrink-0 bg-rose-200 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-rose-700">
                                ZT {selectedCycleDay}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={goToNextDay}
                        aria-label="Nächster Tag"
                        className="text-rose-500 hover:text-rose-700"
                        disabled={!canGoToNextDay}
                      >
                        <ChevronRight className="h-5 w-5" />
                      </Button>
                    </div>
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-rose-400" aria-hidden="true" />
                      <Input
                        type="date"
                        value={dailyDraft.date}
                        onChange={(event) => setDailyDraft({ ...dailyDraft, date: event.target.value })}
                        className="w-full max-w-[11rem]"
                        max={today}
                        aria-label="Datum direkt auswählen"
                      />
                    </div>
                  </div>
                  {hasEntryForSelectedDate && (
                    <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                      <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-500" />
                      <div>
                        <p className="font-semibold">Für dieses Datum wurden bereits Angaben gespeichert.</p>
                        <p className="text-xs text-amber-600">Beim Speichern werden die bestehenden Daten aktualisiert.</p>
                      </div>
                    </div>
                  )}
                  {renderIssuesForPath("date")}
                </div>

                <Section
                  title={`${TERMS.nrs.label} (NRS)`}
                  description="Numerische Schmerzskala 0–10 – ganzzahlige Eingabe"
                >
                  <ScoreInput
                    id="pain-nrs"
                    label={TERMS.nrs.label}
                    termKey="nrs"
                    value={dailyDraft.painNRS}
                    onChange={(value) =>
                      setDailyDraft((prev) => ({ ...prev, painNRS: Math.max(0, Math.min(10, Math.round(value))) }))
                    }
                  />
                  {renderIssuesForPath("painNRS")}
                  <div className="grid gap-4 md:grid-cols-2">
                    <TermField termKey="painQuality">
                      <div className="space-y-2">
                        <MultiSelectChips
                          options={PAIN_QUALITIES.map((quality) => ({ value: quality, label: quality }))}
                          value={dailyDraft.painQuality}
                          onToggle={(next) =>
                            setDailyDraft((prev) => ({ ...prev, painQuality: next as DailyEntry["painQuality"] }))
                          }
                        />
                        {dailyDraft.painQuality.includes("anders") && (
                          <Input
                            placeholder="Beschreibe den Schmerz"
                            value={painQualityOther}
                            onChange={(event) => setPainQualityOther(event.target.value)}
                          />
                        )}
                      </div>
                      {dailyDraft.painQuality.map((_, index) => renderIssuesForPath(`painQuality[${index}]`))}
                    </TermField>
                    <div className="space-y-4">
                      <TermField termKey="bodyMap">
                        <BodyMap
                          value={dailyDraft.painMapRegionIds}
                          onChange={(next) => setDailyDraft((prev) => ({ ...prev, painMapRegionIds: next }))}
                        />
                        {renderIssuesForPath("painMapRegionIds")}
                      </TermField>
                      <TermField termKey="ovulationPain">
                        <div className="space-y-3">
                          <Select
                            value={dailyDraft.ovulationPain?.side ?? ""}
                            onValueChange={(value) =>
                              setDailyDraft((prev) => {
                                if (!value) {
                                  if (!prev.ovulationPain) {
                                    return prev;
                                  }
                                  return { ...prev, ovulationPain: undefined };
                                }
                                return {
                                  ...prev,
                                  ovulationPain: {
                                    side: value as NonNullable<DailyEntry["ovulationPain"]>["side"],
                                    intensity: prev.ovulationPain?.intensity,
                                  },
                                };
                              })
                            }
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Auswählen" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="">Keine Auswahl</SelectItem>
                              <SelectItem value="links">Links</SelectItem>
                              <SelectItem value="rechts">Rechts</SelectItem>
                              <SelectItem value="beidseitig">Beidseitig</SelectItem>
                              <SelectItem value="unsicher">Unsicher</SelectItem>
                            </SelectContent>
                          </Select>
                          {renderIssuesForPath("ovulationPain.side")}
                          {dailyDraft.ovulationPain?.side ? (
                            <>
                              <ScoreInput
                                id="ovulation-pain-intensity"
                                label="Intensität (0–10)"
                                value={dailyDraft.ovulationPain?.intensity ?? 0}
                                onChange={(value) =>
                                  setDailyDraft((prev) => {
                                    const side = prev.ovulationPain?.side;
                                    if (!side) {
                                      return prev;
                                    }
                                    return {
                                      ...prev,
                                      ovulationPain: {
                                        side,
                                        intensity: Math.max(0, Math.min(10, Math.round(value))),
                                      },
                                    };
                                  })
                                }
                              />
                              {renderIssuesForPath("ovulationPain.intensity")} 
                            </>
                          ) : null}
                        </div>
                      </TermField>
                    </div>
                  </div>
                </Section>

                <Section
                  title="Typische Endometriose-Symptome"
                  description="Je Symptom: Ja/Nein plus Stärke auf der 0–10 Skala"
                >
                  <div className="grid gap-4">
                    {SYMPTOM_ITEMS.map((item) => {
                      const symptom = dailyDraft.symptoms[item.key] ?? { present: false };
                      const term: TermDescriptor = TERMS[item.termKey];
                      return (
                        <div key={item.key} className="rounded-lg border border-rose-100 bg-rose-50 p-4">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <p className="font-medium text-rose-800">{term.label}</p>
                              <InfoTip tech={term.tech ?? term.label} help={term.help} />
                            </div>
                            <div className="flex items-center gap-2">
                              <Label className="text-xs text-rose-600">vorhanden</Label>
                              <Switch
                                checked={symptom.present}
                                onCheckedChange={(checked) =>
                                  setDailyDraft((prev) => ({
                                    ...prev,
                                    symptoms: {
                                      ...prev.symptoms,
                                      [item.key]: checked ? { present: true, score: symptom.score ?? 0 } : { present: false },
                                    },
                                  }))
                                }
                              />
                            </div>
                          </div>
                          {symptom.present && (
                            <div className="mt-3">
                              <ScoreInput
                                id={`symptom-${item.key}`}
                                label={`${term.label} – Stärke (0–10)`}
                                value={symptom.score ?? 0}
                                onChange={(value) =>
                                  setDailyDraft((prev) => ({
                                    ...prev,
                                    symptoms: {
                                      ...prev.symptoms,
                                      [item.key]: {
                                        present: true,
                                        score: Math.max(0, Math.min(10, Math.round(value))),
                                      },
                                    },
                                  }))
                                }
                              />
                              {renderIssuesForPath(`symptoms.${item.key}.score`)}
                            </div>
                          )}
                          {renderIssuesForPath(`symptoms.${item.key}.present`)}
                        </div>
                      );
                    })}
                    {SYMPTOM_MODULE_TOGGLES.map((toggle) => (
                      <ModuleToggleRow
                        key={toggle.key}
                        label={toggle.label}
                        tech={toggle.term.tech}
                        help={toggle.term.help}
                        checked={Boolean(featureFlags[toggle.key])}
                        onCheckedChange={(checked) => handleFeatureToggle(toggle.key, checked)}
                      />
                    ))}
                  </div>
                </Section>

                <Section title={`${TERMS.bleeding_active.label} & ${TERMS.pbac.label}`}>
                  <div className="flex flex-wrap items-center gap-3">
                    <TermHeadline termKey="bleeding_active" />
                    <Switch
                      checked={dailyDraft.bleeding.isBleeding}
                      onCheckedChange={(checked) => {
                        setDailyDraft((prev) =>
                          checked
                            ? { ...prev, bleeding: { isBleeding: true, clots: false, flooding: false, pbacScore } }
                            : { ...prev, bleeding: { isBleeding: false } }
                        );
                        if (!checked) {
                          setPbacCounts({ ...PBAC_DEFAULT_COUNTS });
                          setPbacStep(1);
                          setPbacSelection({ product: null, saturation: null });
                          setPbacCountDraft("0");
                        }
                      }}
                    />
                  </div>
                  {dailyDraft.bleeding.isBleeding && (
                    <div className="space-y-4">
                      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">
                        <span>PBAC-Wizard • Schritt {pbacStep} von 5</span>
                        <span>Aktueller Score: {pbacScore}</span>
                      </div>
                      {pbacStep === 1 && (
                        <div className="space-y-3">
                          <TermHeadline termKey="pbac" />
                          <div className="grid gap-2 sm:grid-cols-2">
                            {PBAC_PRODUCT_OPTIONS.map((option) => (
                              <button
                                key={option.id}
                                type="button"
                                onClick={() => {
                                  setPbacSelection({ product: option.id, saturation: null });
                                  setPbacStep(2);
                                }}
                                className={cn(
                                  "rounded border px-3 py-2 text-left text-sm transition",
                                  pbacSelection.product === option.id
                                    ? "border-rose-400 bg-rose-100 text-rose-700"
                                    : "border-rose-100 bg-white text-rose-600 hover:border-rose-300"
                                )}
                              >
                                {option.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                      {pbacStep === 2 && (
                        <div className="space-y-3">
                          <TermHeadline termKey="pbac" />
                          <div className="grid grid-cols-3 gap-2">
                            {PBAC_SATURATION_OPTIONS.map((option) => (
                              <button
                                key={option.id}
                                type="button"
                                disabled={!pbacSelection.product}
                                onClick={() => pbacSelection.product && goToPbacProduct(pbacSelection.product, option.id)}
                                className={cn(
                                  "rounded border px-3 py-2 text-sm transition",
                                  pbacSelection.saturation === option.id
                                    ? "border-rose-400 bg-rose-100 text-rose-700"
                                    : "border-rose-100 bg-white text-rose-600 hover:border-rose-300",
                                  !pbacSelection.product ? "opacity-50" : ""
                                )}
                              >
                                {option.label}
                              </button>
                            ))}
                          </div>
                          <div className="flex justify-start">
                            <Button type="button" variant="ghost" onClick={() => setPbacStep(1)}>
                              Zurück
                            </Button>
                          </div>
                        </div>
                      )}
                      {pbacStep === 3 && selectedPbacItem && (
                        <div className="space-y-4">
                          <Labeled
                            label={`Anzahl ${selectedPbacItem.label}`}
                            tech={TERMS.pbac.tech}
                            help={TERMS.pbac.help}
                            htmlFor="pbac-count"
                          >
                            <Input
                              id="pbac-count"
                              type="number"
                              min={0}
                              step={1}
                              value={pbacCountDraft}
                              onChange={(event) => setPbacCountDraft(event.target.value)}
                            />
                          </Labeled>
                          <div className="flex flex-wrap items-center gap-2">
                            <Button type="button" variant="ghost" onClick={() => setPbacStep(2)}>
                              Zurück
                            </Button>
                            <div className="ml-auto flex flex-wrap gap-2">
                              <Button
                                type="button"
                                variant="outline"
                                onClick={() => {
                                  commitPbacCount();
                                  setPbacSelection({ product: null, saturation: null });
                                  setPbacCountDraft("0");
                                  setPbacStep(1);
                                }}
                              >
                                Weiteres Produkt
                              </Button>
                              <Button
                                type="button"
                                onClick={() => {
                                  commitPbacCount();
                                  setPbacStep(4);
                                }}
                              >
                                Weiter zu Koageln
                              </Button>
                            </div>
                          </div>
                          <div className="space-y-2 rounded border border-rose-100 bg-rose-50 p-3 text-xs text-rose-700">
                            <p className="font-semibold text-rose-800">Bisher erfasste Produkte</p>
                            {PBAC_PRODUCT_ITEMS.some((item) => pbacCounts[item.id] > 0) ? (
                              PBAC_PRODUCT_ITEMS.map((item) =>
                                pbacCounts[item.id] > 0 ? (
                                  <div key={item.id} className="flex flex-wrap items-center justify-between gap-2">
                                    <span>
                                      {pbacCounts[item.id]} × {item.label}
                                    </span>
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="ghost"
                                      className="h-auto px-2 py-0 text-xs text-rose-600"
                                      onClick={() => goToPbacProduct(item.product, item.saturation)}
                                    >
                                      Bearbeiten
                                    </Button>
                                  </div>
                                ) : null
                              )
                            ) : (
                              <p className="text-rose-500">Noch keine Produkte dokumentiert.</p>
                            )}
                          </div>
                        </div>
                      )}
                      {pbacStep === 4 && (
                        <div className="space-y-3">
                          <TermHeadline termKey="clots" />
                          <div className="grid gap-3 sm:grid-cols-2">
                            {PBAC_CLOT_ITEMS.map((item) => (
                              <Labeled
                                key={item.id}
                                label={item.label}
                                tech={TERMS.clots.tech}
                                help={TERMS.clots.help}
                                htmlFor={item.id}
                              >
                            <Input
                              id={item.id}
                              type="number"
                              min={0}
                              step={1}
                              value={String(pbacCounts[item.id] ?? 0)}
                              onChange={(event) => {
                                const nextValue = Math.max(0, Math.round(Number(event.target.value) || 0));
                                const updatedCounts: PbacCounts = { ...pbacCounts, [item.id]: nextValue };
                                setPbacCounts(updatedCounts);
                                setDailyDraft((prev) => ({
                                  ...prev,
                                  bleeding: {
                                    ...prev.bleeding,
                                    clots: (updatedCounts.clot_small ?? 0) + (updatedCounts.clot_large ?? 0) > 0,
                                  },
                                }));
                              }}
                            />
                          </Labeled>
                        ))}
                          </div>
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <Button type="button" variant="ghost" onClick={() => setPbacStep(3)}>
                              Zurück
                            </Button>
                            <Button type="button" onClick={() => setPbacStep(5)}>
                              Weiter zu Flooding
                            </Button>
                          </div>
                        </div>
                      )}
                      {pbacStep === 5 && (
                        <div className="space-y-3">
                          <TermField termKey="flooding">
                            <div className="flex items-center gap-3">
                              <Switch
                                checked={pbacFlooding}
                                onCheckedChange={(checked) =>
                                  setDailyDraft((prev) => ({
                                    ...prev,
                                    bleeding: { ...prev.bleeding, flooding: checked },
                                  }))
                                }
                              />
                              <span className="text-sm text-rose-700">Flooding heute beobachtet?</span>
                            </div>
                            {renderIssuesForPath("bleeding.flooding")}
                          </TermField>
                          <div className="space-y-2 rounded border border-rose-100 bg-rose-50 p-3 text-xs text-rose-700">
                            <p className="font-semibold text-rose-800">PBAC-Zusammenfassung</p>
                            <p className="text-sm">Score heute: {pbacScore}</p>
                            <div className="space-y-1">
                              {PBAC_PRODUCT_ITEMS.filter((item) => pbacCounts[item.id] > 0).map((item) => (
                                <div key={item.id} className="flex flex-wrap items-center justify-between gap-2">
                                  <span>
                                    {pbacCounts[item.id]} × {item.label}
                                  </span>
                                  <span className="font-semibold text-rose-800">+{pbacCounts[item.id] * item.score}</span>
                                </div>
                              ))}
                              {PBAC_CLOT_ITEMS.filter((item) => pbacCounts[item.id] > 0).map((item) => (
                                <div key={item.id} className="flex flex-wrap items-center justify-between gap-2">
                                  <span>
                                    {pbacCounts[item.id]} × {item.label}
                                  </span>
                                  <span className="font-semibold text-rose-800">+{pbacCounts[item.id] * item.score}</span>
                                </div>
                              ))}
                              {pbacFlooding ? (
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <span>Flooding</span>
                                  <span className="font-semibold text-rose-800">+{PBAC_FLOODING_SCORE}</span>
                                </div>
                              ) : null}
                              {PBAC_PRODUCT_ITEMS.every((item) => pbacCounts[item.id] === 0) &&
                              PBAC_CLOT_ITEMS.every((item) => pbacCounts[item.id] === 0) &&
                              !pbacFlooding ? (
                                <p className="text-rose-500">Noch keine PBAC-Daten erfasst.</p>
                              ) : null}
                            </div>
                          </div>
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <Button type="button" variant="ghost" onClick={() => setPbacStep(4)}>
                              Zurück
                            </Button>
                            <Button
                              type="button"
                              onClick={() => {
                                setPbacStep(1);
                                setPbacSelection({ product: null, saturation: null });
                                setPbacCountDraft("0");
                              }}
                            >
                              Wizard schließen
                            </Button>
                          </div>
                        </div>
                      )}
                      <div className="space-y-1 text-xs text-rose-600">
                        {renderIssuesForPath("bleeding.pbacScore")}
                        {renderIssuesForPath("bleeding.clots")}
                      </div>
                    </div>
                  )}
                </Section>

                <Section title={TERMS.meds.label} description="Eingenommene Medikamente & Hilfen des Tages">
                  <div className="grid gap-4">
                    <TermHeadline termKey="meds" />
                    {dailyDraft.meds.map((med, index) => (
                      <div key={index} className="grid gap-2 rounded-lg border border-rose-100 bg-rose-50 p-4">
                        <div className="grid gap-1">
                          <Label htmlFor={`med-name-${index}`}>Präparat / Hilfe</Label>
                          <Input
                            id={`med-name-${index}`}
                            value={med.name}
                            onChange={(event) => {
                              const updated = [...dailyDraft.meds];
                              updated[index] = { ...updated[index], name: event.target.value };
                              setDailyDraft((prev) => ({ ...prev, meds: updated }));
                            }}
                          />
                          {renderIssuesForPath(`meds[${index}].name`)}
                        </div>
                        <div className="grid gap-1 sm:grid-cols-2">
                          <div>
                            <Label htmlFor={`med-dose-${index}`}>Dosis (mg)</Label>
                            <Input
                              id={`med-dose-${index}`}
                              type="number"
                              min={0}
                              value={med.doseMg ?? ""}
                              onChange={(event) => {
                                const updated = [...dailyDraft.meds];
                                const nextValue = event.target.value ? Number(event.target.value) : undefined;
                                updated[index] = { ...updated[index], doseMg: nextValue };
                                setDailyDraft((prev) => ({ ...prev, meds: updated }));
                              }}
                            />
                            {renderIssuesForPath(`meds[${index}].doseMg`)}
                          </div>
                          <div>
                            <Label htmlFor={`med-times-${index}`}>Einnahmezeiten (HH:MM, kommasepariert)</Label>
                            <Input
                              id={`med-times-${index}`}
                              placeholder="08:00, 14:00"
                              value={(med.times ?? []).join(", ")}
                              onChange={(event) => {
                                const times = event.target.value
                                  .split(",")
                                  .map((value) => value.trim())
                                  .filter(Boolean);
                                const updated = [...dailyDraft.meds];
                                updated[index] = { ...updated[index], times };
                                setDailyDraft((prev) => ({ ...prev, meds: updated }));
                              }}
                            />
                          </div>
                        </div>
                        <div>
                          <Button
                            type="button"
                            variant="ghost"
                            className="text-xs text-rose-600"
                            onClick={() => {
                              setDailyDraft((prev) => ({
                                ...prev,
                                meds: prev.meds.filter((_, i) => i !== index),
                              }));
                            }}
                          >
                            Entfernen
                          </Button>
                        </div>
                      </div>
                    ))}
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() =>
                        setDailyDraft((prev) => ({
                          ...prev,
                          meds: [...prev.meds, { name: "", doseMg: undefined, times: [] }],
                        }))
                      }
                    >
                      + Medikament oder Hilfe ergänzen
                    </Button>
                    <div className="grid gap-2">
                      <TermField termKey="rescue" htmlFor="rescue-count">
                        <Input
                          id="rescue-count"
                          type="number"
                          min={0}
                          step={1}
                          value={dailyDraft.rescueDosesCount ?? ""}
                          onChange={(event) =>
                            setDailyDraft((prev) => ({
                              ...prev,
                              rescueDosesCount: event.target.value ? Number(event.target.value) : undefined,
                            }))
                          }
                        />
                        {renderIssuesForPath("rescueDosesCount")}
                      </TermField>
                    </div>
                  </div>
                </Section>

                <Section title="Schlaf" description="Kurzabfrage ohne Hilfsmittel">
                  <div className="grid gap-4 md:grid-cols-3">
                    <TermField termKey="sleep_hours" htmlFor="sleep-hours">
                      <Input
                        id="sleep-hours"
                        type="number"
                        min={0}
                        max={24}
                        step={0.25}
                        value={dailyDraft.sleep?.hours ?? ""}
                        onChange={(event) =>
                          setDailyDraft((prev) => ({
                            ...prev,
                            sleep: { ...(prev.sleep ?? {}), hours: event.target.value ? Number(event.target.value) : undefined },
                          }))
                        }
                      />
                      {renderIssuesForPath("sleep.hours")}
                    </TermField>
                    <div>
                      <ScoreInput
                        id="sleep-quality"
                        label={TERMS.sleep_quality.label}
                        termKey="sleep_quality"
                        value={dailyDraft.sleep?.quality ?? 0}
                        onChange={(value) =>
                          setDailyDraft((prev) => ({
                            ...prev,
                            sleep: {
                              ...(prev.sleep ?? {}),
                              quality: Math.max(0, Math.min(10, Math.round(value))),
                            },
                          }))
                        }
                      />
                      {renderIssuesForPath("sleep.quality")}
                    </div>
                    <TermField termKey="awakenings" htmlFor="sleep-awakenings">
                      <Input
                        id="sleep-awakenings"
                        type="number"
                        min={0}
                        step={1}
                        value={dailyDraft.sleep?.awakenings ?? ""}
                        onChange={(event) =>
                          setDailyDraft((prev) => ({
                            ...prev,
                            sleep: {
                              ...(prev.sleep ?? {}),
                              awakenings: event.target.value ? Number(event.target.value) : undefined,
                            },
                          }))
                        }
                      />
                      {renderIssuesForPath("sleep.awakenings")}
                    </TermField>
                  </div>
                </Section>

                <Section title="Darm & Blase" description="Situativ erfassbar">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="grid gap-3 rounded-lg border border-rose-100 bg-rose-50 p-4">
                      <p className="font-medium text-rose-800">Darm</p>
                      <TermField termKey="bristol">
                        <Select
                          value={dailyDraft.gi?.bristolType ? String(dailyDraft.gi.bristolType) : ""}
                          onValueChange={(value) =>
                            setDailyDraft((prev) => ({
                              ...prev,
                              gi: {
                                ...(prev.gi ?? {}),
                                bristolType: value ? (Number(value) as 1 | 2 | 3 | 4 | 5 | 6 | 7) : undefined,
                              },
                            }))
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Auswählen" />
                          </SelectTrigger>
                          <SelectContent>
                            {BRISTOL_TYPES.map((item) => (
                              <SelectItem key={item.value} value={String(item.value)}>
                                {item.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {renderIssuesForPath("gi.bristolType")}
                      </TermField>
                      <ScoreInput
                        id="bowel-pain"
                        label={TERMS.bowelPain.label}
                        termKey="bowelPain"
                        value={dyscheziaSymptom?.score ?? 0}
                        onChange={(value) =>
                          setDailyDraft((prev) => ({
                            ...prev,
                            symptoms: {
                              ...prev.symptoms,
                              dyschezia: {
                                present: true,
                                score: Math.max(0, Math.min(10, Math.round(value))),
                              },
                            },
                          }))
                        }
                        disabled={!dyscheziaSymptom?.present}
                      />
                      {renderIssuesForPath("symptoms.dyschezia.score")}
                      {!dyscheziaSymptom?.present ? (
                        <p className="text-xs text-rose-600">
                          Aktiviere „{TERMS.dyschezia.label}“ im Symptomblock, um hier einen Wert zu sehen.
                        </p>
                      ) : null}
                    </div>
                    <div className="grid gap-3 rounded-lg border border-rose-100 bg-rose-50 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="font-medium text-rose-800">Blase</p>
                        <ModuleToggleRow
                          label="Dranginkontinenz"
                          tech={MODULE_TERMS.urinaryOpt.urgency.tech}
                          help={MODULE_TERMS.urinaryOpt.urgency.help}
                          checked={activeUrinary}
                          onCheckedChange={(checked) => handleFeatureToggle("moduleUrinary", checked)}
                          className="bg-white/60"
                        />
                      </div>
                      <TermField termKey="urinary_freq" htmlFor="urinary-frequency">
                        <Input
                          id="urinary-frequency"
                          type="number"
                          min={0}
                          step={1}
                          value={dailyDraft.urinary?.freqPerDay ?? ""}
                          onChange={(event) =>
                            setDailyDraft((prev) => ({
                              ...prev,
                              urinary: {
                                ...(prev.urinary ?? {}),
                                freqPerDay: event.target.value ? Number(event.target.value) : undefined,
                              },
                            }))
                          }
                        />
                        {renderIssuesForPath("urinary.freqPerDay")}
                      </TermField>
                      {activeUrinary ? (
                        <InlineNotice
                          title="Harndrang im Modul"
                          text="Spezifische Harndrang- und Leckagewerte findest du unten im Dranginkontinenz-Modul."
                        />
                      ) : (
                        <>
                          <ScoreInput
                            id="urinary-urgency"
                            label={TERMS.urinary_urgency.label}
                            termKey="urinary_urgency"
                            value={dailyDraft.urinary?.urgency ?? 0}
                            onChange={(value) =>
                              setDailyDraft((prev) => ({
                                ...prev,
                                urinary: {
                                  ...(prev.urinary ?? {}),
                                  urgency: Math.max(0, Math.min(10, Math.round(value))),
                                },
                              }))
                            }
                          />
                          {renderIssuesForPath("urinary.urgency")}
                        </>
                      )}
                      <ScoreInput
                        id="urinary-pain"
                        label={TERMS.urinary_pain.label}
                        termKey="urinary_pain"
                        value={dysuriaSymptom?.score ?? 0}
                        onChange={(value) =>
                          setDailyDraft((prev) => ({
                            ...prev,
                            symptoms: {
                              ...prev.symptoms,
                              dysuria: {
                                present: true,
                                score: Math.max(0, Math.min(10, Math.round(value))),
                              },
                            },
                          }))
                        }
                        disabled={!dysuriaSymptom?.present}
                      />
                      {renderIssuesForPath("symptoms.dysuria.score")}
                      {!dysuriaSymptom?.present ? (
                        <p className="text-xs text-rose-600">
                          Aktiviere „{TERMS.dysuria.label}“ im Symptomblock, um hier einen Wert zu sehen.
                        </p>
                      ) : null}
                    </div>
                  </div>
                </Section>

                {activeUrinary && (
                  <Section title="Blase/Drang (Modul)" description="Fokus auf Drang und Leckagen (Opt-in)">
                    <div className="grid gap-4 md:grid-cols-3">
                      <div className="space-y-1">
                        <Labeled
                          label={MODULE_TERMS.urinaryOpt.urgency.label}
                          tech={MODULE_TERMS.urinaryOpt.urgency.tech}
                          help={MODULE_TERMS.urinaryOpt.urgency.help}
                          htmlFor="urinary-opt-urgency"
                        >
                          <NrsInput
                            id="urinary-opt-urgency"
                            value={dailyDraft.urinaryOpt?.urgency ?? 0}
                            onChange={(value) =>
                              setDailyDraft((prev) => ({
                                ...prev,
                                urinaryOpt: { ...(prev.urinaryOpt ?? {}), urgency: value },
                              }))
                            }
                          />
                        </Labeled>
                        {renderIssuesForPath("urinaryOpt.urgency")}
                      </div>
                      <div className="space-y-1">
                        <Labeled
                          label={MODULE_TERMS.urinaryOpt.leaksCount.label}
                          tech={MODULE_TERMS.urinaryOpt.leaksCount.tech}
                          help={MODULE_TERMS.urinaryOpt.leaksCount.help}
                          htmlFor="urinary-opt-leaks"
                        >
                          <NumberField
                            id="urinary-opt-leaks"
                            value={dailyDraft.urinaryOpt?.leaksCount}
                            onChange={(value) =>
                              setDailyDraft((prev) => ({
                                ...prev,
                                urinaryOpt: { ...(prev.urinaryOpt ?? {}), leaksCount: value },
                              }))
                            }
                          />
                        </Labeled>
                        {renderIssuesForPath("urinaryOpt.leaksCount")}
                      </div>
                      <div className="space-y-1">
                        <Labeled
                          label={MODULE_TERMS.urinaryOpt.nocturia.label}
                          tech={MODULE_TERMS.urinaryOpt.nocturia.tech}
                          help={MODULE_TERMS.urinaryOpt.nocturia.help}
                          htmlFor="urinary-opt-nocturia"
                        >
                          <NumberField
                            id="urinary-opt-nocturia"
                            value={dailyDraft.urinaryOpt?.nocturia}
                            onChange={(value) =>
                              setDailyDraft((prev) => ({
                                ...prev,
                                urinaryOpt: { ...(prev.urinaryOpt ?? {}), nocturia: value },
                              }))
                            }
                          />
                        </Labeled>
                        {renderIssuesForPath("urinaryOpt.nocturia")}
                      </div>
                    </div>
                  </Section>
                )}

                {activeHeadache && (
                  <Section title="Kopfschmerz/Migräne (Modul)" description="Nur wenn benötigt – Präsenz + Intensität">
                    <div className="space-y-4">
                      <label className="flex items-center gap-2 text-sm text-rose-800">
                        <Checkbox
                          checked={dailyDraft.headacheOpt?.present ?? false}
                          onChange={(event) =>
                            setDailyDraft((prev) => ({
                              ...prev,
                              headacheOpt: event.target.checked
                                ? { ...(prev.headacheOpt ?? {}), present: true, nrs: prev.headacheOpt?.nrs ?? 0 }
                                : { present: false },
                            }))
                          }
                        />
                        <span>{MODULE_TERMS.headacheOpt.present.label}</span>
                        <InfoTip
                          tech={MODULE_TERMS.headacheOpt.present.tech ?? MODULE_TERMS.headacheOpt.present.label}
                          help={MODULE_TERMS.headacheOpt.present.help}
                        />
                      </label>
                      {renderIssuesForPath("headacheOpt.present")}
                      {dailyDraft.headacheOpt?.present && (
                        <div className="space-y-3">
                          <div className="space-y-1">
                            <Labeled
                              label={MODULE_TERMS.headacheOpt.nrs.label}
                              tech={MODULE_TERMS.headacheOpt.nrs.tech}
                              help={MODULE_TERMS.headacheOpt.nrs.help}
                              htmlFor="headache-opt-nrs"
                            >
                              <NrsInput
                                id="headache-opt-nrs"
                                value={dailyDraft.headacheOpt?.nrs ?? 0}
                                onChange={(value) =>
                                  setDailyDraft((prev) => ({
                                    ...prev,
                                    headacheOpt: { ...(prev.headacheOpt ?? {}), nrs: value },
                                  }))
                                }
                              />
                            </Labeled>
                            {renderIssuesForPath("headacheOpt.nrs")}
                          </div>
                          <label className="flex items-center gap-2 text-sm text-rose-800">
                            <Checkbox
                              checked={dailyDraft.headacheOpt?.aura ?? false}
                              onChange={(event) =>
                                setDailyDraft((prev) => ({
                                  ...prev,
                                  headacheOpt: { ...(prev.headacheOpt ?? {}), aura: event.target.checked },
                                }))
                              }
                            />
                            <span>{MODULE_TERMS.headacheOpt.aura.label}</span>
                            <InfoTip
                              tech={MODULE_TERMS.headacheOpt.aura.tech ?? MODULE_TERMS.headacheOpt.aura.label}
                              help={MODULE_TERMS.headacheOpt.aura.help}
                            />
                          </label>
                          <MedList
                            items={dailyDraft.headacheOpt?.meds ?? []}
                            onChange={(items) =>
                              setDailyDraft((prev) => ({
                                ...prev,
                                headacheOpt: { ...(prev.headacheOpt ?? {}), meds: items },
                              }))
                            }
                            renderIssues={renderIssuesForPath}
                          />
                        </div>
                      )}
                    </div>
                  </Section>
                )}

                {activeDizziness && (
                  <Section title="Schwindel (Modul)" description="Präsenz, Stärke und Orthostatik">
                    <div className="space-y-4">
                      <label className="flex items-center gap-2 text-sm text-rose-800">
                        <Checkbox
                          checked={dailyDraft.dizzinessOpt?.present ?? false}
                          onChange={(event) =>
                            setDailyDraft((prev) => ({
                              ...prev,
                              dizzinessOpt: event.target.checked
                                ? { ...(prev.dizzinessOpt ?? {}), present: true, nrs: prev.dizzinessOpt?.nrs ?? 0 }
                                : { present: false },
                            }))
                          }
                        />
                        <span>{MODULE_TERMS.dizzinessOpt.present.label}</span>
                        <InfoTip
                          tech={MODULE_TERMS.dizzinessOpt.present.tech ?? MODULE_TERMS.dizzinessOpt.present.label}
                          help={MODULE_TERMS.dizzinessOpt.present.help}
                        />
                      </label>
                      {renderIssuesForPath("dizzinessOpt.present")}
                      {dailyDraft.dizzinessOpt?.present && (
                        <div className="space-y-3">
                          {showDizzinessNotice && (
                            <InlineNotice
                              title="Schwindel an starken Blutungstagen"
                              text="Mehrfacher Schwindel bei starker Blutung – ärztliche Abklärung (Eisenstatus) erwägen."
                            />
                          )}
                          <div className="space-y-1">
                            <Labeled
                              label={MODULE_TERMS.dizzinessOpt.nrs.label}
                              tech={MODULE_TERMS.dizzinessOpt.nrs.tech}
                              help={MODULE_TERMS.dizzinessOpt.nrs.help}
                              htmlFor="dizziness-opt-nrs"
                            >
                              <NrsInput
                                id="dizziness-opt-nrs"
                                value={dailyDraft.dizzinessOpt?.nrs ?? 0}
                                onChange={(value) =>
                                  setDailyDraft((prev) => ({
                                    ...prev,
                                    dizzinessOpt: { ...(prev.dizzinessOpt ?? {}), nrs: value },
                                  }))
                                }
                              />
                            </Labeled>
                            {renderIssuesForPath("dizzinessOpt.nrs")}
                          </div>
                          <label className="flex items-center gap-2 text-sm text-rose-800">
                            <Checkbox
                              checked={dailyDraft.dizzinessOpt?.orthostatic ?? false}
                              onChange={(event) =>
                                setDailyDraft((prev) => ({
                                  ...prev,
                                  dizzinessOpt: {
                                    ...(prev.dizzinessOpt ?? {}),
                                    orthostatic: event.target.checked,
                                  },
                                }))
                              }
                            />
                            <span>{MODULE_TERMS.dizzinessOpt.orthostatic.label}</span>
                            <InfoTip
                              tech={MODULE_TERMS.dizzinessOpt.orthostatic.tech ?? MODULE_TERMS.dizzinessOpt.orthostatic.label}
                              help={MODULE_TERMS.dizzinessOpt.orthostatic.help}
                            />
                          </label>
                          {renderIssuesForPath("dizzinessOpt.orthostatic")}
                        </div>
                      )}
                    </div>
                  </Section>
                )}

                <Section
                  title="Notizen & Tags"
                  description="Freitext oder wiederkehrende Muster markieren"
                  completionEnabled={false}
                >
                  <div className="grid gap-3">
                    <TermField termKey="notesTags" htmlFor="notes-tag-input">
                      <div className="flex flex-wrap gap-2">
                        <Input
                          id="notes-tag-input"
                          placeholder="Neuer Tag"
                          value={notesTagDraft}
                          onChange={(event) => setNotesTagDraft(event.target.value)}
                        />
                        <Button type="button" variant="secondary" onClick={handleAddTag}>
                          Hinzufügen
                        </Button>
                      </div>
                    </TermField>
                    <div className="flex flex-wrap gap-2">
                      {(dailyDraft.notesTags ?? []).map((tag) => (
                        <Badge key={tag} className="flex items-center gap-2 bg-rose-200 text-rose-700">
                          {tag}
                          <button type="button" onClick={() => handleRemoveTag(tag)} className="text-xs">
                            ×
                          </button>
                        </Badge>
                      ))}
                    </div>
                    <TermField termKey="notesFree" htmlFor="notes-free">
                      <Textarea
                        id="notes-free"
                        placeholder="Freitextnotizen"
                        value={dailyDraft.notesFree ?? ""}
                        onChange={(event) => setDailyDraft((prev) => ({ ...prev, notesFree: event.target.value }))}
                      />
                    </TermField>
                  </div>
                </Section>

                <Section
                  title="Optionale Werte (Hilfsmittel nötig)"
                  description="Standardmäßig ausgeblendet – Wearables, LH-Tests, BBT"
                  aside={
                    <Switch
                      checked={sensorsVisible}
                      onCheckedChange={setSensorsVisible}
                      aria-label="Hilfsmittel-Optionen"
                    />
                  }
                  completionEnabled={false}
                >
                  <Button type="button" variant="secondary" onClick={() => setSensorsVisible((prev) => !prev)}>
                    {optionalSensorsLabel}
                  </Button>
                  {sensorsVisible && (
                    <div className="grid gap-4">
                      <div className="grid gap-2 rounded-lg border border-rose-100 bg-rose-50 p-4">
                        <p className="font-medium text-rose-800">Ovulation / LH-Tests</p>
                        <div className="flex items-center gap-3">
                          <TermHeadline termKey="opk_done" />
                          <Switch
                            checked={dailyDraft.ovulation?.lhTestDone ?? false}
                            onCheckedChange={(checked) =>
                              setDailyDraft((prev) => ({
                                ...prev,
                                ovulation: { ...(prev.ovulation ?? {}), lhTestDone: checked },
                              }))
                            }
                          />
                        </div>
                        {(dailyDraft.ovulation?.lhTestDone ?? false) && (
                          <div className="grid gap-2 md:grid-cols-3">
                            <div className="flex items-center gap-3">
                              <TermHeadline termKey="opk_positive" />
                              <Switch
                                checked={dailyDraft.ovulation?.lhPositive ?? false}
                                onCheckedChange={(checked) =>
                                  setDailyDraft((prev) => ({
                                    ...prev,
                                    ovulation: { ...(prev.ovulation ?? {}), lhPositive: checked },
                                  }))
                                }
                              />
                            </div>
                            <div>
                              <Label>Testzeit (ISO)</Label>
                              <Input
                                type="datetime-local"
                                value={dailyDraft.ovulation?.lhTime ?? ""}
                                onChange={(event) =>
                                  setDailyDraft((prev) => ({
                                    ...prev,
                                    ovulation: { ...(prev.ovulation ?? {}), lhTime: event.target.value },
                                  }))
                                }
                              />
                              {renderIssuesForPath("ovulation.lhTime")}
                            </div>
                          </div>
                        )}
                        <TermField termKey="bbt">
                          <Input
                            type="number"
                            step="0.01"
                            min={34}
                            max={38}
                            value={dailyDraft.ovulation?.bbtCelsius ?? ""}
                            onChange={(event) =>
                              setDailyDraft((prev) => ({
                                ...prev,
                                ovulation: {
                                  ...(prev.ovulation ?? {}),
                                  bbtCelsius: event.target.value ? Number(event.target.value) : undefined,
                                },
                              }))
                            }
                          />
                          {renderIssuesForPath("ovulation.bbtCelsius")}
                        </TermField>
                      </div>

                      <div className="grid gap-2 rounded-lg border border-rose-100 bg-rose-50 p-4">
                        <p className="font-medium text-rose-800">Aktivität (Wearable/Smartphone)</p>
                        <div className="grid gap-2 md:grid-cols-2">
                          <TermField termKey="steps" htmlFor="activity-steps">
                            <Input
                              id="activity-steps"
                              type="number"
                              min={0}
                              step={1}
                              value={dailyDraft.activity?.steps ?? ""}
                              onChange={(event) =>
                                setDailyDraft((prev) => ({
                                  ...prev,
                                  activity: {
                                    ...(prev.activity ?? {}),
                                    steps: event.target.value ? Number(event.target.value) : undefined,
                                  },
                                }))
                              }
                            />
                            {renderIssuesForPath("activity.steps")}
                          </TermField>
                          <TermField termKey="activeMinutes" htmlFor="activity-minutes">
                            <Input
                              id="activity-minutes"
                              type="number"
                              min={0}
                              step={1}
                              value={dailyDraft.activity?.activeMinutes ?? ""}
                              onChange={(event) =>
                                setDailyDraft((prev) => ({
                                  ...prev,
                                  activity: {
                                    ...(prev.activity ?? {}),
                                    activeMinutes: event.target.value ? Number(event.target.value) : undefined,
                                  },
                                }))
                              }
                            />
                            {renderIssuesForPath("activity.activeMinutes")}
                          </TermField>
                        </div>
                      </div>

                      <div className="grid gap-2 rounded-lg border border-rose-100 bg-rose-50 p-4">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <TermHeadline termKey="hrv" />
                          <Switch checked={exploratoryVisible} onCheckedChange={setExploratoryVisible} />
                        </div>
                        <p className="text-xs text-rose-600">
                          HRV nur explorativ, kein Schmerzsurrogat. Wird nicht in Kerntrends angezeigt.
                        </p>
                        {exploratoryVisible && (
                          <TermField termKey="hrv">
                            <Input
                              type="number"
                              min={0}
                              value={dailyDraft.exploratory?.hrvRmssdMs ?? ""}
                              onChange={(event) =>
                                setDailyDraft((prev) => ({
                                  ...prev,
                                  exploratory: {
                                    ...(prev.exploratory ?? {}),
                                    hrvRmssdMs: event.target.value ? Number(event.target.value) : undefined,
                                  },
                                }))
                              }
                            />
                            {renderIssuesForPath("exploratory.hrvRmssdMs")}
                          </TermField>
                        )}
                      </div>
                    </div>
                  )}
                </Section>

                <div className="flex flex-wrap items-center gap-3">
                  <Button type="button" onClick={handleDailySubmit} disabled={!isDailyDirty}>
                    Tagesdaten speichern
                  </Button>
                  {(draftStatus || dailySaveNotice) && (
                    <div className="flex items-center gap-2">
                      {draftStatus && (
                        <span
                          className={cn(
                            "text-sm",
                            draftStatus === "Wiederhergestellt" ? "text-sky-600" : "text-emerald-600"
                          )}
                        >
                          {draftStatus}
                        </span>
                      )}
                      {dailySaveNotice && (
                        <span className="text-sm text-amber-600">{dailySaveNotice}</span>
                      )}
                    </div>
                  )}
                  <label className="flex cursor-pointer items-center gap-2 text-sm text-rose-600">
                    <Upload size={16} />
                    JSON importieren
                    <input type="file" accept="application/json" className="hidden" onChange={handleDailyImport} />
                  </label>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() =>
                      downloadFile(
                        `endo-daily-${today}.json`,
                        JSON.stringify(jsonExportData, null, 2),
                        "application/json"
                      )
                    }
                  >
                    <Download size={16} className="mr-2" /> JSON Export
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() =>
                      downloadFile(
                        `endo-daily-${today}.csv`,
                        toCsv(dailyCsvRows),
                        "text/csv"
                      )
                    }
                  >
                    <Download size={16} className="mr-2" /> CSV Export
                  </Button>
                  <div className="flex flex-wrap items-center gap-2">
                    {[3, 6, 12].map((months) => (
                      <Button key={months} type="button" variant="outline" onClick={() => handleReportDownload(months)}>
                        {months} Monate PDF
                      </Button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <Section
                  title="Trend"
                  description={`${TERMS.nrs.label}, ${TERMS.pbac.label} sowie Symptom- und Schlafverlauf`}
                  completionEnabled={false}
                >
                  <div className="flex justify-end gap-2 text-xs text-rose-600">
                    <span>Achse:</span>
                    <Button
                      type="button"
                      variant={trendXAxisMode === "date" ? "secondary" : "ghost"}
                      size="sm"
                      onClick={() => setTrendXAxisMode("date")}
                    >
                      Datum
                    </Button>
                    <Button
                      type="button"
                      variant={trendXAxisMode === "cycleDay" ? "secondary" : "ghost"}
                      size="sm"
                      onClick={() => setTrendXAxisMode("cycleDay")}
                    >
                      Zyklustag
                    </Button>
                  </div>
                  <div className="h-64 w-full">
                    <ResponsiveContainer>
                      <LineChart data={painTrendData} margin={{ top: 16, right: 16, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#fda4af" />
                        <XAxis
                          dataKey={trendXAxisMode === "date" ? "date" : "cycleLabel"}
                          stroke="#fb7185"
                          tick={{ fontSize: 12 }}
                        />
                        <YAxis yAxisId="left" domain={[0, 10]} stroke="#f43f5e" tick={{ fontSize: 12 }} />
                        <YAxis yAxisId="right" orientation="right" domain={[0, 300]} stroke="#6366f1" tick={{ fontSize: 12 }} />
                        <Tooltip content={<ChartTooltip />} />
                        <Legend wrapperStyle={{ fontSize: 12 }} />
                        <Line
                          type="monotone"
                          dataKey="pain"
                          stroke="#f43f5e"
                          strokeWidth={2}
                          name={`${TERMS.nrs.label} (NRS)`}
                          yAxisId="left"
                          dot={false}
                        />
                        <Line
                          type="monotone"
                          dataKey="pbac"
                          stroke="#6366f1"
                          strokeWidth={2}
                          name={`${TERMS.pbac.label}`}
                          yAxisId="right"
                          connectNulls={false}
                          dot={false}
                        />
                        <Line
                          type="monotone"
                          dataKey="symptomAverage"
                          stroke="#f97316"
                          strokeWidth={1.5}
                          name="Symptom-Schnitt"
                          yAxisId="left"
                          dot={false}
                        />
                        <Line
                          type="monotone"
                          dataKey="sleepQuality"
                          stroke="#22c55e"
                          strokeWidth={1.5}
                          name={TERMS.sleep_quality.label}
                          yAxisId="left"
                          dot={false}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </Section>

                {activeUrinary && urinaryTrendData.length > 0 && (
                  <Section title="Blase/Drang Verlauf" description="Harndrang-NRS (0–10) an aktiven Tagen">
                    <div className="h-56 w-full">
                      <ResponsiveContainer>
                        <LineChart data={urinaryTrendData} margin={{ top: 16, right: 16, left: 0, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#fda4af" />
                          <XAxis dataKey="date" stroke="#fb7185" tick={{ fontSize: 12 }} />
                          <YAxis domain={[0, 10]} stroke="#f43f5e" tick={{ fontSize: 12 }} />
                          <Tooltip />
                          <Line type="monotone" dataKey="urgency" stroke="#f43f5e" strokeWidth={2} dot={false} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </Section>
                )}

                {activeUrinary && urinaryMonthlyRates.length > 0 && (
                  <Section title="Leckage-Rate" description="Anteil Tage mit Leckage pro Monat">
                    <div className="h-56 w-full">
                      <ResponsiveContainer>
                        <BarChart data={urinaryMonthlyRates} margin={{ top: 16, right: 16, left: 0, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#fda4af" />
                          <XAxis dataKey="month" stroke="#fb7185" tick={{ fontSize: 12 }} />
                          <YAxis domain={[0, 100]} stroke="#f43f5e" tick={{ fontSize: 12 }} />
                          <Tooltip />
                          <Bar dataKey="leakRate" fill="#fb7185" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </Section>
                )}

                {activeHeadache && headacheTrendData.length > 0 && (
                  <Section title="Kopfschmerz/Migräne Verlauf" description="NRS nur an Kopfschmerztagen">
                    <div className="h-56 w-full">
                      <ResponsiveContainer>
                        <LineChart data={headacheTrendData} margin={{ top: 16, right: 16, left: 0, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#fda4af" />
                          <XAxis dataKey="date" stroke="#fb7185" tick={{ fontSize: 12 }} />
                          <YAxis domain={[0, 10]} stroke="#f43f5e" tick={{ fontSize: 12 }} />
                          <Tooltip />
                          <Line type="monotone" dataKey="nrs" stroke="#f43f5e" strokeWidth={2} dot={false} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </Section>
                )}

                {activeHeadache && headacheMonthlyRates.length > 0 && (
                  <Section title="Migränetage je Monat" description="Prozentualer Anteil mit Kopfschmerz/Migräne">
                    <div className="h-56 w-full">
                      <ResponsiveContainer>
                        <BarChart data={headacheMonthlyRates} margin={{ top: 16, right: 16, left: 0, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#fda4af" />
                          <XAxis dataKey="month" stroke="#fb7185" tick={{ fontSize: 12 }} />
                          <YAxis domain={[0, 100]} stroke="#f43f5e" tick={{ fontSize: 12 }} />
                          <Tooltip />
                          <Bar dataKey="rate" fill="#fb7185" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </Section>
                )}

                {activeDizziness && dizzinessTrendData.length > 0 && (
                  <Section title="Schwindel-Verlauf" description="NRS 0–10 an Schwindeltagen">
                    <div className="h-56 w-full">
                      <ResponsiveContainer>
                        <LineChart data={dizzinessTrendData} margin={{ top: 16, right: 16, left: 0, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#fda4af" />
                          <XAxis dataKey="date" stroke="#fb7185" tick={{ fontSize: 12 }} />
                          <YAxis domain={[0, 10]} stroke="#f43f5e" tick={{ fontSize: 12 }} />
                          <Tooltip />
                          <Line type="monotone" dataKey="nrs" stroke="#f43f5e" strokeWidth={2} dot={false} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </Section>
                )}

                {activeDizziness && dizzinessScatterData.length > 0 && (
                  <Section
                    title="PBAC vs. Schwindel"
                    description="Streudiagramm: Blutungsstärke (PBAC) vs. Schwindel-NRS"
                  >
                    <div className="h-56 w-full">
                      <ResponsiveContainer>
                        <ScatterChart margin={{ top: 16, right: 16, left: 0, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#fda4af" />
                          <XAxis type="number" dataKey="pbac" name="PBAC" stroke="#fb7185" tick={{ fontSize: 12 }} />
                          <YAxis type="number" dataKey="nrs" name="Schwindel" domain={[0, 10]} stroke="#f43f5e" tick={{ fontSize: 12 }} />
                          <Tooltip cursor={{ strokeDasharray: "3 3" }} />
                          <Scatter data={dizzinessScatterData} fill="#22c55e" />
                        </ScatterChart>
                      </ResponsiveContainer>
                    </div>
                  </Section>
                )}

                <Section
                  title="Letzte Einträge"
                  description="Kernmetriken kompakt"
                  completionEnabled={false}
                >
                  <div className="space-y-3">
                    {dailyEntries
                      .slice()
                      .sort((a, b) => b.date.localeCompare(a.date))
                      .slice(0, 7)
                      .map((entry) => (
                        <div key={entry.date} className="rounded-lg border border-amber-100 bg-amber-50 p-3 text-sm">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="font-semibold text-rose-800">{entry.date}</span>
                            <span className="text-rose-600">NRS {entry.painNRS}</span>
                          </div>
                          <div className="mt-1 flex flex-wrap gap-2 text-xs text-rose-700">
                            <span>PBAC: {entry.bleeding.pbacScore ?? "–"}</span>
                            <span>Schlafqualität: {entry.sleep?.quality ?? "–"}</span>
                            <span>
                              Blasenschmerz:
                              {entry.symptoms?.dysuria?.present && typeof entry.symptoms.dysuria.score === "number"
                                ? entry.symptoms.dysuria.score
                                : "–"}
                            </span>
                            {activeUrinary && (
                              <span>Harndrang (Modul): {entry.urinaryOpt?.urgency ?? "–"}</span>
                            )}
                            {activeHeadache && (
                              <span>
                                Kopfschmerz (Modul):
                                {entry.headacheOpt?.present && typeof entry.headacheOpt.nrs === "number"
                                  ? entry.headacheOpt.nrs
                                  : "–"}
                              </span>
                            )}
                            {activeDizziness && (
                              <span>
                                Schwindel (Modul):
                                {entry.dizzinessOpt?.present && typeof entry.dizzinessOpt.nrs === "number"
                                  ? entry.dizzinessOpt.nrs
                                  : "–"}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                  </div>
                </Section>
                <Section
                  title="Zyklus-Overlay"
                  description="Durchschnittswerte je Zyklustag"
                  completionEnabled={false}
                >
                  <div className="max-h-64 space-y-2 overflow-y-auto text-xs text-rose-700">
                    {cycleOverlay.length === 0 && <p className="text-rose-500">Noch keine Zyklusdaten.</p>}
                    {cycleOverlay.map((row) => (
                      <div
                        key={row.cycleDay}
                        className="flex flex-wrap items-center justify-between gap-2 rounded border border-amber-100 bg-amber-50 px-2 py-1"
                      >
                        <span className="font-semibold text-rose-800">ZT {row.cycleDay}</span>
                        <span>{TERMS.nrs.label}: {row.painAvg.toFixed(1)}</span>
                        <span>Symptome: {row.symptomAvg?.toFixed(1) ?? "–"}</span>
                        <span>{TERMS.sleep_quality.label}: {row.sleepAvg?.toFixed(1) ?? "–"}</span>
                        <span>{TERMS.pbac.label}: {row.pbacAvg?.toFixed(1) ?? "–"}</span>
                        {activeUrinary && (
                          <span>{MODULE_TERMS.urinaryOpt.urgency.label}: {row.urgencyAvg?.toFixed(1) ?? "–"}</span>
                        )}
                        {activeHeadache && (
                          <span>
                            {MODULE_TERMS.headacheOpt.nrs.label}: {row.headacheAvg?.toFixed(1) ?? "–"}
                          </span>
                        )}
                        {activeDizziness && (
                          <span>
                            {MODULE_TERMS.dizzinessOpt.nrs.label}: {row.dizzinessAvg?.toFixed(1) ?? "–"}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </Section>
                <Section
                  title="Wochentag-Overlay"
                  description="Durchschnittlicher NRS nach Wochentag"
                  completionEnabled={false}
                >
                  <div className="grid grid-cols-1 gap-2 text-xs text-rose-700 sm:grid-cols-2 lg:grid-cols-4">
                    {weekdayOverlay.map((row) => (
                      <div key={row.weekday} className="rounded border border-amber-100 bg-amber-50 px-2 py-1">
                        <p className="font-semibold text-rose-800">{row.weekday}</p>
                        <p>{TERMS.nrs.label}: {row.painAvg.toFixed(1)}</p>
                      </div>
                    ))}
                  </div>
                </Section>
                <Section
                  title="Explorative Korrelationen"
                  description="Lokal berechnete Pearson-r Werte – keine medizinische Bewertung"
                  completionEnabled={false}
                >
                  <div className="space-y-2 text-xs text-rose-700">
                    <p>
                      Schlafqualität ↔ Schmerz: {correlations.sleep.r !== null ? correlations.sleep.r.toFixed(2) : "–"} (n=
                      {correlations.sleep.n})
                    </p>
                    <p>
                      Schritte ↔ Schmerz: {correlations.steps.r !== null ? correlations.steps.r.toFixed(2) : "–"} (n=
                      {correlations.steps.n})
                    </p>
                    <p className="text-[10px] text-rose-500">
                      Hinweis: nur zur Orientierung, Daten verlassen den Browser nicht.
                    </p>
                  </div>
                </Section>
              </div>
            </div>
          </Section>
          </SectionScopeContext.Provider>
        </TabsContent>
        <TabsContent value="weekly" className="space-y-6">
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            <p className="font-medium text-amber-900">{weeklyBannerText}</p>
            {weeklyReportsError ? (
              <p className="mt-2 text-xs text-amber-700">{weeklyReportsError}</p>
            ) : null}
          </div>
          <SectionScopeContext.Provider value={`weekly:${currentIsoWeek}`}>
          {weeklyReportsReady ? (
            <WeeklyTabShell dailyEntries={dailyEntries} currentIsoWeek={currentIsoWeek} />
          ) : (
            <div className="rounded-xl border border-rose-100 bg-white/80 p-4 text-sm text-rose-700">
              Wöchentliche Daten werden geladen …
            </div>
          )}
          </SectionScopeContext.Provider>
        </TabsContent>

        <TabsContent value="monthly" className="space-y-6">
          <SectionScopeContext.Provider value={`monthly:${monthlyDraft.month}`}>
          <Section
            title="Monatliche Fragebögen"
            description="Lebensqualität (EHP-5), Stimmung (PHQ-9), Angst (GAD-7) und optionale PROMIS-T-Scores"
            aside={<Calendar size={16} className="text-rose-500" />}
            variant="plain"
            completionEnabled={false}
          >
            <div className="grid gap-6">
              <Labeled label="Monat (YYYY-MM)" htmlFor="monthly-month">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
                  <div className="flex w-full max-w-xl items-center justify-between gap-2 rounded-lg border border-rose-200 bg-white px-3 py-2 shadow-sm">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={goToPreviousMonth}
                      aria-label="Vorheriger Monat"
                      className="text-rose-500 hover:text-rose-700"
                    >
                      <ChevronLeft className="h-5 w-5" />
                    </Button>
                    <div className="flex min-w-0 flex-1 items-center gap-3 text-left">
                      <CalendarDays className="h-6 w-6 flex-shrink-0 text-rose-500" aria-hidden="true" />
                      <div className="min-w-0">
                        <p className="text-xs uppercase tracking-wide text-rose-400">Ausgewählter Monat</p>
                        <p className="truncate text-sm font-semibold text-rose-700">
                          {selectedMonthLabel ?? "Bitte Monat wählen"}
                        </p>
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={goToNextMonth}
                      aria-label="Nächster Monat"
                      className="text-rose-500 hover:text-rose-700"
                      disabled={!canGoToNextMonth}
                    >
                      <ChevronRight className="h-5 w-5" />
                    </Button>
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-rose-400" aria-hidden="true" />
                    <Input
                      id="monthly-month"
                      type="month"
                      value={monthlyDraft.month}
                      onChange={(event) => setMonthlyDraft((prev) => ({ ...prev, month: event.target.value }))}
                      className="w-full max-w-[11rem]"
                      max={currentMonth}
                      aria-label="Monat direkt auswählen"
                    />
                  </div>
                </div>
                {hasEntryForSelectedMonth && (
                  <div className="mt-3 flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                    <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-500" />
                    <div>
                      <p className="font-semibold">Für diesen Monat wurden bereits Angaben gespeichert.</p>
                      <p className="text-xs text-amber-600">Beim Speichern werden die bestehenden Daten aktualisiert.</p>
                    </div>
                  </div>
                )}
                {renderIssuesForPath("month")}
              </Labeled>
              <div className="grid gap-6 lg:grid-cols-2">
                <div className="space-y-3 rounded-lg border border-rose-100 bg-rose-50 p-4">
                  <TermHeadline termKey="ehp5" />
                  <p className="text-xs text-rose-600">{TERMS.ehp5.help}</p>
                  {EHP5_ITEMS.map((item, index) => {
                    const value = monthlyDraft.qol?.ehp5Items?.[index];
                    const selectValue = value !== undefined ? String(value) : "unset";
                    return (
                      <Labeled
                        key={item}
                        label={`EHP-5 ${index + 1}: ${item}`}
                        tech="Antwort 0–4"
                        help="0 = gar nicht, 4 = immer"
                        htmlFor={`ehp5-${index}`}
                      >
                        <Select
                          value={selectValue}
                          onValueChange={(val) => handleEhp5ItemChange(index, val === "unset" ? undefined : Number(val))}
                        >
                          <SelectTrigger id={`ehp5-${index}`}>
                            <SelectValue placeholder="0–4 auswählen" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="unset">Keine Angabe</SelectItem>
                            {SCALE_OPTIONS_0_4.map((option) => (
                              <SelectItem key={option} value={String(option)}>
                                {option}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {renderIssuesForPath(`qol.ehp5Items[${index}]`)}
                      </Labeled>
                    );
                  })}
                  <div className="rounded border border-rose-100 bg-white p-3 text-sm text-rose-700">
                    <p>Summe: {monthlyDraft.qol?.ehp5Total ?? "–"}</p>
                    <p>Transform (0–100): {monthlyDraft.qol?.ehp5Transformed ?? "–"}</p>
                    <div className="space-y-1 text-xs text-rose-600">
                      {renderIssuesForPath("qol.ehp5Total")}
                      {renderIssuesForPath("qol.ehp5Transformed")}
                    </div>
                  </div>
                </div>
                <div className="space-y-3 rounded-lg border border-rose-100 bg-rose-50 p-4">
                  <TermHeadline termKey="phq9" />
                  <p className="text-xs text-rose-600">{TERMS.phq9.help}</p>
                  {PHQ9_ITEMS.map((item, index) => {
                    const value = monthlyDraft.mental?.phq9Items?.[index];
                    const selectValue = value !== undefined ? String(value) : "unset";
                    return (
                      <Labeled
                        key={item}
                        label={`PHQ-9 ${index + 1}: ${item}`}
                        tech="Antwort 0–3"
                        help="0 = überhaupt nicht, 3 = fast jeden Tag"
                        htmlFor={`phq-${index}`}
                      >
                        <Select
                          value={selectValue}
                          onValueChange={(val) => handlePhqItemChange(index, val === "unset" ? undefined : Number(val))}
                        >
                          <SelectTrigger id={`phq-${index}`}>
                            <SelectValue placeholder="0–3 auswählen" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="unset">Keine Angabe</SelectItem>
                            {SCALE_OPTIONS_0_3.map((option) => (
                              <SelectItem key={option} value={String(option)}>
                                {option}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {renderIssuesForPath(`mental.phq9Items[${index}]`)}
                      </Labeled>
                    );
                  })}
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded border border-rose-100 bg-white p-3 text-sm text-rose-700">
                    <div>
                      <p>Summe: {monthlyDraft.mental?.phq9 ?? "–"}</p>
                      <div className="space-y-1 text-xs text-rose-600">
                        {renderIssuesForPath("mental.phq9")}
                        {renderIssuesForPath("mental.phq9Severity")}
                      </div>
                    </div>
                    {phqSeverity ? (
                      <Badge className={cn("text-xs", severityBadgeClass(phqSeverity))}>{severityLabel(phqSeverity)}</Badge>
                    ) : null}
                  </div>
                </div>
              </div>
              <div className="grid gap-6 lg:grid-cols-2">
                <div className="space-y-3 rounded-lg border border-rose-100 bg-rose-50 p-4">
                  <TermHeadline termKey="gad7" />
                  <p className="text-xs text-rose-600">{TERMS.gad7.help}</p>
                  {GAD7_ITEMS.map((item, index) => {
                    const value = monthlyDraft.mental?.gad7Items?.[index];
                    const selectValue = value !== undefined ? String(value) : "unset";
                    return (
                      <Labeled
                        key={item}
                        label={`GAD-7 ${index + 1}: ${item}`}
                        tech="Antwort 0–3"
                        help="0 = überhaupt nicht, 3 = fast jeden Tag"
                        htmlFor={`gad-${index}`}
                      >
                        <Select
                          value={selectValue}
                          onValueChange={(val) => handleGadItemChange(index, val === "unset" ? undefined : Number(val))}
                        >
                          <SelectTrigger id={`gad-${index}`}>
                            <SelectValue placeholder="0–3 auswählen" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="unset">Keine Angabe</SelectItem>
                            {SCALE_OPTIONS_0_3.map((option) => (
                              <SelectItem key={option} value={String(option)}>
                                {option}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {renderIssuesForPath(`mental.gad7Items[${index}]`)}
                      </Labeled>
                    );
                  })}
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded border border-rose-100 bg-white p-3 text-sm text-rose-700">
                    <div>
                      <p>Summe: {monthlyDraft.mental?.gad7 ?? "–"}</p>
                      <div className="space-y-1 text-xs text-rose-600">
                        {renderIssuesForPath("mental.gad7")}
                        {renderIssuesForPath("mental.gad7Severity")}
                      </div>
                    </div>
                    {gadSeverity ? (
                      <Badge className={cn("text-xs", severityBadgeClass(gadSeverity))}>{severityLabel(gadSeverity)}</Badge>
                    ) : null}
                  </div>
                </div>
                <div className="space-y-3 rounded-lg border border-rose-100 bg-rose-50 p-4">
                  <p className="font-medium text-rose-800">PROMIS T-Scores</p>
                  <TermField termKey="promis_fatigue" htmlFor="promis-fatigue">
                    <Input
                      id="promis-fatigue"
                      type="number"
                      min={0}
                      max={100}
                      value={monthlyDraft.promis?.fatigueT ?? ""}
                      onChange={(event) =>
                        setMonthlyDraft((prev) => ({
                          ...prev,
                          promis: { ...(prev.promis ?? {}), fatigueT: event.target.value ? Number(event.target.value) : undefined },
                        }))
                      }
                    />
                    {renderIssuesForPath("promis.fatigueT")}
                  </TermField>
                  <TermField termKey="promis_painInt" htmlFor="promis-pain">
                    <Input
                      id="promis-pain"
                      type="number"
                      min={0}
                      max={100}
                      value={monthlyDraft.promis?.painInterferenceT ?? ""}
                      onChange={(event) =>
                        setMonthlyDraft((prev) => ({
                          ...prev,
                          promis: {
                            ...(prev.promis ?? {}),
                            painInterferenceT: event.target.value ? Number(event.target.value) : undefined,
                          },
                        }))
                      }
                    />
                    {renderIssuesForPath("promis.painInterferenceT")}
                  </TermField>
                </div>
              </div>
            </div>
            <div className="flex gap-3 pt-4">
              <Button type="button" onClick={handleMonthlySubmit}>
                Monat speichern
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() =>
                  downloadFile(
                    `endo-monthly-${today}.json`,
                    JSON.stringify(monthlyEntries, null, 2),
                    "application/json"
                  )
                }
              >
                <Download size={16} className="mr-2" /> Export
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() =>
                  downloadFile(
                    `endo-monthly-${today}.csv`,
                    toCsv(
                      monthlyEntries.map((entry) => ({
                        Monat: entry.month,
                        [`${TERMS.ehp5.label} Summe`]: entry.qol?.ehp5Total ?? "",
                        [`${TERMS.ehp5.label} Transform`]: entry.qol?.ehp5Transformed ?? "",
                        [`${TERMS.phq9.label}`]: entry.mental?.phq9 ?? "",
                        [`${TERMS.phq9.label} Ampel`]: entry.mental?.phq9Severity ?? "",
                        [`${TERMS.gad7.label}`]: entry.mental?.gad7 ?? "",
                        [`${TERMS.gad7.label} Ampel`]: entry.mental?.gad7Severity ?? "",
                        [`${TERMS.promis_fatigue.label}`]: entry.promis?.fatigueT ?? "",
                        [`${TERMS.promis_painInt.label}`]: entry.promis?.painInterferenceT ?? "",
                      }))
                    ),
                    "text/csv"
                  )
                }
              >
                <Download size={16} className="mr-2" /> CSV
              </Button>
            </div>
          </Section>
          <Section title="Verlauf" description="EHP-5 & psychische Scores" completionEnabled={false}>
            <div className="h-64 w-full">
              <ResponsiveContainer>
                <LineChart
                  data={monthlyEntries.map((entry) => ({
                    month: entry.month,
                    ehp5: entry.qol?.ehp5Total ?? null,
                    phq9: entry.mental?.phq9 ?? null,
                    gad7: entry.mental?.gad7 ?? null,
                  }))}
                  margin={{ top: 16, right: 16, left: 0, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#fda4af" />
                  <XAxis dataKey="month" stroke="#fb7185" tick={{ fontSize: 12 }} />
                  <YAxis stroke="#f43f5e" tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Line type="monotone" dataKey="ehp5" stroke="#f43f5e" strokeWidth={2} name={TERMS.ehp5.label} />
                  <Line type="monotone" dataKey="phq9" stroke="#6366f1" strokeWidth={2} name={TERMS.phq9.label} />
                  <Line type="monotone" dataKey="gad7" stroke="#22c55e" strokeWidth={2} name={TERMS.gad7.label} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Section>
          </SectionScopeContext.Provider>
        </TabsContent>
      </Tabs>
      </main>
    </SectionCompletionContext.Provider>
    </>
  );
}
