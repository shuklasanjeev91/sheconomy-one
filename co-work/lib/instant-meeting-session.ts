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
  /**
   * True once MeetingRoomScreen has connected for this overlay.
   * Maximize / remounts must resume the room — never the Join confirm lobby.
   */
  enteredRoom: boolean
  /** Display name used when the room was entered (resume without confirm). */
  displayName: string | null
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

export function normalizeInstantMeetingCode(code: string) {
  return code.replace(/\s/g, '').trim().toUpperCase()
}

function normalizeCode(code: string) {
  return normalizeInstantMeetingCode(code)
}

/** Open the live meeting overlay without navigating (avoids blank async-route Suspense). */
export function openInstantMeetingSession(input: {
  code: string
  meeting?: Meeting | null
  /** Defaults to true for Zoom-style entry. */
  autoJoin?: boolean
  /** Mark that the caller is already in the live room (minimize handoff). */
  enteredRoom?: boolean
  displayName?: string | null
}) {
  const code = normalizeCode(input.code)
  if (!code) return

  const autoJoin = input.autoJoin ?? true
  const prev = session

  // Same meeting already open — update metadata without remounting LiveKit / join UI.
  if (prev?.code === code) {
    const nextMeeting = input.meeting ?? prev.meeting
    // Never downgrade autoJoin / enteredRoom while the overlay is live — that made
    // Maximize land on the Join confirm screen again.
    const nextAutoJoin = prev.autoJoin || autoJoin
    const nextEnteredRoom = prev.enteredRoom || !!input.enteredRoom
    const nextDisplayName =
      (input.displayName && input.displayName.trim()) || prev.displayName || null
    if (
      nextMeeting !== prev.meeting ||
      nextAutoJoin !== prev.autoJoin ||
      nextEnteredRoom !== prev.enteredRoom ||
      nextDisplayName !== prev.displayName
    ) {
      session = {
        ...prev,
        meeting: nextMeeting,
        autoJoin: nextAutoJoin,
        enteredRoom: nextEnteredRoom,
        displayName: nextDisplayName,
      }
      emit()
    }
    return
  }

  session = {
    code,
    meeting: input.meeting ?? null,
    autoJoin,
    enteredRoom: !!input.enteredRoom,
    displayName: input.displayName?.trim() || null,
  }
  emit()
}

/** Mark the overlay as already inside the live room (connected MeetingRoomScreen). */
export function markInstantMeetingEnteredRoom(input?: {
  displayName?: string | null
  meeting?: Meeting | null
}) {
  if (!session) return
  const nextDisplayName =
    (input?.displayName && input.displayName.trim()) || session.displayName || null
  const nextMeeting = input?.meeting ?? session.meeting
  if (
    session.enteredRoom &&
    nextDisplayName === session.displayName &&
    nextMeeting === session.meeting
  ) {
    return
  }
  session = {
    ...session,
    enteredRoom: true,
    autoJoin: true,
    displayName: nextDisplayName,
    meeting: nextMeeting,
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
