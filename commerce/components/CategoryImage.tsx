import { useEffect, useState } from 'react'

import { Icons, Image, Text, YStack } from '~/components/ui'
import { useAppUi } from '~/lib/theme/useAppUi'

type CategoryImageProps = {
  src?: string | null
  /** Emoji glyph shown when there is no photo — most categories ship icon-only. */
  icon?: string | null
  size: number
  alt: string
}

/** Category circle photo with graceful fallback when CDN URLs fail on native. */
export function CategoryImage({ src, icon, size, alt }: CategoryImageProps) {
  const ui = useAppUi()
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    setFailed(false)
  }, [src])

  if (!src || failed) {
    const glyph = icon?.trim()
    return (
      <YStack
        width={size}
        height={size}
        alignItems="center"
        justifyContent="center"
        backgroundColor={ui.roseSurface}
      >
        {glyph ? (
          <Text fontSize={Math.round(size * 0.42)} lineHeight={Math.round(size * 0.5)}>
            {glyph}
          </Text>
        ) : (
          <Icons.Sparkles size={Math.round(size * 0.32)} color={ui.brand} />
        )}
      </YStack>
    )
  }

  return (
    <Image
      src={src}
      alt={alt}
      width={size}
      height={size}
      objectFit="cover"
      onError={() => setFailed(true)}
    />
  )
}
