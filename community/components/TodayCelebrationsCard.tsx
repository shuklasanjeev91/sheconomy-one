import { useCallback, useEffect, useState } from 'react'

import { CommunityCard } from '~/community/components/CommunityCard'
import {
  fetchConnectionOccasionsToday,
  occasionCongratsCopy,
  type ConnectionOccasion,
} from '~/community/lib/occasions'
import { openComposer } from '~/community/lib/composer-store'
import { useCommunityUi } from '~/community/lib/community-theme'
import { HorizontalScrollRow } from '~/components/layout'
import { Avatar, Button, Spinner, Text, XStack, YStack } from '~/components/ui'
import { communityRoutes } from '~/lib/routes'
import { buildSignInUrl } from '~/lib/auth/redirect'
import { useProfile } from '~/hooks/useProfile'
import { navigateApp } from '~/lib/platform/navigate'

export function TodayCelebrationsCard() {
  const communityUi = useCommunityUi()
  const { isAuthenticated } = useProfile()
  const [items, setItems] = useState<ConnectionOccasion[]>([])
  const [loading, setLoading] = useState(false)

  const load = useCallback(() => {
    if (!isAuthenticated) {
      setItems([])
      return
    }
    setLoading(true)
    void fetchConnectionOccasionsToday().then(({ data }) => {
      setItems(data)
      setLoading(false)
    })
  }, [isAuthenticated])

  useEffect(() => {
    load()
  }, [load])

  if (!isAuthenticated) return null
  if (!loading && items.length === 0) return null

  function congratulate(item: ConnectionOccasion) {
    if (!isAuthenticated) {
      navigateApp(buildSignInUrl(String(communityRoutes.home)))
      return
    }
    const copy = occasionCongratsCopy(item)
    openComposer({
      mode: 'celebration',
      occasion: copy.occasion,
      celebrationTitle: copy.celebrationTitle,
      content: copy.content,
    })
  }

  return (
    <CommunityCard padding={16} gap={12}>
      <XStack alignItems="center" justifyContent="space-between" gap={8}>
        <YStack flex={1} minWidth={0} gap={2}>
          <Text fontSize={16} fontWeight="700" color={communityUi.text}>
            Celebrations today
          </Text>
          <Text fontSize={13} color={communityUi.textMuted}>
            Wish your connections well — birthdays, anniversaries, and work milestones.
          </Text>
        </YStack>
        {loading ? <Spinner size="small" /> : null}
      </XStack>

      <HorizontalScrollRow gap={10}>
        {items.map((item) => {
          const name = item.fullName || item.username || 'Connection'
          const detail =
            item.occasion === 'work_anniversary' && item.companyName
              ? `${item.label} · ${item.companyName}`
              : item.years && item.years > 0
                ? `${item.label} · ${item.years}y`
                : item.label

          return (
            <YStack
              key={`${item.userId}-${item.occasion}-${item.companyName ?? ''}`}
              width={168}
              padding={12}
              gap={10}
              borderRadius={14}
              borderWidth={1}
              borderColor={communityUi.border}
              backgroundColor={communityUi.pageBg}
            >
              <XStack gap={10} alignItems="center">
                <Avatar name={name} src={item.avatarUrl} size="$4" />
                <YStack flex={1} minWidth={0} gap={2}>
                  <Text fontSize={14} fontWeight="700" color={communityUi.text} numberOfLines={1}>
                    {name}
                  </Text>
                  <Text fontSize={12} color={communityUi.textMuted} numberOfLines={2}>
                    {detail}
                  </Text>
                </YStack>
              </XStack>
              <Button
                size="$3"
                tone="primary"
                borderRadius={999}
                onPress={() => congratulate(item)}
              >
                Congratulate
              </Button>
            </YStack>
          )
        })}
      </HorizontalScrollRow>
    </CommunityCard>
  )
}
