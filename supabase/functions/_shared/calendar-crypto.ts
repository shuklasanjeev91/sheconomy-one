export type CalendarCiphertext = { ciphertext: string; iv: string; tag: string }

function bytesToBase64(bytes: Uint8Array) {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}

function base64ToBytes(value: string) {
  return Uint8Array.from(atob(value), (character) => character.charCodeAt(0))
}

function keyBytes() {
  const encoded = Deno.env.get('CALENDAR_TOKEN_ENCRYPTION_KEY') ?? ''
  if (!encoded) throw new Error('CALENDAR_TOKEN_ENCRYPTION_KEY is not configured')
  const bytes = base64ToBytes(encoded)
  if (bytes.length !== 32) {
    throw new Error('CALENDAR_TOKEN_ENCRYPTION_KEY must be a base64-encoded 32-byte key')
  }
  return bytes
}

async function key(usages: KeyUsage[]) {
  return crypto.subtle.importKey('raw', keyBytes(), { name: 'AES-GCM' }, false, usages)
}

export async function encryptCalendarSecret(value: string): Promise<CalendarCiphertext> {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const encrypted = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      await key(['encrypt']),
      new TextEncoder().encode(value),
    ),
  )
  return {
    ciphertext: bytesToBase64(encrypted.slice(0, -16)),
    iv: bytesToBase64(iv),
    tag: bytesToBase64(encrypted.slice(-16)),
  }
}

export async function decryptCalendarSecret(secret: CalendarCiphertext): Promise<string> {
  const ciphertext = base64ToBytes(secret.ciphertext)
  const tag = base64ToBytes(secret.tag)
  const combined = new Uint8Array(ciphertext.length + tag.length)
  combined.set(ciphertext)
  combined.set(tag, ciphertext.length)
  const plain = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: base64ToBytes(secret.iv) },
    await key(['decrypt']),
    combined,
  )
  return new TextDecoder().decode(plain)
}

export async function sha256Base64Url(value: string) {
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)))
  return bytesToBase64(digest).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function randomBase64Url(bytes = 32) {
  return bytesToBase64(crypto.getRandomValues(new Uint8Array(bytes)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}
