import { useSyncExternalStore } from 'react'

import type { Meeting } from '~/co-work/lib/types'
import { maximizeGlobalSession } from '~/lib/session/global-session'

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
  audioEnabled?: boolean
  videoEnabled?: boolean
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

/**
 * Identity key for instant ↔ global session matching.
 * Must strip dashes/spaces — DB rows may be `ABC-DEF-GHI` while typed/global
 * codes are `ABCDEFGHI`. A mismatch hid InstantMeetingHost on Maximize and
 * revealed the lobby "Join now" screen underneath.
 */
export function normalizeInstantMeetingCode(code: string) {
  return code.replace(/[^a-zA-Z0-9]/g, '').toUpperCase()
}

function normalizeCode(code: string) {
  return normalizeInstantMeetingCode(code)
}

export function instantMeetingCodesMatch(a: string, b: string) {
  const left = normalizeInstantMeetingCode(a)
  const right = normalizeInstantMeetingCode(b)
  return !!left && left === right
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
  audioEnabled?: boolean
  videoEnabled?: boolean
}) {
  const code = normalizeCode(input.code)
  if (!code) return

  const autoJoin = input.autoJoin ?? true
  const prev = session

  // Same meeting already open (plain or dashed code) — update metadata without
  // remounting LiveKit / join UI. Prefer the persisted meeting_code when present.
  if (prev && instantMeetingCodesMatch(prev.code, code)) {
    const nextMeeting = input.meeting ?? prev.meeting
    const nextCode = nextMeeting?.meeting_code
      ? normalizeCode(nextMeeting.meeting_code)
      : prev.code
    // Never downgrade autoJoin / enteredRoom while the overlay is live — that made
    // Maximize land on the Join confirm screen again.
    const nextAutoJoin = prev.autoJoin || autoJoin
    const nextEnteredRoom = prev.enteredRoom || !!input.enteredRoom
    const nextDisplayName =
      (input.displayName && input.displayName.trim()) || prev.displayName || null
    const nextAudioEnabled = input.audioEnabled ?? prev.audioEnabled
    const nextVideoEnabled = input.videoEnabled ?? prev.videoEnabled
    if (
      nextMeeting !== prev.meeting ||
      nextCode !== prev.code ||
      nextAutoJoin !== prev.autoJoin ||
      nextEnteredRoom !== prev.enteredRoom ||
      nextDisplayName !== prev.displayName ||
      nextAudioEnabled !== prev.audioEnabled ||
      nextVideoEnabled !== prev.videoEnabled
    ) {
      session = {
        ...prev,
        code: nextCode,
        meeting: nextMeeting,
        autoJoin: nextAutoJoin,
        enteredRoom: nextEnteredRoom,
        displayName: nextDisplayName,
        audioEnabled: nextAudioEnabled,
        videoEnabled: nextVideoEnabled,
      }
      emit()
    }
    // Fresh join / re-open expands; minimize handoff passes enteredRoom and
    // then calls minimizeGlobalSession itself.
    if (!input.enteredRoom) {
      maximizeGlobalSession()
    }
    return
  }

  session = {
    code,
    meeting: input.meeting ?? null,
    autoJoin,
    enteredRoom: !!input.enteredRoom,
    displayName: input.displayName?.trim() || null,
    audioEnabled: input.audioEnabled,
    videoEnabled: input.videoEnabled,
  }
  emit()
  // Always expand — a leftover minimized/pip presentation from a prior session
  // would park InstantMeetingHost off-screen and leave the live room inset under
  // SHE header + Co-Work tabs.
  maximizeGlobalSession()
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
