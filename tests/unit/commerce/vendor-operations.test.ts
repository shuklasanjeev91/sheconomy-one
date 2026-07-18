import { describe, expect, it } from 'vitest'

import { rowsToCsv } from '~/commerce/lib/vendor-operation-utils'

describe('vendor operation exports', () => {
  it('exports stable CSV columns and escapes values', () => {
    expect(
      rowsToCsv([
        { product: 'Dress, red', revenue: 1200 },
        { product: 'A "quoted" item', revenue: 900 },
      ]),
    ).toBe(
      '"product","revenue"\n"Dress, red","1200"\n"A ""quoted"" item","900"',
    )
  })

  it('returns an empty export when no rows are available', () => {
    expect(rowsToCsv([])).toBe('')
  })
})
