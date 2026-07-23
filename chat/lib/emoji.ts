export {
  EMOJI_PALETTE,
  EMOJI_PICKER_ENTRIES,
  filterEmojiPalette,
  type EmojiPickerEntry,
} from '~/lib/emoji/picker'

/** Quick-reaction row shown above the message actions. */
export const QUICK_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🙏'] as const

/** Short human label for a non-text message, used in previews/quotes. */
export function mediaPreviewLabel(type: string): string {
  if (type === 'image') return 'Photo'
  if (type === 'file') return 'File'
  return 'Message'
}
