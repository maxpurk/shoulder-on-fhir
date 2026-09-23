// A UUID source that does not assume a particular host.
//
// The engine is written for a browser, where `crypto.randomUUID` is always
// there, and that assumption is what stopped it ever being exercised outside
// one: a module scope in Node 18 has no crypto global at all, so any test
// harness died on the first allocated identifier.

function bytes(): Uint8Array {
  const b = new Uint8Array(16)
  const c = (globalThis as { crypto?: Crypto }).crypto
  if (c?.getRandomValues) return c.getRandomValues(b)
  for (let i = 0; i < 16; i++) b[i] = Math.floor(Math.random() * 256)
  return b
}

/** RFC 4122 version 4, urn-prefixed as Bundle.entry.fullUrl wants it. */
export function urnUuid(): string {
  const c = (globalThis as { crypto?: Crypto }).crypto
  if (c?.randomUUID) return 'urn:uuid:' + c.randomUUID()
  const b = bytes()
  b[6] = (b[6] & 0x0f) | 0x40
  b[8] = (b[8] & 0x3f) | 0x80
  const hex = [...b].map((n) => n.toString(16).padStart(2, '0')).join('')
  return `urn:uuid:${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}
