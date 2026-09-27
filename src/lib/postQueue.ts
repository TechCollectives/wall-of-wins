// Phone-side posting logic: draft lifecycle, retry and error classification.
// Pure: no network, storage or timers. PostPage wires this to Supabase and setTimeout.
// Eng review R4 (classify errors) and C3 (new id on "Add another").

import type { ColorKey, FontIdx, InkKey, StickyType } from './stickyStyle'
import { COLOR_KEYS, INK_KEYS, STICKY_TYPES } from './stickyStyle'

export const MAX_TEXT = 280
export const MAX_NAME = 40

export interface Draft {
  id: string // becomes stickies.id; one per draft so retries are idempotent
  text: string
  color: ColorKey
  fontIdx: FontIdx
  ink: InkKey
  type: StickyType | null
}

export type Phase =
  | { kind: 'editing' }
  | { kind: 'sending'; attempt: number }
  | { kind: 'waiting'; attempt: number; retryInMs: number } // transient failure, retry scheduled
  | { kind: 'posted' }
  | { kind: 'closed' } // wall closed (RLS) or gone
  | { kind: 'full' } // 500-sticky cap
  | { kind: 'invalid' } // failed a check constraint; user can edit and resend

export interface PostState {
  draft: Draft
  phase: Phase
}

/** Shape of a Supabase/PostgREST error, or anything thrown by fetch. */
export interface PostErrorLike {
  code?: string
  message?: string
}

export type ErrorKind = 'duplicate' | 'closed' | 'full' | 'invalid' | 'retry'

export function classifyPostError(error: PostErrorLike): ErrorKind {
  switch (error.code) {
    case '23505': // unique violation: an earlier attempt already landed
      return 'duplicate'
    case '42501': // RLS: wall is closed
    case '23503': // foreign key: wall no longer exists
      return 'closed'
    case 'P0001':
      return error.message?.includes('wall_full') ? 'full' : 'retry'
    case '23514': // check constraint
    case '22001': // value too long
      return 'invalid'
    default:
      return 'retry' // network failure, timeout, 5xx
  }
}

/** Backoff before retry number `attempt` (1-based): 1s, 2s, 4s, 8s, 16s, then 30s. */
export function backoffMs(attempt: number): number {
  return Math.min(1000 * 2 ** Math.max(0, attempt - 1), 30_000)
}

export type PostEvent =
  | { type: 'edit'; patch: Partial<Omit<Draft, 'id'>> }
  | { type: 'submit' }
  | { type: 'result'; error: PostErrorLike | null }
  | { type: 'retryDue' }
  | { type: 'addAnother'; fresh: Draft }

export function initialState(draft: Draft): PostState {
  return { draft, phase: { kind: 'editing' } }
}

export function canSubmit(state: PostState): boolean {
  const len = state.draft.text.trim().length
  const phase = state.phase.kind
  return len > 0 && len <= MAX_TEXT && (phase === 'editing' || phase === 'invalid')
}

export function postReducer(state: PostState, event: PostEvent): PostState {
  const { phase } = state
  switch (event.type) {
    case 'edit':
      if (phase.kind !== 'editing' && phase.kind !== 'invalid') return state
      return { draft: { ...state.draft, ...event.patch }, phase: { kind: 'editing' } }

    case 'submit':
      if (!canSubmit(state)) return state // also blocks double-tap while sending
      return { ...state, phase: { kind: 'sending', attempt: 1 } }

    case 'result': {
      if (phase.kind !== 'sending') return state
      if (!event.error) return { ...state, phase: { kind: 'posted' } }
      const kind = classifyPostError(event.error)
      if (kind === 'duplicate') return { ...state, phase: { kind: 'posted' } }
      if (kind === 'retry') {
        return { ...state, phase: { kind: 'waiting', attempt: phase.attempt, retryInMs: backoffMs(phase.attempt) } }
      }
      return { ...state, phase: { kind } }
    }

    case 'retryDue':
      if (phase.kind !== 'waiting') return state
      return { ...state, phase: { kind: 'sending', attempt: phase.attempt + 1 } }

    case 'addAnother':
      // A fresh id is required: reusing the old one would hit 23505 and be
      // silently counted as "posted" (eng review C3).
      if (phase.kind !== 'posted' || event.fresh.id === state.draft.id) return state
      return initialState(event.fresh)
  }
}

/** Row for supabase.from('stickies').insert(...). Name comes from localStorage, not the draft. */
export function toInsertRow(draft: Draft, eventId: string, name: string) {
  const trimmedName = name.trim().slice(0, MAX_NAME)
  return {
    id: draft.id,
    event_id: eventId,
    text: draft.text.trim(),
    color: draft.color,
    font_idx: draft.fontIdx,
    ink: draft.ink,
    name: trimmedName || null,
    type: draft.type,
  }
}

/** Restores a draft saved in localStorage; returns null for anything malformed. */
export function parseStoredDraft(raw: string | null): Draft | null {
  if (!raw) return null
  try {
    const d = JSON.parse(raw) as Partial<Draft>
    const valid =
      typeof d.id === 'string' &&
      d.id.length > 0 &&
      typeof d.text === 'string' &&
      COLOR_KEYS.includes(d.color as ColorKey) &&
      [0, 1, 2, 3].includes(d.fontIdx as number) &&
      INK_KEYS.includes(d.ink as InkKey) &&
      (d.type === null || STICKY_TYPES.includes(d.type as StickyType))
    return valid ? (d as Draft) : null
  } catch {
    return null
  }
}
