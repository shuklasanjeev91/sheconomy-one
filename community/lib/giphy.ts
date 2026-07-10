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
    id: '1',
    title: 'Celebrate',
    url: 'https://media.giphy.com/media/5GoVLqeAOo6PK/giphy.gif',
    previewUrl: 'https://media.giphy.com/media/5GoVLqeAOo6PK/200w.gif',
    width: 480,
    height: 270,
  },
  {
    id: '2',
    title: 'Applause',
    url: 'https://media.giphy.com/media/7r4g3v4wAF8rC/giphy.gif',
    previewUrl: 'https://media.giphy.com/media/7r4g3v4wAF8rC/200w.gif',
    width: 480,
    height: 270,
  },
  {
    id: '3',
    title: 'Thumbs up',
    url: 'https://media.giphy.com/media/111ebonMs90YLu/giphy.gif',
    previewUrl: 'https://media.giphy.com/media/111ebonMs90YLu/200w.gif',
    width: 480,
    height: 270,
  },
  {
    id: '4',
    title: 'Excited',
    url: 'https://media.giphy.com/media/5VKbvrjxpVJCM/giphy.gif',
    previewUrl: 'https://media.giphy.com/media/5VKbvrjxpVJCM/200w.gif',
    width: 480,
    height: 270,
  },
  {
    id: '5',
    title: 'Congrats',
    url: 'https://media.giphy.com/media/l0MYt5jPR6QX5pnqM/giphy.gif',
    previewUrl: 'https://media.giphy.com/media/l0MYt5jPR6QX5pnqM/200w.gif',
    width: 480,
    height: 270,
  },
  {
    id: '6',
    title: 'Nice',
    url: 'https://media.giphy.com/media/26BRuo6sMax2FYbsdy/giphy.gif',
    previewUrl: 'https://media.giphy.com/media/26BRuo6sMax2FYbsdy/200w.gif',
    width: 480,
    height: 270,
  },
]

function mapGiphyItem(item: {
  id: string
  title: string
  images: {
    fixed_height: { url: string; width: string; height: string }
    fixed_height_small: { url: string }
  }
}): GifResult {
  return {
    id: item.id,
    title: item.title,
    url: item.images.fixed_height.url,
    previewUrl: item.images.fixed_height_small.url,
    width: Number(item.images.fixed_height.width) || 200,
    height: Number(item.images.fixed_height.height) || 200,
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

export function isGifUrl(url: string) {
  return (
    /\.gif(\?|$)/i.test(url) ||
    url.includes('giphy.com') ||
    url.includes('tenor.com') ||
    url.includes('media.tenor.com')
  )
}
