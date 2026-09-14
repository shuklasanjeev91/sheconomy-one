import { useCallback, useEffect, useState } from 'react'

import {
  DEFAULT_AD_PREFERENCES,
  getAdPreferencesSnapshot,
  loadAdPreferences,
  saveAdPreferences,
  subscribeToAdPreferences,
  type AdPreferenceKey,
  type AdPreferences,
} from '~/community/lib/ad-preferences'
import { useSupabase } from '~/providers/SupabaseProvider'

export function useAdPreferences() {
  const { user, isLoading: authLoading } = useSupabase()
  const [preferences, setPreferences] = useState<AdPreferences>(getAdPreferencesSnapshot)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => subscribeToAdPreferences(() => setPreferences(getAdPreferencesSnapshot())), [])

  useEffect(() => {
    if (authLoading) return

    let cancelled = false
    setIsLoading(true)
    void loadAdPreferences(user?.id).then((result) => {
      if (cancelled) return
      setPreferences(result.preferences)
      setError(result.error)
      setIsLoading(false)
    })

    return () => {
      cancelled = true
    }
  }, [authLoading, user?.id])

  const setPreference = useCallback(
    async (key: AdPreferenceKey, enabled: boolean) => {
      const previous = getAdPreferencesSnapshot()
      const next = {
        ...previous,
        [key]: enabled === true,
      }
      const result = await saveAdPreferences(next, user?.id)
      setPreferences(result.preferences)
      setError(result.error)
      return result
    },
    [user?.id],
  )

  return {
    preferences: preferences ?? { ...DEFAULT_AD_PREFERENCES },
    isLoading: authLoading || isLoading,
    error,
    setPreference,
  }
}
