import { forwardRef } from 'react'
import { Image as ExpoImage, type ImageContentFit } from 'expo-image'
import { Platform, type StyleProp, type ImageStyle, type ImageSourcePropType } from 'react-native'
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
  /** Stable recycling key for FlashList / expo-image native cache. */
  recyclingKey?: string
}

function numericDim(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : undefined
}

function contentFitFor(objectFit?: AppImageProps['objectFit']): ImageContentFit {
  switch (objectFit) {
    case 'contain':
      return 'contain'
    case 'fill':
      return 'fill'
    case 'none':
      return 'none'
    case 'scale-down':
      return 'scale-down'
    default:
      return 'cover'
  }
}

function uriFromSource(source: ImageSourcePropType | undefined): string | number | null {
  if (source == null) return null
  if (typeof source === 'number') return source
  if (typeof source === 'object' && !Array.isArray(source) && 'uri' in source && typeof source.uri === 'string') {
    return source.uri
  }
  if (Array.isArray(source)) {
    for (const entry of source) {
      if (entry && typeof entry === 'object' && 'uri' in entry && typeof entry.uri === 'string') {
        return entry.uri
      }
    }
  }
  return null
}

/**
 * Cross-platform image.
 *
 * Native: `expo-image` for disk/memory cache and FlashList recycling.
 * Web: Tamagui Image (DOM-friendly `src` / `alt`).
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
    recyclingKey,
    ..._rest
  },
  ref,
) {
  const uri = typeof src === 'string' && src.trim() ? src.trim() : undefined
  const label = accessibilityLabel ?? alt

  if (Platform.OS !== 'web') {
    const fromSource = uriFromSource(source as ImageSourcePropType | undefined)
    const resolved = fromSource ?? uri ?? null

    if (resolved == null) {
      return null
    }

    const w = numericDim(width)
    const h = numericDim(height)
    const radius = numericDim(borderRadius)
    const fillParent =
      (typeof width === 'string' && width.includes('%')) ||
      (typeof height === 'string' && height.includes('%')) ||
      (width == null && height == null)

    const recycleKey =
      recyclingKey ?? (typeof resolved === 'string' ? resolved : String(resolved))

    return (
      <ExpoImage
        ref={ref}
        source={resolved}
        accessibilityLabel={label}
        contentFit={contentFitFor(objectFit)}
        cachePolicy="memory-disk"
        recyclingKey={recycleKey}
        onError={typeof onError === 'function' ? () => (onError as () => void)() : undefined}
        onLoad={
          typeof onLoad === 'function'
            ? (event) => {
                ;(onLoad as (event: unknown) => void)(event)
              }
            : undefined
        }
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
      alt={label}
      style={style}
      onError={onError}
      onLoad={onLoad}
    />
  )
})

Image.displayName = 'Image'
