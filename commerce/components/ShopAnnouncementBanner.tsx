import { Icons, Text, XStack, YStack } from '~/components/ui'
import { radius } from '~/config/tokens'
import { useAppUi } from '~/lib/theme/useAppUi'

type ShopAnnouncementBannerProps = {
  message: string
}

/** marketplace shop announcement strip (sales, shipping delays, custom offers). */
export function ShopAnnouncementBanner({ message }: ShopAnnouncementBannerProps) {
  const ui = useAppUi()
  const trimmed = message.trim()
  if (!trimmed) return null

  return (
    <XStack
      width="100%"
      gap="$2.5"
      padding="$3.5"
      borderRadius={radius.card}
      borderWidth={1}
      borderColor={ui.borderSubtle}
      backgroundColor={ui.roseSurface}
      alignItems="flex-start"
    >
      <Icons.Megaphone size={16} color={ui.brand} />
      <YStack flex={1} gap={2}>
        <Text fontSize={11} fontWeight="700" color={ui.brand} letterSpacing={0.3}>
          SHOP ANNOUNCEMENT
        </Text>
        <Text fontSize={13} color={ui.text} lineHeight={18}>
          {trimmed}
        </Text>
      </YStack>
    </XStack>
  )
}

/** Read announcement text from shop_metadata JSON. */
export function shopAnnouncementFromMetadata(metadata: unknown): string | null {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return null
  const record = metadata as Record<string, unknown>
  const value =
    (typeof record.announcement === 'string' && record.announcement) ||
    (typeof record.shop_announcement === 'string' && record.shop_announcement) ||
    (typeof record.notice === 'string' && record.notice) ||
    null
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

/** Merge announcement into shop_metadata for seller saves. */
export function updateShopAnnouncement(
  currentMetadata: unknown,
  announcement: string,
): Record<string, unknown> {
  const base =
    currentMetadata && typeof currentMetadata === 'object' && !Array.isArray(currentMetadata)
      ? { ...(currentMetadata as Record<string, unknown>) }
      : {}
  const trimmed = announcement.trim()
  if (trimmed) base.announcement = trimmed
  else delete base.announcement
  return base
}
