import {
  DEFAULT_PRODUCTS,
  ProductDefinition,
  ProductCategory,
  TrackingMethod
} from "./pbac";

/** Benutzer-Einstellungen für Produkte */
export interface ProductSettings {
  trackingMethod: TrackingMethod;
  enabledProductIds: string[];
  customProducts: ProductDefinition[];
  showVolumeEstimate: boolean;
  showPbacEquivalent: boolean;
}

/** Standard-Einstellungen */
export const DEFAULT_PRODUCT_SETTINGS: ProductSettings = {
  trackingMethod: "pbac_classic",
  enabledProductIds: DEFAULT_PRODUCTS
    .filter(p => p.isClassicPbac && p.enabled)
    .map(p => p.id),
  customProducts: [],
  showVolumeEstimate: true,
  showPbacEquivalent: true,
};

/** Holt alle verfügbaren Produkte (Standard + Custom) */
export const getAllProducts = (settings: ProductSettings): ProductDefinition[] => {
  return [...DEFAULT_PRODUCTS, ...settings.customProducts];
};

/** Holt nur die aktivierten Produkte */
export const getEnabledProducts = (settings: ProductSettings): ProductDefinition[] => {
  const allProducts = getAllProducts(settings);
  return allProducts.filter(p => settings.enabledProductIds.includes(p.id));
};

/** Holt aktivierte Produkte nach Kategorie */
export const getEnabledProductsByCategory = (
  settings: ProductSettings,
  category: ProductCategory
): ProductDefinition[] => {
  return getEnabledProducts(settings).filter(p => p.category === category);
};

/** Prüft ob erweiterte Produkte aktiviert sind */
export const hasExtendedProductsEnabled = (settings: ProductSettings): boolean => {
  const enabledProducts = getEnabledProducts(settings);
  return enabledProducts.some(p => !p.isClassicPbac);
};

/** Kategorien mit deutschen Labels */
export const PRODUCT_CATEGORY_LABELS: Record<ProductCategory, string> = {
  pad: "Binden",
  tampon: "Tampons",
  cup: "Menstruationstasse",
  disc: "Menstruationsdisc",
  underwear: "Periodenslip",
  free_bleeding: "Freies Bluten",
};


/** Füllgrad-Labels */
export const FILL_LEVEL_LABELS: Record<number, string> = {
  25: "Wenig (~25%)",
  50: "Mittel (~50%)",
  75: "Viel (~75%)",
  100: "Voll (100%)",
  125: "Übergelaufen",
};

/** Free Bleeding Intensitäts-Labels */
export const FREE_BLEEDING_INTENSITY_LABELS = {
  light: { label: "Tropfen", volumeMl: 2 },
  moderate: { label: "Leichter Fluss", volumeMl: 5 },
  heavy: { label: "Starker Fluss", volumeMl: 12 },
  flooding: { label: "Schwall/Flooding", volumeMl: 20 },
};

/** Validiert eine ProductDefinition */
export const validateProductDefinition = (product: Partial<ProductDefinition>): string[] => {
  const errors: string[] = [];
  if (!product.id || product.id.trim() === "") errors.push("ID erforderlich");
  if (!product.name || product.name.trim() === "") errors.push("Name erforderlich");
  if (!product.category) errors.push("Kategorie erforderlich");
  if (product.capacity_ml === undefined || product.capacity_ml < 0) {
    errors.push("Kapazität muss >= 0 sein");
  }
  return errors;
};

/** Erstellt ein neues Custom-Produkt */
export const createCustomProduct = (
  category: ProductCategory,
  name: string,
  capacityMl: number
): ProductDefinition => ({
  id: `custom_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
  category,
  name,
  nameShort: name.substring(0, 10),
  capacity_ml: capacityMl,
  enabled: true,
  isCustom: true,
});
