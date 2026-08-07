import { useState } from 'react'

import { Image } from '~/components/ui'
import { getBrandLogoSource } from '~/lib/brand/logo-assets'
import type { SheconomyLogoVariant } from '~/lib/supabase/brand'

import { BRAND_NAME } from '~/config/brand'

type BrandLogoProps = {
  variant?: SheconomyLogoVariant
  compact?: boolean
  width?: number
  height?: number
  accessibilityLabel?: string
}

/** Web/SSR brand mark — remote URLs only (no Metro `require`, safe for Vercel). */
export function BrandLogo({
  variant,
  compact = false,
  width,
  height,
  accessibilityLabel,
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
  const label = accessibilityLabel ?? `${BRAND_NAME} logo`

  return (
    <Image
      key={uri}
      src={uri}
      width={w}
      height={h}
      objectFit="contain"
      alt={label}
      accessibilityLabel={label}
      onError={() => {
        if (uri !== fallbackSrc) setUri(fallbackSrc)
      }}
    />
  )
}
