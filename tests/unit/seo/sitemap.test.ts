import { describe, expect, it } from 'vitest'

import { buildSitemapXml, entriesFromCatalog, SITEMAP_ORIGIN } from '~/lib/seo/sitemap'

describe('sitemap', () => {
  it('lists public catalog urls and skips private cms paths', () => {
    const xml = buildSitemapXml(
      entriesFromCatalog({
        listings: [{ id: '1', slug: 'wheat-flour', title: 'Wheat flour', updated_at: '2026-10-01T00:00:00.000Z' }],
        shops: [
          { id: 's1', slug: 'wheat-raja', shop_name: 'Wheat Raja', updated_at: '2026-10-02' },
          { id: 's2', slug: 'hidden-shop', shop_name: 'Hidden', robots_index: false },
        ],
        categories: [{ category_id: 'c1', seo_name: 'art', category: 'Art' }],
        cms: [
          { path: '/blog/hello', last_modified: '2026-09-01' },
          { path: '/cart' },
          { path: 'https://sheconomy.in/orders/abc' },
        ],
      }),
    )

    expect(xml).toContain(`${SITEMAP_ORIGIN}/`)
    expect(xml).toContain(`${SITEMAP_ORIGIN}/listing/wheat-flour`)
    expect(xml).toContain('<lastmod>2026-10-01</lastmod>')
    expect(xml).toContain(`${SITEMAP_ORIGIN}/shop/wheat-raja`)
    expect(xml).toContain(`${SITEMAP_ORIGIN}/category/art`)
    expect(xml).toContain(`${SITEMAP_ORIGIN}/blog/hello`)
    expect(xml).not.toContain('/shop/hidden-shop')
    expect(xml).not.toContain('/cart')
    expect(xml).not.toContain('/orders/abc')
  })

  it('escapes xml in locations', () => {
    const xml = buildSitemapXml([{ path: '/shop/a&b' }])
    expect(xml).toContain(`${SITEMAP_ORIGIN}/shop/a&amp;b`)
  })
})
