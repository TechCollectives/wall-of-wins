import { describe, expect, it } from 'vitest'
import { toCsv } from './csv'
import { fitFontSize } from './stickyStyle'
import { resolveSupabaseUrl } from './urls'
import { layoutGrid, MAX_STICKY, MIN_STICKY } from './wallLayout'

describe('layoutGrid (capacity rule)', () => {
  const W = 1840
  const H = 960 // 1080p minus title bar and padding

  it('uses the biggest stickies for a small wall', () => {
    const g = layoutGrid(3, W, H)
    expect(g.size).toBe(MAX_STICKY)
    expect(g.capacity).toBe(3)
    expect(g.hiddenOldest).toBe(0)
  })

  it('shrinks stickies so ~40 all fit', () => {
    const g = layoutGrid(40, W, H)
    expect(g.capacity).toBe(40)
    expect(g.size).toBeLessThan(MAX_STICKY)
    expect(g.size).toBeGreaterThanOrEqual(MIN_STICKY)
  })

  it('fits about 100 at the minimum size on 1080p', () => {
    const g = layoutGrid(90, W, H)
    expect(g.capacity).toBe(90)
  })

  it('piles the oldest into "+N more" beyond capacity, keeping one cell for the pile', () => {
    const g = layoutGrid(400, W, H)
    expect(g.size).toBe(MIN_STICKY)
    expect(g.hiddenOldest).toBeGreaterThan(0)
    expect(g.capacity + g.hiddenOldest).toBe(400)
  })

  it('handles an empty wall', () => {
    expect(layoutGrid(0, W, H)).toMatchObject({ capacity: 0, hiddenOldest: 0, size: MAX_STICKY })
  })
})

describe('fitFontSize', () => {
  it('gets smaller as text gets longer, within bounds', () => {
    const short = fitFontSize(10, 200)
    const long = fitFontSize(280, 200)
    expect(short).toBeGreaterThan(long)
    expect(short).toBeLessThanOrEqual(200 * 0.2)
    expect(long).toBeGreaterThanOrEqual(200 * 0.055)
  })

  it('scales with sticky size', () => {
    expect(fitFontSize(60, 240)).toBeGreaterThan(fitFontSize(60, 120))
  })
})

describe('toCsv', () => {
  it('writes a header and escapes quotes, commas and newlines', () => {
    const csv = toCsv([
      { id: '1', created_at: '2026-10-01T10:00:00Z', color: 'lime', type: 'wish', name: 'Alex', text: 'Ship it, "soon"\nplease' },
      { id: '2', created_at: '2026-10-01T10:00:01Z', color: 'pink', type: null, name: null, text: 'plain' },
    ])
    expect(csv).toBe(
      'created_at,type,name,text,color,id\r\n' +
        '2026-10-01T10:00:00Z,wish,Alex,"Ship it, ""soon""\nplease",lime,1\r\n' +
        '2026-10-01T10:00:01Z,,,plain,pink,2\r\n',
    )
  })

  it('neutralizes spreadsheet formulas', () => {
    const csv = toCsv([{ id: '1', created_at: 't', color: 'lime', type: null, name: '=cmd', text: '+1 for snacks' }])
    expect(csv).toContain(",'=cmd,'+1 for snacks,")
  })
})

describe('resolveSupabaseUrl', () => {
  it('keeps loopback when the page is on localhost', () => {
    expect(resolveSupabaseUrl('http://127.0.0.1:54321', 'localhost')).toBe('http://127.0.0.1:54321')
  })

  it('swaps loopback for the LAN host a phone used', () => {
    expect(resolveSupabaseUrl('http://127.0.0.1:54321', '192.168.1.20')).toBe('http://192.168.1.20:54321')
  })

  it('never touches a real hosted URL', () => {
    expect(resolveSupabaseUrl('https://abc.supabase.co', 'wall.example.org')).toBe('https://abc.supabase.co')
  })
})
