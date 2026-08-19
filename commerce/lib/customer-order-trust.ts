/**
 * Buyer/vendor trust lifecycle actions: returns, verified reviews,
 * digital downloads, and vendor resolution of cancellation/return requests.
 * All mutations go through SECURITY DEFINER RPCs (identity derived server-side).
 */

import { supabase } from '~/lib/supabase'

export type TrustRpcResult<T> = { data: T | null; error: string | null }

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

function rpcErrorMessage(error: { message?: string } | null | undefined, fallback: string) {
  const message = error?.message?.trim()
  if (!message) return fallback
  // Strip common PostgREST / plpgsql prefixes for friendlier toasts.
  return message
    .replace(/^ERROR:\s*/i, '')
    .replace(/^P0001:\s*/i, '')
    .replace(/\s+$/, '')
}

export type RequestReturnResult = {
  issueId: string
  refundId: string
  status: string
}

export async function requestOrderItemReturn(input: {
  orderItemId: string
  reason: string
  evidenceUrls?: string[]
  detailedReason?: string | null
}): Promise<TrustRpcResult<RequestReturnResult>> {
  const { data, error } = await supabase.rpc('request_order_return' as never, {
    p_order_item_id: input.orderItemId,
    p_reason: input.reason.trim(),
    p_evidence_urls: input.evidenceUrls ?? [],
    p_detailed_reason: input.detailedReason?.trim() || null,
  } as never)

  if (error) return { data: null, error: rpcErrorMessage(error, 'Could not submit return request') }
  const record = asRecord(data)
  if (!record?.issue_id || !record?.refund_id) {
    return { data: null, error: 'Could not submit return request' }
  }
  return {
    data: {
      issueId: String(record.issue_id),
      refundId: String(record.refund_id),
      status: String(record.status ?? 'open'),
    },
    error: null,
  }
}

export type RequestExchangeResult = {
  issueId: string
  status: string
}

export async function requestOrderItemExchange(input: {
  orderItemId: string
  reason: string
  evidenceUrls?: string[]
  detailedReason?: string | null
}): Promise<TrustRpcResult<RequestExchangeResult>> {
  const { data, error } = await supabase.rpc('request_order_exchange' as never, {
    p_order_item_id: input.orderItemId,
    p_reason: input.reason.trim(),
    p_evidence_urls: input.evidenceUrls ?? [],
    p_detailed_reason: input.detailedReason?.trim() || null,
  } as never)

  if (error) return { data: null, error: rpcErrorMessage(error, 'Could not submit exchange request') }
  const record = asRecord(data)
  if (!record?.issue_id) {
    return { data: null, error: 'Could not submit exchange request' }
  }
  return {
    data: {
      issueId: String(record.issue_id),
      status: String(record.status ?? 'open'),
    },
    error: null,
  }
}

export type SubmitReturnTrackingResult = {
  issueId: string
  trackingNumber: string
  refundId: string | null
}

export async function submitReturnTracking(input: {
  orderItemId: string
  trackingNumber: string
  courierSlug?: string | null
}): Promise<TrustRpcResult<SubmitReturnTrackingResult>> {
  const { data, error } = await supabase.rpc('submit_return_tracking' as never, {
    p_order_item_id: input.orderItemId,
    p_tracking_number: input.trackingNumber.trim(),
    p_courier_slug: input.courierSlug?.trim() || null,
  } as never)

  if (error) return { data: null, error: rpcErrorMessage(error, 'Could not save return tracking') }
  const record = asRecord(data)
  if (!record?.issue_id || !record?.tracking_number) {
    return { data: null, error: 'Could not save return tracking' }
  }
  return {
    data: {
      issueId: String(record.issue_id),
      trackingNumber: String(record.tracking_number),
      refundId: record.refund_id ? String(record.refund_id) : null,
    },
    error: null,
  }
}

export type AssignReturnTrackingResult = {
  issueId: string
  trackingNumber: string
  courierSlug: string | null
  trackingUrl: string | null
  refundId: string | null
  returnShippingMode: string
}

export async function assignReturnTracking(input: {
  orderItemId: string
  trackingNumber: string
  courierSlug?: string | null
  customTrackingUrl?: string | null
}): Promise<TrustRpcResult<AssignReturnTrackingResult>> {
  const { data, error } = await supabase.rpc('assign_return_tracking' as never, {
    p_order_item_id: input.orderItemId,
    p_tracking_number: input.trackingNumber.trim(),
    p_courier_slug: input.courierSlug?.trim() || null,
    p_custom_tracking_url: input.customTrackingUrl?.trim() || null,
  } as never)

  if (error) return { data: null, error: rpcErrorMessage(error, 'Could not assign return tracking') }
  const record = asRecord(data)
  if (!record?.issue_id || !record?.tracking_number) {
    return { data: null, error: 'Could not assign return tracking' }
  }
  return {
    data: {
      issueId: String(record.issue_id),
      trackingNumber: String(record.tracking_number),
      courierSlug: record.courier_slug ? String(record.courier_slug) : null,
      trackingUrl: record.tracking_url ? String(record.tracking_url) : null,
      refundId: record.refund_id ? String(record.refund_id) : null,
      returnShippingMode: String(record.return_shipping_mode ?? 'vendor_arranged'),
    },
    error: null,
  }
}

export type CancelReturnRequestResult = {
  issueId: string
  status: string
  resolutionAction: string | null
}

export async function cancelOrderReturnRequest(input: {
  orderItemId: string
  note?: string | null
}): Promise<TrustRpcResult<CancelReturnRequestResult>> {
  const { data, error } = await supabase.rpc('cancel_order_return_request' as never, {
    p_order_item_id: input.orderItemId,
    p_note: input.note?.trim() || null,
  } as never)

  if (error) return { data: null, error: rpcErrorMessage(error, 'Could not cancel request') }
  const record = asRecord(data)
  if (!record?.issue_id) return { data: null, error: 'Could not cancel request' }
  return {
    data: {
      issueId: String(record.issue_id),
      status: String(record.status ?? 'closed'),
      resolutionAction:
        typeof record.resolution_action === 'string' ? record.resolution_action : null,
    },
    error: null,
  }
}

export type ResolveIssueResult = {
  issueId: string
  status: string
  resolutionAction: string | null
  rejectReasonCode: string | null
}

export async function resolveOrderIssueRequest(input: {
  issueId: string
  decision: 'accept' | 'reject'
  resolutionNote?: string | null
  rejectReasonCode?: string | null
}): Promise<TrustRpcResult<ResolveIssueResult>> {
  const { data, error } = await supabase.rpc('resolve_order_issue_request' as never, {
    p_issue_id: input.issueId,
    p_decision: input.decision,
    p_resolution_note: input.resolutionNote?.trim() || null,
    p_reject_reason_code: input.rejectReasonCode?.trim() || null,
  } as never)

  if (error) return { data: null, error: rpcErrorMessage(error, 'Could not update request') }
  const record = asRecord(data)
  if (!record?.issue_id) return { data: null, error: 'Could not update request' }
  return {
    data: {
      issueId: String(record.issue_id),
      status: String(record.status ?? ''),
      resolutionAction:
        typeof record.resolution_action === 'string' ? record.resolution_action : null,
      rejectReasonCode:
        typeof record.reject_reason_code === 'string' ? record.reject_reason_code : null,
    },
    error: null,
  }
}

export type ConfirmReturnResult = {
  refundId: string | null
  refundStatus: string | null
  refundAmount: number | null
  replacementItemId: string | null
  resolutionAction: string | null
}

export async function confirmOrderReturnReceived(input: {
  orderItemId: string
  note?: string | null
}): Promise<TrustRpcResult<ConfirmReturnResult>> {
  const { data, error } = await supabase.rpc('confirm_order_return_received' as never, {
    p_order_item_id: input.orderItemId,
    p_note: input.note?.trim() || null,
  } as never)

  if (error) return { data: null, error: rpcErrorMessage(error, 'Could not confirm return') }
  const record = asRecord(data)
  if (!record) return { data: null, error: 'Could not confirm return' }
  return {
    data: {
      refundId: record.refund_id ? String(record.refund_id) : null,
      refundStatus: record.refund_status ? String(record.refund_status) : null,
      refundAmount: record.refund_amount != null ? Number(record.refund_amount) : null,
      replacementItemId: record.replacement_item_id
        ? String(record.replacement_item_id)
        : null,
      resolutionAction:
        typeof record.resolution_action === 'string' ? record.resolution_action : null,
    },
    error: null,
  }
}

export type SubmitReviewResult = {
  reviewId: string
  rating: number
  isVerifiedPurchase: boolean
}

export async function submitVerifiedListingReview(input: {
  orderItemId: string
  rating: number
  title?: string | null
  reviewText: string
  reviewImages?: string[]
}): Promise<TrustRpcResult<SubmitReviewResult>> {
  const { data, error } = await supabase.rpc('submit_verified_listing_review' as never, {
    p_order_item_id: input.orderItemId,
    p_rating: input.rating,
    p_title: input.title?.trim() || null,
    p_review_text: input.reviewText.trim(),
    p_review_images: input.reviewImages ?? [],
  } as never)

  if (error) return { data: null, error: rpcErrorMessage(error, 'Could not submit review') }
  const record = asRecord(data)
  if (!record?.review_id) return { data: null, error: 'Could not submit review' }
  return {
    data: {
      reviewId: String(record.review_id),
      rating: Number(record.rating ?? input.rating),
      isVerifiedPurchase: Boolean(record.is_verified_purchase ?? true),
    },
    error: null,
  }
}

export type DigitalDownloadResult = {
  url: string
  downloadAttempts: number
  downloadExpiresAt: string | null
  productTitle: string | null
}

export async function fetchOrderDigitalDownload(
  orderItemId: string,
): Promise<TrustRpcResult<DigitalDownloadResult>> {
  const { data, error } = await supabase.rpc('get_order_digital_download' as never, {
    p_order_item_id: orderItemId,
  } as never)

  if (error) return { data: null, error: rpcErrorMessage(error, 'Download unavailable') }
  const record = asRecord(data)
  const url = typeof record?.url === 'string' ? record.url : null
  if (!url) return { data: null, error: 'Download unavailable' }
  return {
    data: {
      url,
      downloadAttempts: Number(record?.download_attempts ?? 0),
      downloadExpiresAt:
        typeof record?.download_expires_at === 'string' ? record.download_expires_at : null,
      productTitle: typeof record?.product_title === 'string' ? record.product_title : null,
    },
    error: null,
  }
}

export type CustomerRefundRow = {
  id: string
  order_item_id: string
  refund_status: string
  refund_amount: number
  refund_reason: string
  detailed_reason: string | null
  return_tracking_number: string | null
  return_shipped_at: string | null
  return_received_at: string | null
  approved_at: string | null
  created_at: string
  updated_at: string
}

export async function fetchRefundsForOrderItems(
  orderItemIds: string[],
): Promise<{ refunds: CustomerRefundRow[]; error: string | null }> {
  const ids = [...new Set(orderItemIds.filter(Boolean))]
  if (!ids.length) return { refunds: [], error: null }

  const { data, error } = await supabase
    .from('refunds')
    .select(
      `
      id,
      order_item_id,
      refund_status,
      refund_amount,
      refund_reason,
      detailed_reason,
      return_tracking_number,
      return_shipped_at,
      return_received_at,
      approved_at,
      created_at,
      updated_at
    `,
    )
    .in('order_item_id', ids)
    .order('created_at', { ascending: false })

  if (error) return { refunds: [], error: error.message }
  return { refunds: (data as CustomerRefundRow[] | null) ?? [], error: null }
}

export type OrderIssueEventRow = {
  id: string
  issue_id: string
  actor_id: string | null
  event_type: string
  note: string | null
  metadata: Record<string, unknown> | null
  created_at: string
}

export async function fetchOrderIssueEvents(
  issueIds: string[],
): Promise<{ events: OrderIssueEventRow[]; error: string | null }> {
  const ids = [...new Set(issueIds.filter(Boolean))]
  if (!ids.length) return { events: [], error: null }

  const { data, error } = await supabase
    .from('order_issue_events' as never)
    .select('id, issue_id, actor_id, event_type, note, metadata, created_at')
    .in('issue_id', ids)
    .order('created_at', { ascending: true })

  if (error) return { events: [], error: error.message }
  return { events: (data as unknown as OrderIssueEventRow[] | null) ?? [], error: null }
}
