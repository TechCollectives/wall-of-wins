import { memo } from 'react'
import { COLORS, FONTS, INKS, displayInk, fitFontSize, tiltFor, type ColorKey, type InkKey } from '../lib/stickyStyle'

interface Props {
  id: string
  text: string
  name: string | null
  color: string
  fontIdx: number
  ink: string
  size: number
  landing?: boolean // play the "stick" animation when this element mounts
  onClick?: () => void
}

// Memoized: the wall re-renders every poll, but unchanged stickies keep the same props.
export const Sticky = memo(function Sticky({ id, text, name, color, fontIdx, ink, size, landing, onClick }: Props) {
  const signature = name ? `— ${name}` : ''
  const fontSize = fitFontSize(text.length + signature.length, size)
  return (
    <div
      className={`sticky${landing ? ' landing' : ''}${onClick ? ' clickable' : ''}`}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      style={
        {
          width: size,
          height: size,
          background: COLORS[color as ColorKey] ?? COLORS.lime,
          color: ink in INKS && color in COLORS ? displayInk(color as ColorKey, ink as InkKey) : INKS.black,
          fontFamily: `"${FONTS[fontIdx] ?? FONTS[0]}", cursive`,
          fontSize,
          '--tilt': `${tiltFor(id)}deg`,
        } as React.CSSProperties
      }
    >
      <p className="sticky-text">{text}</p>
      {signature && <p className="sticky-name">{signature}</p>}
    </div>
  )
})
