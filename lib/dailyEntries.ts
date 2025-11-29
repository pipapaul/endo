import type { DailyEntry } from "./types";

export function normalizeDailyEntry(entry: DailyEntry): DailyEntry {
  const bleedingSource = (entry as Partial<DailyEntry>).bleeding;
  const hasValidBleeding = typeof bleedingSource?.isBleeding === "boolean";
  const needsPainRegionsNormalization = !Array.isArray(entry.painRegions);
  const needsPainQualityNormalization = !Array.isArray(entry.painQuality);
  const needsPainMapIdsNormalization = !Array.isArray(entry.painMapRegionIds);
  const needsRescueMedsNormalization = !Array.isArray(entry.rescueMeds);
  const needsSymptomsNormalization = entry.symptoms === undefined;

  if (
    hasValidBleeding &&
    !needsPainRegionsNormalization &&
    !needsPainQualityNormalization &&
    !needsPainMapIdsNormalization &&
    !needsRescueMedsNormalization &&
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
  };
}
