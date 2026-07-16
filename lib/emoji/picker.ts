export type EmojiPickerEntry = {
  emoji: string
  tags: string[]
}

/** Curated composer palette with searchable tags (names / keywords). */
export const EMOJI_PICKER_ENTRIES: EmojiPickerEntry[] = [
  { emoji: '😀', tags: ['grinning', 'smile', 'happy', 'face'] },
  { emoji: '😁', tags: ['beaming', 'smile', 'happy', 'grin'] },
  { emoji: '😂', tags: ['joy', 'laugh', 'lol', 'tears', 'funny'] },
  { emoji: '🤣', tags: ['rofl', 'laugh', 'rolling', 'floor'] },
  { emoji: '😊', tags: ['blush', 'smile', 'happy', 'warm'] },
  { emoji: '😇', tags: ['innocent', 'halo', 'angel'] },
  { emoji: '🙂', tags: ['slight', 'smile', 'okay'] },
  { emoji: '😉', tags: ['wink', 'flirt', 'playful'] },
  { emoji: '😍', tags: ['heart', 'eyes', 'love', 'crush'] },
  { emoji: '🥰', tags: ['hearts', 'love', 'adore', 'smile'] },
  { emoji: '😘', tags: ['kiss', 'love', 'blow'] },
  { emoji: '😋', tags: ['yum', 'delicious', 'tongue', 'tasty'] },
  { emoji: '😎', tags: ['cool', 'sunglasses', 'swag'] },
  { emoji: '🤩', tags: ['star', 'struck', 'excited', 'wow'] },
  { emoji: '🥳', tags: ['party', 'celebrate', 'birthday', 'hat'] },
  { emoji: '😅', tags: ['sweat', 'smile', 'nervous', 'relief'] },
  { emoji: '😭', tags: ['cry', 'sob', 'sad', 'tears'] },
  { emoji: '😢', tags: ['cry', 'sad', 'tear'] },
  { emoji: '😤', tags: ['angry', 'steam', 'frustrated'] },
  { emoji: '😠', tags: ['angry', 'mad', 'annoyed'] },
  { emoji: '😡', tags: ['rage', 'angry', 'furious'] },
  { emoji: '🥺', tags: ['pleading', 'puppy', 'please', 'cute'] },
  { emoji: '😳', tags: ['flushed', 'embarrassed', 'shocked'] },
  { emoji: '😴', tags: ['sleep', 'tired', 'zzz'] },
  { emoji: '👍', tags: ['thumbs', 'up', 'like', 'yes', 'approve'] },
  { emoji: '👎', tags: ['thumbs', 'down', 'dislike', 'no'] },
  { emoji: '👏', tags: ['clap', 'applause', 'bravo', 'hands'] },
  { emoji: '🙌', tags: ['raise', 'hands', 'celebrate', 'hooray'] },
  { emoji: '🙏', tags: ['pray', 'thanks', 'please', 'namaste'] },
  { emoji: '💪', tags: ['muscle', 'strong', 'flex', 'power'] },
  { emoji: '🤝', tags: ['handshake', 'deal', 'agree', 'partner'] },
  { emoji: '✌️', tags: ['peace', 'victory', 'two'] },
  { emoji: '❤️', tags: ['heart', 'red', 'love'] },
  { emoji: '🧡', tags: ['heart', 'orange', 'love'] },
  { emoji: '💛', tags: ['heart', 'yellow', 'love'] },
  { emoji: '💚', tags: ['heart', 'green', 'love'] },
  { emoji: '💙', tags: ['heart', 'blue', 'love'] },
  { emoji: '💜', tags: ['heart', 'purple', 'love'] },
  { emoji: '🖤', tags: ['heart', 'black', 'love'] },
  { emoji: '💔', tags: ['broken', 'heart', 'sad'] },
  { emoji: '🔥', tags: ['fire', 'hot', 'lit', 'trending'] },
  { emoji: '✨', tags: ['sparkles', 'shine', 'magic', 'new'] },
  { emoji: '🎉', tags: ['party', 'popper', 'celebrate', 'tada'] },
  { emoji: '🎊', tags: ['confetti', 'celebrate', 'party'] },
  { emoji: '💯', tags: ['hundred', 'perfect', 'score', 'points'] },
  { emoji: '⭐', tags: ['star', 'favorite', 'rating'] },
  { emoji: '🌟', tags: ['glowing', 'star', 'shine'] },
  { emoji: '💫', tags: ['dizzy', 'star', 'sparkle'] },
  { emoji: '😮', tags: ['open', 'mouth', 'surprised', 'wow'] },
  { emoji: '😱', tags: ['scream', 'fear', 'shocked', 'scared'] },
  { emoji: '🤔', tags: ['think', 'hmm', 'consider', 'wonder'] },
  { emoji: '🤗', tags: ['hug', 'hugging', 'warm', 'welcome'] },
  { emoji: '🤭', tags: ['giggle', 'oops', 'shy', 'hand'] },
  { emoji: '😏', tags: ['smirk', 'sly', 'flirt'] },
  { emoji: '😌', tags: ['relieved', 'calm', 'peaceful'] },
  { emoji: '🤤', tags: ['drool', 'yum', 'hungry'] },
  { emoji: '🌸', tags: ['flower', 'blossom', 'spring', 'pink'] },
  { emoji: '🌹', tags: ['rose', 'flower', 'love', 'romance'] },
  { emoji: '🌺', tags: ['hibiscus', 'flower', 'tropical'] },
  { emoji: '☀️', tags: ['sun', 'sunny', 'weather', 'bright'] },
  { emoji: '🌈', tags: ['rainbow', 'pride', 'colorful'] },
  { emoji: '⚡', tags: ['lightning', 'bolt', 'fast', 'energy'] },
  { emoji: '💐', tags: ['bouquet', 'flowers', 'gift'] },
  { emoji: '🎁', tags: ['gift', 'present', 'box', 'birthday'] },
  { emoji: '🚀', tags: ['rocket', 'launch', 'startup', 'space'] },
]

export const EMOJI_PALETTE = EMOJI_PICKER_ENTRIES.map((entry) => entry.emoji)

export function filterEmojiPalette(query: string): string[] {
  const needle = query.trim().toLowerCase()
  if (!needle) return EMOJI_PALETTE
  return EMOJI_PICKER_ENTRIES.filter(
    (entry) =>
      entry.emoji.includes(needle) ||
      entry.tags.some((tag) => tag.includes(needle)),
  ).map((entry) => entry.emoji)
}
