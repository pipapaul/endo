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
