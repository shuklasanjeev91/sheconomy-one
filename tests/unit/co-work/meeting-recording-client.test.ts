import { beforeEach, describe, expect, it, vi } from 'vitest'

const invoke = vi.fn()

vi.mock('~/lib/supabase', () => ({
  supabase: {
    functions: {
      invoke: (...args: unknown[]) => invoke(...args),
    },
  },
}))

import {
  startCloudRecording,
  ZOOM_GRID_RECORDING_COMPOSITION,
} from '~/co-work/lib/meeting-recording-client'

describe('meeting recording client', () => {
  beforeEach(() => {
    invoke.mockReset()
    invoke.mockResolvedValue({
      data: { ok: true, recordingId: 'rec-1', status: 'recording' },
      error: null,
    })
  })

  it('starts recordings as Zoom-style grid video with mixed audio', async () => {
    await expect(
      startCloudRecording({ meetingId: 'meeting-1', roomName: 'room-1' }),
    ).resolves.toMatchObject({ ok: true, recordingId: 'rec-1' })

    expect(invoke).toHaveBeenCalledWith('mediasoup-recording', {
      body: {
        action: 'start',
        meetingId: 'meeting-1',
        roomName: 'room-1',
        composition: ZOOM_GRID_RECORDING_COMPOSITION,
      },
      timeout: 20_000,
    })
  })
})
