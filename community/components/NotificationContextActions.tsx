import { ShopActionButtons } from '~/commerce/components/ShopActionButtons'
import { CompanyFollowButton } from '~/community/components/CompanyFollowButton'
import { GroupJoinButton } from '~/community/components/GroupJoinButton'
import { ProfileConnectButton } from '~/community/components/ProfileConnectButton'
import { ProfileFollowButton } from '~/community/components/ProfileFollowButton'
import {
  resolveNotificationActorUserId,
  type AppNotification,
} from '~/community/lib/notifications'
import { Button, Icons, XStack } from '~/components/ui'

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
  const canJoinMeeting =
    !!meetingId &&
    (type === 'meeting_invitation' ||
      type === 'meeting_started' ||
      type.startsWith('meeting_reminder_'))
  const groupType =
    typeof notification.data?.group_type === 'string'
      ? notification.data.group_type
      : null

  const hasActions =
    !!actorUserId || !!groupId || !!companyId || !!shopId || canJoinMeeting || !!eventId
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
