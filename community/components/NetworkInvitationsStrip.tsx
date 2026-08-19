import { AppLink } from '~/components/navigation/AppLink'

import { CommunityCard } from '~/community/components/CommunityCard'
import { MemberRow } from '~/community/components/MemberRow'
import { useNetwork } from '~/community/hooks/useNetwork'
import { selectNetworkInvitations } from '~/community/lib/network-invitations'
import { useCommunityUi } from '~/community/lib/community-theme'
import { Button, Text, XStack, YStack } from '~/components/ui'
import { useAppLayout } from '~/hooks/useAppLayout'
import { communityRoutes } from '~/lib/routes'

const INVITATION_LIMIT = 4

export function NetworkInvitationsStrip() {
  const communityUi = useCommunityUi()
  const { hasDualSideRails } = useAppLayout()
  const network = useNetwork()

  if (hasDualSideRails) return null
  if (!network.isAuthenticated) return null
  if (network.pendingReceived.length === 0) return null

  const invitations = selectNetworkInvitations(network.pendingReceived, INVITATION_LIMIT)

  return (
    <CommunityCard padding={16} gap={12}>
      <XStack alignItems="center" justifyContent="space-between" gap={8}>
        <YStack flex={1} minWidth={0} gap={2}>
          <Text fontSize={16} fontWeight="700" color={communityUi.text}>
            Connection invitations
          </Text>
          <Text fontSize={13} color={communityUi.textMuted}>
            {network.pendingReceived.length === 1
              ? 'One person wants to connect with you.'
              : `${network.pendingReceived.length} people want to connect with you.`}
          </Text>
        </YStack>
        {network.pendingReceived.length > INVITATION_LIMIT ? (
          <AppLink href={communityRoutes.peopleTab('pending-received')} asChild>
            <Button tone="ghost" size="$2" borderRadius={999}>
              See all
            </Button>
          </AppLink>
        ) : null}
      </XStack>

      <YStack gap={0}>
        {invitations.map((member) => (
          <MemberRow key={member.user_id} member={member} compact showConnect />
        ))}
      </YStack>
    </CommunityCard>
  )
}
