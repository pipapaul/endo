export type WeeklyWpai = {
  absenteeismPct: number;
  presenteeismPct: number;
  overallPct: number;
};

export type WeeklyWpaiKey = keyof WeeklyWpai;

export const DEFAULT_WPAI: WeeklyWpai = {
  absenteeismPct: 0,
  presenteeismPct: 0,
  overallPct: 0,
};

export const WPAI_FIELD_DEFINITIONS: Array<{
  key: WeeklyWpaiKey;
  label: string;
  description: string;
  tooltip: string;
}> = [
  {
    key: "absenteeismPct",
    label: "Fehlzeiten in Prozent",
    description: "Welcher Anteil der Arbeits- oder Ausbildungszeit ist komplett ausgefallen?",
    tooltip:
      "Gib den prozentualen Anteil an Tagen oder Stunden an, in denen du aufgrund deiner Beschwerden gar nicht arbeiten konntest.",
  },
  {
    key: "presenteeismPct",
    label: "Anwesenheitsminderung in Prozent",
    description: "Wie stark war deine Leistungsfähigkeit während Anwesenheit eingeschränkt?",
    tooltip:
      "Schätze, wie groß dein Produktivitätsverlust während der Anwesenheit war (Work Productivity and Activity Impairment Index).",
  },
  {
    key: "overallPct",
    label: "Gesamtbeeinträchtigung in Prozent",
    description: "Zusammenfassung aus Fehlzeiten und Produktivitätsverlust der letzten 7 Tage.",
    tooltip:
      "Bewerte die gesamte Beeinträchtigung deiner Arbeitstätigkeit durch Beschwerden in dieser Woche in Prozent.",
  },
];

export const WPAI_CARD_TOOLTIP = {
  tech: "WPAI – 7-Tage-Rückblick",
  help:
    "Der Work Productivity and Activity Impairment (WPAI) Index erfasst, wie stark Beschwerden deine berufliche Leistungsfähigkeit in den letzten sieben Tagen beeinflusst haben.",
};

export function normalizeWpaiValue(value: unknown, fallback = 0): number {
  const base = typeof fallback === "number" && Number.isFinite(fallback) ? fallback : 0;
  if (typeof value !== "number" || Number.isNaN(value)) {
    return base;
  }
  const clamped = Math.min(100, Math.max(0, value));
  const snapped = Math.round(clamped / 5) * 5;
  return Math.min(100, Math.max(0, snapped));
}

export function normalizeWpai(
  input?: Partial<WeeklyWpai> | null,
  fallback: WeeklyWpai = DEFAULT_WPAI
): WeeklyWpai {
  return {
    absenteeismPct: normalizeWpaiValue(input?.absenteeismPct, fallback.absenteeismPct),
    presenteeismPct: normalizeWpaiValue(input?.presenteeismPct, fallback.presenteeismPct),
    overallPct: normalizeWpaiValue(input?.overallPct, fallback.overallPct),
  };
}
