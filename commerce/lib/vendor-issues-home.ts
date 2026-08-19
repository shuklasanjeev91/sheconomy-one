import {
  getVendorIssueActions,
  issueAttentionMessage,
  issueNeedsVendorAction,
  vendorIssueBadge,
} from '~/commerce/components/vendor/vendor-issue-actions'
import { getVendorIssues } from '~/lib/orders/order-issue.service'
import type { EnrichedOrderIssue } from '~/lib/orders/order-issue.type'
import {
  getIssuePriorityDisplay,
  isDecisionIssueType,
  isOpenIssueStatus,
  isOverdueIssue,
  issueTypeLabel,
} from '~/lib/orders/order-issue.utils'
import { vendorRoutes } from '~/lib/routes'

export type VendorIssuesHomeCard = {
  id: string
  title: string
  badge: string
  detail: string
  severity: 'critical' | 'high' | 'medium' | 'low'
  href: string
}

function issueCardTitle(issue: EnrichedOrderIssue) {
  const product = issue.order_items?.product_title?.trim()
  if (product) return product
  const subject = issue.issue_title?.trim()
  if (subject) return subject
  return issueTypeLabel(issue.issue_type)
}

function issueCardSeverity(issue: EnrichedOrderIssue, now = Date.now()): VendorIssuesHomeCard['severity'] {
  const decisionPending =
    isDecisionIssueType(issue.issue_type) &&
    isOpenIssueStatus(issue.status) &&
    issue.resolution_action !== 'accepted'
  if (decisionPending && isOverdueIssue(issue, now)) return 'critical'
  if (decisionPending) return 'high'
  if (isOverdueIssue(issue, now)) return 'high'
  const priority = getIssuePriorityDisplay(issue.issue_priority)
  if (priority.weight >= 4) return 'medium'
  return 'low'
}

function issueUrgencyRank(issue: EnrichedOrderIssue, now = Date.now()) {
  const decisionPending =
    isDecisionIssueType(issue.issue_type) &&
    isOpenIssueStatus(issue.status) &&
    issue.resolution_action !== 'accepted'
  let score = 0
  if (decisionPending) score += 1000
  if (isOverdueIssue(issue, now)) score += 500
  score += getIssuePriorityDisplay(issue.issue_priority).weight * 10
  return score
}

export function buildVendorIssuesHomeCards(
  issues: EnrichedOrderIssue[],
  limit = 5,
  now = Date.now(),
): VendorIssuesHomeCard[] {
  return issues
    .filter((issue) => issueNeedsVendorAction(issue) && getVendorIssueActions(issue).length > 0)
    .sort((a, b) => issueUrgencyRank(b, now) - issueUrgencyRank(a, now))
    .slice(0, limit)
    .map((issue) => ({
      id: issue.id,
      title: issueCardTitle(issue),
      badge: vendorIssueBadge(issue) ?? issueTypeLabel(issue.issue_type),
      detail: issueAttentionMessage(issue) ?? `${issueTypeLabel(issue.issue_type)} needs your response.`,
      severity: issueCardSeverity(issue, now),
      href: vendorRoutes.ordersSection('issues'),
    }))
}

export async function fetchVendorIssuesHomeCards(
  shopId: string,
  limit = 5,
): Promise<{ cards: VendorIssuesHomeCard[]; error: string | null }> {
  const result = await getVendorIssues(shopId, {
    page: 1,
    limit: 80,
    sort_by: 'created_at',
    sort_order: 'desc',
  })

  if (result.error) return { cards: [], error: result.error }

  return {
    cards: buildVendorIssuesHomeCards(result.data?.issues ?? [], limit),
    error: null,
  }
}

export function vendorIssuesHomeHref() {
  return vendorRoutes.ordersSection('issues')
}
