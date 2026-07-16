import { Button, Icons, Text, XStack, YStack } from '~/components/ui'
import { AppLink } from '~/components/navigation/AppLink'
import { useAppLayout } from '~/hooks/useAppLayout'
import { vendorRoutes } from '~/lib/routes'
import { useAppUi } from '~/lib/theme/useAppUi'

/**
 * Landing screen a brand-new vendor is sent to right after opening their shop.
 * The full listing composer is not built yet, so this welcomes them and points
 * back to the dashboard in the meantime.
 */
export function VendorCreateListingScreen() {
  const ui = useAppUi()
  const { isDesktop, safeBottom } = useAppLayout()

  return (
    <YStack
      flex={1}
      width="100%"
      alignItems="center"
      justifyContent="center"
      paddingHorizontal={isDesktop ? '$6' : '$4'}
      paddingTop={isDesktop ? '$8' : '$6'}
      paddingBottom={(isDesktop ? 48 : 32) + safeBottom}
      gap="$4"
      minHeight={360}
    >
      <YStack width={80} height={80} borderRadius={999} backgroundColor={ui.roseSurface} alignItems="center" justifyContent="center">
        <Icons.PackagePlus size={36} color={ui.brand} />
      </YStack>

      <YStack gap="$2" alignItems="center" maxWidth={460}>
        <XStack alignItems="center" gap={6} paddingHorizontal={10} paddingVertical={4} borderRadius={999} backgroundColor={ui.chip}>
          <Icons.Sparkles size={13} color={ui.brand} />
          <Text fontSize={11} fontWeight="700" color={ui.textSecondary} letterSpacing={0.4}>
            WELCOME, SELLER
          </Text>
        </XStack>
        <Text fontSize={isDesktop ? 24 : 20} fontWeight="800" color={ui.text} textAlign="center" letterSpacing={-0.4}>
          Create your first listing
        </Text>
        <Text fontSize={14} color={ui.textSecondary} textAlign="center" lineHeight={21}>
          Your shop is ready to go. The listing composer is coming soon — in the meantime, explore your vendor dashboard.
        </Text>
      </YStack>

      <XStack gap="$3" flexWrap="wrap" justifyContent="center">
        <AppLink href={vendorRoutes.home} asChild>
          <Button tone="primary" size="$4" borderRadius={999} icon={<Icons.LayoutDashboard size={16} color="white" />}>
            Go to dashboard
          </Button>
        </AppLink>
        <AppLink href={vendorRoutes.myShop} asChild>
          <Button tone="ghost" size="$4" borderRadius={999} icon={<Icons.Store size={16} color={ui.text} />}>
            View my shop
          </Button>
        </AppLink>
      </XStack>
    </YStack>
  )
}
