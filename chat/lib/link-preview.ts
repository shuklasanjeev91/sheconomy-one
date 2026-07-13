import { supabase } from '~/lib/supabase/client'

export type LinkPreview = {
  url: string
  title: string | null
  description: string | null
  image: string | null
  siteName: string | null
}

const URL_RE = /(https?:\/\/[^\s]+)/i

/** Return the first http(s) URL in a string, trimming trailing punctuation. */
export function extractFirstUrl(text: string): string | null {
  const match = text.match(URL_RE)
  if (!match) return null
  return match[1].replace(/[.,;:!?)\]}'"]+$/, '')
}

const cache = new Map<string, LinkPreview | null>()
const inflight = new Map<string, Promise<LinkPreview | null>>()

/** Fetch Open Graph metadata for a URL via the `link-preview` edge function (cached). */
export async function fetchLinkPreview(url: string): Promise<LinkPreview | null> {
  if (cache.has(url)) return cache.get(url) ?? null
  const existing = inflight.get(url)
  if (existing) return existing

  const request = (async (): Promise<LinkPreview | null> => {
    try {
      const { data, error } = await supabase.functions.invoke('link-preview', { body: { url } })
      if (error || !data) {
        cache.set(url, null)
        return null
      }
      const preview = data as LinkPreview
      const meaningful = preview.title || preview.description || preview.image
      const result = meaningful ? preview : null
      cache.set(url, result)
      return result
    } catch {
      cache.set(url, null)
      return null
    } finally {
      inflight.delete(url)
    }
  })()

  inflight.set(url, request)
  return request
}
