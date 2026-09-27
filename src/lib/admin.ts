// Organizer token handling (eng review R3 / D6).
// The admin link is /e/:slug/wall#admin=<token>. The fragment never reaches a server;
// we move the token into sessionStorage and clear it from the address bar, so it never
// shows on the projector.

import { useEffect, useState } from 'react'

const cache = new Map<string, string | null>()

const storageKey = (slug: string) => `wall-admin:${slug}`

export function takeAdminToken(slug: string): string | null {
  // A token in the address bar always wins, even if this wall was already open.
  const match = window.location.hash.match(/(?:^#|&)admin=([^&]+)/)
  if (match) {
    const token = decodeURIComponent(match[1])
    history.replaceState(null, '', window.location.pathname + window.location.search)
    try {
      sessionStorage.setItem(storageKey(slug), token)
    } catch {
      // storage blocked: token still works for this page view
    }
    cache.set(slug, token)
    return token
  }
  if (cache.has(slug)) return cache.get(slug)! // StrictMode runs initializers twice
  let token: string | null
  try {
    token = sessionStorage.getItem(storageKey(slug))
  } catch {
    token = null
  }
  cache.set(slug, token)
  return token
}

/**
 * The organizer token for this wall. Also picks up an admin link pasted into a tab that
 * already shows the wall: changing only the #fragment doesn't reload the page.
 */
export function useAdminToken(slug: string): string | null {
  const [token, setToken] = useState(() => takeAdminToken(slug))
  useEffect(() => {
    const onHashChange = () => {
      if (/(?:^#|&)admin=/.test(window.location.hash)) setToken(takeAdminToken(slug))
    }
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [slug])
  return token
}
