import type { ReactNode } from 'react'
import { Slot } from 'one'

import { Text, XStack, YStack } from '~/components/ui'
import { FullWidthLayout, PageSection } from '~/components/layout'
import { BRAND_NAME } from '~/config/brand'
import { useAccess } from '~/hooks/useAccess'
import { useAppLayout } from '~/hooks/useAppLayout'
import { useVendorShops } from '~/hooks/useVendorShops'
import { useAppUi } from '~/lib/theme/useAppUi'

import { SettingsNav } from '~/components/settings/SettingsNav'

const SIDEBAR_WIDTH = 260

/**
 * LinkedIn-style settings chrome: desktop sidebar + detail; mobile uses list→detail routes.
 * Route files render panel content into `<Slot />` on section pages; hub index is separate.
 */
export function SettingsShell({ children }: { children?: ReactNode }) {
  const ui = useAppUi()
  const { isDesktop } = useAppLayout()
  const { canManageShops } = useAccess()
  const { shops } = useVendorShops()
  const showShop = canManageShops || shops.length > 0
  const content = children ?? <Slot />

  if (!isDesktop) {
    return (
      <FullWidthLayout scroll>
        <PageSection paddingVertical="$3">{content}</PageSection>
      </FullWidthLayout>
    )
  }

  return (
    <FullWidthLayout scroll>
      <PageSection paddingVertical="$3">
        <YStack gap="$4" width="100%">
          <YStack gap="$1">
            <Text fontSize={24} fontWeight="800" color={ui.text} letterSpacing={-0.4}>
              Settings
            </Text>
            <Text fontSize={14} color={ui.textMuted}>
              Shared across Marketplace, Community, Chat, Classes, Co-Work, and Manage shop — one
              place for your {BRAND_NAME} account
            </Text>
          </YStack>

          <XStack gap="$5" alignItems="flex-start" width="100%">
            <YStack
              width={SIDEBAR_WIDTH}
              flexShrink={0}
              borderRightWidth={1}
              borderColor={ui.border}
              paddingRight="$4"
            >
              <SettingsNav showShop={showShop} />
            </YStack>

            <YStack flex={1} minWidth={0} width="100%" maxWidth="100%">
              {content}
            </YStack>
          </XStack>
        </YStack>
      </PageSection>
    </FullWidthLayout>
  )
}

/** Mobile hub: category list only — page title lives in AppMobileHeader. */
export function SettingsHubList() {
  const { canManageShops } = useAccess()
  const { shops } = useVendorShops()
  const showShop = canManageShops || shops.length > 0

  return (
    <YStack gap="$4" width="100%">
      <SettingsNav showShop={showShop} compact />
    </YStack>
  )
}
