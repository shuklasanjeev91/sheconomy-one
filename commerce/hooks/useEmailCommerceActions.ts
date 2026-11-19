import { useEffect, useRef } from 'react'
import { useLocalSearchParams, useRouter } from 'one'

import { useCart } from '~/commerce/hooks/useCart'
import { useAppToast } from '~/components/ui'
import { navigateApp } from '~/lib/platform/navigate'
import { commerceRoutes } from '~/lib/routes'
import { supabase } from '~/lib/supabase/client'

type EmailOp = 'inc' | 'dec' | 'add' | 'buy' | 'set'

function firstParam(value: string | string[] | undefined | null): string | null {
  if (Array.isArray(value)) return value[0] ?? null
  return value ?? null
}

function readWebSearchParams(): URLSearchParams | null {
  if (typeof window === 'undefined') return null
  try {
    return new URL(window.location.href).searchParams
  } catch {
    return null
  }
}

function clearEmailParams() {
  if (typeof window === 'undefined') return
  try {
    const url = new URL(window.location.href)
    ;['email_op', 'item', 'listing', 'variant', 'qty'].forEach((key) => url.searchParams.delete(key))
    window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`)
  } catch {
    // ignore
  }
}

/**
 * Handles commerce deep links from transactional emails:
 *   /cart?email_op=inc&item=<cart_item_id>
 *   /cart?email_op=dec&item=<cart_item_id>
 *   /cart?email_op=set&item=<cart_item_id>&qty=3
 *   /cart?email_op=add&listing=<listing_id>&variant=<optional>&qty=1
 *   /listing/:slug?email_op=add|buy&listing=<id>&variant=&qty=
 *
 * Email clients cannot run JS; these links open the app/web and mutate the cart
 * for the signed-in shopper, then clear the query params.
 */
export function useEmailCommerceActions(options?: { listingId?: string | null }) {
  const toast = useAppToast()
  const router = useRouter()
  const routeParams = useLocalSearchParams<{
    email_op?: string | string[]
    item?: string | string[]
    listing?: string | string[]
    variant?: string | string[]
    qty?: string | string[]
  }>()
  const { items, isLoading, addToCart, updateQuantity, removeItem, refresh } = useCart()
  const handledRef = useRef<string | null>(null)

  useEffect(() => {
    if (isLoading) return

    const web = readWebSearchParams()
    const op = (
      firstParam(routeParams.email_op) ||
      firstParam(web?.get('email_op')) ||
      ''
    ).toLowerCase() as EmailOp | ''
    if (!op || !['inc', 'dec', 'add', 'buy', 'set'].includes(op)) return

    const itemId = firstParam(routeParams.item) || firstParam(web?.get('item'))
    const listingId =
      firstParam(routeParams.listing) ||
      firstParam(web?.get('listing')) ||
      options?.listingId ||
      null
    const variantId = firstParam(routeParams.variant) || firstParam(web?.get('variant'))
    const qtyRaw = firstParam(routeParams.qty) || firstParam(web?.get('qty'))
    const qty = qtyRaw ? Math.max(1, Number.parseInt(qtyRaw, 10) || 1) : 1
    const handleKey = `${op}:${itemId ?? ''}:${listingId ?? ''}:${variantId ?? ''}:${qty}`
    if (handledRef.current === handleKey) return
    handledRef.current = handleKey

    let cancelled = false

    ;(async () => {
      try {
        if (op === 'inc' || op === 'dec' || op === 'set') {
          if (!itemId) {
            toast.show('Could not update quantity', {
              tone: 'danger',
              message: 'Missing cart item from email link.',
            })
            return
          }
          // Restore abandoned carts first — email opens often hit an empty active cart.
          await refresh()
          if (cancelled) return

          let currentQty = items.find((row) => row.id === itemId)?.quantity ?? null
          if (currentQty == null) {
            const { data: row } = await supabase
              .from('cart_items')
              .select('id, quantity')
              .eq('id', itemId)
              .maybeSingle()
            currentQty = row?.quantity ?? null
          }
          if (currentQty == null) {
            toast.show('Item not in cart', {
              tone: 'danger',
              message: 'Sign in, then open your cart from the email again.',
            })
            return
          }
          const nextQty =
            op === 'set' ? qty : op === 'inc' ? currentQty + 1 : currentQty - 1
          const { error } =
            nextQty <= 0
              ? await removeItem(itemId)
              : await updateQuantity(itemId, nextQty)
          if (cancelled) return
          if (error) {
            toast.show('Could not update quantity', { tone: 'danger', message: error })
            return
          }
          toast.show(nextQty <= 0 ? 'Removed from cart' : 'Quantity updated', {
            tone: 'success',
            message: nextQty <= 0 ? undefined : `Qty is now ${nextQty}.`,
          })
          return
        }

        if (op === 'add' || op === 'buy') {
          if (!listingId) {
            toast.show('Could not add to cart', {
              tone: 'danger',
              message: 'Missing product from email link.',
            })
            return
          }
          const { error } = await addToCart(listingId, {
            quantity: qty,
            variantId: variantId || null,
          })
          if (cancelled) return
          if (error) {
            toast.show('Could not add to cart', { tone: 'danger', message: error })
            return
          }
          toast.show('Added to cart', { tone: 'success' })
          if (op === 'buy') {
            navigateApp(router, commerceRoutes.checkout)
          }
        }
      } finally {
        if (!cancelled) clearEmailParams()
      }
    })()

    return () => {
      cancelled = true
    }
  }, [
    addToCart,
    isLoading,
    items,
    options?.listingId,
    refresh,
    removeItem,
    routeParams.email_op,
    routeParams.item,
    routeParams.listing,
    routeParams.qty,
    routeParams.variant,
    router,
    toast,
    updateQuantity,
  ])
}
