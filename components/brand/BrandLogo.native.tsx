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

const BRAND_LOGO_OTA_REV = 'remote-first-1'

/**
 * Native brand mark — remote Supabase URL first (reliable across OTA on
 * Android, matches web), bundled packager asset as the offline fallback.
 *
 * Android release/OTA builds frequently fail to paint a `require()`'d PNG that
 * changed via an update, and expo-image does not reliably fire `onError` for a
 * local asset failure — so bundled-first left the top-bar logo blank. Loading
 * the remote mark first avoids that; the embedded asset still covers offline.
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
  const [uri, setUri] = useState(remoteSrc)
  const [useBundled, setUseBundled] = useState(false)
  const w =
    width ??
    (resolved === 'icon' ? (compact ? 36 : 40) : compact ? 120 : 160)
  const h =
    height ??
    (resolved === 'icon' ? (compact ? 36 : 40) : compact ? 32 : 44)
  const label = accessibilityLabel ?? `${BRAND_NAME} logo`

  if (useBundled) {
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
      />
    )
  }

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
        // Try the legacy remote object once, then fall back to the embedded asset.
        if (uri !== fallbackSrc) setUri(fallbackSrc)
        else setUseBundled(true)
      }}
    />
  )
}
