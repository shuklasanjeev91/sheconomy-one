import { useCallback, useEffect, useState } from 'react'

import { fetchStoryRings, type StoryRing } from '~/community/lib/stories'
import { useSupabase } from '~/providers/SupabaseProvider'

export function useStoryRings() {
  const { user } = useSupabase()
  const [rings, setRings] = useState<StoryRing[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const load = useCallback(async () => {
    if (!user) {
      setRings([])
      setIsLoading(false)
      return
    }
    setIsLoading(true)
    const data = await fetchStoryRings(user.id)
    setRings(data)
    setIsLoading(false)
  }, [user])

  useEffect(() => {
    load()
  }, [load])

  return { rings, isLoading, refresh: load }
}
