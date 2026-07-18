import type { Tables } from '~/lib/supabase'

type CartItemRow = Tables<'cart_items'>

/** Split cart lines into active checkout lines vs saved-for-later shelf. */
export function splitCartItems(rows: CartItemRow[]): {
  items: CartItemRow[]
  savedItems: CartItemRow[]
} {
  const items: CartItemRow[] = []
  const savedItems: CartItemRow[] = []
  for (const row of rows) {
    if (row.saved_for_later) savedItems.push(row)
    else items.push(row)
  }
  return { items, savedItems }
}
