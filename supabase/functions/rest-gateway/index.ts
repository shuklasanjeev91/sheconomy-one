import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient, type SupabaseClient } from 'jsr:@supabase/supabase-js@2'

import { corsHeaders, jsonResponse } from '../_shared/cors.ts'

type ApiOk<T> = { ok: true; data: T; error: null }
type ApiFail = { ok: false; data: null; error: string }

function ok<T>(data: T): ApiOk<T> {
  return { ok: true, data, error: null }
}

function fail(error: string): ApiFail {
  return { ok: false, data: null, error }
}

function pathAfterFunction(pathname: string): string {
  // Invoked as /functions/v1/rest-gateway/... or /rest-gateway/...
  const markers = ['/rest-gateway', '/functions/v1/rest-gateway']
  for (const marker of markers) {
    const idx = pathname.indexOf(marker)
    if (idx >= 0) {
      const rest = pathname.slice(idx + marker.length)
      return rest.startsWith('/') ? rest : `/${rest}`
    }
  }
  return pathname.startsWith('/') ? pathname : `/${pathname}`
}

async function requireUser(req: Request): Promise<
  | { supabase: SupabaseClient; userId: string; error?: undefined }
  | { supabase?: undefined; userId?: undefined; error: Response }
> {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) {
    return { error: jsonResponse(fail('Unauthorized'), 401) }
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    { global: { headers: { Authorization: authHeader } } },
  )

  const { data, error } = await supabase.auth.getUser()
  if (error || !data.user) {
    return { error: jsonResponse(fail('Unauthorized'), 401) }
  }

  return { supabase, userId: data.user.id }
}

const OPENAPI = {
  openapi: '3.0.3',
  info: {
    title: 'SHEconomy REST Gateway',
    version: '1.0.0',
    description:
      'Thin JWT façade over Supabase PostgREST/RPCs. The Expo client remains the primary API surface.',
  },
  servers: [{ url: '/functions/v1/rest-gateway' }],
  components: {
    securitySchemes: {
      bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
    },
    schemas: {
      ApiResult: {
        type: 'object',
        properties: {
          ok: { type: 'boolean' },
          data: {},
          error: { type: 'string', nullable: true },
        },
      },
    },
  },
  security: [{ bearerAuth: [] }],
  paths: {
    '/v1/me': {
      get: {
        summary: 'Current profile',
        responses: { '200': { description: 'ApiResult<profile>' } },
      },
    },
    '/v1/listings': {
      get: {
        summary: 'Active listings',
        parameters: [
          { name: 'q', in: 'query', schema: { type: 'string' } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } },
        ],
        responses: { '200': { description: 'ApiResult<listing[]>' } },
      },
    },
    '/v1/listings/{slug}': {
      get: {
        summary: 'Listing by slug',
        parameters: [{ name: 'slug', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'ApiResult<listing>' } },
      },
    },
    '/v1/shops/{slug}': {
      get: {
        summary: 'Shop by slug',
        parameters: [{ name: 'slug', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'ApiResult<shop>' } },
      },
    },
    '/v1/cart': {
      get: { summary: 'Current user cart', responses: { '200': { description: 'ApiResult' } } },
    },
    '/v1/orders': {
      get: { summary: 'Buyer orders', responses: { '200': { description: 'ApiResult<order[]>' } } },
    },
    '/v1/posts': {
      get: {
        summary: 'Community feed posts',
        parameters: [{ name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } }],
        responses: { '200': { description: 'ApiResult<post[]>' } },
      },
    },
    '/v1/notifications': {
      get: {
        summary: 'User notifications',
        responses: { '200': { description: 'ApiResult<notification[]>' } },
      },
    },
    '/v1/meetings': {
      get: {
        summary: 'Co-Work meetings for current user',
        responses: { '200': { description: 'ApiResult<meeting[]>' } },
      },
    },
    '/health': {
      get: {
        summary: 'Gateway health',
        security: [],
        responses: { '200': { description: 'ok' } },
      },
    },
  },
} as const

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const url = new URL(req.url)
  const path = pathAfterFunction(url.pathname).replace(/\/+$/, '') || '/'
  const method = req.method.toUpperCase()

  if (method === 'GET' && (path === '/health' || path === '/')) {
    return jsonResponse(ok({ service: 'rest-gateway', version: '1.0.0' }))
  }

  if (method === 'GET' && (path === '/openapi.json' || path === '/v1/openapi.json')) {
    return jsonResponse(OPENAPI)
  }

  const auth = await requireUser(req)
  if (auth.error) return auth.error
  const { supabase, userId } = auth

  try {
    if (method === 'GET' && path === '/v1/me') {
      const { data, error } = await supabase
        .from('profiles')
        .select(
          'id, full_name, username, avatar_url, bio, headline, role, is_verified, preferred_currency',
        )
        .eq('id', userId)
        .maybeSingle()
      if (error) return jsonResponse(fail(error.message), 400)
      if (!data) return jsonResponse(fail('Profile not found'), 404)
      return jsonResponse(ok(data))
    }

    if (method === 'GET' && path === '/v1/listings') {
      const q = url.searchParams.get('q')?.trim() ?? ''
      const limit = Math.min(Number(url.searchParams.get('limit') ?? 20) || 20, 50)
      let query = supabase
        .from('listings')
        .select(
          'id, title, slug, price, listing_status, is_active, shop_id, category, created_at',
        )
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(limit)
      if (q) query = query.or(`title.ilike.%${q}%,slug.ilike.%${q}%`)
      const { data, error } = await query
      if (error) return jsonResponse(fail(error.message), 400)
      return jsonResponse(ok(data ?? []))
    }

    const listingMatch = path.match(/^\/v1\/listings\/([^/]+)$/)
    if (method === 'GET' && listingMatch) {
      const slug = decodeURIComponent(listingMatch[1])
      const { data, error } = await supabase
        .from('listings')
        .select('*')
        .eq('slug', slug)
        .maybeSingle()
      if (error) return jsonResponse(fail(error.message), 400)
      if (!data) return jsonResponse(fail('Listing not found'), 404)
      return jsonResponse(ok(data))
    }

    const shopMatch = path.match(/^\/v1\/shops\/([^/]+)$/)
    if (method === 'GET' && shopMatch) {
      const slug = decodeURIComponent(shopMatch[1])
      const { data, error } = await supabase
        .from('shops')
        .select(
          'id, shop_name, slug, logo_url, shop_description, average_rating, total_reviews, verified, is_active, shop_currency',
        )
        .eq('slug', slug)
        .maybeSingle()
      if (error) return jsonResponse(fail(error.message), 400)
      if (!data) return jsonResponse(fail('Shop not found'), 404)
      return jsonResponse(ok(data))
    }

    if (method === 'GET' && path === '/v1/cart') {
      const { data, error } = await supabase
        .from('carts')
        .select('id, status, total_amount, currency, updated_at, cart_items(*)')
        .eq('user_id', userId)
        .eq('status', 'active')
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (error) return jsonResponse(fail(error.message), 400)
      return jsonResponse(ok(data))
    }

    if (method === 'GET' && path === '/v1/orders') {
      const limit = Math.min(Number(url.searchParams.get('limit') ?? 20) || 20, 50)
      const { data, error } = await supabase
        .from('orders')
        .select('id, order_number, order_status, total_amount, currency, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit)
      if (error) return jsonResponse(fail(error.message), 400)
      return jsonResponse(ok(data ?? []))
    }

    if (method === 'GET' && path === '/v1/posts') {
      const limit = Math.min(Number(url.searchParams.get('limit') ?? 20) || 20, 50)
      const { data, error } = await supabase
        .from('posts_with_stats')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit)
      if (error) {
        // Fallback when the view is unavailable
        const fallback = await supabase
          .from('posts')
          .select('id, content, post_type, created_at, author_id, like_count, comment_count')
          .eq('is_deleted', false)
          .order('created_at', { ascending: false })
          .limit(limit)
        if (fallback.error) return jsonResponse(fail(fallback.error.message), 400)
        return jsonResponse(ok(fallback.data ?? []))
      }
      return jsonResponse(ok(data ?? []))
    }

    if (method === 'GET' && path === '/v1/notifications') {
      const limit = Math.min(Number(url.searchParams.get('limit') ?? 30) || 30, 100)
      const { data, error } = await supabase
        .from('notifications')
        .select('id, type, title, message, read, created_at, data')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit)
      if (error) return jsonResponse(fail(error.message), 400)
      return jsonResponse(ok(data ?? []))
    }

    if (method === 'GET' && path === '/v1/meetings') {
      const { data, error } = await supabase
        .from('meetings')
        .select('id, title, meeting_code, scheduled_at, status, host_id, created_at')
        .eq('host_id', userId)
        .order('scheduled_at', { ascending: false })
        .limit(50)
      if (error) return jsonResponse(fail(error.message), 400)
      return jsonResponse(ok(data ?? []))
    }

    return jsonResponse(fail(`No route for ${method} ${path}`), 404)
  } catch (error) {
    return jsonResponse(
      fail(error instanceof Error ? error.message : 'Internal error'),
      500,
    )
  }
})
