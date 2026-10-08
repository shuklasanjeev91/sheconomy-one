/** Zoom-style chat emoji picker: tabbed categories, plus big emoji-only messages. */

export type MeetingChatEmojiCategory = {
  id: string
  label: string
  /** Shown on the category tab. */
  icon: string
  emojis: string[]
}

export const MEETING_CHAT_EMOJI_CATEGORIES: MeetingChatEmojiCategory[] = [
  {
    id: 'stickers',
    label: 'Stickers',
    icon: '🎬',
    emojis: [
      'sticker:she-01', 'sticker:she-02', 'sticker:she-03', 'sticker:she-04', 'sticker:she-05', 'sticker:she-06',
      'sticker:she-07', 'sticker:she-08', 'sticker:she-09', 'sticker:she-10', 'sticker:she-11', 'sticker:she-12',
      'sticker:she-13', 'sticker:she-14', 'sticker:she-15', 'sticker:she-16', 'sticker:she-17', 'sticker:she-18',
      'sticker:she-19', 'sticker:she-20', 'sticker:she-21', 'sticker:she-22', 'sticker:she-23', 'sticker:she-24',
    ],
  },
  {
    id: 'smileys',
    label: 'Smileys',
    icon: '😀',
    emojis: [
      '😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂', '🙂', '🙃', '😉', '😊', '😇', '🥰', '😍', '🤩',
      '😘', '😗', '😚', '😙', '😋', '😛', '😜', '🤪', '😝', '🤑', '🤗', '🤭', '🤫', '🤔', '🤐', '🤨',
      '😐', '😑', '😶', '😏', '😒', '🙄', '😬', '😌', '😔', '😪', '🤤', '😴', '😷', '🤒', '🤕', '🤢',
      '🤧', '🥵', '🥶', '🥴', '😵', '🤯', '🤠', '🥳', '😎', '🤓', '🧐', '😕', '😟', '🙁', '😮', '😯',
      '😲', '😳', '🥺', '😦', '😧', '😨', '😰', '😥', '😢', '😭', '😱', '😖', '😣', '😞', '😓', '😩',
      '😫', '🥱', '😤', '😡', '😠', '🤬',
    ],
  },
  {
    id: 'gestures',
    label: 'Gestures',
    icon: '👍',
    emojis: [
      '👍', '👎', '👏', '🙌', '👐', '🤲', '🙏', '🤝', '👊', '✊', '🤛', '🤜', '🤞', '✌️', '🤟', '🤘',
      '👌', '🤌', '🤏', '👈', '👉', '👆', '👇', '☝️', '✋', '🤚', '🖐️', '🖖', '👋', '🤙', '💪', '✍️',
      '🫶', '🙋', '🙋‍♀️', '🙆‍♀️', '🙅‍♀️', '🤷‍♀️', '🤦‍♀️', '💁‍♀️', '🙇‍♀️', '👩‍💻', '👩‍💼', '👩‍🏫', '👩‍🎤', '👩‍🍳',
    ],
  },
  {
    id: 'together',
    label: 'Together',
    icon: '👭',
    emojis: [
      '👭', '👩‍❤️‍👩', '👩‍👩‍👧', '👩‍👩‍👧‍👧', '👩‍👧', '👩‍👧‍👦', '👩🏻', '👩🏼', '👩🏽', '👩🏾', '👩🏿', '👩‍🦱',
      '👩‍🦰', '👩‍🦳', '👩‍💻', '👩‍💼', '👩‍🔬', '👩‍🎓', '👩‍🏫', '👩‍🎨', '👩‍🚀', '👩‍⚕️', '👷‍♀️', '🧕',
      '🙋‍♀️', '💁‍♀️', '🙌', '👏', '🤝', '🫶', '💪', '✊', '✨', '🌟', '💖', '💕', '💞', '💌', '🎉', '🏆',
      '🚀', '📈', '💡', '🌈', '✅', '👑',
    ],
  },
  {
    id: 'hearts',
    label: 'Hearts',
    icon: '❤️',
    emojis: [
      '❤️', '🧡', '💛', '💚', '💙', '💜', '🤎', '🖤', '🤍', '💔', '❣️', '💕', '💞', '💓', '💗', '💖',
      '💘', '💝', '💟', '😻', '💌', '💋', '🌹', '🥀',
    ],
  },
  {
    id: 'celebrate',
    label: 'Celebrate',
    icon: '🎉',
    emojis: [
      '🎉', '🎊', '🥳', '🎈', '🎂', '🍰', '🎁', '🏆', '🥇', '🥈', '🥉', '🏅', '🎖️', '⭐', '🌟', '✨',
      '💫', '🔥', '💯', '✅', '☑️', '✔️', '❌', '❗', '❓', '⚡', '💥', '🚀', '📈', '💡', '🎯', '👑',
    ],
  },
  {
    id: 'nature',
    label: 'Nature',
    icon: '🌸',
    emojis: [
      '🌸', '💐', '🌺', '🌻', '🌼', '🌷', '🌱', '🌿', '🍀', '🍁', '🌵', '🌴', '🌳', '☀️', '🌤️', '⛅',
      '🌧️', '⛈️', '❄️', '🌈', '🌙', '🌍', '🌊', '🐶', '🐱', '🦋', '🐝', '🐼', '🦁', '🐯', '🦄', '🐬',
    ],
  },
  {
    id: 'food',
    label: 'Food',
    icon: '☕',
    emojis: [
      '☕', '🍵', '🧋', '🥤', '🍹', '🥂', '🍾', '🍕', '🍔', '🍟', '🌮', '🍜', '🍛', '🍱', '🍣', '🥗',
      '🍩', '🍪', '🍫', '🍿', '🍎', '🍓', '🍉', '🥭',
    ],
  },
  {
    id: 'objects',
    label: 'Work',
    icon: '💼',
    emojis: [
      '💼', '📊', '📌', '📎', '📝', '📅', '⏰', '⏳', '💻', '🖥️', '📱', '🎧', '🎤', '📷', '🎥', '📞',
      '📧', '💰', '💳', '🛒', '🔔', '🔑', '🔒', '📚', '✏️', '🗂️', '📦', '🧠', '🤖', '🛠️', '⚙️', '🏠',
    ],
  },
]

const PICKER_EMOJIS = [
  ...new Set(
    MEETING_CHAT_EMOJI_CATEGORIES.flatMap((category) => category.emojis).filter(
      (emoji) => !emoji.startsWith('sticker:'),
    ),
  ),
].sort((a, b) => b.length - a.length)

const MAX_BIG_EMOJI = 3

function makeEmojiRegex(): RegExp | null {
  try {
    return new RegExp('(?:\\p{Extended_Pictographic}|\\p{Regional_Indicator})', 'u')
  } catch {
    return null
  }
}

const pictographic = makeEmojiRegex()
const JOINERS = /[\u200d\ufe0f\ufe0e\u20e3\u{1f3fb}-\u{1f3ff}]/gu

/**
 * Count of emoji when `text` is only emoji (1–3 of them), else 0.
 * Those messages render large without a bubble, like Zoom and WhatsApp.
 */
export function meetingChatEmojiOnlyCount(text: string | null | undefined): number {
  const compact = (text ?? '').replace(/\s+/g, '')
  if (!compact || compact.length > 40) return 0

  let rest = compact
  let count = 0
  for (const emoji of PICKER_EMOJIS) {
    if (!rest.includes(emoji)) continue
    const parts = rest.split(emoji)
    count += parts.length - 1
    rest = parts.join('')
  }
  if (rest && pictographic) {
    const stripped = rest.replace(JOINERS, '')
    for (const char of stripped) {
      if (!pictographic.test(char)) return 0
      count += 1
    }
    rest = ''
  }
  if (rest) return 0
  return count > 0 && count <= MAX_BIG_EMOJI ? count : 0
}
