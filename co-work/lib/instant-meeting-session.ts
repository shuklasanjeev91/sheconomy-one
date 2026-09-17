import { useSyncExternalStore } from 'react'

import type { Meeting } from '~/co-work/lib/types'

export type InstantMeetingSession = {
  code: string
  meeting: Meeting | null
  /**
   * Skip the second Join Meeting confirm screen and enter the room once
   * identity / passcode / lock checks pass (Zoom-style one-tap).
   */
  autoJoin: boolean
}

let session: InstantMeetingSession | null = null
const listeners = new Set<() => void>()

function emit() {
  for (const listener of listeners) listener()
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function getSnapshot() {
  return session
}

function normalizeCode(code: string) {
  return code.replace(/\s/g, '').trim()
}

/** Open the live meeting overlay without navigating (avoids blank async-route Suspense). */
export function openInstantMeetingSession(input: {
  code: string
  meeting?: Meeting | null
  /** Defaults to true for Zoom-style entry. Set false when restoring a live room (minimize). */
  autoJoin?: boolean
}) {
  const code = normalizeCode(input.code)
  if (!code) return

  const autoJoin = input.autoJoin ?? true
  const prev = session

  // Same meeting already open — update metadata without remounting LiveKit / join UI.
  if (prev?.code === code) {
    const nextMeeting = input.meeting ?? prev.meeting
    // Never downgrade autoJoin to false while the overlay is live — that made
    // Maximize / remounts land on the Join confirm screen again.
    const nextAutoJoin = prev.autoJoin || autoJoin
    if (nextMeeting !== prev.meeting || nextAutoJoin !== prev.autoJoin) {
      session = {
        ...prev,
        meeting: nextMeeting,
        autoJoin: nextAutoJoin,
      }
      emit()
    }
    return
  }

  session = {
    code,
    meeting: input.meeting ?? null,
    autoJoin,
  }
  emit()
}

export function closeInstantMeetingSession() {
  if (!session) return
  session = null
  emit()
}

export function peekInstantMeetingSession() {
  return session
}

export function useInstantMeetingSession() {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}
