import { useEffect, useState } from 'react'

import { fetchShopCategoryOptions } from '~/lib/shop/shop.service'

/** Live marketplace category names for shop create / edit pickers. */
export function useShopCategoryOptions() {
  const [categories, setCategories] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    void fetchShopCategoryOptions().then((result) => {
      if (cancelled) return
      if (result.error || !result.data) {
        setCategories([])
        setError(result.error ?? 'Could not load categories.')
        setLoading(false)
        return
      }
      setCategories(result.data)
      setError(null)
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [])

  return { categories, loading, error }
}
