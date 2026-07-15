import { useEffect, useState } from 'react'

import { Icons, Text, XStack, YStack } from '~/components/ui'
import { radius } from '~/config/tokens'
import { CommercePanel } from './CommercePanel'
import {
  fetchShopCommerceSettings,
  type ShopPartnerInfo,
} from '~/commerce/lib/shop-commerce'
import { useAppUi } from '~/lib/theme/useAppUi'

export type OrderShopEntry = {
  shopId: string
  shopName: string
}

type OrderShopPartnersProps = {
  shops: OrderShopEntry[]
  title?: string
  /** Optionally supply already-fetched partner info to avoid a duplicate fetch. */
  partners?: Map<string, ShopPartnerInfo>
  /** Note rendered under the title (e.g. combined vs. shop-wise placement). */
  note?: string
}

/** Shows the payment gateway and shipping partner for each shop in the order. */
export function OrderShopPartners({
  shops,
  title = 'Delivery & payment',
  partners: partnersProp,
  note,
}: OrderShopPartnersProps) {
  const ui = useAppUi()
  const [fetched, setFetched] = useState<Map<string, ShopPartnerInfo>>(new Map())

  const shopKey = shops.map((s) => s.shopId).join(',')
  const useProvided = partnersProp != null

  useEffect(() => {
    if (useProvided || shops.length === 0) return
    let active = true
    void fetchShopCommerceSettings(shopKey ? shopKey.split(',') : []).then((map) => {
      if (active) setFetched(map)
    })
    return () => {
      active = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shopKey, useProvided])

  const partners = partnersProp ?? fetched

  if (shops.length === 0) return null

  return (
    <CommercePanel gap="$3">
      <YStack gap="$1">
        <Text fontWeight="700" fontSize={16} color={ui.text}>
          {title}
        </Text>
        {note ? (
          <Text fontSize={12} color={ui.textSecondary}>
            {note}
          </Text>
        ) : null}
      </YStack>

      <YStack gap="$3">
        {shops.map((shop, index) => {
          const info = partners.get(shop.shopId)
          return (
            <YStack
              key={shop.shopId}
              gap="$2.5"
              paddingTop={index > 0 ? '$3' : 0}
              borderTopWidth={index > 0 ? 1 : 0}
              borderTopColor={ui.borderSubtle}
            >
              <XStack alignItems="center" gap="$2">
                <Icons.Store size={15} color={ui.brand} />
                <Text fontWeight="600" fontSize={14} color={ui.text} numberOfLines={1} flex={1}>
                  {shop.shopName}
                </Text>
              </XStack>

              <ShopPartnerChips info={info} />
            </YStack>
          )
        })}
      </YStack>
    </CommercePanel>
  )
}

/** The "Ships via …" / "Payments by …" chip pair for a single shop. */
export function ShopPartnerChips({ info }: { info?: ShopPartnerInfo }) {
  const ui = useAppUi()
  return (
    <XStack gap="$2" flexWrap="wrap">
      <PartnerChip
        icon={<Icons.Truck size={13} color={ui.textSecondary} />}
        label="Ships via"
        value={info?.shippingLabel ?? 'SHEDelivery'}
      />
      <PartnerChip
        icon={<Icons.CreditCard size={13} color={ui.textSecondary} />}
        label="Payments by"
        value={info?.paymentLabel ?? 'SHEPay'}
      />
    </XStack>
  )
}

function PartnerChip({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode
  label: string
  value: string
}) {
  const ui = useAppUi()
  return (
    <XStack
      alignItems="center"
      gap="$1.5"
      paddingHorizontal="$2.5"
      paddingVertical="$1.5"
      borderRadius={radius.chip}
      borderWidth={1}
      borderColor={ui.borderSubtle}
      backgroundColor={ui.surfaceMuted}
    >
      {icon}
      <Text fontSize={12} color={ui.textMuted}>
        {label}
      </Text>
      <Text fontSize={12} fontWeight="700" color={ui.text}>
        {value}
      </Text>
    </XStack>
  )
}
