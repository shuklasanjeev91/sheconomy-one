import { useEffect, useRef } from 'react'
import { Platform } from 'react-native'

import {
  clearGlobalSession,
  peekGlobalSession,
  registerGlobalSession,
  setGlobalSessionHandlers,
  updateGlobalSessionMedia,
  type GlobalSessionHandlers,
  type GlobalSessionKind,
  type GlobalSessionPresentation,
} from '~/lib/session/global-session'
import {
  detectSessionPipCapabilities,
  sessionPipUnsupportedMessage,
} from '~/lib/session/picture-in-picture'

type UseRegisterGlobalSessionArgs = {
  active: boolean
  kind: GlobalSessionKind
  code: string
  title: string
  subtitle?: string | null
  maximizeHref: string
  presentation?: GlobalSessionPresentation
  media: {
    audioEnabled: boolean
    videoEnabled: boolean
    screenSharing?: boolean
    speakerOn?: boolean
  }
  handlers: GlobalSessionHandlers
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
  media,
  handlers,
}: UseRegisterGlobalSessionArgs) {
  const handlersRef = useRef(handlers)
  handlersRef.current = handlers

  useEffect(() => {
    if (!active || !code) {
      const current = peekGlobalSession()
      if (
        current &&
        current.code === code.replace(/\s/g, '').trim() &&
        (current.presentation === 'minimized' || current.presentation === 'pip')
      ) {
        return
      }
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
      const current = peekGlobalSession()
      // Hand-off to mini-player: keep the global session when collapsing.
      if (
        current &&
        current.code === code.replace(/\s/g, '').trim() &&
        (current.presentation === 'minimized' || current.presentation === 'pip')
      ) {
        return
      }
      clearGlobalSession(code)
    }
  }, [
    active,
    code,
    kind,
    maximizeHref,
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
