import { useEffect, useState } from 'react'
import { supabase } from './supabase'

export interface WallEvent {
  id: string
  title: string
  is_open: boolean
}

export type EventLoad =
  | { status: 'loading' }
  | { status: 'missing' }
  | { status: 'error' }
  | { status: 'ready'; event: WallEvent }

/** Loads a wall by slug; retries every 5s while the network is down. */
export function useWallEvent(slug: string | undefined): [EventLoad, (e: WallEvent) => void] {
  const [load, setLoad] = useState<EventLoad>({ status: 'loading' })

  useEffect(() => {
    if (!slug) return
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | undefined
    const fetchEvent = async () => {
      const { data, error } = await supabase
        .from('events')
        .select('id, title, is_open')
        .eq('slug', slug)
        .abortSignal(AbortSignal.timeout(10_000))
        .maybeSingle()
      if (cancelled) return
      if (error) {
        setLoad((prev) => (prev.status === 'ready' ? prev : { status: 'error' }))
        timer = setTimeout(fetchEvent, 5_000)
      } else {
        setLoad(data ? { status: 'ready', event: data } : { status: 'missing' })
      }
    }
    void fetchEvent()
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [slug])

  return [slug ? load : { status: 'missing' }, (event) => setLoad({ status: 'ready', event })]
}
