import type { SearchScope } from '~/lib/search/types'

const PEOPLE =
  /\b(entrepren\w*|enterpren\w*|founders?|business owners?|people|members|profiles)\b/i
const SHOP = /\b(shops?|stores?|sellers?)\b/i
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

/** What the typed sentence is asking for. Product words stay on listings. */
export function suggestIntent(query: string): SuggestIntent {
  const lower = query.toLowerCase()
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

export function suggestHint(query: string): string {
  switch (suggestIntent(query)) {
    case 'person':
      return 'Find people who match this'
    case 'shop':
      return 'Find shops that match this'
    case 'job':
      return 'Find jobs that match this'
    case 'program':
      return 'Find classes that match this'
    case 'post':
      return 'Find posts that match this'
    case 'company':
      return 'Find companies that match this'
    default:
      return 'Find products that match this'
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
