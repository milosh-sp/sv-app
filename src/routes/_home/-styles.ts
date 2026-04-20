/**
 * Homepage-scoped style helpers.
 *
 * The bold-creative accent tokens now live in `src/styles/globals.css` as
 * `--brand-lime`, `--brand-magenta`, `--brand-ink` (exposed to Tailwind as
 * `--color-brand-*`). This module just surfaces friendly aliases for inline
 * `style={{ backgroundColor: HOME_ACCENT.lime }}` usage within `_home`.
 */

export const HOME_ACCENT = {
  lime: "var(--brand-lime)",
  limeSoft: "var(--brand-lime-soft)",
  magenta: "var(--brand-magenta)",
  magentaSoft: "var(--brand-magenta-soft)",
  ink: "var(--brand-ink)",
} as const;

/**
 * Faint grid pattern background used behind hero and feature slabs.
 * Works in both light & dark themes via `currentColor`-style opacity.
 */
export const HOME_GRID_BG =
  "bg-[radial-gradient(circle_at_1px_1px,rgba(120,120,120,0.25)_1px,transparent_0)] bg-size-[28px_28px]";
