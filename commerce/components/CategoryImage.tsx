import { useEffect, useState } from 'react'

import { Icons, Image, Text, YStack } from '~/components/ui'
import { useAppUi } from '~/lib/theme/useAppUi'

type CategoryImageProps = {
  src?: string | null
  /** Emoji glyph shown when there is no photo — most categories ship icon-only. */
  icon?: string | null
  width: number
  height: number
  alt: string
}

/** Category tile artwork with graceful fallback when CDN URLs fail on native. */
export function CategoryImage({ src, icon, width, height, alt }: CategoryImageProps) {
  const ui = useAppUi()
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    setFailed(false)
  }, [src])

  if (!src || failed) {
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
      src={src}
      alt={alt}
      width={width}
      height={height}
      objectFit="cover"
      onError={() => setFailed(true)}
    />
  )
}
