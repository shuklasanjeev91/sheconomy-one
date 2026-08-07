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

/** Bundled marks for native OTA. */
const BUNDLED_LOGOS = {
  icon: require('../../assets/brand/logo-icon.png'),
  primary: require('../../assets/brand/logo-wordmark.png'),
} as const

const BRAND_LOGO_OTA_REV = 'no-india-flag-2'

/**
 * Native brand mark — bundled assets first, remote Supabase URL fallback
 * if the packager asset fails to paint (Release / expo-image edge cases).
 */
export function BrandLogo({
  variant,
  compact = false,
  width,
  height,
  accessibilityLabel,
}: BrandLogoProps) {
  const resolved: SheconomyLogoVariant = variant ?? (compact ? 'icon' : 'primary')
  const bundled = BUNDLED_LOGOS[resolved]
  const { src: remoteSrc, fallbackSrc } = getBrandLogoSource(resolved)
  const [useRemote, setUseRemote] = useState(false)
  const [uri, setUri] = useState(remoteSrc)
  const w =
    width ??
    (resolved === 'icon' ? (compact ? 36 : 40) : compact ? 120 : 160)
  const h =
    height ??
    (resolved === 'icon' ? (compact ? 36 : 40) : compact ? 32 : 44)
  const label = accessibilityLabel ?? `${BRAND_NAME} logo`

  if (useRemote) {
    return (
      <Image
        key={`remote-${uri}-${BRAND_LOGO_OTA_REV}`}
        src={uri}
        width={w}
        height={h}
        objectFit="contain"
        alt={label}
        accessibilityLabel={label}
        recyclingKey={`brand-logo-remote-${resolved}-${BRAND_LOGO_OTA_REV}`}
        onError={() => {
          if (uri !== fallbackSrc) setUri(fallbackSrc)
        }}
      />
    )
  }

  return (
    <Image
      key={`bundled-${resolved}-${BRAND_LOGO_OTA_REV}`}
      source={bundled}
      width={w}
      height={h}
      objectFit="contain"
      alt={label}
      accessibilityLabel={label}
      recyclingKey={`brand-logo-${resolved}-${BRAND_LOGO_OTA_REV}`}
      onError={() => setUseRemote(true)}
    />
  )
}
