/**
 * Random v4 UUID for a new sticky draft.
 * crypto.randomUUID only exists in secure contexts (HTTPS or localhost); a phone opening the
 * wall over plain http://<LAN-IP> during local testing doesn't have it. getRandomValues works
 * in every context, so fall back to building the UUID from it.
 */
interface CryptoLike {
  getRandomValues(array: Uint8Array<ArrayBuffer>): Uint8Array<ArrayBuffer>
  randomUUID?: () => string
}

export function newId(c: CryptoLike = crypto): string {
  if (typeof c.randomUUID === 'function') return c.randomUUID()
  const b = c.getRandomValues(new Uint8Array(16))
  b[6] = (b[6] & 0x0f) | 0x40 // version 4
  b[8] = (b[8] & 0x3f) | 0x80 // RFC 4122 variant
  const hex = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}
