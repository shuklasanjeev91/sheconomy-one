/**
 * Postal / ZIP helpers for Ships-to-you and delivery estimate UIs.
 */

const ZIP_RE = /^[A-Za-z0-9][A-Za-z0-9\s-]{2,11}$/

export function normalizeZip(raw: string): string {
  return String(raw ?? '')
    .trim()
    .replace(/\s+/g, '')
    .toUpperCase()
}

export function isValidZip(raw: string): boolean {
  const zip = normalizeZip(raw)
  if (zip.length < 4 || zip.length > 10) return false
  return ZIP_RE.test(zip)
}
