import { useEffect, useState } from 'react'

import { fetchCategoryFilterFacets, type CategoryFilterFacets } from '~/lib/supabase/commerce'

export function useCategoryFilterFacets(categoryId?: string) {
  const [facets, setFacets] = useState<CategoryFilterFacets | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!categoryId) {
      setFacets(null)
      setError(null)
      return
    }

    let active = true
    setIsLoading(true)
    setError(null)

    fetchCategoryFilterFacets(categoryId).then(({ data, error: fetchError }) => {
      if (!active) return
      setFacets(data)
      setError(fetchError)
      setIsLoading(false)
    })

    return () => {
      active = false
    }
  }, [categoryId])

  return { facets, isLoading, error }
}
