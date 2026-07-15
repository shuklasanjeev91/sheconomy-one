import { Link } from 'one'
import { useEffect, useState } from 'react'

import { Icons, Image, Text, XStack, YStack } from '~/components/ui'
import { PageSection } from '~/components/layout'
import { fetchActiveSaleEvents, type SaleEventSummary } from '~/commerce/lib/sale-events'
import { radius } from '~/config/tokens'
import { commerceRoutes } from '~/lib/routes'
import { useAppUi } from '~/lib/theme/useAppUi'

type SaleEventBannerProps = {
  /** When true, wraps content in PageSection only after data loads (no empty gap). */
  inset?: boolean
}

/** Promo strip for live sale events (marketplace “sale season” banners). */
export function SaleEventBanner({ inset = false }: SaleEventBannerProps) {
  const ui = useAppUi()
  const [events, setEvents] = useState<SaleEventSummary[]>([])

  useEffect(() => {
    let active = true
    void fetchActiveSaleEvents().then((rows) => {
      if (active) setEvents(rows)
    })
    return () => {
      active = false
    }
  }, [])

  if (!events.length) return null
  const event = events[0]

  const content = (
    <Link href={commerceRoutes.browse('featured')} asChild>
      <XStack
        width="100%"
        minHeight={88}
        borderRadius={radius.card}
        overflow="hidden"
        backgroundColor={ui.roseSurface}
        borderWidth={1}
        borderColor={ui.borderSubtle}
        cursor="pointer"
        pressStyle={{ opacity: 0.92 }}
        alignItems="stretch"
      >
        {event.bannerImage ? (
          <Image
            src={event.bannerImage}
            width={120}
            height={88}
            objectFit="cover"
          />
        ) : (
          <YStack
            width={72}
            alignItems="center"
            justifyContent="center"
            backgroundColor={ui.badgeBrandBg}
          >
            <Icons.Sparkles size={22} color={ui.badgeBrandText} />
          </YStack>
        )}
        <YStack flex={1} padding="$3.5" gap={4} justifyContent="center">
          <Text fontSize={11} fontWeight="700" color={ui.brand} letterSpacing={0.4}>
            LIVE SALE
          </Text>
          <Text fontWeight="700" fontSize={16} color={ui.text} numberOfLines={1}>
            {event.eventName}
          </Text>
          {event.description ? (
            <Text fontSize={12} color={ui.textSecondary} numberOfLines={2}>
              {event.description}
            </Text>
          ) : null}
        </YStack>
        <YStack paddingRight="$3" justifyContent="center">
          <Icons.ChevronRight size={18} color={ui.textSecondary} />
        </YStack>
      </XStack>
    </Link>
  )

  return inset ? <PageSection>{content}</PageSection> : content
}
