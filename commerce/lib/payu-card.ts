/**
 * Merchant-hosted card helpers (Luhn + 3DS2 browserInfo).
 * Card PAN/CVV must only travel to shepay-payu-create → PayU; never store.
 * @see https://docs.payu.in/docs/collect-payments-with-cards-seamless
 */

export type PayuCardInput = {
  number: string
  name: string
  expMon: string
  expYr: string
  cvv: string
}

export function digitsOnly(value: string): string {
  return String(value ?? '').replace(/\D/g, '')
}

/** Luhn check for card numbers (13–19 digits). */
export function luhnValid(cardNumber: string): boolean {
  const digits = digitsOnly(cardNumber)
  if (digits.length < 13 || digits.length > 19) return false
  let sum = 0
  let alt = false
  for (let i = digits.length - 1; i >= 0; i -= 1) {
    let n = Number(digits[i])
    if (alt) {
      n *= 2
      if (n > 9) n -= 9
    }
    sum += n
    alt = !alt
  }
  return sum % 10 === 0
}

export function formatCardNumberDisplay(value: string): string {
  const d = digitsOnly(value).slice(0, 19)
  return d.replace(/(.{4})/g, '$1 ').trim()
}

export function normalizeExpiryMonth(value: string): string {
  return digitsOnly(value).slice(0, 2)
}

export function normalizeExpiryYear(value: string): string {
  const d = digitsOnly(value).slice(0, 4)
  if (d.length === 2) return `20${d}`
  return d
}

export function validatePayuCardInput(card: PayuCardInput): string | null {
  if (!luhnValid(card.number)) return 'Enter a valid card number'
  if (!card.name.trim()) return 'Enter the name on the card'
  const mon = Number(normalizeExpiryMonth(card.expMon))
  if (!mon || mon < 1 || mon > 12) return 'Enter a valid expiry month (MM)'
  const yr = normalizeExpiryYear(card.expYr)
  if (yr.length !== 4) return 'Enter a valid expiry year (YYYY)'
  const cvv = digitsOnly(card.cvv)
  if (cvv.length < 3 || cvv.length > 4) return 'Enter a valid CVV'
  return null
}

/** Build threeDS2RequestData.browserInfo for PayU S2S cards. */
export function buildPayuThreeDS2RequestData(clientIp?: string | null): {
  browserInfo: Record<string, string | boolean>
} {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return {
      browserInfo: {
        userAgent: 'Mozilla/5.0',
        acceptHeader: 'application/json',
        language: 'en-US',
        colorDepth: '24',
        screenHeight: '800',
        screenWidth: '1200',
        timeZone: '0',
        javaEnabled: true,
        ip: clientIp || '127.0.0.1',
      },
    }
  }

  const tz = String(new Date().getTimezoneOffset())
  return {
    browserInfo: {
      userAgent: navigator.userAgent || 'Mozilla/5.0',
      acceptHeader: 'application/json',
      language: navigator.language || 'en-US',
      colorDepth: String(window.screen?.colorDepth ?? 24),
      screenHeight: String(window.screen?.height ?? 800),
      screenWidth: String(window.screen?.width ?? 1200),
      timeZone: tz,
      javaEnabled: true,
      ip: clientIp || '127.0.0.1',
    },
  }
}

/** Map BIN category / network to PayU pg + bankcode for merchant-hosted cards. */
export function resolvePayuCardPgBankcode(input: {
  bankcode?: string | null
  category?: string | null
}): { pg: 'CC' | 'DC'; bankcode: string } {
  const category = String(input.category ?? '').toLowerCase()
  const pg: 'CC' | 'DC' = category.includes('debit') ? 'DC' : 'CC'
  // PayU S2S reference curl uses bankcode=CC. Network codes (VISA/MAST) can trigger
  // merchant integration exceptions (EX*) on some MIDs when mismatched with pg.
  return { pg, bankcode: 'CC' }
}
