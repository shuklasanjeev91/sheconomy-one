export type { Country } from './types'

export {
  filterPhoneCountries as filterCountries,
  findPhoneCountryByDialCode as findCountryByDialCode,
  findPhoneCountryByIso2 as findCountryByIso2,
  getAllPhoneCountries,
  getDefaultPhoneCountry,
  hasStrictPhoneRule,
} from './catalog'

import { countryFlagEmoji } from '~/lib/geo'
import { getAllPhoneCountries, getDefaultPhoneCountry } from './catalog'

/** Full international catalog backed by country-state-city. */
export const PHONE_COUNTRIES = getAllPhoneCountries()

export const DEFAULT_COUNTRY = getDefaultPhoneCountry()

export function countryFlag(iso2: string) {
  return countryFlagEmoji(iso2)
}
