// Fit-all grid for the projector (design doc "Capacity rule").
// Biggest square sticky that lets every sticky fit, between MIN and MAX px.
// When even MIN can't fit them all, show the newest and pile the oldest into "+N more".

export const MIN_STICKY = 120
export const MAX_STICKY = 240
export const GAP_RATIO = 0.12 // gap as a fraction of sticky size

export interface GridLayout {
  size: number // sticky edge in px
  gap: number
  columns: number
  capacity: number // how many stickies fit
  hiddenOldest: number // how many go into the "+N more" pile
}

/**
 * @param count   stickies to show
 * @param width   usable board width in px
 * @param height  usable board height in px
 * @param reserved cells kept free for the QR card (bottom-right)
 */
export function layoutGrid(count: number, width: number, height: number, reserved = 1): GridLayout {
  const need = count + reserved
  for (let size = MAX_STICKY; size >= MIN_STICKY; size -= 2) {
    const g = fit(size, width, height)
    if (g.columns * g.rows >= need) return result(size, g, count, reserved)
  }
  const g = fit(MIN_STICKY, width, height)
  return result(MIN_STICKY, g, count, reserved)
}

function fit(size: number, width: number, height: number) {
  const gap = Math.round(size * GAP_RATIO)
  const columns = Math.max(1, Math.floor((width + gap) / (size + gap)))
  const rows = Math.max(1, Math.floor((height + gap) / (size + gap)))
  return { gap, columns, rows }
}

function result(size: number, g: { gap: number; columns: number; rows: number }, count: number, reserved: number): GridLayout {
  // One cell also goes to the "+N more" pile when there is overflow.
  const cells = g.columns * g.rows - reserved
  const overflow = count > cells
  const capacity = overflow ? Math.max(cells - 1, 0) : count
  return { size, gap: g.gap, columns: g.columns, capacity, hiddenOldest: count - capacity }
}
