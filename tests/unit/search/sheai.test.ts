import { describe, expect, it } from 'vitest'

import {
  buildSheaiSearchHref,
  listingHrefFromSheai,
  parseSheaiListingsFromAnswer,
  parseSheaiRecommendPayload,
} from '~/lib/search/sheai'

describe('parseSheaiRecommendPayload', () => {
  it('maps rich recommend results onto listing cards', () => {
    const parsed = parseSheaiRecommendPayload(
      {
        query: 'mom birthday',
        results: [
          {
            title: 'Handcrafted shawl',
            slug: 'handcrafted-shawl',
            score: 0.82,
            price: 1299,
            primary_image_url: 'https://cdn.example/shawl.jpg',
            shop_name: 'Maya Studio',
            logo_url: 'https://cdn.example/logo.jpg',
            category: 'apparel',
            price_tier: 'mid',
          },
        ],
      },
      'fallback',
    )

    expect(parsed.query).toBe('mom birthday')
    expect(parsed.results).toHaveLength(1)
    expect(parsed.results[0]).toMatchObject({
      title: 'Handcrafted shawl',
      slug: 'handcrafted-shawl',
      href: '/listing/handcrafted-shawl',
      shopName: 'Maya Studio',
      price: 1299,
      score: 82,
    })
  })

  it('falls back to an empty list when the payload is malformed', () => {
    expect(parseSheaiRecommendPayload(null, 'gift').results).toEqual([])
    expect(parseSheaiRecommendPayload({ results: 'nope' }, 'gift').query).toBe('gift')
  })
})

describe('buildSheaiSearchHref', () => {
  it('locks search to listings in SHEai mode', () => {
    expect(buildSheaiSearchHref()).toBe('/search?mode=sheai&scope=listings')
    expect(buildSheaiSearchHref(' mom birthday ')).toBe(
      '/search?q=mom+birthday&mode=sheai&scope=listings',
    )
  })
})

describe('parseSheaiListingsFromAnswer', () => {
  it('turns AI listing dumps into product cards', () => {
    const parsed = parseSheaiListingsFromAnswer(
      'Fresh picks: Calm Wall Art (₹1299) → /listing/calm-wall-art; MP Fresh Atta (₹400) → /listing/mp-fresh-atta',
    )
    expect(parsed).toHaveLength(2)
    expect(parsed[0]).toMatchObject({
      title: 'Calm Wall Art',
      slug: 'calm-wall-art',
      href: '/listing/calm-wall-art',
      price: 1299,
    })
    expect(parsed[1]?.slug).toBe('mp-fresh-atta')
  })
})

describe('listingHrefFromSheai', () => {
  it('prefers the listing slug', () => {
    expect(listingHrefFromSheai('gift-box', 'https://sheconomy.in/listing/other')).toBe(
      '/listing/gift-box',
    )
  })

  it('extracts a slug from product_url when needed', () => {
    expect(listingHrefFromSheai(null, 'https://sheconomy.in/listing/calm-wall-art')).toBe(
      '/listing/calm-wall-art',
    )
  })
})
