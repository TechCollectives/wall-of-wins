// CSV for the organizer's "Export CSV" button (paste into Claude for themes).

export interface ExportRow {
  id: string
  created_at: string
  color: string
  type: string | null
  name: string | null
  text: string
}

const COLUMNS: (keyof ExportRow)[] = ['created_at', 'type', 'name', 'text', 'color', 'id']

export function toCsv(rows: ExportRow[]): string {
  const lines = [COLUMNS.join(',')]
  for (const row of rows) lines.push(COLUMNS.map((c) => cell(row[c])).join(','))
  return lines.join('\r\n') + '\r\n'
}

function cell(value: string | null): string {
  if (value === null) return ''
  // Neutralize spreadsheet formulas (=, +, -, @) so a sticky can't run code when opened in Excel.
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe
}
