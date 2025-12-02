import { arePbacCountsEqual, normalizePbacCounts } from "./pbac";
import type { DailyEntry, PainQuality, PainTimeOfDay, QuickPainEvent } from "./types";

const PAIN_QUALITY_SET = new Set<PainQuality>([
  "krampfend",
  "stechend",
  "brennend",
  "dumpf",
  "ziehend",
  "anders",
  "Migräne",
  "Migräne mit Aura",
]);

const PAIN_TIME_OF_DAY_SET = new Set<PainTimeOfDay>(["morgens", "mittags", "abends"]);

const clampScore = (value: number | undefined | null): number | null => {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }
  return Math.max(0, Math.min(10, Math.round(value)));
};

export function normalizeQuickPainEvent(event: QuickPainEvent): QuickPainEvent {
  const timeOfDay = Array.isArray(event.timeOfDay)
    ? (event.timeOfDay.filter((time): time is PainTimeOfDay => PAIN_TIME_OF_DAY_SET.has(time)) as PainTimeOfDay[])
    : [];
  const hasTimeOfDay = timeOfDay.length > 0;
  const granularity = hasTimeOfDay ? "dritteltag" : event.granularity ?? "tag";
  const quality = PAIN_QUALITY_SET.has(event.quality as PainQuality)
    ? (event.quality as PainQuality)
    : null;
  const intensity = clampScore(event.intensity) ?? 0;

  return {
    ...event,
    intensity,
    quality,
    timeOfDay,
    granularity,
  };
}

function normalizeQuickPainEvents(events: unknown): QuickPainEvent[] {
  if (!Array.isArray(events)) {
    return [];
  }

  const normalized = events
    .map((event) => {
      if (!event || typeof event !== "object") return null;
      const casted = event as QuickPainEvent;
      if (typeof casted.date !== "string" || typeof casted.timestamp !== "string" || typeof casted.id !== "number") {
        return null;
      }
      return normalizeQuickPainEvent(casted);
    })
    .filter((event): event is QuickPainEvent => Boolean(event));

  return normalized.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
}

export function normalizeDailyEntry(entry: DailyEntry): DailyEntry {
  const bleedingSource = (entry as Partial<DailyEntry>).bleeding;
  const hasValidBleeding = typeof bleedingSource?.isBleeding === "boolean";
  const needsPainRegionsNormalization = !Array.isArray(entry.painRegions);
  const needsPainTimeNormalization = Array.isArray(entry.painRegions)
    ? entry.painRegions.some((region) => {
        if (!region || typeof region !== "object") {
          return false;
        }
        const hasTimeArray = Array.isArray((region as { timeOfDay?: unknown }).timeOfDay);
        const hasGranularity = (region as { granularity?: unknown }).granularity !== undefined;
        return !hasTimeArray || !hasGranularity;
      })
    : false;
  const needsPainQualityNormalization = !Array.isArray(entry.painQuality);
  const needsPainMapIdsNormalization = !Array.isArray(entry.painMapRegionIds);
  const needsRescueMedsNormalization = !Array.isArray(entry.rescueMeds);
  const needsSymptomsNormalization = entry.symptoms === undefined;
  const needsQuickPainEventsNormalization = !Array.isArray(entry.quickPainEvents);
  const normalizedPbacCounts = normalizePbacCounts(entry.pbacCounts);
  const needsPbacCountsNormalization =
    !entry.pbacCounts || !arePbacCountsEqual(entry.pbacCounts, normalizedPbacCounts);

  if (
    hasValidBleeding &&
    !needsPainRegionsNormalization &&
    !needsPainTimeNormalization &&
    !needsPainQualityNormalization &&
    !needsPainMapIdsNormalization &&
    !needsRescueMedsNormalization &&
    !needsSymptomsNormalization &&
    !needsQuickPainEventsNormalization &&
    !needsPbacCountsNormalization
  ) {
    return entry;
  }

  const normalizedBleeding: DailyEntry["bleeding"] = {
    isBleeding: Boolean(bleedingSource?.isBleeding),
  };

  if (typeof bleedingSource?.pbacScore === "number" && Number.isFinite(bleedingSource.pbacScore)) {
    normalizedBleeding.pbacScore = bleedingSource.pbacScore;
  }
  if (typeof bleedingSource?.clots === "boolean") {
    normalizedBleeding.clots = bleedingSource.clots;
  }
  if (typeof bleedingSource?.flooding === "boolean") {
    normalizedBleeding.flooding = bleedingSource.flooding;
  }

  const painRegions = Array.isArray(entry.painRegions)
    ? entry.painRegions.map((region) => {
        if (!region || typeof region !== "object") {
          return region;
        }
        const timeOfDay = Array.isArray(region.timeOfDay)
          ? (region.timeOfDay.filter((time) => time === "morgens" || time === "mittags" || time === "abends") as
              DailyEntry["painRegions"] extends Array<infer R>
                ? R extends { timeOfDay?: infer T }
                  ? T
                  : never
                : never)
          : [];
        const hasTimeOfDay = timeOfDay.length > 0;
        const granularity = hasTimeOfDay ? "dritteltag" : region.granularity ?? "tag";
        return {
          ...region,
          timeOfDay,
          granularity,
        };
      })
    : [];
  const painQuality = Array.isArray(entry.painQuality) ? entry.painQuality : [];
  const painMapRegionIds = Array.isArray(entry.painMapRegionIds) ? entry.painMapRegionIds : [];
  const legacyMeds = (entry as { meds?: { name: string; doseMg?: number; times?: string[] }[] }).meds;
  const rescueMeds = Array.isArray(entry.rescueMeds)
    ? entry.rescueMeds
    : Array.isArray(legacyMeds)
      ? legacyMeds.map((med) => ({ name: med.name, doseMg: med.doseMg, time: med.times?.[0] }))
      : [];
  const symptoms = entry.symptoms ?? {};
  const quickPainEvents = normalizeQuickPainEvents(entry.quickPainEvents);

  return {
    ...entry,
    bleeding: normalizedBleeding,
    painRegions,
    painQuality,
    painMapRegionIds,
    quickPainEvents,
    rescueMeds,
    symptoms,
    pbacCounts: normalizedPbacCounts,
  };
}
