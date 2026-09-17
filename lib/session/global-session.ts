/**
 * App-wide live session controller — meetings and 1:1 calls.
 * Presentation is independent of meeting lifecycle (LOBBY/CONNECTED/…).
 */

import { useSyncExternalStore } from 'react'

export type GlobalSessionKind = 'meeting' | 'call'

export type GlobalSessionPresentation = 'fullscreen' | 'minimized' | 'pip'

export type GlobalSessionMediaFlags = {
  audioEnabled: boolean
  videoEnabled: boolean
  screenSharing: boolean
  speakerOn: boolean
}

export type GlobalSessionHandlers = {
  toggleMic?: () => void | Promise<void>
  toggleCamera?: () => void | Promise<void>
  toggleSpeaker?: () => void | Promise<void>
  end?: () => void | Promise<void>
  /** Enter OS Picture-in-Picture when supported. */
  enterPip?: () => void | Promise<void>
  exitPip?: () => void | Promise<void>
}

export type GlobalSessionState = {
  kind: GlobalSessionKind
  presentation: GlobalSessionPresentation
  title: string
  subtitle: string | null
  /** Route or in-app target when maximizing. */
  maximizeHref: string
  /** Meeting / call code for identity. */
  code: string
  media: GlobalSessionMediaFlags
  /** True when OS PiP is available on this platform/session. */
  pipSupported: boolean
  /** User-facing reason when PiP is unavailable. */
  pipUnsupportedMessage: string | null
}

type GlobalSessionStore = {
  session: GlobalSessionState | null
  handlers: GlobalSessionHandlers
}

let store: GlobalSessionStore = {
  session: null,
  handlers: {},
}

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

function getSnapshot(): GlobalSessionStore {
  return store
}

export function peekGlobalSession(): GlobalSessionState | null {
  return store.session
}

export function peekGlobalSessionHandlers(): GlobalSessionHandlers {
  return store.handlers
}

export type RegisterGlobalSessionInput = {
  kind: GlobalSessionKind
  title: string
  subtitle?: string | null
  maximizeHref: string
  code: string
  media?: Partial<GlobalSessionMediaFlags>
  presentation?: GlobalSessionPresentation
  pipSupported?: boolean
  pipUnsupportedMessage?: string | null
  handlers?: GlobalSessionHandlers
}

export function registerGlobalSession(input: RegisterGlobalSessionInput): void {
  const previous = store.session
  const sameIdentity =
    previous &&
    previous.kind === input.kind &&
    previous.code === input.code.replace(/\s/g, '').trim()

  store = {
    session: {
      kind: input.kind,
      presentation:
        input.presentation ??
        (sameIdentity ? previous.presentation : 'fullscreen'),
      title: input.title,
      subtitle: input.subtitle ?? null,
      maximizeHref: input.maximizeHref,
      code: input.code.replace(/\s/g, '').trim(),
      media: {
        audioEnabled: input.media?.audioEnabled ?? previous?.media.audioEnabled ?? true,
        videoEnabled: input.media?.videoEnabled ?? previous?.media.videoEnabled ?? false,
        screenSharing: input.media?.screenSharing ?? previous?.media.screenSharing ?? false,
        speakerOn: input.media?.speakerOn ?? previous?.media.speakerOn ?? true,
      },
      pipSupported: input.pipSupported ?? previous?.pipSupported ?? false,
      pipUnsupportedMessage:
        input.pipUnsupportedMessage ?? previous?.pipUnsupportedMessage ?? null,
    },
    handlers: { ...store.handlers, ...input.handlers },
  }
  emit()
}

export function updateGlobalSessionMedia(media: Partial<GlobalSessionMediaFlags>): void {
  if (!store.session) return
  store = {
    ...store,
    session: {
      ...store.session,
      media: { ...store.session.media, ...media },
    },
  }
  emit()
}

export function setGlobalSessionHandlers(handlers: GlobalSessionHandlers): void {
  store = { ...store, handlers: { ...store.handlers, ...handlers } }
  emit()
}

export function setGlobalSessionPresentation(
  presentation: GlobalSessionPresentation,
): GlobalSessionState | null {
  if (!store.session) return null
  if (store.session.presentation === presentation) return store.session
  store = {
    ...store,
    session: { ...store.session, presentation },
  }
  emit()
  return store.session
}

export function minimizeGlobalSession(): GlobalSessionState | null {
  return setGlobalSessionPresentation('minimized')
}

export function maximizeGlobalSession(): GlobalSessionState | null {
  return setGlobalSessionPresentation('fullscreen')
}

export function enterGlobalSessionPip(): GlobalSessionState | null {
  return setGlobalSessionPresentation('pip')
}

export function exitGlobalSessionPip(): GlobalSessionState | null {
  if (!store.session) return null
  if (store.session.presentation !== 'pip') return store.session
  return setGlobalSessionPresentation('minimized')
}

export function clearGlobalSession(code?: string): void {
  if (!store.session) return
  if (code && store.session.code !== code.replace(/\s/g, '').trim()) return
  store = { session: null, handlers: {} }
  emit()
}

/** Pure helper for tests and chromeless gating. */
export function shouldUseChromelessShell(input: {
  pathname: string
  instantMeetingOpen: boolean
  globalPresentation: GlobalSessionPresentation | null
}): boolean {
  const { pathname, instantMeetingOpen, globalPresentation } = input
  // Mini-player / PiP: show normal app chrome so other tabs stay usable.
  if (globalPresentation === 'minimized' || globalPresentation === 'pip') {
    return false
  }
  if (instantMeetingOpen && globalPresentation !== 'minimized') {
    // Instant overlay fullscreen (or no global session yet).
    if (!globalPresentation || globalPresentation === 'fullscreen') return true
  }
  if (pathname.startsWith('/ui-kit')) return true
  if (pathname.startsWith('/payu-embed-return')) return true
  if (pathname.startsWith('/co-work/meeting/') || pathname === '/co-work/meeting') return true
  if (pathname.startsWith('/chat/call/')) return true
  return false
}

export function useGlobalSessionStore(): GlobalSessionStore {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}

export function useGlobalSession(): GlobalSessionState | null {
  return useGlobalSessionStore().session
}
