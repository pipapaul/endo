export type PbacCountKey =
  | "pad_light"
  | "pad_medium"
  | "pad_heavy"
  | "tampon_light"
  | "tampon_medium"
  | "tampon_heavy"
  | "clot_small"
  | "clot_large";

export type PbacCounts = Record<PbacCountKey, number>;

export const PBAC_COUNT_KEYS: readonly PbacCountKey[] = [
  "pad_light",
  "pad_medium",
  "pad_heavy",
  "tampon_light",
  "tampon_medium",
  "tampon_heavy",
  "clot_small",
  "clot_large",
];

export const createEmptyPbacCounts = (): PbacCounts => {
  return PBAC_COUNT_KEYS.reduce<PbacCounts>((acc, key) => {
    acc[key] = 0;
    return acc;
  }, {} as PbacCounts);
};

export const normalizePbacCounts = (counts?: Partial<Record<PbacCountKey, unknown>>): PbacCounts => {
  if (!counts) {
    return createEmptyPbacCounts();
  }
  return PBAC_COUNT_KEYS.reduce<PbacCounts>((acc, key) => {
    const value = counts[key];
    const numeric = typeof value === "number" && Number.isFinite(value) ? value : 0;
    acc[key] = Math.max(0, Math.round(numeric));
    return acc;
  }, {} as PbacCounts);
};

export const arePbacCountsEqual = (a: PbacCounts, b: PbacCounts): boolean => {
  return PBAC_COUNT_KEYS.every((key) => a[key] === b[key]);
};

// ============================================
// NEUE ERWEITERUNGEN
// ============================================

/** Tracking-Methode: Klassisch (nur PBAC) oder Erweitert (mit modernen Produkten) */
export type TrackingMethod = "pbac_classic" | "pbac_extended";

/** Produkt-Kategorien */
export type ProductCategory =
  | "pad"           // Binde
  | "tampon"        // Tampon
  | "cup"           // Menstruationstasse
  | "disc"          // Menstruationsdisc
  | "underwear"     // Periodenslip
  | "free_bleeding"; // Freies Bluten

/** Füllgrad in Prozent (125 = übergelaufen) */
export type FillLevel = 25 | 50 | 75 | 100 | 125;

/** Produkt-Definition für Einstellungen */
export interface ProductDefinition {
  id: string;
  category: ProductCategory;
  name: string;
  nameShort?: string;           // Kurzname für kompakte Anzeige
  capacity_ml: number;          // Kapazität in ml (0 für free_bleeding)
  enabled: boolean;             // Vom User aktiviert?
  isCustom?: boolean;           // User-definiertes Produkt?
  isClassicPbac?: boolean;      // Gehört zum klassischen PBAC-System?
}

/** Erweiterter Blutungs-Eintrag (einzelnes Produkt) */
export interface ExtendedBleedingEntry {
  id: string;                   // Unique ID für diesen Eintrag
  timestamp: string;            // ISO timestamp
  productId: string;            // Referenz auf ProductDefinition.id
  fillLevelPercent: FillLevel;
  estimatedVolumeMl: number;    // Berechnet: capacity × fillLevel / 100
  pbacEquivalentScore: number;  // Für Vergleichbarkeit mit klassischem PBAC
}

/** Free Bleeding spezifische Erfassung */
export interface FreeBleedingEntry {
  id: string;
  timestamp: string;
  intensity: "light" | "moderate" | "heavy" | "flooding";
  visibleAmount: "none" | "spots" | "stains" | "soaked";
  estimatedVolumeMl: number;
  pbacEquivalentScore: number;
}

/** Erweiterte PBAC-Counts (zusätzlich zu den klassischen) */
export interface ExtendedPbacData {
  trackingMethod: TrackingMethod;
  // Klassische Counts bleiben in pbacCounts (Rückwärtskompatibilität)
  // Erweiterte Einträge:
  extendedEntries?: ExtendedBleedingEntry[];
  freeBleedingEntries?: FreeBleedingEntry[];
  // Aggregierte Werte für den Tag:
  totalEstimatedVolumeMl?: number;
  totalPbacEquivalentScore?: number;
}

// ============================================
// STANDARD-PRODUKTDEFINITIONEN
// ============================================

export const DEFAULT_PRODUCTS: ProductDefinition[] = [
  // Klassische PBAC-Produkte: "leicht/mittel/stark" = Sättigung beim Wechsel, NICHT Produktgröße
  { id: "pad_light", category: "pad", name: "Leicht gesättigt", nameShort: "Leicht", capacity_ml: 3, enabled: true, isClassicPbac: true },
  { id: "pad_medium", category: "pad", name: "Mittel gesättigt", nameShort: "Mittel", capacity_ml: 8, enabled: true, isClassicPbac: true },
  { id: "pad_heavy", category: "pad", name: "Stark gesättigt", nameShort: "Stark", capacity_ml: 20, enabled: true, isClassicPbac: true },
  { id: "tampon_light", category: "tampon", name: "Leicht gesättigt", nameShort: "Leicht", capacity_ml: 3, enabled: true, isClassicPbac: true },
  { id: "tampon_medium", category: "tampon", name: "Mittel gesättigt", nameShort: "Mittel", capacity_ml: 9, enabled: true, isClassicPbac: true },
  { id: "tampon_heavy", category: "tampon", name: "Stark gesättigt", nameShort: "Stark", capacity_ml: 12, enabled: true, isClassicPbac: true },

  // Erweiterte Produkte: Hier geht es um Produktgrößen (Füllgrad wird separat erfasst)
  { id: "cup_s", category: "cup", name: "Größe S", nameShort: "S", capacity_ml: 20, enabled: false },
  { id: "cup_m", category: "cup", name: "Größe M", nameShort: "M", capacity_ml: 26, enabled: false },
  { id: "cup_l", category: "cup", name: "Größe L", nameShort: "L", capacity_ml: 33, enabled: false },
  { id: "disc_standard", category: "disc", name: "Standard", nameShort: "Standard", capacity_ml: 50, enabled: false },
  { id: "disc_large", category: "disc", name: "Groß", nameShort: "Groß", capacity_ml: 70, enabled: false },
  { id: "underwear_light", category: "underwear", name: "Leichte Saugkraft", nameShort: "Leicht", capacity_ml: 10, enabled: false },
  { id: "underwear_medium", category: "underwear", name: "Mittlere Saugkraft", nameShort: "Mittel", capacity_ml: 20, enabled: false },
  { id: "underwear_heavy", category: "underwear", name: "Starke Saugkraft", nameShort: "Stark", capacity_ml: 30, enabled: false },
  { id: "free_bleeding", category: "free_bleeding", name: "Freies Bluten", nameShort: "Frei", capacity_ml: 0, enabled: false },
];

// ============================================
// PBAC-SCORE MULTIPLIKATOREN (klassisch)
// ============================================

export const PBAC_MULTIPLIERS: Record<PbacCountKey, number> = {
  pad_light: 1,
  pad_medium: 5,
  pad_heavy: 20,
  tampon_light: 1,
  tampon_medium: 5,
  tampon_heavy: 10,
  clot_small: 1,
  clot_large: 5,
};

// ============================================
// BERECHNUNGSFUNKTIONEN
// ============================================

/**
 * Berechnet klassischen PBAC-Score aus Counts
 */
export const calculatePbacScore = (counts: PbacCounts): number => {
  return PBAC_COUNT_KEYS.reduce((sum, key) => {
    return sum + (counts[key] || 0) * PBAC_MULTIPLIERS[key];
  }, 0);
};

/**
 * Mapping für Free Bleeding Intensität zu ml
 */
const FREE_BLEEDING_VOLUME_MAP: Record<FillLevel, number> = {
  25: 2,    // Tropfen/wenig
  50: 5,    // Leichter Fluss
  75: 12,   // Starker Fluss
  100: 20,  // Sehr stark/Schwall
  125: 30,  // Extrem/unkontrolliert
};

/**
 * Berechnet geschätztes Volumen basierend auf Produkt und Füllgrad
 */
export const calculateEstimatedVolume = (
  product: ProductDefinition,
  fillLevelPercent: FillLevel
): number => {
  if (product.category === "free_bleeding") {
    return FREE_BLEEDING_VOLUME_MAP[fillLevelPercent] || 0;
  }
  return Math.round(product.capacity_ml * (fillLevelPercent / 100));
};

/**
 * Konvertiert Volumen zu PBAC-Äquivalent-Score
 * Ermöglicht Vergleichbarkeit zwischen klassischen und erweiterten Daten
 */
export const volumeToPbacEquivalent = (volumeMl: number): number => {
  if (volumeMl <= 0) return 0;
  if (volumeMl <= 2) return 1;   // ~leicht
  if (volumeMl <= 7) return 5;   // ~mittel
  if (volumeMl <= 15) return 10; // ~tampon schwer
  if (volumeMl <= 25) return 20; // ~binde schwer
  if (volumeMl <= 40) return 30;
  if (volumeMl <= 60) return 40;
  return 50;
};

/**
 * Berechnet PBAC-Äquivalent für einen erweiterten Eintrag
 */
export const calculateExtendedEntryScore = (
  product: ProductDefinition,
  fillLevelPercent: FillLevel
): { estimatedVolumeMl: number; pbacEquivalentScore: number } => {
  const estimatedVolumeMl = calculateEstimatedVolume(product, fillLevelPercent);
  const pbacEquivalentScore = volumeToPbacEquivalent(estimatedVolumeMl);
  return { estimatedVolumeMl, pbacEquivalentScore };
};

/**
 * Aggregiert alle erweiterten Einträge eines Tages
 */
export const aggregateExtendedPbacData = (
  data: ExtendedPbacData,
  classicPbacCounts?: PbacCounts
): { totalVolumeMl: number; totalPbacEquivalent: number } => {
  let totalVolumeMl = 0;
  let totalPbacEquivalent = 0;

  // Klassische PBAC-Counts (falls vorhanden)
  if (classicPbacCounts) {
    totalPbacEquivalent += calculatePbacScore(classicPbacCounts);
    // Volumen-Schätzung für klassische Produkte
    const classicProducts = DEFAULT_PRODUCTS.filter(p => p.isClassicPbac);
    PBAC_COUNT_KEYS.filter(k => !k.startsWith("clot")).forEach(key => {
      const count = classicPbacCounts[key] || 0;
      const product = classicProducts.find(p => p.id === key);
      if (product && count > 0) {
        // Annahme: klassische Einträge sind "voll" (100%)
        totalVolumeMl += product.capacity_ml * count;
      }
    });
  }

  // Erweiterte Einträge
  if (data.extendedEntries) {
    for (const entry of data.extendedEntries) {
      totalVolumeMl += entry.estimatedVolumeMl;
      totalPbacEquivalent += entry.pbacEquivalentScore;
    }
  }

  // Free Bleeding Einträge
  if (data.freeBleedingEntries) {
    for (const entry of data.freeBleedingEntries) {
      totalVolumeMl += entry.estimatedVolumeMl;
      totalPbacEquivalent += entry.pbacEquivalentScore;
    }
  }

  return { totalVolumeMl, totalPbacEquivalent };
};

/**
 * Erstellt leere ExtendedPbacData
 */
export const createEmptyExtendedPbacData = (
  trackingMethod: TrackingMethod = "pbac_classic"
): ExtendedPbacData => ({
  trackingMethod,
  extendedEntries: [],
  freeBleedingEntries: [],
  totalEstimatedVolumeMl: 0,
  totalPbacEquivalentScore: 0,
});
