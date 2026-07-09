import { useCommunityUi } from '~/community/lib/community-theme'
import { Text, XStack } from '~/components/ui'

export type EntityTab = {
  id: string
  label: string
}

type EntityPageTabsProps = {
  tabs: EntityTab[]
  active: string
  onChange: (id: string) => void
}

export function EntityPageTabs({ tabs, active, onChange }: EntityPageTabsProps) {
  const communityUi = useCommunityUi()
  return (
    <XStack
      gap={0}
      borderBottomWidth={1}
      borderBottomColor={communityUi.borderLight}
      backgroundColor={communityUi.cardBg}
      borderRadius={12}
      overflow="hidden"
    >
      {tabs.map((tab) => {
        const isActive = tab.id === active
        return (
          <XStack
            key={tab.id}
            flex={1}
            minWidth={0}
            paddingVertical={14}
            paddingHorizontal={12}
            alignItems="center"
            justifyContent="center"
            cursor="pointer"
            borderBottomWidth={3}
            borderBottomColor={isActive ? communityUi.brand : 'transparent'}
            hoverStyle={{ backgroundColor: communityUi.divider }}
            onPress={() => onChange(tab.id)}
          >
            <Text
              fontSize={14}
              fontWeight={isActive ? '700' : '600'}
              color={isActive ? communityUi.brand : communityUi.textMuted}
              numberOfLines={1}
            >
              {tab.label}
            </Text>
          </XStack>
        )
      })}
    </XStack>
  )
}