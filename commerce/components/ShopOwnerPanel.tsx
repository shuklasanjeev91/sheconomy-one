import { Avatar, Icons, Text, XStack, YStack } from '~/components/ui'
import { ProfileLink } from '~/community/components/ProfileLink'
import type { ShopAddress, ShopOwnerProfile } from '~/commerce/lib/shop-location'
import { formatShopCountry, formatShopLocation } from '~/commerce/lib/shop-location'
import { getShadowStyle, radius } from '~/config/tokens'
import { useAppUi } from '~/lib/theme/useAppUi'

type ShopOwnerPanelProps = {
  owner: ShopOwnerProfile | null
  address: ShopAddress | null
  shopCreatedAt?: string | null
  shopCurrency?: string | null
}

function formatMemberSince(value?: string | null): string | null {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
}

function ownerDisplayName(owner: ShopOwnerProfile): string {
  return owner.full_name?.trim() || owner.business_name?.trim() || owner.username
}

export function ShopOwnerPanel({
  owner,
  address,
  shopCreatedAt,
  shopCurrency,
}: ShopOwnerPanelProps) {
  const ui = useAppUi()
  const location = formatShopLocation(address, owner?.location)
  const country = formatShopCountry(address)
  const memberSince = formatMemberSince(shopCreatedAt)

  const stats = [
    country ? { icon: Icons.Globe, label: 'Country', value: country } : null,
    location && location !== country
      ? { icon: Icons.MapPin, label: 'Location', value: location }
      : null,
    memberSince ? { icon: Icons.Calendar, label: 'Member since', value: memberSince } : null,
    shopCurrency ? { icon: Icons.IndianRupee, label: 'Currency', value: shopCurrency } : null,
  ].filter((item): item is { icon: typeof Icons.Globe; label: string; value: string } => !!item)

  if (!owner && stats.length === 0) return null

  return (
    <YStack
      gap="$4"
      padding="$4.5"
      borderRadius={radius.card}
      borderWidth={1}
      borderColor={ui.borderSubtle}
      backgroundColor={ui.surface}
      style={getShadowStyle('sm')}
    >
      <YStack gap={2}>
        <Text fontWeight="700" fontSize={16} color={ui.text} letterSpacing={-0.15}>
          About this shop
        </Text>
        <Text fontSize={13} color={ui.textMuted} lineHeight={18}>
          Seller details and shop information
        </Text>
      </YStack>

      {owner ? (
        <XStack
          gap="$3"
          alignItems="center"
          padding="$3"
          borderRadius={radius.chip}
          backgroundColor={ui.surfaceMuted}
          borderWidth={1}
          borderColor={ui.borderSubtle}
        >
          <ProfileLink userId={owner.id} username={owner.username}>
            <Avatar
              name={ownerDisplayName(owner)}
              src={owner.avatar_url ?? undefined}
              size="$4"
              cursor="pointer"
            />
          </ProfileLink>
          <YStack flex={1} gap={3} minWidth={0}>
            <ProfileLink userId={owner.id} username={owner.username}>
              <XStack gap="$2" alignItems="center" flexWrap="wrap">
                <Text
                  fontWeight="600"
                  fontSize={15}
                  color={ui.text}
                  cursor="pointer"
                  hoverStyle={{ textDecorationLine: 'underline' }}
                >
                  {ownerDisplayName(owner)}
                </Text>
                {owner.is_verified ? (
                  <XStack
                    gap={4}
                    alignItems="center"
                    paddingHorizontal={8}
                    paddingVertical={2}
                    borderRadius={999}
                    backgroundColor={ui.badgeSuccessBg}
                  >
                    <Icons.Check size={11} color={ui.badgeSuccessText} />
                    <Text fontSize={10} color={ui.badgeSuccessText} fontWeight="600">
                      Verified
                    </Text>
                  </XStack>
                ) : null}
              </XStack>
            </ProfileLink>
            <Text fontSize={13} color={ui.textMuted}>
              @{owner.username}
            </Text>
            {owner.headline ? (
              <Text fontSize={13} color={ui.textSecondary} lineHeight={18} numberOfLines={2}>
                {owner.headline}
              </Text>
            ) : null}
          </YStack>
        </XStack>
      ) : null}

      {stats.length ? (
        <YStack>
          {stats.map((stat, index) => (
            <StatRow
              key={stat.label}
              icon={stat.icon}
              label={stat.label}
              value={stat.value}
              isLast={index === stats.length - 1}
            />
          ))}
        </YStack>
      ) : null}
    </YStack>
  )
}

function StatRow({
  icon: Icon,
  label,
  value,
  isLast,
}: {
  icon: typeof Icons.Globe
  label: string
  value: string
  isLast?: boolean
}) {
  const ui = useAppUi()

  return (
    <XStack
      gap="$3"
      alignItems="center"
      paddingVertical="$2.5"
      paddingHorizontal="$1"
      borderBottomWidth={isLast ? 0 : 1}
      borderBottomColor={ui.borderSubtle}
    >
      <XStack
        width={32}
        height={32}
        borderRadius={8}
        alignItems="center"
        justifyContent="center"
        backgroundColor={ui.chip}
      >
        <Icon size={15} color={ui.textMuted} />
      </XStack>
      <YStack flex={1} gap={1}>
        <Text fontSize={11} color={ui.textMuted} textTransform="uppercase" letterSpacing={0.4}>
          {label}
        </Text>
        <Text fontSize={14} color={ui.text} fontWeight="500">
          {value}
        </Text>
      </YStack>
    </XStack>
  )
}