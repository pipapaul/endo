import { DailyEntry } from "../types";
import { ExtendedPbacData, calculatePbacScore } from "../pbac";

/**
 * Migriert bestehende DailyEntries um extendedPbacData zu initialisieren.
 * Bestehende pbacCounts und pbacScore bleiben unverändert.
 */
export const migrateToExtendedPbac = (entries: DailyEntry[]): DailyEntry[] => {
  return entries.map((entry) => {
    // Wenn bereits migriert, überspringen
    if (entry.extendedPbacData) {
      return entry;
    }

    // Wenn keine Blutungsdaten vorhanden, überspringen
    if (!entry.bleeding?.isBleeding) {
      return entry;
    }

    // Erstelle extendedPbacData basierend auf bestehenden Daten
    const extendedPbacData: ExtendedPbacData = {
      trackingMethod: "pbac_classic",
      extendedEntries: [],
      freeBleedingEntries: [],
      totalEstimatedVolumeMl: undefined, // Kann aus klassischen Daten nicht zuverlässig berechnet werden
      totalPbacEquivalentScore: entry.bleeding.pbacScore ||
        (entry.pbacCounts ? calculatePbacScore(entry.pbacCounts) : 0),
    };

    return {
      ...entry,
      extendedPbacData,
    };
  });
};

/**
 * Prüft ob Migration notwendig ist
 */
export const needsExtendedPbacMigration = (entries: DailyEntry[]): boolean => {
  return entries.some(
    (entry) => entry.bleeding?.isBleeding && !entry.extendedPbacData
  );
};
