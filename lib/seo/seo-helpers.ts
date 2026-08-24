import type { PageSeo } from '~/lib/seo/seo'

export function readRouteParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? ''
  return value ?? ''
}

export function plainSnippet(value: string | null | undefined, max = 200): string {
  return String(value || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max)
}

export function pageSeo(partial: PageSeo): PageSeo {
  return {
    ...partial,
    description: partial.description ? plainSnippet(partial.description, 300) : partial.description,
  }
}
