import { describe, expect, it } from 'vitest'

import { resolveAiListingSearchTerm } from '~/lib/search/ai-search'

describe('resolveAiListingSearchTerm', () => {
  it('keeps a shop/brand name when AI pads category fluff', () => {
    expect(
      resolveAiListingSearchTerm(
        'BIOAYURVEDA',
        'BIOAYURVEDA ayurvedic personal care wellness',
      ),
    ).toBe('BIOAYURVEDA')
  })

  it('keeps richer AI terms when the user typed a phrase', () => {
    expect(
      resolveAiListingSearchTerm(
        'organic face wash under 500',
        'organic face wash',
      ),
    ).toBe('organic face wash')
  })

  it('falls back to the typed query when AI returns empty', () => {
    expect(resolveAiListingSearchTerm('Bioayurveda', '')).toBe('Bioayurveda')
  })
})
