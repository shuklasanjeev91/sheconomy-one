import { Text, XStack } from '~/components/ui'
import { DISCOUNT_UI_COPY } from '~/lib/discount/discount-ui.copy'
import type { DiscountHubTab } from '~/lib/discount/discount-ui.utils'
import type { AppUiTokens } from '~/lib/theme/app-ui'

type DiscountFilterTabsProps = {
  ui: AppUiTokens
  activeTab: DiscountHubTab
  onChange: (tab: DiscountHubTab) => void
}

const TAB_LABELS: Record<DiscountHubTab, string> = {
  all: DISCOUNT_UI_COPY.tabs.all,
  active: DISCOUNT_UI_COPY.tabs.active,
  inactive: DISCOUNT_UI_COPY.tabs.inactive,
  expired: DISCOUNT_UI_COPY.tabs.expired,
}

export function DiscountFilterTabs({ ui, activeTab, onChange }: DiscountFilterTabsProps) {
  return (
    <XStack
      alignSelf="flex-start"
      padding={4}
      borderRadius={999}
      borderWidth={1}
      borderColor={ui.borderSubtle}
      backgroundColor={ui.surfaceMuted}
      gap={4}
      flexWrap="wrap"
    >
      {(Object.keys(TAB_LABELS) as DiscountHubTab[]).map((tab) => {
        const active = tab === activeTab
        return (
          <XStack
            key={tab}
            paddingHorizontal="$4"
            paddingVertical="$2"
            borderRadius={999}
            backgroundColor={active ? ui.surface : 'transparent'}
            borderWidth={active ? 1 : 0}
            borderColor={active ? ui.borderSubtle : 'transparent'}
            cursor="pointer"
            animation="quick"
            pressStyle={{ opacity: 0.85 }}
            onPress={() => onChange(tab)}
          >
            <Text fontSize={13} fontWeight="800" color={active ? ui.brand : ui.textSecondary}>
              {TAB_LABELS[tab]}
            </Text>
          </XStack>
        )
      })}
    </XStack>
  )
}
