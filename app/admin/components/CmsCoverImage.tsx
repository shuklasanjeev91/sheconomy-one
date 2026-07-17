import { useEffect, useMemo, useState } from 'react'

import { Image, YStack } from '~/components/ui'
import { repairCmsMediaUrl } from '~/lib/cms'

type CmsCoverImageProps = {
  url: string | null | undefined
  alt?: string | null
  width?: number | string
  height?: number | string
  borderRadius?: number | string
}

/**
 * CMS cover image with raw + path-repair URL fallbacks.
 * Uses an explicit box size (not absolute fill) so it cannot cover sibling text.
 */
export function CmsCoverImage({
  url,
  alt,
  width = '100%',
  height = '100%',
  borderRadius,
}: CmsCoverImageProps) {
  const candidates = useMemo(() => {
    const raw = url?.trim() || ''
    if (!raw) return [] as string[]
    const repaired = repairCmsMediaUrl(raw)
    return [...new Set([raw, repaired].filter(Boolean))]
  }, [url])

  const [index, setIndex] = useState(0)

  useEffect(() => {
    setIndex(0)
  }, [url])

  const src = candidates[index]
  if (!src) return null

  return (
    <YStack width={width} height={height} overflow="hidden" borderRadius={borderRadius}>
      <Image
        src={src}
        alt={alt || 'Cover image'}
        width="100%"
        height="100%"
        objectFit="cover"
        onError={() => {
          if (index < candidates.length - 1) setIndex((i) => i + 1)
        }}
      />
    </YStack>
  )
}
