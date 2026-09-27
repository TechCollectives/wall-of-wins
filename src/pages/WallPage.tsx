import QRCode from 'qrcode'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Sticky } from '../components/Sticky'
import { useAdminToken } from '../lib/admin'
import { toCsv, type ExportRow } from '../lib/csv'
import { useWallEvent } from '../lib/events'
import { FONTS } from '../lib/stickyStyle'
import { phoneUrl, supabase } from '../lib/supabase'
import { layoutGrid } from '../lib/wallLayout'
import {
  applyPollResult,
  applyRealtimeInsert,
  beginPoll,
  emptyWall,
  removeLocally,
  type StickyRow,
  type WallState,
} from '../lib/wallSync'

const POLL_MS = 5_000
const COLUMNS = 'id, created_at, text, color, font_idx, ink, name, type'

/** Resolves when the handwriting fonts are ready (or after 3s), so the first frame isn't a fallback font. */
function useFontsReady(): boolean {
  const [ready, setReady] = useState(false)
  useEffect(() => {
    const loads = FONTS.map((f) => document.fonts.load(`48px "${f}"`))
    const timeout = new Promise((r) => setTimeout(r, 3_000))
    void Promise.race([Promise.allSettled(loads), timeout]).then(() => setReady(true))
  }, [])
  return ready
}

/** Callback ref, so measuring starts whenever the element mounts (not just on first render). */
function useElementSize<T extends HTMLElement>() {
  const [el, setEl] = useState<T | null>(null)
  const [size, setSize] = useState({ width: 0, height: 0 })
  useEffect(() => {
    if (!el) return
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect
      setSize({ width: Math.floor(width), height: Math.floor(height) })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [el])
  return [setEl, size] as const
}

function QrCard({ url, size, big }: { url: string; size: number; big?: boolean }) {
  const [src, setSrc] = useState('')
  useEffect(() => {
    void QRCode.toDataURL(url, { margin: 1, width: 512, errorCorrectionLevel: 'M' }).then(setSrc)
  }, [url])
  return (
    <div className={`qr${big ? ' big' : ''}`} style={big ? undefined : { width: size, height: size }}>
      {src && <img src={src} alt={`QR code for ${url}`} />}
      <span>{big ? 'Be the first. Scan to add yours' : 'Scan to add yours'}</span>
    </div>
  )
}

export function WallPage() {
  const { slug = '' } = useParams()
  const [load, setEvent] = useWallEvent(slug)
  const adminToken = useAdminToken(slug)
  const fontsReady = useFontsReady()
  const [boardRef, board] = useElementSize<HTMLDivElement>()

  // wallRef is the source of truth; `wall` mirrors it for rendering.
  const wallRef = useRef<WallState>(emptyWall)
  const [wall, setWall] = useState<WallState>(emptyWall)
  const commit = useCallback((next: WallState) => {
    if (next === wallRef.current) return
    wallRef.current = next
    setWall(next)
  }, [])

  const [live, setLive] = useState(false)
  const [pollOk, setPollOk] = useState(true)
  // Stickies present on first load don't animate; everything after does.
  const [initialIds, setInitialIds] = useState<ReadonlySet<string> | null>(null)

  const eventId = load.status === 'ready' ? load.event.id : null

  const pollNow = useCallback(async () => {
    if (!eventId) return
    const sent = beginPoll(wallRef.current)
    wallRef.current = sent.state
    const { data, error } = await supabase
      .from('stickies')
      .select(COLUMNS)
      .eq('event_id', eventId)
      .order('created_at')
      .limit(600)
      .abortSignal(AbortSignal.timeout(8_000))
    if (error || !data) {
      setPollOk(false)
      return
    }
    setPollOk(true)
    setInitialIds((prev) => prev ?? new Set(data.map((r) => r.id)))
    commit(applyPollResult(wallRef.current, sent.pollId, data as StickyRow[]))
  }, [eventId, commit])

  useEffect(() => {
    if (!eventId) return
    const channel = supabase
      .channel(`wall-${eventId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'stickies', filter: `event_id=eq.${eventId}` },
        (payload) => commit(applyRealtimeInsert(wallRef.current, payload.new as StickyRow)),
      )
      .subscribe((status) => {
        setLive(status === 'SUBSCRIBED')
        if (status === 'SUBSCRIBED') void pollNow() // catch up after (re)connect
      })
    void pollNow()
    const timer = setInterval(() => void pollNow(), POLL_MS)
    const onOnline = () => void pollNow()
    window.addEventListener('online', onOnline)
    return () => {
      clearInterval(timer)
      window.removeEventListener('online', onOnline)
      void supabase.removeChannel(channel)
    }
  }, [eventId, pollNow, commit])

  const event = load.status === 'ready' ? load.event : null

  const hide = useCallback(
    async (s: StickyRow) => {
      if (!adminToken || !window.confirm(`Hide this sticky?\n\n"${s.text.slice(0, 80)}"`)) return
      const { error } = await supabase.rpc('hide_sticky', { p_token: adminToken, p_sticky_id: s.id })
      if (error) window.alert(`Couldn't hide it: ${error.message}`)
      else commit(removeLocally(wallRef.current, s.id))
    },
    [adminToken, commit],
  )

  const toggleOpen = useCallback(async () => {
    if (!adminToken || !event) return
    const next = !event.is_open
    const { error } = await supabase.rpc('set_open', { p_token: adminToken, p_open: next })
    if (error) window.alert(`Couldn't update the wall: ${error.message}`)
    else setEvent({ ...event, is_open: next })
  }, [adminToken, event, setEvent])

  const exportCsv = useCallback(async () => {
    if (!adminToken) return
    const { data, error } = await supabase.rpc('export_event', { p_token: adminToken })
    if (error) return window.alert(`Export failed: ${error.message}`)
    const blob = new Blob([toCsv(data as ExportRow[])], { type: 'text/csv;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `${slug}-stickies.csv`
    a.click()
    URL.revokeObjectURL(a.href)
  }, [adminToken, slug])

  if (load.status === 'loading') return <main className="wall center">Loading…</main>
  if (load.status === 'missing') return <main className="wall center">Wall not found.</main>
  if (load.status === 'error' && !eventId) return <main className="wall center">Can't reach the wall. Retrying…</main>
  if (!event) return null
  const isAdmin = adminToken !== null

  const grid = layoutGrid(wall.stickies.length, board.width, board.height)
  const shown = wall.stickies.slice(grid.hiddenOldest)
  const url = phoneUrl(slug)

  return (
    <main className="wall">
      <header className="wall-header">
        <h1>{event.title}</h1>
        {isAdmin && (
          <div className="admin-bar">
            <span>Organizer · tap a sticky to hide it</span>
            <button onClick={() => void toggleOpen()}>{event.is_open ? 'Close wall' : 'Reopen wall'}</button>
            <button onClick={() => void exportCsv()}>Export CSV</button>
          </div>
        )}
        <div className="wall-meta">
          {!event.is_open && <span className="closed-tag">Closed</span>}
          <span>
            {wall.stickies.length} {wall.stickies.length === 1 ? 'sticky' : 'stickies'}
          </span>
          <span
            className={`dot ${live && pollOk ? 'live' : 'catching-up'}`}
            title={live && pollOk ? 'Live' : 'Reconnecting / catching up'}
          />
        </div>
      </header>

      <div className="board" ref={boardRef}>
        {fontsReady && board.width > 0 && (
          <>
            {wall.stickies.length === 0 ? (
              event.is_open ? (
                <QrCard url={url} size={0} big />
              ) : (
                <p className="closed-note">This wall is closed.</p>
              )
            ) : (
              <>
                <div
                  className="grid"
                  style={{ gridTemplateColumns: `repeat(${grid.columns}, ${grid.size}px)`, gap: grid.gap }}
                >
                  {grid.hiddenOldest > 0 && (
                    <div className="pile" style={{ width: grid.size, height: grid.size }}>
                      +{grid.hiddenOldest} more
                    </div>
                  )}
                  {shown.map((s) => (
                    <Sticky
                      key={s.id}
                      id={s.id}
                      text={s.text}
                      name={s.name}
                      color={s.color}
                      fontIdx={s.font_idx}
                      ink={s.ink}
                      size={grid.size}
                      landing={initialIds !== null && !initialIds.has(s.id)}
                      onClick={isAdmin ? () => void hide(s) : undefined}
                    />
                  ))}
                </div>
                {/* No "scan to add yours" once the wall is closed. */}
                {event.is_open && <QrCard url={url} size={grid.size} />}
              </>
            )}
          </>
        )}
      </div>
    </main>
  )
}
