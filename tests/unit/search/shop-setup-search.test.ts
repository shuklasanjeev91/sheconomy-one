import { describe, expect, it } from 'vitest'

import { buildAiSearchHref } from '~/lib/search/ai-search'
import {
  isShopSetupQuestion,
  looksLikePersonName,
  suggestHitOrder,
  suggestIntent,
  suggestScope,
} from '~/lib/search/suggest-intent'

describe('create shop search', () => {
  it('keeps how to open or create a shop off the shop directory', () => {
    expect(isShopSetupQuestion('how to open or create shop here')).toBe(true)
    expect(suggestIntent('how to open or create shop here')).toBe('listing')
    expect(suggestScope('how to open or create shop here')).toBe('listings')
  })

  it('still treats a shop directory search as shops', () => {
    expect(isShopSetupQuestion('top shops')).toBe(false)
    expect(suggestIntent('top shops')).toBe('shop')
    expect(suggestScope('top shops')).toBe('shops')
  })
})

describe('global search', () => {
  it('asks Sherpa across every area', () => {
    expect(buildAiSearchHref('Pooja Sawhney')).toContain('mode=ai')
    expect(buildAiSearchHref('Pooja Sawhney')).toContain('scope=all')
    expect(buildAiSearchHref('Pooja Sawhney')).not.toContain('scope=listings')
  })

  it('leads a person name with people and still includes the other areas', () => {
    expect(looksLikePersonName('Pooja Sawhney')).toBe(true)
    expect(looksLikePersonName('red saree')).toBe(false)
    const order = suggestHitOrder('Pooja Sawhney')
    expect(order[0]).toBe('person')
    expect(order).toEqual(expect.arrayContaining(['listing', 'shop', 'company', 'group', 'program', 'meeting']))
  })
})
