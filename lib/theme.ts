/**
 * Theme color definitions for the Endo app.
 *
 * Edit this file to customize colors for each theme.
 * Colors are organized by purpose for easy modification.
 */

export type ColorScheme = "rose" | "neutral";

export const THEME_COLORS = {
  /**
   * Rose Theme (Original)
   * Monochromatic pink/rose palette - simple, unified look
   */
  rose: {
    // Base UI colors (maps to Tailwind rose-* classes)
    ui: {
      50: "#fff1f2",
      100: "#ffe4e6",
      200: "#fecdd3",
      300: "#fda4af",
      400: "#fb7185",
      500: "#f43f5e",
      600: "#e11d48",
      700: "#be123c",
      800: "#9f1239",
      900: "#881337",
      950: "#4c0519",
    },
    accent: "#e11d48",
    background: "#fff1f2",
    // Rose uses same color family for everything
    semantic: {
      bleeding: "#e11d48",
      bleedingLight: "#fecdd3",
      pain: "#be123c",
      painLight: "#fda4af",
      ovulation: "#facc15",
      ovulationLight: "#fef3c7",
      fertility: "#f472b6",
      fertilityLight: "#fdf2f8",
      success: "#22c55e",
      successLight: "#dcfce7",
      info: "#e11d48",
      infoLight: "#ffe4e6",
      warning: "#f59e0b",
      warningLight: "#fef3c7",
    },
    chart: {
      bleedingArea: "#fda4af",
      bleedingLine: "#e11d48",
      painLine: "#be123c",
      ovulationMarker: "#facc15",
      ovulationMarkerBorder: "#ca8a04",
      fertileWindow: "#f472b6",
      fertileWindowLight: "#fdf2f8",
      mucusFertility: "#22c55e",
      grid: "rgba(253, 164, 175, 0.5)",
    },
    slider: {
      active: "rgba(225, 29, 72, 0.75)",
      track: "rgba(225, 29, 72, 0.14)",
      shadow: "rgba(225, 29, 72, 0.18)",
    },
  },

  /**
   * Neutral Theme (New Default)
   * Warm, friendly base with vibrant semantic colors for navigation.
   * Modern, colorful palette that's tasteful and easy to navigate.
   * Uses distinct colors for each section to aid comprehension.
   */
  neutral: {
    // Base UI colors - warm, inviting palette
    ui: {
      50: "#fdf9f5", // warm cream with peachy undertone - main background
      100: "#faf6f0", // soft warm white - cards
      200: "#f0e9df", // warm sand - light borders
      300: "#e0d6c8", // warm taupe - medium borders
      400: "#b5a899", // warm muted - subtle text
      500: "#e07b5f", // warm coral - friendly primary accent
      600: "#d06a4e", // deeper coral - hover
      700: "#b85a42", // rich terracotta
      800: "#5c5147", // warm dark brown - secondary text
      900: "#3d352e", // warm charcoal - primary text
      950: "#2a241f", // deepest warm black
    },
    accent: "#e07b5f", // warm coral - friendly, inviting
    background: "#fdf9f5", // warm cream with peachy undertone
    // Semantic colors - vibrant, distinct colors for each section
    semantic: {
      // Bleeding: rich coral-red (warm, not alarming)
      bleeding: "#e06058",
      bleedingLight: "#fdf0ef",
      // Pain: vibrant violet-purple
      pain: "#9b6bb3",
      painLight: "#f8f0fc",
      // Ovulation: golden saffron/amber
      ovulation: "#e8a445",
      ovulationLight: "#fef7e8",
      // Fertility: fresh teal-green
      fertility: "#3da88a",
      fertilityLight: "#e8f6f1",
      // Medication: bright sky blue
      medication: "#5a9fd4",
      medicationLight: "#edf5fc",
      // Sleep: soft periwinkle/lavender
      sleep: "#8b7ec9",
      sleepLight: "#f3f0fa",
      // Notes: warm caramel
      notes: "#c9956a",
      notesLight: "#faf4ed",
      // Symptoms: soft rose-pink
      symptoms: "#d4789a",
      symptomsLight: "#fcf0f4",
      // Energy: warm tangerine
      energy: "#e8955a",
      energyLight: "#fef5ed",
      // Mood: gentle coral-pink
      mood: "#e08888",
      moodLight: "#fdf2f2",
      // Success: fresh emerald
      success: "#3da88a",
      successLight: "#e8f6f1",
      // Info: clear sky blue
      info: "#5a9fd4",
      infoLight: "#edf5fc",
      // Warning: golden amber
      warning: "#e8a445",
      warningLight: "#fef7e8",
    },
    chart: {
      bleedingArea: "rgba(224, 96, 88, 0.35)",
      bleedingLine: "#e06058",
      painLine: "#9b6bb3",
      ovulationMarker: "#e8a445",
      ovulationMarkerBorder: "#c88a2a",
      fertileWindow: "#3da88a",
      fertileWindowLight: "#e8f6f1",
      mucusFertility: "#3da88a",
      grid: "rgba(224, 123, 95, 0.12)",
    },
    slider: {
      active: "rgba(224, 123, 95, 0.85)",
      track: "rgba(224, 123, 95, 0.18)",
      shadow: "rgba(224, 123, 95, 0.25)",
    },
  },
} as const;

/**
 * Get the display name for a color scheme (German)
 */
export function getColorSchemeName(scheme: ColorScheme): string {
  switch (scheme) {
    case "rose":
      return "Rose";
    case "neutral":
      return "Neutral";
    default:
      return scheme;
  }
}

/**
 * Get the description for a color scheme (German)
 */
export function getColorSchemeDescription(scheme: ColorScheme): string {
  switch (scheme) {
    case "rose":
      return "Klassisches Schema mit Rosa- und Pinktönen";
    case "neutral":
      return "Warme, farbenfrohe Palette mit lebendigen Akzenten";
    default:
      return "";
  }
}

/**
 * Get preview swatch colors for a color scheme
 */
export function getColorSchemeSwatches(scheme: ColorScheme): string[] {
  if (scheme === "neutral") {
    const colors = THEME_COLORS.neutral;
    // Show the vibrant semantic colors for neutral theme
    return [colors.accent, colors.semantic.fertility, colors.semantic.sleep];
  }
  const colors = THEME_COLORS[scheme];
  return [colors.ui[500], colors.ui[300], colors.ui[50]];
}
