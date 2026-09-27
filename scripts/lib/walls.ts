// Formatting for scripts/list-walls.ts. Pure, so it can be unit tested.

export interface WallSummary {
  slug: string
  title: string
  is_open: boolean
  created_at: string
  visible: number // stickies shown on the wall
  hidden: number // stickies hidden by an organizer
}

export function formatWalls(walls: WallSummary[], appUrl: string, timeZone = 'America/New_York'): string {
  if (walls.length === 0) return 'No walls yet. Create one with: npm run new-event:cloud -- "Title" slug\n'
  const base = appUrl.replace(/\/$/, '')
  const date = new Intl.DateTimeFormat('en-US', { timeZone, year: 'numeric', month: 'short', day: 'numeric' })
  const open = walls.filter((w) => w.is_open).length
  const lines = [`${walls.length} ${walls.length === 1 ? 'wall' : 'walls'} (${open} open)`, '']
  for (const w of walls) {
    const status = w.is_open ? '🟢 OPEN  ' : '⚪ CLOSED'
    const hidden = w.hidden ? `, ${w.hidden} hidden` : ''
    lines.push(`${status}  ${w.title}`)
    lines.push(`          slug: ${w.slug} · created ${date.format(new Date(w.created_at))} · ${w.visible} ${w.visible === 1 ? 'sticky' : 'stickies'}${hidden}`)
    lines.push(`          projector: ${base}/e/${w.slug}/wall`)
    lines.push(`          phones:    ${base}/e/${w.slug}`)
    lines.push('')
  }
  lines.push('Organizer links are not listed: only a hash of each token is stored. Use the link saved when the wall was created.')
  return lines.join('\n') + '\n'
}
