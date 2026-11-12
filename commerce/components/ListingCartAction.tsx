import { useState } from 'react'

import { Button, Icons, Spinner, Text, useAppToast } from '~/components/ui'
import { ListingQuantityStepper } from '~/commerce/components/ListingQuantityStepper'
import { useCart } from '~/commerce/hooks/useCart'
import { findCartItemForListing } from '~/commerce/lib/cart-listing'
import { useAppUi } from '~/lib/theme/useAppUi'

type ListingCartActionProps = {
  listingId: string
  variantId?: string | null
  maxQuantity?: number | null
  /** Disable add when out of stock / locked. */
  disabled?: boolean
  /** Compact card CTA vs buy-box sized control. */
  size?: 'sm' | 'md' | 'lg'
  addLabel?: string
  /** When add needs options on PDP — return an error message to surface. */
  onAdd?: () => Promise<{ error: string | null }>
}

/**
 * Shared commerce CTA: “Add to cart” until the line exists, then a full-width
 * quantity stepper (hide add). Used on cards, rails, and any non-custom buy box.
 */
export function ListingCartAction({
  listingId,
  variantId = null,
  maxQuantity,
  disabled = false,
  size = 'md',
  addLabel = 'Add to cart',
  onAdd,
}: ListingCartActionProps) {
  const ui = useAppUi()
  const toast = useAppToast()
  const { items, addToCart, updateQuantity, removeItem } = useCart()
  const cartItem = findCartItemForListing(items, listingId, variantId)
  const [pending, setPending] = useState(false)
  const [updating, setUpdating] = useState(false)

  async function handleAdd() {
    if (disabled || pending) return
    setPending(true)
    try {
      const result = onAdd
        ? await onAdd()
        : await addToCart(listingId, { quantity: 1, variantId })
      if (result.error) {
        // Custom `onAdd` handlers surface their own messaging (e.g. choose options).
        if (!onAdd) {
          toast.show('Could not add to cart', { tone: 'danger', message: result.error })
        }
        return
      }
      toast.show('Added to cart', { tone: 'success' })
    } finally {
      setPending(false)
    }
  }

  async function handleQuantityChange(nextQuantity: number) {
    if (!cartItem || updating) return
    setUpdating(true)
    try {
      const { error } =
        nextQuantity <= 0
          ? await removeItem(cartItem.id)
          : await updateQuantity(cartItem.id, nextQuantity)
      if (error) {
        toast.show('Could not update quantity', { tone: 'danger', message: error })
      }
    } finally {
      setUpdating(false)
    }
  }

  if (cartItem) {
    return (
      <ListingQuantityStepper
        fullWidth
        size={size === 'sm' ? 'sm' : size === 'lg' ? 'lg' : 'md'}
        quantity={cartItem.quantity}
        maxQuantity={maxQuantity}
        disabled={updating || disabled}
        onDecrease={() => void handleQuantityChange(cartItem.quantity - 1)}
        onIncrease={() => void handleQuantityChange(cartItem.quantity + 1)}
      />
    )
  }

  return (
    <Button
      size={size === 'sm' ? '$2.5' : size === 'lg' ? '$4' : '$3'}
      tone="outline"
      borderRadius={8}
      width="100%"
      minHeight={size === 'sm' ? 40 : 44}
      disabled={disabled || pending}
      accessibilityLabel={addLabel}
      icon={
        pending ? (
          <Spinner size="small" color={ui.brand} />
        ) : (
          <Icons.ShoppingCart size={size === 'sm' ? 14 : 16} />
        )
      }
      onPress={() => void handleAdd()}
    >
      <Text fontWeight="700">{pending ? 'Adding…' : addLabel}</Text>
    </Button>
  )
}
