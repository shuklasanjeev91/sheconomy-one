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
  removeCartItem,
  updateCartItemQuantity,
  type CartItemRow,
  type CartRow,
  type CartWithItems,
} from '~/commerce/lib/cart'
import { useSupabase } from '~/providers/SupabaseProvider'

type CartContextValue = {
  cart: CartRow | null
  items: CartItemRow[]
  itemCount: number
  isLoading: boolean
  error: string | null
  refresh: () => Promise<void>
  addToCart: (listingId: string, options?: { quantity?: number; variantId?: string | null }) => Promise<{
    error: string | null
  }>
  updateQuantity: (cartItemId: string, quantity: number) => Promise<{ error: string | null }>
  removeItem: (cartItemId: string) => Promise<{ error: string | null }>
}

const CartContext = createContext<CartContextValue | null>(null)

export function CartProvider({ children }: { children: ReactNode }) {
  const { user, isLoading: authLoading } = useSupabase()
  const [cartData, setCartData] = useState<CartWithItems | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const mergedRef = useRef(false)

  const loadCart = useCallback(async () => {
    if (authLoading) return

    setIsLoading(true)
    setError(null)

    try {
      const sessionId = user ? null : await getCartSessionId()
      const { cart, error: cartError } = await getOrCreateCart({
        userId: user?.id,
        sessionId,
      })

      if (cartError || !cart) {
        setCartData(null)
        setError(cartError ?? 'Could not load cart')
        setIsLoading(false)
        return
      }

      const { data, error: itemsError } = await fetchCartWithItems(cart.id)
      if (itemsError || !data) {
        setCartData(null)
        setError(itemsError ?? 'Could not load cart items')
      } else {
        setCartData(data)
      }
    } catch {
      setError('Could not load cart')
      setCartData(null)
    } finally {
      setIsLoading(false)
    }
  }, [authLoading, user])

  useEffect(() => {
    void loadCart()
  }, [loadCart])

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
  }, [user, loadCart])

  const addToCart = useCallback(
    async (
      listingId: string,
      options?: { quantity?: number; variantId?: string | null },
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
      })

      if (addError) {
        return { error: addError }
      }

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

  const value = useMemo<CartContextValue>(
    () => ({
      cart: cartData?.cart ?? null,
      items: cartData?.items ?? [],
      itemCount: cartData?.items.reduce((sum, item) => sum + item.quantity, 0) ?? 0,
      isLoading,
      error,
      refresh: loadCart,
      addToCart,
      updateQuantity,
      removeItem,
    }),
    [addToCart, cartData, error, isLoading, loadCart, removeItem, updateQuantity],
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