import { useCallback, useEffect, useState } from 'react'

import { fetchStoryRings, type StoryRing } from '~/community/lib/stories'
import { subscribeStoryRefresh } from '~/community/lib/story-refresh'
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
    try {
      const data = await fetchStoryRings(user.id)
      setRings(data)
    } catch {
      setRings([])
    } finally {
      setIsLoading(false)
    }
  }, [user])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => subscribeStoryRefresh(() => {
    void load()
  }), [load])

  return { rings, isLoading, refresh: load }
}
