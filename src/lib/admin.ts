// Organizer token handling (eng review R3 / D6).
// The admin link is /e/:slug/wall#admin=<token>. The fragment never reaches a server;
// on first load we move the token into sessionStorage and clear it from the address bar,
// so it never shows on the projector.

const cache = new Map<string, string | null>()

export function takeAdminToken(slug: string): string | null {
  if (cache.has(slug)) return cache.get(slug)! // StrictMode runs initializers twice
  const key = `wall-admin:${slug}`
  const match = window.location.hash.match(/(?:^#|&)admin=([^&]+)/)
  let token: string | null = null
  if (match) {
    token = decodeURIComponent(match[1])
    history.replaceState(null, '', window.location.pathname + window.location.search)
    try {
      sessionStorage.setItem(key, token)
    } catch {
      // storage blocked: token still works for this page view
    }
  } else {
    try {
      token = sessionStorage.getItem(key)
    } catch {
      token = null
    }
  }
  cache.set(slug, token)
  return token
}
