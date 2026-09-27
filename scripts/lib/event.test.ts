import { describe, expect, it } from 'vitest'
import { eventLinks, newAdminToken, parseArgs, sha256Hex } from './event.ts'

describe('new-event helpers', () => {
  it('parses title and slug', () => {
    expect(parseArgs(['Summer Interns', 'summer-26'])).toEqual({ title: 'Summer Interns', slug: 'summer-26' })
  })

  it.each([[[]], [['Title']], [['Title', 'Bad Slug']], [['Title', '-leading']], [['Title', 'x']], [['x'.repeat(121), 'ok-slug']]])(
    'rejects %j',
    (argv) => {
      expect(parseArgs(argv)).toHaveProperty('error')
    },
  )

  it('builds the organizer link with #admin=, never ?admin= (eng review R3)', () => {
    const links = eventLinks('https://wall.example.org/', 'summer-26', 'tok_en-1')
    expect(links).toEqual({
      phone: 'https://wall.example.org/e/summer-26',
      wall: 'https://wall.example.org/e/summer-26/wall',
      admin: 'https://wall.example.org/e/summer-26/wall#admin=tok_en-1',
    })
    expect(links.admin).not.toContain('?')
  })

  it('makes unguessable tokens and stores only their hash', () => {
    const a = newAdminToken()
    const b = newAdminToken()
    expect(a.token).not.toBe(b.token)
    expect(a.token.length).toBeGreaterThanOrEqual(32)
    expect(a.hash).toBe(sha256Hex(a.token))
    expect(a.hash).toMatch(/^[0-9a-f]{64}$/)
  })

  it('hashes the same way as the database (sha256 hex of UTF-8)', () => {
    // Value of encode(sha256(convert_to('tok-open', 'UTF8')), 'hex') from the local Postgres 17.
    expect(sha256Hex('tok-open')).toBe('7789b6f913b11ceeb74f8adc74e641b118f5006507ff4268480099de5db720f5')
  })
})
