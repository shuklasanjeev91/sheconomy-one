import { Icons, XStack } from '~/components/ui'
import { useFavorites } from '~/commerce/hooks/useFavorites'
import { useAppUi } from '~/lib/theme/useAppUi'

type FavoriteButtonProps = {
  listingId: string
  size?: number
}

/** Heart overlay — top-right of listing image. */
export function FavoriteButton({ listingId, size = 18 }: FavoriteButtonProps) {
  const ui = useAppUi()
  const { isFavorite, toggleFavorite } = useFavorites()
  const saved = isFavorite(listingId)

  return (
    <XStack
      position="absolute"
      top="$2"
      right="$2"
      zIndex={2}
      width={36}
      height={36}
      borderRadius={999}
      backgroundColor={ui.deliveryBg}
      alignItems="center"
      justifyContent="center"
      cursor="pointer"
      animation="bouncy"
      hoverStyle={{ backgroundColor: ui.surface, scale: 1.06 }}
      pressStyle={{ scale: 0.88 }}
      onPress={(e: { stopPropagation?: () => void; preventDefault?: () => void }) => {
        e?.stopPropagation?.()
        e?.preventDefault?.()
        void toggleFavorite(listingId)
      }}
      aria-label={saved ? 'Remove from favorites' : 'Add to favorites'}
      role="button"
      data-listing-id={listingId}
    >
      <Icons.Heart
        size={size}
        color={saved ? ui.brand : ui.text}
        fill={saved ? ui.brand : 'transparent'}
      />
    </XStack>
  )
}