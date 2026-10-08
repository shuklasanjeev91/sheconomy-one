import type { ImageSourcePropType } from 'react-native'

import { REACTION_STICKER_META, type ReactionSticker } from './reaction-stickers.shared'

const sources: ImageSourcePropType[] = [
  require('../../assets/reaction-stickers/reaction-sticker-01.gif'),
  require('../../assets/reaction-stickers/reaction-sticker-02.gif'),
  require('../../assets/reaction-stickers/reaction-sticker-03.gif'),
  require('../../assets/reaction-stickers/reaction-sticker-04.gif'),
  require('../../assets/reaction-stickers/reaction-sticker-05.gif'),
  require('../../assets/reaction-stickers/reaction-sticker-06.gif'),
  require('../../assets/reaction-stickers/reaction-sticker-07.gif'),
  require('../../assets/reaction-stickers/reaction-sticker-08.gif'),
  require('../../assets/reaction-stickers/reaction-sticker-09.gif'),
  require('../../assets/reaction-stickers/reaction-sticker-10.gif'),
  require('../../assets/reaction-stickers/reaction-sticker-11.gif'),
  require('../../assets/reaction-stickers/reaction-sticker-12.gif'),
  require('../../assets/reaction-stickers/reaction-sticker-13.gif'),
  require('../../assets/reaction-stickers/reaction-sticker-14.gif'),
  require('../../assets/reaction-stickers/reaction-sticker-15.gif'),
  require('../../assets/reaction-stickers/reaction-sticker-16.gif'),
  require('../../assets/reaction-stickers/reaction-sticker-17.gif'),
  require('../../assets/reaction-stickers/reaction-sticker-18.gif'),
  require('../../assets/reaction-stickers/reaction-sticker-19.gif'),
  require('../../assets/reaction-stickers/reaction-sticker-20.gif'),
  require('../../assets/reaction-stickers/reaction-sticker-21.gif'),
  require('../../assets/reaction-stickers/reaction-sticker-22.gif'),
  require('../../assets/reaction-stickers/reaction-sticker-23.gif'),
  require('../../assets/reaction-stickers/reaction-sticker-24.gif'),
]

export const REACTION_STICKERS: ReactionSticker[] = REACTION_STICKER_META.map((sticker, index) => ({
  ...sticker,
  source: sources[index],
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
