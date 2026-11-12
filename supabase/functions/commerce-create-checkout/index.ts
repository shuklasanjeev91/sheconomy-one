import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'

import { corsHeaders, jsonResponse } from '../_shared/cors.ts'

type CreateCheckoutBody = {
  cart_id?: string
  cart_item_ids?: string[]
  shipping_address_id?: string
  billing_address_id?: string | null
  payment_mode?: 'online' | 'cod'
  idempotency_key?: string
  notes_by_shop?: Record<string, string>
  gift_shop_ids?: string[]
  customer_currency?: string | null
  customer_amounts_by_shop?: Record<string, unknown>
  /** Easyship DDP quote snapshot keyed by shop_id. */
  easyship_by_shop?: Record<string, unknown>
  /** Default true when payment_mode=online. Platform PayU single-shop pass false. */
  finalize_shepay?: boolean | null
}

type PaymentStepRow = {
  id: string
  order_id: string | null
  shop_id: string | null
  collection: string
  provider: string | null
  status: string
  amount: number
  checkout_url: string | null
  metadata?: Record<string, unknown> | null
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !anonKey || !serviceRole) {
    return jsonResponse({ error: 'Checkout is not configured' }, 503)
  }

  const authHeader = request.headers.get('Authorization')
  if (!authHeader) return jsonResponse({ error: 'Unauthorized' }, 401)

  let body: CreateCheckoutBody
  try {
    body = (await request.json()) as CreateCheckoutBody
  } catch {
    return jsonResponse({ error: 'Invalid JSON' }, 400)
  }

  const cartId = typeof body.cart_id === 'string' ? body.cart_id.trim() : ''
  const shippingAddressId =
    typeof body.shipping_address_id === 'string' ? body.shipping_address_id.trim() : ''
  const cartItemIds = Array.isArray(body.cart_item_ids)
    ? body.cart_item_ids.filter((id): id is string => typeof id === 'string' && id.length > 0)
    : []
  const idempotencyKey =
    typeof body.idempotency_key === 'string' ? body.idempotency_key.trim() : ''
  const paymentMode = body.payment_mode === 'cod' ? 'cod' : 'online'

  if (!cartId) return jsonResponse({ success: false, message: 'Cart is missing.' }, 400)
  if (!shippingAddressId) {
    return jsonResponse({ success: false, message: 'Select a delivery address before paying.' }, 400)
  }
  if (!cartItemIds.length) {
    return jsonResponse({ success: false, message: 'Select at least one item to checkout.' }, 400)
  }
  if (idempotencyKey.length < 8) {
    return jsonResponse(
      { success: false, message: 'Checkout session expired. Refresh and try again.' },
      400,
    )
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const {
    data: { user },
  } = await userClient.auth.getUser()
  if (!user) return jsonResponse({ error: 'Unauthorized' }, 401)

  const admin = createClient(supabaseUrl, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data: rateOk } = await admin.rpc('check_api_rate_limit', {
    p_bucket: `checkout:${user.id}`,
    p_limit: 20,
    p_window_seconds: 60,
  })
  if (rateOk === false) {
    return jsonResponse(
      { success: false, message: 'Too many checkout attempts. Please wait a moment.' },
      429,
    )
  }

  // Ownership: cart belongs to buyer and is active.
  const { data: cart, error: cartError } = await admin
    .from('carts')
    .select('id, user_id, status')
    .eq('id', cartId)
    .maybeSingle()
  if (cartError) return jsonResponse({ success: false, message: cartError.message }, 400)
  if (!cart || cart.user_id !== user.id || cart.status !== 'active') {
    return jsonResponse({ success: false, message: 'Cart not found or unavailable' }, 400)
  }

  const { data: address, error: addressError } = await admin
    .from('addresses')
    .select('id')
    .eq('id', shippingAddressId)
    .eq('user_id', user.id)
    .maybeSingle()
  if (addressError) return jsonResponse({ success: false, message: addressError.message }, 400)
  if (!address) {
    return jsonResponse({ success: false, message: 'Shipping address not found' }, 400)
  }

  // Load selected cart lines for stock + KYC preflight.
  const { data: cartLines, error: linesError } = await admin
    .from('cart_items')
    .select('id, listing_id, quantity, shop_id, saved_for_later')
    .eq('cart_id', cartId)
    .in('id', cartItemIds)
  if (linesError) return jsonResponse({ success: false, message: linesError.message }, 400)

  const activeLines = (cartLines ?? []).filter((row) => row.saved_for_later !== true)
  if (activeLines.length !== cartItemIds.length) {
    return jsonResponse(
      { success: false, message: 'One or more selected cart items are invalid' },
      400,
    )
  }

  const listingIds = [...new Set(activeLines.map((row) => row.listing_id).filter(Boolean))]
  const { data: listings, error: listingsError } = await admin
    .from('listings')
    .select('id, title, quantity, shop_id')
    .in('id', listingIds)
  if (listingsError) return jsonResponse({ success: false, message: listingsError.message }, 400)

  const listingById = new Map((listings ?? []).map((row) => [row.id, row]))
  const requested = new Map<string, number>()
  for (const line of activeLines) {
    requested.set(line.listing_id, (requested.get(line.listing_id) ?? 0) + Number(line.quantity ?? 0))
  }
  for (const [listingId, qty] of requested) {
    const listing = listingById.get(listingId)
    if (!listing) {
      return jsonResponse({ success: false, message: 'One or more items are unavailable' }, 400)
    }
    if (typeof listing.quantity === 'number' && qty > listing.quantity) {
      return jsonResponse(
        {
          success: false,
          message: `Only ${listing.quantity} left of "${listing.title ?? 'Item'}". Update the quantity in your cart.`,
        },
        400,
      )
    }
  }

  const shopIds = [
    ...new Set(
      activeLines
        .map((row) => row.shop_id || listingById.get(row.listing_id)?.shop_id)
        .filter((id): id is string => Boolean(id)),
    ),
  ]
  if (shopIds.length) {
    const { data: kycRows, error: kycError } = await admin
      .from('shop_payu_kyc')
      .select('shop_id, status')
      .in('shop_id', shopIds)
    if (kycError) return jsonResponse({ success: false, message: kycError.message }, 400)
    // Match shop_payu_kyc_allows_orders: any KYC row that is not payu_verified blocks checkout.
    const blocked = (kycRows ?? []).filter((row) => row.status !== 'payu_verified')
    if (blocked.length) {
      return jsonResponse(
        {
          success: false,
          message:
            'One or more shops are not ready to accept orders yet. Payout verification is still pending.',
        },
        400,
      )
    }
  }

  const finalizeShepay =
    body.finalize_shepay === false ? false : paymentMode === 'online'

  // Buyer JWT client so atomic_marketplace_checkout sees auth.uid().
  const { data: checkoutRaw, error: checkoutError } = await userClient.rpc(
    'atomic_marketplace_checkout',
    {
      p_cart_id: cartId,
      p_cart_item_ids: cartItemIds,
      p_shipping_address_id: shippingAddressId,
      p_billing_address_id: body.billing_address_id ?? shippingAddressId,
      p_payment_mode: paymentMode,
      p_idempotency_key: idempotencyKey,
      p_notes_by_shop: body.notes_by_shop ?? {},
      p_gift_shop_ids: body.gift_shop_ids ?? [],
      p_customer_currency: body.customer_currency ?? null,
      p_customer_amounts_by_shop: body.customer_amounts_by_shop ?? {},
      p_easyship_by_shop: body.easyship_by_shop ?? {},
    },
  )

  if (checkoutError) {
    const details =
      typeof (checkoutError as { details?: string }).details === 'string'
        ? (checkoutError as { details: string }).details
        : ''
    const hint =
      typeof (checkoutError as { hint?: string }).hint === 'string'
        ? (checkoutError as { hint: string }).hint
        : ''
    const message = [checkoutError.message, details, hint].filter(Boolean).join(' — ')
    return jsonResponse({ success: false, message: message || 'Checkout failed' }, 400)
  }

  const payload = (checkoutRaw ?? {}) as Record<string, unknown>
  if (payload.success === false) {
    return jsonResponse(
      {
        success: false,
        message: typeof payload.message === 'string' ? payload.message : 'Checkout failed',
      },
      400,
    )
  }

  const checkoutGroupId = typeof payload.checkout_group_id === 'string' ? payload.checkout_group_id : null
  if (!checkoutGroupId) {
    return jsonResponse({ success: false, message: 'Checkout could not be created' }, 500)
  }

  if (finalizeShepay) {
    const { data: bundle, error: bundleError } = await userClient.rpc(
      'finalize_shepay_bundle_charge',
      { p_checkout_group_id: checkoutGroupId },
    )
    if (bundleError) {
      return jsonResponse({ success: false, message: bundleError.message }, 400)
    }
    const bundleRow = bundle as Record<string, unknown> | null
    if (bundleRow && bundleRow.success === false) {
      return jsonResponse(
        {
          success: false,
          message:
            typeof bundleRow.message === 'string'
              ? bundleRow.message
              : 'Could not prepare SHEPay charge',
        },
        400,
      )
    }
  }

  const { data: steps } = await admin
    .from('commerce_checkout_payment_steps')
    .select('id, order_id, shop_id, collection, provider, status, amount, checkout_url, metadata')
    .eq('checkout_group_id', checkoutGroupId)
    .order('created_at', { ascending: true })

  // Persist Easyship DDP quote snapshot onto each shop order for credit + fulfill.
  const easyshipByShop = body.easyship_by_shop ?? {}
  for (const step of (steps ?? []) as PaymentStepRow[]) {
    if (!step.order_id || !step.shop_id) continue
    const quote = easyshipByShop[step.shop_id]
    if (!quote || typeof quote !== 'object') continue
    const { data: orderRow } = await admin
      .from('orders')
      .select('order_metadata')
      .eq('id', step.order_id)
      .maybeSingle()
    const prev =
      orderRow?.order_metadata && typeof orderRow.order_metadata === 'object'
        ? (orderRow.order_metadata as Record<string, unknown>)
        : {}
    await admin
      .from('orders')
      .update({
        order_metadata: {
          ...prev,
          easyship: quote,
        },
      })
      .eq('id', step.order_id)
  }

  const paymentSteps = ((steps ?? []) as PaymentStepRow[]).map((step) => ({
    id: step.id,
    order_id: step.order_id,
    shop_id: step.shop_id,
    collection: step.collection,
    provider: step.provider,
    status: step.status,
    amount: Number(step.amount ?? 0),
    checkout_url: step.checkout_url,
    platform_fee_amount: 0,
  }))

  const shippingByShop: Array<{ shop_id: string; shipping_amount: number }> = []
  for (const step of (steps ?? []) as PaymentStepRow[]) {
    if (!step.shop_id || step.collection === 'charge') continue
    const meta = step.metadata ?? {}
    const shippingAmount = Number(meta.shipping_amount ?? 0)
    shippingByShop.push({ shop_id: step.shop_id, shipping_amount: shippingAmount })
  }

  const shippingAmount =
    typeof payload.shipping_amount === 'number'
      ? payload.shipping_amount
      : shippingByShop.reduce((sum, row) => sum + row.shipping_amount, 0)

  return jsonResponse({
    success: true,
    checkout_group_id: checkoutGroupId,
    status: payload.status ?? 'created',
    order_ids: payload.order_ids ?? [],
    order_numbers: payload.order_numbers ?? [],
    subtotal_amount: Number(payload.subtotal_amount ?? 0),
    discount_amount: Number(payload.discount_amount ?? 0),
    shipping_amount: Number(shippingAmount ?? 0),
    shipping_by_shop: shippingByShop,
    platform_fee_amount: 0,
    total_amount: Number(payload.total_amount ?? 0),
    payment_steps: paymentSteps,
    idempotent_replay: Boolean(payload.idempotent_replay),
  })
})
