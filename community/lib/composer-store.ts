import { useSyncExternalStore } from 'react'

/** How the composer should open (which tool is pre-armed). */
export type ComposerMode = 'text' | 'poll' | 'event' | 'celebration' | 'product' | 'shop'

export type ComposerOptions = {
  mode?: ComposerMode
  /** Immediately open the photo picker on mount. */
  media?: boolean
  /** Pre-fill a GIF url as the post media. */
  gifUrl?: string
  groupId?: string
  companyId?: string
}

type ComposerState = {
  open: boolean
  options: ComposerOptions
}

const CLOSED: ComposerState = { open: false, options: {} }

let state: ComposerState = CLOSED
const listeners = new Set<() => void>()

function emit() {
  for (const listener of listeners) listener()
}

/** Open the shared community post composer (bottom sheet on mobile, dialog on desktop). */
export function openComposer(options: ComposerOptions = {}) {
  state = { open: true, options }
  emit()
}

export function closeComposer() {
  if (!state.open) return
  state = CLOSED
  emit()
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function getSnapshot() {
  return state
}

export function useComposerState(): ComposerState {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}
