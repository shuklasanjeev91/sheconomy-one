import { describe, expect, it, vi } from 'vitest'

import { flipLocalParticipantCamera } from '~/co-work/lib/livekit-flip-camera'

vi.mock('react-native', () => ({
  Platform: { OS: 'android' },
}))

describe('flipLocalParticipantCamera', () => {
  it('applies facingMode via applyConstraints without unpublishing', async () => {
    const applyConstraints = vi.fn(async () => undefined)
    const switchCamera = vi.fn()
    const unpublishTrack = vi.fn(async () => undefined)
    const setCameraEnabled = vi.fn(async () => undefined)
    const participant = {
      isCameraEnabled: true,
      getTrackPublication: () => ({
        track: {
          mediaStreamTrack: {
            applyConstraints,
            _switchCamera: switchCamera,
            getSettings: () => ({ facingMode: 'environment' }),
          },
        },
      }),
      unpublishTrack,
      setCameraEnabled,
    }
    const facing = await flipLocalParticipantCamera(participant as never, 'user')
    expect(facing).toBe('environment')
    expect(applyConstraints).toHaveBeenCalled()
    expect(unpublishTrack).not.toHaveBeenCalled()
    expect(setCameraEnabled).not.toHaveBeenCalled()
  })

  it('flips from app facing state when getSettings omits facingMode', async () => {
    let settings: Record<string, string> = {}
    const applyConstraints = vi.fn(async (c: { facingMode?: unknown }) => {
      const mode =
        typeof c.facingMode === 'string'
          ? c.facingMode
          : (c.facingMode as { exact?: string } | undefined)?.exact
      if (mode === 'user' || mode === 'environment') settings = { facingMode: mode }
    })
    const participant = {
      isCameraEnabled: true,
      getTrackPublication: () => ({
        track: {
          mediaStreamTrack: {
            applyConstraints,
            getSettings: () => ({ ...settings }),
          },
        },
      }),
      setCameraEnabled: vi.fn(async () => undefined),
    }
    const facing = await flipLocalParticipantCamera(participant as never, 'user')
    expect(facing).toBe('environment')
    expect(applyConstraints).toHaveBeenCalled()
  })

  it('enables camera with opposite facing when currently off', async () => {
    const setCameraEnabled = vi.fn(async () => undefined)
    const participant = {
      isCameraEnabled: false,
      getTrackPublication: () => null,
      setCameraEnabled,
    }
    const facing = await flipLocalParticipantCamera(participant as never, 'user')
    expect(facing).toBe('environment')
    expect(setCameraEnabled).toHaveBeenCalledWith(true, { facingMode: 'environment' })
  })
})
