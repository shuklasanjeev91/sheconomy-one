import { SUPPORTED_CURRENCIES } from '~/lib/shop/shop.type'

/** BCP-47-ish language options shown in the region selector. */
export const REGION_LANGUAGES = [
  { code: 'en', label: 'English', locale: 'en-US' },
  { code: 'hi', label: 'Hindi', locale: 'hi-IN' },
  { code: 'es', label: 'Spanish', locale: 'es-ES' },
  { code: 'fr', label: 'French', locale: 'fr-FR' },
  { code: 'de', label: 'German', locale: 'de-DE' },
  { code: 'pt', label: 'Portuguese', locale: 'pt-BR' },
  { code: 'ar', label: 'Arabic', locale: 'ar-AE' },
  { code: 'zh', label: 'Chinese', locale: 'zh-CN' },
  { code: 'ja', label: 'Japanese', locale: 'ja-JP' },
  { code: 'ko', label: 'Korean', locale: 'ko-KR' },
  { code: 'it', label: 'Italian', locale: 'it-IT' },
  { code: 'nl', label: 'Dutch', locale: 'nl-NL' },
] as const

export type RegionLanguageCode = (typeof REGION_LANGUAGES)[number]['code']

/** ISO country → default ISO currency (ISO 4217). */
export const COUNTRY_DEFAULT_CURRENCY: Record<string, string> = {
  IN: 'INR',
  US: 'USD',
  GB: 'GBP',
  AU: 'AUD',
  CA: 'CAD',
  SG: 'SGD',
  AE: 'AED',
  DE: 'EUR',
  FR: 'EUR',
  ES: 'EUR',
  IT: 'EUR',
  NL: 'EUR',
  IE: 'EUR',
  PT: 'EUR',
  BE: 'EUR',
  AT: 'EUR',
  FI: 'EUR',
  NZ: 'NZD',
  JP: 'JPY',
  KR: 'KRW',
  CN: 'CNY',
  HK: 'HKD',
  TW: 'TWD',
  TH: 'THB',
  MY: 'MYR',
  ID: 'IDR',
  PH: 'PHP',
  VN: 'VND',
  SA: 'SAR',
  QA: 'QAR',
  KW: 'KWD',
  BH: 'BHD',
  OM: 'OMR',
  ZA: 'ZAR',
  BR: 'BRL',
  MX: 'MXN',
  AR: 'ARS',
  CL: 'CLP',
  CO: 'COP',
  NG: 'NGN',
  KE: 'KES',
  GH: 'GHS',
  PK: 'PKR',
  BD: 'BDT',
  LK: 'LKR',
  NP: 'NPR',
  CH: 'CHF',
  SE: 'SEK',
  NO: 'NOK',
  DK: 'DKK',
  PL: 'PLN',
  TR: 'TRY',
  IL: 'ILS',
  RU: 'RUB',
}

/** Popular ship-to countries (ISO2). Rest of world still selectable via full list. */
export const PRIORITY_COUNTRY_CODES = [
  'IN',
  'US',
  'GB',
  'AE',
  'SG',
  'AU',
  'CA',
  'DE',
  'FR',
  'SA',
  'JP',
  'KR',
  'MY',
  'ID',
  'PH',
  'TH',
  'NZ',
  'NL',
  'IT',
  'ES',
  'BR',
  'MX',
  'ZA',
  'NG',
] as const

export const REGION_CURRENCIES = SUPPORTED_CURRENCIES.map((c) => ({
  code: c.code,
  symbol: c.symbol,
  name: c.name,
}))

/** Extra buyer currencies not in shop create list. */
export const EXTRA_REGION_CURRENCIES = [
  { code: 'JPY', symbol: '¥', name: 'Japanese Yen' },
  { code: 'KRW', symbol: '₩', name: 'South Korean Won' },
  { code: 'CNY', symbol: '¥', name: 'Chinese Yuan' },
  { code: 'HKD', symbol: 'HK$', name: 'Hong Kong Dollar' },
  { code: 'NZD', symbol: 'NZ$', name: 'New Zealand Dollar' },
  { code: 'SAR', symbol: '﷼', name: 'Saudi Riyal' },
  { code: 'BRL', symbol: 'R$', name: 'Brazilian Real' },
  { code: 'MXN', symbol: 'MX$', name: 'Mexican Peso' },
  { code: 'ZAR', symbol: 'R', name: 'South African Rand' },
  { code: 'CHF', symbol: 'CHF', name: 'Swiss Franc' },
] as const

export function allRegionCurrencies() {
  const seen = new Set<string>()
  const list: Array<{ code: string; symbol: string; name: string }> = []
  for (const row of [...REGION_CURRENCIES, ...EXTRA_REGION_CURRENCIES]) {
    if (seen.has(row.code)) continue
    seen.add(row.code)
    list.push(row)
  }
  return list.sort((a, b) => a.code.localeCompare(b.code))
}

export function defaultCurrencyForCountry(countryCode: string): string {
  const code = countryCode.trim().toUpperCase()
  return COUNTRY_DEFAULT_CURRENCY[code] ?? 'USD'
}

export function languageLocale(code: string): string {
  const match = REGION_LANGUAGES.find((l) => l.code === code.toLowerCase())
  return match?.locale ?? 'en-US'
}

export function languageLabel(code: string): string {
  const match = REGION_LANGUAGES.find((l) => l.code === code.toLowerCase())
  return match?.label ?? code.toUpperCase()
}
