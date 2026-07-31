import { useMemo } from 'react'

import { Icons, Text, TextArea, XStack, YStack } from '~/components/ui'
import { radius } from '~/config/tokens'
import { useVendorCurrency } from '~/hooks/useVendorCurrency'
import { formatOrderAmount, formatOrderDate } from '~/lib/orders/order.utils'
import type { EnrichedOrderIssue } from '~/lib/orders/order-issue.type'
import {
  issueAgeInHours,
  issueTypeLabel,
  isOverdueIssue,
} from '~/lib/orders/order-issue.utils'
import { openExternalUrl, safeHttpUrl } from '~/lib/platform/openUrl'
import type { AppUiTokens } from '~/lib/theme/app-ui'

import { IssuePriorityBadge, IssueStatusBadge } from '~/commerce/components/vendor/IssueStatusBadge'
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
  /** Disables actions while a mutation is in flight. */
  submitting: boolean
  /** Shared note applied to whichever action the vendor picks. */
  note: string
  onNoteChange: (value: string) => void
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

export function VendorOrderIssueDetailDrawer({
  ui,
  open,
  isDesktop,
  issue,
  submitting,
  note,
  onNoteChange,
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
  // A note is only mandatory for the status moves that record it.
  const noteMissing = note.trim().length === 0
  const requiresNote = (action: VendorIssueAction) =>
    action.kind === 'status' && action.requiresNote

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
              {actions.map((action) => (
                <YStack key={action.key} gap={2}>
                  <VendorActionButton
                    ui={ui}
                    action={action}
                    flex={1}
                    disabled={submitting || (requiresNote(action) && noteMissing)}
                    onPress={() => onAction(issue, action)}
                  />
                  <Text fontSize={11} color={ui.textMuted} paddingHorizontal="$2">
                    {requiresNote(action) && noteMissing ? 'Add a note to enable this.' : action.hint}
                  </Text>
                </YStack>
              ))}
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
