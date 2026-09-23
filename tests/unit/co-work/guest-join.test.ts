import { describe, expect, it } from 'vitest'

import { isGuestUser } from '../../../co-work/lib/guest-session'
import {
  MEETING_CONTROLS_IDLE_MS,
  shouldAutoHideMeetingControls,
} from '../../../co-work/lib/meeting-ui-overlay'

describe('guest user meeting session and auto-hide controls', () => {
  it('detects guest users correctly from user metadata and anonymous flags', () => {
    expect(isGuestUser(null)).toBe(false)
    expect(isGuestUser(undefined)).toBe(false)

    expect(
      isGuestUser({
        id: 'user-123',
        app_metadata: {},
        user_metadata: { is_guest: true },
        aud: 'authenticated',
        created_at: '',
      }),
    ).toBe(true)

    expect(
      isGuestUser({
        id: 'anon-123',
        is_anonymous: true,
        app_metadata: {},
        user_metadata: {},
        aud: 'authenticated',
        created_at: '',
      }),
    ).toBe(true)

    expect(
      isGuestUser({
        id: 'member-123',
        app_metadata: {},
        user_metadata: { full_name: 'Registered Member' },
        aud: 'authenticated',
        created_at: '',
      }),
    ).toBe(false)
  })

  it('configures standard 5s idle delay for meeting auto-hide', () => {
    expect(MEETING_CONTROLS_IDLE_MS).toBe(5_000)
  })

  it('auto-hides header and bottom toolbar when no panels or waiting participants are active', () => {
    expect(
      shouldAutoHideMeetingControls({
        uiMode: 'normal',
        viewMode: 'gallery',
        panelOpen: false,
        waitingCount: 0,
      }),
    ).toBe(true)

    expect(
      shouldAutoHideMeetingControls({
        uiMode: 'normal',
        viewMode: 'speaker',
        panelOpen: false,
        waitingCount: 0,
      }),
    ).toBe(true)
  })

  it('keeps header and bottom toolbar pinned when panels or waiting room are active', () => {
    expect(
      shouldAutoHideMeetingControls({
        uiMode: 'normal',
        viewMode: 'gallery',
        panelOpen: true, // Side panel open (e.g. chat or participants)
        waitingCount: 0,
      }),
    ).toBe(false)

    expect(
      shouldAutoHideMeetingControls({
        uiMode: 'normal',
        viewMode: 'gallery',
        panelOpen: false,
        waitingCount: 1, // Host needs to see waiting room guest
      }),
    ).toBe(false)

    expect(
      shouldAutoHideMeetingControls({
        uiMode: 'normal',
        viewMode: 'gallery',
        panelOpen: false,
        waitingCount: 0,
        controlsPinned: true, // User pinned controls
      }),
    ).toBe(false)
  })
})
