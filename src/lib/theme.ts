/**
 * Helpers para el sistema de temas. Tres temas válidos hoy:
 *   - "mar"      → .theme-mar      (claro náutico, default)
 *   - "sunset"   → .theme-sunset   (claro cálido)
 *   - "midnight" → .theme-midnight (oscuro náutico)
 *
 * El admin elige el default global via Setting "appearance.theme".
 * Cada usuario puede pisarlo con `User.themePreference`. Si la
 * preferencia personal es null/undefined, hereda del global.
 */
export const THEME_KEYS = ["mar", "sunset", "midnight"] as const;
export type ThemeKey = (typeof THEME_KEYS)[number];

export const THEME_META: Record<ThemeKey, { label: string; description: string; isDark: boolean }> = {
  mar: { label: "Mar del Plata (claro náutico)", description: "Azul institucional con acentos cyan.", isDark: false },
  sunset: { label: "Atardecer (claro cálido)", description: "Terracota y crema, más amigable.", isDark: false },
  midnight: { label: "Medianoche (oscuro)", description: "Náutico nocturno con detalles dorados.", isDark: true },
};

export function isThemeKey(v: unknown): v is ThemeKey {
  return typeof v === "string" && (THEME_KEYS as readonly string[]).includes(v);
}

export function themeClass(key: ThemeKey): string {
  return `theme-${key}`;
}
