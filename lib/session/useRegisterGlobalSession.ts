import { useEffect, useRef } from 'react'
import { Platform } from 'react-native'

import {
  clearGlobalSession,
  peekGlobalSession,
  registerGlobalSession,
  setGlobalSessionHandlers,
  updateGlobalSessionMedia,
  updateGlobalSessionMeta,
  type GlobalSessionHandlers,
  type GlobalSessionKind,
  type GlobalSessionPresentation,
} from '~/lib/session/global-session'
import {
  detectSessionPipCapabilities,
  sessionPipUnsupportedMessage,
} from '~/lib/session/picture-in-picture'
import {
  normalizeInstantMeetingCode,
  peekInstantMeetingSession,
} from '~/co-work/lib/instant-meeting-session'

type UseRegisterGlobalSessionArgs = {
  active: boolean
  kind: GlobalSessionKind
  code: string
  title: string
  subtitle?: string | null
  maximizeHref: string
  presentation?: GlobalSessionPresentation
  avatarUrl?: string | null
  participantCount?: number | null
  media: {
    audioEnabled: boolean
    videoEnabled: boolean
    screenSharing?: boolean
    speakerOn?: boolean
  }
  handlers: GlobalSessionHandlers
}

function codesMatch(a: string, b: string) {
  return normalizeInstantMeetingCode(a) === normalizeInstantMeetingCode(b)
}

/** Keep the mini-player / overlay alive across LiveKit flaps and Maximize. */
function shouldPreserveGlobalSession(code: string): boolean {
  const current = peekGlobalSession()
  if (!current || !codesMatch(current.code, code)) return false
  if (current.presentation === 'minimized' || current.presentation === 'pip') return true
  const instant = peekInstantMeetingSession()
  // InstantMeetingHost still owns this meeting (fullscreen remount / credential refresh).
  return !!instant && codesMatch(instant.code, code) && (instant.enteredRoom || instant.autoJoin)
}

/**
 * Keep the app-wide session store in sync while a meeting/call is connected.
 */
export function useRegisterGlobalSession({
  active,
  kind,
  code,
  title,
  subtitle,
  maximizeHref,
  presentation,
  avatarUrl,
  participantCount,
  media,
  handlers,
}: UseRegisterGlobalSessionArgs) {
  const handlersRef = useRef(handlers)
  handlersRef.current = handlers

  useEffect(() => {
    if (!active || !code) {
      if (shouldPreserveGlobalSession(code)) return
      clearGlobalSession(code)
      return
    }
    const pip = detectSessionPipCapabilities(Platform.OS)
    registerGlobalSession({
      kind,
      code,
      title,
      subtitle,
      maximizeHref,
      presentation,
      avatarUrl,
      participantCount,
      media: {
        audioEnabled: media.audioEnabled,
        videoEnabled: media.videoEnabled,
        screenSharing: media.screenSharing ?? false,
        speakerOn: media.speakerOn ?? true,
      },
      pipSupported: pip.supported,
      pipUnsupportedMessage: pip.supported ? null : sessionPipUnsupportedMessage(pip),
      handlers: {
        toggleMic: () => handlersRef.current.toggleMic?.(),
        toggleCamera: () => handlersRef.current.toggleCamera?.(),
        toggleSpeaker: () => handlersRef.current.toggleSpeaker?.(),
        end: () => handlersRef.current.end?.(),
        enterPip: () => handlersRef.current.enterPip?.(),
        exitPip: () => handlersRef.current.exitPip?.(),
        browseAway: () => handlersRef.current.browseAway?.(),
      },
    })
    return () => {
      if (shouldPreserveGlobalSession(code)) return
      clearGlobalSession(code)
    }
  }, [
    active,
    avatarUrl,
    code,
    kind,
    maximizeHref,
    participantCount,
    presentation,
    subtitle,
    title,
  ])

  useEffect(() => {
    if (!active) return
    updateGlobalSessionMedia({
      audioEnabled: media.audioEnabled,
      videoEnabled: media.videoEnabled,
      screenSharing: media.screenSharing ?? false,
      speakerOn: media.speakerOn ?? true,
    })
  }, [
    active,
    media.audioEnabled,
    media.screenSharing,
    media.speakerOn,
    media.videoEnabled,
  ])

  useEffect(() => {
    if (!active) return
    updateGlobalSessionMeta({
      avatarUrl,
      participantCount,
      title,
      subtitle,
    })
  }, [active, avatarUrl, participantCount, subtitle, title])

  useEffect(() => {
    if (!active) return
    setGlobalSessionHandlers({
      toggleMic: () => handlersRef.current.toggleMic?.(),
      toggleCamera: () => handlersRef.current.toggleCamera?.(),
      toggleSpeaker: () => handlersRef.current.toggleSpeaker?.(),
      end: () => handlersRef.current.end?.(),
      enterPip: () => handlersRef.current.enterPip?.(),
      exitPip: () => handlersRef.current.exitPip?.(),
      browseAway: () => handlersRef.current.browseAway?.(),
    })
  }, [active])
}
