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
  addBundleToCart as addBundleToCartRpc,
  addListingToCart,
  fetchCartWithItems,
  getCartSessionId,
  getOrCreateCart,
  getRememberedGuestCartId,
  mergeGuestCartWithUser,
  moveSavedCartItemToCart,
  rememberGuestCartId,
  removeCartDiscount,
  removeCartItem,
  saveCartItemForLater,
  updateCartItemQuantity,
  type CartItemRow,
  type CartRow,
  type CartWithItems,
} from '~/commerce/lib/cart'
import { fetchCartBundle, resolveCartActor } from '~/commerce/lib/cart-rpc-fetch'
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
  addBundleToCart: (bundleId: string, quantity?: number) => Promise<{ error: string | null }>
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

/** Prevent Add to Cart / cart refresh from hanging forever on a stuck network call. */
const CART_OPERATION_TIMEOUT_MS = 12_000

function withCartTimeout<T>(promise: Promise<T>, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`${label} timed out. Check your connection and try again.`))
    }, CART_OPERATION_TIMEOUT_MS)
    promise.then(
      (value) => {
        clearTimeout(timer)
        resolve(value)
      },
      (error) => {
        clearTimeout(timer)
        reject(error)
      },
    )
  })
}

/** Run the full Add-to-Cart path under one deadline (session + create + add). */
async function runCartMutation<T>(label: string, work: () => Promise<T>): Promise<T> {
  return withCartTimeout(work(), label)
}

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
  const mergedSessionRef = useRef<string | null>(null)
  const mergeInflightRef = useRef<Promise<void> | null>(null)
  // Stop auto-applying until the shopper applies a code or the cart subtotal changes.
  const couponOptOutRef = useRef(false)
  const optOutSubtotalRef = useRef<number | null>(null)
  const hasCartItemsRef = useRef(false)
  hasCartItemsRef.current = (cartData?.items.length ?? 0) + (cartData?.savedItems?.length ?? 0) > 0

  /**
   * Never replace a cart that still has lines with a different empty cart.
   * That race is what empties the UI during guest add → loadCart and guest → sign-in.
   */
  const commitCartData = useCallback((next: CartWithItems | null) => {
    setCartData((prev) => {
      if (!next) {
        if (hasCartItemsRef.current) return prev
        return null
      }
      const prevCount = (prev?.items.length ?? 0) + (prev?.savedItems.length ?? 0)
      const nextCount = next.items.length + next.savedItems.length
      if (prevCount > 0 && nextCount === 0 && prev && prev.cart.id !== next.cart.id) {
        return prev
      }
      return next
    })
  }, [])

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
      // Guest → sign-in: merge session cart into the user cart BEFORE loading,
      // otherwise we paint an empty user cart and checkout redirects away.
      if (userId) {
        const sessionId = await getCartSessionId()
        if (mergedSessionRef.current !== sessionId) {
          if (!mergeInflightRef.current) {
            mergeInflightRef.current = withCartTimeout(
              mergeGuestCartWithUser({ sessionId, userId }),
              'Merging guest cart',
            )
              .then(() => {
                mergedSessionRef.current = sessionId
                return rememberGuestCartId(null)
              })
              .catch((error) => {
                console.warn(
                  '[cart] merge failed',
                  error instanceof Error ? error.message : error,
                )
                // Still mark attempted so we don't loop forever on hard failures.
                mergedSessionRef.current = sessionId
              })
              .finally(() => {
                mergeInflightRef.current = null
              })
          }
          await mergeInflightRef.current
        }
      }

      const actor = await resolveCartActor(userId)
      let { cart, error: cartError } = await withCartTimeout(
        getOrCreateCart({
          userId: actor.userId,
          sessionId: actor.sessionId,
        }),
        'Loading cart',
      )

      // Recover guest lines if session id drifted but we still remember the cart row.
      if (actor.asGuest && cart?.id) {
        const rememberedId = await getRememberedGuestCartId()
        if (rememberedId && rememberedId !== cart.id) {
          const remembered = await fetchCartBundle(rememberedId, true).catch(() => null)
          const rememberedCount =
            (remembered?.data?.items.length ?? 0) + (remembered?.data?.savedItems.length ?? 0)
          if (rememberedCount > 0 && remembered?.data?.cart) {
            cart = remembered.data.cart
            cartError = null
          }
        }
      }

      if (cartError || !cart) {
        setError(cartError ?? 'Could not load cart')
        // Never wipe an on-screen cart on a transient load failure (guest JWT 401s).
        if (!soft) commitCartData(null)
        return
      }

      if (actor.asGuest) {
        void rememberGuestCartId(cart.id)
      }

      if (cart.status === 'abandoned') {
        await withCartTimeout(
          supabase
            .from('carts')
            .update({ status: 'active', last_activity_at: new Date().toISOString() })
            .eq('id', cart.id)
            .then(() => undefined),
          'Reactivating cart',
        ).catch(() => undefined)
      }

      const asGuest = actor.asGuest
      const bundle = await withCartTimeout(
        asGuest
          ? fetchCartBundle(cart.id, true)
          : fetchCartWithItems(cart.id).then((result) => ({
              data: result.data
                ? {
                    cart: result.data.cart,
                    items: result.data.items,
                    savedItems: result.data.savedItems,
                  }
                : null,
              error: result.error,
            })),
        'Loading cart items',
      )
      if (bundle.error || !bundle.data) {
        setError(bundle.error ?? 'Could not load cart items')
        if (!soft) commitCartData(null)
        return
      }

      let next: CartWithItems = bundle.data

      // Discount reconcile is best-effort — never block cart paint / checkout.
      try {
        if (next.cart.applied_discount_id) {
          const selectedItems = filterSelectedCartItems(next.items)
          const changed = await withCartTimeout(
            reconcileCartDiscount(next.cart, toCartOfferItems(selectedItems)),
            'Reconciling cart discount',
          )
          if (changed) {
            const fresh = await withCartTimeout(
              asGuest ? fetchCartBundle(cart.id, true) : fetchCartWithItems(cart.id),
              'Refreshing cart',
            )
            if (fresh.data) next = fresh.data
          }

          if (next.cart.applied_discount_id) {
            const autoId = readAutoAppliedDiscountId(next.cart)
            setAutoApplied(autoId === next.cart.applied_discount_id)
          } else {
            next = await withCartTimeout(tryAutoApply(next), 'Applying cart offer')
            if (!next.cart.applied_discount_id) setAutoApplied(false)
          }
        } else {
          next = await withCartTimeout(tryAutoApply(next), 'Applying cart offer')
          if (!next.cart.applied_discount_id) setAutoApplied(false)
        }
      } catch {
        // Show cart without offers rather than spinning forever.
      }

      commitCartData(next)
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Could not load cart')
      if (!hasCartItemsRef.current) commitCartData(null)
    } finally {
      setIsLoading(false)
    }
  }, [authLoading, commitCartData, tryAutoApply, userId])

  useEffect(() => {
    if (authLoading) return
    void loadCart()
  }, [authLoading, loadCart])

  // Never leave the cart provider stuck on the initial spinner (App Store 2.1).
  useEffect(() => {
    if (!isLoading) return
    const timer = setTimeout(() => setIsLoading(false), 15_000)
    return () => clearTimeout(timer)
  }, [isLoading])

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

      commitCartData(next)
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
  }, [selectionRevision, cartData?.cart?.applied_discount_id, cartData?.items, commitCartData, tryAutoApply])

  // Reset merge marker when the shopper signs out so the next guest session can merge again.
  useEffect(() => {
    if (!userId) mergedSessionRef.current = null
  }, [userId])

  const addToCart = useCallback(
    async (
      listingId: string,
      options?: { quantity?: number; variantId?: string | null; personalizationNote?: string | null },
    ) => {
      try {
        // Always resolve the cart for the *current* identity first.
        // Reusing a stale cartData.id (guest cart after sign-in, or vice versa) makes
        // add succeed via SECURITY DEFINER while loadCart refreshes an empty cart —
        // UI looks like Add to Cart did nothing.
        return await runCartMutation('Adding to cart', async () => {
          // Stale in-memory `user` without a usable JWT must use a guest session cart.
          const actor = await resolveCartActor(userId)
          const { cart, error: cartError } = await getOrCreateCart({
            userId: actor.userId,
            sessionId: actor.sessionId,
          })
          if (cartError || !cart?.id) {
            return { error: cartError ?? 'Could not create cart' }
          }

          if (actor.asGuest) {
            void rememberGuestCartId(cart.id)
          }

          const { item, error: addError } = await addListingToCart({
            cartId: cart.id,
            listingId,
            quantity: options?.quantity,
            variantId: options?.variantId,
            personalizationNote: options?.personalizationNote,
            asGuest: actor.asGuest,
          })

          if (addError) {
            return { error: addError }
          }

          // Optimistic UI — flip sticky bar to Checkout immediately.
          if (item) {
            setCartData((prev) => {
              const baseItems =
                prev?.cart.id === cart.id ? prev.items.filter((row) => row.id !== item.id) : []
              const baseSaved =
                prev?.cart.id === cart.id
                  ? prev.savedItems.filter((row) => row.id !== item.id)
                  : []
              const nextItems = [...baseItems, item]
              const itemsSubtotal = nextItems.reduce(
                (sum, row) => sum + (row.total_price ?? row.unit_price * row.quantity),
                0,
              )
              hasCartItemsRef.current = nextItems.length + baseSaved.length > 0
              return {
                cart: {
                  ...cart,
                  items_subtotal: itemsSubtotal,
                  total_amount: itemsSubtotal - (cart.discount_amount ?? 0),
                },
                items: nextItems,
                savedItems: baseSaved,
              }
            })
            setIsLoading(false)
            setError(null)
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

          // Soft refresh in background — commitCartData will not clobber non-empty → empty.
          void loadCart()
          return { error: null }
        })
      } catch (error) {
        return {
          error:
            error instanceof Error
              ? error.message
              : 'Could not add to cart. Please try again.',
        }
      }
    },
    [loadCart, userId],
  )

  const addBundleToCart = useCallback(
    async (bundleId: string, quantity = 1) => {
      try {
        return await runCartMutation('Adding bundle', async () => {
          const actor = await resolveCartActor(userId)
          const { cart, error: cartError } = await getOrCreateCart({
            userId: actor.userId,
            sessionId: actor.sessionId,
          })
          if (cartError || !cart?.id) {
            return { error: cartError ?? 'Could not create cart' }
          }
          const { error: addError } = await addBundleToCartRpc({
            cartId: cart.id,
            bundleId,
            quantity,
          })
          if (addError) return { error: addError }
          void loadCart()
          return { error: null }
        })
      } catch (error) {
        return {
          error: error instanceof Error ? error.message : 'Could not add bundle.',
        }
      }
    },
    [loadCart, userId],
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
      addBundleToCart,
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
      addBundleToCart,
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
