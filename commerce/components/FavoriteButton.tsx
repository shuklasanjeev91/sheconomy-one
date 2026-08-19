import { useState } from 'react'
import { useRouter } from 'one'

import { WishlistMoveSheet } from '~/commerce/components/WishlistMoveSheet'
import { subscribeStockAlert } from '~/commerce/lib/stock-alerts'
import { Icons, XStack, useAppToast } from '~/components/ui'
import { useFavorites } from '~/commerce/hooks/useFavorites'
import { feedback } from '~/lib/platform/feedback'
import { appRoutes } from '~/lib/routes'
import { useAppUi } from '~/lib/theme/useAppUi'
import { useSupabase } from '~/providers/SupabaseProvider'
import { useAsyncAction } from '~/hooks/useAsyncAction'

type FavoriteButtonProps = {
  listingId: string
  size?: number
  restockEligible?: boolean
}

/** Heart overlay — top-right of listing image. */
export function FavoriteButton({ listingId, size = 18, restockEligible = false }: FavoriteButtonProps) {
  const ui = useAppUi()
  const toast = useAppToast()
  const router = useRouter()
  const { user } = useSupabase()
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
                actionLabel: restockEligible ? 'Notify me' : 'Save to…',
                onAction: () => {
                  if (!restockEligible) {
                    setMoveOpen(true)
                    return
                  }
                  if (!user?.id) {
                    toast.show('Sign in to get alerts', {
                      tone: 'default',
                      message: 'We will notify you when this item is back in stock.',
                    })
                    router.push(appRoutes.signIn)
                    return
                  }
                  void subscribeStockAlert(listingId, user.id).then(({ error }) => {
                    if (error) {
                      toast.show('Could not set alert', { tone: 'danger', message: error })
                      return
                    }
                    toast.show('Restock alert added', {
                      tone: 'success',
                      message: 'We will let you know when this item is available again.',
                    })
                  })
                },
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
