import { describe, expect, it } from 'vitest'

import {
  REACTION_STICKER_META,
  filterReactionStickers,
  findReactionSticker,
  isReactionStickerValue,
} from '~/lib/emoji/reaction-stickers.shared'

describe('reaction stickers', () => {
  it('defines stable sticker values for every bundled gif', () => {
    expect(REACTION_STICKER_META).toHaveLength(24)
    expect(REACTION_STICKER_META[0]?.value).toBe('sticker:she-01')
    expect(REACTION_STICKER_META[23]?.value).toBe('sticker:she-24')
    expect(new Set(REACTION_STICKER_META.map((sticker) => sticker.value)).size).toBe(24)
  })

  it('detects and finds only known sticker values', () => {
    expect(isReactionStickerValue('sticker:she-01')).toBe(true)
    expect(isReactionStickerValue('sticker:she-99')).toBe(false)
    expect(findReactionSticker(REACTION_STICKER_META, 'sticker:she-12')?.id).toBe('12')
  })

  it('filters by gif, label, and id keywords', () => {
    expect(filterReactionStickers(REACTION_STICKER_META, 'gif')).toHaveLength(24)
    expect(filterReactionStickers(REACTION_STICKER_META, 'sticker 7')).toHaveLength(1)
    expect(filterReactionStickers(REACTION_STICKER_META, '24')[0]?.value).toBe('sticker:she-24')
  })
})
