import { arePbacCountsEqual, normalizePbacCounts } from "./pbac";
import type { DailyEntry } from "./types";

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

  return {
    ...entry,
    bleeding: normalizedBleeding,
    painRegions,
    painQuality,
    painMapRegionIds,
    rescueMeds,
    symptoms,
    pbacCounts: normalizedPbacCounts,
  };
}
