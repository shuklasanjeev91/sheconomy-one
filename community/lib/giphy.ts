export type GifResult = {
  id: string
  title: string
  url: string
  previewUrl: string
  width: number
  height: number
}

const GIPHY_API_KEY =
  (typeof process !== 'undefined' && process.env.EXPO_PUBLIC_GIPHY_API_KEY) ||
  'sXpVOEpsHfRYG9xhnW9Vx5Jj3fPFcQX'

const FALLBACK_GIFS: GifResult[] = [
  {
    id: '5GoVLqeAOo6PK',
    title: 'Celebrate',
    url: 'https://i.giphy.com/5GoVLqeAOo6PK.gif',
    previewUrl: 'https://i.giphy.com/5GoVLqeAOo6PK.gif',
    width: 480,
    height: 270,
  },
  {
    id: '7r4g3v4wAF8rC',
    title: 'Applause',
    url: 'https://i.giphy.com/7r4g3v4wAF8rC.gif',
    previewUrl: 'https://i.giphy.com/7r4g3v4wAF8rC.gif',
    width: 480,
    height: 270,
  },
  {
    id: '111ebonMs90YLu',
    title: 'Thumbs up',
    url: 'https://i.giphy.com/111ebonMs90YLu.gif',
    previewUrl: 'https://i.giphy.com/111ebonMs90YLu.gif',
    width: 480,
    height: 270,
  },
  {
    id: '5VKbvrjxpVJCM',
    title: 'Excited',
    url: 'https://i.giphy.com/5VKbvrjxpVJCM.gif',
    previewUrl: 'https://i.giphy.com/5VKbvrjxpVJCM.gif',
    width: 480,
    height: 270,
  },
  {
    id: 'l0MYt5jPR6QX5pnqM',
    title: 'Congrats',
    url: 'https://i.giphy.com/l0MYt5jPR6QX5pnqM.gif',
    previewUrl: 'https://i.giphy.com/l0MYt5jPR6QX5pnqM.gif',
    width: 480,
    height: 270,
  },
  {
    id: '26BRuo6sLetFw',
    title: 'Nice',
    url: 'https://i.giphy.com/26BRuo6sLetFw.gif',
    previewUrl: 'https://i.giphy.com/26BRuo6sLetFw.gif',
    width: 480,
    height: 270,
  },
]

function mapGiphyItem(item: {
  id: string
  title: string
  images: {
    fixed_height?: { url: string; width: string; height: string }
    fixed_height_small?: { url: string }
    downsized?: { url: string; width: string; height: string }
    original?: { url: string }
  }
}): GifResult {
  // Prefer stable i.giphy.com embeds — media.giphy.com search URLs often render
  // Giphy’s “THIS CONTENT IS NOT AVAILABLE” placeholder in the composer.
  const width = Number(item.images.fixed_height?.width || item.images.downsized?.width) || 200
  const height = Number(item.images.fixed_height?.height || item.images.downsized?.height) || 200
  return {
    id: item.id,
    title: item.title,
    url: `https://i.giphy.com/${item.id}.gif`,
    previewUrl: item.images.fixed_height_small?.url || `https://i.giphy.com/${item.id}.gif`,
    width,
    height,
  }
}

export async function searchGifs(query: string, limit = 20): Promise<GifResult[]> {
  const trimmed = query.trim()
  const endpoint = trimmed
    ? `https://api.giphy.com/v1/gifs/search?api_key=${GIPHY_API_KEY}&q=${encodeURIComponent(trimmed)}&limit=${limit}&rating=g`
    : `https://api.giphy.com/v1/gifs/trending?api_key=${GIPHY_API_KEY}&limit=${limit}&rating=g`

  try {
    const response = await fetch(endpoint)
    if (!response.ok) return FALLBACK_GIFS
    const json = await response.json()
    const items = (json.data ?? []).map(mapGiphyItem)
    return items.length ? items : FALLBACK_GIFS
  } catch {
    return FALLBACK_GIFS
  }
}

/** Fast, reliable GIF for create-post auto-attach (never blocks the draft). */
export async function pickComposeGif(query: string): Promise<GifResult> {
  const trimmed = query.trim() || 'celebrate'
  const index =
    Math.abs(
      [...trimmed].reduce((sum, char) => sum + char.charCodeAt(0), 0),
    ) % FALLBACK_GIFS.length
  const fallback = FALLBACK_GIFS[index] ?? FALLBACK_GIFS[0]!

  try {
    const result = await Promise.race([
      searchGifs(trimmed, 4),
      new Promise<GifResult[]>((resolve) => {
        setTimeout(() => resolve([]), 1800)
      }),
    ])
    const first = result[0]
    if (first?.id && first.url.includes('i.giphy.com')) return first
  } catch {
    // use fallback
  }
  return fallback
}

export function isGifUrl(url: string) {
  return (
    /\.gif(\?|$)/i.test(url) ||
    url.includes('giphy.com') ||
    url.includes('tenor.com') ||
    url.includes('media.tenor.com')
  )
}
