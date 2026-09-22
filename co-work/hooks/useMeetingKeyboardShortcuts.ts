import { useEffect } from 'react'
import { Platform } from 'react-native'

import {
  resolveMeetingKeyboardAction,
  type MeetingKeyboardAction,
} from '~/co-work/lib/meeting-keyboard-shortcuts'

type MeetingKeyboardHandlers = Partial<Record<MeetingKeyboardAction, () => void>>

/** Web-only Zoom-style Alt+ shortcuts while a meeting is live. */
export function useMeetingKeyboardShortcuts(
  enabled: boolean,
  handlers: MeetingKeyboardHandlers,
): void {
  useEffect(() => {
    if (!enabled || Platform.OS !== 'web') return
    if (typeof window === 'undefined') return

    const onKeyDown = (event: KeyboardEvent) => {
      const action = resolveMeetingKeyboardAction(event)
      if (!action) return
      const handler = handlers[action]
      if (!handler) return
      event.preventDefault()
      handler()
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
    // Handlers are expected to be stable enough for the meeting session.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, handlers])
}
