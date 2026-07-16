import { usePathname } from 'one'

import { AppLink } from '~/components/navigation/AppLink'
import { Button, Icons, Text, XStack, YStack } from '~/components/ui'
import { radius } from '~/config/tokens'
import { useAppLayout } from '~/hooks/useAppLayout'
import { vendorRoutes } from '~/lib/routes'
import { useAppUi } from '~/lib/theme/useAppUi'

import { getActiveVendorNavItem } from '~/commerce/components/vendor/vendor-nav'

export function VendorComingSoonScreen() {
  const ui = useAppUi()
  const { isDesktop, safeBottom } = useAppLayout()
  const pathname = usePathname()
  const active = getActiveVendorNavItem(pathname)
  const Icon = active.icon ?? Icons.Sparkles

  return (
    <YStack
      width="100%"
      maxWidth="100%"
      flex={1}
      alignItems="center"
      justifyContent="center"
      paddingHorizontal={isDesktop ? '$6' : '$4'}
      paddingTop={isDesktop ? '$8' : '$6'}
      paddingBottom={(isDesktop ? 48 : 32) + safeBottom}
      gap="$4"
      minHeight={360}
    >
      <YStack
        width={80}
        height={80}
        borderRadius={999}
        backgroundColor={ui.roseSurface}
        alignItems="center"
        justifyContent="center"
      >
        <Icon size={36} color={ui.brand} />
      </YStack>

      <YStack gap="$2" alignItems="center" maxWidth={440}>
        <XStack
          alignItems="center"
          gap={6}
          paddingHorizontal={10}
          paddingVertical={4}
          borderRadius={999}
          backgroundColor={ui.chip}
        >
          <Icons.Sparkles size={13} color={ui.brand} />
          <Text fontSize={11} fontWeight="700" color={ui.textSecondary} letterSpacing={0.4}>
            COMING SOON
          </Text>
        </XStack>
        <Text fontSize={isDesktop ? 24 : 20} fontWeight="800" color={ui.text} textAlign="center" letterSpacing={-0.4}>
          {active.label}
        </Text>
        <Text fontSize={14} color={ui.textSecondary} textAlign="center" lineHeight={21}>
          {active.description} We're building this out — check back soon.
        </Text>
      </YStack>

      <AppLink href={vendorRoutes.myShop} asChild>
        <Button tone="primary" size="$4" borderRadius={999} icon={<Icons.Store size={16} />}>
          Open My Shop
        </Button>
      </AppLink>
    </YStack>
  )
}
