import { useEffect, useMemo, useState } from 'react'
import { Linking, Platform } from 'react-native'

import {
  Avatar,
  Button,
  Icons,
  Image,
  Input,
  ScrollView,
  Spinner,
  Text,
  XStack,
  YStack,
  useAppToast,
} from '~/components/ui'
import { ViewportOverlay } from '~/components/layout/ViewportOverlay'
import { getShadowStyle, radius } from '~/config/tokens'
import { useLockBodyScroll } from '~/hooks/useLockBodyScroll'
import { useVendorCurrency } from '~/hooks/useVendorCurrency'
import { overlayBackdropStyle, overlayPanelStyle } from '~/lib/layout/styles'
import { shareOrderInvoice } from '~/lib/orders/order-invoice'
import { formatCustomerContactPhone } from '~/features/auth/services/account-contact'
import type { EnrichedOrderIssue } from '~/lib/orders/order-issue.type'
import { openMailtoLink } from '~/lib/platform/openMailto'
import { openExternalUrl, safeHttpUrl } from '~/lib/platform/openUrl'
import {
  DELIVERY_STATUS_DISPLAY,
  ORDER_STATUS,
  RETURN_REJECT_REASON,
  RETURN_REJECT_REASON_LABELS,
  type ReturnRejectReason,
} from '~/lib/orders/order.constants'
import { formatOrderAmount, formatOrderDate } from '~/lib/orders/order.utils'
import type { OrderPayment } from '~/lib/orders/payment.type'
import type { OrderAddressSummary, VendorOrderItem } from '~/lib/orders/vendor-orders.type'
import {
  resolveVendorOrderDelivery,
  resolveVendorShippingAddress,
} from '~/lib/orders/vendor-orders.utils'
import type { AppUiTokens } from '~/lib/theme/app-ui'
import {
  isCancellationIssueType,
  isExchangeIssueType,
  isOpenIssueStatus,
  isReturnIssueType,
  issueStatusLabel,
  issueTypeLabel,
} from '~/commerce/lib/customer-order-lifecycle'
import {
  confirmOrderReturnReceived,
  resolveOrderIssueRequest,
} from '~/commerce/lib/customer-order-trust'
import type { VendorInboxCoordination } from '~/commerce/lib/vendor-inbox-notes'
import {
  getVendorIssueActions,
  type VendorIssueAction,
} from '~/commerce/components/vendor/vendor-issue-actions'

import { OrderStatusBadge } from '~/commerce/components/vendor/OrderStatusBadge'
import { VendorActionButton } from '~/commerce/components/vendor/VendorActionButton'
import { getVendorOrderActions, type VendorOrderAction } from '~/commerce/components/vendor/vendor-order-actions'
import { vendorRoutes } from '~/lib/routes'
import { AppLink } from '~/components/navigation/AppLink'
import {
  canAffordEasyshipShip,
  fetchOrderEasyshipFreight,
} from '~/lib/vendor-shipping/easyship-shipping-credit'

const PANEL_WIDTH = 460

type VendorOrderDetailDrawerProps = {
  ui: AppUiTokens
  open: boolean
  isDesktop: boolean
  item: VendorOrderItem | null
  loading: boolean
  updating: boolean
  coordination?: VendorInboxCoordination | null
  payments: OrderPayment[]
  issues?: EnrichedOrderIssue[]
  role: string | null
  shopId?: string | null
  easyshipCreditBalance?: number | null
  easyshipCreditCurrency?: string
  easyshipCanAfford?: boolean
  easyshipSubmitting?: boolean
  onClose: () => void
  onAdvance: (item: VendorOrderItem, target: VendorOrderAction['target']) => void
  /** Refresh issues / item after seller resolves a request. */
  onIssuesChanged?: () => void
  /** Open Add Tracking for outbound ship or return pickup. */
  onRequestTracking?: (item: VendorOrderItem, mode: 'outbound' | 'return') => void
  onProcessEasyship?: (item: VendorOrderItem) => void
}

function addressLines(address: OrderAddressSummary | null | undefined): string[] {
  if (!address) return []
  return [
    address.address_line_1,
    address.address_line_2,
    [address.city, address.state].filter(Boolean).join(', ') || null,
    [address.postal_code, address.country].filter(Boolean).join(' • ') || null,
  ].filter((line): line is string => Boolean(line && line.trim()))
}

export function VendorOrderDetailDrawer({
  ui,
  open,
  isDesktop,
  item,
  loading,
  updating,
  coordination,
  payments,
  issues = [],
  role,
  shopId,
  easyshipCreditBalance,
  easyshipCreditCurrency,
  easyshipCanAfford,
  easyshipSubmitting,
  onClose,
  onAdvance,
  onIssuesChanged,
  onRequestTracking,
  onProcessEasyship,
}: VendorOrderDetailDrawerProps) {
  const toast = useAppToast()

  // Lock background scroll while open (web); no-op on native.
  useLockBodyScroll(open)

  if (!open) return null

  const panelPositionStyle = overlayPanelStyle()

  return (
    <ViewportOverlay>
      <YStack
        backgroundColor="rgba(0,0,0,0.5)"
        zIndex={100000}
        cursor="pointer"
        style={overlayBackdropStyle()}
        onPress={onClose}
      />
      <YStack
        width={isDesktop ? PANEL_WIDTH : '100%'}
        maxWidth="100%"
        backgroundColor={ui.background}
        borderLeftWidth={isDesktop ? 1 : 0}
        borderLeftColor={ui.borderSubtle}
        zIndex={100001}
        style={panelPositionStyle}
      >
        {loading && !item ? (
          <YStack flex={1} alignItems="center" justifyContent="center">
            <Spinner size="large" />
          </YStack>
        ) : item ? (
          <DrawerBody
            ui={ui}
            item={item}
            updating={updating}
            coordination={coordination ?? null}
            payments={payments}
            issues={issues}
            role={role}
            shopId={shopId}
            easyshipCreditBalance={easyshipCreditBalance}
            easyshipCreditCurrency={easyshipCreditCurrency}
            easyshipCanAfford={easyshipCanAfford}
            easyshipSubmitting={easyshipSubmitting}
            onClose={onClose}
            onAdvance={onAdvance}
            onIssuesChanged={onIssuesChanged}
            onRequestTracking={onRequestTracking}
            onProcessEasyship={onProcessEasyship}
            onContact={() => {
              const email = item.orders?.profiles?.email
              if (email) void openMailtoLink(`mailto:${email}`)
              else toast.show('No customer email on file', { tone: 'danger' })
            }}
            onDownload={() => {
              void shareOrderInvoice(item, { brandColor: ui.brand }).then((result) => {
                if (!result.ok) {
                  toast.show('Invoice unavailable', {
                    tone: result.reason === 'unsupported' ? 'info' : 'danger',
                    message:
                      result.reason === 'unsupported'
                        ? 'Sharing is not available on this device.'
                        : 'Could not open the invoice. Please try again.',
                  })
                }
              })
            }}
          />
        ) : (
          <YStack flex={1} alignItems="center" justifyContent="center" padding="$6" gap="$2">
            <Icons.PackageX size={30} color={ui.textMuted} />
            <Text color={ui.textSecondary}>Order details unavailable.</Text>
            <Button tone="outline" size="$3" borderRadius={999} onPress={onClose}>
              Close
            </Button>
          </YStack>
        )}
      </YStack>
    </ViewportOverlay>
  )
}

type DrawerBodyProps = {
  ui: AppUiTokens
  item: VendorOrderItem
  updating: boolean
  coordination: VendorInboxCoordination | null
  payments: OrderPayment[]
  issues: EnrichedOrderIssue[]
  role: string | null
  shopId?: string | null
  easyshipCreditBalance?: number | null
  easyshipCreditCurrency?: string
  easyshipCanAfford?: boolean
  easyshipSubmitting?: boolean
  onClose: () => void
  onAdvance: (item: VendorOrderItem, target: VendorOrderAction['target']) => void
  onIssuesChanged?: () => void
  onRequestTracking?: (item: VendorOrderItem, mode: 'outbound' | 'return') => void
  onProcessEasyship?: (item: VendorOrderItem) => void
  onContact: () => void
  onDownload: () => void
}

function DrawerBody({
  ui,
  item,
  updating,
  coordination,
  payments,
  issues,
  role,
  shopId,
  easyshipCreditBalance,
  easyshipCreditCurrency = 'INR',
  easyshipCanAfford,
  easyshipSubmitting,
  onClose,
  onAdvance,
  onIssuesChanged,
  onRequestTracking,
  onProcessEasyship,
  onContact,
  onDownload,
}: DrawerBodyProps) {
  const toast = useAppToast()
  const [easyshipFreight, setEasyshipFreight] = useState<number | null>(null)
  const [quoteLoading, setQuoteLoading] = useState(false)
  const [note, setNote] = useState('')
  const [rejectReasonCode, setRejectReasonCode] = useState<string | null>(null)
  const [confirmingReturn, setConfirmingReturn] = useState(false)
  const [actingIssueId, setActingIssueId] = useState<string | null>(null)
  const order = item.orders
  const { resolveCurrency } = useVendorCurrency()
  const currency = resolveCurrency(order?.currency)
  const customer = order?.profiles
  const customerPhoneLabel = useMemo(
    () => formatCustomerContactPhone({ profilePhone: customer?.phone }),
    [customer?.phone],
  )
  const address = resolveVendorShippingAddress(item)
  const lines = addressLines(address)
  const delivery = resolveVendorOrderDelivery(item)
  const deliveryStatusLabel = delivery?.delivery_status
    ? DELIVERY_STATUS_DISPLAY[delivery.delivery_status]?.label ??
      delivery.delivery_status.replace(/_/g, ' ')
    : null
  const trackingCode = delivery?.tracking_number || delivery?.awb_code || null
  const carrierLabel =
    delivery?.courier_service_name || delivery?.carrier_name || null
  const trackingUrl = safeHttpUrl(delivery?.carrier_tracking_url)
  const labelUrl = safeHttpUrl(delivery?.label_url)
  const invoiceUrl = safeHttpUrl(delivery?.invoice_url)
  const manifestUrl = safeHttpUrl(delivery?.manifest_url)
  const actions = useMemo(() => getVendorOrderActions(item.item_status, role), [item.item_status, role])
  const payment = payments[0] ?? null

  const openForShip = [ORDER_STATUS.PENDING, ORDER_STATUS.CONFIRMED, ORDER_STATUS.PROCESSING].includes(
    item.item_status as typeof ORDER_STATUS.PENDING,
  ) && !trackingCode

  const canProcessEasyship = Boolean(onProcessEasyship) && openForShip

  const freightAmount =
    easyshipFreight ??
    (order?.shipping_amount != null ? Number(order.shipping_amount) : null)
  const affordable = canAffordEasyshipShip(
    easyshipCreditBalance,
    freightAmount,
  ) && (easyshipCanAfford !== false)

  useEffect(() => {
    if (!order?.id) {
      setEasyshipFreight(null)
      return
    }
    let active = true
    setQuoteLoading(true)
    void fetchOrderEasyshipFreight(order.id)
      .then((amount) => {
        if (active) setEasyshipFreight(amount)
      })
      .finally(() => {
        if (active) setQuoteLoading(false)
      })
    return () => {
      active = false
    }
  }, [order?.id])
  async function openDoc(url: string, label: string) {
    const opened = await openExternalUrl(url)
    if (!opened) {
      toast.show(`Could not open ${label}`, {
        tone: 'danger',
        message: 'Allow pop-ups for this site, or try again.',
      })
    }
  }
  const openIssues = useMemo(
    () => issues.filter((issue) => isOpenIssueStatus(issue.status)),
    [issues],
  )
  const hasOpenCancellation = openIssues.some((issue) => isCancellationIssueType(issue.issue_type))
  const hasOpenReturn = openIssues.some(
    (issue) => isReturnIssueType(issue.issue_type) || isExchangeIssueType(issue.issue_type),
  )
  const actionableReturnIssue = useMemo(
    () =>
      issues.find((issue) => {
        const actions = getVendorIssueActions(issue)
        return actions.some(
          (action) =>
            action.kind === 'return-received' ||
            action.kind === 'assign-return-tracking' ||
            action.kind === 'ship-replacement',
        )
      }) ?? null,
    [issues],
  )

  async function handleIssueAction(issue: EnrichedOrderIssue, action: VendorIssueAction) {
    if (action.kind === 'assign-return-tracking') {
      onRequestTracking?.(item, 'return')
      return
    }
    if (action.kind === 'ship-replacement') {
      onRequestTracking?.(item, 'outbound')
      return
    }

    const needsRejectReason =
      action.kind === 'decision' &&
      action.decision === 'reject' &&
      (isReturnIssueType(issue.issue_type) || isExchangeIssueType(issue.issue_type))
    if (needsRejectReason && !rejectReasonCode) {
      toast.show('Pick a decline reason', {
        tone: 'danger',
        message: 'Choose why you are declining this return or exchange.',
      })
      return
    }

    setActingIssueId(issue.id)
    try {
      if (action.kind === 'decision') {
        const result = await resolveOrderIssueRequest({
          issueId: issue.id,
          decision: action.decision,
          resolutionNote: note,
          rejectReasonCode: action.decision === 'reject' ? rejectReasonCode : null,
        })
        if (result.error) throw new Error(result.error)

        const isReturnOrExchange =
          isReturnIssueType(issue.issue_type) || isExchangeIssueType(issue.issue_type)
        toast.show(action.decision === 'accept' ? 'Request accepted' : 'Request declined', {
          tone: 'success',
          message:
            action.decision === 'accept' && isReturnOrExchange
              ? 'Arrange return pickup with your courier, then paste the AWB under Arrange return pickup.'
              : undefined,
        })
      } else if (action.kind === 'return-received') {
        setConfirmingReturn(true)
        const result = await confirmOrderReturnReceived({
          orderItemId: item.id,
          note,
        })
        if (result.error) throw new Error(result.error)
        toast.show(
          result.data?.replacementItemId
            ? 'Exchange received — replacement ready to ship'
            : 'Return received — refund sent to payment gateway',
          {
            tone: 'success',
            message: result.data?.replacementItemId
              ? 'Add tracking on the new replacement line when you ship it.'
              : 'The refund will be sent to the original payment method.',
          },
        )
      }
      setNote('')
      setRejectReasonCode(null)
      onIssuesChanged?.()
    } catch (err) {
      toast.show('Could not update request', {
        tone: 'danger',
        message: err instanceof Error ? err.message : 'Please try again.',
      })
    } finally {
      setActingIssueId(null)
      setConfirmingReturn(false)
    }
  }

  const variation = item.variation_details as Record<string, unknown> | null
  const variationLabel =
    variation && typeof variation === 'object' && Object.keys(variation).length > 0
      ? Object.entries(variation)
          .map(([key, value]) => `${key}: ${String(value)}`)
          .join(' · ')
      : null

  return (
    <YStack flex={1} minHeight={0}>
      {/* Header */}
      <XStack
        alignItems="center"
        justifyContent="space-between"
        paddingHorizontal="$5"
        paddingVertical="$4"
        borderBottomWidth={1}
        borderBottomColor={ui.borderSubtle}
        gap="$2"
      >
        <XStack alignItems="center" gap="$2" flex={1} minWidth={0}>
          <Icons.Package size={18} color={ui.brand} />
          <Text fontSize={16} fontWeight="800" color={ui.text} numberOfLines={1}>
            Order #{order?.order_number ?? '—'}
          </Text>
        </XStack>
        <YStack
          width={34}
          height={34}
          borderRadius={999}
          alignItems="center"
          justifyContent="center"
          cursor="pointer"
          hoverStyle={{ backgroundColor: ui.surfaceMuted }}
          pressStyle={{ opacity: 0.7 }}
          onPress={onClose}
        >
          <Icons.X size={20} color={ui.textSecondary} />
        </YStack>
      </XStack>

      <ScrollView
        flex={1}
        minHeight={0}
        showsVerticalScrollIndicator={false}
        style={
          Platform.OS === 'web'
            ? ({ overflowY: 'auto', overscrollBehavior: 'contain', minHeight: 0, flexBasis: 0 } as const)
            : undefined
        }
        contentContainerStyle={{ padding: 20, gap: 16 }}
      >
        {/* Status / total / date tiles */}
        <XStack gap="$2.5" flexWrap="wrap">
          <SummaryTile ui={ui} label="Status">
            <OrderStatusBadge status={item.item_status} size="sm" />
          </SummaryTile>
          <SummaryTile ui={ui} label="Total Amount">
            <Text fontSize={15} fontWeight="800" color={ui.brand}>
              {formatOrderAmount(item.total_price, currency)}
            </Text>
          </SummaryTile>
          <SummaryTile ui={ui} label="Order Date">
            <Text fontSize={13} fontWeight="700" color={ui.text}>
              {formatOrderDate(order?.created_at)}
            </Text>
          </SummaryTile>
        </XStack>

        {/* Customer */}
        <Section ui={ui} label="Customer Details">
          <XStack gap="$3" alignItems="center">
            <Avatar size="$4" name={customer?.full_name ?? 'Customer'} />
            <YStack flex={1} minWidth={0} gap={2}>
              <Text fontSize={14} fontWeight="800" color={ui.text} numberOfLines={1}>
                {customer?.full_name ?? 'Customer'}
              </Text>
              {customer?.email ? (
                <ContactLine ui={ui} icon={Icons.Mail} value={customer.email} />
              ) : null}
              {customerPhoneLabel !== 'Not added' ? (
                <ContactLine ui={ui} icon={Icons.Phone} value={customerPhoneLabel} />
              ) : null}
            </YStack>
          </XStack>
        </Section>

        {/* Delivery */}
        {delivery || lines.length > 0 ? (
          <Section ui={ui} label="Delivery Details">
            <YStack gap="$2.5">
              {deliveryStatusLabel ? (
                <SummaryRow ui={ui} label="Status" value={deliveryStatusLabel} />
              ) : null}
              {delivery?.delivery_mode ? (
                <SummaryRow
                  ui={ui}
                  label="Mode"
                  value={String(delivery.delivery_mode).replace(/_/g, ' ')}
                />
              ) : null}
              {delivery?.estimated_delivery_date ? (
                <SummaryRow
                  ui={ui}
                  label="Estimated"
                  value={formatOrderDate(delivery.estimated_delivery_date)}
                />
              ) : null}
              {carrierLabel ? <SummaryRow ui={ui} label="Carrier" value={carrierLabel} /> : null}
              {trackingCode ? <SummaryRow ui={ui} label="Tracking" value={trackingCode} /> : null}
              {delivery?.delivery_instructions ? (
                <YStack gap={2}>
                  <Text fontSize={12} color={ui.textMuted} fontWeight="700">
                    Instructions
                  </Text>
                  <Text fontSize={12.5} color={ui.textSecondary}>
                    {delivery.delivery_instructions}
                  </Text>
                </YStack>
              ) : null}

              {lines.length > 0 ? (
                <XStack
                  gap="$2"
                  padding="$3"
                  borderRadius={radius.chip}
                  backgroundColor={ui.roseSurface}
                >
                  <Icons.MapPin size={16} color={ui.brand} />
                  <YStack flex={1} minWidth={0} gap={1}>
                    <Text fontSize={11} fontWeight="700" color={ui.textMuted} letterSpacing={0.2}>
                      Ship to
                      {address?.address_label ? ` · ${address.address_label}` : ''}
                    </Text>
                    {lines.map((line, index) => (
                      <Text
                        key={`${line}-${index}`}
                        fontSize={12.5}
                        color={ui.textSecondary}
                        lineHeight={18}
                      >
                        {line}
                      </Text>
                    ))}
                  </YStack>
                </XStack>
              ) : (
                <Text fontSize={12.5} color={ui.textMuted}>
                  Shipping address not available yet.
                </Text>
              )}

              {trackingUrl || labelUrl || invoiceUrl || manifestUrl ? (
                <XStack gap="$2" flexWrap="wrap">
                  {trackingUrl ? (
                    <Button
                      tone="outline"
                      size="$2"
                      borderRadius={999}
                      icon={<Icons.ExternalLink size={13} />}
                      onPress={() => void openDoc(trackingUrl, 'tracking')}
                    >
                      Track shipment
                    </Button>
                  ) : null}
                  {labelUrl ? (
                    <Button
                      tone="outline"
                      size="$2"
                      borderRadius={999}
                      icon={<Icons.FileText size={13} />}
                      onPress={() => void openDoc(labelUrl, 'shipping label')}
                    >
                      Label PDF
                    </Button>
                  ) : null}
                  {invoiceUrl ? (
                    <Button
                      tone="outline"
                      size="$2"
                      borderRadius={999}
                      icon={<Icons.FileText size={13} />}
                      onPress={() => void openDoc(invoiceUrl, 'invoice')}
                    >
                      Carrier invoice
                    </Button>
                  ) : null}
                  {manifestUrl ? (
                    <Button
                      tone="outline"
                      size="$2"
                      borderRadius={999}
                      icon={<Icons.FileText size={13} />}
                      onPress={() => void openDoc(manifestUrl, 'manifest')}
                    >
                      Manifest
                    </Button>
                  ) : null}
                </XStack>
              ) : null}
            </YStack>
          </Section>
        ) : null}

        {/* Ordered item */}
        <Section ui={ui} label="Ordered Item">
          <XStack gap="$3">
            <YStack
              width={64}
              height={64}
              borderRadius={radius.chip}
              overflow="hidden"
              backgroundColor={ui.imagePlaceholder}
              alignItems="center"
              justifyContent="center"
            >
              {item.listing?.main_image_url ? (
                <Image
                  source={{ uri: item.listing.main_image_url }}
                  width={64}
                  height={64}
                  resizeMode="cover"
                />
              ) : (
                <Icons.Image size={22} color={ui.textMuted} />
              )}
            </YStack>
            <YStack flex={1} minWidth={0} gap={3}>
              <Text fontSize={13.5} fontWeight="700" color={ui.text} numberOfLines={2}>
                {item.product_title ?? item.listing?.title ?? 'Product'}
              </Text>
              <XStack gap="$3" flexWrap="wrap">
                {item.product_sku ? (
                  <MetaText ui={ui} label="SKU" value={item.product_sku} />
                ) : null}
                <MetaText ui={ui} label="Qty" value={String(item.quantity ?? 1)} />
                <MetaText ui={ui} label="Unit" value={formatOrderAmount(item.unit_price, currency)} />
              </XStack>
              {variationLabel ? (
                <Text fontSize={11.5} color={ui.textMuted}>
                  {variationLabel}
                </Text>
              ) : null}
            </YStack>
            <Text fontSize={14} fontWeight="800" color={ui.text}>
              {formatOrderAmount(item.total_price, currency)}
            </Text>
          </XStack>
        </Section>

        {coordination?.note || coordination?.tags.length ? (
          <Section ui={ui} label="Internal coordination">
            {coordination.note ? (
              <Text fontSize={12.5} color={ui.textSecondary} lineHeight={18}>
                {coordination.note}
              </Text>
            ) : null}
            {coordination.tags.length ? (
              <XStack gap="$1.5" flexWrap="wrap">
                {coordination.tags.map((tag) => (
                  <XStack
                    key={tag}
                    paddingHorizontal="$2.5"
                    paddingVertical="$1.5"
                    borderRadius={999}
                    borderWidth={1}
                    borderColor={ui.borderSubtle}
                    backgroundColor={ui.surfaceMuted}
                  >
                    <Text fontSize={11} fontWeight="700" color={ui.textSecondary}>
                      {tag.replace(/_/g, ' ')}
                    </Text>
                  </XStack>
                ))}
              </XStack>
            ) : null}
          </Section>
        ) : null}

        {/* Customer requests (cancellation / return / support) */}
        {issues.length > 0 ? (
          <Section ui={ui} label="Customer requests">
            {hasOpenCancellation ? (
              <XStack
                gap="$2"
                padding="$3"
                borderRadius={radius.chip}
                backgroundColor="#fef3c7"
                marginBottom="$2"
                alignItems="flex-start"
              >
                <Icons.AlertTriangle size={16} color="#92600a" />
                <Text fontSize={12.5} color="#92600a" fontWeight="600" flex={1}>
                  Open cancellation request — review before shipping.
                </Text>
              </XStack>
            ) : null}
            {hasOpenReturn ? (
              <XStack
                gap="$2"
                padding="$3"
                borderRadius={radius.chip}
                backgroundColor="#e0f2fe"
                marginBottom="$2"
                alignItems="flex-start"
              >
                <Icons.Package size={16} color="#075985" />
                <Text fontSize={12.5} color="#075985" fontWeight="600" flex={1}>
                  Open return request — accept to authorize the return, then confirm receipt to
                  create a pending refund.
                </Text>
              </XStack>
            ) : null}
            {(openIssues.length > 0 || actionableReturnIssue) ? (
              <YStack gap="$2" marginBottom="$2">
                <Text fontSize={11} fontWeight="700" color={ui.textMuted}>
                  Resolution note (optional)
                </Text>
                <Input
                  value={note}
                  onChangeText={setNote}
                  placeholder="Add a note for the customer…"
                />
                <Text fontSize={11} fontWeight="700" color={ui.textMuted} marginTop="$1">
                  Decline reason (required to reject return/exchange)
                </Text>
                <XStack gap="$1.5" flexWrap="wrap">
                  {(Object.keys(RETURN_REJECT_REASON) as Array<keyof typeof RETURN_REJECT_REASON>).map(
                    (key) => {
                      const value = RETURN_REJECT_REASON[key] as ReturnRejectReason
                      const active = rejectReasonCode === value
                      return (
                        <XStack
                          key={value}
                          paddingHorizontal="$2.5"
                          paddingVertical="$1.5"
                          borderRadius={999}
                          borderWidth={1}
                          borderColor={active ? ui.brand : ui.borderSubtle}
                          backgroundColor={active ? ui.roseSurface : ui.surface}
                          cursor="pointer"
                          onPress={() => setRejectReasonCode(active ? null : value)}
                        >
                          <Text fontSize={11} fontWeight="700" color={active ? ui.brand : ui.textSecondary}>
                            {RETURN_REJECT_REASON_LABELS[value]}
                          </Text>
                        </XStack>
                      )
                    },
                  )}
                </XStack>
              </YStack>
            ) : null}
            <YStack gap="$3">
              {issues.map((issue) => {
                const issueActions = getVendorIssueActions(issue).filter(
                  (action) => action.kind !== 'status',
                )
                return (
                  <YStack
                    key={issue.id}
                    gap={4}
                    padding="$3"
                    borderRadius={radius.chip}
                    backgroundColor={ui.surfaceMuted}
                    borderWidth={1}
                    borderColor={ui.borderSubtle}
                  >
                    <XStack justifyContent="space-between" gap="$2" alignItems="center">
                      <Text fontSize={13} fontWeight="800" color={ui.text} flex={1}>
                        {issueTypeLabel(issue.issue_type)}
                      </Text>
                      <Text fontSize={11} fontWeight="700" color={ui.textMuted}>
                        {issueStatusLabel(issue.status)}
                      </Text>
                    </XStack>
                    <Text fontSize={12} color={ui.textSecondary} numberOfLines={4}>
                      {issue.description}
                    </Text>
                    {issue.resolution_note ? (
                      <Text fontSize={11} color={ui.textMuted}>
                        Note: {issue.resolution_note}
                      </Text>
                    ) : null}
                    <Text fontSize={11} color={ui.textMuted}>
                      {formatOrderDate(issue.created_at, true)}
                      {issue.reported_by_profile?.full_name
                        ? ` · ${issue.reported_by_profile.full_name}`
                        : ''}
                    </Text>
                    {issueActions.length > 0 ? (
                      <YStack gap="$2" marginTop="$2">
                        {issueActions.map((action) => (
                          <VendorActionButton
                            key={action.key}
                            ui={ui}
                            action={action}
                            disabled={actingIssueId === issue.id || confirmingReturn}
                            onPress={() => void handleIssueAction(issue, action)}
                          />
                        ))}
                      </YStack>
                    ) : null}
                  </YStack>
                )
              })}
            </YStack>
          </Section>
        ) : null}

        <Section ui={ui} label="Wallet">
          <YStack gap="$2">
            <SummaryRow
              ui={ui}
              label="Available credit"
              value={
                easyshipCreditBalance != null && Number.isFinite(easyshipCreditBalance)
                  ? `${easyshipCreditCurrency} ${Number(easyshipCreditBalance).toFixed(2)}`
                  : '—'
              }
            />
            <SummaryRow
              ui={ui}
              label="Order freight"
              value={
                quoteLoading
                  ? '…'
                  : freightAmount != null
                    ? formatOrderAmount(freightAmount, currency)
                    : '—'
              }
            />
            {!affordable && canProcessEasyship ? (
              <YStack gap="$2" marginTop="$1">
                <Text fontSize={12} color={ui.danger} lineHeight={18}>
                  Fund your shipping wallet before buying a
                  shipping label.
                </Text>
                <AppLink href={vendorRoutes.wallet}>
                  <Button tone="outline" size="$3">
                    Open wallet
                  </Button>
                </AppLink>
              </YStack>
            ) : null}
          </YStack>
        </Section>

        {/* Payment summary */}
        <Section ui={ui} label="Payment Summary">
          <YStack gap="$2">
            <SummaryRow ui={ui} label="Subtotal" value={formatOrderAmount(order?.subtotal_amount, currency)} />
            {Number(order?.discount_amount) > 0 ? (
              <SummaryRow
                ui={ui}
                label="Discount"
                value={`- ${formatOrderAmount(order?.discount_amount, currency)}`}
                positive
              />
            ) : null}
            <SummaryRow ui={ui} label="Shipping" value={formatOrderAmount(order?.shipping_amount, currency)} />
            <SummaryRow ui={ui} label="Tax" value={formatOrderAmount(order?.tax_amount, currency)} />
            <YStack height={1} backgroundColor={ui.borderSubtle} marginVertical="$1" />
            <XStack alignItems="center" justifyContent="space-between">
              <Text fontSize={15} fontWeight="800" color={ui.text}>
                Total
              </Text>
              <Text fontSize={17} fontWeight="800" color={ui.brand}>
                {formatOrderAmount(order?.total_amount, currency)}
              </Text>
            </XStack>
            {payment ? (
              <XStack alignItems="center" gap="$2" marginTop="$2">
                <Icons.CreditCard size={14} color={ui.textMuted} />
                <Text fontSize={12} color={ui.textSecondary} textTransform="capitalize">
                  {String(payment.payment_mode ?? 'Payment')} · {String(payment.payment_status ?? '')}
                </Text>
              </XStack>
            ) : null}
          </YStack>
        </Section>
      </ScrollView>

      {/* Footer actions */}
      <YStack
        paddingHorizontal="$5"
        paddingVertical="$4"
        gap="$2.5"
        borderTopWidth={1}
        borderTopColor={ui.borderSubtle}
        backgroundColor={ui.surface}
      >
        {canProcessEasyship ? (
          <YStack gap="$2">
            <Button
              tone="primary"
              size="$3"
              borderRadius={999}
              disabled={updating || easyshipSubmitting || !affordable}
              icon={<Icons.Truck size={15} />}
              onPress={() => onProcessEasyship?.(item)}
            >
              {easyshipSubmitting ? 'Creating shipping label…' : 'Create shipping label'}
            </Button>
            {!affordable ? (
              <AppLink href={vendorRoutes.wallet}>
                <Button tone="outline" size="$3" borderRadius={999}>
                  Top up wallet
                </Button>
              </AppLink>
            ) : null}
          </YStack>
        ) : null}
        {actions.length > 0 ? (
          <XStack gap="$2">
            {actions.map((action) => (
              <VendorActionButton
                key={action.key}
                ui={ui}
                action={action}
                disabled={updating}
                flex={1}
                onPress={() => onAdvance(item, action.target)}
              />
            ))}
          </XStack>
        ) : null}
        <XStack gap="$2">
          <Button tone="outline" size="$3" borderRadius={999} flex={1} icon={<Icons.Download size={15} />} onPress={onDownload}>
            Download PDF
          </Button>
          <Button tone="outline" size="$3" borderRadius={999} flex={1} icon={<Icons.MessageSquare size={15} />} onPress={onContact}>
            Contact
          </Button>
        </XStack>
      </YStack>
    </YStack>
  )
}

// ============================================================================
// Small building blocks
// ============================================================================

type IconType = (typeof Icons)[keyof typeof Icons]

function SummaryTile({ ui, label, children }: { ui: AppUiTokens; label: string; children: React.ReactNode }) {
  return (
    <YStack
      flex={1}
      minWidth={120}
      gap="$1.5"
      padding="$3"
      borderRadius={radius.chip}
      borderWidth={1}
      borderColor={ui.borderSubtle}
      backgroundColor={ui.surface}
    >
      <Text fontSize={10} fontWeight="700" color={ui.textMuted} letterSpacing={0.4}>
        {label.toUpperCase()}
      </Text>
      {children}
    </YStack>
  )
}

function Section({ ui, label, children }: { ui: AppUiTokens; label: string; children: React.ReactNode }) {
  return (
    <YStack
      gap="$2.5"
      padding="$4"
      borderRadius={radius.card}
      borderWidth={1}
      borderColor={ui.borderSubtle}
      backgroundColor={ui.surface}
      style={getShadowStyle('sm')}
    >
      <Text fontSize={11} fontWeight="800" color={ui.textMuted} letterSpacing={0.4}>
        {label.toUpperCase()}
      </Text>
      {children}
    </YStack>
  )
}

function ContactLine({ ui, icon, value }: { ui: AppUiTokens; icon: IconType; value: string }) {
  const Icon = icon
  return (
    <XStack alignItems="center" gap="$1.5">
      <Icon size={12} color={ui.textMuted} />
      <Text fontSize={12} color={ui.textSecondary} numberOfLines={1}>
        {value}
      </Text>
    </XStack>
  )
}

function MetaText({ ui, label, value }: { ui: AppUiTokens; label: string; value: string }) {
  return (
    <Text fontSize={11.5} color={ui.textMuted}>
      {label}: <Text fontSize={11.5} fontWeight="700" color={ui.textSecondary}>{value}</Text>
    </Text>
  )
}

function SummaryRow({
  ui,
  label,
  value,
  positive,
}: {
  ui: AppUiTokens
  label: string
  value: string
  positive?: boolean
}) {
  return (
    <XStack alignItems="center" justifyContent="space-between">
      <Text fontSize={13} color={ui.textSecondary}>
        {label}
      </Text>
      <Text fontSize={13} fontWeight="700" color={positive ? ui.success : ui.text}>
        {value}
      </Text>
    </XStack>
  )
}

