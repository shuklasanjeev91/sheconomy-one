import { useEffect, useState } from 'react'

import { AppLink } from '~/components/navigation/AppLink'
import { CommunityCard } from '~/community/components/CommunityCard'
import { useReportForYouContent } from '~/community/components/ForYouSlot'
import { useCommunityFeedHeader } from '~/community/hooks/useCommunityFeedHeader'
import { useCommunityUi } from '~/community/lib/community-theme'
import { HorizontalScrollRow } from '~/components/layout'
import { Button, Text, XStack, YStack } from '~/components/ui'
import { fetchAiSuggestions, type AiSuggestion } from '~/lib/ai'
import { communityRoutes } from '~/lib/routes'

function peopleChips(rows: AiSuggestion[]) {
  return rows.filter((row) => row.href?.startsWith('/profile/') && row.suggestion_text.trim())
}

export function NetworkSuggestionsStrip() {
  const communityUi = useCommunityUi()
  const { hideSidebarRedundantStrips } = useCommunityFeedHeader()
  const [people, setPeople] = useState<AiSuggestion[]>([])

  useEffect(() => {
    let cancelled = false
    void fetchAiSuggestions({ product: 'community', contextPage: 'network' })
      .then((rows) => {
        if (!cancelled) setPeople(peopleChips(rows))
      })
      .catch(() => {
        if (!cancelled) setPeople([])
      })
    return () => {
      cancelled = true
    }
  }, [])

  const hasContent = !hideSidebarRedundantStrips && people.length > 0
  useReportForYouContent(hasContent)
  if (!hasContent) return null

  return (
    <CommunityCard padding={16} gap={12}>
      <XStack alignItems="center" justifyContent="space-between" gap={8}>
        <YStack flex={1} minWidth={0} gap={2}>
          <Text fontSize={16} fontWeight="700" color={communityUi.text}>
            People you may know
          </Text>
          <Text fontSize={13} color={communityUi.textMuted}>
            Members SHERPA picked from the community.
          </Text>
        </YStack>
        <AppLink href={communityRoutes.network} asChild>
          <Button tone="ghost" size="$2" borderRadius={999}>
            See all
          </Button>
        </AppLink>
      </XStack>

      <HorizontalScrollRow gap={10}>
        {people.map((person) => (
          <AppLink key={person.id} href={person.href as never}>
            <YStack
              width={188}
              padding={12}
              gap={6}
              borderRadius={14}
              borderWidth={1}
              borderColor={communityUi.border}
              backgroundColor={communityUi.pageBg}
            >
              <Text fontSize={14} fontWeight="700" color={communityUi.text} numberOfLines={2}>
                {person.suggestion_text}
              </Text>
              <Text fontSize={12} color={communityUi.textMuted} numberOfLines={1}>
                View profile
              </Text>
            </YStack>
          </AppLink>
        ))}
      </HorizontalScrollRow>
    </CommunityCard>
  )
}
