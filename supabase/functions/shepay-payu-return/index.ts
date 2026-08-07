import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'

import { resolvePublicAppOrigin } from '../_shared/app-url.ts'
import { corsHeaders } from '../_shared/cors.ts'

/**
 * PayU posts form data to surl/furl (HTTP POST).
 * SPA `/orders/payu-return` is GET-only → 405 without this bridge.
 *
 * On failure/cancel: restore the cart server-side (checkout clears cart at place-order).
 * Do not rely on browser localStorage — return often lands on a different origin/session.
 */
function destination(request: Request, extra: Record<string, string> = {}): string {
  const url = new URL(request.url)
  const status = url.searchParams.get('status')?.toLowerCase() === 'success' ? 'success' : 'failure'
  const embed = url.searchParams.get('embed')
  const cg = url.searchParams.get('cg') ?? extra.cg ?? ''
  const appBase = resolvePublicAppOrigin()
  const dest = new URL('/orders/payu-return', appBase)
  dest.searchParams.set('status', status)
  if (embed === '1' || embed?.toLowerCase() === 'true') {
    dest.searchParams.set('embed', '1')
  }
  if (cg) dest.searchParams.set('cg', cg)
  return dest.toString()
}

async function cancelAndRestoreCart(checkoutGroupId: string): Promise<void> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !serviceRole || !checkoutGroupId) return

  const admin = createClient(supabaseUrl, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data: group } = await admin
    .from('commerce_checkout_groups')
    .select('id, status, cart_id, order_ids, buyer_id')
    .eq('id', checkoutGroupId)
    .maybeSingle()

  if (!group || group.status === 'paid' || group.status === 'cancelled') return

  const orderIds = (group.order_ids as string[] | null) ?? []
  const cartId = group.cart_id as string | null

  // Release reserved inventory
  const { data: reservations } = await admin
    .from('inventory_reservations')
    .select('id, listing_id, variation_id, quantity')
    .eq('checkout_group_id', checkoutGroupId)
    .eq('status', 'reserved')

  for (const r of reservations ?? []) {
    if (r.listing_id && r.quantity != null) {
      const { data: listing } = await admin
        .from('listings')
        .select('quantity')
        .eq('id', r.listing_id)
        .maybeSingle()
      if (listing?.quantity != null) {
        await admin
          .from('listings')
          .update({ quantity: Number(listing.quantity) + Number(r.quantity) })
          .eq('id', r.listing_id)
      }
    }
    if (r.variation_id && r.quantity != null) {
      const { data: variation } = await admin
        .from('listing_variations')
        .select('stock')
        .eq('id', r.variation_id)
        .maybeSingle()
      if (variation?.stock != null) {
        await admin
          .from('listing_variations')
          .update({ stock: Number(variation.stock) + Number(r.quantity) })
          .eq('id', r.variation_id)
      }
    }
  }

  await admin
    .from('inventory_reservations')
    .update({ status: 'released', released_at: new Date().toISOString() })
    .eq('checkout_group_id', checkoutGroupId)
    .eq('status', 'reserved')

  if (orderIds.length) {
    await admin
      .from('order_items')
      .update({ item_status: 'cancelled', updated_at: new Date().toISOString() })
      .in('order_id', orderIds)
      .in('item_status', ['pending', 'awaiting_payment'])

    await admin
      .from('orders')
      .update({ order_status: 'cancelled', updated_at: new Date().toISOString() })
      .in('id', orderIds)
      .in('order_status', ['pending', 'awaiting_payment'])

    await admin
      .from('order_payments')
      .update({ payment_status: 'cancelled', updated_at: new Date().toISOString() })
      .in('order_id', orderIds)
      .in('payment_status', ['pending', 'processing'])
  }

  // Restore cart items from order lines (checkout deletes cart at place-order).
  if (cartId && orderIds.length) {
    const { data: items } = await admin
      .from('order_items')
      .select('listing_id, quantity, unit_price, product_title, vendor_id, variation_details')
      .in('order_id', orderIds)

    const shopIds = [
      ...new Set((items ?? []).map((i) => i.vendor_id).filter(Boolean)),
    ] as string[]
    const shopNameById = new Map<string, string>()
    if (shopIds.length) {
      const { data: shops } = await admin.from('shops').select('id, shop_name').in('id', shopIds)
      for (const s of shops ?? []) {
        if (s.id) shopNameById.set(s.id, s.shop_name ?? '')
      }
    }

    for (const oi of items ?? []) {
      if (!oi.listing_id) continue
      const details = (oi.variation_details ?? {}) as Record<string, unknown>
      const variantRaw = details.variant_id != null ? String(details.variant_id) : ''
      const variantId = variantRaw && variantRaw !== 'null' ? variantRaw : null

      let existsQuery = admin
        .from('cart_items')
        .select('id')
        .eq('cart_id', cartId)
        .eq('listing_id', oi.listing_id)
        .limit(1)
      if (variantId) existsQuery = existsQuery.eq('variant_id', variantId)
      else existsQuery = existsQuery.is('variant_id', null)

      const { data: existing } = await existsQuery.maybeSingle()
      if (existing) continue

      await admin.from('cart_items').insert({
        cart_id: cartId,
        listing_id: oi.listing_id,
        variant_id: variantId,
        quantity: oi.quantity,
        unit_price: oi.unit_price,
        total_price: Number(oi.unit_price ?? 0) * Number(oi.quantity ?? 0),
        title: oi.product_title,
        image_url: null,
        shop_name: oi.vendor_id ? shopNameById.get(oi.vendor_id) ?? null : null,
        shop_id: oi.vendor_id,
        variant_name: details.variant_name != null ? String(details.variant_name) : null,
        variant_value: details.variant_value != null ? String(details.variant_value) : null,
        item_metadata: { restored_from_checkout_group: checkoutGroupId },
      })
    }
  }

  await admin
    .from('commerce_checkout_payment_steps')
    .update({ status: 'cancelled', updated_at: new Date().toISOString() })
    .eq('checkout_group_id', checkoutGroupId)
    .neq('status', 'paid')

  await admin
    .from('commerce_checkout_groups')
    .update({
      status: 'cancelled',
      cancelled_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', checkoutGroupId)
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const url = new URL(request.url)
  const statusParam = url.searchParams.get('status')?.toLowerCase()
  const cg = url.searchParams.get('cg')?.trim() || ''

  if (request.method === 'POST') {
    try {
      await request.arrayBuffer()
    } catch {
      // ignore
    }
  } else if (request.method !== 'GET' && request.method !== 'HEAD') {
    return new Response('Method Not Allowed', { status: 405, headers: corsHeaders })
  }

  const ok = statusParam === 'success'
  if (!ok && cg) {
    try {
      await cancelAndRestoreCart(cg)
    } catch (err) {
      console.error('shepay-payu-return cancel/restore failed', err)
    }
  }

  return new Response(null, {
    status: 303,
    headers: {
      ...corsHeaders,
      Location: destination(request, { cg }),
      'Cache-Control': 'no-store',
    },
  })
})
