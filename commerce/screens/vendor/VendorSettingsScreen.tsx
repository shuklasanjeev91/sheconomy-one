import { Link } from 'one'

import { Button, Icons, Text, YStack } from '~/components/ui'
import { SurfaceCard } from '~/components/layout'
import { radius } from '~/config/tokens'
import { useAppLayout } from '~/hooks/useAppLayout'
import { routes, vendorRoutes } from '~/lib/routes'
import { useAppUi } from '~/lib/theme/useAppUi'

/**
 * Shop console settings stay scoped to the storefront.
 * Personal account prefs (alerts, appearance, security) live at `/settings` for every tab.
 */
export function VendorSettingsScreen() {
  const ui = useAppUi()
  const { isDesktop, safeBottom } = useAppLayout()

  return (
    <YStack
      width="100%"
      maxWidth={640}
      alignSelf="center"
      flex={1}
      paddingHorizontal={isDesktop ? '$6' : '$4'}
      paddingTop={isDesktop ? '$6' : '$4'}
      paddingBottom={(isDesktop ? 48 : 32) + safeBottom}
      gap="$4"
    >
      <YStack gap="$2">
        <Text fontSize={isDesktop ? 22 : 20} fontWeight="800" color={ui.text} letterSpacing={-0.3}>
          Shop settings
        </Text>
        <Text fontSize={14} color={ui.textSecondary} lineHeight={21}>
          Storefront configuration will live here. Your personal account settings are shared across
          Marketplace, Community, Chat, and every other tab — open them once below.
        </Text>
      </YStack>

      <SurfaceCard padding="$4" gap="$3" borderRadius={radius.md}>
        <YStack
          width={44}
          height={44}
          borderRadius={999}
          backgroundColor={ui.chip}
          alignItems="center"
          justifyContent="center"
        >
          <Icons.User size={22} color={ui.brand} />
        </YStack>
        <YStack gap="$1">
          <Text fontSize={16} fontWeight="700" color={ui.text}>
            Account settings
          </Text>
          <Text fontSize={13} color={ui.textSecondary} lineHeight={19}>
            Security, appearance, marketplace alerts, community alerts, and privacy — one place for
            every product area.
          </Text>
        </YStack>
        <Link href={routes.settings} asChild>
          <Button tone="primary" size="$4" borderRadius={999} icon={<Icons.Settings size={16} />}>
            Open account settings
          </Button>
        </Link>
      </SurfaceCard>

      <Link href={vendorRoutes.myShop} asChild>
        <Button tone="ghost" size="$3" icon={<Icons.Store size={16} />}>
          Back to My Shop
        </Button>
      </Link>
    </YStack>
  )
}
