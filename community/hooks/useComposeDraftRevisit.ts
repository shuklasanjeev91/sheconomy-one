import { useCallback, useEffect, useMemo, useState } from 'react'

import {
  fetchComposeDraftRevisitCard,
  type ComposeDraftRevisitCard,
} from '~/community/lib/compose-draft-revisit'

export function useComposeDraftRevisit() {
  const [card, setCard] = useState<ComposeDraftRevisitCard | null>(null)
  const [loading, setLoading] = useState(true)

  const reload = useCallback(async () => {
    setLoading(true)
    const result = await fetchComposeDraftRevisitCard()
    setCard(result.card)
    setLoading(false)
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  return useMemo(
    () => ({
      card,
      loading,
      hasCard: card != null,
      refresh: reload,
    }),
    [card, loading, reload],
  )
}

export type { ComposeDraftRevisitCard }
