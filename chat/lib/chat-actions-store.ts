import { useSyncExternalStore } from 'react'

let open = false
const listeners = new Set<() => void>()

function emit() {
  for (const listener of listeners) listener()
}

/** Open the shared "new chat" picker (bottom sheet on mobile, dialog on desktop). */
export function openNewChat() {
  if (open) return
  open = true
  emit()
}

export function closeNewChat() {
  if (!open) return
  open = false
  emit()
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function getSnapshot() {
  return open
}

export function useNewChatOpen(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}
