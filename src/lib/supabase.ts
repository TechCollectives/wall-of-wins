import { createClient } from '@supabase/supabase-js'
import { resolveSupabaseUrl } from './urls'

const configuredUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

if (!configuredUrl || !anonKey) {
  throw new Error('Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY (copy .env.example to .env.local)')
}

export const supabase = createClient(resolveSupabaseUrl(configuredUrl, window.location.hostname), anonKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})

/** Public URL participants scan. VITE_PUBLIC_URL overrides for deployed walls. */
export function phoneUrl(slug: string): string {
  const base = (import.meta.env.VITE_PUBLIC_URL as string | undefined) ?? window.location.origin
  return `${base.replace(/\/$/, '')}/e/${slug}`
}
