import { describe, expect, it } from 'vitest'
import { ConnectionQuality, ConnectionState } from 'livekit-client'

import {
  connectionStatusLabel,
  deriveMeetingConnectionStatus,
} from '~/co-work/lib/meeting-audio-quality'

describe('meeting audio connection quality', () => {
  it('shows reconnecting while the transport is recovering', () => {
    expect(
      deriveMeetingConnectionStatus(ConnectionState.Reconnecting, ConnectionQuality.Excellent),
    ).toBe('reconnecting')
    expect(
      deriveMeetingConnectionStatus(ConnectionState.SignalReconnecting, ConnectionQuality.Good),
    ).toBe('reconnecting')
  })

  it('maps LiveKit participant quality to user-facing states', () => {
    expect(
      deriveMeetingConnectionStatus(ConnectionState.Connected, ConnectionQuality.Excellent),
    ).toBe('excellent')
    expect(
      deriveMeetingConnectionStatus(ConnectionState.Connected, ConnectionQuality.Good),
    ).toBe('good')
    expect(
      deriveMeetingConnectionStatus(ConnectionState.Connected, ConnectionQuality.Poor),
    ).toBe('poor')
    expect(
      deriveMeetingConnectionStatus(ConnectionState.Connected, ConnectionQuality.Lost),
    ).toBe('poor')
  })

  it('formats the required connection labels', () => {
    expect(connectionStatusLabel('excellent')).toBe('Excellent')
    expect(connectionStatusLabel('good')).toBe('Good')
    expect(connectionStatusLabel('poor')).toBe('Poor')
    expect(connectionStatusLabel('reconnecting')).toBe('Reconnecting')
  })
})
