import { useCallback, useEffect, useState } from 'react'
import { AppLink } from '~/components/navigation/AppLink'

import { CommercePageHeader, CommercePanel } from '~/commerce/components'
import { OrderSupportSheet } from '~/commerce/components/OrderActionSheets'
import { OrderTimeline } from '~/commerce/components/OrderTimeline'
import { OrderStatusBadge } from '~/commerce/components/vendor/OrderStatusBadge'
import {
  buyerGroupOverallStatusLabel,
  fetchBuyerCheckoutGroupDetail,
  settlementStatusLabel,
  subscribeBuyerCheckoutGroupChanges,
  type BuyerCheckoutGroupDetail,
  type BuyerShopOrderCard,
} from '~/commerce/lib/buyer-checkout-groups'
import { Button, Icons, Image, Spinner, Text, XStack, YStack, useAppToast } from '~/components/ui'
import { PageContent } from '~/components/layout'
import { formatCurrency } from '~/lib/format'
import { getOrderStatusDisplay } from '~/lib/orders/order.utils'
import { commerceRoutes } from '~/lib/routes'
import { useProfile } from '~/hooks/useProfile'
import { useAppUi } from '~/lib/theme/useAppUi'
import { navigateApp } from '~/lib/platform/navigate'
import { copyToClipboard } from '~/lib/platform/clipboard'

type Props = { groupId: string }

function formatDate(value: string | null) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

function ShopOrderCard({
  shop,
  currency,
  onRaiseIssue,
}: {
  shop: BuyerShopOrderCard
  currency: string
  onRaiseIssue: (shop: BuyerShopOrderCard) => void
}) {
  const ui = useAppUi()
  const toast = useAppToast()
  const awb = shop.awb || shop.tracking_number

  return (
    <CommercePanel padding="$4" gap="$3" width="100%">
      <XStack justifyContent="space-between" alignItems="flex-start" gap="$3">
        <XStack gap="$3" flex={1} alignItems="center" minWidth={0}>
          {shop.shop_logo_url ? (
            <Image
              source={{ uri: shop.shop_logo_url }}
              width={40}
              height={40}
              borderRadius={10}
            />
          ) : (
            <YStack
              width={40}
              height={40}
              borderRadius={10}
              backgroundColor={ui.surfaceMuted}
              alignItems="center"
              justifyContent="center"
            >
              <Icons.Store size={18} color={ui.textMuted} />
            </YStack>
          )}
          <YStack flex={1} gap={2} minWidth={0}>
            <Text fontWeight="800" fontSize={15} color={ui.text} numberOfLines={1}>
              {shop.shop_name}
            </Text>
            <Text fontSize={12} color={ui.textMuted} numberOfLines={1}>
              Order #{shop.order_number}
            </Text>
          </YStack>
        </XStack>
        <OrderStatusBadge status={shop.order_status} size="sm" />
      </XStack>

      {(shop.is_cancelled || shop.is_refunded) && (
        <YStack
          padding="$2"
          borderRadius={8}
          backgroundColor={ui.surfaceMuted}
          borderWidth={1}
          borderColor={ui.borderSubtle}
        >
          <Text fontSize={12} color={ui.textSecondary}>
            {shop.is_cancelled
              ? 'This seller order was cancelled. Other shops in this checkout are unaffected.'
              : 'This seller order was refunded. Other shops may still fulfill.'}
          </Text>
        </YStack>
      )}

      <YStack gap="$2">
        {shop.items.map((item) => (
          <XStack key={item.id} justifyContent="space-between" gap="$2">
            <Text fontSize={13} color={ui.text} flex={1} numberOfLines={2}>
              {item.title}
              <Text color={ui.textMuted}> × {item.quantity}</Text>
            </Text>
            <Text fontSize={13} fontWeight="600" color={ui.text}>
              {formatCurrency(item.unit_price * item.quantity, currency)}
            </Text>
          </XStack>
        ))}
      </YStack>

      <YStack gap={4} paddingTop="$1" borderTopWidth={1} borderTopColor={ui.borderSubtle}>
        <XStack justifyContent="space-between">
          <Text fontSize={12} color={ui.textMuted}>
            Subtotal
          </Text>
          <Text fontSize={12} color={ui.text}>
            {formatCurrency(shop.subtotal_amount, currency)}
          </Text>
        </XStack>
        <XStack justifyContent="space-between">
          <Text fontSize={12} color={ui.textMuted}>
            Shipping
          </Text>
          <Text fontSize={12} color={ui.text}>
            {formatCurrency(shop.shipping_amount, currency)}
          </Text>
        </XStack>
        <XStack justifyContent="space-between">
          <Text fontSize={13} fontWeight="700" color={ui.text}>
            Shop total
          </Text>
          <Text fontSize={13} fontWeight="800" color={ui.text}>
            {formatCurrency(shop.total_amount, currency)}
          </Text>
        </XStack>
      </YStack>

      <YStack gap={6}>
        <Text fontSize={12} color={ui.textSecondary}>
          Settlement:{' '}
          <Text fontWeight="600" color={ui.text}>
            {settlementStatusLabel(shop.settlement_status, shop.settlement_hold_reason)}
          </Text>
        </Text>
        {awb ? (
          <XStack alignItems="center" gap="$2" flexWrap="wrap">
            <Text fontSize={12} color={ui.textSecondary}>
              AWB / tracking:{' '}
              <Text fontWeight="700" color={ui.text}>
                {awb}
              </Text>
            </Text>
            <Button
              tone="ghost"
              size="$2"
              borderRadius={999}
              icon={<Icons.Copy size={12} />}
              onPress={async () => {
                const ok = await copyToClipboard(awb)
                toast.show(ok ? 'Tracking copied' : 'Could not copy', {
                  tone: ok ? 'success' : 'danger',
                })
              }}
            >
              Copy
            </Button>
          </XStack>
        ) : (
          <Text fontSize={12} color={ui.textMuted}>
            Tracking not assigned yet
          </Text>
        )}
        {shop.delivery_status ? (
          <Text fontSize={12} color={ui.textMuted}>
            Delivery: {getOrderStatusDisplay(shop.delivery_status).label}
          </Text>
        ) : null}
      </YStack>

      <XStack gap="$2" flexWrap="wrap">
        <Button
          tone="primary"
          size="$3"
          borderRadius={999}
          icon={<Icons.MessageCircle size={14} />}
          onPress={() => onRaiseIssue(shop)}
          disabled={shop.is_cancelled}
        >
          Raise Issue
        </Button>
        <Button
          tone="outline"
          size="$3"
          borderRadius={999}
          onPress={() => navigateApp(commerceRoutes.order(shop.order_id))}
        >
          Full details
        </Button>
      </XStack>
    </CommercePanel>
  )
}

export function CheckoutGroupDetailScreen({ groupId }: Props) {
  const ui = useAppUi()
  const { user } = useProfile()
  const [detail, setDetail] = useState<BuyerCheckoutGroupDetail | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [issueShop, setIssueShop] = useState<BuyerShopOrderCard | null>(null)

  const load = useCallback(
    async (opts?: { soft?: boolean }) => {
      if (!user?.id || !groupId) {
        setIsLoading(false)
        return
      }
      if (!opts?.soft) setIsLoading(true)
      const result = await fetchBuyerCheckoutGroupDetail(groupId, user.id)
      setDetail(result.detail)
      setError(result.error)
      setIsLoading(false)
    },
    [groupId, user?.id],
  )

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    const ids = detail?.group.order_ids ?? []
    if (!ids.length) return
    return subscribeBuyerCheckoutGroupChanges(ids, () => {
      void load({ soft: true })
    })
  }, [detail?.group.order_ids?.join(','), load])

  if (isLoading) {
    return (
      <PageContent>
        <YStack alignItems="center" paddingVertical="$10">
          <Spinner size="large" />
        </YStack>
      </PageContent>
    )
  }

  if (error || !detail) {
    return (
      <PageContent>
        <YStack gap="$3" paddingVertical="$6">
          <Text color={ui.danger}>{error ?? 'Checkout not found'}</Text>
          <AppLink href={commerceRoutes.orders} asChild>
            <Button tone="outline" size="$3" borderRadius={999}>
              Back to orders
            </Button>
          </AppLink>
        </YStack>
      </PageContent>
    )
  }

  const { group, overall_status, shops, timeline, edge_notes } = detail
  const currency = group.currency || 'INR'

  return (
    <PageContent scroll onRefresh={() => load()}>
      <YStack gap="$5" width="100%" paddingVertical="$4">
        <CommercePageHeader
          title="Checkout tracking"
          subtitle={`${shops.length} seller${shops.length === 1 ? '' : 's'} · ${formatDate(group.paid_at ?? group.created_at)}`}
        />

        <CommercePanel padding="$4" gap="$3">
          <XStack justifyContent="space-between" alignItems="flex-start" gap="$3">
            <YStack flex={1} gap={4}>
              <Text fontSize={12} color={ui.textMuted}>
                Overall status
              </Text>
              <Text fontWeight="800" fontSize={18} color={ui.text}>
                {buyerGroupOverallStatusLabel(overall_status)}
              </Text>
              <Text fontSize={13} color={ui.textSecondary}>
                {group.status === 'paid' || group.paid_at
                  ? 'Paid '
                  : group.status === 'cancelled'
                    ? 'Cancelled · '
                    : 'Total '}
                {formatCurrency(Number(group.total_amount ?? 0), currency)}
                {group.payment_mode ? ` · ${group.payment_mode.toUpperCase()}` : ''}
              </Text>
            </YStack>
            <OrderStatusBadge status={overall_status} size="sm" />
          </XStack>
          {edge_notes.map((note) => (
            <Text key={note} fontSize={12} color={ui.textSecondary}>
              {note}
            </Text>
          ))}
        </CommercePanel>

        <YStack gap="$3" width="100%">
          <Text fontWeight="700" fontSize={15} color={ui.text}>
            Sellers in this checkout
          </Text>
          {shops.map((shop) => (
            <ShopOrderCard
              key={`${shop.order_id}-${shop.shop_id ?? 'shop'}`}
              shop={shop}
              currency={currency}
              onRaiseIssue={setIssueShop}
            />
          ))}
        </YStack>

        <CommercePanel padding="$4" gap="$3">
          <Text fontWeight="700" fontSize={15} color={ui.text}>
            Consolidated timeline
          </Text>
          <OrderTimeline events={timeline} />
        </CommercePanel>

        <AppLink href={commerceRoutes.orders} asChild>
          <Button tone="outline" size="$3" borderRadius={999}>
            All orders
          </Button>
        </AppLink>
      </YStack>

      {user?.id && issueShop ? (
        <OrderSupportSheet
          open={Boolean(issueShop)}
          onOpenChange={(open) => {
            if (!open) setIssueShop(null)
          }}
          orderId={issueShop.order_id}
          orderNumber={issueShop.order_number}
          userId={user.id}
          onSubmitted={() => void load({ soft: true })}
        />
      ) : null}
    </PageContent>
  )
}
