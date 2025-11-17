import type { DailyEntry, PainTimelineEntry } from "./types";

export function normalizeDailyEntry(entry: DailyEntry): DailyEntry {
  const bleedingSource = (entry as Partial<DailyEntry>).bleeding;
  const hasValidBleeding = typeof bleedingSource?.isBleeding === "boolean";
  const needsPainRegionsNormalization = !Array.isArray(entry.painRegions);
  const needsPainQualityNormalization = !Array.isArray(entry.painQuality);
  const needsPainMapIdsNormalization = !Array.isArray(entry.painMapRegionIds);
  const needsPainTimelineNormalization = !Array.isArray(entry.painTimeline);
  const needsMedsNormalization = !Array.isArray(entry.meds);
  const needsSymptomsNormalization = entry.symptoms === undefined;

  if (
    hasValidBleeding &&
    !needsPainRegionsNormalization &&
    !needsPainQualityNormalization &&
    !needsPainMapIdsNormalization &&
    !needsPainTimelineNormalization &&
    !needsMedsNormalization &&
    !needsSymptomsNormalization
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

  const painRegions = Array.isArray(entry.painRegions) ? entry.painRegions : [];
  const painQuality = Array.isArray(entry.painQuality) ? entry.painQuality : [];
  const painMapRegionIds = Array.isArray(entry.painMapRegionIds) ? entry.painMapRegionIds : [];
  const painTimeline: PainTimelineEntry[] = Array.isArray(entry.painTimeline)
    ? entry.painTimeline
        .map((item, index) => {
          if (!item || typeof item !== "object") {
            return null;
          }
          const timestamp = typeof item.timestamp === "string" ? item.timestamp : null;
          const intensity =
            typeof item.intensity === "number" && Number.isFinite(item.intensity)
              ? Math.max(0, Math.min(10, Math.round(item.intensity)))
              : null;
          if (!timestamp || intensity === null) {
            return null;
          }
          const id =
            typeof item.id === "string" && item.id
              ? item.id
              : `pain-${index}-${timestamp}`;
          return { id, timestamp, intensity } satisfies PainTimelineEntry;
        })
        .filter((item): item is PainTimelineEntry => item !== null)
    : [];
  const meds = Array.isArray(entry.meds) ? entry.meds : [];
  const symptoms = entry.symptoms ?? {};

  return {
    ...entry,
    bleeding: normalizedBleeding,
    painRegions,
    painQuality,
    painMapRegionIds,
    painTimeline,
    meds,
    symptoms,
  };
}
