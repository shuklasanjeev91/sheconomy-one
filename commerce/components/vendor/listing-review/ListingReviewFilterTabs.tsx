import { ScrollView, Text, XStack, YStack, Icons } from '~/components/ui'
import type { ListingReviewHubTab, ListingReviewHubTabDef } from '~/lib/listing-reviews/listing-reviews-ui.utils'
import type { AppUiTokens } from '~/lib/theme/app-ui'

type ListingReviewFilterTabsProps = {
  ui: AppUiTokens
  tabs: ListingReviewHubTabDef[]
  activeTab: ListingReviewHubTab
  onChange: (tab: ListingReviewHubTab) => void
}

function TabIcon({ tab, color }: { tab: ListingReviewHubTab; color: string }) {
  const size = 14
  switch (tab) {
    case 'overview':
      return <Icons.BarChart3 size={size} color={color} />
    case 'pending':
      return <Icons.Clock size={size} color={color} />
    case 'responses':
      return <Icons.MessageSquare size={size} color={color} />
    default:
      return <Icons.List size={size} color={color} />
  }
}

export function ListingReviewFilterTabs({ ui, tabs, activeTab, onChange }: ListingReviewFilterTabsProps) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} width="100%">
      <XStack gap="$2" paddingVertical="$1">
        {tabs.map((tab) => {
          const isActive = tab.id === activeTab
          const color = isActive ? ui.brand : ui.textSecondary

          return (
            <XStack
              key={tab.id}
              alignItems="center"
              gap="$1.5"
              paddingHorizontal="$3"
              paddingVertical="$2"
              borderRadius={999}
              borderWidth={1}
              borderColor={isActive ? ui.brand : ui.borderSubtle}
              backgroundColor={isActive ? ui.roseSurface : ui.surface}
              cursor="pointer"
              animation="quick"
              pressStyle={{ opacity: 0.85 }}
              onPress={() => onChange(tab.id)}
            >
              <TabIcon tab={tab.id} color={color} />
              <Text fontSize={13} fontWeight="700" color={color}>
                {tab.label}
              </Text>
              {tab.count != null ? (
                <YStack
                  minWidth={20}
                  height={20}
                  paddingHorizontal={6}
                  borderRadius={999}
                  alignItems="center"
                  justifyContent="center"
                  backgroundColor={tab.alert && !isActive ? '#FEE2E2' : isActive ? `${ui.brand}22` : ui.chip}
                >
                  <Text
                    fontSize={10}
                    fontWeight="800"
                    color={tab.alert && !isActive ? '#DC2626' : isActive ? ui.brand : ui.textMuted}
                  >
                    {tab.count}
                  </Text>
                </YStack>
              ) : null}
            </XStack>
          )
        })}
      </XStack>
    </ScrollView>
  )
}
