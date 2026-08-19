import { AppLink } from '~/components/navigation/AppLink'

import { CommercePanel } from '~/commerce/components'
import { useExpiringOffersHome } from '~/commerce/hooks/useExpiringOffersHome'
import type { ExpiringOfferHomeCard } from '~/commerce/lib/expiring-offers-home'
import { expiringOffersHomeHref } from '~/commerce/lib/expiring-offers-home'
import { Button, Icons, Text, XStack, YStack } from '~/components/ui'
import { useAppUi } from '~/lib/theme/useAppUi'

function formatExpiresLabel(iso: string): string {
  const expiresMs = new Date(iso).getTime()
  if (!Number.isFinite(expiresMs)) return 'Expires soon'
  const days = Math.ceil((expiresMs - Date.now()) / (24 * 60 * 60 * 1000))
  if (days <= 0) return 'Expires today'
  if (days === 1) return 'Expires tomorrow'
  return `Expires in ${days} days`
}

export function ExpiringOffersHomeStrip({ inset = false }: { inset?: boolean }) {
  const ui = useAppUi()
  const { cards, hasCards } = useExpiringOffersHome()

  if (!hasCards) return null

  const body = (
    <CommercePanel gap="$3">
      <YStack gap="$1">
        <Text fontSize={18} fontWeight="800" color={ui.text}>
          Codes ending soon
        </Text>
        <Text fontSize={13} color={ui.textSecondary}>
          Use these platform offers before they expire this week.
        </Text>
      </YStack>

      <YStack gap="$3">
        {cards.map((card) => (
          <ExpiringOfferHomeRow key={card.id} card={card} />
        ))}
      </YStack>

      <AppLink href={expiringOffersHomeHref()} asChild>
        <Button tone="outline" size="$3" borderRadius={999}>
          Browse marketplace
        </Button>
      </AppLink>
    </CommercePanel>
  )

  if (inset) return body
  return body
}

function ExpiringOfferHomeRow({ card }: { card: ExpiringOfferHomeCard }) {
  const ui = useAppUi()

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
          <Icons.Tag size={18} color={ui.brand} />
        </YStack>
        <YStack flex={1} minWidth={0} gap="$1.5">
          <Text fontSize={10} fontWeight="700" color={ui.brand}>
            {formatExpiresLabel(card.expiresAt).toUpperCase()}
          </Text>
          <Text fontSize={14} fontWeight="800" color={ui.text} numberOfLines={1}>
            {card.title}
          </Text>
          <Text fontSize={13} color={ui.textSecondary} numberOfLines={1}>
            Code {card.code} · {card.detail}
          </Text>
        </YStack>
        <Icons.ChevronRight size={18} color={ui.textMuted} />
      </XStack>
    </AppLink>
  )
}
