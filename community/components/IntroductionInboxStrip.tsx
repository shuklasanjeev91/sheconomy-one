import { useState } from 'react'

import { CommunityCard } from '~/community/components/CommunityCard'
import { ProfileLink } from '~/community/components/ProfileLink'
import { useCommunityFeedHeader } from '~/community/hooks/useCommunityFeedHeader'
import { useIntroductionInbox } from '~/community/hooks/useIntroductionInbox'
import { respondToIntroduction, type IntroductionRequest } from '~/community/lib/introductions'
import { useCommunityUi } from '~/community/lib/community-theme'
import { Avatar, Button, Text, XStack, YStack, useAppToast } from '~/components/ui'

export function IntroductionInboxStrip() {
  const communityUi = useCommunityUi()
  const { hideSidebarRedundantStrips } = useCommunityFeedHeader()
  const { items, hasItems, refresh } = useIntroductionInbox()
  const toast = useAppToast()
  const [actingId, setActingId] = useState<string | null>(null)

  if (hideSidebarRedundantStrips) return null
  if (!hasItems) return null

  async function respond(request: IntroductionRequest, status: 'accepted' | 'declined') {
    setActingId(request.id)
    const result = await respondToIntroduction(request.id, status)
    setActingId(null)
    if (result.error) {
      toast.show('Could not update introduction', { tone: 'danger', message: result.error })
      return
    }
    toast.show(status === 'accepted' ? 'Introduction accepted' : 'Introduction declined', {
      tone: 'success',
    })
    void refresh()
  }

  return (
    <CommunityCard padding={16} gap={12}>
      <YStack gap={2}>
        <Text fontSize={16} fontWeight="700" color={communityUi.text}>
          Introduction requests
        </Text>
        <Text fontSize={13} color={communityUi.textMuted}>
          People asked you to introduce them to someone in your network.
        </Text>
      </YStack>

      <YStack gap={12}>
        {items.map((request) => (
          <YStack
            key={request.id}
            gap={10}
            padding={12}
            borderRadius={14}
            borderWidth={1}
            borderColor={communityUi.border}
            backgroundColor={communityUi.pageBg}
          >
            <XStack gap={10} alignItems="center">
              <Avatar name={request.requester_name} src={request.requester_avatar ?? undefined} size="$4" />
              <YStack flex={1} minWidth={0} gap={2}>
                <Text fontSize={14} fontWeight="700" color={communityUi.text}>
                  {request.requester_name}
                </Text>
                <Text fontSize={12} color={communityUi.textMuted}>
                  Wants an intro to{' '}
                  <ProfileLink userId={request.target_id}>
                    <Text fontSize={12} fontWeight="600" color={communityUi.brand}>
                      {request.target_name}
                    </Text>
                  </ProfileLink>
                </Text>
              </YStack>
            </XStack>
            {request.message ? (
              <Text fontSize={12} color={communityUi.textMuted}>
                “{request.message}”
              </Text>
            ) : null}
            <XStack gap={8}>
              <Button
                tone="outline"
                size="$2.5"
                borderRadius={999}
                disabled={actingId === request.id}
                onPress={() => void respond(request, 'declined')}
              >
                Decline
              </Button>
              <Button
                tone="primary"
                size="$2.5"
                borderRadius={999}
                disabled={actingId === request.id}
                onPress={() => void respond(request, 'accepted')}
              >
                Accept
              </Button>
            </XStack>
          </YStack>
        ))}
      </YStack>
    </CommunityCard>
  )
}
