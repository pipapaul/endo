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
    // Base UI colors - warm, inviting palette with good contrast
    ui: {
      50: "#f5efe8", // warmer cream - main background (darker for contrast)
      100: "#f0e8df", // warm off-white - cards
      200: "#e5dcd0", // warm sand - light borders
      300: "#d5c9ba", // warm taupe - medium borders
      400: "#a89888", // warm muted - subtle text
      500: "#f13524", // vibrant red - highlight accent
      600: "#d92d1e", // darker red - hover
      700: "#b82518", // deep red
      800: "#5c5147", // warm dark brown - secondary text
      900: "#3d352e", // warm charcoal - primary text
      950: "#2a241f", // deepest warm black
    },
    accent: "#f13524", // vibrant red - highlight accent
    background: "#f5efe8", // warmer cream - darker for better contrast
    // Semantic colors - vibrant colors for icons and accents
    semantic: {
      // Bleeding: vibrant coral-red
      bleeding: "#e8524a",
      bleedingLight: "#fdf0ef",
      // Pain: vibrant violet-purple
      pain: "#a855f7",
      painLight: "#f8f0fc",
      // Ovulation: vibrant golden amber
      ovulation: "#f59e0b",
      ovulationLight: "#fef7e8",
      // Fertility: vibrant teal-green
      fertility: "#14b8a6",
      fertilityLight: "#e8f6f1",
      // Medication: vibrant sky blue
      medication: "#0ea5e9",
      medicationLight: "#edf5fc",
      // Sleep: vibrant indigo/purple
      sleep: "#8b5cf6",
      sleepLight: "#f3f0fa",
      // Notes: vibrant amber/orange
      notes: "#f97316",
      notesLight: "#faf4ed",
      // Symptoms: vibrant rose-pink
      symptoms: "#ec4899",
      symptomsLight: "#fcf0f4",
      // Energy: vibrant orange
      energy: "#f97316",
      energyLight: "#fef5ed",
      // Mood: vibrant pink
      mood: "#f472b6",
      moodLight: "#fdf2f2",
      // Success: vibrant emerald
      success: "#10b981",
      successLight: "#e8f6f1",
      // Info: vibrant sky blue
      info: "#0ea5e9",
      infoLight: "#edf5fc",
      // Warning: vibrant amber
      warning: "#f59e0b",
      warningLight: "#fef7e8",
    },
    chart: {
      bleedingArea: "rgba(232, 82, 74, 0.35)",
      bleedingLine: "#e8524a",
      painLine: "#a855f7",
      ovulationMarker: "#f59e0b",
      ovulationMarkerBorder: "#d97706",
      fertileWindow: "#14b8a6",
      fertileWindowLight: "#e8f6f1",
      mucusFertility: "#14b8a6",
      grid: "rgba(61, 53, 46, 0.08)",
    },
    slider: {
      active: "rgba(241, 53, 36, 0.85)",
      track: "rgba(241, 53, 36, 0.15)",
      shadow: "rgba(241, 53, 36, 0.2)",
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
    // Show charcoal + vibrant icon colors for neutral theme
    return [colors.accent, colors.semantic.fertility, colors.semantic.medication];
  }
  const colors = THEME_COLORS[scheme];
  return [colors.ui[500], colors.ui[300], colors.ui[50]];
}
