import { categoryTreeBranch, categoryTreeFilter } from '~/commerce/lib/category-tree'
import { isStorefrontCategoryVisible } from '~/commerce/lib/category-visibility'
import { ACTIVE_LISTING_FILTER } from '~/commerce/lib/listing-visibility'
import { getCategorySlug } from '~/commerce/lib/seo-urls'
import { supabase } from '~/lib/supabase/client'

const ACTIVE = ACTIVE_LISTING_FILTER
const FACET_LISTING_BATCH = 500
const FACET_MAX_LISTINGS = 5000
const ID_CHUNK = 200

export type FacetOption = {
  value: string
  label: string
  count: number
}

export type FacetGroup = {
  name: string
  options: FacetOption[]
}

export type CategoryFilterFacets = {
  subcategories: Array<{
    categoryId: string
    name: string
    slug: string
    count: number
  }>
  priceRange: { min: number; max: number }
  listingTypes: Array<{
    type: 'physical' | 'digital'
    label: string
    count: number
  }>
  shops: Array<{
    shopId: string
    name: string
    slug: string | null
    count: number
  }>
  variants: FacetGroup[]
  ratingBuckets: FacetOption[]
  onSaleCount: number
  totalListings: number
}

/** Same inventory rules as catalog feeds — active listings with at least one image. */
const FACET_LISTING_SELECT = `
  id,
  price,
  shop_id,
  average_rating,
  listing_type,
  listing_images!inner(id),
  shops!inner(shop_name, slug, is_active, verified),
  category_assignments!inner(category_id, categories!inner(id_path))
`

type ListingFacetRow = {
  id: string
  price: number
  shop_id: string
  average_rating: number | null
  listing_type: string
  shops: { shop_name: string; slug: string | null } | null
  category_assignments?: { category_id: string; categories: { id_path: string | null } | null }[]
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size))
  }
  return out
}

function intersectIds(a: string[], b: string[]): string[] {
  const set = new Set(b)
  return a.filter((id) => set.has(id))
}

function isDiscountActive(profile: {
  is_active: boolean
  valid_from: string
  valid_until: string | null
}): boolean {
  if (!profile.is_active) return false
  const now = Date.now()
  const from = new Date(profile.valid_from).getTime()
  if (Number.isNaN(from) || from > now) return false
  if (!profile.valid_until) return true
  const until = new Date(profile.valid_until).getTime()
  return !Number.isNaN(until) && until >= now
}

/** Exactly the listed categories, or a category with everything under it. */
type CategoryScope = { ids: string[] } | { treeCategoryId: string }

async function fetchCategoryListingRows(scope: CategoryScope): Promise<ListingFacetRow[]> {
  const rows: ListingFacetRow[] = []
  let page = 0

  while (rows.length < FACET_MAX_LISTINGS) {
    const from = page * FACET_LISTING_BATCH
    const to = from + FACET_LISTING_BATCH - 1

    const base = supabase.from('listings').select(FACET_LISTING_SELECT)
    const scoped =
      'ids' in scope
        ? base.in('category_assignments.category_id', scope.ids)
        : base.or(categoryTreeFilter(scope.treeCategoryId), {
            referencedTable: 'category_assignments.categories',
          })

    const { data, error } = await scoped
      .eq('is_active', ACTIVE.is_active)
      .eq('listing_status', ACTIVE.listing_status)
      .eq('shops.is_active', true)
      .eq('shops.verified', true)
      .range(from, to)

    if (error || !data?.length) break

    rows.push(...(data as ListingFacetRow[]))
    if (data.length < FACET_LISTING_BATCH) break
    page += 1
  }

  return rows
}

export async function getCategoryListingIds(categoryIds: string[]): Promise<string[]> {
  const rows = await fetchCategoryListingRows({ ids: categoryIds })
  return rows.map((row) => row.id)
}

export async function getOnSaleListingIds(listingIds: string[]): Promise<string[]> {
  if (!listingIds.length) return []

  const onSale = new Set<string>()

  for (const ids of chunk(listingIds, ID_CHUNK)) {
    const { data } = await supabase
      .from('listing_discounts')
      .select('listing_id, discount_profiles!inner(is_active, valid_from, valid_until)')
      .in('listing_id', ids)

    for (const row of data ?? []) {
      const profile = row.discount_profiles as {
        is_active: boolean
        valid_from: string
        valid_until: string | null
      } | null
      if (profile && isDiscountActive(profile)) {
        onSale.add(row.listing_id)
      }
    }
  }

  return [...onSale]
}

export async function filterListingIdsByVariants(
  listingIds: string[],
  variants: Record<string, string[]>,
): Promise<string[]> {
  const groups = Object.entries(variants).filter(([, values]) => values.length > 0)
  if (!groups.length || !listingIds.length) return listingIds

  const listingTraits = new Map<string, Map<string, Set<string>>>()

  function addTrait(listingId: string, name: string, value: string) {
    const normalizedName = name.trim()
    const normalizedValue = value.trim()
    if (!normalizedName || !normalizedValue) return

    const traits = listingTraits.get(listingId) ?? new Map<string, Set<string>>()
    const values = traits.get(normalizedName) ?? new Set<string>()
    values.add(normalizedValue)
    traits.set(normalizedName, values)
    listingTraits.set(listingId, traits)
  }

  for (const ids of chunk(listingIds, ID_CHUNK)) {
    const [{ data: variations }, { data: attributes }] = await Promise.all([
      supabase
        .from('listing_variations')
        .select('listing_id, variation_name, variation_value')
        .in('listing_id', ids)
        .eq('is_available', true),
      supabase
        .from('listing_attributes')
        .select('listing_id, attribute_name, attribute_value')
        .in('listing_id', ids),
    ])

    for (const row of variations ?? []) {
      addTrait(row.listing_id, row.variation_name, row.variation_value)
    }
    for (const row of attributes ?? []) {
      addTrait(row.listing_id, row.attribute_name, row.attribute_value)
    }
  }

  return listingIds.filter((listingId) => {
    const traits = listingTraits.get(listingId)
    if (!traits) return false

    return groups.every(([name, selectedValues]) => {
      const available = traits.get(name)
      if (!available) return false
      return selectedValues.some((value) => available.has(value))
    })
  })
}

export async function resolveCategoryListingIdConstraint(
  categoryIds: string[],
  options: {
    onSale?: boolean
    variants?: Record<string, string[]>
  },
): Promise<string[] | null> {
  const needsSale = options.onSale === true
  const needsVariants = !!options.variants && Object.values(options.variants).some((v) => v.length > 0)

  if (!needsSale && !needsVariants) return null

  const baseIds = await getCategoryListingIds(categoryIds)
  if (!baseIds.length) return []

  let constrained = baseIds

  if (needsSale) {
    constrained = intersectIds(constrained, await getOnSaleListingIds(constrained))
  }

  if (needsVariants && options.variants) {
    constrained = await filterListingIdsByVariants(constrained, options.variants)
  }

  return constrained
}

export async function fetchCategoryFilterFacets(categoryId: string): Promise<{
  data: CategoryFilterFacets | null
  error: string | null
}> {
  try {
    const [{ data: subcats, error: subError }, listingRows] = await Promise.all([
      supabase
        .from('categories')
        .select('category_id, category, seo_name, product_count')
        .eq('parent_id', categoryId)
        .eq('status', 'A')
        .order('position', { ascending: true }),
      fetchCategoryListingRows({ treeCategoryId: categoryId }),
    ])

    if (subError) {
      return { data: null, error: subError.message }
    }

    const listingIds = listingRows.map((row) => row.id)

    // Listings hang off leaf categories, so a subcategory chip counts its own
    // subtree: every listing whose assignment path runs through it.
    const subcategoryListings = new Map<string, Set<string>>()
    for (const row of listingRows) {
      for (const assignment of row.category_assignments ?? []) {
        const branch = categoryTreeBranch(categoryId, assignment.categories?.id_path)
        if (!branch) continue
        const listings = subcategoryListings.get(branch) ?? new Set<string>()
        listings.add(row.id)
        subcategoryListings.set(branch, listings)
      }
    }

    const shopMap = new Map<string, { name: string; slug: string | null; count: number }>()
    const variantListingMap = new Map<string, Map<string, Set<string>>>()
    const prices: number[] = []
    const listingTypeCounts = { physical: 0, digital: 0 }
    const ratingCounts = { five: 0, four: 0, three: 0, two: 0, one: 0 }

    for (const row of listingRows) {
      prices.push(row.price)

      if (row.listing_type === 'physical') listingTypeCounts.physical += 1
      else if (row.listing_type === 'digital') listingTypeCounts.digital += 1

      const shopId = row.shop_id
      const shopName = row.shops?.shop_name ?? 'Shop'
      const existingShop = shopMap.get(shopId)
      shopMap.set(shopId, {
        name: shopName,
        slug: row.shops?.slug ?? null,
        count: (existingShop?.count ?? 0) + 1,
      })

      const rating = row.average_rating ?? 0
      if (rating >= 4.5) ratingCounts.five += 1
      else if (rating >= 3.5) ratingCounts.four += 1
      else if (rating >= 2.5) ratingCounts.three += 1
      else if (rating >= 1.5) ratingCounts.two += 1
      else if (rating > 0) ratingCounts.one += 1
    }

    for (const ids of chunk(listingIds, ID_CHUNK)) {
      const [{ data: variations }, { data: attributes }] = await Promise.all([
        supabase
          .from('listing_variations')
          .select('listing_id, variation_name, variation_value')
          .in('listing_id', ids)
          .eq('is_available', true),
        supabase
          .from('listing_attributes')
          .select('listing_id, attribute_name, attribute_value')
          .in('listing_id', ids),
      ])

      const bump = (listingId: string, name: string, value: string) => {
        const trimmedName = name.trim()
        const trimmedValue = value.trim()
        if (!trimmedName || !trimmedValue) return
        const values = variantListingMap.get(trimmedName) ?? new Map<string, Set<string>>()
        const listings = values.get(trimmedValue) ?? new Set<string>()
        listings.add(listingId)
        values.set(trimmedValue, listings)
        variantListingMap.set(trimmedName, values)
      }

      for (const row of variations ?? []) {
        bump(row.listing_id, row.variation_name, row.variation_value)
      }
      for (const row of attributes ?? []) {
        bump(row.listing_id, row.attribute_name, row.attribute_value)
      }
    }

    const onSaleIds = await getOnSaleListingIds(listingIds)

    const minPrice = prices.length ? Math.floor(Math.min(...prices)) : 0
    const maxPrice = prices.length ? Math.ceil(Math.max(...prices)) : 0

    const variants: FacetGroup[] = [...variantListingMap.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([name, values]) => ({
        name,
        options: [...values.entries()]
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([value, listings]) => ({ value, label: value, count: listings.size }))
          .filter((option) => option.count > 0),
      }))
      .filter((group) => group.options.length > 0)

    const ratingBuckets: FacetOption[] = [
      { value: '4', label: '4+ stars', count: ratingCounts.five + ratingCounts.four },
      { value: '3', label: '3+ stars', count: ratingCounts.five + ratingCounts.four + ratingCounts.three },
      { value: '2', label: '2+ stars', count: listingRows.filter((r) => (r.average_rating ?? 0) >= 2).length },
      { value: '1', label: '1+ stars', count: listingRows.filter((r) => (r.average_rating ?? 0) >= 1).length },
    ].filter((bucket) => bucket.count > 0)

    const listingTypes = [
      { type: 'physical' as const, label: 'Ships to you', count: listingTypeCounts.physical },
      { type: 'digital' as const, label: 'Instant delivery', count: listingTypeCounts.digital },
    ].filter((row) => row.count > 0)

    const shops = [...shopMap.entries()]
      .map(([shopId, shop]) => ({
        shopId,
        name: shop.name,
        slug: shop.slug,
        count: shop.count,
      }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
      .filter((shop) => shop.count > 0)

    return {
      data: {
        subcategories: (subcats ?? [])
          .filter(isStorefrontCategoryVisible)
          .map((row) => ({
            categoryId: row.category_id,
            name: row.category,
            slug: getCategorySlug(row),
            count: subcategoryListings.get(row.category_id)?.size ?? 0,
          }))
          .filter((row) => row.count > 0),
        priceRange: { min: minPrice, max: maxPrice },
        listingTypes,
        shops,
        variants,
        ratingBuckets,
        onSaleCount: onSaleIds.length,
        totalListings: listingRows.length,
      },
      error: null,
    }
  } catch (err) {
    return {
      data: null,
      error: err instanceof Error ? err.message : 'Failed to load filters',
    }
  }
}

export function getAvailableSortOptions(facets: CategoryFilterFacets) {
  const options = LISTING_SORT_OPTIONS.filter((option) => {
    if (option.value === 'relevance' || option.value === 'newest') return facets.totalListings > 0
    if (option.value === 'price_asc' || option.value === 'price_desc') {
      return facets.totalListings > 0 && facets.priceRange.max > facets.priceRange.min
    }
    if (option.value === 'rating') return facets.ratingBuckets.length > 0
    return false
  })
  return options
}

export function hasCategoryFilterOptions(facets: CategoryFilterFacets): boolean {
  return (
    facets.totalListings > 0 &&
    (facets.subcategories.length > 0 ||
      facets.listingTypes.length > 1 ||
      facets.priceRange.max > facets.priceRange.min ||
      facets.onSaleCount > 0 ||
      facets.variants.length > 0 ||
      facets.ratingBuckets.length > 0 ||
      facets.shops.length > 1)
  )
}

const LISTING_SORT_OPTIONS = [
  { value: 'relevance' as const, label: 'Relevance' },
  { value: 'newest' as const, label: 'Newest' },
  { value: 'price_asc' as const, label: 'Price: low to high' },
  { value: 'price_desc' as const, label: 'Price: high to low' },
  { value: 'rating' as const, label: 'Top rated' },
]
