import { REACTION_STICKER_META, type ReactionSticker } from './reaction-stickers.shared'

export const REACTION_STICKERS: ReactionSticker[] = REACTION_STICKER_META.map((sticker) => ({
  ...sticker,
  source: { uri: `/assets/reaction-stickers/reaction-sticker-${sticker.id}.gif` },
}))

export {
  REACTION_STICKER_META,
  REACTION_STICKER_VALUE_PREFIX,
  filterReactionStickers,
  findReactionSticker,
  isReactionStickerValue,
  type ReactionSticker,
  type ReactionStickerMeta,
} from './reaction-stickers.shared'
