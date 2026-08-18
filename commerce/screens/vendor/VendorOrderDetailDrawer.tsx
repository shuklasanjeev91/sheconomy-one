import { useMemo, useState } from 'react'
import { Platform } from 'react-native'

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
import { getShadowStyle, radius } from '~/config/tokens'
import { useLockBodyScroll } from '~/hooks/useLockBodyScroll'
import { useVendorCurrency } from '~/hooks/useVendorCurrency'
import { overlayBackdropStyle } from '~/lib/layout/styles'
import { shareOrderInvoice } from '~/lib/orders/order-invoice'
import { formatCustomerContactPhone } from '~/features/auth/services/account-contact'
import type { EnrichedOrderIssue } from '~/lib/orders/order-issue.type'
import { openMailtoLink } from '~/lib/platform/openMailto'
import { openExternalUrl, safeHttpUrl } from '~/lib/platform/openUrl'
import { DELIVERY_STATUS_DISPLAY } from '~/lib/orders/order.constants'
import { formatOrderAmount, formatOrderDate } from '~/lib/orders/order.utils'
import type { OrderPayment } from '~/lib/orders/payment.type'
import type { OrderAddressSummary, VendorOrderItem } from '~/lib/orders/vendor-orders.type'
import {
  resolveVendorOrderDelivery,
  resolveVendorShippingAddress,
} from '~/lib/orders/vendor-orders.utils'
import type { AppUiTokens } from '~/lib/theme/app-ui'
import {
  issueStatusLabel,
  issueTypeLabel,
  isCancellationIssueType,
  isOpenIssueStatus,
  isReturnIssueType,
} from '~/commerce/lib/customer-order-lifecycle'
import {
  confirmOrderReturnReceived,
  resolveOrderIssueRequest,
} from '~/commerce/lib/customer-order-trust'

import { OrderStatusBadge } from '~/commerce/components/vendor/OrderStatusBadge'
import { VendorActionButton } from '~/commerce/components/vendor/VendorActionButton'
import { getVendorOrderActions, type VendorOrderAction } from '~/commerce/components/vendor/vendor-order-actions'

const PANEL_WIDTH = 460

type VendorOrderDetailDrawerProps = {
  ui: AppUiTokens
  open: boolean
  isDesktop: boolean
  item: VendorOrderItem | null
  loading: boolean
  updating: boolean
  payments: OrderPayment[]
  issues?: EnrichedOrderIssue[]
  role: string | null
  onClose: () => void
  onAdvance: (item: VendorOrderItem, target: VendorOrderAction['target']) => void
  /** Refresh issues / item after seller resolves a request. */
  onIssuesChanged?: () => void
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
  payments,
  issues = [],
  role,
  onClose,
  onAdvance,
  onIssuesChanged,
}: VendorOrderDetailDrawerProps) {
  const toast = useAppToast()

  // Lock background scroll while open (web); no-op on native.
  useLockBodyScroll(open)

  if (!open) return null

  // Rendered as two fixed-position siblings (backdrop + panel) with a very high
  // z-index — mirroring the proven overlay pattern used by the vendor layout and
  // ListingFiltersShell. No Portal: portaling here detaches the subtree from the
  // app's renderer/context (the "multiple renderers" warning) and swallows all
  // pointer events, so the drawer becomes visible but un-clickable.
  const panelPositionStyle =
    Platform.OS === 'web'
      ? ({ position: 'fixed' as const, top: 0, right: 0, bottom: 0, boxShadow: '-4px 0 24px rgba(0,0,0,0.18)' } as const)
      : ({ position: 'absolute' as const, top: 0, right: 0, bottom: 0 } as const)

  return (
    <>
      <YStack
        backgroundColor="rgba(0,0,0,0.5)"
        zIndex={100000}
        cursor="pointer"
        style={overlayBackdropStyle()}
        animation="quick"
        enterStyle={{ opacity: 0 }}
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
        animation="quick"
        enterStyle={{ x: PANEL_WIDTH }}
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
            payments={payments}
            issues={issues}
            role={role}
            onClose={onClose}
            onAdvance={onAdvance}
            onIssuesChanged={onIssuesChanged}
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
    </>
  )
}

type DrawerBodyProps = {
  ui: AppUiTokens
  item: VendorOrderItem
  updating: boolean
  payments: OrderPayment[]
  issues: EnrichedOrderIssue[]
  role: string | null
  onClose: () => void
  onAdvance: (item: VendorOrderItem, target: VendorOrderAction['target']) => void
  onIssuesChanged?: () => void
  onContact: () => void
  onDownload: () => void
}

function DrawerBody({
  ui,
  item,
  updating,
  payments,
  issues,
  role,
  onClose,
  onAdvance,
  onIssuesChanged,
  onContact,
  onDownload,
}: DrawerBodyProps) {
  const toast = useAppToast()
  const [note, setNote] = useState('')
  const [resolvingId, setResolvingId] = useState<string | null>(null)
  const [confirmingReturn, setConfirmingReturn] = useState(false)
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
  const hasOpenReturn = openIssues.some((issue) => isReturnIssueType(issue.issue_type))
  const acceptedReturn = useMemo(
    () =>
      issues.find(
        (issue) =>
          isReturnIssueType(issue.issue_type) &&
          (issue.status === 'resolved' || issue.resolution_action === 'accepted') &&
          issue.resolution_action !== 'return_received',
      ) ?? null,
    [issues],
  )

  async function handleResolve(issue: EnrichedOrderIssue, decision: 'accept' | 'reject') {
    setResolvingId(issue.id)
    const result = await resolveOrderIssueRequest({
      issueId: issue.id,
      decision,
      resolutionNote: note,
    })
    setResolvingId(null)
    if (result.error) {
      toast.show('Could not update request', { tone: 'danger', message: result.error })
      return
    }
    toast.show(decision === 'accept' ? 'Request accepted' : 'Request declined', {
      tone: 'success',
    })
    setNote('')
    onIssuesChanged?.()
  }

  async function handleConfirmReturn() {
    setConfirmingReturn(true)
    const result = await confirmOrderReturnReceived({
      orderItemId: item.id,
      note,
    })
    setConfirmingReturn(false)
    if (result.error) {
      toast.show('Could not confirm return', { tone: 'danger', message: result.error })
      return
    }
    toast.show(
      result.data?.replacementItemId
        ? 'Exchange received — replacement ready to ship'
        : 'Return received — refund sent to payment gateway',
      {
        tone: 'success',
        message: result.data?.replacementItemId
          ? 'Add tracking on the new replacement line when you ship it.'
          : 'PayU will process the refund to the original payment method.',
      },
    )
    setNote('')
    onIssuesChanged?.()
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
            {(openIssues.length > 0 || acceptedReturn) ? (
              <YStack gap="$2" marginBottom="$2">
                <Text fontSize={11} fontWeight="700" color={ui.textMuted}>
                  Resolution note (optional)
                </Text>
                <Input
                  value={note}
                  onChangeText={setNote}
                  placeholder="Add a note for the customer…"
                />
              </YStack>
            ) : null}
            <YStack gap="$3">
              {issues.map((issue) => {
                const open =
                  isOpenIssueStatus(issue.status) &&
                  (isCancellationIssueType(issue.issue_type) || isReturnIssueType(issue.issue_type))
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
                    {open ? (
                      <XStack gap="$2" marginTop="$2" flexWrap="wrap">
                        <Button
                          tone="primary"
                          size="$3"
                          borderRadius={999}
                          disabled={resolvingId === issue.id}
                          onPress={() => void handleResolve(issue, 'accept')}
                        >
                          {resolvingId === issue.id ? 'Updating…' : 'Accept'}
                        </Button>
                        <Button
                          tone="outline"
                          size="$3"
                          borderRadius={999}
                          disabled={resolvingId === issue.id}
                          onPress={() => void handleResolve(issue, 'reject')}
                        >
                          Decline
                        </Button>
                      </XStack>
                    ) : null}
                  </YStack>
                )
              })}
            </YStack>
            {acceptedReturn && isReturnIssueType(acceptedReturn.issue_type) ? (
              <Button
                tone="primary"
                size="$3"
                borderRadius={999}
                marginTop="$2"
                disabled={confirmingReturn}
                icon={<Icons.CheckCircle2 size={15} />}
                onPress={() => void handleConfirmReturn()}
              >
                {confirmingReturn ? 'Confirming…' : 'Confirm return received · pending refund'}
              </Button>
            ) : null}
          </Section>
        ) : null}

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

