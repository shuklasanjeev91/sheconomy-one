import { AppLink } from '~/components/navigation/AppLink'

import { CommercePanel } from '~/commerce/components'
import { useCreateShopHome } from '~/commerce/hooks/useCreateShopHome'
import { createShopHomeHref } from '~/commerce/lib/create-shop-home'
import { Button, Icons, Text, XStack, YStack } from '~/components/ui'
import { useAppUi } from '~/lib/theme/useAppUi'

export function CreateShopHomeStrip({ inset = false }: { inset?: boolean }) {
  const ui = useAppUi()
  const { card, hasCard } = useCreateShopHome()

  if (!hasCard || !card) return null

  const body = (
    <CommercePanel gap="$3">
      <XStack gap="$3" alignItems="flex-start">
        <YStack
          width={44}
          height={44}
          borderRadius={12}
          backgroundColor={ui.badgeBrandBg}
          alignItems="center"
          justifyContent="center"
        >
          <Icons.Store size={22} color={ui.badgeBrandText} />
        </YStack>
        <YStack flex={1} minWidth={0} gap="$2">
          <Text fontSize={18} fontWeight="800" color={ui.text}>
            {card.headline}
          </Text>
          <Text fontSize={13} color={ui.textSecondary}>
            {card.detail}
          </Text>
          <AppLink href={createShopHomeHref()} asChild>
            <Button tone="primary" size="$3" alignSelf="flex-start" borderRadius={999}>
              Create my shop
            </Button>
          </AppLink>
        </YStack>
      </XStack>
    </CommercePanel>
  )

  if (inset) return body
  return body
}
