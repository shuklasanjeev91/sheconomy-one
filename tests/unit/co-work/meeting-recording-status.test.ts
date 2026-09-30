import { describe, expect, it } from 'vitest'

import {
  buildRecordingSharePath,
  createShareToken,
  hashShareToken,
  isActiveRecordingStatus,
  isTerminalRecordingStatus,
  recordingStatusLabel,
} from '~/co-work/lib/meeting-recording-status'

describe('meeting recording status mapping', () => {
  it('classifies active vs terminal statuses', () => {
    expect(isActiveRecordingStatus('starting')).toBe(true)
    expect(isActiveRecordingStatus('recording')).toBe(true)
    expect(isActiveRecordingStatus('processing')).toBe(false)
    expect(isTerminalRecordingStatus('ready')).toBe(true)
    expect(isTerminalRecordingStatus('failed')).toBe(true)
    expect(isTerminalRecordingStatus('recording')).toBe(false)
  })

  it('labels statuses for UI', () => {
    expect(recordingStatusLabel('processing')).toBe('Processing')
    expect(recordingStatusLabel('ready')).toBe('Ready')
  })
})

describe('meeting recording share tokens', () => {
  it('creates opaque tokens and hashes them deterministically', async () => {
    const token = createShareToken(16)
    expect(token).toHaveLength(32)
    expect(token).toMatch(/^[0-9a-f]+$/)

    const hashA = await hashShareToken(token)
    const hashB = await hashShareToken(token)
    const other = await hashShareToken(`${token}x`)

    expect(hashA).toBe(hashB)
    expect(hashA).not.toBe(other)
    expect(hashA).toHaveLength(64)
  })

  it('builds a stable share path', () => {
    expect(buildRecordingSharePath('abc123')).toBe('/co-work/recording/abc123')
  })
})
