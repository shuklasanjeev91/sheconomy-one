/**
 * SKU helpers for physical listings.
 *
 * Migrated from the legacy `lib/utils/sku-utils.js`. The only behavioural
 * change is the random source: Node's `crypto.randomBytes` is swapped for the
 * cross-platform Web Crypto API (`crypto.getRandomValues`) so it works in the
 * browser and on native, with a `Math.random` fallback.
 */

import { supabase } from '~/lib/supabase'

const ALPHANUMERIC = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'

type SkuLengthOptions = { minLength?: number; maxLength?: number }

/** Cross-platform random bytes (Web Crypto, with a Math.random fallback). */
function randomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length)
  const webCrypto = (globalThis as { crypto?: Crypto }).crypto
  if (webCrypto?.getRandomValues) {
    webCrypto.getRandomValues(bytes)
  } else {
    for (let i = 0; i < length; i += 1) bytes[i] = Math.floor(Math.random() * 256)
  }
  return bytes
}

/** Generate a random alphanumeric SKU of the given length (8–12 recommended). */
export function generateRandomSku(length = 10): string {
  const charsLength = ALPHANUMERIC.length
  const bytes = randomBytes(length)
  let sku = ''
  for (let i = 0; i < length; i += 1) {
    sku += ALPHANUMERIC[bytes[i] % charsLength]
  }
  return sku
}

/** Validate SKU format: uppercase alphanumeric within the length bounds. */
export function isSkuValid(
  value: string | null | undefined,
  { minLength = 8, maxLength = 12 }: SkuLengthOptions = {},
): boolean {
  if (!value) return false
  const trimmed = value.toString().trim()
  return /^[A-Z0-9]+$/.test(trimmed) && trimmed.length >= minLength && trimmed.length <= maxLength
}

/**
 * Normalise a SKU to uppercase alphanumeric and validate its length.
 * Returns `null` when the result is invalid.
 */
export function normalizeSku(
  value: string | null | undefined,
  { minLength = 8, maxLength = 12 }: SkuLengthOptions = {},
): string | null {
  if (!value) return null
  const cleaned = value.toString().toUpperCase().replace(/[^A-Z0-9]/g, '')
  return isSkuValid(cleaned, { minLength, maxLength }) ? cleaned : null
}

type GenerateUniqueSkuOptions = SkuLengthOptions & {
  table?: 'listings'
  column?: 'sku'
  maxAttempts?: number
}

/**
 * Generate a SKU that doesn't already exist in the target table/column.
 * Throws if a unique value can't be found within `maxAttempts` tries.
 */
export async function generateUniqueSku({
  table = 'listings',
  column = 'sku',
  minLength = 8,
  maxLength = 12,
  maxAttempts = 5,
}: GenerateUniqueSkuOptions = {}): Promise<string> {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const length = Math.floor(Math.random() * (maxLength - minLength + 1)) + minLength
    const candidate = generateRandomSku(length)

    const { data, error } = await supabase.from(table).select(column).eq(column, candidate).limit(1)

    if (error) {
      throw new Error(`Failed to verify SKU uniqueness: ${error.message}`)
    }

    if (!data || data.length === 0) {
      return candidate
    }
  }

  throw new Error('Unable to generate a unique SKU after multiple attempts')
}
