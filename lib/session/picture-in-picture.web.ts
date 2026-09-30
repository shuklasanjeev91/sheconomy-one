/**
 * Web Picture-in-Picture — Document PiP when available, else video element PiP.
 */

export type SessionPipCapabilities = {
  supported: boolean
  mode: 'document' | 'video' | 'native_avkit' | 'native_activity' | 'none'
  unsupportedMessage: string | null
}

export function detectSessionPipCapabilities(): SessionPipCapabilities {
  if (typeof document === 'undefined' || typeof window === 'undefined') {
    return {
      supported: false,
      mode: 'none',
      unsupportedMessage: 'Picture-in-Picture requires a browser window.',
    }
  }

  const docPip = (
    window as Window & {
      documentPictureInPicture?: { requestWindow: (options?: object) => Promise<Window> }
    }
  ).documentPictureInPicture

  if (docPip?.requestWindow) {
    return { supported: true, mode: 'document', unsupportedMessage: null }
  }

  const video = document.createElement('video')
  if (
    typeof video.requestPictureInPicture === 'function' &&
    document.pictureInPictureEnabled !== false
  ) {
    return { supported: true, mode: 'video', unsupportedMessage: null }
  }

  return {
    supported: false,
    mode: 'none',
    unsupportedMessage:
      'Picture-in-Picture is not supported in this browser. Use Minimize to keep browsing Sheconomy with the session running.',
  }
}

export function sessionPipUnsupportedMessage(capabilities: SessionPipCapabilities): string {
  return (
    capabilities.unsupportedMessage ||
    'Picture-in-Picture is not available in this browser.'
  )
}

/** Prefer an active meeting/call video element for element PiP. */
export async function requestWebSessionPictureInPicture(
  videoSelector = 'video',
): Promise<{ ok: boolean; message?: string }> {
  const caps = detectSessionPipCapabilities()
  if (!caps.supported) {
    return { ok: false, message: sessionPipUnsupportedMessage(caps) }
  }

  try {
    if (caps.mode === 'document') {
      const api = (
        window as Window & {
          documentPictureInPicture: { requestWindow: (options?: object) => Promise<Window> }
        }
      ).documentPictureInPicture
      const pipWindow = await api.requestWindow({ width: 360, height: 240 })
      // Caller can move UI into pipWindow; we mark success for presentation state.
      void pipWindow
      return { ok: true }
    }

    const videos = Array.from(document.querySelectorAll(videoSelector)) as HTMLVideoElement[]
    const video =
      videos.find((node) => !node.paused && node.readyState >= 2) ||
      videos.find((node) => node.srcObject || node.currentSrc) ||
      videos[0]
    if (!video) {
      return {
        ok: false,
        message: 'No active video to show in Picture-in-Picture. Try Maximize, then PiP again.',
      }
    }
    await video.requestPictureInPicture()
    return { ok: true }
  } catch (cause) {
    const message =
      cause instanceof Error ? cause.message : 'Could not enter Picture-in-Picture.'
    if (/NotAllowed|Permission|secure/i.test(message)) {
      return {
        ok: false,
        message: 'Allow Picture-in-Picture for this site, then try again.',
      }
    }
    return { ok: false, message }
  }
}

export async function exitWebSessionPictureInPicture(): Promise<void> {
  if (typeof document === 'undefined') return
  if (document.pictureInPictureElement) {
    await document.exitPictureInPicture().catch(() => {})
  }
}

export async function requestSessionPictureInPicture(
  videoSelector?: string,
): Promise<{ ok: boolean; message?: string }> {
  return requestWebSessionPictureInPicture(videoSelector)
}

export async function exitSessionPictureInPicture(): Promise<void> {
  await exitWebSessionPictureInPicture()
}
