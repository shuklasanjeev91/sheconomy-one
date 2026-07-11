/** Quick-reaction row shown above the message actions. */
export const QUICK_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🙏'] as const

/** A compact, curated palette for the composer emoji picker. */
export const EMOJI_PALETTE: string[] = [
  '😀', '😁', '😂', '🤣', '😊', '😇', '🙂', '😉',
  '😍', '🥰', '😘', '😋', '😎', '🤩', '🥳', '😅',
  '😭', '😢', '😤', '😠', '😡', '🥺', '😳', '😴',
  '👍', '👎', '👏', '🙌', '🙏', '💪', '🤝', '✌️',
  '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '💔',
  '🔥', '✨', '🎉', '🎊', '💯', '⭐', '🌟', '💫',
  '😮', '😱', '🤔', '🤗', '🤭', '😏', '😌', '🤤',
  '🌸', '🌹', '🌺', '☀️', '🌈', '⚡', '💐', '🎁',
]

/** Short human label for a non-text message, used in previews/quotes. */
export function mediaPreviewLabel(type: string): string {
  if (type === 'image') return 'Photo'
  if (type === 'file') return 'File'
  return 'Message'
}
