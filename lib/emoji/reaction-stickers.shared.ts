export const REACTION_STICKER_VALUE_PREFIX = 'sticker:she-'

export type ReactionStickerMeta = {
  id: string
  value: string
  label: string
  keywords: string[]
}

export type ReactionSticker = ReactionStickerMeta & {
  source: unknown
}

export const REACTION_STICKER_META: ReactionStickerMeta[] = Array.from({ length: 24 }, (_, index) => {
  const number = index + 1
  const padded = String(number).padStart(2, '0')
  return {
    id: padded,
    value: `${REACTION_STICKER_VALUE_PREFIX}${padded}`,
    label: `Sticker ${number}`,
    keywords: ['gif', 'sticker', 'reaction', 'animated', `sticker ${number}`, padded],
  }
})

export function isReactionStickerValue(value: string | null | undefined): boolean {
  if (!value) return false
  return REACTION_STICKER_META.some((sticker) => sticker.value === value)
}

export function findReactionSticker<T extends ReactionStickerMeta>(
  stickers: readonly T[],
  value: string | null | undefined,
): T | null {
  if (!value) return null
  return stickers.find((sticker) => sticker.value === value) ?? null
}

export function filterReactionStickers<T extends ReactionStickerMeta>(
  stickers: readonly T[],
  query: string,
): T[] {
  const needle = query.trim().toLowerCase()
  if (!needle) return [...stickers]
  return stickers.filter(
    (sticker) =>
      sticker.label.toLowerCase().includes(needle) ||
      sticker.value.toLowerCase().includes(needle) ||
      sticker.keywords.some((keyword) => keyword.includes(needle)),
  )
}
