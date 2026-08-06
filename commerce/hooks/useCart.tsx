import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'

import {
  addListingToCart,
  fetchCartWithItems,
  getCartSessionId,
  getOrCreateCart,
  mergeGuestCartWithUser,
  moveSavedCartItemToCart,
  removeCartDiscount,
  removeCartItem,
  saveCartItemForLater,
  updateCartItemQuantity,
  type CartItemRow,
  type CartRow,
  type CartWithItems,
} from '~/commerce/lib/cart'
import {
  applyCouponCode,
  autoApplyBestOffer,
  reconcileCartDiscount,
  toCartOfferItems,
} from '~/commerce/lib/discounts'
import { filterSelectedCartItems, useCartSelectionRevision } from '~/commerce/lib/cart-selection'
import { trackCommerceEvent } from '~/lib/analytics'
import type { Json } from '~/lib/supabase'
import { supabase } from '~/lib/supabase/client'
import { useSupabase } from '~/providers/SupabaseProvider'

type CartContextValue = {
  cart: CartRow | null
  items: CartItemRow[]
  savedItems: CartItemRow[]
  itemCount: number
  isLoading: boolean
  error: string | null
  refresh: () => Promise<void>
  addToCart: (
    listingId: string,
    options?: { quantity?: number; variantId?: string | null; personalizationNote?: string | null },
  ) => Promise<{
    error: string | null
  }>
  updateQuantity: (cartItemId: string, quantity: number) => Promise<{ error: string | null }>
  removeItem: (cartItemId: string) => Promise<{ error: string | null }>
  saveForLater: (cartItemId: string) => Promise<{ error: string | null }>
  moveToCart: (cartItemId: string) => Promise<{ error: string | null }>
  removeSavedItem: (cartItemId: string) => Promise<{ error: string | null }>
  applyCoupon: (code: string) => Promise<{ error: string | null }>
  removeCoupon: () => Promise<{ error: string | null }>
  /** True when the current discount was auto-applied as the best available offer. */
  couponAutoApplied: boolean
}

const CartContext = createContext<CartContextValue | null>(null)

function readCartMetadata(cart: CartRow | null | undefined): Record<string, unknown> {
  const raw = cart?.cart_metadata
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    return { ...(raw as Record<string, unknown>) }
  }
  return {}
}

function readAutoAppliedDiscountId(cart: CartRow | null | undefined): string | null {
  const meta = readCartMetadata(cart)
  const id = meta.auto_applied_discount_id
  return typeof id === 'string' && id.length > 0 ? id : null
}

async function persistAutoAppliedDiscountId(
  cartId: string,
  cart: CartRow,
  discountId: string | null,
): Promise<void> {
  const meta = readCartMetadata(cart)
  if (discountId) meta.auto_applied_discount_id = discountId
  else delete meta.auto_applied_discount_id

  await supabase
    .from('carts')
    .update({
      cart_metadata: meta as Json,
      updated_at: new Date().toISOString(),
    })
    .eq('id', cartId)
}

export function CartProvider({ children }: { children: ReactNode }) {
  const { user, isLoading: authLoading } = useSupabase()
  const [cartData, setCartData] = useState<CartWithItems | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [autoApplied, setAutoApplied] = useState(false)
  const mergedRef = useRef(false)
  // Stop auto-applying until the shopper applies a code or the cart subtotal changes.
  const couponOptOutRef = useRef(false)
  const optOutSubtotalRef = useRef<number | null>(null)

  const tryAutoApply = useCallback(async (data: CartWithItems): Promise<CartWithItems> => {
    if (couponOptOutRef.current) {
      if (
        optOutSubtotalRef.current != null &&
        Math.abs(data.cart.items_subtotal - optOutSubtotalRef.current) >= 0.01
      ) {
        couponOptOutRef.current = false
        optOutSubtotalRef.current = null
      } else {
        return data
      }
    }
    if (data.cart.applied_discount_id || data.cart.items_subtotal <= 0) return data

    const selectedItems = filterSelectedCartItems(data.items)
    const selectedSubtotal = selectedItems.reduce(
      (sum, item) => sum + item.unit_price * item.quantity,
      0,
    )
    if (selectedSubtotal <= 0) return data

    const shopIds = [
      ...new Set(selectedItems.map((item) => item.shop_id).filter((id): id is string => !!id)),
    ]
    const listingIds = selectedItems.map((item) => item.listing_id)
    const result = await autoApplyBestOffer({
      cartId: data.cart.id,
      subtotal: selectedSubtotal,
      shopIds,
      listingIds,
      items: toCartOfferItems(selectedItems),
    })
    if (!result.applied || !result.offer) return data

    await persistAutoAppliedDiscountId(data.cart.id, data.cart, result.offer.id)
    setAutoApplied(true)
    const fresh = await fetchCartWithItems(data.cart.id)
    return fresh.data ?? data
  }, [])

  const userId = user?.id ?? null
  const hasCartItemsRef = useRef(false)
  hasCartItemsRef.current = (cartData?.items.length ?? 0) + (cartData?.savedItems?.length ?? 0) > 0

  const loadCart = useCallback(async () => {
    if (authLoading) {
      // Keep initial spinner only until auth resolves; never leave loading stuck after soft refresh.
      return
    }

    // Soft refresh when cart is already on screen — avoids checkout full-page remounts
    // when auth session identity churns but user.id is unchanged.
    const soft = hasCartItemsRef.current
    if (!soft) setIsLoading(true)
    setError(null)

    try {
      const sessionId = userId ? null : await getCartSessionId()
      const { cart, error: cartError } = await getOrCreateCart({
        userId: userId ?? undefined,
        sessionId,
      })

      if (cartError || !cart) {
        setCartData(null)
        setError(cartError ?? 'Could not load cart')
        return
      }

      if (cart.status === 'abandoned') {
        await supabase
          .from('carts')
          .update({ status: 'active', last_activity_at: new Date().toISOString() })
          .eq('id', cart.id)
      }

      const { data, error: itemsError } = await fetchCartWithItems(cart.id)
      if (itemsError || !data) {
        setCartData(null)
        setError(itemsError ?? 'Could not load cart items')
        return
      }

      let next = data

      if (next.cart.applied_discount_id) {
        const selectedItems = filterSelectedCartItems(next.items)
        const changed = await reconcileCartDiscount(
          next.cart,
          toCartOfferItems(selectedItems),
        )
        if (changed) {
          const fresh = await fetchCartWithItems(cart.id)
          next = fresh.data ?? next
        }

        if (next.cart.applied_discount_id) {
          const autoId = readAutoAppliedDiscountId(next.cart)
          setAutoApplied(autoId === next.cart.applied_discount_id)
        } else {
          // Discount dropped by reconcile — try best offer again unless opted out.
          next = await tryAutoApply(next)
          if (!next.cart.applied_discount_id) setAutoApplied(false)
        }
      } else {
        next = await tryAutoApply(next)
        if (!next.cart.applied_discount_id) setAutoApplied(false)
      }

      setCartData(next)
    } catch {
      setError('Could not load cart')
      setCartData(null)
    } finally {
      setIsLoading(false)
    }
  }, [authLoading, tryAutoApply, userId])

  useEffect(() => {
    if (authLoading) return
    void loadCart()
  }, [authLoading, loadCart])

  const selectionRevision = useCartSelectionRevision()

  useEffect(() => {
    const cart = cartData?.cart
    if (!cart?.applied_discount_id || !cartData?.items.length) return

    let cancelled = false
    ;(async () => {
      const selectedItems = filterSelectedCartItems(cartData.items)
      const changed = await reconcileCartDiscount(cart, toCartOfferItems(selectedItems))
      if (cancelled || !changed) return

      const fresh = await fetchCartWithItems(cart.id)
      if (cancelled || !fresh.data) return

      let next = fresh.data
      if (!next.cart.applied_discount_id) {
        next = await tryAutoApply(next)
      }

      setCartData(next)
      if (!next.cart.applied_discount_id) {
        setAutoApplied(false)
      } else {
        const autoId = readAutoAppliedDiscountId(next.cart)
        setAutoApplied(autoId === next.cart.applied_discount_id)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [selectionRevision, cartData?.cart?.applied_discount_id, cartData?.items, tryAutoApply])

  useEffect(() => {
    if (!user || mergedRef.current) return

    let active = true
    ;(async () => {
      const sessionId = await getCartSessionId()
      const { error: mergeError } = await mergeGuestCartWithUser({
        sessionId,
        userId: user.id,
      })
      if (!active) return
      mergedRef.current = true
      if (!mergeError) {
        await loadCart()
      }
    })()

    return () => {
      active = false
    }
  }, [user?.id, loadCart])

  const addToCart = useCallback(
    async (
      listingId: string,
      options?: { quantity?: number; variantId?: string | null; personalizationNote?: string | null },
    ) => {
      let cartId = cartData?.cart.id

      if (!cartId) {
        const sessionId = user ? null : await getCartSessionId()
        const { cart, error: cartError } = await getOrCreateCart({
          userId: user?.id,
          sessionId,
        })
        if (cartError || !cart) {
          return { error: cartError ?? 'Could not create cart' }
        }
        cartId = cart.id
      }

      const { error: addError } = await addListingToCart({
        cartId,
        listingId,
        quantity: options?.quantity,
        variantId: options?.variantId,
        personalizationNote: options?.personalizationNote,
      })

      if (addError) {
        return { error: addError }
      }

      trackCommerceEvent('add_to_cart', {
        currency: 'INR',
        items: [
          {
            id: listingId,
            name: listingId,
            quantity: options?.quantity ?? 1,
          },
        ],
      })

      await loadCart()
      return { error: null }
    },
    [cartData?.cart.id, loadCart, user],
  )

  const updateQuantity = useCallback(
    async (cartItemId: string, quantity: number) => {
      if (!cartData?.cart.id) return { error: 'Cart not found' }
      const { error: updateError } = await updateCartItemQuantity(
        cartData.cart.id,
        cartItemId,
        quantity,
      )
      if (!updateError) await loadCart()
      return { error: updateError }
    },
    [cartData?.cart.id, loadCart],
  )

  const removeItem = useCallback(
    async (cartItemId: string) => {
      if (!cartData?.cart.id) return { error: 'Cart not found' }
      const { error: removeError } = await removeCartItem(cartData.cart.id, cartItemId)
      if (!removeError) await loadCart()
      return { error: removeError }
    },
    [cartData?.cart.id, loadCart],
  )

  const saveForLater = useCallback(
    async (cartItemId: string) => {
      if (!cartData?.cart.id) return { error: 'Cart not found' }
      const { error: saveError } = await saveCartItemForLater(cartData.cart.id, cartItemId)
      if (!saveError) await loadCart()
      return { error: saveError }
    },
    [cartData?.cart.id, loadCart],
  )

  const moveToCart = useCallback(
    async (cartItemId: string) => {
      if (!cartData?.cart.id) return { error: 'Cart not found' }
      const { error: moveError } = await moveSavedCartItemToCart(cartData.cart.id, cartItemId)
      if (!moveError) await loadCart()
      return { error: moveError }
    },
    [cartData?.cart.id, loadCart],
  )

  const removeSavedItem = useCallback(
    async (cartItemId: string) => {
      if (!cartData?.cart.id) return { error: 'Cart not found' }
      const { error: removeError } = await removeCartItem(cartData.cart.id, cartItemId)
      if (!removeError) await loadCart()
      return { error: removeError }
    },
    [cartData?.cart.id, loadCart],
  )

  const applyCoupon = useCallback(
    async (code: string) => {
      const cart = cartData?.cart
      if (!cart) return { error: 'Cart not found' }
      const selectedItems = filterSelectedCartItems(cartData?.items ?? [])
      const selectedSubtotal = selectedItems.reduce(
        (sum, item) => sum + item.unit_price * item.quantity,
        0,
      )
      const { error: couponError } = await applyCouponCode({
        cartId: cart.id,
        code,
        subtotal: selectedSubtotal,
        currency: cart.currency ?? 'INR',
        items: toCartOfferItems(selectedItems),
      })
      if (!couponError) {
        couponOptOutRef.current = false
        optOutSubtotalRef.current = null
        setAutoApplied(false)
        await persistAutoAppliedDiscountId(cart.id, cart, null)
        await loadCart()
      }
      return { error: couponError }
    },
    [cartData?.cart, cartData?.items, loadCart],
  )

  const removeCoupon = useCallback(async () => {
    const cart = cartData?.cart
    if (!cart) return { error: 'Cart not found' }
    couponOptOutRef.current = true
    optOutSubtotalRef.current = cart.items_subtotal
    setAutoApplied(false)
    await persistAutoAppliedDiscountId(cart.id, cart, null)
    const { error: removeError } = await removeCartDiscount(cart.id)
    if (!removeError) await loadCart()
    return { error: removeError }
  }, [cartData?.cart, loadCart])

  const value = useMemo<CartContextValue>(
    () => ({
      cart: cartData?.cart ?? null,
      items: cartData?.items ?? [],
      savedItems: cartData?.savedItems ?? [],
      itemCount: cartData?.items.reduce((sum, item) => sum + item.quantity, 0) ?? 0,
      isLoading,
      error,
      refresh: loadCart,
      addToCart,
      updateQuantity,
      removeItem,
      saveForLater,
      moveToCart,
      removeSavedItem,
      applyCoupon,
      removeCoupon,
      couponAutoApplied: autoApplied && !!cartData?.cart.applied_discount_id,
    }),
    [
      addToCart,
      applyCoupon,
      autoApplied,
      cartData,
      error,
      isLoading,
      loadCart,
      moveToCart,
      removeCoupon,
      removeItem,
      removeSavedItem,
      saveForLater,
      updateQuantity,
    ],
  )

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}

export function useCart() {
  const context = useContext(CartContext)
  if (!context) {
    throw new Error('useCart must be used within CartProvider')
  }
  return context
}
