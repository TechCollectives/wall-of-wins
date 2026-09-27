import { describe, expect, it } from 'vitest'
import {
  applyPollResult,
  applyRealtimeInsert,
  beginPoll,
  emptyWall,
  removeLocally,
  type StickyRow,
  type WallState,
} from './wallSync'

const row = (id: string, created_at = `2026-10-01T10:00:0${id.length % 10}Z`): StickyRow => ({
  id,
  created_at,
  text: `sticky ${id}`,
  color: 'lime',
  font_idx: 0,
  ink: 'green',
  name: null,
  type: null,
})

const ids = (s: WallState) => s.stickies.map((x) => x.id)

/** Sends a poll and applies its response immediately. */
function poll(state: WallState, rows: StickyRow[]): WallState {
  const sent = beginPoll(state)
  return applyPollResult(sent.state, sent.pollId, rows)
}

describe('wallSync merge', () => {
  it('adds stickies from a poll in created_at order', () => {
    const a = row('a', '2026-10-01T10:00:01Z')
    const b = row('b', '2026-10-01T10:00:02Z')
    expect(ids(poll(emptyWall, [b, a]))).toEqual(['a', 'b'])
  })

  it('adds a realtime insert once, even if the event is delivered twice', () => {
    const a = row('a')
    const once = applyRealtimeInsert(emptyWall, a)
    const twice = applyRealtimeInsert(once, a)
    expect(ids(twice)).toEqual(['a'])
    expect(twice).toBe(once)
  })

  it('does not duplicate a realtime sticky when the next poll also lists it', () => {
    const a = row('a')
    const s = poll(applyRealtimeInsert(emptyWall, a), [a])
    expect(ids(s)).toEqual(['a'])
  })

  it('keeps object identity for unchanged stickies so React skips re-rendering them', () => {
    const a = row('a')
    const first = poll(emptyWall, [a])
    const second = poll(first, [{ ...a }])
    expect(second.stickies[0]).toBe(first.stickies[0])
    expect(second.stickies).toBe(first.stickies)
  })
})

describe('wallSync removal rule (eng review R5)', () => {
  it('in-flight poll does not remove a sticky that arrived via realtime after it was sent', () => {
    const sent = beginPoll(emptyWall) // poll 1 leaves before the sticky exists
    const withRt = applyRealtimeInsert(sent.state, row('new'))
    const after = applyPollResult(withRt, sent.pollId, []) // poll 1 returns without it
    expect(ids(after)).toEqual(['new'])
  })

  it('removes a sticky hidden after a poll listed it', () => {
    const a = row('a')
    const listed = poll(emptyWall, [a])
    expect(ids(poll(listed, []))).toEqual([])
  })

  it('removes a sticky hidden within seconds of a realtime-only arrival', () => {
    const s = applyRealtimeInsert(emptyWall, row('oops'))
    // No poll ever listed it; the next poll sent after its arrival omits it.
    expect(ids(poll(s, []))).toEqual([])
  })

  it('ignores a stale out-of-order response so a hidden sticky cannot come back', () => {
    const a = row('a')
    const listed = poll(emptyWall, [a])
    const p2 = beginPoll(listed)
    const p3 = beginPoll(p2.state)
    const afterNewer = applyPollResult(p3.state, p3.pollId, []) // hidden
    const afterStale = applyPollResult(afterNewer, p2.pollId, [a]) // late, pre-hide
    expect(ids(afterStale)).toEqual([])
  })

  it('does not let a late realtime event resurrect a removed sticky', () => {
    const a = row('a')
    const removed = poll(poll(emptyWall, [a]), [])
    expect(ids(applyRealtimeInsert(removed, a))).toEqual([])
  })

  it('catches up after a reconnect: adds everything missed, keeps what is there', () => {
    const a = row('a', '2026-10-01T10:00:01Z')
    const b = row('b', '2026-10-01T10:00:02Z')
    const c = row('c', '2026-10-01T10:00:03Z')
    const before = poll(emptyWall, [a])
    expect(ids(poll(before, [a, b, c]))).toEqual(['a', 'b', 'c'])
  })

  it('removeLocally hides immediately on the organizer screen', () => {
    const s = poll(emptyWall, [row('a'), row('bb')])
    const hidden = removeLocally(s, 'a')
    expect(ids(hidden)).toEqual(['bb'])
    expect(ids(applyRealtimeInsert(hidden, row('a')))).toEqual(['bb'])
  })
})
