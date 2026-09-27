import { describe, expect, it } from 'vitest'
import { COLOR_KEYS, INK_KEYS, randomLook, tiltFor } from './stickyStyle'

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
