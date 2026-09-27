import { describe, expect, it } from 'vitest'
import { COLOR_KEYS, COLORS, INK_KEYS, INKS, MIN_INK_CONTRAST, contrastRatio, displayInk, randomLook, tiltFor } from './stickyStyle'

describe('randomLook', () => {
  it('covers the lowest and highest values without going out of range', () => {
    expect(randomLook(() => 0)).toEqual({ color: 'lime', fontIdx: 0, ink: 'green' })
    expect(randomLook(() => 0.999999)).toEqual({ color: 'peri', fontIdx: 3, ink: 'blue' })
  })

  it('always returns values the database accepts', () => {
    for (let i = 0; i < 200; i++) {
      const look = randomLook()
      expect(COLOR_KEYS).toContain(look.color)
      expect(INK_KEYS).toContain(look.ink)
      expect([0, 1, 2, 3]).toContain(look.fontIdx)
    }
  })
})

describe('tiltFor', () => {
  it('is stable per id and stays within ±3°', () => {
    const id = 'f3c1a1e2-0000-4000-8000-000000000001'
    expect(tiltFor(id)).toBe(tiltFor(id))
    for (let i = 0; i < 200; i++) {
      const t = tiltFor(crypto.randomUUID())
      expect(t).toBeGreaterThanOrEqual(-3)
      expect(t).toBeLessThanOrEqual(3)
    }
  })
})

describe('displayInk', () => {
  it('keeps the poster\'s ink when it reads well', () => {
    expect(displayInk('lime', 'green')).toBe(INKS.green)
    expect(displayInk('pink', 'blue')).toBe(INKS.blue)
    expect(displayInk('orange', 'blue')).toBe(INKS.blue)
  })

  it('swaps low-contrast ink (green on pink) for black', () => {
    expect(contrastRatio(COLORS.pink, INKS.green)).toBeLessThan(MIN_INK_CONTRAST)
    expect(displayInk('pink', 'green')).toBe(INKS.black)
  })

  it('never draws ink below the minimum contrast on any color', () => {
    for (const color of COLOR_KEYS)
      for (const ink of INK_KEYS) expect(contrastRatio(COLORS[color], displayInk(color, ink))).toBeGreaterThanOrEqual(MIN_INK_CONTRAST)
  })
})

describe('contrastRatio', () => {
  it('matches known WCAG values', () => {
    expect(contrastRatio('#ffffff', '#000000')).toBeCloseTo(21, 5)
    expect(contrastRatio('#777777', '#ffffff')).toBeCloseTo(4.48, 2)
  })
})
