import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient, type SupabaseClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const PRODUCTS = ['commerce', 'community', 'chat', 'class', 'cowork', 'shop', 'account'] as const
type AiProduct = (typeof PRODUCTS)[number]

type AssistBody = {
  action?: string
  product?: string
  contextPage?: string
  context?: Record<string, unknown>
  sessionId?: string | null
  message?: string
  suggestionId?: string
  helpful?: boolean
}

type DeepLink = { label: string; href: string }

type ChatMessageRow = {
  role: string
  content: string
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function normalizeProduct(value: unknown): AiProduct {
  const raw = typeof value === 'string' ? value.trim().toLowerCase() : ''
  if ((PRODUCTS as readonly string[]).includes(raw)) return raw as AiProduct
  return 'commerce'
}

function helpHref(product: AiProduct) {
  return `/help?product=${encodeURIComponent(product)}`
}

/** In-product training playbooks injected into the system prompt + grounded replies. */
function productPlaybook(product: AiProduct): string {
  switch (product) {
    case 'commerce':
      return [
        'Marketplace playbook:',
        '- Buy flow: search (/search?q=) → listing → add to cart → /cart → /checkout → /orders.',
        '- For “buy/find X”, recommend Matching marketplace listings and /search?q=X.',
        '- Orders: status lives at /orders; returns start from order details when policy allows.',
        '- Offers/coupons apply in cart; delivery estimates appear at checkout.',
        '- Never invent prices or stock — only use grounding listing matches.',
      ].join('\n')
    case 'community':
      return [
        'Community playbook:',
        '- Feed: create posts, react, comment, follow hashtags at /community.',
        '- Network: connect at /community/network; request warm intros from profiles.',
        '- Jobs: browse /community/jobs; improve profile + open-to-work for better matches.',
        '- Growth tips: post consistently, engage on others’ posts, complete profile sections.',
      ].join('\n')
    case 'shop':
      return [
        'Manage shop playbook:',
        '- Hub: /vendor/myshop → listings, orders, policies, payouts.',
        '- New listing: create listing with clear title, photos, price, stock, shipping/return policy.',
        '- Fulfillment: open seller orders, mark shipped, add tracking when available.',
        '- Growth: restock low inventory, improve titles, run offers, reply to buyer questions fast.',
        '- Visibility: inactive, zero stock, or incomplete listings may be hidden from browse.',
      ].join('\n')
    case 'chat':
      return [
        'Chat playbook:',
        '- Start chats from /chat or a profile Message button.',
        '- Mute from conversation header menu; groups support multiple members.',
        '- Media: photos/files may fail on size/network — retry or compress.',
        '- Thread tools: read receipts, disappearing messages when enabled.',
      ].join('\n')
    case 'class':
      return [
        'Class playbook:',
        '- Browse /class → open program → enroll → watch lessons.',
        '- Playback issues: refresh, check connection, try another browser/device, re-open lesson.',
        '- Enrollments appear in Classes; new lessons notify based on alert preferences.',
        '- Certificates depend on the program — check the class details page.',
      ].join('\n')
    case 'cowork':
      return [
        'Co-Work playbook (support-trained):',
        '- Schedule a meeting: open /co-work/schedule (Create with AI accepts natural language like “weekly sync tomorrow 11am”).',
        '- Instant host: start from /co-work, then share the meeting code or /co-work/meeting/{code} link.',
        '- Join: /co-work/join or enter the code on /co-work; allow camera/mic in browser + system settings.',
        '- After scheduling: copy code/link, invite guests, open lobby when it is time.',
        '- AV blocked: grant permissions, refresh, try another browser/device/headset.',
        '- Upcoming hosted meetings appear in grounding facts — never invent codes or times.',
        '- When the user asks to schedule/book a meeting, guide them to /co-work/schedule with a concrete draft (title, time, next step). Do NOT only say “no upcoming meetings”.',
      ].join('\n')
    default:
      return [
        'Account playbook:',
        '- Settings: /settings for profile, notifications, payment methods.',
        '- Help: /help for FAQs and support tickets across products.',
        '- For shopping questions, switch to Marketplace guidance.',
      ].join('\n')
  }
}

type Intent =
  | 'shop_buy'
  | 'orders'
  | 'returns'
  | 'cart'
  | 'seller'
  | 'community_network'
  | 'community_jobs'
  | 'community_post'
  | 'chat'
  | 'class'
  | 'cowork'
  | 'settings'
  | 'general'

function detectIntent(product: AiProduct, message: string): Intent {
  const lower = message.toLowerCase()
  if (extractShoppingQuery(message)) return 'shop_buy'
  if (/\b(return|refund|exchange)\b/.test(lower)) return 'returns'
  if (/\b(cart|checkout|coupon|offer|discount)\b/.test(lower)) return 'cart'
  if (
    /\b(orders?|tracking|track|delivery|shipment|shipping)\b/.test(lower) &&
    !/\b(buy|purchase|looking for|want to buy)\b/.test(lower)
  ) {
    return 'orders'
  }
  if (
    /\b(manage shop|seller|low stock|payout|inventory|listing title|fulfill|ship order|boost sales)\b/.test(
      lower,
    ) ||
    (product === 'shop' && /\b(stock|listing|order|policy|payout|sales)\b/.test(lower))
  ) {
    return 'seller'
  }
  if (/\b(job|jobs|hiring|open to work|apply|role)\b/.test(lower) || product === 'community' && lower.includes('job')) {
    return 'community_jobs'
  }
  if (
    /\b(connect|connection|network|intro|introduction|follow|followers)\b/.test(lower) ||
    (product === 'community' && /\b(people|network)\b/.test(lower))
  ) {
    return 'community_network'
  }
  if (
    /\b(post|hashtag|feed|engage|comment|reaction)\b/.test(lower) ||
    (product === 'community' && /\b(write|share|topic)\b/.test(lower))
  ) {
    return 'community_post'
  }
  if (
    /\b(chat|message|mute|dm|group chat|read receipt|disappearing)\b/.test(lower) ||
    (product === 'chat' && lower.length > 0)
  ) {
    if (product === 'chat' || /\b(chat|message|mute|dm|group)\b/.test(lower)) return 'chat'
  }
  if (
    /\b(class|enroll|course|lesson|playback|certificate|program)\b/.test(lower) ||
    product === 'class'
  ) {
    if (product === 'class' || /\b(class|enroll|course|lesson|playback|certificate)\b/.test(lower)) {
      return 'class'
    }
  }
  if (
    /\b(meeting|co-work|cowork|camera|mic|microphone|host|join code|schedule)\b/.test(lower) ||
    product === 'cowork'
  ) {
    if (
      product === 'cowork' ||
      /\b(meeting|co-work|cowork|camera|mic|host|schedule|session|call|sync)\b/.test(lower)
    ) {
      return 'cowork'
    }
  }
  if (/\b(settings?|notification|password|profile|payment methods?)\b/.test(lower)) return 'settings'
  return 'general'
}

function resolveEffectiveProduct(product: AiProduct, intent: Intent, shoppingQuery: string | null): AiProduct {
  if (shoppingQuery || intent === 'shop_buy' || intent === 'orders' || intent === 'returns' || intent === 'cart') {
    return 'commerce'
  }
  if (intent === 'seller') return 'shop'
  if (intent === 'community_network' || intent === 'community_jobs' || intent === 'community_post') {
    return 'community'
  }
  if (intent === 'chat') return 'chat'
  if (intent === 'class') return 'class'
  if (intent === 'cowork') return 'cowork'
  if (intent === 'settings') return 'account'
  return product
}

function productDeepLinks(product: AiProduct, searchQuery?: string | null): DeepLink[] {
  switch (product) {
    case 'commerce':
      return [
        ...(searchQuery
          ? [{ label: `Search “${searchQuery}”`, href: `/search?q=${encodeURIComponent(searchQuery)}` }]
          : [{ label: 'Marketplace', href: '/' }]),
        { label: 'Orders', href: '/orders' },
        { label: 'Cart', href: '/cart' },
        { label: 'Help Center', href: helpHref(product) },
      ]
    case 'community':
      return [
        { label: 'Network', href: '/community/network' },
        { label: 'Jobs', href: '/community/jobs' },
        { label: 'Connections FAQ', href: '/help?product=community&article=connections' },
        { label: 'Help Center', href: helpHref(product) },
      ]
    case 'chat':
      return [
        { label: 'Messages', href: '/chat' },
        { label: 'Start chat FAQ', href: '/help?product=chat&article=start-chat' },
        { label: 'Help Center', href: helpHref(product) },
      ]
    case 'class':
      return [
        { label: 'Classes', href: '/class' },
        { label: 'Enroll FAQ', href: '/help?product=class&article=enroll-class' },
        { label: 'Help Center', href: helpHref(product) },
      ]
    case 'cowork':
      return [
        { label: 'Schedule meeting', href: '/co-work/schedule' },
        { label: 'Co-Work home', href: '/co-work' },
        { label: 'Join with code', href: '/co-work/join' },
        { label: 'Schedule FAQ', href: '/help?product=cowork&article=schedule-meeting' },
        { label: 'Help Center', href: helpHref(product) },
      ]
    case 'shop':
      return [
        { label: 'My shop', href: '/vendor/myshop' },
        { label: 'Seller orders FAQ', href: '/help?product=shop&article=seller-orders' },
        { label: 'Help Center', href: helpHref(product) },
      ]
    default:
      return [
        { label: 'Settings', href: '/settings' },
        { label: 'Help Center', href: helpHref(product) },
      ]
  }
}

async function loadSuggestions(
  supabase: SupabaseClient,
  product: AiProduct,
  contextPage?: string,
) {
  let query = supabase
    .from('smart_suggestions')
    .select(
      'id, product, context_page, suggestion_text, suggestion_action, icon_name, priority, usage_count, success_rate',
    )
    .eq('is_active', true)
    .eq('product', product)
    .order('priority', { ascending: true })
    .limit(12)

  if (contextPage) {
    query = query.or(`context_page.eq.${contextPage},context_page.is.null`)
  }

  const { data, error } = await query
  if (error) throw error

  const rows = data ?? []
  // Prefer exact context_page matches, then fall back to any for the product.
  const exact = contextPage ? rows.filter((r) => r.context_page === contextPage) : []
  const pool = exact.length >= 3 ? exact : rows
  return pool.slice(0, 8)
}

const SHOPPING_STOP_WORDS = new Set([
  'a',
  'an',
  'the',
  'i',
  'im',
  "i'm",
  'me',
  'my',
  'to',
  'for',
  'of',
  'in',
  'on',
  'with',
  'and',
  'or',
  'please',
  'want',
  'wanna',
  'need',
  'looking',
  'find',
  'buy',
  'purchase',
  'get',
  'show',
  'search',
  'shop',
  'shopping',
  'some',
  'any',
  'can',
  'you',
  'help',
  'how',
  'do',
  'does',
  'is',
  'are',
  'what',
  'where',
  'recommend',
  'suggest',
  'like',
  'from',
  'here',
  'there',
  'sheconomy',
])

/** Pull a marketplace search phrase from natural language ("want to buy tshirt" → "tshirt"). */
function extractShoppingQuery(message: string): string | null {
  const lower = message.toLowerCase().trim()
  const buyIntent =
    /\b(buy|purchase|shop\s+for|looking\s+for|find|need|want|wanna|get|search|recommend|suggest)\b/.test(
      lower,
    ) || /\b(t[\s-]?shirts?|sarees?|kurti|jeans|dress|dresses|shoes?|bags?)\b/.test(lower)

  if (!buyIntent) return null

  // Prefer text after buy/find/need verbs.
  const afterVerb =
    lower.match(
      /\b(?:buy|purchase|shop\s+for|looking\s+for|find|need|want|wanna|get|search(?:\s+for)?|recommend|suggest)\s+(.+)$/i,
    )?.[1] ?? lower

  const tokens = afterVerb
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2 && !SHOPPING_STOP_WORDS.has(t))

  if (!tokens.length) return null
  return tokens.slice(0, 6).join(' ')
}

function expandSearchTerms(query: string): string[] {
  const q = query.toLowerCase().trim()
  const terms = new Set<string>([q])
  const compact = q.replace(/[\s-]+/g, '')
  terms.add(compact)

  if (compact.includes('tshirt') || /\bt[\s-]?shirts?\b/.test(q) || compact === 'tee') {
    ;['tshirt', 't-shirt', 't shirts', 'tee', 'tees', 'tshirts'].forEach((t) => terms.add(t))
  }
  if (compact.includes('saree') || compact.includes('sari')) {
    ;['saree', 'sari', 'sarees'].forEach((t) => terms.add(t))
  }
  if (compact.includes('kurti')) terms.add('kurti')
  if (compact.includes('jeans')) terms.add('jeans')

  return [...terms].filter(Boolean).slice(0, 8)
}

async function searchListingsForQuery(
  service: SupabaseClient,
  query: string,
  options?: {
    limit?: number
    minPrice?: number | null
    maxPrice?: number | null
    listingType?: string | null
  },
): Promise<Array<{ id: string; title: string; slug: string; price: number | string | null }>> {
  const trimmed = query.trim()
  if (!trimmed) return []
  const limit = options?.limit ?? 8

  const { data: rpcRows, error: rpcError } = await service.rpc('search_listings', {
    p_search_term: trimmed,
    p_limit: limit,
    p_offset: 0,
    p_listing_type: options?.listingType ?? null,
    p_min_price: options?.minPrice ?? null,
    p_max_price: options?.maxPrice ?? null,
  })

  if (!rpcError && Array.isArray(rpcRows) && rpcRows.length) {
    const ids = rpcRows
      .map((row: { id?: string }) => (typeof row?.id === 'string' ? row.id : ''))
      .filter(Boolean)
    if (ids.length) {
      const { data: listings } = await service
        .from('listings')
        .select('id, title, slug, price')
        .in('id', ids)
        .eq('is_active', true)
      const byId = new Map((listings ?? []).map((row) => [row.id, row]))
      return ids
        .map((id) => byId.get(id))
        .filter((row): row is { id: string; title: string; slug: string; price: number | string | null } =>
          Boolean(row?.slug && row?.title),
        )
    }
  }

  // Fallback: title ilike across expanded terms (legacy chat path).
  const terms = expandSearchTerms(trimmed)
  if (!terms.length) return []

  const orFilter = terms.map((t) => `title.ilike.%${t.replace(/[%_,]/g, '')}%`).join(',')
  const { data, error } = await service
    .from('listings')
    .select('id, title, slug, price')
    .eq('is_active', true)
    .or(orFilter)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    console.error('listing search error:', error.message)
    return []
  }
  return (data ?? []).filter((row) => row.slug && row.title)
}

async function buildGrounding(
  service: SupabaseClient,
  userId: string,
  product: AiProduct,
  context: Record<string, unknown>,
  message?: string,
) {
  const facts: string[] = [`Caller product context: ${product}`]
  if (context.listing_id) facts.push(`Current listing id: ${String(context.listing_id)}`)
  if (context.shop_id) facts.push(`Current shop id: ${String(context.shop_id)}`)
  if (context.meeting_id) facts.push(`Current meeting id: ${String(context.meeting_id)}`)
  if (context.route) facts.push(`Route: ${String(context.route)}`)

  const shoppingQuery = message ? extractShoppingQuery(message) : null
  if (shoppingQuery) {
    facts.push(`User shopping query: ${shoppingQuery}`)
    const matches = await searchListingsForQuery(service, shoppingQuery)
    if (matches.length) {
      facts.push(
        `Matching marketplace listings: ${matches
          .map(
            (l) =>
              `${l.title} (₹${l.price ?? '—'}) → /listing/${l.slug}`,
          )
          .join('; ')}`,
      )
      facts.push(`Marketplace search: /search?q=${encodeURIComponent(shoppingQuery)}`)
    } else {
      facts.push(
        `No exact listing title matches for “${shoppingQuery}”. Suggest /search?q=${encodeURIComponent(shoppingQuery)} and browsing / .`,
      )
    }
  }

  if (context.listing_id) {
    const { data: listing } = await service
      .from('listings')
      .select('id, title, stock, price, shop_id, is_active')
      .eq('id', String(context.listing_id))
      .maybeSingle()
    if (listing) {
      facts.push(
        `Listing: ${listing.title} (stock ${listing.stock ?? 'n/a'}, price ${listing.price}, active ${listing.is_active})`,
      )
    }
  } else if (context.listing_slug) {
    const { data: listing } = await service
      .from('listings')
      .select('id, title, stock, price, shop_id, is_active')
      .eq('slug', String(context.listing_slug))
      .maybeSingle()
    if (listing) {
      facts.push(
        `Listing: ${listing.title} (id ${listing.id}, stock ${listing.stock ?? 'n/a'}, price ${listing.price})`,
      )
    }
  }

  if (product === 'commerce' || product === 'account') {
    const { data: orders } = await service
      .from('orders')
      .select('order_number, order_status, status, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(5)
    if (orders?.length) {
      facts.push(
        `Recent orders: ${orders
          .map((o) => `${o.order_number} (${o.order_status || o.status || 'unknown'})`)
          .join('; ')}`,
      )
    } else {
      facts.push('No recent orders found for this user.')
    }
  }

  if (product === 'commerce') {
    const { data: trending } = await service
      .from('listings')
      .select('title, slug, price')
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(4)
    if (trending?.length) {
      facts.push(
        `Fresh marketplace picks: ${trending
          .map((l) => `${l.title} (₹${l.price ?? '—'}) → /listing/${l.slug}`)
          .join('; ')}`,
      )
    }
  }

  if (product === 'chat') {
    const { count } = await service
      .from('conversation_participants')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
    facts.push(`Conversation memberships: ${count ?? 0}`)
    facts.push('Chat tips: start from /chat; mute in thread header; groups support multi-member chats.')
  }

  if (product === 'cowork') {
    const now = new Date().toISOString()
    const { data: meetings } = await service
      .from('meetings')
      .select('title, scheduled_at, meeting_code, status')
      .eq('host_id', userId)
      .gte('scheduled_at', now)
      .order('scheduled_at', { ascending: true })
      .limit(3)
    if (meetings?.length) {
      facts.push(
        `Upcoming hosted meetings: ${meetings
          .map((m) => `${m.title || 'Meeting'} @ ${m.scheduled_at} (code ${m.meeting_code})`)
          .join('; ')}`,
      )
    } else {
      facts.push('No upcoming hosted meetings.')
    }
    facts.push(
      'Co-Work tips: schedule at /co-work/schedule (AI draft supported); host/join at /co-work; share meeting code or /co-work/meeting/{code}; allow camera/mic permissions.',
    )
  }

  if (product === 'shop') {
    const { data: shops } = await service
      .from('shops')
      .select('id, shop_name, slug')
      .eq('user_id', userId)
      .limit(5)
    const shopIds = (shops ?? []).map((s) => s.id)
    if (shopIds.length) {
      const { data: lowStock } = await service
        .from('listings')
        .select('id, title, stock, shop_id')
        .in('shop_id', shopIds)
        .eq('is_active', true)
        .lte('stock', 5)
        .limit(5)
      facts.push(`Shops owned: ${(shops ?? []).map((s) => s.shop_name).join(', ')}`)
      facts.push(`Manage shop hub: /vendor/myshop`)
      if (lowStock?.length) {
        facts.push(
          `Low-stock listings: ${lowStock
            .map((l) => `${l.title || l.id} (stock ${l.stock})`)
            .join('; ')}`,
        )
      } else {
        facts.push('No low-stock active listings (≤5) found.')
      }

      const { count: openOrders } = await service
        .from('order_items')
        .select('id', { count: 'exact', head: true })
        .in('shop_id', shopIds)
      facts.push(`Order line items across owned shops (sample count): ${openOrders ?? 0}`)

      const { count: activeListings } = await service
        .from('listings')
        .select('id', { count: 'exact', head: true })
        .in('shop_id', shopIds)
        .eq('is_active', true)
      facts.push(`Active listings across owned shops: ${activeListings ?? 0}`)
    } else {
      facts.push('User has no shops yet. Create one at /create-my-shop.')
    }
  }

  if (product === 'community') {
    const { count: following } = await service
      .from('follows')
      .select('id', { count: 'exact', head: true })
      .eq('follower_id', userId)
    facts.push(`People this user follows: ${following ?? 0}`)
    const { count: followers } = await service
      .from('follows')
      .select('id', { count: 'exact', head: true })
      .eq('following_id', userId)
    facts.push(`Followers: ${followers ?? 0}`)
    facts.push(
      'Community tips: post on /community, grow network at /community/network, jobs at /community/jobs.',
    )
  }

  if (product === 'class') {
    const { count: enrollments } = await service
      .from('class_enrollment')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
    facts.push(`Class enrollments: ${enrollments ?? 0}`)
    const { data: courses } = await service
      .from('class_course')
      .select('title, slug')
      .eq('is_published', true)
      .order('created_at', { ascending: false })
      .limit(4)
    if (courses?.length) {
      facts.push(
        `Published classes: ${courses
          .map((p) => `${p.title}${p.slug ? ` → /class/${p.slug}` : ''}`)
          .join('; ')}`,
      )
    } else {
      facts.push('Browse classes at /class to enroll in programs.')
    }
  }

  // Attach Help articles (title + short content) so both the model and grounded replies can use them.
  const helpCategory = product === 'account' ? 'commerce' : product
  const { data: helpArticles } = await service
    .from('support_knowledge_base')
    .select('title, slug, content')
    .eq('is_active', true)
    .eq('category', helpCategory)
    .order('helpful_count', { ascending: false })
    .limit(6)
  if (helpArticles?.length) {
    facts.push(
      `Related Help articles: ${helpArticles
        .map((a) => `${a.title}${a.slug ? ` (/help?product=${helpCategory}&article=${a.slug})` : ''}`)
        .join('; ')}`,
    )
    for (const article of helpArticles.slice(0, 3)) {
      const excerpt = String(article.content ?? '')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 220)
      if (excerpt) {
        facts.push(`Help tip — ${article.title}: ${excerpt}`)
      }
    }
  }

  return facts
}

function wantsScheduleMeeting(message: string): boolean {
  const lower = message.toLowerCase()
  const hasMeeting =
    /\b(meeting|co-?work|session|call|sync|huddle|standup|stand-up)\b/.test(lower) ||
    /\bschedule\b/.test(lower)
  const hasScheduleVerb =
    /\b(schedule|book|set\s*up|setup|plan|create|arrange|organize|host)\b/.test(lower)
  const hasWhen =
    /\b(tomorrow|today|tonight|next\s+(mon|tue|wed|thu|fri|sat|sun)|monday|tuesday|wednesday|thursday|friday|saturday|sunday|\d{1,2}\s*(am|pm)|morning|afternoon|evening)\b/.test(
      lower,
    )
  if (hasScheduleVerb && (hasMeeting || hasWhen)) return true
  if (hasMeeting && hasWhen) return true
  return false
}

function formatMeetingDraftReply(draft: {
  title: string
  description: string
  scheduledAt: string | null
  maxParticipants: number | null
  agenda: string[]
}): string {
  const when = draft.scheduledAt
    ? new Date(draft.scheduledAt).toLocaleString('en-IN', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      })
    : 'a time you choose on the schedule form'
  const agenda =
    draft.agenda.length > 0
      ? ` Agenda: ${draft.agenda.map((item, i) => `${i + 1}) ${item}`).join('; ')}.`
      : ''
  return [
    `I drafted a Co-Work meeting for you: “${draft.title}” around ${when}.`,
    draft.description ? `${draft.description.slice(0, 160)}.` : null,
    agenda.trim() || null,
    'Open Schedule meeting to review the title/time, then create it and share the code/link with guests.',
    'Tip: on /co-work/schedule you can also use Create with AI for another draft.',
  ]
    .filter(Boolean)
    .join(' ')
}

/** Grounded in-app assistant used when Gemini is unavailable or errors. */
function fallbackReply(product: AiProduct, message: string, facts: string[]): string {
  const lower = message.toLowerCase()
  const intent = detectIntent(product, message)
  const help = helpHref(product)
  const orderFact = facts.find((f) => f.startsWith('Recent orders:'))
  const noOrders = facts.find((f) => f.startsWith('No recent orders'))
  const shopFact = facts.find((f) => f.startsWith('Shops owned:'))
  const stockFact = facts.find((f) => f.startsWith('Low-stock'))
  const followFact = facts.find((f) => f.startsWith('People this user follows:'))
  const followerFact = facts.find((f) => f.startsWith('Followers:'))
  const classFact = facts.find((f) => f.startsWith('Class enrollments:'))
  const publishedClasses = facts.find((f) => f.startsWith('Published classes:'))
  const meetingFact = facts.find((f) => f.startsWith('Upcoming hosted meetings:'))
  const chatFact = facts.find((f) => f.startsWith('Conversation memberships:'))
  const activeListings = facts.find((f) => f.startsWith('Active listings'))
  const shoppingQuery = extractShoppingQuery(message)
  const matchFact = facts.find((f) => f.startsWith('Matching marketplace listings:'))
  const searchFact = facts.find((f) => f.startsWith('Marketplace search:'))
  const noMatchFact = facts.find((f) => f.startsWith('No exact listing title matches'))
  const freshPicks = facts.find((f) => f.startsWith('Fresh marketplace picks:'))

  if (intent === 'shop_buy' && shoppingQuery) {
    if (matchFact) {
      return [
        `Great — here are live marketplace picks for “${shoppingQuery}”:`,
        matchFact.replace(/^Matching marketplace listings:\s*/, ''),
        `Open ${searchFact?.replace(/^Marketplace search:\s*/, '') || `/search?q=${encodeURIComponent(shoppingQuery)}`} to see all matches, then checkout from /cart.`,
      ].join(' ')
    }
    if (noMatchFact) {
      return `I couldn’t find an exact “${shoppingQuery}” title match. Try /search?q=${encodeURIComponent(shoppingQuery)} or browse / for similar finds.`
    }
    return `Search “${shoppingQuery}” at /search?q=${encodeURIComponent(shoppingQuery)}, open a listing, add to cart, then checkout.`
  }

  if (intent === 'orders') {
    if (orderFact) {
      return `Here are your latest orders: ${orderFact.replace(/^Recent orders:\s*/, '')} Open /orders for tracking. Help: ${helpHref('commerce')}`
    }
    return noOrders
      ? `You don’t have recent orders yet. Browse /, add items to cart, then checkout. Help: ${helpHref('commerce')}`
      : `Open /orders to track deliveries. Help: ${helpHref('commerce')}`
  }

  if (intent === 'returns') {
    return `Most returns start from Order details when the shop’s policy allows it. Check Shipping & policies on the listing, then open /orders. Help: ${helpHref('commerce')}`
  }

  if (intent === 'cart') {
    return `Open /cart to review quantities and offers, apply coupons, then checkout with address + payment. Help: ${helpHref('commerce')}`
  }

  if (intent === 'seller') {
    return [
      shopFact ? `${shopFact}.` : 'Create or open your shop at /create-my-shop (or /vendor/myshop).',
      activeListings ? `${activeListings}.` : null,
      stockFact ? `${stockFact}. Restock under Listings.` : 'Keep stock updated so listings stay visible.',
      'Manage orders, policies, and payouts from the seller hub. Help: ' + helpHref('shop'),
    ]
      .filter(Boolean)
      .join(' ')
  }

  if (intent === 'community_jobs') {
    return 'Browse roles at /community/jobs, tailor your profile, and turn on Open to work if available. Help: ' + helpHref('community')
  }

  if (intent === 'community_network') {
    return [
      followFact ? `${followFact}.` : null,
      followerFact ? `${followerFact}.` : null,
      'Grow your network at /community/network — send connection requests and ask for warm intros. Help: ' +
        helpHref('community'),
    ]
      .filter(Boolean)
      .join(' ')
  }

  if (intent === 'community_post') {
    return 'Share a short professional update on /community: a win, tip, or question. Add 2–3 hashtags and engage on others’ posts. Help: ' + helpHref('community')
  }

  if (intent === 'chat') {
    if (lower.includes('mute')) {
      return `Open a conversation in /chat, tap the header menu, and choose Mute. Help: ${helpHref('chat')}`
    }
    if (lower.includes('group')) {
      return `Start or open a group from /chat — groups support multiple members. Help: ${helpHref('chat')}`
    }
    return [
      chatFact ? `${chatFact}.` : null,
      'Open /chat to message people, start a conversation, or manage mute/media from the thread. Help: ' +
        helpHref('chat'),
    ]
      .filter(Boolean)
      .join(' ')
  }

  if (intent === 'class') {
    if (lower.includes('play') || lower.includes('video') || lower.includes('audio')) {
      return `For playback issues: refresh, check connection, try another browser/device, then reopen the lesson from /class. Help: ${helpHref('class')}`
    }
    return [
      classFact ? `${classFact}.` : null,
      publishedClasses
        ? `Try these: ${publishedClasses.replace(/^Published classes:\s*/, '')}`
        : 'Browse programs at /class and enroll from a class page.',
      'Help: ' + helpHref('class'),
    ]
      .filter(Boolean)
      .join(' ')
  }

  if (intent === 'cowork') {
    if (lower.includes('camera') || lower.includes('mic')) {
      return `Allow camera/mic in browser + system settings, then refresh the meeting. Join/host from /co-work. Help: ${helpHref('cowork')}`
    }
    if (wantsScheduleMeeting(message)) {
      const draftFact = facts.find((f) => f.startsWith('Suggested meeting draft:'))
      if (draftFact) {
        return `${draftFact.replace(/^Suggested meeting draft:\s*/, '')} Open /co-work/schedule to create it and share the code/link. Help: ${helpHref('cowork')}`
      }
      return [
        'To schedule a Co-Work meeting for tomorrow (or any time): open /co-work/schedule.',
        'Use Create with AI — e.g. “team sync tomorrow at 11am” — then review title/time and create.',
        'After creating, share the meeting code or /co-work/meeting/{code} link.',
        meetingFact ? `${meetingFact}.` : null,
        'Help: ' + helpHref('cowork'),
      ]
        .filter(Boolean)
        .join(' ')
    }
    if (lower.includes('join') || lower.includes('code')) {
      return `On /co-work or /co-work/join, enter the meeting code to join. Ask the host if you don’t have a code. Help: ${helpHref('cowork')}`
    }
    return [
      meetingFact ? `${meetingFact}.` : 'No upcoming hosted meetings right now.',
      'To schedule one, open /co-work/schedule (or host instantly from /co-work) and share the code/link. Help: ' +
        helpHref('cowork'),
    ].join(' ')
  }

  if (intent === 'settings') {
    return 'Update profile, notifications, and payment methods at /settings. Help Center: /help'
  }

  switch (product) {
    case 'commerce':
      return [
        'I can help you shop, track orders, or checkout.',
        freshPicks ? `Fresh picks: ${freshPicks.replace(/^Fresh marketplace picks:\s*/, '')}` : 'Browse / or /search.',
        'Try: “buy a t-shirt”, “track my order”, or “apply a coupon”.',
      ].join(' ')
    case 'community':
      return 'I can help with posting, networking, and jobs. Try: “what should I post?”, “grow my network”, or “find jobs”. Open /community.'
    case 'shop':
      return [
        shopFact ? `${shopFact}.` : 'Create your shop at /create-my-shop.',
        'Try: “manage new orders”, “low stock”, or “boost sales”. Hub: /vendor/myshop.',
      ].join(' ')
    case 'chat':
      return 'I can help with messaging, mute, and groups. Open /chat — try: “start a chat” or “mute a conversation”.'
    case 'class':
      return [
        publishedClasses
          ? `Classes to explore: ${publishedClasses.replace(/^Published classes:\s*/, '')}`
          : 'Browse /class to enroll.',
        'Try: “enroll in a class” or “video won’t play”.',
      ].join(' ')
    case 'cowork':
      return 'I can help schedule, host, or join Co-Work meetings and fix camera/mic. Try: “schedule a meeting for tomorrow at 11am”, “host a meeting”, or “join with code”. Open /co-work/schedule or /co-work.'
    default:
      return `I can help across Marketplace, Community, Chat, Class, Co-Work, and Manage shop. Ask a product question, or open ${help}.`
  }
}

type LlmCallResult = {
  answer: string | null
  model: string | null
  error: string | null
  keySource: string | null
}

function normalizeApiKey(raw: string | undefined | null): string {
  if (!raw) return ''
  let key = raw.trim()
  // Tolerate secrets stored with quotes or a Bearer prefix.
  if (
    (key.startsWith('"') && key.endsWith('"')) ||
    (key.startsWith("'") && key.endsWith("'"))
  ) {
    key = key.slice(1, -1).trim()
  }
  if (key.toLowerCase().startsWith('bearer ')) {
    key = key.slice(7).trim()
  }
  return key
}

function collectGeminiApiKeys(): Array<{ source: string; key: string }> {
  const candidates: Array<{ source: string; env: string }> = [
    { source: 'GEMINI_API_KEY', env: 'GEMINI_API_KEY' },
    { source: 'GOOGLE_AI_API_KEY', env: 'GOOGLE_AI_API_KEY' },
  ]
  const seen = new Set<string>()
  const keys: Array<{ source: string; key: string }> = []
  for (const candidate of candidates) {
    const key = normalizeApiKey(Deno.env.get(candidate.env))
    if (!key || seen.has(key)) continue
    seen.add(key)
    keys.push({ source: candidate.source, key })
  }
  return keys
}

function preferredGeminiModels(): string[] {
  const preferred =
    Deno.env.get('GEMINI_MODEL')?.trim() ||
    Deno.env.get('GOOGLE_AI_MODEL')?.trim() ||
    'gemini-2.5-flash'
  return [
    ...new Set([
      preferred,
      'gemini-2.5-flash',
      'gemini-2.0-flash',
      'gemini-2.5-pro',
      'gemini-flash-latest',
      'gemini-2.0-flash-lite',
    ]),
  ]
}

/** Flash-first list for vision describe (cheaper / less quota pressure than Pro). */
function preferredVisionModels(): string[] {
  const preferred =
    Deno.env.get('GEMINI_VISION_MODEL')?.trim() ||
    Deno.env.get('GEMINI_MODEL')?.trim() ||
    'gemini-2.5-flash'
  return [
    ...new Set([
      preferred,
      'gemini-2.5-flash',
      'gemini-2.0-flash',
      'gemini-2.0-flash-lite',
      'gemini-2.5-pro',
      'gemini-flash-latest',
    ]),
  ]
}

type GeminiPart =
  | { text: string }
  | { inlineData: { mimeType: string; data: string } }

type GeminiContent = {
  role: 'user' | 'model'
  parts: GeminiPart[]
}

/** Gemini requires alternating user/model turns — merge consecutive same-role messages. */
function toGeminiContents(
  history: ChatMessageRow[],
  userMessage: string,
  extraUserParts: GeminiPart[] = [],
): GeminiContent[] {
  const contents: GeminiContent[] = []

  const push = (role: 'user' | 'model', parts: GeminiPart[]) => {
    const last = contents[contents.length - 1]
    if (last && last.role === role) {
      last.parts.push(...parts)
      return
    }
    contents.push({ role, parts })
  }

  for (const message of history.slice(-12)) {
    const text = String(message.content ?? '').trim()
    if (!text) continue
    push(message.role === 'assistant' ? 'model' : 'user', [{ text }])
  }

  const userParts: GeminiPart[] = [{ text: userMessage }, ...extraUserParts]
  push('user', userParts)

  // API requires the first content to be from the user.
  if (contents.length && contents[0].role !== 'user') {
    contents.unshift({ role: 'user', parts: [{ text: 'Continue.' }] })
  }

  return contents
}

function extractGeminiText(payload: unknown): string | null {
  const candidates = (payload as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> })
    ?.candidates
  if (!Array.isArray(candidates) || !candidates.length) return null
  for (const candidate of candidates) {
    const parts = candidate?.content?.parts
    if (!Array.isArray(parts)) continue
    const text = parts
      .map((part) => (typeof part?.text === 'string' ? part.text : ''))
      .join('')
      .trim()
    if (text) return text
  }
  return null
}

async function callGeminiOnce(
  apiKey: string,
  model: string,
  systemPrompt: string,
  contents: GeminiContent[],
  options?: { jsonMode?: boolean; maxOutputTokens?: number; temperature?: number },
): Promise<{ answer: string | null; error: string | null }> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`
  const generationConfig: Record<string, unknown> = {
    temperature: options?.temperature ?? 0.4,
    maxOutputTokens: options?.maxOutputTokens ?? 4096,
  }
  if (options?.jsonMode) {
    generationConfig.responseMimeType = 'application/json'
  }
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: {
        parts: [{ text: systemPrompt }],
      },
      contents,
      generationConfig,
    }),
  })

  if (!response.ok) {
    const text = await response.text()
    let detail = text.slice(0, 400)
    try {
      const parsed = JSON.parse(text) as { error?: { message?: string; status?: string; code?: number } }
      detail = parsed?.error?.message || parsed?.error?.status || detail
    } catch {
      // keep raw slice
    }
    console.error('Gemini error:', response.status, detail)
    return { answer: null, error: `${response.status}: ${detail}` }
  }

  const payload = await response.json()
  const content = extractGeminiText(payload)
  if (content) return { answer: content, error: null }
  const blockReason =
    (payload as { promptFeedback?: { blockReason?: string } })?.promptFeedback?.blockReason ||
    (payload as { candidates?: Array<{ finishReason?: string }> })?.candidates?.[0]?.finishReason
  return {
    answer: null,
    error: blockReason ? `blocked:${blockReason}` : 'empty_completion',
  }
}

async function callGemini(
  systemPrompt: string,
  history: ChatMessageRow[],
  userMessage: string,
): Promise<LlmCallResult> {
  const keys = collectGeminiApiKeys()
  if (!keys.length) {
    console.warn('ai-assist: no Gemini API key set — using fallback replies')
    return { answer: null, model: null, error: 'missing_gemini_api_key', keySource: null }
  }

  const contents = toGeminiContents(history, userMessage)
  const models = preferredGeminiModels()

  let lastError: string | null = null
  for (const { source, key } of keys) {
    for (const model of models) {
      try {
        const result = await callGeminiOnce(key, model, systemPrompt, contents)
        if (result.answer) {
          return { answer: result.answer, model, error: null, keySource: source }
        }
        lastError = result.error
        // Invalid key → try next key. Model errors → try next model with same key.
        if (result.error?.startsWith('401') || result.error?.startsWith('403')) break
      } catch (err) {
        lastError = err instanceof Error ? err.message : 'gemini_fetch_failed'
        console.error('Gemini fetch failed:', lastError)
      }
    }
  }

  return { answer: null, model: null, error: lastError, keySource: keys[0]?.source ?? null }
}

function parseDataUrl(dataUrl: string): { mimeType: string; data: string } | null {
  const match = /^data:([^;]+);base64,(.+)$/i.exec(dataUrl.trim())
  if (!match) return null
  return { mimeType: match[1], data: match[2] }
}

async function callGeminiVision(
  systemPrompt: string,
  imageDataUrl: string,
  userMessage = 'Moderate this listing image.',
  options?: { jsonMode?: boolean },
): Promise<LlmCallResult> {
  const keys = collectGeminiApiKeys()
  if (!keys.length) {
    return { answer: null, model: null, error: 'missing_gemini_api_key', keySource: null }
  }

  const parsed = parseDataUrl(imageDataUrl)
  if (!parsed) {
    return { answer: null, model: null, error: 'invalid_image_data_url', keySource: null }
  }

  // Cap inline image size (~2.5MB base64) to stay within edge + Gemini limits.
  if (parsed.data.length > 3_500_000) {
    return { answer: null, model: null, error: 'image_too_large', keySource: null }
  }

  const contents = toGeminiContents([], userMessage, [
    { inlineData: { mimeType: parsed.mimeType, data: parsed.data } },
  ])
  const models = preferredVisionModels()

  let lastError: string | null = null
  for (const { source, key } of keys) {
    for (const model of models) {
      try {
        const result = await callGeminiOnce(key, model, systemPrompt, contents, {
          jsonMode: options?.jsonMode,
          maxOutputTokens: 1024,
          temperature: 0.2,
        })
        if (result.answer) {
          return { answer: result.answer, model, error: null, keySource: source }
        }
        lastError = result.error
        if (result.error?.startsWith('401') || result.error?.startsWith('403')) break
        // Hard quota — no point hammering every model with the same exhausted key.
        if (/429|RESOURCE_EXHAUSTED|quota|limit:\s*0|denied access/i.test(String(result.error))) {
          continue
        }
      } catch (err) {
        lastError = err instanceof Error ? err.message : 'gemini_fetch_failed'
      }
    }
  }

  return { answer: null, model: null, error: lastError, keySource: keys[0]?.source ?? null }
}

function visionFailureMessage(error: string | null): { error: string; status: number } {
  const detail = String(error ?? '')
  if (/missing_gemini_api_key/i.test(detail)) {
    return {
      error: 'Image search is not configured. Set a Google AI API key on the server.',
      status: 503,
    }
  }
  if (/image_too_large|invalid_image/i.test(detail)) {
    return {
      error: 'That photo is too large or invalid. Try a smaller, clearer product shot.',
      status: 400,
    }
  }
  if (/403|denied access/i.test(detail)) {
    return {
      error:
        'Image search is unavailable for this AI project (access denied). Check Google AI Studio billing/permissions, or type your search instead.',
      status: 503,
    }
  }
  if (/429|RESOURCE_EXHAUSTED|quota|limit:\s*0|free_tier|billing/i.test(detail)) {
    return {
      error:
        'AI image search is out of quota right now. Wait a bit, enable billing in Google AI Studio, or type what you are looking for instead.',
      status: 429,
    }
  }
  return {
    error: 'Could not identify the product in that photo. Try a clearer product shot, or type your search.',
    status: 502,
  }
}

function localCommentSuggestionList(ctx: {
  postType?: string
  content?: string
  authorName?: string
  eventTitle?: string
  celebrationTitle?: string
  productTitle?: string
  shopName?: string
  articleTitle?: string
  hasMedia?: boolean
}): string[] {
  const name = ctx.authorName?.trim().split(/\s+/)[0] || ''
  const type = (ctx.postType || (ctx.hasMedia ? 'media' : 'text')).toLowerCase()
  switch (type) {
    case 'celebration':
      return [
        ctx.celebrationTitle
          ? `Congratulations on ${ctx.celebrationTitle}! 🎉 So well deserved.`
          : `Congratulations${name ? `, ${name}` : ''}! 🎉 Wishing you all the best.`,
        'This is such wonderful news — celebrating with you!',
        'So happy for you. Keep shining!',
      ]
    case 'event':
      return [
        ctx.eventTitle
          ? `This looks great — just marked my interest for “${ctx.eventTitle}”.`
          : 'Sounds valuable. Is there a way to RSVP or get a reminder?',
        'Thanks for sharing the details. Looking forward to this!',
        'Would love to join. Any prep we should do beforehand?',
      ]
    case 'poll':
      return [
        'Interesting options — just voted. Curious what others think.',
        'Great question. The results will be insightful.',
        'Thanks for putting this up — helped me clarify my own view.',
      ]
    case 'product':
      return [
        ctx.productTitle
          ? `This ${ctx.productTitle} looks lovely — is it available to ship soon?`
          : 'Beautiful find! Where can I learn more or buy this?',
        'Love the details. Do you have size/colour options?',
        'Bookmarking this — thanks for sharing!',
      ]
    case 'shop':
      return [
        ctx.shopName
          ? `Love what you’re building with ${ctx.shopName}. Following along!`
          : 'Your shop looks inspiring — just checked it out.',
        'Amazing curation. Do you ship nationwide?',
        'Rooting for more women-led brands like this ✨',
      ]
    case 'article':
      return [
        ctx.articleTitle
          ? `Really thoughtful piece on “${ctx.articleTitle}”. Thanks for writing this.`
          : 'Insightful read — appreciated the practical takeaways.',
        'This resonated. Going to share with my network.',
        'Clear and useful. Do you have a follow-up on next steps?',
      ]
    case 'media':
      return [
        'These visuals are stunning — thanks for sharing!',
        'Love the energy in this. What inspired it?',
        'Beautiful capture. More of this, please!',
      ]
    default:
      return [
        name
          ? `Thanks for sharing this, ${name} — really insightful.`
          : 'Thanks for sharing this — really insightful.',
        'This resonates. What’s the next step you’re focusing on?',
        'Great perspective. Bookmarking to revisit later.',
      ]
  }
}

function parseJsonStringArray(raw: string | null): string[] {
  if (!raw) return []
  const trimmed = raw.trim().replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```$/i, '')
  try {
    const parsed = JSON.parse(trimmed)
    if (!Array.isArray(parsed)) return []
    return parsed.map((item) => String(item).trim()).filter((item) => item.length > 0 && item.length < 220)
  } catch {
    return []
  }
}

function parseMeetingDraftJson(raw: string | null): {
  title: string
  description: string
  scheduledAt: string | null
  maxParticipants: number | null
  agenda: string[]
} | null {
  if (!raw) return null
  const trimmed = raw.trim().replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```$/i, '')
  try {
    const parsed = JSON.parse(trimmed) as Record<string, unknown>
    const title = typeof parsed.title === 'string' ? parsed.title.trim() : ''
    if (!title) return null
    const description = typeof parsed.description === 'string' ? parsed.description.trim() : ''
    let scheduledAt: string | null = null
    if (typeof parsed.scheduledAt === 'string' && parsed.scheduledAt.trim()) {
      const d = new Date(parsed.scheduledAt)
      if (!Number.isNaN(d.getTime())) scheduledAt = d.toISOString()
    }
    const maxParticipants =
      typeof parsed.maxParticipants === 'number' && Number.isFinite(parsed.maxParticipants)
        ? Math.min(500, Math.max(2, Math.round(parsed.maxParticipants)))
        : null
    const agenda = Array.isArray(parsed.agenda)
      ? parsed.agenda.map((item) => String(item).trim()).filter(Boolean).slice(0, 6)
      : []
    return { title, description, scheduledAt, maxParticipants, agenda }
  } catch {
    return null
  }
}

function parseTranslateJson(
  raw: string | null,
): { translatedText: string; detectedSourceLang: string | null } | null {
  if (!raw) return null
  const trimmed = raw
    .trim()
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```$/i, '')
  try {
    const parsed = JSON.parse(trimmed) as Record<string, unknown>
    const translatedText =
      typeof parsed.translatedText === 'string'
        ? parsed.translatedText.trim()
        : typeof parsed.text === 'string'
          ? parsed.text.trim()
          : ''
    if (!translatedText) return null
    const detected =
      typeof parsed.detectedSourceLang === 'string' && parsed.detectedSourceLang.trim()
        ? parsed.detectedSourceLang.trim().toLowerCase().slice(0, 12)
        : null
    return { translatedText, detectedSourceLang: detected }
  } catch {
    // Model sometimes returns plain translated text.
    if (trimmed && !trimmed.startsWith('{')) {
      return { translatedText: trimmed, detectedSourceLang: null }
    }
    return null
  }
}

const INDIC_LANGS = new Set(['hi', 'bn', 'mr', 'gu', 'pa', 'ta', 'te', 'kn', 'ml', 'or', 'ne', 'si'])

/** True when translated output plausibly matches the viewer's target script. */
function captionLooksLikeTargetLang(text: string, targetLang: string): boolean {
  const base = targetLang.split('-')[0]?.toLowerCase() || 'en'
  const hasLatin = /[A-Za-z]{2,}/.test(text)
  const hasDevanagari = /[\u0900-\u097F]/.test(text)
  const hasArabic = /[\u0600-\u06FF]/.test(text)
  const hasCjk = /[\u3040-\u30ff\u3400-\u9fff\uac00-\ud7af]/.test(text)
  if (INDIC_LANGS.has(base)) return hasDevanagari
  if (base === 'ar' || base === 'ur' || base === 'fa') return hasArabic
  if (base === 'zh' || base === 'ja' || base === 'ko') return hasCjk
  if (base === 'en' || base === 'es' || base === 'fr' || base === 'de' || base === 'pt' || base === 'it') {
    if ((hasDevanagari || hasCjk || hasArabic) && !hasLatin) return false
    return hasLatin || !hasDevanagari
  }
  return true
}

function myMemoryLangCode(code: string): string {
  const base = (code.split('-')[0] || code).toLowerCase()
  if (base === 'zh') return 'zh-CN'
  if (base === 'pt') return 'pt-BR'
  return base
}

async function translateViaMyMemory(
  text: string,
  targetLang: string,
  sourceLang: string,
): Promise<{ translatedText: string; detectedSourceLang: string | null } | null> {
  const target = myMemoryLangCode(targetLang)
  const source =
    sourceLang === 'auto' || sourceLang === 'autodetect'
      ? 'autodetect'
      : myMemoryLangCode(sourceLang)
  try {
    const url = new URL('https://api.mymemory.translated.net/get')
    url.searchParams.set('q', text.slice(0, 450))
    url.searchParams.set('langpair', `${source}|${target}`)
    const response = await fetch(url.toString(), { method: 'GET' })
    if (!response.ok) return null
    const payload = (await response.json()) as {
      responseData?: { translatedText?: string }
      responseStatus?: number
    }
    const translated = payload.responseData?.translatedText?.trim()
    if (!translated || payload.responseStatus !== 200) return null
    // MyMemory sometimes echoes "PLEASE SELECT TWO DISTINCT LANGUAGES" etc.
    if (/PLEASE SELECT|INVALID|MYMEMORY/i.test(translated)) return null
    return {
      translatedText: translated,
      detectedSourceLang: source === 'autodetect' ? null : source.split('-')[0] || source,
    }
  } catch {
    return null
  }
}

function parseModerateImageJson(
  raw: string | null,
): { verdict: 'approved' | 'rejected'; reasons: string[]; confidence: number } | null {
  if (!raw) return null
  const trimmed = raw
    .trim()
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```$/i, '')
  try {
    const parsed = JSON.parse(trimmed) as Record<string, unknown>
    const verdict = parsed.verdict === 'rejected' ? 'rejected' : parsed.verdict === 'approved' ? 'approved' : null
    if (!verdict) return null
    const reasons = Array.isArray(parsed.reasons)
      ? parsed.reasons.map((item) => String(item).trim()).filter(Boolean)
      : []
    const confidence =
      typeof parsed.confidence === 'number' && Number.isFinite(parsed.confidence)
        ? Math.max(0, Math.min(1, parsed.confidence))
        : 0.8
    return { verdict, reasons, confidence }
  } catch {
    return null
  }
}

function parseDescribeSearchImageJson(
  raw: string | null,
): { query: string; category: string | null; attributes: string[] } | null {
  if (!raw) return null
  const trimmed = raw
    .trim()
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```$/i, '')
  try {
    const parsed = JSON.parse(trimmed) as Record<string, unknown>
    const query = typeof parsed.query === 'string' ? parsed.query.trim() : ''
    if (!query) return null
    const category =
      typeof parsed.category === 'string' && parsed.category.trim()
        ? parsed.category.trim()
        : null
    const attributes = Array.isArray(parsed.attributes)
      ? parsed.attributes.map((item) => String(item).trim()).filter(Boolean).slice(0, 8)
      : []
    return { query: query.slice(0, 120), category, attributes }
  } catch {
    // Fallback: treat plain text as the query.
    const plain = trimmed.replace(/^["']|["']$/g, '').trim()
    if (plain.length >= 2 && plain.length <= 120 && !plain.includes('{')) {
      return { query: plain, category: null, attributes: [] }
    }
    return null
  }
}

function parseListingDraftFromImageJson(raw: string | null): {
  title: string
  description: string
  tags: string[]
  suggestedPriceInr: number | null
  categoryHint: string | null
} | null {
  if (!raw) return null
  const trimmed = raw
    .trim()
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```$/i, '')
  try {
    const parsed = JSON.parse(trimmed) as Record<string, unknown>
    const title = typeof parsed.title === 'string' ? parsed.title.trim() : ''
    const description =
      typeof parsed.description === 'string' ? parsed.description.trim() : ''
    if (!title || !description) return null
    const tags = Array.isArray(parsed.tags)
      ? parsed.tags
          .map((item) => String(item).trim().toLowerCase())
          .filter((tag) => tag.length >= 2 && tag.length <= 32)
          .slice(0, 8)
      : []
    const priceRaw = parsed.suggestedPriceInr ?? parsed.suggested_price_inr
    const suggestedPriceInr =
      typeof priceRaw === 'number' && Number.isFinite(priceRaw) && priceRaw > 0
        ? Math.round(priceRaw)
        : typeof priceRaw === 'string' && Number.isFinite(Number(priceRaw))
          ? Math.round(Number(priceRaw))
          : null
    const categoryHint =
      typeof parsed.categoryHint === 'string' && parsed.categoryHint.trim()
        ? parsed.categoryHint.trim()
        : typeof parsed.category === 'string' && parsed.category.trim()
          ? parsed.category.trim()
          : null
    return {
      title: title.slice(0, 120),
      description: description.slice(0, 4000),
      tags,
      suggestedPriceInr,
      categoryHint,
    }
  } catch {
    return null
  }
}

function parseAiSearchJson(
  raw: string | null,
): {
  searchTerm: string
  category: string | null
  minPrice: number | null
  maxPrice: number | null
  listingType: 'physical' | 'digital' | null
  rationale: string
} | null {
  if (!raw) return null
  const trimmed = raw
    .trim()
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```$/i, '')
  try {
    const parsed = JSON.parse(trimmed) as Record<string, unknown>
    const searchTerm =
      typeof parsed.searchTerm === 'string'
        ? parsed.searchTerm.trim()
        : typeof parsed.query === 'string'
          ? parsed.query.trim()
          : ''
    if (!searchTerm) return null
    const minPrice =
      typeof parsed.minPrice === 'number' && Number.isFinite(parsed.minPrice)
        ? parsed.minPrice
        : null
    const maxPrice =
      typeof parsed.maxPrice === 'number' && Number.isFinite(parsed.maxPrice)
        ? parsed.maxPrice
        : null
    const listingType =
      parsed.listingType === 'physical' || parsed.listingType === 'digital'
        ? parsed.listingType
        : null
    const category =
      typeof parsed.category === 'string' && parsed.category.trim()
        ? parsed.category.trim()
        : null
    const rationale =
      typeof parsed.rationale === 'string' && parsed.rationale.trim()
        ? parsed.rationale.trim().slice(0, 280)
        : `Showing results for “${searchTerm}”.`
    return {
      searchTerm: searchTerm.slice(0, 120),
      category,
      minPrice,
      maxPrice,
      listingType,
      rationale,
    }
  } catch {
    return null
  }
}

function fallbackMeetingDraft(prompt: string, _timeZone: string) {
  const lower = prompt.toLowerCase()
  let title = 'Co-Work session'
  if (/\b1\s*:\s*1\b|\bone[\s-]?on[\s-]?one\b/.test(lower)) title = '1:1 sync'
  else if (/\binterview\b/.test(lower)) title = 'Interview session'
  else if (/\bworkshop\b/.test(lower)) title = 'Workshop'
  else if (/\bstandup|stand-up|daily\b/.test(lower)) title = 'Daily standup'
  else if (/\blaunch\b/.test(lower)) title = 'Launch planning'
  else if (/\binvestor\b/.test(lower)) title = 'Investor update'
  else if (/\bweekly\b/.test(lower)) title = 'Weekly team sync'
  else {
    const cleaned = prompt.replace(/\b(tomorrow|today|next|monday|tuesday|wednesday|thursday|friday|saturday|sunday|\d{1,2}\s*(am|pm))\b/gi, '')
      .replace(/\s+/g, ' ')
      .trim()
    if (cleaned.length >= 4) title = cleaned.slice(0, 60)
  }

  const now = new Date()
  const scheduled = new Date(now.getTime() + 24 * 60 * 60 * 1000)
  scheduled.setMinutes(0, 0, 0)
  if (/\btomorrow\b/.test(lower)) {
    scheduled.setDate(now.getDate() + 1)
  }
  const hourMatch = lower.match(/\b(\d{1,2})\s*(am|pm)\b/)
  if (hourMatch) {
    let hour = Number(hourMatch[1])
    const meridiem = hourMatch[2]
    if (meridiem === 'pm' && hour < 12) hour += 12
    if (meridiem === 'am' && hour === 12) hour = 0
    scheduled.setHours(hour, 0, 0, 0)
  } else {
    scheduled.setHours(11, 0, 0, 0)
  }

  const agenda = [
    'Welcome and agenda check',
    'Main discussion / decisions',
    'Next steps and owners',
  ]

  return {
    title,
    description: `Meeting drafted from: “${prompt.trim().slice(0, 160)}”`,
    scheduledAt: scheduled.toISOString(),
    maxParticipants: /\bworkshop|all[\s-]?hands\b/.test(lower) ? 50 : 20,
    agenda,
  }
}

function parsePostDraftJson(raw: string | null): { title: string | null; content: string } | null {
  if (!raw) return null
  const trimmed = raw.trim().replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```$/i, '')
  try {
    const parsed = JSON.parse(trimmed) as Record<string, unknown>
    const content = typeof parsed.content === 'string' ? parsed.content.trim() : ''
    if (!content) return null
    const title =
      typeof parsed.title === 'string' && parsed.title.trim() ? parsed.title.trim() : null
    return { title, content }
  } catch {
    return null
  }
}

function fallbackPostDraft(prompt: string, mode: string) {
  const topic = prompt.trim().slice(0, 120) || 'this week’s update'
  if (mode === 'article') {
    return {
      title: `Notes on ${topic}`,
      content: `I’ve been thinking about ${topic}.\n\nHere’s the short version of what I’m learning, what I’d do differently, and one question for this community.`,
    }
  }
  if (mode === 'celebration') {
    return {
      title: null,
      content: `Excited to celebrate ${topic}! Grateful for everyone who supported this — looking forward to what’s next.`,
    }
  }
  return {
    title: null,
    content: `Sharing a quick update on ${topic}.\n\nWould love perspectives from this community — what’s working for you right now?`,
  }
}

function parseShopDraftJson(
  raw: string | null,
): { names: string[]; description: string } | null {
  if (!raw) return null
  const trimmed = raw.trim().replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```$/i, '')
  try {
    const parsed = JSON.parse(trimmed) as Record<string, unknown>
    const names = Array.isArray(parsed.names)
      ? parsed.names.map((item) => String(item).trim()).filter((item) => item.length >= 2 && item.length <= 80)
      : []
    const description =
      typeof parsed.description === 'string' ? parsed.description.trim().slice(0, 1000) : ''
    if (!names.length) return null
    return { names, description }
  } catch {
    return null
  }
}

function fallbackShopDraft(input: {
  prompt: string
  categories: string[]
  currentName: string
}): { names: string[]; description: string } {
  const category = input.categories[0] || 'handmade goods'
  const seed = input.currentName.trim() || input.prompt.trim().slice(0, 28) || 'Studio'
  const base = seed.replace(/[^a-zA-Z0-9\s&'-]/g, '').trim() || 'Velvet'
  const names = [
    `${base} Collective`,
    `The ${base} Shop`,
    `${base} & Co.`,
    `Maison ${base}`,
    `${base} Atelier`,
    `Little ${base}`,
  ].map((name) => name.slice(0, 40))

  return {
    names,
    description: `A women-owned shop for ${category.toLowerCase()}. Thoughtfully made pieces, honest details, and a warm welcome for every shopper.`,
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ error: 'Unauthorized' }, 401)

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } },
    )

    const service = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    const { data: authData, error: authError } = await supabase.auth.getUser()
    if (authError || !authData.user) return json({ error: 'Unauthorized' }, 401)
    const userId = authData.user.id

    const body = (await req.json()) as AssistBody
    const action = String(body.action ?? '')
    const product = normalizeProduct(body.product)
    const contextPage = typeof body.contextPage === 'string' ? body.contextPage : undefined
    const context =
      body.context && typeof body.context === 'object' && !Array.isArray(body.context)
        ? body.context
        : {}

    if (action === 'suggestions') {
      const suggestions = await loadSuggestions(supabase, product, contextPage)
      return json({ suggestions, product, contextPage: contextPage ?? null })
    }

    if (action === 'comment_suggestions') {
      const postType = typeof context.post_type === 'string' ? context.post_type : ''
      const postContent = typeof context.post_content === 'string' ? context.post_content : ''
      const authorName = typeof context.author_name === 'string' ? context.author_name : ''
      const local = localCommentSuggestionList({
        postType,
        content: postContent,
        authorName,
        eventTitle: typeof context.event_title === 'string' ? context.event_title : '',
        celebrationTitle:
          typeof context.celebration_title === 'string' ? context.celebration_title : '',
        productTitle: typeof context.product_title === 'string' ? context.product_title : '',
        shopName: typeof context.shop_name === 'string' ? context.shop_name : '',
        articleTitle: typeof context.article_title === 'string' ? context.article_title : '',
        hasMedia: Boolean(context.has_media),
      })

      const systemPrompt = [
        'You write short professional comment suggestions for a community feed.',
        'Return ONLY a JSON array of 3 or 4 strings. No markdown fences.',
        'Comments must be warm, specific to the post type, under 140 characters, and never spammy.',
        `Post type: ${postType || 'text'}.`,
        authorName ? `Author: ${authorName}.` : '',
        postContent ? `Post excerpt: ${postContent.slice(0, 400)}` : '',
      ]
        .filter(Boolean)
        .join('\n')

      const completion = await callGemini(
        systemPrompt,
        [],
        'Generate comment suggestions as a JSON string array.',
      )
      const fromModel = parseJsonStringArray(completion.answer)
      return json({
        suggestions: fromModel.length ? fromModel.slice(0, 4) : local,
        usedFallback: !fromModel.length,
        product: 'community',
      })
    }

    if (action === 'meeting_draft') {
      const prompt = typeof body.message === 'string' ? body.message.trim() : ''
      if (!prompt) return json({ error: 'message required' }, 400)
      const timeZone =
        typeof context.time_zone === 'string' && context.time_zone
          ? context.time_zone
          : 'Asia/Kolkata'

      const fallback = fallbackMeetingDraft(prompt, timeZone)
      const systemPrompt = [
        'You draft professional video-meeting details like Zoom / Google Calendar AI.',
        'Return ONLY JSON with keys: title (string), description (string), scheduledAt (ISO 8601 string or null), maxParticipants (number or null), agenda (string array).',
        'Prefer practical titles. Agenda should be 3 short bullets.',
        `User timezone: ${timeZone}. Current time UTC: ${new Date().toISOString()}.`,
        'If the user mentions a relative time (tomorrow, Friday 3pm), resolve scheduledAt in ISO.',
      ].join('\n')

      const completion = await callGemini(systemPrompt, [], prompt)
      const parsed = parseMeetingDraftJson(completion.answer)
      if (parsed) {
        return json({ ...parsed, usedFallback: false, product: 'cowork' })
      }
      return json({ ...fallback, usedFallback: true, product: 'cowork' })
    }

    if (action === 'post_draft') {
      const prompt = typeof body.message === 'string' ? body.message.trim() : ''
      if (!prompt) return json({ error: 'message required' }, 400)
      const composeMode =
        typeof context.compose_mode === 'string' && context.compose_mode
          ? context.compose_mode
          : 'text'
      const fallback = fallbackPostDraft(prompt, composeMode)
      const systemPrompt = [
        'You draft professional community posts for a women-focused platform.',
        'Return ONLY JSON with keys: title (string or null), content (string).',
        'title is required for article mode; otherwise null.',
        'content should be warm, specific, under 900 characters for text modes, under 2500 for article.',
        'No hashtag spam. At most 2 hashtags. No markdown fences.',
        `Compose mode: ${composeMode}.`,
      ].join('\n')

      const completion = await callGemini(systemPrompt, [], prompt)
      const parsed = parsePostDraftJson(completion.answer)
      if (parsed?.content) {
        return json({ ...parsed, usedFallback: false, product: 'community' })
      }
      return json({ ...fallback, usedFallback: true, product: 'community' })
    }

    if (action === 'shop_draft') {
      const prompt =
        typeof body.message === 'string' && body.message.trim()
          ? body.message.trim()
          : 'Suggest shop names and a short description for a women-owned storefront'
      const categories = Array.isArray(context.categories)
        ? context.categories.map((item) => String(item).trim()).filter(Boolean).slice(0, 5)
        : []
      const currentName =
        typeof context.current_name === 'string' ? context.current_name.trim() : ''
      const currentDescription =
        typeof context.current_description === 'string'
          ? context.current_description.trim()
          : ''

      const fallback = fallbackShopDraft({ prompt, categories, currentName })
      const systemPrompt = [
        'You help women entrepreneurs name and describe their SHEconomy storefront.',
        'Return ONLY JSON with keys: names (string array of 4-6 unique shop names), description (one warm storefront blurb, 80-220 characters).',
        'Names must be brandable, memorable, under 40 characters, no trademarked brands, no ALL CAPS spam.',
        'Description should mention what they sell and who they serve. No hashtag spam. No markdown fences.',
        categories.length ? `Categories: ${categories.join(', ')}.` : '',
        currentName ? `Current name draft: ${currentName}.` : '',
        currentDescription ? `Current description draft: ${currentDescription.slice(0, 280)}.` : '',
      ]
        .filter(Boolean)
        .join('\n')

      const completion = await callGemini(systemPrompt, [], prompt)
      const parsed = parseShopDraftJson(completion.answer)
      if (parsed && parsed.names.length) {
        return json({
          names: parsed.names.slice(0, 6),
          description: parsed.description || fallback.description,
          usedFallback: false,
          product: 'shop',
        })
      }
      return json({ ...fallback, usedFallback: true, product: 'shop' })
    }

    if (action === 'feedback') {
      const suggestionId = typeof body.suggestionId === 'string' ? body.suggestionId : ''
      if (!suggestionId) return json({ error: 'suggestionId required' }, 400)

      const { data: row } = await service
        .from('smart_suggestions')
        .select('id, usage_count, success_rate')
        .eq('id', suggestionId)
        .maybeSingle()

      if (row) {
        const usage = (row.usage_count ?? 0) + 1
        const prevRate = Number(row.success_rate ?? 0)
        const helpful = body.helpful !== false
        const successRate = Math.min(
          1,
          Math.max(0, (prevRate * (usage - 1) + (helpful ? 1 : 0)) / usage),
        )
        await service
          .from('smart_suggestions')
          .update({ usage_count: usage, success_rate: successRate, updated_at: new Date().toISOString() })
          .eq('id', suggestionId)
      }

      await service.from('ai_learning_data').insert({
        interaction_id: suggestionId,
        user_feedback: body.helpful === false ? 'not_helpful' : 'helpful',
        feedback_details: typeof body.message === 'string' ? body.message : null,
      })

      return json({ ok: true })
    }

    if (action === 'chat') {
      const message = typeof body.message === 'string' ? body.message.trim() : ''
      if (!message) return json({ error: 'message required' }, 400)

      let sessionId = typeof body.sessionId === 'string' ? body.sessionId : null
      const shoppingQuery = extractShoppingQuery(message)
      const intent = detectIntent(product, message)
      const effectiveProduct = resolveEffectiveProduct(product, intent, shoppingQuery)
      const scheduleRequested = wantsScheduleMeeting(message)
      const timeZone =
        typeof context.time_zone === 'string' && context.time_zone
          ? context.time_zone
          : 'Asia/Kolkata'

      let meetingDraft: ReturnType<typeof fallbackMeetingDraft> | null = null
      if (scheduleRequested) {
        const draftSystem = [
          'You draft professional video-meeting details like Zoom / Google Calendar AI.',
          'Return ONLY JSON with keys: title (string), description (string), scheduledAt (ISO 8601 string or null), maxParticipants (number or null), agenda (string array).',
          'Prefer practical titles. Agenda should be 3 short bullets.',
          `User timezone: ${timeZone}. Current time UTC: ${new Date().toISOString()}.`,
          'If the user mentions a relative time (tomorrow, Friday 3pm), resolve scheduledAt in ISO.',
        ].join('\n')
        const draftCompletion = await callGemini(draftSystem, [], message)
        meetingDraft =
          parseMeetingDraftJson(draftCompletion.answer) ?? fallbackMeetingDraft(message, timeZone)
      }

      const facts = await buildGrounding(service, userId, effectiveProduct, context, message)
      if (meetingDraft) {
        facts.push(
          `Suggested meeting draft: title="${meetingDraft.title}"; when=${meetingDraft.scheduledAt ?? 'unset'}; maxParticipants=${meetingDraft.maxParticipants ?? 'default'}; agenda=${meetingDraft.agenda.join(' | ') || 'none'}; description=${meetingDraft.description.slice(0, 160)}`,
        )
      }
      const listingLinks: DeepLink[] = []
      const matchFact = facts.find((f) => f.startsWith('Matching marketplace listings:'))
      if (matchFact) {
        const parts = matchFact.replace(/^Matching marketplace listings:\s*/, '').split(';')
        for (const part of parts.slice(0, 3)) {
          const href = part.match(/→\s*(\/listing\/[^\s)]+)/)?.[1]
          const title = part.split(' (₹')[0]?.trim()
          if (href && title) listingLinks.push({ label: title.slice(0, 40), href })
        }
      }
      const scheduleHref = meetingDraft
        ? `/co-work/schedule?prompt=${encodeURIComponent(message.slice(0, 240))}`
        : '/co-work/schedule'
      const deepLinks = [
        ...listingLinks,
        ...(meetingDraft
          ? [{ label: 'Create this meeting', href: scheduleHref }]
          : []),
        ...productDeepLinks(effectiveProduct, shoppingQuery),
      ].filter(
        (link, index, arr) =>
          arr.findIndex((other) => other.href === link.href && other.label === link.label) === index,
      )
      const systemPrompt = [
        'You are SHERPA — the in-app assistant for Marketplace, Community, Manage Shop, Chat, Class, and Co-Work.',
        'Answer like a capable product expert: clear, warm, specific, and action-oriented (2–6 short sentences unless the user asks for detail).',
        'Stay on the user’s intent. For shopping, recommend Matching marketplace listings and /search?q=…. Do NOT dump account/settings or unrelated order lists unless asked.',
        'Use grounding facts for personalization. Never invent order numbers, stock, prices, meetings, or listings not in the facts.',
        'Point to real in-app paths (/search, /listing/…, /orders, /cart, /community, /chat, /class, /co-work, /co-work/schedule, /co-work/join, /vendor/myshop, /create-my-shop, /settings, /help).',
        'Prefer concrete next steps. Never ask for passwords or full payment card numbers.',
        scheduleRequested
          ? 'The user wants to SCHEDULE a Co-Work meeting. Use the Suggested meeting draft fact. Tell them the drafted title/time and send them to /co-work/schedule (Create with AI). Do not reply that there are no upcoming meetings as the only answer.'
          : '',
        `Detected intent: ${intent}.`,
        `Product focus: ${effectiveProduct}.`,
        productPlaybook(effectiveProduct),
        `Grounding facts:\n- ${facts.join('\n- ')}`,
      ]
        .filter(Boolean)
        .join('\n')

      if (!sessionId) {
        const { data: session, error: sessionError } = await supabase
          .from('ai_sessions')
          .insert({
            user_id: userId,
            product: effectiveProduct,
            context: { ...context, shopping_query: shoppingQuery, schedule_requested: scheduleRequested },
            title: message.slice(0, 80),
            system_prompt: systemPrompt,
            model: Deno.env.get('GEMINI_MODEL') ?? 'gemini-2.5-pro',
            is_active: true,
          })
          .select('id')
          .single()
        if (sessionError || !session) throw sessionError ?? new Error('Failed to create session')
        sessionId = session.id
      } else {
        await supabase
          .from('ai_sessions')
          .update({
            product: effectiveProduct,
            context: { ...context, shopping_query: shoppingQuery, schedule_requested: scheduleRequested },
            updated_at: new Date().toISOString(),
            system_prompt: systemPrompt,
          })
          .eq('id', sessionId)
          .eq('user_id', userId)
      }

      await supabase.from('ai_messages').insert({
        session_id: sessionId,
        role: 'user',
        content: message,
        metadata: { product: effectiveProduct, shoppingQuery, intent, scheduleRequested, context },
      })

      const { data: history } = await supabase
        .from('ai_messages')
        .select('role, content')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: true })
        .limit(20)

      const prior = (history ?? []).filter((m) => m.content !== message || m.role !== 'user')
      // Exclude the just-inserted user message from history when calling the model (we pass it separately).
      const historyForModel = (history ?? []).slice(0, -1) as ChatMessageRow[]

      const completion = await callGemini(
        systemPrompt,
        historyForModel.length ? historyForModel : prior,
        message,
      )
      let answer = completion.answer
      let usedFallback = !answer
      const fallbackReason = usedFallback
        ? completion.error?.includes('missing_gemini_api_key')
          ? 'missing_gemini_api_key'
          : completion.error?.includes('429')
            ? 'gemini_quota_exceeded'
            : 'gemini_request_failed'
        : null
      if (!answer) {
        answer = meetingDraft
          ? formatMeetingDraftReply(meetingDraft)
          : fallbackReply(effectiveProduct, message, facts)
      } else if (
        meetingDraft &&
        /no upcoming hosted meetings/i.test(answer) &&
        !/\/co-work\/schedule/i.test(answer)
      ) {
        // Model drifted into list-meetings mode — replace with schedule guidance.
        answer = formatMeetingDraftReply(meetingDraft)
        usedFallback = false
      }

      await supabase.from('ai_messages').insert({
        session_id: sessionId,
        role: 'assistant',
        content: answer,
        metadata: {
          product: effectiveProduct,
          shoppingQuery,
          intent,
          scheduleRequested,
          meetingDraft,
          usedFallback,
          fallbackReason,
          geminiError: completion.error,
          geminiModel: completion.model,
          geminiKeySource: completion.keySource,
          deepLinks,
        },
      })

      await supabase
        .from('ai_sessions')
        .update({
          updated_at: new Date().toISOString(),
          ...(completion.model ? { model: completion.model } : {}),
        })
        .eq('id', sessionId)

      return json({
        sessionId,
        answer,
        deepLinks,
        usedFallback,
        fallbackReason,
        geminiError: usedFallback ? completion.error : null,
        meetingDraft,
        product: effectiveProduct,
      })
    }

    if (action === 'translate') {
      const text = typeof body.message === 'string' ? body.message.trim() : ''
      if (!text) return json({ error: 'message required' }, 400)

      const targetLang =
        typeof context.target_lang === 'string' && context.target_lang.trim()
          ? context.target_lang.trim().toLowerCase()
          : 'en'
      const sourceLang =
        typeof context.source_lang === 'string' && context.source_lang.trim()
          ? context.source_lang.trim().toLowerCase()
          : 'auto'
      const targetLabel =
        typeof context.target_label === 'string' && context.target_label.trim()
          ? context.target_label.trim()
          : targetLang
      const targetBase = targetLang.split('-')[0] || targetLang
      const sourceBase = sourceLang === 'auto' ? 'auto' : sourceLang.split('-')[0] || sourceLang

      // Fast path: identical language codes → skip model.
      if (sourceBase !== 'auto' && sourceBase === targetBase) {
        return json({
          text,
          translatedText: text,
          detectedSourceLang: sourceBase,
          targetLang: targetBase,
          usedFallback: false,
          skipped: true,
          product: 'cowork',
        })
      }

      const systemPrompt = [
        'You are a live meeting caption translator (Zoom / Google Meet style).',
        'Detect the source language automatically unless source is provided.',
        `ALWAYS translate the caption into ${targetLabel} (language code: ${targetBase}).`,
        'Never leave the text in the source language when the target differs.',
        'Example: English "hello" → Hindi "नमस्ते"; Hindi "नमस्ते" → English "hello".',
        'Return ONLY JSON: {"translatedText":"...","detectedSourceLang":"xx"}',
        'Keep speaker meaning, names, numbers, and punctuation. Do not add commentary.',
        'Only return the text unchanged when it is already written in the target language/script.',
        sourceBase !== 'auto' ? `Hint source language code: ${sourceBase}.` : '',
      ]
        .filter(Boolean)
        .join('\n')

      const completion = await callGemini(systemPrompt, [], text)
      const parsed = parseTranslateJson(completion.answer)
      const geminiText = parsed?.translatedText?.trim() || ''
      // Require target-script match — a lightly rewritten English string is NOT a Hindi/Chinese caption.
      const geminiLooksGood =
        !!geminiText && captionLooksLikeTargetLang(geminiText, targetBase)

      if (geminiLooksGood) {
        return json({
          text,
          translatedText: geminiText,
          detectedSourceLang: parsed?.detectedSourceLang ?? (sourceBase === 'auto' ? null : sourceBase),
          targetLang: targetBase,
          usedFallback: false,
          product: 'cowork',
        })
      }

      // Prefer auto-detect → target for MyMemory when Gemini missed the script.
      const memory =
        (await translateViaMyMemory(text, targetBase, 'auto')) ||
        (await translateViaMyMemory(text, targetBase, sourceBase === 'auto' ? 'en' : sourceBase))
      if (
        memory?.translatedText &&
        memory.translatedText !== text &&
        captionLooksLikeTargetLang(memory.translatedText, targetBase)
      ) {
        return json({
          text,
          translatedText: memory.translatedText,
          detectedSourceLang: memory.detectedSourceLang,
          targetLang: targetBase,
          usedFallback: false,
          provider: 'mymemory',
          product: 'cowork',
        })
      }

      // Last resort: return original so captions never go blank mid-call.
      return json({
        text,
        translatedText: text,
        detectedSourceLang: sourceBase === 'auto' ? null : sourceBase,
        targetLang: targetBase,
        usedFallback: true,
        product: 'cowork',
      })
    }

    if (action === 'moderate_image') {
      const dataUrl = typeof body.message === 'string' ? body.message.trim() : ''
      if (!dataUrl.startsWith('data:image/')) {
        return json({ error: 'message must be a data:image URL' }, 400)
      }

      const systemPrompt = [
        'You are a marketplace listing image safety moderator for a women-focused commerce platform.',
        'Reject sexual content, pornography, graphic violence, hate symbols, and illegal goods imagery.',
        'Approve normal product photos, fashion, food, crafts, and lifestyle images.',
        'Return ONLY JSON: {"verdict":"approved"|"rejected","reasons":["..."],"confidence":0-1}',
      ].join('\n')

      const completion = await callGeminiVision(systemPrompt, dataUrl)
      const parsed = parseModerateImageJson(completion.answer)
      if (parsed) {
        return json({ ...parsed, usedFallback: false, product: 'commerce' })
      }

      // Fail closed when the model does not respond cleanly.
      return json({
        verdict: 'rejected',
        reasons: ['moderation_unavailable'],
        confidence: 1,
        usedFallback: true,
        product: 'commerce',
      })
    }

    if (action === 'describe_search_image') {
      const dataUrl = typeof body.message === 'string' ? body.message.trim() : ''
      if (!dataUrl.startsWith('data:image/')) {
        return json({ error: 'message must be a data:image URL' }, 400)
      }

      const systemPrompt = [
        'You turn product photos into marketplace search keywords for SHEconomy.',
        'Identify the main sellable product (fashion, home, beauty, craft, food, digital goods).',
        'Ignore people faces, backgrounds, and watermarks unless they define the product.',
        'Prefer short searchable terms shoppers would type (e.g. "red georgette saree", "ceramic wall planter").',
        'Do not mention Gemini, Google, or model names.',
        'Return ONLY JSON: {"query":"2-6 word search phrase","category":"optional category","attributes":["color","material","style"]}',
      ].join('\n')

      const completion = await callGeminiVision(
        systemPrompt,
        dataUrl,
        'Describe this product for marketplace search.',
        { jsonMode: true },
      )
      const parsed = parseDescribeSearchImageJson(completion.answer)
      if (parsed) {
        return json({
          query: parsed.query,
          category: parsed.category,
          attributes: parsed.attributes,
          usedFallback: false,
          product: 'commerce',
        })
      }

      console.error('describe_search_image failed:', completion.error)
      const failure = visionFailureMessage(completion.error)
      return json({ error: failure.error, code: 'image_search_failed' }, failure.status)
    }

    if (action === 'listing_draft_from_image') {
      const dataUrl = typeof body.message === 'string' ? body.message.trim() : ''
      if (!dataUrl.startsWith('data:image/')) {
        return json({ error: 'message must be a data:image URL' }, 400)
      }

      const systemPrompt = [
        'You help women entrepreneurs list products on SHEconomy marketplace.',
        'From the product photo, draft sell-ready listing copy.',
        'Focus on the product (fashion, home, beauty, craft, food, digital goods). Ignore faces and clutter.',
        'Title: specific, benefit-led, under 80 characters, no ALL CAPS spam, no trademarked brands.',
        'Description: warm, concrete materials/fit/use, 60-180 words, no hashtag walls, no markdown.',
        'Tags: 3-6 short lowercase keywords shoppers search.',
        'suggestedPriceInr: rough India rupee retail guess as integer, or null if unclear.',
        'categoryHint: short category label or null.',
        'Do not mention Gemini, Google, or model names.',
        'Return ONLY JSON: {"title":"...","description":"...","tags":["..."],"suggestedPriceInr":null,"categoryHint":null}',
      ].join('\n')

      const completion = await callGeminiVision(
        systemPrompt,
        dataUrl,
        'Draft a marketplace listing from this product photo.',
        { jsonMode: true },
      )
      const parsed = parseListingDraftFromImageJson(completion.answer)
      if (parsed) {
        return json({
          title: parsed.title,
          description: parsed.description,
          tags: parsed.tags,
          suggestedPriceInr: parsed.suggestedPriceInr,
          categoryHint: parsed.categoryHint,
          usedFallback: false,
          product: 'commerce',
        })
      }

      console.error('listing_draft_from_image failed:', completion.error)
      const failure = visionFailureMessage(completion.error)
      return json({ error: failure.error, code: 'listing_draft_failed' }, failure.status)
    }

    if (action === 'ai_search') {
      const message = typeof body.message === 'string' ? body.message.trim() : ''
      if (!message) return json({ error: 'message is required' }, 400)

      const systemPrompt = [
        'You are SHEconomy shopping search. Convert natural language into structured marketplace search.',
        'Extract a concise searchTerm (1-5 words of searchable product/brand keywords), optional INR price bounds, optional listingType physical|digital, optional category, and a short shopper-facing rationale.',
        'If the user typed a shop or brand name (even alone), keep that name as the searchTerm. Do not pad brand/shop queries with category words like "ayurvedic", "organic", "personal care", or "wellness".',
        'Do not mention Gemini, Google, or model names in rationale.',
        'Return ONLY JSON: {"searchTerm":"...","category":null,"minPrice":null,"maxPrice":null,"listingType":null,"rationale":"..."}',
      ].join('\n')

      const completion = await callGemini(systemPrompt, [], message)
      const parsed =
        parseAiSearchJson(completion.answer) ??
        (() => {
          const fallbackTerm = extractShoppingQuery(message) || message.slice(0, 80)
          return {
            searchTerm: fallbackTerm,
            category: null as string | null,
            minPrice: null as number | null,
            maxPrice: null as number | null,
            listingType: null as 'physical' | 'digital' | null,
            rationale: `Showing results for “${fallbackTerm}”.`,
          }
        })()

      const matches = await searchListingsForQuery(service, parsed.searchTerm, {
        limit: 12,
        minPrice: parsed.minPrice,
        maxPrice: parsed.maxPrice,
        listingType: parsed.listingType,
      })

      const listingIds = matches.map((row) => row.id).filter(Boolean)
      const deepLinks = [
        {
          label: `Search “${parsed.searchTerm}”`,
          href: `/search?q=${encodeURIComponent(parsed.searchTerm)}&scope=listings`,
        },
        ...matches.slice(0, 5).map((row) => ({
          label: row.title,
          href: `/listing/${row.slug}`,
        })),
      ]

      return json({
        answer: parsed.rationale,
        searchTerm: parsed.searchTerm,
        filters: {
          minPrice: parsed.minPrice,
          maxPrice: parsed.maxPrice,
          listingType: parsed.listingType,
          category: parsed.category,
        },
        listingIds,
        deepLinks,
        usedFallback: !completion.answer || Boolean(completion.error),
        product: 'commerce',
      })
    }

    return json(
      {
        error:
          'Unknown action. Use suggestions | chat | feedback | comment_suggestions | meeting_draft | post_draft | shop_draft | translate | moderate_image | describe_search_image | listing_draft_from_image | ai_search.',
      },
      400,
    )
  } catch (error) {
    console.error('ai-assist error:', error)
    return json(
      { error: error instanceof Error ? error.message : 'Internal error' },
      500,
    )
  }
})
