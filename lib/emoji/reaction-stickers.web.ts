import { REACTION_STICKER_META, type ReactionSticker } from './reaction-stickers.shared'

const sources = [
  new URL('../../assets/reaction-stickers/reaction-sticker-01.gif', import.meta.url).href,
  new URL('../../assets/reaction-stickers/reaction-sticker-02.gif', import.meta.url).href,
  new URL('../../assets/reaction-stickers/reaction-sticker-03.gif', import.meta.url).href,
  new URL('../../assets/reaction-stickers/reaction-sticker-04.gif', import.meta.url).href,
  new URL('../../assets/reaction-stickers/reaction-sticker-05.gif', import.meta.url).href,
  new URL('../../assets/reaction-stickers/reaction-sticker-06.gif', import.meta.url).href,
  new URL('../../assets/reaction-stickers/reaction-sticker-07.gif', import.meta.url).href,
  new URL('../../assets/reaction-stickers/reaction-sticker-08.gif', import.meta.url).href,
  new URL('../../assets/reaction-stickers/reaction-sticker-09.gif', import.meta.url).href,
  new URL('../../assets/reaction-stickers/reaction-sticker-10.gif', import.meta.url).href,
  new URL('../../assets/reaction-stickers/reaction-sticker-11.gif', import.meta.url).href,
  new URL('../../assets/reaction-stickers/reaction-sticker-12.gif', import.meta.url).href,
  new URL('../../assets/reaction-stickers/reaction-sticker-13.gif', import.meta.url).href,
  new URL('../../assets/reaction-stickers/reaction-sticker-14.gif', import.meta.url).href,
  new URL('../../assets/reaction-stickers/reaction-sticker-15.gif', import.meta.url).href,
  new URL('../../assets/reaction-stickers/reaction-sticker-16.gif', import.meta.url).href,
  new URL('../../assets/reaction-stickers/reaction-sticker-17.gif', import.meta.url).href,
  new URL('../../assets/reaction-stickers/reaction-sticker-18.gif', import.meta.url).href,
  new URL('../../assets/reaction-stickers/reaction-sticker-19.gif', import.meta.url).href,
  new URL('../../assets/reaction-stickers/reaction-sticker-20.gif', import.meta.url).href,
  new URL('../../assets/reaction-stickers/reaction-sticker-21.gif', import.meta.url).href,
  new URL('../../assets/reaction-stickers/reaction-sticker-22.gif', import.meta.url).href,
  new URL('../../assets/reaction-stickers/reaction-sticker-23.gif', import.meta.url).href,
  new URL('../../assets/reaction-stickers/reaction-sticker-24.gif', import.meta.url).href,
]

export const REACTION_STICKERS: ReactionSticker[] = REACTION_STICKER_META.map((sticker, index) => ({
  ...sticker,
  source: { uri: sources[index] },
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
