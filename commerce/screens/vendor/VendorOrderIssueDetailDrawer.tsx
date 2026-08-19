import { useMemo } from 'react'

import { Button, Icons, Text, TextArea, XStack, YStack } from '~/components/ui'
import { radius } from '~/config/tokens'
import { useVendorCurrency } from '~/hooks/useVendorCurrency'
import {
  getReturnExchangeTimeline,
  isExchangeIssueType,
  isReturnIssueType,
} from '~/commerce/lib/customer-order-lifecycle'
import { formatOrderAmount, formatOrderDate } from '~/lib/orders/order.utils'
import {
  RETURN_REJECT_REASON,
  RETURN_REJECT_REASON_LABELS,
  RETURN_SHIPPING_MODE,
  type ReturnRejectReason,
} from '~/lib/orders/order.constants'
import type { EnrichedOrderIssue } from '~/lib/orders/order-issue.type'
import {
  issueAgeInHours,
  issueTypeLabel,
  isOverdueIssue,
} from '~/lib/orders/order-issue.utils'
import { COURIER_OPTIONS } from '~/lib/orders/tracking.validation'
import { getPublicTrackingUrl } from '~/lib/orders/courier-tracking-urls'
import { openExternalUrl, safeHttpUrl } from '~/lib/platform/openUrl'
import type { AppUiTokens } from '~/lib/theme/app-ui'
import type { VendorInboxCoordination } from '~/commerce/lib/vendor-inbox-notes'

import { IssuePriorityBadge, IssueStatusBadge } from '~/commerce/components/vendor/IssueStatusBadge'
import { OrderIssueCommentsThread } from '~/commerce/components/OrderIssueCommentsThread'
import { VendorActionButton } from '~/commerce/components/vendor/VendorActionButton'
import {
  VendorDrawerRow,
  VendorDrawerSection,
  VendorDrawerShell,
  VendorDrawerTile,
} from '~/commerce/components/vendor/VendorDrawerShell'
import {
  getVendorIssueActions,
  issueAttentionMessage,
  type VendorIssueAction,
} from '~/commerce/components/vendor/vendor-issue-actions'
import { toneStyle } from '~/commerce/components/vendor/StatusPill'

type VendorOrderIssueDetailDrawerProps = {
  ui: AppUiTokens
  open: boolean
  isDesktop: boolean
  issue: EnrichedOrderIssue | null
  coordination?: VendorInboxCoordination | null
  /** Disables actions while a mutation is in flight. */
  submitting: boolean
  /** Shared note applied to whichever action the vendor picks. */
  note: string
  onNoteChange: (value: string) => void
  rejectReasonCode: string | null
  onRejectReasonChange: (value: string | null) => void
  onClose: () => void
  onAction: (issue: EnrichedOrderIssue, action: VendorIssueAction) => void
}

/** Formats an age in hours as "3h" / "2d 4h". */
function formatAge(hours: number): string {
  if (hours < 1) return 'Just now'
  if (hours < 24) return `${hours}h`
  const days = Math.floor(hours / 24)
  const remainder = hours % 24
  return remainder > 0 ? `${days}d ${remainder}h` : `${days}d`
}

function courierLabel(slug: string | null | undefined): string {
  if (!slug) return '—'
  return COURIER_OPTIONS.find((option) => option.value === slug)?.label ?? slug
}

function issueField<T>(issue: EnrichedOrderIssue, key: string): T | null {
  const value = (issue as Record<string, unknown>)[key]
  return (value as T) ?? null
}

export function VendorOrderIssueDetailDrawer({
  ui,
  open,
  isDesktop,
  issue,
  coordination,
  submitting,
  note,
  onNoteChange,
  rejectReasonCode,
  onRejectReasonChange,
  onClose,
  onAction,
}: VendorOrderIssueDetailDrawerProps) {
  const { currency } = useVendorCurrency()
  const actions = useMemo(() => (issue ? getVendorIssueActions(issue) : []), [issue])
  const attention = issue ? issueAttentionMessage(issue) : null
  const evidence = useMemo(
    () =>
      (issue?.evidence_urls ?? [])
        .map((url) => safeHttpUrl(url))
        .filter((url): url is string => url !== null),
    [issue?.evidence_urls],
  )

  const needsRejectReason = useMemo(() => {
    if (!issue) return false
    const hasReject = actions.some((action) => action.kind === 'decision' && action.decision === 'reject')
    if (!hasReject) return false
    return isReturnIssueType(issue.issue_type) || isExchangeIssueType(issue.issue_type)
  }, [actions, issue])

  const timeline = useMemo(() => {
    if (!issue) return []
    if (!isReturnIssueType(issue.issue_type) && !isExchangeIssueType(issue.issue_type)) return []
    return getReturnExchangeTimeline({ issue })
  }, [issue])

  if (!issue) {
    return (
      <VendorDrawerShell
        ui={ui}
        open={open}
        isDesktop={isDesktop}
        icon={Icons.AlertTriangle}
        title="Request"
        loading
        onClose={onClose}
      >
        {null}
      </VendorDrawerShell>
    )
  }

  const order = issue.orders
  const item = issue.order_items
  const reporter = issue.reported_by_profile
  const ageHours = issueAgeInHours(issue.created_at)
  const overdue = isOverdueIssue(issue)
  const noteMissing = note.trim().length === 0
  const requiresNote = (action: VendorIssueAction) =>
    action.kind === 'status' && action.requiresNote
  const rejectReasonMissing = needsRejectReason && !rejectReasonCode

  const returnTrackingNumber = issueField<string>(issue, 'return_tracking_number')
  const returnCourierSlug = issueField<string>(issue, 'return_courier_slug')
  const returnShippedAt = issueField<string>(issue, 'return_shipped_at')
  const returnShippingMode = issueField<string>(issue, 'return_shipping_mode')
  const returnTrackingUrl =
    issueField<string>(issue, 'return_tracking_url') ||
    (returnCourierSlug && returnTrackingNumber
      ? getPublicTrackingUrl(returnCourierSlug, returnTrackingNumber)
      : null)
  const trackUrl = safeHttpUrl(returnTrackingUrl)

  return (
    <VendorDrawerShell
      ui={ui}
      open={open}
      isDesktop={isDesktop}
      icon={Icons.AlertTriangle}
      title={issueTypeLabel(issue.issue_type)}
      subtitle={order?.order_number ? `Order #${order.order_number}` : null}
      onClose={onClose}
      footer={
        actions.length > 0 ? (
          <YStack gap="$2.5">
            {needsRejectReason ? (
              <YStack gap="$1.5">
                <Text fontSize={11} fontWeight="800" color={ui.textMuted} letterSpacing={0.3}>
                  DECLINE REASON
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
                          onPress={() => onRejectReasonChange(active ? null : value)}
                        >
                          <Text fontSize={11.5} fontWeight="700" color={active ? ui.brand : ui.textSecondary}>
                            {RETURN_REJECT_REASON_LABELS[value]}
                          </Text>
                        </XStack>
                      )
                    },
                  )}
                </XStack>
              </YStack>
            ) : null}
            <YStack gap="$1.5">
              <XStack alignItems="center" justifyContent="space-between">
                <Text fontSize={11} fontWeight="800" color={ui.textMuted} letterSpacing={0.3}>
                  NOTE FOR THE CUSTOMER
                </Text>
                <Text fontSize={11} color={ui.textMuted}>
                  {actions.some(requiresNote) ? 'Required' : 'Optional'}
                </Text>
              </XStack>
              <TextArea
                value={note}
                onChangeText={onNoteChange}
                numberOfLines={3}
                placeholder="Explain what you decided and why…"
              />
            </YStack>
            <YStack gap="$2">
              {actions.map((action) => {
                const isReject = action.kind === 'decision' && action.decision === 'reject'
                const disabled =
                  submitting ||
                  (requiresNote(action) && noteMissing) ||
                  (isReject && rejectReasonMissing)
                return (
                  <YStack key={action.key} gap={2}>
                    <VendorActionButton
                      ui={ui}
                      action={action}
                      flex={1}
                      disabled={disabled}
                      onPress={() => onAction(issue, action)}
                    />
                    <Text fontSize={11} color={ui.textMuted} paddingHorizontal="$2">
                      {requiresNote(action) && noteMissing
                        ? 'Add a note to enable this.'
                        : isReject && rejectReasonMissing
                          ? 'Pick a decline reason to enable this.'
                          : action.hint}
                    </Text>
                  </YStack>
                )
              })}
            </YStack>
          </YStack>
        ) : (
          <Text fontSize={12.5} color={ui.textMuted} textAlign="center">
            No further action is needed on this request.
          </Text>
        )
      }
    >
      {attention ? (
        <XStack
          gap="$2"
          padding="$3"
          borderRadius={radius.chip}
          backgroundColor={toneStyle('yellow').bg}
          alignItems="flex-start"
        >
          <Icons.AlertTriangle size={16} color={toneStyle('yellow').fg} />
          <Text fontSize={12.5} fontWeight="600" color={toneStyle('yellow').fg} flex={1}>
            {attention}
          </Text>
        </XStack>
      ) : null}

      <XStack gap="$2.5" flexWrap="wrap">
        <VendorDrawerTile ui={ui} label="Status">
          <IssueStatusBadge status={issue.status} size="sm" />
        </VendorDrawerTile>
        <VendorDrawerTile ui={ui} label="Priority">
          <IssuePriorityBadge priority={issue.issue_priority} size="sm" />
        </VendorDrawerTile>
        <VendorDrawerTile ui={ui} label="Age">
          <Text fontSize={13} fontWeight="800" color={overdue ? ui.danger : ui.text}>
            {formatAge(ageHours)}
          </Text>
        </VendorDrawerTile>
      </XStack>

      {timeline.length > 0 ? (
        <VendorDrawerSection ui={ui} label="Return timeline">
          <YStack gap="$2">
            {timeline.map((step) => (
              <XStack key={step.id} gap="$2.5" alignItems="flex-start">
                <YStack
                  width={18}
                  height={18}
                  borderRadius={999}
                  marginTop={1}
                  alignItems="center"
                  justifyContent="center"
                  backgroundColor={step.done ? ui.brand : step.active ? ui.roseSurface : ui.surfaceMuted}
                  borderWidth={step.active && !step.done ? 1 : 0}
                  borderColor={ui.brand}
                >
                  {step.done ? (
                    <Icons.Check size={11} color={ui.onBrand} />
                  ) : (
                    <YStack
                      width={6}
                      height={6}
                      borderRadius={999}
                      backgroundColor={step.active ? ui.brand : ui.textMuted}
                    />
                  )}
                </YStack>
                <YStack flex={1} minWidth={0} gap={1}>
                  <Text
                    fontSize={13}
                    fontWeight={step.active || step.done ? '700' : '600'}
                    color={step.done || step.active ? ui.text : ui.textMuted}
                  >
                    {step.label}
                  </Text>
                  {step.detail ? (
                    <Text fontSize={11.5} color={ui.textMuted} lineHeight={16}>
                      {step.detail}
                    </Text>
                  ) : null}
                </YStack>
              </XStack>
            ))}
          </YStack>
        </VendorDrawerSection>
      ) : null}

      <VendorDrawerSection ui={ui} label="What the customer said">
        {issue.issue_title ? (
          <Text fontSize={14} fontWeight="800" color={ui.text}>
            {issue.issue_title}
          </Text>
        ) : null}
        <Text fontSize={13} color={ui.textSecondary} lineHeight={19}>
          {issue.description?.trim() || 'No description provided.'}
        </Text>
        <XStack alignItems="center" gap="$1.5" paddingTop="$1">
          <Icons.User size={12} color={ui.textMuted} />
          <Text fontSize={11.5} color={ui.textMuted}>
            {reporter?.full_name || reporter?.email || 'Customer'} ·{' '}
            {formatOrderDate(issue.created_at, true)}
          </Text>
        </XStack>
      </VendorDrawerSection>

      {coordination?.note || coordination?.tags.length ? (
        <VendorDrawerSection ui={ui} label="Internal coordination">
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
                  <Text fontSize={11.5} fontWeight="700" color={ui.textSecondary}>
                    {tag.replace(/_/g, ' ')}
                  </Text>
                </XStack>
              ))}
            </XStack>
          ) : null}
        </VendorDrawerSection>
      ) : null}

      {returnTrackingNumber || returnShippingMode ? (
        <VendorDrawerSection ui={ui} label="Return shipment">
          {returnShippingMode ? (
            <VendorDrawerRow
              ui={ui}
              label="Arranged by"
              value={
                returnShippingMode === RETURN_SHIPPING_MODE.AUTO
                  ? 'Auto-booked pickup'
                  : returnShippingMode === RETURN_SHIPPING_MODE.VENDOR_ARRANGED
                    ? 'Shop (manual pickup)'
                    : returnShippingMode === RETURN_SHIPPING_MODE.BUYER_SELF
                      ? 'Customer self-ship (legacy)'
                      : returnShippingMode
              }
            />
          ) : null}
          {returnTrackingNumber ? (
            <VendorDrawerRow ui={ui} label="AWB" value={returnTrackingNumber} />
          ) : null}
          {returnCourierSlug ? (
            <VendorDrawerRow ui={ui} label="Courier" value={courierLabel(returnCourierSlug)} />
          ) : null}
          {returnShippedAt ? (
            <VendorDrawerRow ui={ui} label="Shipped" value={formatOrderDate(returnShippedAt)} />
          ) : null}
          {trackUrl ? (
            <Button
              tone="outline"
              size="$3"
              borderRadius={999}
              icon={<Icons.ExternalLink size={14} />}
              onPress={() => void openExternalUrl(trackUrl)}
            >
              Track return
            </Button>
          ) : null}
          <Text fontSize={11.5} color={ui.textMuted} lineHeight={16}>
            Who pays return shipping follows your shop return policy (buyer vs seller).
          </Text>
        </VendorDrawerSection>
      ) : null}

      <VendorDrawerSection ui={ui} label="Conversation">
        <OrderIssueCommentsThread
          ui={ui}
          issueId={issue.id}
          resolutionNote={issue.resolution_note}
        />
      </VendorDrawerSection>

      {evidence.length > 0 ? (
        <VendorDrawerSection ui={ui} label="Evidence">
          <YStack gap="$1.5">
            {evidence.map((url, index) => (
              <XStack
                key={url}
                alignItems="center"
                gap="$2"
                padding="$2.5"
                borderRadius={radius.chip}
                backgroundColor={ui.surfaceMuted}
                cursor="pointer"
                hoverStyle={{ backgroundColor: ui.chip }}
                onPress={() => void openExternalUrl(url)}
              >
                <Icons.Paperclip size={14} color={ui.brand} />
                <Text fontSize={12.5} fontWeight="600" color={ui.brand} flex={1} numberOfLines={1}>
                  Attachment {index + 1}
                </Text>
                <Icons.ExternalLink size={13} color={ui.textMuted} />
              </XStack>
            ))}
          </YStack>
        </VendorDrawerSection>
      ) : null}

      <VendorDrawerSection ui={ui} label="Order">
        <VendorDrawerRow ui={ui} label="Order number" value={order?.order_number ?? '—'} />
        <VendorDrawerRow
          ui={ui}
          label="Order total"
          value={formatOrderAmount(order?.total_amount, currency)}
        />
        {item ? (
          <>
            <VendorDrawerRow ui={ui} label="Item" value={item.product_title ?? 'Product'} />
            <VendorDrawerRow ui={ui} label="Quantity" value={String(item.quantity ?? 1)} />
            <VendorDrawerRow
              ui={ui}
              label="Item total"
              value={formatOrderAmount(item.total_price, currency)}
            />
          </>
        ) : (
          <Text fontSize={12} color={ui.textMuted}>
            Raised against the whole order, not a single item.
          </Text>
        )}
      </VendorDrawerSection>

      {issue.resolution_note || issue.resolution_action || issue.resolved_at ? (
        <VendorDrawerSection ui={ui} label="Resolution">
          {issue.resolution_action ? (
            <VendorDrawerRow
              ui={ui}
              label="Action"
              value={issue.resolution_action.replace(/_/g, ' ')}
            />
          ) : null}
          {issueField<string>(issue, 'reject_reason_code') ? (
            <VendorDrawerRow
              ui={ui}
              label="Decline reason"
              value={
                RETURN_REJECT_REASON_LABELS[
                  issueField<string>(issue, 'reject_reason_code') as ReturnRejectReason
                ] ?? String(issueField<string>(issue, 'reject_reason_code'))
              }
            />
          ) : null}
          {issue.resolved_at ? (
            <VendorDrawerRow ui={ui} label="Resolved" value={formatOrderDate(issue.resolved_at, true)} />
          ) : null}
          {issue.closed_at ? (
            <VendorDrawerRow ui={ui} label="Closed" value={formatOrderDate(issue.closed_at, true)} />
          ) : null}
          {issue.resolution_note ? (
            <Text fontSize={12.5} color={ui.textSecondary} lineHeight={18} paddingTop="$1">
              {issue.resolution_note}
            </Text>
          ) : null}
        </VendorDrawerSection>
      ) : null}
    </VendorDrawerShell>
  )
}
