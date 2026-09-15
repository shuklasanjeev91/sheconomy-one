import { describe, expect, it } from 'vitest'

import {
  resolveNotificationActorUserId,
  resolveNotificationPath,
  type AppNotification,
} from '../../../community/lib/notifications'

function notification(overrides: Partial<AppNotification>): AppNotification {
  return {
    id: 'notification-id',
    title: 'Notification',
    message: 'Message',
    type: 'connection_request',
    category: 'social',
    platform: 'community',
    read: false,
    created_at: null,
    action_url: '{{action_url}}',
    image_url: null,
    context_id: '11111111-1111-4111-8111-111111111111',
    context_type: 'connection',
    ...overrides,
  }
}

describe('notification contextual actions', () => {
  it('opens the connection actor profile instead of the connection row id', () => {
    const item = notification({
      parent_context_type: 'user_profile',
      parent_context_id: '22222222-2222-4222-8222-222222222222',
      data: { requester_id: '22222222-2222-4222-8222-222222222222' },
    })

    expect(resolveNotificationActorUserId(item)).toBe(
      '22222222-2222-4222-8222-222222222222',
    )
    expect(resolveNotificationPath(item)).toBe(
      '/profile/22222222-2222-4222-8222-222222222222',
    )
  })

  it('routes a legacy connection notification without actor metadata to Network', () => {
    expect(resolveNotificationPath(notification({}))).toBe('/community/network')
  })

  it('extracts social actors from post notification data', () => {
    const item = notification({
      type: 'post_comment',
      context_type: 'post',
      data: { commenter_id: '33333333-3333-4333-8333-333333333333' },
    })

    expect(resolveNotificationActorUserId(item)).toBe(
      '33333333-3333-4333-8333-333333333333',
    )
  })

  it('uses the viewer profile id from profile-view notifications', () => {
    const item = notification({
      type: 'profile_viewed',
      context_type: 'profile_view',
      context_id: '44444444-4444-4444-8444-444444444444',
      action_url: '/community/analytics',
    })

    expect(resolveNotificationActorUserId(item)).toBe(
      '44444444-4444-4444-8444-444444444444',
    )
    expect(resolveNotificationPath(item)).toBe('/community/analytics')
  })

  it('opens Co-Work live from waiting-room join requests', () => {
    const item = notification({
      type: 'meeting_access_request',
      context_type: 'meeting',
      context_id: '55555555-5555-4555-8555-555555555555',
      action_url: null,
      data: { meeting_code: 'ABCD12' },
    })
    expect(resolveNotificationPath(item)).toBe('/co-work/meeting/ABCD12/live')
  })
})
