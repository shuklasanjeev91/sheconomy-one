import { useState } from 'react'

import { WishlistMoveSheet } from '~/commerce/components/WishlistMoveSheet'
import { Icons, XStack, useAppToast } from '~/components/ui'
import { useFavorites } from '~/commerce/hooks/useFavorites'
import { feedback } from '~/lib/platform/feedback'
import { useAppUi } from '~/lib/theme/useAppUi'
import { useAsyncAction } from '~/hooks/useAsyncAction'

type FavoriteButtonProps = {
  listingId: string
  size?: number
}

/** Heart overlay — top-right of listing image. */
export function FavoriteButton({ listingId, size = 18 }: FavoriteButtonProps) {
  const ui = useAppUi()
  const toast = useAppToast()
  const { isFavorite, toggleFavorite } = useFavorites()
  const { run, pending } = useAsyncAction()
  const saved = isFavorite(listingId)
  const [moveOpen, setMoveOpen] = useState(false)

  return (
    <>
      <XStack
        position="absolute"
        top="$2"
        right="$2"
        zIndex={2}
        width={44}
        height={44}
        borderRadius={999}
        backgroundColor={ui.deliveryBg}
        alignItems="center"
        justifyContent="center"
        cursor="pointer"
        animation="bouncy"
        hoverStyle={{ backgroundColor: ui.surface, scale: 1.06 }}
        pressStyle={{ scale: 0.88 }}
        opacity={pending ? 0.7 : 1}
        disabled={pending}
        onPress={(e: { stopPropagation?: () => void; preventDefault?: () => void }) => {
          e?.stopPropagation?.()
          e?.preventDefault?.()
          const wasSaved = saved
          void run(
            async () => {
              await toggleFavorite(listingId)
              return true
            },
            {
              haptic: wasSaved ? 'selection' : 'success',
              errorTitle: 'Could not update wishlist',
            },
          ).then((ok) => {
            if (!ok) return
            if (wasSaved) {
              toast.show('Removed from wishlist', {
                tone: 'default',
                duration: 5000,
                actionLabel: 'Undo',
                onAction: () => {
                  void toggleFavorite(listingId).then(() => {
                    void feedback('success')
                    toast.show('Saved to wishlist', { tone: 'success' })
                  })
                },
              })
            } else {
              toast.show('Saved to wishlist', {
                tone: 'success',
                duration: 6000,
                actionLabel: 'Save to…',
                onAction: () => setMoveOpen(true),
              })
            }
          })
        }}
        role="button"
        aria-label={saved ? 'Remove from wishlist' : 'Add to wishlist'}
        aria-pressed={saved}
        aria-disabled={pending}
        data-listing-id={listingId}
      >
        <Icons.Heart
          size={size}
          color={saved ? ui.brand : ui.text}
          fill={saved ? ui.brand : 'transparent'}
        />
      </XStack>
      {moveOpen ? (
        <WishlistMoveSheet
          open={moveOpen}
          listingId={listingId}
          onOpenChange={setMoveOpen}
        />
      ) : null}
    </>
  )
}
