import { forwardRef, useEffect, useState } from 'react'
import { Image as RNImage, Platform, type StyleProp, type ViewStyle } from 'react-native'
import type { GetProps } from 'tamagui'
import { YStack } from 'tamagui'
import { SizableText } from './Text'
import { BRAND_THEME } from '~/config/tokens'

type SizeToken = '$1' | '$2' | '$2.5' | '$3' | '$4' | '$5' | '$6' | '$7' | '$8' | '$10'

export type AvatarProps = Omit<GetProps<typeof YStack>, 'size'> & {
  src?: string | null
  name?: string
  size?: SizeToken | number
  /** Show a subtle ring — useful for active states and profile chrome. */
  ring?: boolean
}

/** Token size → px used for a reliable cover crop. */
const AVATAR_PX: Record<SizeToken, number> = {
  $1: 20,
  $2: 24,
  '$2.5': 28,
  $3: 28,
  $4: 36,
  $5: 44,
  $6: 52,
  $7: 60,
  $8: 72,
  $10: 96,
}

function resolvePx(size: SizeToken | number | undefined): number {
  if (typeof size === 'number' && Number.isFinite(size) && size > 0) return size
  if (typeof size === 'string' && size in AVATAR_PX) return AVATAR_PX[size as SizeToken]
  return AVATAR_PX.$6
}

/** Trim / reject empty & non-http(s) junk so we never mount a broken image. */
export function normalizeAvatarSrc(src?: string | null): string | undefined {
  if (typeof src !== 'string') return undefined
  const trimmed = src.trim()
  if (!trimmed) return undefined
  // Allow https remote URLs and local / blob / data URIs used by pickers.
  if (
    trimmed.startsWith('https://') ||
    trimmed.startsWith('http://') ||
    trimmed.startsWith('blob:') ||
    trimmed.startsWith('data:') ||
    trimmed.startsWith('file:') ||
    trimmed.startsWith('/')
  ) {
    return trimmed
  }
  return undefined
}

/**
 * Initials-fallback avatar — pass `name` to auto-derive the fallback text.
 *
 * Uses RN Image (not Tamagui Avatar.Image) so load/error and cover-crop behave
 * the same on web, iOS, and Android. Initials sit under the photo until it loads.
 */
export const Avatar = forwardRef<any, AvatarProps>(function Avatar(
  { src, name, size = '$6', ring = false, borderWidth, borderColor, style, ...props },
  ref,
) {
  const normalized = normalizeAvatarSrc(src)
  const [failed, setFailed] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const showImage = !!normalized && !failed
  const px = resolvePx(size)

  useEffect(() => {
    setFailed(false)
    setLoaded(false)
  }, [normalized])

  const initials = name
    ?.trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('')

  const ringWidth = ring ? 2 : 0
  const outerBorderWidth =
    typeof borderWidth === 'number' ? borderWidth : ringWidth
  const outerBorderColor = borderColor ?? (ring ? '$color8' : 'transparent')

  return (
    <YStack
      ref={ref}
      theme={BRAND_THEME}
      // Explicit relative positioning: on web the absolute-inset fallback and
      // photo layers would otherwise anchor to the page, not this circle.
      position="relative"
      width={px}
      height={px}
      borderRadius={999}
      overflow="hidden"
      borderWidth={outerBorderWidth}
      borderColor={outerBorderColor}
      backgroundColor="$color4"
      alignItems="center"
      justifyContent="center"
      flexShrink={0}
      style={style as StyleProp<ViewStyle>}
      {...props}
    >
      <YStack
        position="absolute"
        top={0}
        right={0}
        bottom={0}
        left={0}
        zIndex={0}
        alignItems="center"
        justifyContent="center"
        backgroundColor="$color4"
        opacity={showImage && loaded ? 0 : 1}
        pointerEvents="none"
      >
        <SizableText
          fontWeight="700"
          color="$color11"
          letterSpacing={0.3}
          fontSize={Math.max(11, Math.round(px * 0.34))}
        >
          {initials || '?'}
        </SizableText>
      </YStack>

      {showImage ? (
        <RNImage
          key={normalized}
          source={{ uri: normalized }}
          accessibilityLabel={name}
          onLoad={() => setLoaded(true)}
          onError={() => {
            setFailed(true)
            setLoaded(false)
          }}
          // Google CDNs often block hotlinking without this on web.
          {...(Platform.OS === 'web'
            ? ({
                referrerPolicy: 'no-referrer',
              } as object)
            : {})}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: px,
            height: px,
            zIndex: 1,
          }}
          resizeMode="cover"
        />
      ) : null}
    </YStack>
  )
})

Avatar.displayName = 'Avatar'
