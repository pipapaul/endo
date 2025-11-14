import type { DailyEntry } from "./types";

export function normalizeDailyEntry(entry: DailyEntry): DailyEntry {
  const bleedingSource = (entry as Partial<DailyEntry>).bleeding;
  const bleedingIsObject = typeof bleedingSource === "object" && bleedingSource !== null;
  const bleedingIsBoolean = typeof bleedingSource === "boolean";
  const bleedingObject = bleedingIsObject ? (bleedingSource as NonNullable<DailyEntry["bleeding"]>) : null;
  const hasValidBleeding = Boolean(bleedingObject && typeof bleedingObject.isBleeding === "boolean");
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
    isBleeding: bleedingIsBoolean
      ? (bleedingSource as boolean)
      : Boolean(bleedingObject?.isBleeding),
  };

  if (bleedingObject) {
    if (typeof bleedingObject.pbacScore === "number" && Number.isFinite(bleedingObject.pbacScore)) {
      normalizedBleeding.pbacScore = bleedingObject.pbacScore;
    }
    if (typeof bleedingObject.clots === "boolean") {
      normalizedBleeding.clots = bleedingObject.clots;
    }
    if (typeof bleedingObject.flooding === "boolean") {
      normalizedBleeding.flooding = bleedingObject.flooding;
    }
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
