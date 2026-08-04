// ###################################################
// File Name : colorPatterns.js
// Author : Hibiya Haraki
// Date : August 2026
// ###################################################
// Purpose : Theme and color pattern definitions
// Description : Generates theme tokens and exports selectable color presets.
// ###################################################

function hexToRgb(hexColor) {
  const hex = hexColor.replace("#", "");
  return {
    r: Number.parseInt(hex.slice(0, 2), 16),
    g: Number.parseInt(hex.slice(2, 4), 16),
    b: Number.parseInt(hex.slice(4, 6), 16),
  };
}

function toRgba(hexColor, alpha) {
  const { r, g, b } = hexToRgb(hexColor);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function mixHex(firstColor, secondColor, ratio) {
  const first = hexToRgb(firstColor);
  const second = hexToRgb(secondColor);
  const r = Math.round(first.r + (second.r - first.r) * ratio);
  const g = Math.round(first.g + (second.g - first.g) * ratio);
  const b = Math.round(first.b + (second.b - first.b) * ratio);
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

function createThemeColors(mainColor, textColor, textBackgroundColor, overrides = {}) {
  const secondaryColor = overrides.secondaryColor ?? mixHex(mainColor, textColor, 0.22);
  return {
    mainColor,
    textColor,
    textBackgroundColor,
    secondaryColor,
    surfaceColor: overrides.surfaceColor ?? textBackgroundColor,
    mutedColor: overrides.mutedColor ?? toRgba(textColor, 0.74),
    borderColor: overrides.borderColor ?? toRgba(textColor, 0.28),
    softColor: overrides.softColor ?? toRgba(textBackgroundColor, 0.86),
    inputBgColor: overrides.inputBgColor ?? toRgba(textBackgroundColor, 0.74),
    inputTextColor: overrides.inputTextColor ?? textColor,
    successColor: overrides.successColor ?? mixHex(mainColor, "#22c55e", 0.58),
    dangerColor: overrides.dangerColor ?? mixHex(mainColor, "#ef4444", 0.62),
  };
}

export const COLOR_PATTERNS = [
  {
    id: "classic",
    label: "Classic",
    colors: createThemeColors("#0a1561", "#d4d4d4", "#1e1e1e"),
  },
  {
    id: "sunrise",
    label: "Sunrise",
    colors: createThemeColors("#8a2d0a", "#ffe9dc", "#2a140e"),
  },
  {
    id: "forest",
    label: "Forest",
    colors: createThemeColors("#1e5b2b", "#dff7e4", "#102518"),
  },
  {
    id: "dawn",
    label: "Dawn",
    colors: createThemeColors("#7b341e", "#fff1e8", "#2f1610"),
  },
  {
    id: "copper",
    label: "Copper",
    colors: createThemeColors("#7c2d12", "#ffedd5", "#2b1a13"),
  },
  {
    id: "pine",
    label: "Pine",
    colors: createThemeColors("#14532d", "#dcfce7", "#0e2418"),
  },
  {
    id: "ocean",
    label: "Ocean",
    colors: createThemeColors("#0a4f73", "#d8f3ff", "#0c1f2a"),
  },
  {
    id: "arctic",
    label: "Arctic",
    colors: createThemeColors("#155e75", "#ecfeff", "#10222a"),
  },
  {
    id: "slate",
    label: "Slate",
    colors: createThemeColors("#334155", "#e2e8f0", "#111827"),
  },
  {
    id: "charcoal",
    label: "Charcoal",
    colors: createThemeColors("#374151", "#f3f4f6", "#111315"),
  },
  {
    id: "coffee",
    label: "Coffee",
    colors: createThemeColors("#5a3b2e", "#f5e8dc", "#2a1a14"),
  },
  {
    id: "sand",
    label: "Sand",
    colors: createThemeColors("#92400e", "#fef3c7", "#2e1c12"),
  },
  {
    id: "emerald",
    label: "Emerald",
    colors: createThemeColors("#0f766e", "#d1fae5", "#062b28"),
  },
  {
    id: "teal-night",
    label: "Teal Night",
    colors: createThemeColors("#0f766e", "#ccfbf1", "#05201f"),
  },
  {
    id: "midnight",
    label: "Midnight",
    colors: createThemeColors("#1e293b", "#cbd5e1", "#020617"),
  },
  {
    id: "royal",
    label: "Royal",
    colors: createThemeColors("#1e3a8a", "#dbeafe", "#0b1536"),
  },
  {
    id: "high-contrast",
    label: "High Contrast",
    colors: createThemeColors("#000000", "#ffffff", "#1a1a1a", {
      secondaryColor: "#3b3b3b",
      borderColor: "rgba(255, 255, 255, 0.58)",
      mutedColor: "rgba(255, 255, 255, 0.88)",
      softColor: "rgba(26, 26, 26, 0.94)",
      inputBgColor: "rgba(26, 26, 26, 0.94)",
    }),
  },
];