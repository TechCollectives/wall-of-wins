/**
 * Local dev convenience: a phone on the same Wi-Fi can't reach 127.0.0.1, so when the
 * configured URL is loopback and the page was opened via a LAN address, talk to Supabase
 * on that same host. Deployed builds use a real URL and are unaffected.
 */
export function resolveSupabaseUrl(url: string, pageHost: string): string {
  const u = new URL(url)
  const loopback = u.hostname === '127.0.0.1' || u.hostname === 'localhost'
  const pageIsLoopback = pageHost === '127.0.0.1' || pageHost === 'localhost'
  if (loopback && !pageIsLoopback && pageHost) u.hostname = pageHost
  return u.toString().replace(/\/$/, '')
}
