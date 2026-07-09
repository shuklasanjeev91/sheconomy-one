export type Country = {
  iso2: string
  name: string
  dialCode: string
  minLength: number
  maxLength: number
  pattern: RegExp
  placeholder: string
}

export function countryFlag(iso2: string) {
  const code = iso2.toUpperCase()
  if (code.length !== 2) return '🏳️'
  return String.fromCodePoint(...[...code].map((char) => 0x1f1e6 - 65 + char.charCodeAt(0)))
}

export const PHONE_COUNTRIES: Country[] = [
  { iso2: 'IN', name: 'India', dialCode: '+91', minLength: 10, maxLength: 10, pattern: /^[6-9]\d{9}$/, placeholder: '98765 43210' },
  { iso2: 'US', name: 'United States', dialCode: '+1', minLength: 10, maxLength: 10, pattern: /^\d{10}$/, placeholder: '202 555 0100' },
  { iso2: 'GB', name: 'United Kingdom', dialCode: '+44', minLength: 10, maxLength: 10, pattern: /^7\d{9}$/, placeholder: '7911 123456' },
  { iso2: 'AE', name: 'United Arab Emirates', dialCode: '+971', minLength: 9, maxLength: 9, pattern: /^5\d{8}$/, placeholder: '501234567' },
  { iso2: 'AU', name: 'Australia', dialCode: '+61', minLength: 9, maxLength: 9, pattern: /^4\d{8}$/, placeholder: '412345678' },
  { iso2: 'CA', name: 'Canada', dialCode: '+1', minLength: 10, maxLength: 10, pattern: /^\d{10}$/, placeholder: '416 555 0100' },
  { iso2: 'SG', name: 'Singapore', dialCode: '+65', minLength: 8, maxLength: 8, pattern: /^[89]\d{7}$/, placeholder: '81234567' },
  { iso2: 'DE', name: 'Germany', dialCode: '+49', minLength: 10, maxLength: 11, pattern: /^1\d{9,10}$/, placeholder: '15123456789' },
  { iso2: 'FR', name: 'France', dialCode: '+33', minLength: 9, maxLength: 9, pattern: /^[67]\d{8}$/, placeholder: '612345678' },
  { iso2: 'IT', name: 'Italy', dialCode: '+39', minLength: 9, maxLength: 10, pattern: /^3\d{8,9}$/, placeholder: '3123456789' },
  { iso2: 'ES', name: 'Spain', dialCode: '+34', minLength: 9, maxLength: 9, pattern: /^[67]\d{8}$/, placeholder: '612345678' },
  { iso2: 'NL', name: 'Netherlands', dialCode: '+31', minLength: 9, maxLength: 9, pattern: /^6\d{8}$/, placeholder: '612345678' },
  { iso2: 'CH', name: 'Switzerland', dialCode: '+41', minLength: 9, maxLength: 9, pattern: /^7[5-9]\d{7}$/, placeholder: '791234567' },
  { iso2: 'SE', name: 'Sweden', dialCode: '+46', minLength: 9, maxLength: 10, pattern: /^7\d{8,9}$/, placeholder: '701234567' },
  { iso2: 'NO', name: 'Norway', dialCode: '+47', minLength: 8, maxLength: 8, pattern: /^[49]\d{7}$/, placeholder: '41234567' },
  { iso2: 'DK', name: 'Denmark', dialCode: '+45', minLength: 8, maxLength: 8, pattern: /^\d{8}$/, placeholder: '20123456' },
  { iso2: 'FI', name: 'Finland', dialCode: '+358', minLength: 9, maxLength: 10, pattern: /^4\d{8,9}$/, placeholder: '412345678' },
  { iso2: 'IE', name: 'Ireland', dialCode: '+353', minLength: 9, maxLength: 9, pattern: /^8[3-9]\d{7}$/, placeholder: '851234567' },
  { iso2: 'PT', name: 'Portugal', dialCode: '+351', minLength: 9, maxLength: 9, pattern: /^9\d{8}$/, placeholder: '912345678' },
  { iso2: 'PL', name: 'Poland', dialCode: '+48', minLength: 9, maxLength: 9, pattern: /^\d{9}$/, placeholder: '512345678' },
  { iso2: 'RU', name: 'Russia', dialCode: '+7', minLength: 10, maxLength: 10, pattern: /^9\d{9}$/, placeholder: '9123456789' },
  { iso2: 'TR', name: 'Turkey', dialCode: '+90', minLength: 10, maxLength: 10, pattern: /^5\d{9}$/, placeholder: '5321234567' },
  { iso2: 'SA', name: 'Saudi Arabia', dialCode: '+966', minLength: 9, maxLength: 9, pattern: /^5\d{8}$/, placeholder: '501234567' },
  { iso2: 'QA', name: 'Qatar', dialCode: '+974', minLength: 8, maxLength: 8, pattern: /^[3567]\d{7}$/, placeholder: '33123456' },
  { iso2: 'KW', name: 'Kuwait', dialCode: '+965', minLength: 8, maxLength: 8, pattern: /^[569]\d{7}$/, placeholder: '50123456' },
  { iso2: 'BH', name: 'Bahrain', dialCode: '+973', minLength: 8, maxLength: 8, pattern: /^3\d{7}$/, placeholder: '36123456' },
  { iso2: 'OM', name: 'Oman', dialCode: '+968', minLength: 8, maxLength: 8, pattern: /^[79]\d{7}$/, placeholder: '92123456' },
  { iso2: 'PK', name: 'Pakistan', dialCode: '+92', minLength: 10, maxLength: 10, pattern: /^3\d{9}$/, placeholder: '3012345678' },
  { iso2: 'BD', name: 'Bangladesh', dialCode: '+880', minLength: 10, maxLength: 10, pattern: /^1\d{9}$/, placeholder: '1712345678' },
  { iso2: 'LK', name: 'Sri Lanka', dialCode: '+94', minLength: 9, maxLength: 9, pattern: /^7\d{8}$/, placeholder: '712345678' },
  { iso2: 'NP', name: 'Nepal', dialCode: '+977', minLength: 10, maxLength: 10, pattern: /^9[78]\d{8}$/, placeholder: '9841234567' },
  { iso2: 'MY', name: 'Malaysia', dialCode: '+60', minLength: 9, maxLength: 10, pattern: /^1\d{8,9}$/, placeholder: '123456789' },
  { iso2: 'TH', name: 'Thailand', dialCode: '+66', minLength: 9, maxLength: 9, pattern: /^[689]\d{8}$/, placeholder: '812345678' },
  { iso2: 'ID', name: 'Indonesia', dialCode: '+62', minLength: 9, maxLength: 11, pattern: /^8\d{8,10}$/, placeholder: '8123456789' },
  { iso2: 'PH', name: 'Philippines', dialCode: '+63', minLength: 10, maxLength: 10, pattern: /^9\d{9}$/, placeholder: '9123456789' },
  { iso2: 'VN', name: 'Vietnam', dialCode: '+84', minLength: 9, maxLength: 9, pattern: /^[39]\d{8}$/, placeholder: '912345678' },
  { iso2: 'JP', name: 'Japan', dialCode: '+81', minLength: 10, maxLength: 10, pattern: /^[789]0\d{8}$/, placeholder: '9012345678' },
  { iso2: 'KR', name: 'South Korea', dialCode: '+82', minLength: 10, maxLength: 10, pattern: /^1\d{9}$/, placeholder: '1012345678' },
  { iso2: 'CN', name: 'China', dialCode: '+86', minLength: 11, maxLength: 11, pattern: /^1\d{10}$/, placeholder: '13123456789' },
  { iso2: 'HK', name: 'Hong Kong', dialCode: '+852', minLength: 8, maxLength: 8, pattern: /^[569]\d{7}$/, placeholder: '51234567' },
  { iso2: 'TW', name: 'Taiwan', dialCode: '+886', minLength: 9, maxLength: 9, pattern: /^9\d{8}$/, placeholder: '912345678' },
  { iso2: 'NZ', name: 'New Zealand', dialCode: '+64', minLength: 8, maxLength: 10, pattern: /^2\d{7,9}$/, placeholder: '211234567' },
  { iso2: 'ZA', name: 'South Africa', dialCode: '+27', minLength: 9, maxLength: 9, pattern: /^[6-8]\d{8}$/, placeholder: '711234567' },
  { iso2: 'NG', name: 'Nigeria', dialCode: '+234', minLength: 10, maxLength: 10, pattern: /^[789]\d{9}$/, placeholder: '8012345678' },
  { iso2: 'KE', name: 'Kenya', dialCode: '+254', minLength: 9, maxLength: 9, pattern: /^7\d{8}$/, placeholder: '712345678' },
  { iso2: 'EG', name: 'Egypt', dialCode: '+20', minLength: 10, maxLength: 10, pattern: /^1\d{9}$/, placeholder: '1012345678' },
  { iso2: 'BR', name: 'Brazil', dialCode: '+55', minLength: 10, maxLength: 11, pattern: /^[1-9]\d{9,10}$/, placeholder: '11912345678' },
  { iso2: 'MX', name: 'Mexico', dialCode: '+52', minLength: 10, maxLength: 10, pattern: /^1\d{9}$/, placeholder: '5512345678' },
  { iso2: 'AR', name: 'Argentina', dialCode: '+54', minLength: 10, maxLength: 10, pattern: /^9?\d{9,10}$/, placeholder: '91123456789' },
  { iso2: 'CO', name: 'Colombia', dialCode: '+57', minLength: 10, maxLength: 10, pattern: /^3\d{9}$/, placeholder: '3012345678' },
  { iso2: 'CL', name: 'Chile', dialCode: '+56', minLength: 9, maxLength: 9, pattern: /^9\d{8}$/, placeholder: '912345678' },
  { iso2: 'IL', name: 'Israel', dialCode: '+972', minLength: 9, maxLength: 9, pattern: /^5\d{8}$/, placeholder: '501234567' },
]

export const DEFAULT_COUNTRY =
  PHONE_COUNTRIES.find((country) => country.iso2 === 'IN') ?? PHONE_COUNTRIES[0]

export function findCountryByIso2(iso2: string) {
  return PHONE_COUNTRIES.find((country) => country.iso2 === iso2.toUpperCase()) ?? DEFAULT_COUNTRY
}

export function findCountryByDialCode(dialCode: string) {
  const normalized = dialCode.startsWith('+') ? dialCode : `+${dialCode}`
  return (
    PHONE_COUNTRIES.find((country) => country.dialCode === normalized) ??
    PHONE_COUNTRIES.find((country) => normalized.startsWith(country.dialCode)) ??
    DEFAULT_COUNTRY
  )
}

export function filterCountries(query: string) {
  const trimmed = query.trim().toLowerCase()
  if (!trimmed) return PHONE_COUNTRIES

  return PHONE_COUNTRIES.filter((country) => {
    return (
      country.name.toLowerCase().includes(trimmed) ||
      country.iso2.toLowerCase().includes(trimmed) ||
      country.dialCode.includes(trimmed.replace(/\s/g, ''))
    )
  })
}
