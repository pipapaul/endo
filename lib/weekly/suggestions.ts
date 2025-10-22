import { getItem, setItem } from "../persistence";

const STORAGE_KEY_PREFIX = "endo.weekly.suggestions.v1";
const MAX_STORED_ITEMS = 24;

export type SuggestionSection = "helped" | "worsened" | "nextWeekTry";

const DEFAULT_CHIPS: Record<SuggestionSection, string[]> = {
  helped: [
    "Wärme",
    "Dehnung",
    "Ruhepausen",
    "Austausch mit Freundinnen",
    "Spaziergang",
    "Atemübungen",
  ],
  worsened: [
    "Lange Sitzphasen",
    "Stress",
    "Zuckerreiche Ernährung",
    "Wenig Schlaf",
    "Ausgelassene Mahlzeiten",
  ],
  nextWeekTry: [
    "Yoga",
    "Tagebuch führen",
    "Physiotherapie",
    "Ergonomischer Arbeitsplatz",
    "Meditation",
  ],
};

function storageKey(section: SuggestionSection): string {
  return `${STORAGE_KEY_PREFIX}:${section}`;
}

function normalizeChip(chip: string): string | null {
  const trimmed = chip.trim();
  if (!trimmed) return null;
  return trimmed;
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

async function loadStored(section: SuggestionSection): Promise<string[]> {
  try {
    const result = await getItem<string[]>(storageKey(section));
    if (!result.value) {
      return [];
    }
    return Array.isArray(result.value) ? dedupeList(result.value) : [];
  } catch (error) {
    console.error("Gespeicherte Vorschläge konnten nicht geladen werden", error);
    return [];
  }
}

export async function getSuggestedChips(section: SuggestionSection): Promise<string[]> {
  const stored = await loadStored(section);
  return dedupeList([...DEFAULT_CHIPS[section], ...stored]).slice(0, MAX_STORED_ITEMS);
}

export async function rememberChosenChips(section: SuggestionSection, items: string[]): Promise<void> {
  if (!items.length) return;
  const stored = await loadStored(section);
  const combined = [...items, ...stored];
  const deduped = dedupeList(combined).slice(0, MAX_STORED_ITEMS);
  try {
    await setItem(storageKey(section), deduped);
  } catch (error) {
    console.error("Vorschläge konnten nicht gespeichert werden", error);
  }
}
