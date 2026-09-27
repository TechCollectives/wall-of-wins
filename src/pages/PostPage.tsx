import { useEffect, useReducer, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useWallEvent } from '../lib/events'
import { newId } from '../lib/ids'
import {
  canSubmit,
  initialState,
  MAX_NAME,
  MAX_TEXT,
  parseStoredDraft,
  postReducer,
  toInsertRow,
  type Draft,
} from '../lib/postQueue'
import {
  COLOR_KEYS,
  COLORS,
  displayInk,
  FONTS,
  randomLook,
  STICKY_TYPES,
  type StickyType,
} from '../lib/stickyStyle'
import { supabase } from '../lib/supabase'

const TYPE_LABELS: Record<StickyType, string> = { wish: '✨ Wish', win: '🏆 Win', thanks: '💛 Thanks' }
const NAME_KEY = 'wall-name'

const draftKey = (slug: string) => `wall-draft:${slug}`

function freshDraft(): Draft {
  return { id: newId(), text: '', type: null, ...randomLook() }
}

function readStorage(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function writeStorage(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key)
    else localStorage.setItem(key, value)
  } catch {
    // private mode or blocked storage: drafts just won't survive a reload
  }
}

export function PostPage() {
  const { slug = '' } = useParams()
  const [load] = useWallEvent(slug)
  const [state, dispatch] = useReducer(postReducer, slug, (s) =>
    initialState(parseStoredDraft(readStorage(draftKey(s))) ?? freshDraft()),
  )
  const [name, setName] = useState(() => readStorage(NAME_KEY) ?? '')
  const { draft, phase } = state
  const eventId = load.status === 'ready' ? load.event.id : null

  // Keep the draft across reloads until it lands.
  useEffect(() => {
    writeStorage(draftKey(slug), phase.kind === 'posted' ? null : JSON.stringify(draft))
  }, [slug, draft, phase.kind])

  useEffect(() => writeStorage(NAME_KEY, name.trim() || null), [name])

  // Send. Retries reuse draft.id, so a repeat of a post that already landed is a
  // unique violation, which postReducer counts as success.
  useEffect(() => {
    if (phase.kind !== 'sending' || !eventId) return
    let cancelled = false
    supabase
      .from('stickies')
      .insert(toInsertRow(draft, eventId, name))
      .abortSignal(AbortSignal.timeout(10_000))
      .then(
        ({ error }) => {
          if (!cancelled) dispatch({ type: 'result', error: error && { code: error.code, message: error.message } })
        },
        (e: unknown) => {
          if (!cancelled) dispatch({ type: 'result', error: { message: String(e) } })
        },
      )
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- send once per attempt
  }, [phase, eventId])

  useEffect(() => {
    if (phase.kind !== 'waiting') return
    const t = setTimeout(() => dispatch({ type: 'retryDue' }), phase.retryInMs)
    return () => clearTimeout(t)
  }, [phase])

  if (load.status === 'loading') return <main className="phone center">Loading…</main>
  if (load.status === 'missing')
    return (
      <main className="phone center">
        <h1>Wall not found</h1>
        <p>Check the QR code or link and try again.</p>
      </main>
    )
  if (load.status === 'error')
    return (
      <main className="phone center">
        <h1>Can't reach the wall</h1>
        <p>Check your connection. Retrying…</p>
      </main>
    )

  const { event } = load
  if (!event.is_open || phase.kind === 'closed')
    return (
      <main className="phone center">
        <h1>{event.title}</h1>
        <p className="notice">This wall is closed. Thanks for stopping by!</p>
      </main>
    )

  if (phase.kind === 'posted')
    return (
      <main className="phone center">
        <p className="look-up">Look up! ↑</p>
        <p>Your sticky is on the wall.</p>
        <button className="primary" onClick={() => dispatch({ type: 'addAnother', fresh: freshDraft() })}>
          Add another
        </button>
      </main>
    )

  const busy = phase.kind === 'sending' || phase.kind === 'waiting'
  const remaining = MAX_TEXT - draft.text.length

  return (
    <main className="phone">
      <h1>{event.title}</h1>
      <p className="prompt">A wish, a win, or a thank-you</p>

      <textarea
        className="pad"
        aria-label="Your sticky"
        placeholder="Write here…"
        value={draft.text}
        maxLength={MAX_TEXT}
        disabled={busy}
        onChange={(e) => dispatch({ type: 'edit', patch: { text: e.target.value } })}
        style={{
          background: COLORS[draft.color],
          color: displayInk(draft.color, draft.ink),
          fontFamily: `"${FONTS[draft.fontIdx]}", cursive`,
        }}
      />
      {remaining <= 60 && <p className="count">{remaining} left</p>}

      <div className="swatches" role="radiogroup" aria-label="Sticky color">
        {COLOR_KEYS.map((c) => (
          <button
            key={c}
            role="radio"
            aria-checked={draft.color === c}
            aria-label={c}
            className={`swatch${draft.color === c ? ' on' : ''}`}
            style={{ background: COLORS[c] }}
            disabled={busy}
            onClick={() => dispatch({ type: 'edit', patch: { color: c } })}
          />
        ))}
      </div>

      <div className="chips">
        {STICKY_TYPES.map((t) => (
          <button
            key={t}
            aria-pressed={draft.type === t}
            className={`chip${draft.type === t ? ' on' : ''}`}
            disabled={busy}
            onClick={() => dispatch({ type: 'edit', patch: { type: draft.type === t ? null : t } })}
          >
            {TYPE_LABELS[t]}
          </button>
        ))}
        <span className="optional">optional</span>
      </div>

      <input
        className="name"
        aria-label="Your name (optional)"
        placeholder="Your name (optional)"
        value={name}
        maxLength={MAX_NAME}
        disabled={busy}
        onChange={(e) => setName(e.target.value)}
      />

      {phase.kind === 'full' && <p className="notice">This wall is full. Thank you for joining in!</p>}
      {phase.kind === 'invalid' && <p className="notice">That didn't fit. Shorten it and try again.</p>}
      {phase.kind === 'waiting' && <p className="status">Connection hiccup, retrying…</p>}

      <button
        className="primary stick"
        disabled={!canSubmit(state) || phase.kind === 'full'}
        onClick={() => dispatch({ type: 'submit' })}
      >
        {busy ? 'Sticking…' : 'Stick it 📌'}
      </button>
    </main>
  )
}
