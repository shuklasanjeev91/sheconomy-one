export {
  RegionPreferencesProvider,
  useRegionPreferences,
  useOptionalRegionPreferences,
} from '~/lib/locale/RegionPreferencesContext'
export type { RegionPreferences } from '~/lib/locale/RegionPreferencesContext'
export { detectDeviceRegion } from '~/lib/locale/detect-region'
export {
  REGION_LANGUAGES,
  PRIORITY_COUNTRY_CODES,
  allRegionCurrencies,
  defaultCurrencyForCountry,
  languageLabel,
  languageLocale,
} from '~/lib/locale/region-data'
