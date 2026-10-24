import { describe, expect, it } from 'vitest'

import { isShopSetupQuestion, suggestIntent, suggestScope } from '~/lib/search/suggest-intent'

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
