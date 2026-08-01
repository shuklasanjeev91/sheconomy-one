import { Platform, Image as RNImage } from 'react-native'

import { Image } from '~/components/ui'
import type { SheconomyLogoVariant } from '~/lib/supabase/brand'

import { BRAND_NAME } from '~/config/brand'

type BrandLogoProps = {
  variant?: SheconomyLogoVariant
  /** Compact square mark (nav). Ignored when variant is explicitly set. */
  compact?: boolean
  width?: number
  height?: number
  accessibilityLabel?: string
}

/** Bundled marks with India flag stamped in the corner (shipped via OTA). */
const BUNDLED_LOGOS = {
  icon: require('../../assets/brand/logo-icon.png'),
  primary: require('../../assets/brand/logo-wordmark.png'),
} as const

/** App-wide brand mark — local assets so OTA updates include the India flag. */
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

  if (Platform.OS === 'web') {
    const resolvedAsset = RNImage.resolveAssetSource(bundled)
    return (
      <Image
        src={resolvedAsset?.uri}
        width={w}
        height={h}
        objectFit="contain"
        alt={label}
        accessibilityLabel={label}
      />
    )
  }

  return (
    <Image
      source={bundled}
      width={w}
      height={h}
      objectFit="contain"
      alt={label}
      accessibilityLabel={label}
    />
  )
}
