import { Icons, Text, XStack, YStack } from '~/components/ui'
import { AppLink } from '~/components/navigation/AppLink'
import { radius } from '~/config/tokens'
import { appRoutes } from '~/lib/routes'
import { useAppUi } from '~/lib/theme/useAppUi'
import { useSupabase } from '~/providers/SupabaseProvider'

type CartRecoveryNudgeProps = {
  itemCount: number
  /** Single-line reminder for tight mobile carts. */
  compact?: boolean
}

/**
 * Cart-side reminder that abandoned carts are recovered via email / in-app / push / WhatsApp.
 */
export function CartRecoveryNudge({ itemCount, compact = false }: CartRecoveryNudgeProps) {
  const ui = useAppUi()
  const { user } = useSupabase()

  if (itemCount <= 0) return null

  const prefsHref = user ? appRoutes.settings : appRoutes.signIn
  const prefsLabel = user ? 'Manage preferences' : 'Sign in for reminders'

  if (compact) {
    return (
      <XStack
        width="100%"
        alignItems="center"
        gap="$2"
        paddingHorizontal="$3"
        paddingVertical="$2.5"
        borderRadius={radius.card}
        borderWidth={1}
        borderColor={ui.borderSubtle}
        backgroundColor={ui.surfaceMuted}
      >
        <Icons.Bell size={14} color={ui.brand} />
        <YStack flex={1} minWidth={0} gap={2}>
          <Text fontSize={12} color={ui.textSecondary} numberOfLines={2}>
            We&apos;ll remind you about items left in your cart.
          </Text>
          <AppLink href={prefsHref} asChild>
            <Text fontSize={12} fontWeight="600" color={ui.brand} textDecorationLine="underline">
              {prefsLabel}
            </Text>
          </AppLink>
        </YStack>
      </XStack>
    )
  }

  return (
    <YStack
      width="100%"
      gap="$2"
      padding="$3.5"
      borderRadius={radius.card}
      borderWidth={1}
      borderColor={ui.borderSubtle}
      backgroundColor={ui.surfaceMuted}
    >
      <XStack gap="$2" alignItems="center">
        <Icons.Bell size={15} color={ui.brand} />
        <Text fontSize={13} fontWeight="700" color={ui.text}>
          We will remind you
        </Text>
      </XStack>
      <Text fontSize={12} color={ui.textSecondary} lineHeight={17}>
        {user
          ? 'If you leave items behind, we send gentle reminders by in-app alert, email, push, and WhatsApp (based on your settings).'
          : 'Sign in so we can save your cart and send abandoned-cart reminders across email, in-app, and push.'}
      </Text>
      <AppLink href={prefsHref} asChild>
        <Text fontSize={12} fontWeight="600" color={ui.brand} textDecorationLine="underline">
          {user ? 'Manage notification preferences' : 'Sign in to enable reminders'}
        </Text>
      </AppLink>
    </YStack>
  )
}
