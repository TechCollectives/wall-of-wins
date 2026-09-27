// Lists every wall with its status, sticky counts and links.
//   npm run walls:cloud   (hosted project)
//   npm run walls         (local Supabase)
import { adminClient } from './lib/event.ts'
import { formatWalls, type WallSummary } from './lib/walls.ts'

const supabase = adminClient()

const events = await supabase.from('events').select('id, slug, title, is_open, created_at').order('created_at')
if (events.error) {
  console.error(`Failed to list walls: ${events.error.message}`)
  process.exit(1)
}

// Count per wall with head-only queries, so this stays fast however many stickies exist.
const count = async (eventId: string, hidden: boolean) => {
  const { count, error } = await supabase
    .from('stickies')
    .select('id', { count: 'exact', head: true })
    .eq('event_id', eventId)
    .eq('hidden', hidden)
  if (error) throw new Error(error.message)
  return count ?? 0
}

const walls: WallSummary[] = await Promise.all(
  events.data.map(async (e) => ({ ...e, visible: await count(e.id, false), hidden: await count(e.id, true) })),
)

process.stdout.write(formatWalls(walls, process.env.APP_URL ?? 'http://localhost:5173'))
