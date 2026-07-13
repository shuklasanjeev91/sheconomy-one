/**
 * Types for the order issues / disputes domain.
 *
 * Rows come from the generated Supabase types. The modern `order_issues` table
 * is leaner than the legacy one: `subject`→`issue_title`, `priority`→
 * `issue_priority`, `attachments`→`evidence_urls`; there is no
 * `contact_information` or `admin_notes`/comments storage (see the service +
 * doc for the deferred comment feature).
 */

import type { Tables, TablesInsert, TablesUpdate } from '~/lib/supabase'

import type { IssuePriority, IssueStatus, OrderIssueType } from './order.constants'
import type { OrderServiceResponse } from './vendor-orders.type'

export type { OrderServiceResponse }

// ============= BASE ROWS =============

export type OrderIssue = Tables<'order_issues'>
export type OrderIssueInsert = TablesInsert<'order_issues'>
export type OrderIssueUpdate = TablesUpdate<'order_issues'>

// ============= JOINED / ENRICHED =============

export type IssueProfileSummary = {
  id: string
  full_name?: string | null
  email?: string | null
}

export type IssueOrderSummary = {
  id?: string
  order_number?: string | null
  order_status?: string | null
  total_amount?: number | null
  user_id?: string | null
  profiles?: { full_name?: string | null; email?: string | null } | null
}

export type IssueOrderItemSummary = {
  id: string
  product_title?: string | null
  quantity?: number | null
  total_price?: number | null
  vendor_id?: string | null
  shops?: { shop_name?: string | null; user_id?: string | null } | null
}

/** An issue row enriched with the joins the service selects. */
export type EnrichedOrderIssue = OrderIssue & {
  orders?: IssueOrderSummary | null
  order_items?: IssueOrderItemSummary | null
  reported_by_profile?: IssueProfileSummary | null
  assigned_to_profile?: IssueProfileSummary | null
  resolved_by_profile?: IssueProfileSummary | null
}

// ============= INPUTS =============

export type CreateOrderIssueInput = {
  order_id: string
  order_item_id?: string | null
  issue_type: OrderIssueType | string
  /** Maps to `issue_title`. */
  subject?: string | null
  description: string
  reported_by?: string | null
  priority?: IssuePriority | string
  /** Maps to `evidence_urls`. */
  attachments?: string[]
}

export type UpdateIssueStatusMetadata = {
  assigned_to?: string | null
  resolution_note?: string | null
  resolution_action?: string | null
  closure_reason?: string | null
  escalated_to?: string | null
  [key: string]: unknown
}

// ============= FILTERS / PAGINATION =============

export type OrderIssueFilters = {
  status?: IssueStatus | string | null
  issue_type?: OrderIssueType | string | null
  priority?: IssuePriority | string | null
}

export type OrderIssueQueryOptions = OrderIssueFilters & {
  page?: number
  limit?: number
  sort_by?: 'created_at' | 'updated_at' | 'issue_priority' | 'status'
  sort_order?: 'asc' | 'desc'
}

export type PaginationMeta = {
  page: number
  limit: number
  total: number
  total_pages: number
}

export type PaginatedOrderIssues = {
  issues: EnrichedOrderIssue[]
  pagination: PaginationMeta
}

// ============= ANALYTICS =============

export type OrderIssueAnalyticsFilters = {
  date_from?: string
  date_to?: string
  vendor_id?: string
}

export type OrderIssueAnalytics = {
  total_issues: number
  by_type: Record<string, number>
  by_status: Record<string, number>
  by_priority: Record<string, number>
  /** Percentage (0–100) of issues that reached `resolved`. */
  resolution_rate: number
  /** Average time-to-resolution in days. */
  average_resolution_time: number
}

/** Client-side counts over the loaded issues. */
export type OrderIssueStats = {
  total: number
  open: number
  in_progress: number
  resolved: number
  closed: number
  high_priority: number
}
