import { Image } from '~/components/ui'
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

const BRAND_LOGO_OTA_REV = 'no-india-flag-1'

/** Native brand mark — bundled assets only (no flag overlay). */
export function BrandLogo({
  variant,
  compact = false,
  width,
  height,
  accessibilityLabel,
}: BrandLogoProps) {
  const resolved: SheconomyLogoVariant = variant ?? (compact ? 'icon' : 'primary')
  const bundled = BUNDLED_LOGOS[resolved]
  const w =
    width ??
    (resolved === 'icon' ? (compact ? 36 : 40) : compact ? 120 : 160)
  const h =
    height ??
    (resolved === 'icon' ? (compact ? 36 : 40) : compact ? 32 : 44)
  const label = accessibilityLabel ?? `${BRAND_NAME} logo`

  return (
    <Image
      key={`${resolved}-${BRAND_LOGO_OTA_REV}`}
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
