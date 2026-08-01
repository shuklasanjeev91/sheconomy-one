import { Platform, Image as RNImage, View } from 'react-native'

import { IndianFlagPaint } from '~/components/brand/IndianFlagPaint'
import { Image } from '~/components/ui'
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
  /** Festive painted tricolor accent (default on). */
  showIndiaPaint?: boolean
}

/** Bundled brand marks (no baked rectangular flag — paint overlay is OTA). */
const BUNDLED_LOGOS = {
  icon: require('../../assets/brand/logo-icon.png'),
  primary: require('../../assets/brand/logo-wordmark.png'),
} as const

/** Bump when brand OTA assets / paint treatment change. */
const BRAND_LOGO_OTA_REV = 'india-paint-ssr-1'

function webLogoSrc(variant: SheconomyLogoVariant, bundled: number): string {
  try {
    const uri = RNImage.resolveAssetSource(bundled)?.uri
    if (typeof uri === 'string' && uri.length > 0) return uri
  } catch {
    // SSR / incomplete asset registry — fall through
  }
  if (typeof bundled === 'string') return bundled
  // Remote CDN fallback keeps web SSR rendering if bundled resolve fails
  return getBrandLogoSource(variant).src
}

/** App-wide brand mark with Flipkart/Amazon-style painted India accent. */
export function BrandLogo({
  variant,
  compact = false,
  width,
  height,
  accessibilityLabel,
  showIndiaPaint = true,
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
  const paintSize = Math.max(14, Math.round(Math.min(w, h) * (resolved === 'icon' ? 0.55 : 0.42)))

  const logo =
    Platform.OS === 'web' ? (
      <Image
        key={`${resolved}-${BRAND_LOGO_OTA_REV}`}
        src={webLogoSrc(resolved, bundled)}
        width={w}
        height={h}
        objectFit="contain"
        alt={label}
        accessibilityLabel={label}
      />
    ) : (
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

  if (!showIndiaPaint) return logo

  return (
    <View style={{ width: w, height: h, position: 'relative' }}>
      {logo}
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          right: resolved === 'icon' ? -2 : 0,
          bottom: resolved === 'icon' ? -1 : 0,
          zIndex: 2,
        }}
      >
        <IndianFlagPaint size={paintSize} />
      </View>
    </View>
  )
}
