/**
 * Order Issue Service
 *
 * Customer issue & dispute management, migrated from the legacy
 * `orderIssueService`. Results use the shared `OrderServiceResponse` envelope
 * with friendly errors; access is resolved through the shared `order.access`
 * helpers (customers manage their own issues, vendors their shop's issues,
 * admins everything).
 *
 * Schema note: the modern `order_issues` table is leaner — `subject` →
 * `issue_title`, `priority` → `issue_priority`, `attachments` →
 * `evidence_urls`. Comment threads live in `order_issue_comments`.
 */

import { supabase } from '~/lib/supabase'

import { fail, isAdminUser, ok, resolveUserId, verifyVendorShopAccess } from '~/lib/orders/order.access'
import { ISSUE_PRIORITY, ISSUE_STATUS, ORDER_DEFAULTS, type IssueStatus } from '~/lib/orders/order.constants'
import { validateOrderIssueData } from '~/lib/orders/order-issue.validation'
import type {
  CreateOrderIssueInput,
  EnrichedOrderIssue,
  OrderIssue,
  OrderIssueAnalytics,
  OrderIssueAnalyticsFilters,
  OrderIssueComment,
  OrderIssueInsert,
  OrderIssueQueryOptions,
  OrderIssueUpdate,
  OrderServiceResponse,
  PaginatedOrderIssues,
  UpdateIssueStatusMetadata,
} from '~/lib/orders/order-issue.type'

const USER_ISSUE_SELECT = `
  *,
  orders ( order_number, total_amount ),
  order_items ( id, product_title, total_price ),
  assigned_to_profile:profiles!assigned_to ( id, full_name, email )
`

const VENDOR_ISSUE_SELECT = `
  *,
  orders ( order_number, total_amount, profiles ( full_name, email ) ),
  order_items!inner ( id, product_title, vendor_id, total_price ),
  reported_by_profile:profiles!reported_by ( id, full_name, email )
`

const ISSUE_DETAIL_SELECT = `
  *,
  orders ( id, order_number, order_status, total_amount, user_id, profiles ( full_name, email ) ),
  order_items ( id, product_title, quantity, total_price, vendor_id, shops ( shop_name, user_id ) ),
  reported_by_profile:profiles!reported_by ( id, full_name, email ),
  assigned_to_profile:profiles!assigned_to ( id, full_name, email ),
  resolved_by_profile:profiles!resolved_by ( id, full_name, email )
`

function paginationMeta(page: number, limit: number, total: number) {
  return { page, limit, total, total_pages: total ? Math.ceil(total / limit) : 0 }
}

// ============= MUTATIONS =============

/** Create a new order issue (reported by the acting user by default). */
export async function createOrderIssue(
  input: CreateOrderIssueInput,
  userId?: string | null,
): Promise<OrderServiceResponse<OrderIssue>> {
  const id = await resolveUserId(userId)
  if (!id) return fail('User not authenticated')

  const reporterId = input.reported_by ?? id
  const validation = validateOrderIssueData({ ...input, reported_by: reporterId })
  if (!validation.isValid) return fail(validation.errors.join(', '))

  try {
    const { data: rateOk } = await supabase.rpc('check_api_rate_limit', {
      p_bucket: `dispute_create:${reporterId}`,
      p_limit: 10,
      p_window_seconds: 600,
    })
    if (rateOk === false) {
      return fail('Too many support requests. Please wait before raising another issue.')
    }

    const payload: OrderIssueInsert = {
      order_id: input.order_id,
      order_item_id: input.order_item_id ?? null,
      issue_type: input.issue_type,
      issue_title: input.subject?.trim() || input.issue_type,
      description: input.description.trim(),
      reported_by: reporterId,
      issue_priority: input.priority ?? ISSUE_PRIORITY.NORMAL,
      status: ISSUE_STATUS.OPEN,
      evidence_urls: input.attachments ?? [],
    }

    const { data, error } = await supabase
      .from('order_issues')
      .insert(payload)
      .select('*')
      .single()

    if (error) return fail(error, 'Failed to create order issue')
    return ok(data as OrderIssue)
  } catch (error) {
    return fail(error, 'An unexpected error occurred while creating order issue')
  }
}

/** Update an issue's status, attaching status-specific fields. */
export async function updateIssueStatus(
  issueId: string,
  status: IssueStatus,
  metadata: UpdateIssueStatusMetadata = {},
  userId?: string | null,
): Promise<OrderServiceResponse<OrderIssue>> {
  const id = await resolveUserId(userId)
  if (!id) return fail('User not authenticated')

  if (!issueId || !status) return fail('Issue ID and status are required')
  if (!(Object.values(ISSUE_STATUS) as string[]).includes(status)) {
    return fail('Invalid issue status')
  }

  try {
    const updates: OrderIssueUpdate = {
      status,
      updated_at: new Date().toISOString(),
    }

    switch (status) {
      case ISSUE_STATUS.ASSIGNED:
      case ISSUE_STATUS.IN_PROGRESS:
        if (metadata.assigned_to) updates.assigned_to = metadata.assigned_to
        break
      case ISSUE_STATUS.RESOLVED:
        updates.resolved_at = new Date().toISOString()
        if (metadata.resolution_note) updates.resolution_note = metadata.resolution_note
        if (metadata.resolution_action) updates.resolution_action = metadata.resolution_action
        break
      case ISSUE_STATUS.CLOSED:
        updates.closed_at = new Date().toISOString()
        if (metadata.closure_reason) updates.resolution_note = metadata.closure_reason
        break
      case ISSUE_STATUS.ESCALATED:
        if (metadata.escalated_to) updates.assigned_to = metadata.escalated_to
        // No comments table yet, so `resolution_note` doubles as the latest
        // handler note — see the deferred comment feature in the doc.
        if (metadata.resolution_note) updates.resolution_note = metadata.resolution_note
        break
      case ISSUE_STATUS.WAITING_CUSTOMER:
        if (metadata.resolution_note) updates.resolution_note = metadata.resolution_note
        break
      default:
        break
    }

    const { data, error } = await supabase
      .from('order_issues')
      .update(updates)
      .eq('id', issueId)
      .select('*')
      .single()

    if (error) return fail(error, 'Failed to update issue status')
    return ok(data as OrderIssue)
  } catch (error) {
    return fail(error, 'An unexpected error occurred while updating issue status')
  }
}

// ============= READS =============

/** Issues reported by a user (defaults to the session user; admins may query others). */
export async function getUserIssues(
  targetUserId?: string | null,
  options: OrderIssueQueryOptions = {},
  userId?: string | null,
): Promise<OrderServiceResponse<PaginatedOrderIssues>> {
  const id = await resolveUserId(userId)
  if (!id) return fail('User not authenticated')

  const reporterId = targetUserId ?? id
  if (reporterId !== id && !(await isAdminUser(id))) {
    return fail('Access denied to these issues')
  }

  try {
    const page = options.page ?? ORDER_DEFAULTS.PAGE
    const limit = options.limit ?? ORDER_DEFAULTS.PAGE_SIZE
    const offset = (page - 1) * limit
    const sortBy = options.sort_by ?? 'created_at'
    const ascending = options.sort_order === 'asc'

    let query = supabase
      .from('order_issues')
      .select(USER_ISSUE_SELECT, { count: 'exact' })
      .eq('reported_by', reporterId)

    if (options.status) query = query.eq('status', options.status)
    if (options.issue_type) query = query.eq('issue_type', options.issue_type)
    if (options.priority) query = query.eq('issue_priority', options.priority)

    const { data, error, count } = await query
      .order(sortBy, { ascending })
      .range(offset, offset + limit - 1)

    if (error) return fail(error, 'Failed to fetch user issues')

    return ok({
      issues: (data as unknown as EnrichedOrderIssue[]) ?? [],
      pagination: paginationMeta(page, limit, count ?? 0),
    })
  } catch (error) {
    return fail(error, 'An unexpected error occurred while fetching user issues')
  }
}

/** Issues raised against a vendor shop's items (owner or admin). */
export async function getVendorIssues(
  vendorId: string,
  options: OrderIssueQueryOptions = {},
  userId?: string | null,
): Promise<OrderServiceResponse<PaginatedOrderIssues>> {
  const id = await resolveUserId(userId)
  if (!id) return fail('User not authenticated')
  if (!vendorId) return fail('Vendor ID is required')

  try {
    const access = await verifyVendorShopAccess(vendorId, id)
    if (!access.success) return fail(access.error)

    const page = options.page ?? ORDER_DEFAULTS.PAGE
    const limit = options.limit ?? ORDER_DEFAULTS.PAGE_SIZE
    const offset = (page - 1) * limit
    const sortBy = options.sort_by ?? 'created_at'
    const ascending = options.sort_order === 'asc'

    let query = supabase
      .from('order_issues')
      .select(VENDOR_ISSUE_SELECT, { count: 'exact' })
      .eq('order_items.vendor_id', vendorId)

    if (options.status) query = query.eq('status', options.status)
    if (options.issue_type) query = query.eq('issue_type', options.issue_type)
    if (options.priority) query = query.eq('issue_priority', options.priority)

    const { data, error, count } = await query
      .order(sortBy, { ascending })
      .range(offset, offset + limit - 1)

    if (error) return fail(error, 'Failed to fetch vendor issues')

    return ok({
      issues: (data as unknown as EnrichedOrderIssue[]) ?? [],
      pagination: paginationMeta(page, limit, count ?? 0),
    })
  } catch (error) {
    return fail(error, 'An unexpected error occurred while fetching vendor issues')
  }
}

/** Issues attached to a single order (buyer or vendor with access via RLS). */
export async function getIssuesByOrder(
  orderId: string,
  userId?: string | null,
): Promise<OrderServiceResponse<EnrichedOrderIssue[]>> {
  const id = await resolveUserId(userId)
  if (!id) return fail('User not authenticated')
  if (!orderId) return fail('Order ID is required')

  try {
    const { data, error } = await supabase
      .from('order_issues')
      .select(ISSUE_DETAIL_SELECT)
      .eq('order_id', orderId)
      .order('created_at', { ascending: false })

    if (error) return fail(error, 'Failed to fetch order issues')
    return ok((data as unknown as EnrichedOrderIssue[]) ?? [])
  } catch (error) {
    return fail(error, 'An unexpected error occurred while fetching order issues')
  }
}

/** Full detail for a single issue. */
export async function getIssueDetails(
  issueId: string,
  userId?: string | null,
): Promise<OrderServiceResponse<EnrichedOrderIssue>> {
  const id = await resolveUserId(userId)
  if (!id) return fail('User not authenticated')
  if (!issueId) return fail('Issue ID is required')

  try {
    const { data, error } = await supabase
      .from('order_issues')
      .select(ISSUE_DETAIL_SELECT)
      .eq('id', issueId)
      .single()

    if (error) return fail(error, 'Failed to fetch issue details')
    return ok(data as unknown as EnrichedOrderIssue)
  } catch (error) {
    return fail(error, 'An unexpected error occurred while fetching issue details')
  }
}

/** All issues across the platform (admin only), filterable + paginated. */
export async function getAllIssuesForAdmin(
  options: OrderIssueQueryOptions = {},
  userId?: string | null,
): Promise<OrderServiceResponse<PaginatedOrderIssues>> {
  const id = await resolveUserId(userId)
  if (!id) return fail('User not authenticated')
  if (!(await isAdminUser(id))) return fail('Access denied for admin operations')

  try {
    const page = options.page ?? ORDER_DEFAULTS.PAGE
    const limit = options.limit ?? ORDER_DEFAULTS.PAGE_SIZE
    const offset = (page - 1) * limit
    const sortBy = options.sort_by ?? 'created_at'
    const ascending = options.sort_order === 'asc'

    let query = supabase.from('order_issues').select(USER_ISSUE_SELECT, { count: 'exact' })

    if (options.status) query = query.eq('status', options.status)
    if (options.issue_type) query = query.eq('issue_type', options.issue_type)
    if (options.priority) query = query.eq('issue_priority', options.priority)

    const { data, error, count } = await query
      .order(sortBy, { ascending })
      .range(offset, offset + limit - 1)

    if (error) return fail(error, 'Failed to fetch issues')

    return ok({
      issues: (data as unknown as EnrichedOrderIssue[]) ?? [],
      pagination: paginationMeta(page, limit, count ?? 0),
    })
  } catch (error) {
    return fail(error, 'An unexpected error occurred while fetching issues')
  }
}

// ============= ANALYTICS =============

/**
 * Issue analytics: totals, per-type/status/priority breakdowns, resolution rate
 * and average resolution time. Scoped to a vendor when `vendor_id` is supplied
 * (owner or admin), otherwise admin-gated (platform-wide).
 */
export async function getIssueAnalytics(
  filters: OrderIssueAnalyticsFilters = {},
  userId?: string | null,
): Promise<OrderServiceResponse<OrderIssueAnalytics>> {
  const id = await resolveUserId(userId)
  if (!id) return fail('User not authenticated')

  try {
    if (filters.vendor_id) {
      const access = await verifyVendorShopAccess(filters.vendor_id, id)
      if (!access.success) return fail(access.error)
    } else if (!(await isAdminUser(id))) {
      return fail('Access denied for admin operations')
    }

    const select = filters.vendor_id
      ? `issue_type, status, issue_priority, created_at, resolved_at, order_items!inner ( vendor_id )`
      : `issue_type, status, issue_priority, created_at, resolved_at`

    let query = supabase.from('order_issues').select(select)

    if (filters.date_from) query = query.gte('created_at', filters.date_from)
    if (filters.date_to) query = query.lte('created_at', filters.date_to)
    if (filters.vendor_id) query = query.eq('order_items.vendor_id', filters.vendor_id)

    const { data, error } = await query
    if (error) return fail(error, 'Failed to fetch issue analytics')

    const rows = (data ?? []) as unknown as {
      issue_type: string | null
      status: string | null
      issue_priority: string | null
      created_at: string
      resolved_at: string | null
    }[]

    const byType: Record<string, number> = {}
    const byStatus: Record<string, number> = {}
    const byPriority: Record<string, number> = {}
    let resolvedCount = 0
    let totalResolutionDays = 0

    for (const issue of rows) {
      if (issue.issue_type) byType[issue.issue_type] = (byType[issue.issue_type] ?? 0) + 1
      if (issue.status) byStatus[issue.status] = (byStatus[issue.status] ?? 0) + 1
      const priority = issue.issue_priority ?? 'unspecified'
      byPriority[priority] = (byPriority[priority] ?? 0) + 1

      if (issue.status === ISSUE_STATUS.RESOLVED && issue.resolved_at) {
        resolvedCount += 1
        const created = new Date(issue.created_at).getTime()
        const resolved = new Date(issue.resolved_at).getTime()
        totalResolutionDays += (resolved - created) / (1000 * 60 * 60 * 24)
      }
    }

    return ok({
      total_issues: rows.length,
      by_type: byType,
      by_status: byStatus,
      by_priority: byPriority,
      resolution_rate: rows.length > 0 ? (resolvedCount / rows.length) * 100 : 0,
      average_resolution_time: resolvedCount > 0 ? totalResolutionDays / resolvedCount : 0,
    })
  } catch (error) {
    return fail(error, 'An unexpected error occurred while calculating issue analytics')
  }
}

// ============= COMMENTS =============

/** Chronological comments for an issue the caller can access. */
export async function getIssueComments(
  issueId: string,
  userId?: string | null,
): Promise<OrderServiceResponse<OrderIssueComment[]>> {
  const id = await resolveUserId(userId)
  if (!id) return fail('User not authenticated')
  if (!issueId) return fail('Issue ID is required')

  try {
    const { data, error } = await (supabase as any)
      .from('order_issue_comments')
      .select(
        `
        id, issue_id, author_id, body, created_at, updated_at,
        author:profiles!author_id ( id, full_name, avatar_url )
      `,
      )
      .eq('issue_id', issueId)
      .order('created_at', { ascending: true })

    if (error) return fail(error, 'Failed to load issue comments')
    return ok((data ?? []) as OrderIssueComment[])
  } catch (error) {
    return fail(error, 'An unexpected error occurred while loading issue comments')
  }
}

/** Post a comment on an issue (RLS enforces participant access). */
export async function addIssueComment(
  issueId: string,
  body: string,
  userId?: string | null,
): Promise<OrderServiceResponse<OrderIssueComment>> {
  const id = await resolveUserId(userId)
  if (!id) return fail('User not authenticated')
  if (!issueId) return fail('Issue ID is required')

  const trimmed = body.trim()
  if (!trimmed) return fail('Comment cannot be empty')

  try {
    const { data, error } = await (supabase as any)
      .from('order_issue_comments')
      .insert({
        issue_id: issueId,
        author_id: id,
        body: trimmed,
      })
      .select(
        `
        id, issue_id, author_id, body, created_at, updated_at,
        author:profiles!author_id ( id, full_name, avatar_url )
      `,
      )
      .single()

    if (error) return fail(error, 'Failed to add comment')
    return ok(data as OrderIssueComment)
  } catch (error) {
    return fail(error, 'An unexpected error occurred while adding a comment')
  }
}
