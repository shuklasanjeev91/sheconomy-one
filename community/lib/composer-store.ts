import { useSyncExternalStore } from 'react'

/** How the composer should open (which tool is pre-armed). */
export type ComposerMode =
  | 'text'
  | 'poll'
  | 'event'
  | 'celebration'
  | 'product'
  | 'shop'
  | 'article'

export type ComposerOptions = {
  mode?: ComposerMode
  /** Immediately open the photo picker on mount. */
  media?: boolean
  /** Immediately open the video picker on mount. */
  video?: boolean
  /** Pre-fill a GIF url as the post media. */
  gifUrl?: string
  groupId?: string
  companyId?: string
  /** Celebration occasion key (birthday, work_anniversary, …). */
  occasion?: string
  /** Pre-fill celebration title / milestone text. */
  celebrationTitle?: string
  /** Pre-fill post body (e.g. congratulate copy). */
  content?: string
}

/** Sheet title for the shared community composer by mode. */
export function composerSheetTitle(mode?: ComposerMode): string {
  switch (mode) {
    case 'article':
      return 'Write article'
    case 'event':
      return 'Create event'
    case 'celebration':
      return 'Celebrate an occasion'
    case 'poll':
      return 'Create a poll'
    case 'product':
      return 'Share a product'
    case 'shop':
      return 'Promote your shop'
    default:
      return 'Create a post'
  }
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

/** Open the shared community post composer (bottom sheet on web / iOS / Android). */
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
