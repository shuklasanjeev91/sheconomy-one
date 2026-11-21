import type { SearchHit, SearchScope } from '~/lib/search/types'

const PEOPLE =
  /\b(entrepren\w*|enterpren\w*|founders?|business owners?|people|members|profiles)\b/i
const SHOP = /\b(shops?|stores?|sellers?)\b/i
const SHOP_SETUP = /\b(how|open|create)\b/i
const SELLER_ADMIN = /\b(manage shop|low stock|payouts?|inventory|fulfill|my shop)\b/i
const PRODUCT =
  /\b(t[\s-]?shirts?|sarees?|lehengas?|kurtas?|kurtis?|sherwanis?|jeans|dresses?|shoes?|bags?|gifts?|clothes|clothing|outfits?|apparel)\b|\bshop\s+for\b/i
const JOB = /\b(jobs?|hiring|openings?)\b/i
const PROGRAM = /\b(courses?|classes|class|programs?|lessons?)\b/i
const POST = /\b(posts?|feed)\b/i
const COMPANY = /\b(compan(?:y|ies))\b/i

const SKIP = new Set([
  'top',
  'near',
  'from',
  'with',
  'give',
  'list',
  'show',
  'find',
  'want',
  'need',
  'best',
  'please',
  'that',
  'this',
  'your',
  'about',
  'the',
  'and',
  'for',
  'women',
  'woman',
  'men',
  'man',
  'shops',
  'shop',
  'stores',
  'store',
  'sellers',
  'seller',
  'people',
  'members',
  'profiles',
  'jobs',
  'job',
])

export type SuggestIntent = 'person' | 'shop' | 'job' | 'program' | 'post' | 'company' | 'listing'

/** “How do I open or create a shop” is setup help, not a directory of shops. */
export function isShopSetupQuestion(query: string): boolean {
  return SHOP.test(query) && SHOP_SETUP.test(query)
}

/** What the typed sentence is asking for. Product words stay on listings. */
export function suggestIntent(query: string): SuggestIntent {
  const lower = query.toLowerCase()
  if (isShopSetupQuestion(lower)) return 'listing'
  if (PRODUCT.test(lower)) return 'listing'
  if (PEOPLE.test(lower)) return 'person'
  if (SHOP.test(lower) && !SELLER_ADMIN.test(lower)) return 'shop'
  if (JOB.test(lower)) return 'job'
  if (PROGRAM.test(lower)) return 'program'
  if (POST.test(lower)) return 'post'
  if (COMPANY.test(lower)) return 'company'
  return 'listing'
}

export function suggestScope(query: string): SearchScope | null {
  if (isShopSetupQuestion(query)) return 'listings'
  switch (suggestIntent(query)) {
    case 'person':
      return 'people'
    case 'shop':
      return 'shops'
    case 'job':
      return 'jobs'
    case 'program':
      return 'programs'
    case 'post':
      return 'posts'
    case 'company':
      return 'companies'
    default:
      return null
  }
}

export function suggestAsksForWomen(query: string): boolean {
  return /\b(women|woman)\b/i.test(query)
}

/** Words worth matching in a name, headline, or shop description. */
export function suggestFocusTokens(query: string): string[] {
  const tokens: string[] = []
  for (const raw of query.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/)) {
    if (!raw || SKIP.has(raw) || raw.length < 4 || /^\d+$/.test(raw)) continue
    if (raw.startsWith('entrepren') || raw.startsWith('enterpren')) {
      tokens.push('entrepreneur', 'founder')
      continue
    }
    tokens.push(raw)
  }
  return [...new Set(tokens)]
}

const HIT_ORDER: SearchHit['kind'][] = [
  'person',
  'shop',
  'listing',
  'company',
  'group',
  'job',
  'post',
  'program',
  'meeting',
  'category',
]

/** A short name, with no product or place words, is likely a person. */
export function looksLikePersonName(query: string): boolean {
  const lower = query.toLowerCase()
  if (
    PRODUCT.test(lower) ||
    SHOP.test(lower) ||
    JOB.test(lower) ||
    PROGRAM.test(lower) ||
    POST.test(lower) ||
    COMPANY.test(lower) ||
    isShopSetupQuestion(lower)
  ) {
    return false
  }
  const tokens = query.trim().split(/\s+/).filter(Boolean)
  if (tokens.length === 0 || tokens.length > 3) return false
  return tokens.every((token) => /^[A-Za-z][A-Za-z.'-]{1,}$/.test(token))
}

/** Global result order. The sentence's subject leads; every other kind still follows. */
export function suggestHitOrder(query: string): SearchHit['kind'][] {
  const lead: SearchHit['kind'] | null = looksLikePersonName(query)
    ? 'person'
    : suggestIntent(query) === 'person'
      ? 'person'
      : suggestIntent(query) === 'shop'
        ? 'shop'
        : suggestIntent(query) === 'job'
          ? 'job'
          : suggestIntent(query) === 'program'
            ? 'program'
            : suggestIntent(query) === 'post'
              ? 'post'
              : suggestIntent(query) === 'company'
                ? 'company'
                : null
  if (!lead) return HIT_ORDER
  return [lead, ...HIT_ORDER.filter((kind) => kind !== lead)]
}

export function orderSuggestHits(hits: SearchHit[], query: string): SearchHit[] {
  const buckets = new Map<SearchHit['kind'], SearchHit[]>()
  for (const hit of hits) {
    const list = buckets.get(hit.kind) ?? []
    list.push(hit)
    buckets.set(hit.kind, list)
  }
  return suggestHitOrder(query).flatMap((kind) => buckets.get(kind) ?? [])
}

export function suggestHitSectionLabel(kind: SearchHit['kind']): string {
  switch (kind) {
    case 'listing':
      return 'PRODUCTS'
    case 'shop':
      return 'SHOPS'
    case 'person':
      return 'PEOPLE'
    case 'company':
      return 'PAGES'
    case 'group':
      return 'GROUPS'
    case 'job':
      return 'JOBS'
    case 'post':
      return 'POSTS'
    case 'program':
      return 'CLASSES'
    case 'meeting':
      return 'MEETINGS'
    case 'category':
      return 'CATEGORIES'
  }
}

export function suggestHint(query: string): string {
  switch (suggestIntent(query)) {
    case 'person':
      return 'Search people, plus products, shops, pages, and groups'
    case 'shop':
      return 'Search shops, plus products, people, pages, and groups'
    case 'job':
      return 'Search jobs, plus people, companies, and posts'
    case 'program':
      return 'Search classes, plus people, posts, and products'
    case 'post':
      return 'Search posts, plus people, groups, and products'
    case 'company':
      return 'Search pages, plus people, jobs, and products'
    default:
      return looksLikePersonName(query)
        ? 'Search people, products, shops, pages, and groups'
        : 'Search products, shops, people, pages, groups, and more'
  }
}

export function suggestSectionLabel(query: string): string {
  switch (suggestIntent(query)) {
    case 'person':
      return 'PEOPLE'
    case 'shop':
      return 'SHOPS'
    case 'job':
      return 'JOBS'
    case 'program':
      return 'CLASSES'
    case 'post':
      return 'POSTS'
    case 'company':
      return 'COMPANIES'
    default:
      return 'SUGGESTIONS'
  }
}
