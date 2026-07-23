import { Platform } from 'react-native'

import { Icons, Image, YStack } from '~/components/ui'
import type { ListingMediaKind } from '~/commerce/lib/listing-media'
import { useAppUi } from '~/lib/theme/useAppUi'

type ListingMediaPreviewProps = {
  url: string
  kind: ListingMediaKind
  alt: string
  width?: number | string
  height?: number | string
  objectFit?: 'cover' | 'contain' | 'fill'
  placeholderIconSize?: number
  muted?: boolean
  controls?: boolean
}

/** Listing gallery tile — photo or inline video preview. */
export function ListingMediaPreview({
  url,
  kind,
  alt,
  width = '100%',
  height = '100%',
  objectFit = 'cover',
  placeholderIconSize = 28,
  muted = true,
  controls = false,
}: ListingMediaPreviewProps) {
  const ui = useAppUi()

  if (!url) {
    return (
      <YStack
        flex={1}
        width="100%"
        height="100%"
        alignItems="center"
        justifyContent="center"
        backgroundColor={ui.roseSurface}
      >
        <Icons.Image size={placeholderIconSize} color={ui.brand} opacity={0.7} />
      </YStack>
    )
  }

  if (kind === 'video' && Platform.OS === 'web') {
    return (
      <video
        src={url}
        aria-label={alt}
        muted={muted}
        controls={controls}
        playsInline
        loop={!controls}
        style={{
          width: typeof width === 'number' ? width : '100%',
          height: typeof height === 'number' ? height : '100%',
          objectFit,
          background: '#000',
        }}
      />
    )
  }

  if (kind === 'video') {
    return (
      <YStack
        flex={1}
        width="100%"
        height="100%"
        alignItems="center"
        justifyContent="center"
        backgroundColor="#111"
      >
        <Icons.Video size={Math.max(placeholderIconSize, 24)} color="white" />
      </YStack>
    )
  }

  return (
    <Image
      src={url}
      alt={alt}
      width={width}
      height={height}
      objectFit={objectFit}
    />
  )
}
