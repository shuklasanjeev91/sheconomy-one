import { useCallback, useEffect, useState } from 'react'

import {
  detectMeetingWebCapabilities,
  meetingWebUnsupportedMessage,
} from '~/co-work/lib/meeting-web'

function getFullscreenElement(): Element | null {
  if (typeof document === 'undefined') return null
  return (
    document.fullscreenElement ||
    (document as Document & { webkitFullscreenElement?: Element | null }).webkitFullscreenElement ||
    null
  )
}

async function requestElementFullscreen(element: HTMLElement): Promise<void> {
  if (element.requestFullscreen) {
    await element.requestFullscreen()
    return
  }
  const webkit = (
    element as HTMLElement & { webkitRequestFullscreen?: () => void | Promise<void> }
  ).webkitRequestFullscreen
  if (webkit) {
    await Promise.resolve(webkit.call(element))
  }
}

async function exitDocumentFullscreen(): Promise<void> {
  if (typeof document === 'undefined') return
  if (document.exitFullscreen) {
    await document.exitFullscreen()
    return
  }
  const webkit = (document as Document & { webkitExitFullscreen?: () => void | Promise<void> })
    .webkitExitFullscreen
  if (webkit) await Promise.resolve(webkit.call(document))
}

/**
 * Web Fullscreen API for the meeting stage. Native no-ops via the `.native` stub.
 */
export function useMeetingFullscreen(target?: HTMLElement | null) {
  const capabilities = detectMeetingWebCapabilities()
  const [active, setActive] = useState(false)

  useEffect(() => {
    if (typeof document === 'undefined') return
    const sync = () => setActive(!!getFullscreenElement())
    sync()
    document.addEventListener('fullscreenchange', sync)
    document.addEventListener('webkitfullscreenchange', sync as EventListener)
    return () => {
      document.removeEventListener('fullscreenchange', sync)
      document.removeEventListener('webkitfullscreenchange', sync as EventListener)
    }
  }, [])

  const toggle = useCallback(async () => {
    if (!capabilities.fullscreen) {
      throw new Error(meetingWebUnsupportedMessage('fullscreen'))
    }
    if (getFullscreenElement()) {
      await exitDocumentFullscreen()
      return
    }
    const element =
      target ||
      (typeof document !== 'undefined'
        ? (document.querySelector('.sheconomy-meeting-overlay') as HTMLElement | null) ||
          (document.documentElement as HTMLElement)
        : null)
    if (!element) {
      throw new Error(meetingWebUnsupportedMessage('fullscreen'))
    }
    await requestElementFullscreen(element)
  }, [capabilities.fullscreen, target])

  return {
    supported: capabilities.fullscreen,
    active,
    toggle,
    unsupportedMessage: meetingWebUnsupportedMessage('fullscreen'),
  }
}
