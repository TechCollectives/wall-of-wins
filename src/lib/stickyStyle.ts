// Visual vocabulary for stickies, taken from the physical TIQC wall photo.
// Values here must match the check constraints in supabase/migrations/*_init.sql.

export const COLORS = {
  lime: '#e6f95a',
  pink: '#ff4fa3',
  orange: '#ffc93c',
  blue: '#2fa6ee',
  peri: '#6f7fc9',
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

/** Tilt in degrees for a sticky, stable per id so it never jumps between renders. */
export function tiltFor(id: string): number {
  let hash = 0
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) | 0
  return ((Math.abs(hash) % 61) - 30) / 10 // -3.0 .. 3.0
}

function pick<T>(items: readonly T[], rand: () => number): T {
  const i = Math.min(Math.floor(rand() * items.length), items.length - 1)
  return items[i]
}
