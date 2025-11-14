import type { DailyEntry } from "./types";

export function normalizeDailyEntry(entry: DailyEntry): DailyEntry {
  const bleedingSource = (entry as Partial<DailyEntry>).bleeding;
  const hasValidBleeding = typeof bleedingSource?.isBleeding === "boolean";
  const needsPainRegionsNormalization = !Array.isArray(entry.painRegions);
  const needsPainQualityNormalization = !Array.isArray(entry.painQuality);
  const needsPainMapIdsNormalization = !Array.isArray(entry.painMapRegionIds);
  const needsMedsNormalization = !Array.isArray(entry.meds);
  const needsSymptomsNormalization = entry.symptoms === undefined;

  if (
    hasValidBleeding &&
    !needsPainRegionsNormalization &&
    !needsPainQualityNormalization &&
    !needsPainMapIdsNormalization &&
    !needsMedsNormalization &&
    !needsSymptomsNormalization
  ) {
    return entry;
  }

  const normalizedBleeding: DailyEntry["bleeding"] = {
    isBleeding: Boolean(bleedingSource?.isBleeding),
  };

  if (typeof bleedingSource?.pbacScore === "number" && Number.isFinite(bleedingSource.pbacScore)) {
    normalizedBleeding.pbacScore = Math.max(0, bleedingSource.pbacScore);
  } else if (normalizedBleeding.isBleeding) {
    normalizedBleeding.pbacScore = 0;
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
  const meds = Array.isArray(entry.meds) ? entry.meds : [];
  const symptoms = entry.symptoms ?? {};

  return {
    ...entry,
    bleeding: normalizedBleeding,
    painRegions,
    painQuality,
    painMapRegionIds,
    meds,
    symptoms,
  };
}
