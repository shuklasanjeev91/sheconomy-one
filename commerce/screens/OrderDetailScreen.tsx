import { useCallback, useEffect, useMemo, useState } from 'react'
import { AppLink } from '~/components/navigation/AppLink'

import { CommercePageHeader, CommercePanel } from '~/commerce/components'
import { CancelOrderSheet, OrderSupportSheet } from '~/commerce/components/OrderActionSheets'
import { OrderIssueCommentsThread } from '~/commerce/components/OrderIssueCommentsThread'
import { OrderPackageCard } from '~/commerce/components/OrderPackageCard'
import { OrderTimeline } from '~/commerce/components/OrderTimeline'
import {
  ReturnOrderItemSheet,
  WriteReviewSheet,
} from '~/commerce/components/OrderTrustSheets'
import { OrderStatusBadge } from '~/commerce/components/vendor/OrderStatusBadge'
import {
  evaluateReorderCandidates,
  fetchCustomerOrderDetail,
  getItemTrustEligibility,
  getOrderEligibility,
  subscribeCustomerOrderChanges,
  type CustomerOrderDetail,
  type CustomerOrderItem,
  type CustomerOrderPackage,
} from '~/commerce/lib/customer-orders'
import {
  buildCustomerOrderTimeline,
  formatEstimatedDelivery,
  issueStatusLabel,
  issueTypeLabel,
  refundStatusLabel,
} from '~/commerce/lib/customer-order-lifecycle'
import { fetchOrderDigitalDownload } from '~/commerce/lib/customer-order-trust'
import { useCart } from '~/commerce/hooks/useCart'
import {
  Button,
  Icons,
  Image,
  Spinner,
  Text,
  XStack,
  YStack,
  useAppToast,
} from '~/components/ui'
import { PageContent } from '~/components/layout'
import { shareCustomerOrderInvoice } from '~/lib/orders/order-invoice'
import { formatOrderAmount, formatOrderDate } from '~/lib/orders/order.utils'
import type { OrderAddressSummary } from '~/lib/orders/vendor-orders.type'
import { resumeOrderOnlinePayment } from '~/commerce/lib/resume-order-payment'
import { openExternalUrl } from '~/lib/platform/openUrl'
import { commerceRoutes } from '~/lib/routes'
import {
  formatCustomerContactPhone,
} from '~/features/auth/services/account-contact'
import { useProfile } from '~/hooks/useProfile'
import { useAppUi } from '~/lib/theme/useAppUi'
import { useAppLayout } from '~/hooks/useAppLayout'
import { navigateApp, replaceApp } from '~/lib/platform/navigate'

function addressLines(address: OrderAddressSummary | null | undefined): string[] {
  if (!address) return []
  return [
    address.address_line_1,
    address.address_line_2,
    [address.city, address.state].filter(Boolean).join(', ') || null,
    [address.postal_code, address.country].filter(Boolean).join(' ') || null,
  ].filter((line): line is string => Boolean(line && line.trim()))
}

function variationLabel(details: unknown): string | null {
  if (!details || typeof details !== 'object' || Array.isArray(details)) return null
  const entries = Object.entries(details as Record<string, unknown>).filter(
    ([key]) => key !== 'variant_id',
  )
  if (!entries.length) return null
  return entries.map(([key, value]) => `${key}: ${String(value)}`).join(' · ')
}

type OrderDetailScreenProps = {
  orderId: string
}

export function OrderDetailScreen({ orderId }: OrderDetailScreenProps) {
  const ui = useAppUi()
  const toast = useAppToast()
  const { isDesktopWeb } = useAppLayout()
  const { user, profile } = useProfile()
  const { addToCart } = useCart()
  const [order, setOrder] = useState<CustomerOrderDetail | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cancelOpen, setCancelOpen] = useState(false)
  const [supportOpen, setSupportOpen] = useState(false)
  const [returnItem, setReturnItem] = useState<CustomerOrderItem | null>(null)
  const [reviewItem, setReviewItem] = useState<CustomerOrderItem | null>(null)
  const [downloadingItemId, setDownloadingItemId] = useState<string | null>(null)
  const [reordering, setReordering] = useState(false)
  const [invoicing, setInvoicing] = useState(false)
  const [completingPayment, setCompletingPayment] = useState(false)

  const load = useCallback(
    async (opts?: { soft?: boolean }) => {
      if (!user?.id || !orderId) {
        setIsLoading(false)
        return
      }
      if (!opts?.soft) setIsLoading(true)
      const result = await fetchCustomerOrderDetail(orderId, user.id)
      setOrder(result.order)
      setError(result.error)
      setIsLoading(false)
      setRefreshing(false)
    },
    [orderId, user?.id],
  )

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (!orderId) return
    return subscribeCustomerOrderChanges(orderId, () => {
      void load({ soft: true })
    })
  }, [orderId, load])

  const eligibility = useMemo(
    () => (order ? getOrderEligibility(order) : null),
    [order],
  )

  const timeline = useMemo(() => {
    if (!order) return []
    return buildCustomerOrderTimeline({
      orderStatus: order.order_status,
      statusLogs: order.status_logs,
      deliveries: order.deliveries,
      createdAt: order.created_at,
    })
  }, [order])

  const packages = useMemo(() => {
    if (!order) return []
    return dedupeOrderPackages(order.deliveries, order.estimated_delivery_date)
  }, [order])

  const reviewableItems = useMemo(() => {
    if (!order) return []
    return order.items.filter((item) => getItemTrustEligibility(order, item).canReview)
  }, [order])

  const orderEta = order ? formatEstimatedDelivery(order.estimated_delivery_date) : null

  const shippingLines = addressLines(order?.shipping_address)

  async function handleReorder() {
    if (!order) return
    setReordering(true)
    const { eligible, skipped } = evaluateReorderCandidates(order.items)
    let added = 0
    for (const item of eligible) {
      const result = await addToCart(item.listing_id, {
        quantity: item.quantity,
        variantId: item.variant_id,
      })
      if (!result.error) added += 1
      else {
        skipped.push({ item, eligible: false, reason: result.error })
      }
    }
    setReordering(false)

    if (added > 0) {
      toast.show(added === 1 ? 'Item added to cart' : `${added} items added to cart`, {
        tone: 'success',
        message:
          skipped.length > 0
            ? `${skipped.length} item(s) couldn’t be added.`
            : undefined,
      })
      navigateApp(commerceRoutes.cart)
      return
    }

    toast.show('Nothing could be reordered', {
      tone: 'danger',
      message: skipped[0]?.reason ?? 'Those listings are unavailable.',
    })
  }

  async function handleDownload(item: CustomerOrderItem) {
    setDownloadingItemId(item.id)
    const result = await fetchOrderDigitalDownload(item.id)
    setDownloadingItemId(null)
    if (result.error || !result.data) {
      toast.show('Download unavailable', {
        tone: 'danger',
        message: result.error ?? 'Could not open the download.',
      })
      return
    }
    const opened = await openExternalUrl(result.data.url)
    if (!opened) {
      toast.show('Could not open download', {
        tone: 'danger',
        message: 'Your device blocked the download link.',
      })
      return
    }
    void load({ soft: true })
  }

  async function handleInvoice() {
    if (!order || !user) return
    setInvoicing(true)
    const customerPhoneLabel = formatCustomerContactPhone({
      authUser: user,
      profilePhone: profile?.phone,
    })
    const result = await shareCustomerOrderInvoice(
      {
        orderNumber: order.order_number,
        orderDate: order.created_at,
        currency: order.currency,
        shopName: order.shop_name,
        customerName:
          profile?.full_name?.trim() ||
          (typeof user.user_metadata?.full_name === 'string' && user.user_metadata.full_name) ||
          user.email ||
          'Customer',
        customerEmail: profile?.email?.trim() || user.email || null,
        customerPhone: customerPhoneLabel !== 'Not added' ? customerPhoneLabel : null,
        shippingAddress: order.shipping_address,
        subtotalAmount: order.subtotal_amount,
        discountAmount: order.discount_amount,
        shippingAmount: order.shipping_amount,
        taxAmount: order.tax_amount,
        totalAmount: order.total_amount,
        paymentMode: order.payment_mode,
        paymentStatus: order.payment_status,
        items: order.items.map((item) => ({
          title: item.product_title,
          sku: item.product_sku,
          variation: variationLabel(item.variation_details),
          unitPrice: item.unit_price,
          quantity: item.quantity,
          totalPrice: item.total_price,
        })),
      },
      { brandColor: ui.brand, shopName: order.shop_name },
    )
    setInvoicing(false)
    if (!result.ok) {
      toast.show('Invoice unavailable', {
        tone: result.reason === 'unsupported' ? 'info' : 'danger',
        message:
          result.reason === 'unsupported'
            ? 'Sharing is not available on this device.'
            : 'Could not open the invoice. Please try again.',
      })
    }
  }

  async function handleCompletePayment() {
    if (!order) return
    setCompletingPayment(true)
    const result = await resumeOrderOnlinePayment(order.id)
    setCompletingPayment(false)
    if (!result.ok) {
      toast.show('Could not open payment', {
        tone: 'danger',
        message: result.error,
      })
      return
    }
    replaceApp(result.href as never)
  }

  const isAwaitingPayment = order?.order_status === 'awaiting_payment'
  const bottomPad = isDesktopWeb ? '$12' : '$8'

  return (
    <PageContent
      maxWidth={760}
      centered
      paddingVertical="$6"
      paddingBottom={bottomPad}
      refreshing={refreshing}
      onRefresh={async () => {
        setRefreshing(true)
        await load({ soft: true })
      }}
    >
      {isLoading && !order ? (
        <YStack alignItems="center" paddingVertical="$8" gap="$3" minHeight={220}>
          <Spinner size="large" color={ui.brand} />
          <Text fontSize={13} color={ui.textMuted}>
            Loading order…
          </Text>
        </YStack>
      ) : error && !order ? (
        <CommercePanel alignItems="center" gap="$3">
          <Text fontWeight="700" fontSize={16} color={ui.text} textAlign="center">
            Couldn&apos;t load this order
          </Text>
          <Text fontSize={14} color={ui.textMuted} textAlign="center">
            {error}
          </Text>
          <Button tone="primary" size="$3" borderRadius={999} onPress={() => void load()}>
            Try again
          </Button>
        </CommercePanel>
      ) : !order ? (
        <CommercePanel alignItems="center" gap="$3">
          <Text fontWeight="700" fontSize={16} color={ui.text} textAlign="center">
            Order not found
          </Text>
          <Text fontSize={14} color={ui.textMuted} textAlign="center" lineHeight={20}>
            This order may belong to another account or no longer exists.
          </Text>
          <Button
            tone="primary"
            size="$3"
            borderRadius={999}
            onPress={() => replaceApp(commerceRoutes.orders)}
          >
            Back to orders
          </Button>
        </CommercePanel>
      ) : (
        <YStack gap="$5" width="100%" flexShrink={0}>
          <AppLink href={commerceRoutes.orders} asChild>
            <Button
              tone="ghost"
              size="$2"
              alignSelf="flex-start"
              paddingHorizontal={0}
              icon={<Icons.ArrowLeft size={16} />}
            >
              All orders
            </Button>
          </AppLink>

          <CommercePageHeader
            title={`Order #${order.order_number}`}
            subtitle={`${order.shop_name ?? 'Shop'} · ${formatOrderDate(order.created_at, true)}`}
          />

          <CommercePanel gap="$3">
            <XStack
              justifyContent="space-between"
              alignItems="flex-start"
              gap="$3"
              flexWrap="wrap"
            >
              <YStack gap="$2">
                <OrderStatusBadge status={order.order_status} />
                <Text fontSize={12} color={ui.textSecondary} textTransform="capitalize">
                  {[order.payment_mode, order.payment_status].filter(Boolean).join(' · ') ||
                    'Payment pending'}
                </Text>
                {orderEta ? (
                  <Text fontSize={12} color={ui.textSecondary}>
                    Estimated delivery: {orderEta}
                  </Text>
                ) : null}
              </YStack>
              <YStack alignItems="flex-end" gap={2}>
                <Text fontSize={22} fontWeight="800" color={ui.brand}>
                  {formatOrderAmount(order.total_amount, order.currency)}
                </Text>
                <Text fontSize={11} color={ui.textMuted}>
                  Order total
                </Text>
              </YStack>
            </XStack>

            <YStack height={1} backgroundColor={ui.borderSubtle} />

            <YStack gap="$2">
              <SummaryRow label="Subtotal" value={formatOrderAmount(order.subtotal_amount, order.currency)} />
              {Number(order.discount_amount) > 0 ? (
                <SummaryRow
                  label="Discount"
                  value={`- ${formatOrderAmount(order.discount_amount, order.currency)}`}
                />
              ) : null}
              <SummaryRow
                label="Shipping"
                value={formatOrderAmount(order.shipping_amount, order.currency)}
              />
              <SummaryRow label="Tax" value={formatOrderAmount(order.tax_amount, order.currency)} />
            </YStack>
          </CommercePanel>

          {reviewableItems.length > 0 ? (
            <CommercePanel gap="$3" borderWidth={1} borderColor={ui.brand}>
              <XStack gap="$3" alignItems="flex-start">
                <Icons.Star size={20} color={ui.brand} flexShrink={0} marginTop={2} />
                <YStack flex={1} gap="$1">
                  <Text fontWeight="800" fontSize={14} color={ui.text}>
                    How was your order?
                  </Text>
                  <Text fontSize={13} color={ui.textSecondary} lineHeight={20}>
                    Your package was delivered. A short review helps other members and the seller.
                  </Text>
                </YStack>
              </XStack>
              <XStack gap="$2" flexWrap="wrap">
                {reviewableItems.slice(0, 3).map((item) => (
                  <Button
                    key={item.id}
                    tone="primary"
                    size="$3"
                    borderRadius={999}
                    icon={<Icons.Star size={14} />}
                    onPress={() => setReviewItem(item)}
                  >
                    Review {item.product_title?.slice(0, 28) || 'item'}
                  </Button>
                ))}
              </XStack>
            </CommercePanel>
          ) : null}

          {isAwaitingPayment ? (
            <CommercePanel
              gap="$3"
              borderWidth={1.5}
              borderColor={ui.warning ?? '#f59e0b'}
              backgroundColor={ui.warningMuted ?? '#fffbeb'}
            >
              <XStack gap="$3" alignItems="flex-start">
                <Icons.AlertCircle size={20} color={ui.warning ?? '#d97706'} flexShrink={0} marginTop={2} />
                <YStack flex={1} gap="$1">
                  <Text fontWeight="800" fontSize={14} color={ui.text}>
                    Payment not completed
                  </Text>
                  <Text fontSize={13} color={ui.textSecondary} lineHeight={20}>
                    Your order is reserved but we haven&apos;t received payment yet. Complete payment to confirm your order.
                  </Text>
                </YStack>
              </XStack>
              <Button
                tone="primary"
                size="$3"
                borderRadius={999}
                disabled={completingPayment}
                onPress={() => void handleCompletePayment()}
              >
                {completingPayment ? 'Opening payment…' : 'Complete payment'}
              </Button>
            </CommercePanel>
          ) : null}

          <CommercePanel gap="$3">
            <Text fontSize={14} fontWeight="800" color={ui.text}>
              Items
            </Text>
            <YStack gap="$3">
              {order.items.map((item, itemIndex) => {
                const trust = getItemTrustEligibility(order, item)
                const itemRefund = order.refunds.find((refund) => refund.order_item_id === item.id)
                const isLastItem = itemIndex === order.items.length - 1
                return (
                  <YStack
                    key={item.id}
                    gap="$2"
                    paddingBottom={isLastItem ? 0 : '$3'}
                    borderBottomWidth={isLastItem ? 0 : 1}
                    borderBottomColor={ui.borderSubtle}
                  >
                    <XStack gap="$3" alignItems="flex-start">
                      <YStack
                        width={64}
                        height={64}
                        borderRadius={10}
                        overflow="hidden"
                        backgroundColor={ui.imagePlaceholder}
                        alignItems="center"
                        justifyContent="center"
                        flexShrink={0}
                      >
                        {item.image_url ? (
                          <Image
                            src={item.image_url}
                            width={64}
                            height={64}
                            objectFit="cover"
                          />
                        ) : (
                          <Icons.Image size={22} color={ui.textMuted} />
                        )}
                      </YStack>
                      <YStack flex={1} minWidth={0} gap={3}>
                        {item.listing_slug ? (
                          <AppLink href={commerceRoutes.listing(item.listing_slug)} asChild>
                            <Text fontSize={14} fontWeight="700" color={ui.text} numberOfLines={2}>
                              {item.product_title}
                            </Text>
                          </AppLink>
                        ) : (
                          <Text fontSize={14} fontWeight="700" color={ui.text} numberOfLines={2}>
                            {item.product_title}
                          </Text>
                        )}
                        <Text fontSize={12} color={ui.textMuted}>
                          Qty {item.quantity}
                          {variationLabel(item.variation_details)
                            ? ` · ${variationLabel(item.variation_details)}`
                            : ''}
                        </Text>
                        <OrderStatusBadge status={item.item_status} size="sm" />
                        {itemRefund ? (
                          <Text fontSize={11} color={ui.textSecondary}>
                            Refund {refundStatusLabel(itemRefund.refund_status)} ·{' '}
                            {formatOrderAmount(itemRefund.refund_amount, order.currency)}
                          </Text>
                        ) : null}
                        {trust.hasReview ? (
                          <Text fontSize={11} color={ui.textMuted}>
                            Review submitted
                          </Text>
                        ) : null}
                      </YStack>
                      <Text fontSize={14} fontWeight="800" color={ui.text} flexShrink={0}>
                        {formatOrderAmount(item.total_price, order.currency)}
                      </Text>
                    </XStack>
                    <XStack gap="$2" flexWrap="wrap">
                      {trust.canDownload ? (
                        <Button
                          tone="primary"
                          size="$3"
                          borderRadius={999}
                          disabled={downloadingItemId === item.id}
                          icon={<Icons.Download size={14} />}
                          onPress={() => void handleDownload(item)}
                        >
                          {downloadingItemId === item.id ? 'Opening…' : 'Download'}
                        </Button>
                      ) : null}
                      {trust.canReview ? (
                        <Button
                          tone="outline"
                          size="$3"
                          borderRadius={999}
                          icon={<Icons.Star size={14} />}
                          onPress={() => setReviewItem(item)}
                        >
                          Write a review
                        </Button>
                      ) : null}
                      {trust.canReturn ? (
                        <Button
                          tone="outline"
                          size="$3"
                          borderRadius={999}
                          icon={<Icons.PackageMinus size={14} />}
                          onPress={() => setReturnItem(item)}
                        >
                          Return item
                        </Button>
                      ) : trust.hasOpenReturnRequest ? (
                        <Text fontSize={12} color={ui.textMuted}>
                          Return request pending
                        </Text>
                      ) : null}
                    </XStack>
                  </YStack>
                )
              })}
            </YStack>
          </CommercePanel>

          <CommercePanel gap="$3">
            <Text fontSize={14} fontWeight="800" color={ui.text}>
              Delivery address
            </Text>
            {shippingLines.length ? (
              <YStack gap={2}>
                {shippingLines.map((line) => (
                  <Text key={line} fontSize={13} color={ui.textSecondary} lineHeight={20}>
                    {line}
                  </Text>
                ))}
              </YStack>
            ) : (
              <Text fontSize={13} color={ui.textMuted}>
                No shipping address on this order.
              </Text>
            )}
          </CommercePanel>

          <CommercePanel gap="$3">
            <Text fontSize={14} fontWeight="800" color={ui.text}>
              Order timeline
            </Text>
            <OrderTimeline events={timeline} />
          </CommercePanel>

          <CommercePanel gap="$3">
            <Text fontSize={14} fontWeight="800" color={ui.text}>
              Packages & tracking
            </Text>
            {packages.length === 0 ? (
              <Text fontSize={13} color={ui.textMuted} lineHeight={20}>
                The shop hasn&apos;t added shipment tracking yet. You&apos;ll see carrier details here
                once your package ships.
              </Text>
            ) : (
              packages.map((shipment, index) => (
                <OrderPackageCard
                  key={shipment.id}
                  shipment={shipment}
                  index={index}
                  embedded
                />
              ))
            )}
          </CommercePanel>

          {order.issues.length > 0 ? (
            <CommercePanel gap="$3">
              <Text fontSize={14} fontWeight="800" color={ui.text}>
                Your requests
              </Text>
              {order.issues.map((issue) => (
                <YStack
                  key={issue.id}
                  gap="$2.5"
                  padding="$3"
                  borderRadius={12}
                  borderWidth={1}
                  borderColor={ui.borderSubtle}
                  backgroundColor={ui.surface}
                >
                  <Text fontSize={13} fontWeight="700" color={ui.text}>
                    {issueTypeLabel(issue.issue_type)}
                  </Text>
                  <Text fontSize={12} color={ui.textSecondary}>
                    {issueStatusLabel(issue.status)} · {formatOrderDate(issue.created_at, true)}
                  </Text>
                  <Text fontSize={12} color={ui.textMuted}>
                    {issue.description}
                  </Text>
                  <OrderIssueCommentsThread
                    ui={ui}
                    issueId={issue.id}
                    resolutionNote={issue.resolution_note}
                    compact
                  />
                </YStack>
              ))}
            </CommercePanel>
          ) : null}

          <CommercePanel gap="$3">
            <Text fontSize={14} fontWeight="800" color={ui.text}>
              Actions
            </Text>
            <XStack gap="$2" flexWrap="wrap">
              {eligibility?.canShareInvoice ? (
                <Button
                  tone="outline"
                  size="$3"
                  borderRadius={999}
                  disabled={invoicing}
                  icon={<Icons.Download size={14} />}
                  onPress={() => void handleInvoice()}
                >
                  {invoicing ? 'Preparing…' : 'Invoice / receipt'}
                </Button>
              ) : null}
              {eligibility?.canReorder ? (
                <Button
                  tone="outline"
                  size="$3"
                  borderRadius={999}
                  disabled={reordering}
                  icon={<Icons.ShoppingCart size={14} />}
                  onPress={() => void handleReorder()}
                >
                  {reordering ? 'Adding…' : 'Reorder'}
                </Button>
              ) : null}
              {eligibility?.canCancel ? (
                <Button
                  tone="outline"
                  size="$3"
                  borderRadius={999}
                  icon={<Icons.XCircle size={14} />}
                  onPress={() => setCancelOpen(true)}
                >
                  Request cancellation
                </Button>
              ) : eligibility?.hasOpenCancellationRequest ? (
                <Text fontSize={12} color={ui.textMuted}>
                  Cancellation request pending
                </Text>
              ) : null}
              {eligibility?.canGetHelp ? (
                <Button
                  tone="primary"
                  size="$3"
                  borderRadius={999}
                  icon={<Icons.MessageCircle size={14} />}
                  onPress={() => setSupportOpen(true)}
                >
                  Get help
                </Button>
              ) : null}
            </XStack>
            {eligibility?.cancelBlockedReason && !eligibility.canCancel ? (
              <Text fontSize={11} color={ui.textMuted}>
                {eligibility.cancelBlockedReason}
              </Text>
            ) : null}
          </CommercePanel>

          {user?.id ? (
            <>
              <CancelOrderSheet
                open={cancelOpen}
                onOpenChange={setCancelOpen}
                orderId={order.id}
                userId={user.id}
                onSubmitted={() => void load({ soft: true })}
              />
              <OrderSupportSheet
                open={supportOpen}
                onOpenChange={setSupportOpen}
                orderId={order.id}
                orderNumber={order.order_number}
                userId={user.id}
                onSubmitted={() => void load({ soft: true })}
              />
              <ReturnOrderItemSheet
                open={Boolean(returnItem)}
                onOpenChange={(next) => {
                  if (!next) setReturnItem(null)
                }}
                orderId={order.id}
                userId={user.id}
                item={returnItem}
                onSubmitted={() => void load({ soft: true })}
              />
              <WriteReviewSheet
                open={Boolean(reviewItem)}
                onOpenChange={(next) => {
                  if (!next) setReviewItem(null)
                }}
                orderId={order.id}
                userId={user.id}
                item={reviewItem}
                onSubmitted={() => void load({ soft: true })}
              />
            </>
          ) : null}
        </YStack>
      )}
    </PageContent>
  )
}

function dedupeOrderPackages(
  deliveries: CustomerOrderPackage[],
  orderEta: string | null | undefined,
): CustomerOrderPackage[] {
  const merged = new Map<string, CustomerOrderPackage>()

  for (const row of deliveries) {
    const key = row.order_item_id ?? row.id
    const existing = merged.get(key)
    if (!existing) {
      merged.set(key, row)
      continue
    }
    merged.set(key, {
      ...existing,
      ...row,
      estimated_delivery_date:
        row.estimated_delivery_date ?? existing.estimated_delivery_date ?? orderEta ?? null,
      tracking_number: row.tracking_number ?? existing.tracking_number,
      carrier_tracking_url: row.carrier_tracking_url ?? existing.carrier_tracking_url,
      carrier_name: row.carrier_name ?? existing.carrier_name,
      product_title: row.product_title ?? existing.product_title,
    })
  }

  return [...merged.values()].map((pkg) => ({
    ...pkg,
    estimated_delivery_date: pkg.estimated_delivery_date ?? orderEta ?? null,
  }))
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  const ui = useAppUi()
  return (
    <XStack justifyContent="space-between" gap="$3">
      <Text fontSize={13} color={ui.textSecondary}>
        {label}
      </Text>
      <Text fontSize={13} fontWeight="600" color={ui.text}>
        {value}
      </Text>
    </XStack>
  )
}
