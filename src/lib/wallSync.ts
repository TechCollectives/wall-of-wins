// Projector-side merge of realtime inserts and the 5s full-list poll.
// Pure: the WallPage owns the timers, the Supabase channel and the fetches.
//
// Removal rule (eng review R5 / D8), no clocks involved:
//   every poll gets an increasing id when it is SENT;
//   each sticky remembers knownSince = the latest poll id at the moment the wall learned of it;
//   a poll response removes a sticky only if that poll's id > knownSince and the sticky is absent.
// So a poll that was already in flight when a sticky arrived via realtime can't remove it,
// while any poll sent afterwards reflects hides. Responses older than the last applied poll
// are ignored, so an out-of-order stale response can't bring back a hidden sticky.

export interface StickyRow {
  id: string
  created_at: string
  text: string
  color: string
  font_idx: number
  ink: string
  name: string | null
  type: string | null
}

export interface WallState {
  stickies: StickyRow[] // oldest first, same object identity while unchanged
  knownSince: ReadonlyMap<string, number>
  gone: ReadonlySet<string> // removed ids; realtime can't resurrect them
  lastSentPoll: number
  lastAppliedPoll: number
}

export const emptyWall: WallState = {
  stickies: [],
  knownSince: new Map(),
  gone: new Set(),
  lastSentPoll: 0,
  lastAppliedPoll: 0,
}

/** Call right before sending a poll request; tag the request with the returned pollId. */
export function beginPoll(state: WallState): { state: WallState; pollId: number } {
  const pollId = state.lastSentPoll + 1
  return { state: { ...state, lastSentPoll: pollId }, pollId }
}

export function applyRealtimeInsert(state: WallState, row: StickyRow): WallState {
  if (state.knownSince.has(row.id) || state.gone.has(row.id)) return state
  const knownSince = new Map(state.knownSince).set(row.id, state.lastSentPoll)
  return { ...state, stickies: insertSorted(state.stickies, row), knownSince }
}

export function applyPollResult(state: WallState, pollId: number, rows: StickyRow[]): WallState {
  if (pollId <= state.lastAppliedPoll) return state // stale, out-of-order response

  const inPoll = new Set(rows.map((r) => r.id))
  const knownSince = new Map(state.knownSince)
  const gone = new Set(state.gone)
  let changed = false

  const kept = state.stickies.filter((s) => {
    if (inPoll.has(s.id)) return true
    if (pollId > (knownSince.get(s.id) ?? 0)) {
      knownSince.delete(s.id)
      gone.add(s.id)
      changed = true
      return false
    }
    return true
  })

  let stickies = kept
  for (const row of rows) {
    if (knownSince.has(row.id)) continue
    stickies = insertSorted(stickies, row)
    knownSince.set(row.id, pollId)
    gone.delete(row.id)
    changed = true
  }

  if (!changed) return { ...state, lastAppliedPoll: pollId }
  return { ...state, stickies, knownSince, gone, lastAppliedPoll: pollId }
}

/** Organizer tapped Hide and the RPC succeeded: remove immediately on this screen. */
export function removeLocally(state: WallState, id: string): WallState {
  if (!state.knownSince.has(id)) return state
  const knownSince = new Map(state.knownSince)
  knownSince.delete(id)
  return {
    ...state,
    stickies: state.stickies.filter((s) => s.id !== id),
    knownSince,
    gone: new Set(state.gone).add(id),
  }
}

function insertSorted(list: StickyRow[], row: StickyRow): StickyRow[] {
  let i = list.length
  while (i > 0 && compare(list[i - 1], row) > 0) i--
  return [...list.slice(0, i), row, ...list.slice(i)]
}

function compare(a: StickyRow, b: StickyRow): number {
  if (a.created_at !== b.created_at) return a.created_at < b.created_at ? -1 : 1
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
}
