import { forwardRef } from 'react'
import { Image as RNImage, Platform, type StyleProp, type ImageStyle, type ImageSourcePropType } from 'react-native'
import type { GetProps } from 'tamagui'
import { Image as TamaguiImage } from 'tamagui'

type TamaguiImageProps = GetProps<typeof TamaguiImage>

export type AppImageProps = Omit<TamaguiImageProps, 'src' | 'source'> & {
  /** Web-friendly alias — mapped to RN `source.uri` on native. */
  src?: string | null
  source?: ImageSourcePropType | TamaguiImageProps['source']
  alt?: string
  width?: number | string
  height?: number | string
  objectFit?: 'cover' | 'contain' | 'fill' | 'none' | 'scale-down'
}

function numericDim(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : undefined
}

function resizeModeFor(objectFit?: AppImageProps['objectFit']) {
  switch (objectFit) {
    case 'contain':
      return 'contain' as const
    case 'fill':
      return 'stretch' as const
    case 'none':
      return 'center' as const
    case 'scale-down':
      return 'contain' as const
    default:
      return 'cover' as const
  }
}

/**
 * Cross-platform image.
 *
 * Tamagui's native Image puts `width`/`height` into RN `source` and rebuilds
 * `source` from `src`, which breaks when dimensions are percentage strings.
 * On native we render RN Image with a clean `{ uri }` source.
 */
export const Image = forwardRef<any, AppImageProps>(function Image(
  {
    src,
    source,
    width,
    height,
    alt,
    accessibilityLabel,
    objectFit,
    style,
    onError,
    onLoad,
    borderRadius,
    ..._rest
  },
  ref,
) {
  const uri = typeof src === 'string' && src.trim() ? src.trim() : undefined
  const label = accessibilityLabel ?? alt

  if (Platform.OS !== 'web') {
    const resolved: ImageSourcePropType | undefined =
      (source as ImageSourcePropType | undefined) ?? (uri ? { uri } : undefined)

    if (!resolved) {
      return null
    }

    const w = numericDim(width)
    const h = numericDim(height)
    const radius = numericDim(borderRadius)
    // Percentage dims need a sized parent — absolute fill is the reliable RN pattern
    // inside aspect-ratio cards (ListingCard, CategoryChip, etc.).
    const fillParent =
      (typeof width === 'string' && width.includes('%')) ||
      (typeof height === 'string' && height.includes('%')) ||
      (width == null && height == null)

    return (
      <RNImage
        ref={ref}
        source={resolved}
        accessibilityLabel={label}
        resizeMode={resizeModeFor(objectFit)}
        onError={typeof onError === 'function' ? (onError as () => void) : undefined}
        onLoad={typeof onLoad === 'function' ? (onLoad as () => void) : undefined}
        style={
          [
            fillParent
              ? {
                  position: 'absolute' as const,
                  top: 0,
                  right: 0,
                  bottom: 0,
                  left: 0,
                  ...(radius != null ? { borderRadius: radius } : null),
                }
              : {
                  width: w ?? (width as number | undefined),
                  height: h ?? (height as number | undefined),
                  ...(radius != null ? { borderRadius: radius } : null),
                },
            style as StyleProp<ImageStyle>,
          ] as StyleProp<ImageStyle>
        }
      />
    )
  }

  return (
    <TamaguiImage
      ref={ref}
      {...(_rest as object)}
      src={uri ?? undefined}
      source={source as TamaguiImageProps['source']}
      width={width}
      height={height}
      objectFit={objectFit}
      borderRadius={borderRadius}
      // Web DOM uses `alt` — never pass RN `accessibilityLabel` to <img>.
      alt={label}
      style={style}
      onError={onError}
      onLoad={onLoad}
    />
  )
})

Image.displayName = 'Image'
