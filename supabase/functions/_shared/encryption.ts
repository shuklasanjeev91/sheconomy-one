/**
 * AES-256-GCM encryption helpers for sensitive payment credentials.
 *
 * Key is read from PAYMENT_ENCRYPTION_KEY env var (64 hex chars = 32 bytes).
 * Call assertEncryptionKeyPresent() at function startup to fail fast.
 *
 * Usage:
 *   const { encrypted, iv, authTag } = await encryptSecret('my-secret')
 *   const plain = await decryptSecret(encrypted, iv, authTag)
 */

const ALG = { name: 'AES-GCM', length: 256 } as const

function hex(buf: ArrayBuffer): string {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

function unhex(str: string): Uint8Array {
  if (str.length % 2 !== 0) throw new Error('Invalid hex string')
  const out = new Uint8Array(str.length / 2)
  for (let i = 0; i < str.length; i += 2) {
    out[i / 2] = parseInt(str.slice(i, i + 2), 16)
  }
  return out
}

function getRawKey(): Uint8Array {
  const raw = Deno.env.get('PAYMENT_ENCRYPTION_KEY') ?? ''
  if (!raw) throw new Error('PAYMENT_ENCRYPTION_KEY is not set')
  if (raw.length !== 64) {
    throw new Error('PAYMENT_ENCRYPTION_KEY must be 64 hex characters (32 bytes)')
  }
  return unhex(raw)
}

async function importKey(raw: Uint8Array): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', raw, ALG, false, ['encrypt', 'decrypt'])
}

export type EncryptedSecret = {
  encrypted: string
  iv: string
  authTag: string
}

/**
 * Encrypt a plaintext string. Returns hex-encoded encrypted, iv, and authTag.
 * The authTag is the last 16 bytes of the GCM output (Web Crypto appends it automatically).
 */
export async function encryptSecret(plaintext: string): Promise<EncryptedSecret> {
  const raw = getRawKey()
  const key = await importKey(raw)
  const iv = crypto.getRandomValues(new Uint8Array(16))
  const encoded = new TextEncoder().encode(plaintext)
  const cipherBuffer = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded)
  // Web Crypto appends the 16-byte auth tag to the ciphertext.
  const cipher = new Uint8Array(cipherBuffer)
  const encryptedBytes = cipher.slice(0, -16)
  const authTagBytes = cipher.slice(-16)
  return {
    encrypted: hex(encryptedBytes.buffer),
    iv: hex(iv.buffer),
    authTag: hex(authTagBytes.buffer),
  }
}

/** Decrypt a value produced by encryptSecret. */
export async function decryptSecret(
  encrypted: string,
  iv: string,
  authTag: string,
): Promise<string> {
  const raw = getRawKey()
  const key = await importKey(raw)
  const encryptedBytes = unhex(encrypted)
  const ivBytes = unhex(iv)
  const authTagBytes = unhex(authTag)
  // Re-assemble: Web Crypto expects ciphertext + authTag concatenated.
  const combined = new Uint8Array(encryptedBytes.length + authTagBytes.length)
  combined.set(encryptedBytes)
  combined.set(authTagBytes, encryptedBytes.length)
  const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: ivBytes }, key, combined)
  return new TextDecoder().decode(decrypted)
}

/** Throw at startup if the encryption key is absent — never let a request reveal this. */
export function assertEncryptionKeyPresent(): void {
  const raw = Deno.env.get('PAYMENT_ENCRYPTION_KEY') ?? ''
  if (!raw || raw.length !== 64) {
    throw new Error(
      'PAYMENT_ENCRYPTION_KEY env var is missing or wrong length. ' +
        'Generate with: openssl rand -hex 32',
    )
  }
}
