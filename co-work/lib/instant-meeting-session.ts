import { useSyncExternalStore } from 'react'

import type { Meeting } from '~/co-work/lib/types'

export type InstantMeetingSession = {
  code: string
  meeting: Meeting | null
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

/** Open the live meeting overlay without navigating (avoids blank async-route Suspense). */
export function openInstantMeetingSession(input: {
  code: string
  meeting?: Meeting | null
}) {
  const code = input.code.replace(/\s/g, '').trim()
  if (!code) return
  session = { code, meeting: input.meeting ?? null }
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
