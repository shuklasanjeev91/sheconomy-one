import { useState } from 'react'

import { IndianFlagBadge } from '~/components/brand/IndianFlagBadge'
import { Image, YStack } from '~/components/ui'
import { getBrandLogoSource } from '~/lib/brand/logo-assets'
import type { SheconomyLogoVariant } from '~/lib/supabase/brand'

import { BRAND_NAME } from '~/config/brand'

type BrandLogoProps = {
  variant?: SheconomyLogoVariant
  /** Compact square mark (nav). Ignored when variant is explicitly set. */
  compact?: boolean
  width?: number
  height?: number
  accessibilityLabel?: string
  /** Show India flag badge on the logo corner (default true). */
  showIndiaFlag?: boolean
}

/** App-wide brand mark — always loaded from Supabase Storage. */
export function BrandLogo({
  variant,
  compact = false,
  width,
  height,
  accessibilityLabel,
  showIndiaFlag = true,
}: BrandLogoProps) {
  const resolved: SheconomyLogoVariant = variant ?? (compact ? 'icon' : 'primary')
  const { src, fallbackSrc } = getBrandLogoSource(resolved)
  const [uri, setUri] = useState(src)
  const w =
    width ??
    (resolved === 'icon' ? (compact ? 36 : 40) : compact ? 120 : 160)
  const h =
    height ??
    (resolved === 'icon' ? (compact ? 36 : 40) : compact ? 32 : 44)
  const flagSize = Math.max(10, Math.round(Math.min(w, h) * 0.32))

  return (
    <YStack width={w} height={h} position="relative">
      <Image
        key={uri}
        src={uri}
        width={w}
        height={h}
        objectFit="contain"
        alt={accessibilityLabel ?? `${BRAND_NAME} logo`}
        accessibilityLabel={accessibilityLabel ?? `${BRAND_NAME} logo`}
        onError={() => {
          if (uri !== fallbackSrc) setUri(fallbackSrc)
        }}
      />
      {showIndiaFlag ? (
        <YStack
          position="absolute"
          right={0}
          bottom={0}
          zIndex={2}
          pointerEvents="none"
        >
          <IndianFlagBadge size={flagSize} />
        </YStack>
      ) : null}
    </YStack>
  )
}
