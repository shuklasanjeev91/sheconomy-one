import { useEffect, useState } from 'react'

import { Icons, Image, Text, YStack } from '~/components/ui'
import { useAppUi } from '~/lib/theme/useAppUi'

type CategoryImageProps = {
  src?: string | null
  /** Extra URLs to try if `src` fails to load (403 / broken CDN). */
  fallbackSrcs?: Array<string | null | undefined>
  /** Emoji glyph shown when there is no photo — most categories ship icon-only. */
  icon?: string | null
  width: number
  height: number
  alt: string
}

/** Category tile artwork with graceful fallback when CDN URLs fail on native. */
export function CategoryImage({
  src,
  fallbackSrcs,
  icon,
  width,
  height,
  alt,
}: CategoryImageProps) {
  const ui = useAppUi()
  const candidates = [src, ...(fallbackSrcs ?? [])]
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value))
  const uniqueCandidates = [...new Set(candidates)]
  const [activeIndex, setActiveIndex] = useState(0)
  const activeSrc = uniqueCandidates[activeIndex] ?? null

  useEffect(() => {
    setActiveIndex(0)
  }, [src, uniqueCandidates.join('|')])

  if (!activeSrc) {
    const glyph = icon?.trim()
    const scale = Math.min(width, height)
    return (
      <YStack
        width={width}
        height={height}
        alignItems="center"
        justifyContent="center"
        backgroundColor={ui.roseSurface}
      >
        {glyph ? (
          <Text fontSize={Math.round(scale * 0.44)} lineHeight={Math.round(scale * 0.52)}>
            {glyph}
          </Text>
        ) : (
          <Icons.Sparkles size={Math.round(scale * 0.34)} color={ui.brand} />
        )}
      </YStack>
    )
  }

  return (
    <Image
      src={activeSrc}
      alt={alt}
      width={width}
      height={height}
      objectFit="cover"
      onError={() => {
        setActiveIndex((current) => {
          if (current + 1 < uniqueCandidates.length) return current + 1
          return uniqueCandidates.length
        })
      }}
    />
  )
}
