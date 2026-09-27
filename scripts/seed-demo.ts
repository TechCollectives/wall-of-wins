// Recreates the "tiqc-demo" wall with stickies adapted from the physical TIQC intern wall photo.
// Names are invented stand-ins; the real interns' names are not stored in this repo.
//   npm run seed:demo
// Doubles as a realistic fixture for layout, fonts and CSV export.
import { adminClient, eventLinks, newAdminToken, printLinks } from './lib/event.ts'

type Seed = [text: string, name: string | null, color: string, type: 'wish' | 'win' | null]

const STICKIES: Seed[] = [
  ['Fixed TIQC TV with Rosa and Leila', 'Omar', 'lime', 'win'],
  ['I want to move to Colorado and visit all 50 states', 'Omar', 'peri', 'wish'],
  ['Automated an AI chat bot for TIQC', 'Theo', 'lime', 'win'],
  ['Started my own startup', 'Theo', 'peri', 'win'],
  ['To be happy', 'Sam', 'orange', 'wish'],
  ['Created new flyers for TIQC', 'Jordan', 'pink', 'win'],
  ['We hit 5.5K views in the last 30 days on Instagram', 'Rosa', 'lime', 'win'],
  ['To start sewing / making clothing', 'Mina', 'blue', 'wish'],
  ['To be rich', 'Andre', 'lime', 'wish'],
  ['I am learning to make a website', 'Bella', 'lime', null],
  ['Rescued an injured seagull in front of TIQC', 'Theo', 'peri', 'win'],
  ['Got a good GPA and hope to keep it through senior year', 'Ravi', 'orange', null],
  ['To gain tech experience', 'Bella', 'pink', 'wish'],
  ['Hopefully starting a small business, and China vacation', null, 'orange', 'wish'],
  ['Make my parents happy with my work', 'Nico', 'lime', 'wish'],
  ['I wish to live a calm/chill and successful life', 'Lin', 'orange', 'wish'],
  ['I wanna do what I love, be good at it & become successful, get rich & famous hehe :)', 'Asha', 'lime', 'wish'],
  ['In life: Got 1st place in a hackathon on my first attempt · Helped build a small robot · Living ✌️', 'Kofi', 'lime', 'win'],
  ['I want to have my own company one day', 'Jae', 'blue', 'wish'],
  ['Run my sub-2 half marathon in NY · Build stuff that matters', 'Riley', 'blue', 'wish'],
  ['To travel more and be successful', 'Maya', 'orange', 'wish'],
  ["Move out of my parents' place and live life freely without restrictions", 'Tara K.', 'orange', 'wish'],
  ['To experience what life in NYC is like! Perhaps now???', null, 'blue', 'wish'],
  ['Built a fully automated dashboard for the network operations team', 'Noor', 'orange', 'win'],
  ['Not die before finishing college', 'Idris', 'orange', 'wish'],
]

const INKS = ['green', 'black', 'blue'] as const
const SLUG = 'tiqc-demo'
const TITLE = 'TIQC Intern Wall · Demo'

const supabase = adminClient()

// Start clean: deleting the event cascades to its stickies.
const del = await supabase.from('events').delete().eq('slug', SLUG)
if (del.error) throw new Error(del.error.message)

const { token, hash } = newAdminToken()
const created = await supabase
  .from('events')
  .insert({ slug: SLUG, title: TITLE, admin_token_hash: hash })
  .select('id')
  .single()
if (created.error) throw new Error(created.error.message)

const start = Date.now() - STICKIES.length * 20_000
const rows = STICKIES.map(([text, name, color, type], i) => ({
  id: crypto.randomUUID(),
  event_id: created.data.id,
  text,
  name,
  color,
  type,
  font_idx: i % 4,
  ink: INKS[(i * 7) % 3],
  created_at: new Date(start + i * 20_000).toISOString(),
}))
const inserted = await supabase.from('stickies').insert(rows)
if (inserted.error) throw new Error(inserted.error.message)

printLinks(`${TITLE} (${rows.length} stickies)`, eventLinks(process.env.APP_URL ?? 'http://localhost:5173', SLUG, token))
