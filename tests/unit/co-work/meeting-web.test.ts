import { describe, expect, it, vi } from 'vitest'

import { meetingJoinMediaFromPermissions } from '../../../co-work/lib/meeting-media-permissions'
import {
  canCaptureWebMediaWithoutGesture,
  describeMeetingWebScreenShare,
  detectMeetingWebCapabilities,
  mapWebMediaPermissionError,
  mapWebScreenShareError,
  meetingWebJoinBlocker,
  meetingWebUnsupportedMessage,
  queryWebMediaPermission,
  releaseWebMediaStream,
  requestWebMicrophoneStream,
  unlockWebAudioPlayback,
} from '../../../co-work/lib/meeting-web'

describe('meeting web capabilities', () => {
  it('detects missing media APIs without throwing', () => {
    const caps = detectMeetingWebCapabilities({
      isSecureContext: true,
      navigator: {},
      document: {},
    } as unknown as typeof globalThis)
    expect(caps.getUserMedia).toBe(false)
    expect(caps.getDisplayMedia).toBe(false)
    expect(caps.enumerateDevices).toBe(false)
    expect(caps.displaySurfacePicker).toBe(false)
  })

  it('detects getUserMedia / getDisplayMedia / enumerateDevices when present', () => {
    const caps = detectMeetingWebCapabilities({
      isSecureContext: true,
      navigator: {
        mediaDevices: {
          getUserMedia: async () => null,
          getDisplayMedia: async () => null,
          enumerateDevices: async () => [],
        },
      },
      document: {
        documentElement: {
          requestFullscreen: async () => {},
        },
      },
    } as unknown as typeof globalThis)
    expect(caps.secureContext).toBe(true)
    expect(caps.getUserMedia).toBe(true)
    expect(caps.getDisplayMedia).toBe(true)
    expect(caps.enumerateDevices).toBe(true)
    expect(caps.fullscreen).toBe(true)
    expect(caps.displaySurfacePicker).toBe(true)
  })

  it('blocks join when the context is insecure or getUserMedia is missing', () => {
    expect(
      meetingWebJoinBlocker({
        secureContext: false,
        getUserMedia: true,
        getDisplayMedia: true,
        enumerateDevices: true,
        setSinkId: false,
        fullscreen: true,
        displaySurfacePicker: true,
      }),
    ).toBe(meetingWebUnsupportedMessage('secure_context'))

    expect(
      meetingWebJoinBlocker({
        secureContext: true,
        getUserMedia: false,
        getDisplayMedia: false,
        enumerateDevices: false,
        setSinkId: false,
        fullscreen: false,
        displaySurfacePicker: false,
      }),
    ).toBe(meetingWebUnsupportedMessage('microphone'))
  })

  it('maps camera and microphone permission errors to clear copy', () => {
    expect(mapWebMediaPermissionError('camera', new Error('NotAllowedError'))).toMatch(
      /Camera needs permission/,
    )
    expect(mapWebMediaPermissionError('microphone', new DOMException('Denied', 'NotAllowedError'))).toMatch(
      /Tap Unmute/,
    )
    expect(
      mapWebMediaPermissionError('microphone', new DOMException('Denied', 'NotAllowedError'), 'denied'),
    ).toMatch(/Microphone access is blocked/)
    expect(
      mapWebMediaPermissionError('microphone', new DOMException('Denied', 'NotAllowedError'), 'prompt'),
    ).toMatch(/Tap Unmute/)
    expect(mapWebMediaPermissionError('camera', new Error('NotFoundError'))).toMatch(/No camera was found/)
    expect(mapWebMediaPermissionError('microphone', new Error('NotReadableError'))).toMatch(/in use/)
  })

  it('keeps connection failures instead of blaming the browser', () => {
    expect(
      mapWebMediaPermissionError('camera', new Error('Could not reach the meeting media server.')),
    ).toBe('Could not reach the meeting media server.')
    expect(
      mapWebMediaPermissionError('camera', new TypeError('navigator.mediaDevices.getUserMedia is not a function')),
    ).toBe(meetingWebUnsupportedMessage('camera'))
    expect(mapWebMediaPermissionError('camera')).toBe(meetingWebUnsupportedMessage('camera'))
  })

  it('queries the Permissions API without throwing when it is missing', async () => {
    expect(await queryWebMediaPermission('microphone', { navigator: {} } as typeof globalThis)).toBe(
      'unknown',
    )
    expect(
      await queryWebMediaPermission('microphone', {
        navigator: {
          permissions: {
            query: async () => ({ state: 'granted' }),
          },
        },
      } as unknown as typeof globalThis),
    ).toBe('granted')
    expect(canCaptureWebMediaWithoutGesture('granted')).toBe(true)
    expect(canCaptureWebMediaWithoutGesture('prompt')).toBe(false)
    expect(canCaptureWebMediaWithoutGesture('denied')).toBe(false)
  })

  it('retries getUserMedia without advanced constraints when the device is overconstrained', async () => {
    const getUserMedia = vi
      .fn()
      .mockRejectedValueOnce(new DOMException('OverconstrainedError', 'OverconstrainedError'))
      .mockResolvedValueOnce({ getTracks: () => [] })
    const stream = await requestWebMicrophoneStream({ getUserMedia })
    expect(stream).toBeTruthy()
    expect(getUserMedia).toHaveBeenCalledTimes(2)
    expect(getUserMedia.mock.calls[1][0]).toEqual({ audio: true, video: false })
  })

  it('joins muted when the browser has not granted microphone or camera', () => {
    expect(
      meetingJoinMediaFromPermissions({
        ok: true,
        cameraGranted: false,
        microphoneGranted: false,
        notificationsGranted: false,
        screenShareAvailable: true,
        denials: [],
      }),
    ).toEqual({ audioEnabled: false, videoEnabled: false })
    expect(
      meetingJoinMediaFromPermissions(
        {
          ok: true,
          cameraGranted: true,
          microphoneGranted: true,
          notificationsGranted: false,
          screenShareAvailable: true,
          denials: [],
        },
        { audioEnabled: false, videoEnabled: true },
      ),
    ).toEqual({ audioEnabled: false, videoEnabled: true })
  })

  it('maps screen-share picker cancel, deny, and unsupported errors', () => {
    expect(mapWebScreenShareError(new DOMException('The user aborted', 'AbortError'))).toMatch(
      /Entire screen, Window, or Browser tab/,
    )
    expect(mapWebScreenShareError(new Error('NotAllowedError'))).toMatch(/permission was denied/i)
    expect(mapWebScreenShareError(new Error('getDisplayMedia is not a function'))).toBe(
      meetingWebUnsupportedMessage('screen_share'),
    )
  })

  it('points embedded Electron browsers at a regular browser for screen share', () => {
    const notSupported = new DOMException('Not supported', 'NotSupportedError')
    const ide = { navigator: { userAgent: 'Mozilla/5.0 Chrome/148.0 Electron/42.10.0 Safari/537.36' } }
    const desktopApp = { ...ide, sheconomyDesktop: { isDesktop: true } }
    const chrome = { navigator: { userAgent: 'Mozilla/5.0 Chrome/148.0 Safari/537.36' } }

    expect(mapWebScreenShareError(notSupported, ide as unknown as typeof globalThis)).toBe(
      meetingWebUnsupportedMessage('embedded_screen_share'),
    )
    expect(mapWebScreenShareError(notSupported, desktopApp as unknown as typeof globalThis)).toBe(
      meetingWebUnsupportedMessage('screen_share'),
    )
    expect(mapWebScreenShareError(notSupported, chrome as unknown as typeof globalThis)).toBe(
      meetingWebUnsupportedMessage('screen_share'),
    )
  })

  it('describes tab/window/screen picker when getDisplayMedia exists', () => {
    expect(
      describeMeetingWebScreenShare({
        secureContext: true,
        getUserMedia: true,
        getDisplayMedia: true,
        enumerateDevices: true,
        setSinkId: true,
        fullscreen: true,
        displaySurfacePicker: true,
      }),
    ).toMatch(/Entire screen|Window|Browser tab/)

    expect(
      describeMeetingWebScreenShare({
        secureContext: true,
        getUserMedia: true,
        getDisplayMedia: false,
        enumerateDevices: false,
        setSinkId: false,
        fullscreen: false,
        displaySurfacePicker: false,
      }),
    ).toBe(meetingWebUnsupportedMessage('screen_share'))
  })

  it('returns understandable unsupported messages for each feature', () => {
    expect(meetingWebUnsupportedMessage('fullscreen')).toMatch(/Full screen/)
    expect(meetingWebUnsupportedMessage('device_selection')).toMatch(/Device selection/)
    expect(meetingWebUnsupportedMessage('tab_share')).toMatch(/tab sharing/)
    expect(meetingWebUnsupportedMessage('window_share')).toMatch(/Window sharing/)
  })

  it('resumes AudioContext so remote audio can play after a join click', () => {
    const resume = vi.fn(async () => undefined)
    const start = vi.fn()
    const connect = vi.fn()
    class FakeAudioContext {
      createBuffer() {
        return {}
      }
      createBufferSource() {
        return { buffer: null, connect, start }
      }
      resume = resume
    }
    unlockWebAudioPlayback({ AudioContext: FakeAudioContext } as unknown as typeof globalThis)
    expect(resume).toHaveBeenCalled()
    expect(start).toHaveBeenCalled()
  })

  it('stops permission-probe tracks before the meeting recaptures the mic', async () => {
    const stop = vi.fn()
    await releaseWebMediaStream({ getTracks: () => [{ stop }, { stop }] })
    expect(stop).toHaveBeenCalledTimes(2)
  })
})
