import { useEffect, useState } from 'react'

import { getStateByName, resolveCountryCode } from '~/lib/geo/data'
import { loadCityOptions } from '~/lib/geo/lazy'
import type { GeoOption } from '~/lib/geo/types'

export function useGeoCities(countryCode: string, stateName: string) {
  const [options, setOptions] = useState<GeoOption[]>([])
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    const code = resolveCountryCode(countryCode)
    const state = getStateByName(code, stateName)

    if (!stateName.trim() || !state) {
      setOptions([])
      setIsLoading(false)
      return
    }

    let active = true
    setIsLoading(true)

    void loadCityOptions(code, state.isoCode).then((cities) => {
      if (!active) return
      setOptions(cities)
      setIsLoading(false)
    })

    return () => {
      active = false
    }
  }, [countryCode, stateName])

  return { options, isLoading }
}
