import { describe, expect, it, vi } from 'vitest'

import { reinforceCallMediaOnConnect } from '~/co-work/lib/livekit-call-media'
import { getLiveKitRoomOptions } from '~/co-work/lib/livekit-room-options'

describe('reinforceCallMediaOnConnect', () => {
  it('does not republish mic when already enabled without forceMic', async () => {
    const setMicrophoneEnabled = vi.fn(async () => undefined)
    const setCameraEnabled = vi.fn(async () => undefined)
    const room = {
      localParticipant: {
        isMicrophoneEnabled: true,
        isCameraEnabled: true,
        setMicrophoneEnabled,
        setCameraEnabled,
      },
    }

    await reinforceCallMediaOnConnect(room as never, 'meeting', { forceMicEnable: false })
    expect(setMicrophoneEnabled).not.toHaveBeenCalled()
  })

  it('enables mic once when forceMic and currently muted', async () => {
    const setMicrophoneEnabled = vi.fn(async () => undefined)
    const room = {
      localParticipant: {
        isMicrophoneEnabled: false,
        isCameraEnabled: false,
        setMicrophoneEnabled,
        setCameraEnabled: vi.fn(async () => undefined),
      },
    }

    await reinforceCallMediaOnConnect(room as never, 'meeting', { forceMicEnable: true })
    expect(setMicrophoneEnabled).toHaveBeenCalledTimes(1)
  })

  it('keeps the mic track live while muted so unmute is instant', () => {
    expect(getLiveKitRoomOptions('web').publishDefaults?.stopMicTrackOnMute).toBe(false)
    expect(getLiveKitRoomOptions('native').publishDefaults?.stopMicTrackOnMute).toBe(false)
  })
})
