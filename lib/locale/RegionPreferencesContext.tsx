import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { Platform } from 'react-native'

import { detectDeviceRegion } from '~/lib/locale/detect-region'
import {
  defaultCurrencyForCountry,
  languageLabel,
  languageLocale,
} from '~/lib/locale/region-data'
import {
  readStoredRegionPreferences,
  writeStoredRegionPreferences,
  type StoredRegionPreferences,
} from '~/lib/locale/region-storage'
import { getCountryName } from '~/lib/geo/data'
import { supabase } from '~/lib/supabase/client'
import { useSupabase } from '~/providers/SupabaseProvider'
import { CURRENCY_SYMBOLS } from '~/lib/shop/shop.type'

export type RegionPreferences = {
  countryCode: string
  languageCode: string
  currencyCode: string
  localeTag: string
  userSet: boolean
  ready: boolean
}

type RegionPreferencesContextValue = RegionPreferences & {
  countryName: string
  languageName: string
  currencySymbol: string
  summaryLabel: string
  setPreferences: (next: {
    countryCode: string
    languageCode: string
    currencyCode: string
  }) => Promise<void>
  setCountry: (countryCode: string) => Promise<void>
  resetToDevice: () => Promise<void>
}

const RegionPreferencesContext = createContext<RegionPreferencesContextValue | null>(null)

const DEFAULTS: RegionPreferences = {
  countryCode: 'IN',
  languageCode: 'en',
  currencyCode: 'INR',
  localeTag: 'en-IN',
  userSet: false,
  ready: true,
}

function applyHtmlLang(languageCode: string, countryCode: string) {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return
  document.documentElement.lang = `${languageCode}-${countryCode}`
}

async function syncProfilePrefs(
  userId: string | undefined,
  prefs: Pick<RegionPreferences, 'countryCode' | 'languageCode' | 'currencyCode'>,
) {
  if (!userId) return
  try {
    await supabase
      .from('profiles')
      .update({
        country_code: prefs.countryCode,
        preferred_language: prefs.languageCode,
        preferred_currency: prefs.currencyCode,
      } as never)
      .eq('id', userId)
  } catch {
    // non-blocking
  }
}

export function RegionPreferencesProvider({ children }: { children: ReactNode }) {
  const { user } = useSupabase()
  const [prefs, setPrefs] = useState<RegionPreferences>(DEFAULTS)

  useEffect(() => {
    let cancelled = false

    async function hydrate() {
      const stored = await readStoredRegionPreferences()
      if (cancelled) return

      if (stored?.userSet) {
        const next: RegionPreferences = {
          countryCode: stored.countryCode,
          languageCode: stored.languageCode,
          currencyCode: stored.currencyCode,
          localeTag: languageLocale(stored.languageCode),
          userSet: true,
          ready: true,
        }
        setPrefs(next)
        applyHtmlLang(next.languageCode, next.countryCode)
        return
      }

      // Merge profile prefs when signed in (overrides device detect if set).
      let fromProfile: Partial<StoredRegionPreferences> | null = null
      if (user?.id) {
        const { data } = await supabase
          .from('profiles')
          .select('country_code, preferred_language, preferred_currency')
          .eq('id', user.id)
          .maybeSingle()
        if (data) {
          const row = data as {
            country_code?: string | null
            preferred_language?: string | null
            preferred_currency?: string | null
          }
          if (row.country_code || row.preferred_language || row.preferred_currency) {
            fromProfile = {
              countryCode: (row.country_code || 'IN').toUpperCase(),
              languageCode: (row.preferred_language || 'en').toLowerCase(),
              currencyCode: (row.preferred_currency || 'INR').toUpperCase(),
              userSet: true,
              updatedAt: new Date().toISOString(),
            }
          }
        }
      }

      if (cancelled) return

      if (fromProfile) {
        await writeStoredRegionPreferences(fromProfile as StoredRegionPreferences)
        const next: RegionPreferences = {
          countryCode: fromProfile.countryCode!,
          languageCode: fromProfile.languageCode!,
          currencyCode: fromProfile.currencyCode!,
          localeTag: languageLocale(fromProfile.languageCode!),
          userSet: true,
          ready: true,
        }
        setPrefs(next)
        applyHtmlLang(next.languageCode, next.countryCode)
        return
      }

      const detected = await detectDeviceRegion()
      if (cancelled) return

      const next: RegionPreferences = {
        ...detected,
        userSet: false,
        ready: true,
      }
      setPrefs(next)
      applyHtmlLang(next.languageCode, next.countryCode)
      await writeStoredRegionPreferences({
        countryCode: next.countryCode,
        languageCode: next.languageCode,
        currencyCode: next.currencyCode,
        userSet: false,
        updatedAt: new Date().toISOString(),
      })
    }

    void hydrate()
    return () => {
      cancelled = true
    }
  }, [user?.id])

  const persist = useCallback(
    async (next: Omit<RegionPreferences, 'ready'>) => {
      setPrefs({ ...next, ready: true })
      applyHtmlLang(next.languageCode, next.countryCode)
      await writeStoredRegionPreferences({
        countryCode: next.countryCode,
        languageCode: next.languageCode,
        currencyCode: next.currencyCode,
        userSet: next.userSet,
        updatedAt: new Date().toISOString(),
      })
      await syncProfilePrefs(user?.id, next)
    },
    [user?.id],
  )

  const setPreferences = useCallback(
    async (input: { countryCode: string; languageCode: string; currencyCode: string }) => {
      await persist({
        countryCode: input.countryCode.toUpperCase(),
        languageCode: input.languageCode.toLowerCase(),
        currencyCode: input.currencyCode.toUpperCase(),
        localeTag: languageLocale(input.languageCode),
        userSet: true,
      })
    },
    [persist],
  )

  const setCountry = useCallback(
    async (countryCode: string) => {
      const code = countryCode.toUpperCase()
      await setPreferences({
        countryCode: code,
        languageCode: prefs.languageCode,
        currencyCode: defaultCurrencyForCountry(code),
      })
    },
    [prefs.languageCode, setPreferences],
  )

  const resetToDevice = useCallback(async () => {
    const detected = await detectDeviceRegion()
    await persist({
      ...detected,
      userSet: false,
    })
  }, [persist])

  const value = useMemo<RegionPreferencesContextValue>(() => {
    const countryName = getCountryName(prefs.countryCode)
    const languageName = languageLabel(prefs.languageCode)
    const currencySymbol =
      CURRENCY_SYMBOLS[prefs.currencyCode] ?? prefs.currencyCode
    return {
      ...prefs,
      countryName,
      languageName,
      currencySymbol,
      summaryLabel: `${countryName} · ${languageName} · ${currencySymbol} (${prefs.currencyCode})`,
      setPreferences,
      setCountry,
      resetToDevice,
    }
  }, [prefs, setPreferences, setCountry, resetToDevice])

  return (
    <RegionPreferencesContext.Provider value={value}>{children}</RegionPreferencesContext.Provider>
  )
}

export function useRegionPreferences() {
  const ctx = useContext(RegionPreferencesContext)
  if (!ctx) {
    throw new Error('useRegionPreferences must be used within RegionPreferencesProvider')
  }
  return ctx
}

export function useOptionalRegionPreferences() {
  return useContext(RegionPreferencesContext)
}
