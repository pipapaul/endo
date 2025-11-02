import { useEffect, useMemo, useState } from "react";
import type { KeyboardEvent } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { SliderValueDisplay } from "@/components/ui/slider-value-display";
import { cn } from "@/lib/utils";
import { getSuggestedChips, rememberChosenChips } from "@/lib/weekly/suggestions";
import type { WeeklyDraft } from "@/lib/weekly/drafts";
import InfoTip from "@/components/InfoTip";
import { normalizeWpai, WPAI_CARD_TOOLTIP, WPAI_FIELD_DEFINITIONS } from "@/lib/weekly/wpai";

export type PromptAnswers = WeeklyDraft["answers"];

type PromptSectionKey = "helped" | "worsened" | "nextWeekTry";
type WpaiFieldKey = (typeof WPAI_FIELD_DEFINITIONS)[number]["key"];

type SectionConfig = {
  key: PromptSectionKey;
  title: string;
  description: string;
  placeholder: string;
};

const SECTION_CONFIG: SectionConfig[] = [
  {
    key: "helped",
    title: "Was hat geholfen?",
    description: "Maßnahmen, Routinen oder Unterstützung, die dir gut getan haben.",
    placeholder: "Eigenen Punkt hinzufügen",
  },
  {
    key: "worsened",
    title: "Was hat verschlechtert?",
    description: "Auslöser oder Situationen, die Beschwerden verstärkt haben.",
    placeholder: "Eigenen Punkt hinzufügen",
  },
  {
    key: "nextWeekTry",
    title: "Was möchte ich nächste Woche ausprobieren?",
    description: "Ideen, die du testen möchtest, um dich zu unterstützen.",
    placeholder: "Neuen Vorschlag notieren",
  },
];

type SuggestionsState = Record<PromptSectionKey, string[]>;
type InputState = Record<PromptSectionKey, string>;

const EMPTY_INPUTS: InputState = { helped: "", worsened: "", nextWeekTry: "" };

export function WeeklyPrompts({ value, onChange }: { value: PromptAnswers; onChange: (next: PromptAnswers) => void }): JSX.Element {
  const [suggestions, setSuggestions] = useState<SuggestionsState>({ helped: [], worsened: [], nextWeekTry: [] });
  const [inputs, setInputs] = useState<InputState>(EMPTY_INPUTS);

  const normalizedValue = useMemo<PromptAnswers>(() => {
    return {
      helped: dedupeList(value?.helped ?? []),
      worsened: dedupeList(value?.worsened ?? []),
      nextWeekTry: dedupeList(value?.nextWeekTry ?? []),
      freeText: value?.freeText ?? "",
      wpai: normalizeWpai(value?.wpai),
    };
  }, [value]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [helped, worsened, nextWeekTry] = await Promise.all([
          getSuggestedChips("helped"),
          getSuggestedChips("worsened"),
          getSuggestedChips("nextWeekTry"),
        ]);
        if (cancelled) return;
        setSuggestions({
          helped: mergeSuggestions(helped, normalizedValue.helped),
          worsened: mergeSuggestions(worsened, normalizedValue.worsened),
          nextWeekTry: mergeSuggestions(nextWeekTry, normalizedValue.nextWeekTry),
        });
      } catch (error) {
        console.error("Vorschläge konnten nicht geladen werden", error);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [normalizedValue.helped, normalizedValue.nextWeekTry, normalizedValue.worsened]);

  const updateAnswers = (partial: Partial<PromptAnswers>) => {
    const mergedWpaiInput = partial.wpai ? { ...normalizedValue.wpai, ...partial.wpai } : normalizedValue.wpai;
    const next: PromptAnswers = {
      helped: partial.helped ?? normalizedValue.helped,
      worsened: partial.worsened ?? normalizedValue.worsened,
      nextWeekTry: partial.nextWeekTry ?? normalizedValue.nextWeekTry,
      freeText: partial.freeText ?? normalizedValue.freeText,
      wpai: normalizeWpai(mergedWpaiInput),
    };
    onChange(next);
  };

  const updateListAnswers = (key: PromptSectionKey, items: string[]) => {
    if (key === "helped") {
      updateAnswers({ helped: items });
    } else if (key === "worsened") {
      updateAnswers({ worsened: items });
    } else {
      updateAnswers({ nextWeekTry: items });
    }
  };

  const handleToggle = (key: PromptSectionKey, chip: string) => {
    const normalizedChip = normalizeChip(chip);
    if (!normalizedChip) return;

    const current = normalizedValue[key];
    const exists = current.some((entry) => entry.localeCompare(normalizedChip, undefined, { sensitivity: "accent" }) === 0);

    if (exists) {
      const nextItems = current.filter(
        (entry) => entry.localeCompare(normalizedChip, undefined, { sensitivity: "accent" }) !== 0
      );
      updateListAnswers(key, nextItems);
      return;
    }

    const nextItems = dedupeList([...current, normalizedChip]);
    updateListAnswers(key, nextItems);
    setSuggestions((prev) => ({ ...prev, [key]: mergeSuggestions(prev[key], [normalizedChip]) }));
    rememberChosenChips(key, [normalizedChip]).catch((error) => {
      console.error("Auswahl konnte nicht gespeichert werden", error);
    });
  };

  const handleInputAdd = (key: PromptSectionKey) => {
    const draft = normalizeChip(inputs[key]);
    if (!draft) return;
    setInputs((prev) => ({ ...prev, [key]: "" }));
    handleToggle(key, draft);
  };

  const handleInputKeyDown = (event: KeyboardEvent<HTMLInputElement>, key: PromptSectionKey) => {
    if (event.key === "Enter") {
      event.preventDefault();
      handleInputAdd(key);
    }
  };

  const handleWpaiChange = (key: WpaiFieldKey, sliderValue: number) => {
    const sanitized = Number.isFinite(sliderValue) ? sliderValue : normalizedValue.wpai[key];
    updateAnswers({ wpai: { ...normalizedValue.wpai, [key]: sanitized } });
  };

  return (
    <section className="space-y-6">
      <header className="space-y-1">
        <h2 className="text-xl font-semibold text-rose-900">Wöchentliche Leitfragen</h2>
        <p className="text-sm text-rose-900/70">
          Wähle passende Chips oder ergänze eigene Stichworte. Deine Auswahl wird lokal gemerkt.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-3">
        {SECTION_CONFIG.map((section) => (
          <article key={section.key} className="rounded-xl border border-rose-100 bg-white/80 p-4 shadow-sm">
            <header className="space-y-1">
              <h3 className="text-lg font-semibold text-rose-900">{section.title}</h3>
              <p className="text-sm text-rose-900/70">{section.description}</p>
            </header>

            <div className="mt-3 flex flex-wrap gap-2">
              {suggestions[section.key].map((chip) => {
                const isSelected = normalizedValue[section.key].some(
                  (entry) => entry.localeCompare(chip, undefined, { sensitivity: "accent" }) === 0
                );
                return (
                  <ChipButton key={chip} active={isSelected} onClick={() => handleToggle(section.key, chip)}>
                    {chip}
                  </ChipButton>
                );
              })}
              {suggestions[section.key].length === 0 ? (
                <p className="text-sm text-rose-900/60">Noch keine Vorschläge vorhanden.</p>
              ) : null}
            </div>

            <div className="mt-4 space-y-2">
              <Label htmlFor={`${section.key}-custom`} className="text-sm text-rose-900">
                {section.placeholder}
              </Label>
              <Input
                id={`${section.key}-custom`}
                value={inputs[section.key]}
                onChange={(event) => setInputs((prev) => ({ ...prev, [section.key]: event.target.value }))}
                onKeyDown={(event) => handleInputKeyDown(event, section.key)}
                placeholder={section.placeholder}
                className="bg-white"
              />
              <Button
                type="button"
                onClick={() => handleInputAdd(section.key)}
                className="w-full"
                variant="secondary"
              >
                Als Chip übernehmen
              </Button>
            </div>
          </article>
        ))}
      </div>

      <article className="space-y-5 rounded-xl border border-rose-100 bg-white/80 p-4 shadow-sm">
        <header className="space-y-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <h3 className="text-lg font-semibold text-rose-900">WPAI – 7-Tage-Rückblick</h3>
            <InfoTip tech={WPAI_CARD_TOOLTIP.tech} help={WPAI_CARD_TOOLTIP.help} />
          </div>
          <p className="text-sm text-rose-900/70">
            Schätze, wie sehr deine Beschwerden deine Arbeits- oder Ausbildungsfähigkeit in dieser Woche beeinflusst haben.
          </p>
        </header>

        <div className="space-y-5">
          {WPAI_FIELD_DEFINITIONS.map((field) => {
            const value = normalizedValue.wpai[field.key];
            const sliderId = `weekly-prompts-wpai-${field.key}`;
            return (
              <div key={field.key} className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Label
                    htmlFor={sliderId}
                    className="flex items-center gap-2 text-sm font-medium text-rose-900"
                  >
                    {field.label}
                    <InfoTip tech={field.label} help={field.tooltip} />
                  </Label>
                  <SliderValueDisplay
                    value={value}
                    unit="%"
                    label="Aktueller Wert"
                    className="min-w-[6rem]"
                    valueClassName="text-3xl"
                  />
                </div>
                <Slider
                  id={sliderId}
                  value={[value]}
                  min={0}
                  max={100}
                  step={5}
                  onValueChange={(values) => handleWpaiChange(field.key, values[0] ?? value)}
                />
                <p className="text-xs text-rose-900/60">{field.description}</p>
              </div>
            );
          })}
        </div>
      </article>

      <div className="space-y-2">
        <Label htmlFor="weekly-prompts-free" className="text-sm text-rose-900">
          Weitere Gedanken zur Woche
        </Label>
        <Textarea
          id="weekly-prompts-free"
          value={normalizedValue.freeText}
          onChange={(event) => updateAnswers({ freeText: event.target.value })}
          placeholder="Zusätzliche Reflexionen, Fragen oder Beobachtungen"
          className="min-h-[100px] bg-white"
        />
        <p className="text-xs text-rose-900/60">Alle Angaben bleiben auf diesem Gerät gespeichert.</p>
      </div>
    </section>
  );
}

type ChipButtonProps = {
  active: boolean;
  children: string;
  onClick: () => void;
};

function ChipButton({ active, children, onClick }: ChipButtonProps): JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full px-3 py-1 text-sm transition",
        active
          ? "bg-rose-500 text-white shadow-sm hover:bg-rose-600"
          : "bg-rose-100 text-rose-800 hover:bg-rose-200"
      )}
    >
      {children}
    </button>
  );
}

function normalizeChip(chip: string): string {
  return chip.trim();
}

function dedupeList(items: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const item of items) {
    const normalized = normalizeChip(item);
    if (!normalized) continue;
    const key = normalized.toLocaleLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(normalized);
  }
  return result;
}

function mergeSuggestions(base: string[], additions: string[]): string[] {
  return dedupeList([...base, ...additions]);
}
