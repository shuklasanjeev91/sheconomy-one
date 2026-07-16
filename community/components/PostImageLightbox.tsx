import { MediaLightbox, type MediaLightboxItem } from '~/components/media/MediaLightbox'
import type { PostMediaItem } from '~/community/lib/post-media'

type PostImageLightboxProps = {
  items?: PostMediaItem[]
  /** @deprecated Prefer `items`. */
  urls?: string[]
  open: boolean
  onOpenChange: (open: boolean) => void
  initialIndex?: number
}

/** Fullscreen zoomable viewer for post media (LinkedIn-style). */
export function PostImageLightbox({
  items,
  urls,
  open,
  onOpenChange,
  initialIndex = 0,
}: PostImageLightboxProps) {
  const slides: MediaLightboxItem[] =
    items?.length
      ? items.map((item) => ({ url: item.url, kind: item.kind }))
      : (urls ?? []).map((url) => ({
          url,
          kind: /\.(mp4|webm|mov|m4v|mkv|ogg|m3u8)(\?|$)/i.test(url) ? ('video' as const) : ('image' as const),
        }))

  return (
    <MediaLightbox
      items={slides}
      open={open}
      onOpenChange={onOpenChange}
      initialIndex={initialIndex}
    />
  )
}
