import { useState } from 'react'

import { ShopActionButtons } from '~/commerce/components/ShopActionButtons'
import { CompanyFollowButton } from '~/community/components/CompanyFollowButton'
import { GroupJoinButton } from '~/community/components/GroupJoinButton'
import { ProfileConnectButton } from '~/community/components/ProfileConnectButton'
import { ProfileFollowButton } from '~/community/components/ProfileFollowButton'
import {
  resolveNotificationActorUserId,
  type AppNotification,
} from '~/community/lib/notifications'
import { Button, Icons, XStack, useAppToast } from '~/components/ui'
import { admitParticipant, rejectParticipant } from '~/co-work/lib/meetings'

function contextIdFor(
  notification: AppNotification,
  acceptedTypes: string[],
): string | null {
  const contextType = notification.context_type?.toLowerCase() ?? ''
  if (notification.context_id && acceptedTypes.includes(contextType)) {
    return notification.context_id
  }
  const parentType = notification.parent_context_type?.toLowerCase() ?? ''
  if (notification.parent_context_id && acceptedTypes.includes(parentType)) {
    return notification.parent_context_id
  }
  return null
}

/**
 * Inline response controls for actionable notifications. The controls reuse
 * the same hooks as profile, company, shop, and group surfaces, so state stays
 * consistent everywhere.
 */
export function NotificationContextActions({
  notification,
  onOpen,
}: {
  notification: AppNotification
  onOpen: () => void
}) {
  const type = notification.type.toLowerCase()
  const actorUserId = resolveNotificationActorUserId(notification)
  const groupId = contextIdFor(notification, ['group', 'community_group'])
  const companyId = contextIdFor(notification, ['company', 'company_page'])
  const shopId = contextIdFor(notification, ['shop'])
  const meetingId = contextIdFor(notification, ['meeting'])
  const eventId = contextIdFor(notification, ['event', 'community_event'])
  const isConnectionRequest = type === 'connection_request'
  const isAccessRequest = type === 'meeting_access_request'
  const canJoinMeeting =
    !!meetingId &&
    !isAccessRequest &&
    (type === 'meeting_invitation' ||
      type === 'meeting_started' ||
      type === 'meeting_admitted' ||
      type === 'meeting_participant_joined' ||
      type.startsWith('meeting_reminder_'))
  const groupType =
    typeof notification.data?.group_type === 'string'
      ? notification.data.group_type
      : null

  const hasActions =
    !!actorUserId ||
    !!groupId ||
    !!companyId ||
    !!shopId ||
    canJoinMeeting ||
    isAccessRequest ||
    !!eventId
  if (!hasActions) return null

  return (
    <XStack gap="$2" flexWrap="wrap" alignItems="center" paddingTop="$1.5">
      {actorUserId ? (
        isConnectionRequest ? (
          <ProfileConnectButton targetUserId={actorUserId} size="sm" />
        ) : (
          <>
            <ProfileFollowButton targetUserId={actorUserId} size="sm" />
            <ProfileConnectButton targetUserId={actorUserId} size="sm" />
          </>
        )
      ) : null}
      {groupId ? (
        <GroupJoinButton groupId={groupId} groupType={groupType} size="sm" />
      ) : null}
      {companyId ? <CompanyFollowButton companyId={companyId} size="sm" /> : null}
      {shopId ? <ShopActionButtons shopId={shopId} size="$2" borderRadius={999} /> : null}
      {isAccessRequest ? (
        <MeetingAccessRequestActions notification={notification} />
      ) : null}
      {canJoinMeeting ? (
        <Button
          tone="primary"
          size="$3"
          icon={Icons.Video}
          onPress={onOpen}
        >
          Join meeting
        </Button>
      ) : null}
      {eventId ? (
        <Button
          tone="outline"
          size="$3"
          icon={Icons.Calendar}
          onPress={onOpen}
        >
          View event
        </Button>
      ) : null}
    </XStack>
  )
}

function MeetingAccessRequestActions({ notification }: { notification: AppNotification }) {
  const toast = useAppToast()
  const [done, setDone] = useState<'admitted' | 'denied' | null>(null)
  const [busy, setBusy] = useState(false)
  const participantId =
    typeof notification.data?.participant_id === 'string'
      ? notification.data.participant_id
      : notification.parent_context_id

  if (!participantId) return null
  if (done === 'admitted') {
    return (
      <Button tone="primary" size="$3" disabled>
        Admitted
      </Button>
    )
  }
  if (done === 'denied') {
    return (
      <Button tone="outline" size="$3" disabled>
        Denied
      </Button>
    )
  }

  async function review(action: 'admit' | 'deny') {
    setBusy(true)
    try {
      if (action === 'admit') await admitParticipant(participantId)
      else await rejectParticipant(participantId)
      setDone(action === 'admit' ? 'admitted' : 'denied')
      toast.show(action === 'admit' ? 'Participant admitted' : 'Join request denied', {
        tone: 'success',
      })
    } catch (error) {
      toast.show(error instanceof Error ? error.message : 'Could not update request', {
        tone: 'error',
      })
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <Button
        tone="primary"
        size="$3"
        disabled={busy}
        onPress={() => void review('admit')}
      >
        Admit
      </Button>
      <Button
        tone="outline"
        size="$3"
        disabled={busy}
        onPress={() => void review('deny')}
      >
        Deny
      </Button>
    </>
  )
}
