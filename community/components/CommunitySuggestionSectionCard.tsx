import { Platform, View } from 'react-native'

import { CommunityProductSuggestionRow } from '~/community/components/CommunityProductSuggestionRow'
import { CommunityShopSuggestionRow } from '~/community/components/CommunityShopSuggestionRow'
import { CommunitySuggestionRow } from '~/community/components/CommunitySuggestionRow'
import { CompanyFollowButton } from '~/community/components/CompanyFollowButton'
import { GroupJoinButton } from '~/community/components/GroupJoinButton'
import { ProfileConnectButton } from '~/community/components/ProfileConnectButton'
import { AppLink } from '~/components/navigation/AppLink'
import { CommunityWidget } from '~/community/components/CommunityWidget'
import type { CommunitySuggestion } from '~/community/lib/community-personalization'
import type { SuggestionSection } from '~/community/hooks/useCommunitySuggestions'
import { useCommunityUi } from '~/community/lib/community-theme'
import { Text, YStack } from '~/components/ui'

type CommunitySuggestionSectionCardProps = {
  section: SuggestionSection
  limit?: number
  compactProducts?: boolean
}

/** Keep FlashList from under-measuring and clipping subtitle / reason lines on native. */
const ROW_MIN_HEIGHT = 64
const PRODUCT_CARD_MIN_HEIGHT = 196
const SECTION_CHROME_HEIGHT = 88

/** Jobs and events stay link-only — they have no single-tap membership action. */
function suggestionAction(item: CommunitySuggestion) {
  if (item.kind === 'person') {
    return <ProfileConnectButton targetUserId={item.id} size="sm" />
  }
  if (item.kind === 'company') {
    return <CompanyFollowButton companyId={item.id} size="sm" />
  }
  if (item.kind === 'group') {
    return <GroupJoinButton groupId={item.id} groupType={item.groupMeta?.groupType} size="sm" />
  }
  return null
}

export function CommunitySuggestionSectionCard({
  section,
  limit = 3,
  compactProducts = false,
}: CommunitySuggestionSectionCardProps) {
  const communityUi = useCommunityUi()
  const items = section.items.slice(0, limit)

  if (!items.length) return null

  const isProductSection = section.kind === 'listing'
  const isShopSection = section.kind === 'shop'
  const rowMinHeight = isProductSection ? PRODUCT_CARD_MIN_HEIGHT : ROW_MIN_HEIGHT
  const minHeight = SECTION_CHROME_HEIGHT + items.length * rowMinHeight

  const card = (
    <CommunityWidget
      title={section.title}
      animated={false}
      footer={
        <AppLink href={section.seeAllHref as never}>
          <Text fontSize={14} fontWeight="600" color={communityUi.brand}>
            See all
          </Text>
        </AppLink>
      }
    >
      <YStack gap={0} width="100%">
        {items.map((item) =>
          isProductSection ? (
            <CommunityProductSuggestionRow
              key={`${item.kind}-${item.id}`}
              item={item}
              compact={compactProducts}
            />
          ) : isShopSection ? (
            <CommunityShopSuggestionRow key={`${item.kind}-${item.id}`} item={item} />
          ) : (
            <CommunitySuggestionRow
              key={`${item.kind}-${item.id}`}
              item={item}
              showKindLabel={false}
              action={suggestionAction(item)}
            />
          ),
        )}
      </YStack>
    </CommunityWidget>
  )

  // Native FlashList: non-collapsible wrapper + minHeight so subtitle/reason stay visible.
  if (Platform.OS !== 'web') {
    return (
      <View collapsable={false} style={{ width: '100%', minHeight }}>
        {card}
      </View>
    )
  }

  return card
}