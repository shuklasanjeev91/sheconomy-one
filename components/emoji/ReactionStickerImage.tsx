import { Image } from '~/components/ui'
import {
  REACTION_STICKERS,
  findReactionSticker,
  type ReactionSticker,
} from '~/lib/emoji/reaction-stickers'

type ReactionStickerImageProps = {
  value: string
  size: number
  borderRadius?: number
  sticker?: ReactionSticker | null
}

export function ReactionStickerImage({
  value,
  size,
  borderRadius = 10,
  sticker: providedSticker,
}: ReactionStickerImageProps) {
  const sticker = providedSticker ?? findReactionSticker(REACTION_STICKERS, value)
  if (!sticker) return null
  const source = sticker.source
  return (
    <Image
      source={typeof source === 'string' ? { uri: source } : (source as never)}
      src={typeof source === 'string' ? source : undefined}
      width={size}
      height={size}
      borderRadius={borderRadius}
      objectFit="contain"
      alt={sticker.label}
      recyclingKey={sticker.value}
    />
  )
}
