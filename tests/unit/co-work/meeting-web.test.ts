import { describe, expect, it } from 'vitest'

import {
  describeMeetingWebScreenShare,
  detectMeetingWebCapabilities,
  mapWebMediaPermissionError,
  mapWebScreenShareError,
  meetingWebJoinBlocker,
  meetingWebUnsupportedMessage,
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
    expect(mapWebMediaPermissionError('camera', new Error('NotAllowedError'))).toMatch(/Camera access is blocked/)
    expect(mapWebMediaPermissionError('microphone', new DOMException('Denied', 'NotAllowedError'))).toMatch(
      /Microphone access is blocked/,
    )
    expect(mapWebMediaPermissionError('camera', new Error('NotFoundError'))).toMatch(/No camera was found/)
    expect(mapWebMediaPermissionError('microphone', new Error('NotReadableError'))).toMatch(/in use/)
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
})
