import { describe, expect, it } from 'vitest'
import { newId } from './ids'

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

describe('newId', () => {
  it('uses crypto.randomUUID when the page is a secure context', () => {
    expect(newId({ getRandomValues: (a) => a, randomUUID: () => 'from-randomUUID' })).toBe('from-randomUUID')
  })

  it('builds a valid v4 UUID without randomUUID (plain http on a LAN IP)', () => {
    const insecure = { getRandomValues: (a: Uint8Array<ArrayBuffer>) => crypto.getRandomValues(a) }
    const ids = new Set(Array.from({ length: 200 }, () => newId(insecure)))
    expect(ids.size).toBe(200)
    for (const id of ids) expect(id).toMatch(UUID_V4)
  })
})
