import { describe, expect, it } from 'vitest'
import { parseArgs } from './event.ts'
import { formatWalls } from './walls.ts'

describe('formatWalls', () => {
  const walls = [
    { slug: 'fall-26', title: 'TIQC Fall 2026 Kickoff', is_open: true, created_at: '2026-09-27T17:54:37Z', visible: 12, hidden: 1 },
    { slug: 'live-check', title: 'Live Check (test)', is_open: false, created_at: '2026-09-27T17:48:12Z', visible: 1, hidden: 0 },
  ]

  it('lists status, title, counts and both public links', () => {
    const out = formatWalls(walls, 'https://wall.example.org/')
    expect(out).toContain('2 walls (1 open)')
    expect(out).toContain('🟢 OPEN    TIQC Fall 2026 Kickoff')
    expect(out).toContain('slug: fall-26 · created Sep 27, 2026 · 12 stickies, 1 hidden')
    expect(out).toContain('projector: https://wall.example.org/e/fall-26/wall')
    expect(out).toContain('phones:    https://wall.example.org/e/fall-26')
    expect(out).toContain('⚪ CLOSED  Live Check (test)')
    expect(out).toContain('1 sticky\n')
  })

  it('never prints an organizer link', () => {
    expect(formatWalls(walls, 'https://wall.example.org')).not.toContain('#admin=')
  })

  it('explains what to do when there are no walls', () => {
    expect(formatWalls([], 'https://x')).toContain('npm run new-event:cloud')
  })
})

describe('parseArgs smart punctuation', () => {
  it.each([
    [['“TIQC Build & Grow”', 'bg-26-c1']],
    [['TIQC Build & Grow', 'bg—26-c1']],
  ])('explains curly quotes / long dashes in %j', (argv) => {
    const r = parseArgs(argv)
    expect(r).toHaveProperty('error')
    expect((r as { error: string }).error).toMatch(/curly quotes/)
  })

  it('accepts & in a properly quoted title', () => {
    expect(parseArgs(['TIQC Build & Grow Studio Founding Cohort', 'bg-26-c1'])).toEqual({
      title: 'TIQC Build & Grow Studio Founding Cohort',
      slug: 'bg-26-c1',
    })
  })
})
