import type { GeoOption } from './types'

type CityModule = typeof import('country-state-city')

let cityModulePromise: Promise<CityModule> | null = null

function loadCityModule(): Promise<CityModule> {
  if (!cityModulePromise) {
    cityModulePromise = import('country-state-city')
  }
  return cityModulePromise
}

export async function loadCityOptions(
  countryCode: string,
  stateIsoCode: string,
): Promise<GeoOption[]> {
  const { City } = await loadCityModule()
  return City.getCitiesOfState(countryCode, stateIsoCode)
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((city) => ({
      value: city.name,
      label: city.name,
    }))
}
