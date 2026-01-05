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
   * Warm grey base with semantic colors for contextual meaning.
   * Gender-neutral, psychologically appropriate colors.
   */
  neutral: {
    // Base UI colors (warm grey palette, maps to Tailwind rose-* classes)
    ui: {
      50: "#faf8f5", // warm white - backgrounds
      100: "#f2efea", // warm off-white - cards
      200: "#e0dcd7", // light borders
      300: "#c9c4bc", // medium borders
      400: "#a8a099", // muted grey - placeholder text
      500: "#5b7a6b", // sage green - primary accent
      600: "#4a6659", // darker sage - hover states
      700: "#3d5348", // deep sage
      800: "#3d4a4f", // dark text secondary
      900: "#2d3436", // dark text primary
      950: "#1a1f20", // darkest
    },
    accent: "#5b7a6b", // sage green - calming, health-associated
    background: "#f7f5f2", // warm off-white
    // Semantic colors - each color has contextual meaning
    semantic: {
      // Bleeding: soft terracotta - warm, non-aggressive
      bleeding: "#c4786a",
      bleedingLight: "#f0ddd9",
      // Pain: muted purple - calming, not alarming
      pain: "#8b7b9c",
      painLight: "#e8e4ed",
      // Ovulation: warm amber - fertility, life association
      ovulation: "#d4a574",
      ovulationLight: "#f5ebe0",
      // Fertility: soft green - growth, life
      fertility: "#7cb88c",
      fertilityLight: "#e8f4eb",
      // Success: sage green - consistency with accent
      success: "#5b7a6b",
      successLight: "#e8f0eb",
      // Info: soft teal - neutral, informational
      info: "#6b8a9a",
      infoLight: "#e4ecef",
      // Warning: warm amber
      warning: "#d4a574",
      warningLight: "#f5ebe0",
    },
    chart: {
      bleedingArea: "#c4786a",
      bleedingLine: "#a85d50",
      painLine: "#8b7b9c",
      ovulationMarker: "#d4a574",
      ovulationMarkerBorder: "#b8895c",
      fertileWindow: "#7cb88c",
      fertileWindowLight: "#e8f4eb",
      mucusFertility: "#5b9a6b",
      grid: "rgba(91, 122, 107, 0.15)",
    },
    slider: {
      active: "rgba(91, 122, 107, 0.75)",
      track: "rgba(91, 122, 107, 0.14)",
      shadow: "rgba(91, 122, 107, 0.18)",
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
      return "Warme, kontextbezogene Farben mit semantischer Bedeutung";
    default:
      return "";
  }
}

/**
 * Get preview swatch colors for a color scheme
 */
export function getColorSchemeSwatches(scheme: ColorScheme): string[] {
  const colors = THEME_COLORS[scheme];
  return [colors.ui[500], colors.ui[300], colors.ui[50]];
}
