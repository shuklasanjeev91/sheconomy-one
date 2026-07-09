import { useCallback, useEffect, useState } from 'react'

import {
  fetchProfileDetails,
  type ProfileDetails,
} from '~/community/lib/profile-details'

export function useProfileDetails(userId: string | null | undefined) {
  const [details, setDetails] = useState<ProfileDetails | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!userId) {
      setDetails(null)
      setError(null)
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    setError(null)

    const { data, error: fetchError } = await fetchProfileDetails(userId)

    setDetails(data)
    setError(fetchError)
    setIsLoading(false)
  }, [userId])

  useEffect(() => {
    void load()
  }, [load])

  return {
    details,
    isLoading,
    error,
    refresh: load,
  }
}
