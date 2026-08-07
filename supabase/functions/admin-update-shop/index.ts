import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'

import { corsHeaders, jsonResponse } from '~/supabase/functions/_shared/cors.ts'

type UpdateBody = {
  shopId?: string
  updates?: Record<string, unknown>
}

/**
 * Admin shop update via service role.
 * Bypasses addresses RLS so the shops.shop_address_id trigger can see the
 * owner's address row (the failure mode for dashboard "Save changes").
 */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return jsonResponse({ ok: false, error: 'Unauthorized' }, 401)
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    if (!supabaseUrl || !anonKey || !serviceKey) {
      return jsonResponse({ ok: false, error: 'Server misconfigured' }, 500)
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    })
    const {
      data: { user },
      error: userError,
    } = await userClient.auth.getUser()
    if (userError || !user) {
      return jsonResponse({ ok: false, error: 'Unauthorized' }, 401)
    }

    const { data: profile, error: profileError } = await userClient
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()

    const role = String(profile?.role ?? '')
    const isAdmin = role === 'A' || role.toLowerCase() === 'admin'
    if (profileError || !isAdmin) {
      return jsonResponse({ ok: false, error: 'Only admins can update shops this way' }, 403)
    }

    const body = (await req.json().catch(() => ({}))) as UpdateBody
    const shopId = typeof body.shopId === 'string' ? body.shopId.trim() : ''
    const updates =
      body.updates && typeof body.updates === 'object' && !Array.isArray(body.updates)
        ? { ...body.updates }
        : null

    if (!shopId || !updates) {
      return jsonResponse({ ok: false, error: 'shopId and updates are required' }, 400)
    }

    delete updates.id
    delete updates.user_id
    delete updates.created_at
    updates.updated_at = new Date().toISOString()

    const admin = createClient(supabaseUrl, serviceKey)

    const { data: shop, error: shopError } = await admin
      .from('shops')
      .select('id, user_id, shop_address_id')
      .eq('id', shopId)
      .maybeSingle()

    if (shopError || !shop) {
      return jsonResponse({ ok: false, error: shopError?.message ?? 'Shop not found' }, 404)
    }

    // Heal a linked address so the shops trigger accepts it (owner + shop/business type).
    if (shop.shop_address_id && updates.shop_address_id === undefined) {
      const { data: address } = await admin
        .from('addresses')
        .select('id, user_id, address_type')
        .eq('id', shop.shop_address_id)
        .maybeSingle()

      if (address) {
        const type = String(address.address_type ?? '')
          .trim()
          .toLowerCase()
        const patch: Record<string, unknown> = {}
        if (address.user_id !== shop.user_id) {
          patch.user_id = shop.user_id
        }
        if (type !== 'shop' && type !== 'business') {
          patch.address_type = 'shop'
          if (!('address_label' in patch)) patch.address_label = 'Shop'
        }
        if (Object.keys(patch).length > 0) {
          await admin.from('addresses').update(patch).eq('id', address.id)
        }
      }
    }

    const { data: updated, error: updateError } = await admin
      .from('shops')
      .update(updates)
      .eq('id', shopId)
      .select('*')
      .single()

    if (updateError) {
      // Last resort: unlink → update fields → relink (still as service role).
      if (
        /shop_address_id/i.test(updateError.message ?? '') &&
        shop.shop_address_id &&
        updates.shop_address_id === undefined
      ) {
        const addressId = shop.shop_address_id
        await admin.from('shops').update({ shop_address_id: null }).eq('id', shopId)
        const { data: retry, error: retryError } = await admin
          .from('shops')
          .update(updates)
          .eq('id', shopId)
          .select('*')
          .single()
        if (!retryError && retry) {
          await admin.from('shops').update({ shop_address_id: addressId }).eq('id', shopId)
          const { data: finalRow } = await admin
            .from('shops')
            .select('*')
            .eq('id', shopId)
            .single()
          return jsonResponse({ ok: true, data: finalRow ?? retry, error: null })
        }
      }
      return jsonResponse({ ok: false, error: updateError.message }, 400)
    }

    return jsonResponse({ ok: true, data: updated, error: null })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not update shop'
    return jsonResponse({ ok: false, error: message }, 500)
  }
})
