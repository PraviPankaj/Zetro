export const STORE_THEMES = [
  {
    id: "playful",
    name: "Playful Kids",
    description: "Warm coral and teal — great for kids stores.",
    swatch: ["#ff6b6b", "#4ecdc4"],
  },
  {
    id: "classic",
    name: "Classic Boutique",
    description: "Navy and gold for a refined look.",
    swatch: ["#1e3a5f", "#c9a227"],
  },
  {
    id: "fresh",
    name: "Fresh Market",
    description: "Green and cream for organic, everyday shops.",
    swatch: ["#2d6a4f", "#f1faee"],
  },
  {
    id: "minimal",
    name: "Minimal",
    description: "Clean monochrome with sharp contrast.",
    swatch: ["#111827", "#f3f4f6"],
  },
];

export function themeClass(themeId) {
  if (!STORE_THEMES.some((t) => t.id === themeId)) {
    return "sf-theme-custom";
  }
  return `sf-theme-${themeId}`;
}

export function getTheme(themeId) {
  return STORE_THEMES.find((t) => t.id === themeId) || STORE_THEMES[0];
}
