// Visual vocabulary for stickies. Color names come from the physical TIQC wall photo;
// values are the "soft neon" palette (toned down, still readable across a room).
// Values here must match the check constraints in supabase/migrations/*_init.sql.

export const COLORS = {
  lime: '#e8f39a',
  pink: '#f6a6c8',
  orange: '#ffd583',
  blue: '#93cdf2',
  peri: '#aab4e8',
} as const

export const INKS = {
  green: '#1d7a3a',
  black: '#1b1b1b',
  blue: '#1f3fa8',
} as const

// Index is stored as stickies.font_idx; fonts are bundled via @fontsource (eng review D10).
export const FONTS = ['Caveat', 'Patrick Hand', 'Kalam', 'Gochi Hand'] as const

export const STICKY_TYPES = ['wish', 'win', 'thanks'] as const

export type ColorKey = keyof typeof COLORS
export type InkKey = keyof typeof INKS
export type FontIdx = 0 | 1 | 2 | 3
export type StickyType = (typeof STICKY_TYPES)[number]

export const COLOR_KEYS = Object.keys(COLORS) as ColorKey[]
export const INK_KEYS = Object.keys(INKS) as InkKey[]

export interface StickyLook {
  color: ColorKey
  fontIdx: FontIdx
  ink: InkKey
}

/** Picks a random look for a new draft. `rand` returns [0, 1), like Math.random. */
export function randomLook(rand: () => number = Math.random): StickyLook {
  return {
    color: pick(COLOR_KEYS, rand),
    fontIdx: pick([0, 1, 2, 3] as const, rand),
    ink: pick(INK_KEYS, rand),
  }
}

// Projectors wash out contrast, so hold ink to WCAG AA (4.5:1) on its sticky color.
export const MIN_INK_CONTRAST = 4.5

/** Ink actually drawn: the poster's ink if it reads well on this color, otherwise black. */
export function displayInk(color: ColorKey, ink: InkKey): string {
  return contrastRatio(COLORS[color], INKS[ink]) >= MIN_INK_CONTRAST ? INKS[ink] : INKS.black
}

/** WCAG 2 contrast ratio between two #rrggbb colors. */
export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const v = parseInt(hex.slice(i, i + 2), 16) / 255
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/** Tilt in degrees for a sticky, stable per id so it never jumps between renders. */
export function tiltFor(id: string): number {
  let hash = 0
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) | 0
  return ((Math.abs(hash) % 61) - 30) / 10 // -3.0 .. 3.0
}

/**
 * Font size (px) so `chars` characters of handwriting fit a square sticky of `size` px,
 * leaving room for the name line. Computed, not measured, so 100 stickies never trigger
 * layout thrash (eng review P2). Handwriting glyphs average ~0.5em wide at 1.2 line height.
 */
export function fitFontSize(chars: number, size: number): number {
  const textArea = (size * 0.84) * (size * 0.68)
  const fs = Math.sqrt(textArea / (Math.max(chars, 1) * 0.5 * 1.2)) * 0.9
  return Math.round(Math.min(Math.max(fs, size * 0.055), size * 0.2) * 10) / 10
}

function pick<T>(items: readonly T[], rand: () => number): T {
  const i = Math.min(Math.floor(rand() * items.length), items.length - 1)
  return items[i]
}
