// Creates a new wall and prints its phone, projector and organizer links.
//   npm run new-event -- "Summer 2026 Intern Wall" summer-26
// Replaces the /new page for v1 (eng review D2): the service key stays on this laptop.
import { adminClient, eventLinks, newAdminToken, parseArgs, printLinks } from './lib/event.ts'

const args = parseArgs(process.argv.slice(2))
if ('error' in args) {
  console.error(args.error)
  process.exit(1)
}

const supabase = adminClient()
const { token, hash } = newAdminToken()
const { error } = await supabase.from('events').insert({ slug: args.slug, title: args.title, admin_token_hash: hash })

if (error) {
  console.error(error.code === '23505' ? `A wall with slug "${args.slug}" already exists.` : `Failed: ${error.message}`)
  process.exit(1)
}

printLinks(args.title, eventLinks(process.env.APP_URL ?? 'http://localhost:5173', args.slug, token))
