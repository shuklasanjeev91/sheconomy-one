import { City, Country, State, type ICity, type ICountry, type IState } from 'country-state-city'

import { inferCountryFromLocale } from '~/commerce/lib/infer-country-from-locale'

import type { GeoOption } from './types'

let countriesCache: ICountry[] | null = null

export function getAllGeoCountries(): ICountry[] {
  if (!countriesCache) {
    countriesCache = Country.getAllCountries().sort((a, b) => a.name.localeCompare(b.name))
  }
  return countriesCache
}

export function getCountryByCode(isoCode: string): ICountry | undefined {
  if (!isoCode.trim()) return undefined
  return Country.getCountryByCode(isoCode.trim().toUpperCase())
}

export function getCountryName(isoCode: string, fallback?: string | null): string {
  if (!isoCode.trim()) return fallback?.trim() || ''
  const byCode = getCountryByCode(isoCode)
  if (byCode) return byCode.name
  const byName = getAllGeoCountries().find(
    (country) => country.name.toLowerCase() === isoCode.trim().toLowerCase(),
  )
  return byName?.name ?? fallback?.trim() ?? isoCode.trim()
}

export function resolveCountryCode(value: string | null | undefined): string {
  const raw = value?.trim()
  if (!raw) return getDefaultCountryCode()
  if (getCountryByCode(raw)) return raw.toUpperCase()
  const byName = getAllGeoCountries().find(
    (country) => country.name.toLowerCase() === raw.toLowerCase(),
  )
  return byName?.isoCode ?? raw.toUpperCase()
}

export function getDefaultCountryCode(): string {
  const fromLocale = inferCountryFromLocale()
  if (fromLocale && getCountryByCode(fromLocale)) {
    return fromLocale.toUpperCase()
  }
  return 'IN'
}

export function getStatesOfCountry(countryCode: string): IState[] {
  const code = resolveCountryCode(countryCode)
  return State.getStatesOfCountry(code).sort((a, b) => a.name.localeCompare(b.name))
}

export function getStateByName(countryCode: string, stateName: string): IState | undefined {
  const normalized = stateName.trim().toLowerCase()
  if (!normalized) return undefined
  return getStatesOfCountry(countryCode).find((state) => state.name.toLowerCase() === normalized)
}

export function getCitiesOfState(countryCode: string, stateName: string): ICity[] {
  const state = getStateByName(countryCode, stateName)
  if (!state) return []
  return City.getCitiesOfState(resolveCountryCode(countryCode), state.isoCode).sort((a, b) =>
    a.name.localeCompare(b.name),
  )
}

export function countryToOption(country: ICountry): GeoOption {
  return {
    value: country.isoCode,
    label: country.name,
    meta: country.isoCode,
  }
}

export function stateToOption(state: IState): GeoOption {
  return {
    value: state.name,
    label: state.name,
    meta: state.isoCode,
  }
}

export function cityToOption(city: ICity): GeoOption {
  return {
    value: city.name,
    label: city.name,
  }
}

export function filterGeoOptions(options: GeoOption[], query: string, limit = 80): GeoOption[] {
  const normalized = query.trim().toLowerCase()
  if (!normalized) return options.slice(0, limit)
  return options
    .filter(
      (option) =>
        option.label.toLowerCase().includes(normalized) ||
        option.value.toLowerCase().includes(normalized) ||
        option.meta?.toLowerCase().includes(normalized),
    )
    .slice(0, limit)
}

export function countryFlagEmoji(isoCode: string): string {
  const country = getCountryByCode(isoCode)
  if (country?.flag) return country.flag
  const code = isoCode.toUpperCase()
  if (code.length !== 2) return '🏳️'
  return String.fromCodePoint(...[...code].map((char) => 0x1f1e6 - 65 + char.charCodeAt(0)))
}
