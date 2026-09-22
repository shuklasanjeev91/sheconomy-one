/**
 * Zoom-style meeting keyboard shortcuts (web).
 * Ignores events while typing in inputs / contenteditable.
 */

export type MeetingKeyboardAction =
  | 'toggle_mute'
  | 'toggle_video'
  | 'toggle_share'
  | 'toggle_participants'
  | 'toggle_chat'
  | 'toggle_hand'
  | 'toggle_reactions'
  | 'toggle_captions'
  | 'toggle_whiteboard'
  | 'toggle_gallery'
  | 'toggle_record'
  | 'leave'
  | 'show_shortcuts'

export type MeetingKeyboardShortcut = {
  action: MeetingKeyboardAction
  label: string
  /** Display chord, e.g. "Alt+A" */
  keys: string
}

export const MEETING_KEYBOARD_SHORTCUTS: MeetingKeyboardShortcut[] = [
  { action: 'toggle_mute', label: 'Mute / unmute', keys: 'Alt+A' },
  { action: 'toggle_video', label: 'Start / stop video', keys: 'Alt+V' },
  { action: 'toggle_share', label: 'Share screen', keys: 'Alt+S' },
  { action: 'toggle_participants', label: 'Participants', keys: 'Alt+U' },
  { action: 'toggle_chat', label: 'Chat', keys: 'Alt+H' },
  { action: 'toggle_hand', label: 'Raise / lower hand', keys: 'Alt+Y' },
  { action: 'toggle_reactions', label: 'Reactions', keys: 'Alt+R' },
  { action: 'toggle_captions', label: 'Live captions', keys: 'Alt+C' },
  { action: 'toggle_whiteboard', label: 'Whiteboard', keys: 'Alt+W' },
  { action: 'toggle_gallery', label: 'Gallery / speaker view', keys: 'Alt+G' },
  { action: 'toggle_record', label: 'Start / stop recording', keys: 'Alt+Shift+E' },
  { action: 'show_shortcuts', label: 'Keyboard shortcuts', keys: 'Alt+/' },
  { action: 'leave', label: 'Leave meeting', keys: 'Alt+Q' },
]

function isEditableTarget(target: EventTarget | null): boolean {
  if (!target || typeof target !== 'object') return false
  const el = target as HTMLElement
  const tag = (el.tagName || '').toLowerCase()
  if (tag === 'input' || tag === 'textarea' || tag === 'select') return true
  if (el.isContentEditable) return true
  const role = el.getAttribute?.('role')
  if (role === 'textbox' || role === 'searchbox') return true
  return false
}

/** Map a keydown event to a meeting action (or null). */
export function resolveMeetingKeyboardAction(
  event: {
    key: string
    altKey: boolean
    ctrlKey: boolean
    metaKey: boolean
    shiftKey: boolean
    target?: EventTarget | null
  },
): MeetingKeyboardAction | null {
  if (isEditableTarget(event.target ?? null)) return null
  if (event.ctrlKey || event.metaKey) return null
  if (!event.altKey) return null

  const key = String(event.key || '').toLowerCase()
  switch (key) {
    case 'a':
      return 'toggle_mute'
    case 'v':
      return 'toggle_video'
    case 's':
      return 'toggle_share'
    case 'u':
      return 'toggle_participants'
    case 'h':
      return 'toggle_chat'
    case 'y':
      return 'toggle_hand'
    case 'r':
      return 'toggle_reactions'
    case 'c':
      return 'toggle_captions'
    case 'w':
      return 'toggle_whiteboard'
    case 'g':
      return 'toggle_gallery'
    case 'e':
      return event.shiftKey ? 'toggle_record' : null
    case 'q':
      return 'leave'
    case '/':
    case '?':
      return 'show_shortcuts'
    default:
      return null
  }
}
