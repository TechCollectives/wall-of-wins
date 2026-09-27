import { describe, expect, it } from 'vitest'
import {
  backoffMs,
  classifyPostError,
  initialState,
  parseStoredDraft,
  postReducer,
  toInsertRow,
  type Draft,
  type PostState,
} from './postQueue'

const draft = (over: Partial<Draft> = {}): Draft => ({
  id: 'id-1',
  text: 'Got my return offer!!',
  color: 'lime',
  fontIdx: 0,
  ink: 'green',
  type: null,
  ...over,
})

const sending = (): PostState => postReducer(initialState(draft()), { type: 'submit' })

describe('classifyPostError (eng review R4)', () => {
  it.each([
    [{ code: '23505' }, 'duplicate'],
    [{ code: '42501', message: 'new row violates row-level security policy' }, 'closed'],
    [{ code: '23503' }, 'closed'],
    [{ code: 'P0001', message: 'wall_full' }, 'full'],
    [{ code: 'P0001', message: 'something else' }, 'retry'],
    [{ code: '23514' }, 'invalid'],
    [{ code: '22001' }, 'invalid'],
    [{ code: '', message: 'TypeError: Failed to fetch' }, 'retry'],
    [{ message: 'timeout' }, 'retry'],
    [{ code: 'PGRST000' }, 'retry'],
  ] as const)('%o → %s', (error, kind) => {
    expect(classifyPostError(error)).toBe(kind)
  })
})

describe('backoffMs', () => {
  it('doubles from 1s and caps at 30s', () => {
    expect([1, 2, 3, 4, 5, 6, 10].map(backoffMs)).toEqual([1000, 2000, 4000, 8000, 16000, 30000, 30000])
  })
})

describe('postReducer', () => {
  it('posts on success', () => {
    expect(postReducer(sending(), { type: 'result', error: null }).phase).toEqual({ kind: 'posted' })
  })

  it('treats a unique violation on retry as posted, not an error', () => {
    const s = postReducer(sending(), { type: 'result', error: { code: '23505' } })
    expect(s.phase.kind).toBe('posted')
  })

  it('retries network failures with backoff and keeps the same id', () => {
    let s = postReducer(sending(), { type: 'result', error: { message: 'Failed to fetch' } })
    expect(s.phase).toEqual({ kind: 'waiting', attempt: 1, retryInMs: 1000 })
    s = postReducer(s, { type: 'retryDue' })
    expect(s.phase).toEqual({ kind: 'sending', attempt: 2 })
    s = postReducer(s, { type: 'result', error: { code: '' } })
    expect(s.phase).toEqual({ kind: 'waiting', attempt: 2, retryInMs: 2000 })
    expect(s.draft.id).toBe('id-1')
  })

  it.each([
    ['42501', 'closed'],
    ['23514', 'invalid'],
  ] as const)('stops retrying on %s → %s and keeps the draft', (code, kind) => {
    const s = postReducer(sending(), { type: 'result', error: { code } })
    expect(s.phase.kind).toBe(kind)
    expect(s.draft.text).toBe('Got my return offer!!')
    expect(postReducer(s, { type: 'retryDue' })).toBe(s)
  })

  it('stops on a full wall', () => {
    const s = postReducer(sending(), { type: 'result', error: { code: 'P0001', message: 'wall_full' } })
    expect(s.phase.kind).toBe('full')
  })

  it('lets the user edit and resend after an invalid result', () => {
    let s = postReducer(sending(), { type: 'result', error: { code: '23514' } })
    s = postReducer(s, { type: 'edit', patch: { text: 'shorter' } })
    expect(s.phase.kind).toBe('editing')
    expect(postReducer(s, { type: 'submit' }).phase.kind).toBe('sending')
  })

  it('ignores a second tap while sending (no double post)', () => {
    const s = sending()
    expect(postReducer(s, { type: 'submit' })).toBe(s)
  })

  it('refuses to submit blank or over-long text', () => {
    expect(postReducer(initialState(draft({ text: '   ' })), { type: 'submit' }).phase.kind).toBe('editing')
    expect(postReducer(initialState(draft({ text: 'x'.repeat(281) })), { type: 'submit' }).phase.kind).toBe('editing')
    expect(postReducer(initialState(draft({ text: 'x'.repeat(280) })), { type: 'submit' }).phase.kind).toBe('sending')
  })

  it('ignores edits while sending', () => {
    const s = sending()
    expect(postReducer(s, { type: 'edit', patch: { text: 'changed' } })).toBe(s)
  })
})

describe('Add another (eng review C3)', () => {
  const posted = () => postReducer(sending(), { type: 'result', error: null })

  it('starts a fresh draft with a new id and empty text', () => {
    const s = postReducer(posted(), { type: 'addAnother', fresh: draft({ id: 'id-2', text: '' }) })
    expect(s.draft.id).toBe('id-2')
    expect(s.draft.text).toBe('')
    expect(s.phase.kind).toBe('editing')
  })

  it('refuses a "fresh" draft that reuses the posted id', () => {
    const p = posted()
    expect(postReducer(p, { type: 'addAnother', fresh: draft({ text: '' }) })).toBe(p)
  })

  it('only applies after a successful post', () => {
    const s = sending()
    expect(postReducer(s, { type: 'addAnother', fresh: draft({ id: 'id-2' }) })).toBe(s)
  })
})

describe('toInsertRow', () => {
  it('trims text and name, and sends null for an empty name', () => {
    expect(toInsertRow(draft({ text: '  hi  ' }), 'ev', '   ')).toMatchObject({ text: 'hi', name: null, event_id: 'ev' })
    expect(toInsertRow(draft(), 'ev', ` ${'n'.repeat(50)} `).name).toHaveLength(40)
  })
})

describe('parseStoredDraft', () => {
  it('round-trips a valid draft', () => {
    const d = draft({ type: 'win' })
    expect(parseStoredDraft(JSON.stringify(d))).toEqual(d)
  })

  it.each([null, '', '{not json', '{}', JSON.stringify({ ...draft(), color: 'purple' }), JSON.stringify({ ...draft(), fontIdx: 7 })])(
    'rejects %s',
    (raw) => {
      expect(parseStoredDraft(raw)).toBeNull()
    },
  )
})
