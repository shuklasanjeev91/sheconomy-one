import { sha256Bytes, toUint8Array } from '~/lib/crypto/sha256'

const DIGEST_FALLBACK_MS = 400
const BASE64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'

function latin1ToBase64(input: string): string {
  let out = ''
  for (let i = 0; i < input.length; i += 3) {
    const a = input.charCodeAt(i) & 255
    const b = i + 1 < input.length ? input.charCodeAt(i + 1) & 255 : undefined
    const c = i + 2 < input.length ? input.charCodeAt(i + 2) & 255 : undefined
    const triplet = (a << 16) | ((b ?? 0) << 8) | (c ?? 0)
    out += BASE64[(triplet >> 18) & 63]
    out += BASE64[(triplet >> 12) & 63]
    out += b == null ? '=' : BASE64[(triplet >> 6) & 63]
    out += c == null ? '=' : BASE64[triplet & 63]
  }
  return out
}

function digestName(algorithm: AlgorithmIdentifier): string {
  if (typeof algorithm === 'string') return algorithm.toUpperCase()
  return String((algorithm as Algorithm).name ?? '').toUpperCase()
}

function jsSha256Digest(data: BufferSource): ArrayBuffer {
  const hash = sha256Bytes(toUint8Array(data))
  return hash.buffer.slice(hash.byteOffset, hash.byteOffset + hash.byteLength)
}

/**
 * Ensure PKCE can finish on Hermes. Native `crypto.subtle.digest` is present on
 * some RN builds but never settles, so email OTP hangs on "Sending code…".
 */
export function installWebCryptoPolyfill(): void {
  const g = globalThis as typeof globalThis & {
    crypto?: Crypto
    btoa?: (data: string) => string
  }

  if (typeof g.btoa !== 'function') {
    g.btoa = latin1ToBase64
  }

  if (!g.crypto) {
    g.crypto = {} as Crypto
  }

  if (typeof g.crypto.getRandomValues !== 'function') {
    g.crypto.getRandomValues = <T extends ArrayBufferView>(array: T) => {
      const bytes = new Uint8Array(array.buffer, array.byteOffset, array.byteLength)
      for (let i = 0; i < bytes.length; i += 1) {
        bytes[i] = Math.floor(Math.random() * 256)
      }
      return array
    }
  }

  const subtle = (g.crypto.subtle ?? {}) as SubtleCrypto
  const original =
    typeof subtle.digest === 'function' ? subtle.digest.bind(subtle) : null

  const patched: SubtleCrypto['digest'] = async (algorithm, data) => {
    const name = digestName(algorithm)
    if (original) {
      try {
        return await Promise.race([
          original(algorithm, data),
          new Promise<never>((_, reject) => {
            setTimeout(() => reject(new Error('subtle-digest-timeout')), DIGEST_FALLBACK_MS)
          }),
        ])
      } catch {
        // Use the JS implementation when native digest hangs or rejects.
      }
    }
    if (name !== 'SHA-256' && name !== 'SHA256') {
      throw new Error(`Unsupported digest algorithm: ${name || 'unknown'}`)
    }
    return jsSha256Digest(data)
  }

  try {
    Object.defineProperty(subtle, 'digest', {
      configurable: true,
      enumerable: true,
      writable: true,
      value: patched,
    })
  } catch {
    try {
      ;(subtle as { digest: SubtleCrypto['digest'] }).digest = patched
    } catch {
      // Email OTP send bypasses PKCE if we cannot patch digest.
    }
  }

  if (!g.crypto.subtle) {
    try {
      Object.defineProperty(g.crypto, 'subtle', {
        configurable: true,
        enumerable: true,
        value: subtle,
      })
    } catch {
      try {
        ;(g.crypto as { subtle: SubtleCrypto }).subtle = subtle
      } catch {
        // ignore
      }
    }
  }
}
