import { PUBLIC_SUPABASE_ANON_KEY, PUBLIC_SUPABASE_URL } from '~/config/supabase-public'

import {
  entriesFromCatalog,
  type SitemapCategory,
  type SitemapCmsRow,
  type SitemapListing,
  type SitemapShop,
} from '~/lib/seo/sitemap'

const PAGE_SIZE = 1000
const MAX_ROWS = 10000

async function restGet<T>(pathAndQuery: string): Promise<T[]> {
  const rows: T[] = []
  for (let offset = 0; offset < MAX_ROWS; offset += PAGE_SIZE) {
    const joiner = pathAndQuery.includes('?') ? '&' : '?'
    const url = `${PUBLIC_SUPABASE_URL}/rest/v1/${pathAndQuery}${joiner}limit=${PAGE_SIZE}&offset=${offset}`
    try {
      const response = await fetch(url, {
        headers: {
          apikey: PUBLIC_SUPABASE_ANON_KEY,
          Authorization: `Bearer ${PUBLIC_SUPABASE_ANON_KEY}`,
          Accept: 'application/json',
        },
      })
      if (!response.ok) break
      const batch = (await response.json()) as unknown
      if (!Array.isArray(batch) || batch.length === 0) break
      rows.push(...(batch as T[]))
      if (batch.length < PAGE_SIZE) break
    } catch {
      break
    }
  }
  return rows
}

/** Public catalog URLs for the sitemap. A failed query omits that section and keeps the rest. */
export async function loadPublicSitemapEntries() {
  const [listings, shops, categories, cms] = await Promise.all([
    restGet<SitemapListing>(
      'listings?select=id,slug,title,updated_at&is_active=eq.true&listing_status=eq.active',
    ),
    restGet<SitemapShop>(
      'shops?select=id,slug,shop_name,updated_at,robots_index&is_active=eq.true',
    ),
    restGet<SitemapCategory>(
      'categories?select=category_id,category,seo_name,updated_at&status=eq.A&lang_code=eq.en',
    ),
    restGet<SitemapCmsRow>('cms_sitemap_feed?select=path,last_modified'),
  ])

  return entriesFromCatalog({ listings, shops, categories, cms })
}
