// Shared by scripts/new-event.ts and scripts/seed-demo.ts. Runs in Node (type stripping).
import { createHash, randomBytes } from 'node:crypto'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

// Same rule as the events.slug check constraint.
export const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{1,40}$/

export function newAdminToken(): { token: string; hash: string } {
  const token = randomBytes(24).toString('base64url')
  return { token, hash: sha256Hex(token) }
}

export function sha256Hex(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex')
}

export function eventLinks(appUrl: string, slug: string, token: string) {
  const base = appUrl.replace(/\/$/, '')
  return {
    phone: `${base}/e/${slug}`,
    wall: `${base}/e/${slug}/wall`,
    admin: `${base}/e/${slug}/wall#admin=${encodeURIComponent(token)}`,
  }
}

export function parseArgs(argv: string[]): { title: string; slug: string } | { error: string } {
  const [title, slug] = argv
  // Notes/chat apps turn " into “ ” and - into — ; the terminal doesn't treat those as quotes or hyphens.
  if (argv.some((a) => /[“”‘’—–]/.test(a)))
    return {
      error:
        'Found curly quotes (“ ”) or a long dash (—) — usually from copying out of Notes or a chat app.\n' +
        'Retype them in Terminal as straight quotes (") and a plain hyphen (-).',
    }
  if (!title || !slug) return { error: 'Usage: npm run new-event -- "Summer 2026 Intern Wall" summer-26' }
  if (!SLUG_PATTERN.test(slug)) return { error: `Slug "${slug}" must be 2–41 chars: lowercase letters, digits, dashes.` }
  if (title.length > 120) return { error: 'Title must be 120 characters or fewer.' }
  return { title, slug }
}

/** Service-role client for local scripts. Never ship this key to a browser. */
export function adminClient(): SupabaseClient {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    console.error('Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY. Run with --env-file=.env.local (see .env.example).')
    process.exit(1)
  }
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}

export function printLinks(title: string, links: ReturnType<typeof eventLinks>) {
  console.log(`\n✅ Created "${title}"\n`)
  console.log(`  Phones (QR):  ${links.phone}`)
  console.log(`  Projector:    ${links.wall}`)
  console.log(`  Organizer:    ${links.admin}`)
  console.log('\n  ⚠️  The organizer link is shown only once. Save it somewhere private.\n')
}
