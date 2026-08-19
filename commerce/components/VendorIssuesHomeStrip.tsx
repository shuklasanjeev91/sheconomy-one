import { AppLink } from '~/components/navigation/AppLink'

import { CommercePanel } from '~/commerce/components'
import { useVendorIssuesHome } from '~/commerce/hooks/useVendorIssuesHome'
import type { VendorIssuesHomeCard } from '~/commerce/lib/vendor-issues-home'
import { vendorIssuesHomeHref } from '~/commerce/lib/vendor-issues-home'
import { Button, Icons, Text, XStack, YStack } from '~/components/ui'
import { useAppUi } from '~/lib/theme/useAppUi'

function severityColor(ui: ReturnType<typeof useAppUi>, severity: VendorIssuesHomeCard['severity']) {
  switch (severity) {
    case 'critical':
      return ui.danger
    case 'high':
      return ui.notification
    case 'medium':
      return ui.brand
    case 'low':
    default:
      return ui.textSecondary
  }
}

export function VendorIssuesHomeStrip({ inset = false }: { inset?: boolean }) {
  const ui = useAppUi()
  const { cards, hasCards } = useVendorIssuesHome()

  if (!hasCards) return null

  const body = (
    <CommercePanel gap="$3">
      <YStack gap="$1">
        <Text fontSize={18} fontWeight="800" color={ui.text}>
          Open order issues
        </Text>
        <Text fontSize={13} color={ui.textSecondary}>
          Returns, exchanges, and support requests waiting on your shop.
        </Text>
      </YStack>

      <YStack gap="$3">
        {cards.map((card) => (
          <VendorIssuesHomeRow key={card.id} card={card} />
        ))}
      </YStack>

      <AppLink href={vendorIssuesHomeHref()} asChild>
        <Button tone="outline" size="$3" borderRadius={999}>
          Open issues queue
        </Button>
      </AppLink>
    </CommercePanel>
  )

  if (inset) return body
  return body
}

function VendorIssuesHomeRow({ card }: { card: VendorIssuesHomeCard }) {
  const ui = useAppUi()
  const accent = severityColor(ui, card.severity)

  return (
    <AppLink href={card.href} asChild>
      <XStack gap="$3" padding="$3" borderRadius={14} borderWidth={1} borderColor={ui.borderSubtle}>
        <YStack
          width={40}
          height={40}
          borderRadius={10}
          backgroundColor={ui.surfaceMuted}
          alignItems="center"
          justifyContent="center"
        >
          <Icons.AlertCircle size={18} color={accent} />
        </YStack>
        <YStack flex={1} minWidth={0} gap="$1.5">
          <Text fontSize={10} fontWeight="700" color={accent}>
            {card.badge}
          </Text>
          <Text fontSize={14} fontWeight="800" color={ui.text} numberOfLines={2}>
            {card.title}
          </Text>
          <Text fontSize={13} color={ui.textSecondary} numberOfLines={2}>
            {card.detail}
          </Text>
        </YStack>
        <Icons.ChevronRight size={18} color={ui.textMuted} />
      </XStack>
    </AppLink>
  )
}
