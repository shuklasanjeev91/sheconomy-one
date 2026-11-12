import { Platform } from 'react-native'

import type { CommunityPost } from '~/community/lib/community'
import { fetchPostById } from '~/community/lib/community'
import { submitPlatformPayuForm } from '~/lib/platform-payu/platform-payu.utils'
import { supabase } from '~/lib/supabase/client'

export const SPONSORED_MIN_TOTAL_BUDGET = 100
export const SPONSORED_MIN_DAILY_BUDGET = 50
export const SPONSORED_MAX_DURATION_DAYS = 30

export type SponsoredObjective = 'awareness' | 'engagement' | 'traffic'
export type SponsoredCallToAction =
  | 'learn_more'
  | 'shop_now'
  | 'sign_up'
  | 'contact_us'
  | 'visit_profile'
  | 'none'
export type SponsoredCampaignStatus =
  | 'draft'
  | 'pending_payment'
  | 'pending_review'
  | 'active'
  | 'paused'
  | 'completed'
  | 'rejected'
  | 'cancelled'
  | 'refund_requested'
  | 'refunded'

export type SponsoredAudience = {
  country_codes?: string[]
  locations?: string[]
  industries?: string[]
  interests?: string[]
}

export type SponsoredCampaign = {
  id: string
  advertiser_user_id: string
  post_id: string
  company_id: string | null
  name: string
  objective: SponsoredObjective
  status: SponsoredCampaignStatus
  audience: SponsoredAudience
  destination_url: string | null
  call_to_action: SponsoredCallToAction
  currency: 'INR'
  total_budget: number
  daily_budget: number
  spent_amount: number
  impression_count: number
  click_count: number
  frequency_cap_per_day: number
  starts_at: string
  ends_at: string
  paid_at: string | null
  reviewed_at: string | null
  rejection_reason: string | null
  completed_at: string | null
  created_at: string
  updated_at: string
}

export type SponsoredDailyMetric = {
  campaign_id: string
  metric_date: string
  impressions: number
  clicks: number
  spend: number
  unique_viewers: number
}

export type SponsoredCampaignPayment = {
  id: string
  campaign_id: string
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled' | 'refunded'
  amount: number
  currency: 'INR'
  transaction_id: string
  gateway_transaction_id: string | null
  failure_reason: string | null
}

export type SponsoredCampaignInput = {
  postId: string
  name: string
  objective: SponsoredObjective
  audience: SponsoredAudience
  destinationUrl?: string | null
  callToAction: SponsoredCallToAction
  totalBudget: number
  dailyBudget: number
  startsAt: string
  endsAt: string
  frequencyCapPerDay: number
}

export type BoostablePost = {
  id: string
  content: string
  postType: string | null
  createdAt: string | null
}

export type SponsoredFeedItem = {
  campaignId: string
  post: CommunityPost
  objective: SponsoredObjective
  callToAction: SponsoredCallToAction
  destinationUrl: string | null
  matchReason: string
}

type ServiceResult<T> = { data: T | null; error: string | null }

const sponsoredSessionId = `feed-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
const recordedImpressions = new Set<string>()

export function getSponsoredSessionId(): string {
  return sponsoredSessionId
}

export function recordSponsoredImpressionOnce(item: SponsoredFeedItem): void {
  if (recordedImpressions.has(item.campaignId)) return
  recordedImpressions.add(item.campaignId)
  void trackSponsoredEvent({
    campaignId: item.campaignId,
    postId: item.post.id,
    eventType: 'impression',
    eventKey: `${item.campaignId}:${sponsoredSessionId}:impression`,
    sessionId: sponsoredSessionId,
  }).then((recorded) => {
    if (!recorded) recordedImpressions.delete(item.campaignId)
  })
}

function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error) return error.message
  if (typeof error === 'string') return error
  return fallback
}

function clientPlatform(): 'web' | 'ios' | 'android' {
  return Platform.OS === 'web' ? 'web' : Platform.OS === 'ios' ? 'ios' : 'android'
}

async function invoke<T>(
  functionName: string,
  body: Record<string, unknown>,
): Promise<ServiceResult<T>> {
  try {
    const { data, error } = await supabase.functions.invoke<T & { error?: string }>(functionName, {
      body,
    })
    const response = data as (T & { error?: string }) | null
    if (error) return { data: null, error: error.message }
    if (response?.error) return { data: null, error: response.error }
    return { data: response, error: null }
  } catch (error) {
    return { data: null, error: errorMessage(error, 'Request failed.') }
  }
}

export async function fetchSponsoredCampaigns(): Promise<ServiceResult<SponsoredCampaign[]>> {
  const { data, error } = await supabase
    .from('sponsored_campaigns')
    .select('*')
    .order('created_at', { ascending: false })

  return {
    data: error ? null : ((data ?? []) as unknown as SponsoredCampaign[]),
    error: error?.message ?? null,
  }
}

/**
 * Own public posts, the only ones `sponsored-campaigns` accepts for a boost.
 * Drafts, deleted posts, and connection-only posts are rejected server side.
 */
export async function fetchBoostablePosts(
  userId: string,
  limit = 25,
): Promise<ServiceResult<BoostablePost[]>> {
  const { data, error } = await supabase
    .from('posts')
    .select('id, content, post_type, created_at')
    .eq('user_id', userId)
    .eq('is_deleted', false)
    .eq('visibility', 'public')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) return { data: null, error: error.message }

  const rows = (data ?? []) as Array<{
    id: string
    content: string | null
    post_type: string | null
    created_at: string | null
  }>

  return {
    data: rows.map((row) => ({
      id: row.id,
      content: row.content ?? '',
      postType: row.post_type ?? null,
      createdAt: row.created_at,
    })),
    error: null,
  }
}

export async function fetchSponsoredCampaign(
  campaignId: string,
): Promise<ServiceResult<SponsoredCampaign>> {
  const { data, error } = await supabase
    .from('sponsored_campaigns')
    .select('*')
    .eq('id', campaignId)
    .maybeSingle()

  return {
    data: error ? null : (data as unknown as SponsoredCampaign | null),
    error: error?.message ?? null,
  }
}

export async function fetchSponsoredMetrics(
  campaignId: string,
): Promise<ServiceResult<SponsoredDailyMetric[]>> {
  const { data, error } = await supabase
    .from('sponsored_campaign_daily_metrics')
    .select('*')
    .eq('campaign_id', campaignId)
    .order('metric_date', { ascending: true })

  return {
    data: error ? null : ((data ?? []) as unknown as SponsoredDailyMetric[]),
    error: error?.message ?? null,
  }
}

export async function fetchSponsoredPaymentByTxn(
  transactionId: string,
): Promise<ServiceResult<SponsoredCampaignPayment>> {
  const { data, error } = await supabase
    .from('sponsored_campaign_payments')
    .select(
      'id, campaign_id, status, amount, currency, transaction_id, gateway_transaction_id, failure_reason',
    )
    .eq('transaction_id', transactionId)
    .maybeSingle()

  return {
    data: error ? null : (data as unknown as SponsoredCampaignPayment | null),
    error: error?.message ?? null,
  }
}

export async function createSponsoredCampaign(
  input: SponsoredCampaignInput,
): Promise<ServiceResult<{ campaign: SponsoredCampaign }>> {
  return invoke('sponsored-campaigns', {
    action: 'create',
    client_platform: clientPlatform(),
    post_id: input.postId,
    name: input.name,
    objective: input.objective,
    audience: input.audience,
    destination_url: input.destinationUrl ?? null,
    call_to_action: input.callToAction,
    total_budget: input.totalBudget,
    daily_budget: input.dailyBudget,
    starts_at: input.startsAt,
    ends_at: input.endsAt,
    frequency_cap_per_day: input.frequencyCapPerDay,
  })
}

export async function updateSponsoredCampaign(
  campaignId: string,
  input: SponsoredCampaignInput,
): Promise<ServiceResult<{ campaign: SponsoredCampaign }>> {
  return invoke('sponsored-campaigns', {
    action: 'update',
    campaign_id: campaignId,
    client_platform: clientPlatform(),
    post_id: input.postId,
    name: input.name,
    objective: input.objective,
    audience: input.audience,
    destination_url: input.destinationUrl ?? null,
    call_to_action: input.callToAction,
    total_budget: input.totalBudget,
    daily_budget: input.dailyBudget,
    starts_at: input.startsAt,
    ends_at: input.endsAt,
    frequency_cap_per_day: input.frequencyCapPerDay,
  })
}

export async function setSponsoredCampaignStatus(
  campaignId: string,
  action: 'pause' | 'resume' | 'cancel' | 'request_refund',
): Promise<ServiceResult<{ campaign: SponsoredCampaign }>> {
  return invoke('sponsored-campaigns', {
    action,
    campaign_id: campaignId,
    client_platform: clientPlatform(),
  })
}

export async function beginSponsoredPayuCheckout(
  campaignId: string,
): Promise<ServiceResult<{ txnid: string }>> {
  if (Platform.OS !== 'web') {
    return { data: null, error: 'Campaign purchases are available on the SHEconomy website.' }
  }

  const result = await invoke<{
    payuUrl: string
    params: Record<string, string>
    txnid: string
  }>('sponsored-payu-initiate', {
    campaign_id: campaignId,
    client_platform: 'web',
  })

  if (!result.data) return { data: null, error: result.error }
  submitPlatformPayuForm(result.data.payuUrl, result.data.params, '_self')
  return { data: { txnid: result.data.txnid }, error: null }
}

/** Debit shop or user platform wallet for campaign budget (fallback: PayU). */
export async function paySponsoredCampaignWithWallet(
  campaignId: string,
  shopId?: string | null,
): Promise<ServiceResult<{ campaign: SponsoredCampaign }>> {
  return invoke('sponsored-campaigns', {
    action: 'pay_with_wallet',
    campaign_id: campaignId,
    shop_id: shopId ?? null,
    client_platform: clientPlatform(),
  })
}

export async function fetchSponsoredFeedItems(limit = 2): Promise<ServiceResult<SponsoredFeedItem[]>> {
  const result = await invoke<{
    campaigns: Array<{
      campaign_id: string
      post_id: string
      objective: SponsoredObjective
      cta: SponsoredCallToAction
      destination_url: string | null
      match_reason: string
    }>
  }>('sponsored-feed', { limit })

  if (!result.data) return { data: null, error: result.error }
  const hydrated = await Promise.all(
    result.data.campaigns.map(async (item) => {
      const post = await fetchPostById(item.post_id)
      if (!post.data) return null
      return {
        campaignId: item.campaign_id,
        post: post.data,
        objective: item.objective,
        callToAction: item.cta,
        destinationUrl: item.destination_url,
        matchReason: item.match_reason,
      } satisfies SponsoredFeedItem
    }),
  )

  return { data: hydrated.filter((item): item is SponsoredFeedItem => !!item), error: null }
}

export async function trackSponsoredEvent(input: {
  campaignId: string
  postId: string
  eventType: 'impression' | 'click' | 'hide' | 'report'
  eventKey: string
  sessionId?: string | null
  metadata?: Record<string, unknown>
}): Promise<boolean> {
  const result = await invoke('sponsored-event', {
    campaign_id: input.campaignId,
    post_id: input.postId,
    event_type: input.eventType,
    event_key: input.eventKey,
    session_id: input.sessionId ?? null,
    placement: 'community_feed',
    metadata: input.metadata ?? {},
  })
  return !result.error
}

export async function sponsoredAdminAction(
  action: 'list' | 'approve' | 'reject' | 'pause' | 'refund',
  campaignId?: string,
  reason?: string,
): Promise<ServiceResult<{ campaigns?: SponsoredCampaign[]; campaign?: SponsoredCampaign }>> {
  const serverAction = action === 'list' ? 'list_all' : action
  return invoke('sponsored-admin', {
    action: serverAction,
    campaign_id: campaignId,
    reason: action === 'reject' ? reason : undefined,
    note: action === 'refund' ? reason : undefined,
  })
}

export function sponsoredCampaignCtr(campaign: SponsoredCampaign): number {
  if (!campaign.impression_count) return 0
  return (campaign.click_count / campaign.impression_count) * 100
}

export const SPONSORED_STATUS_LABELS: Record<SponsoredCampaignStatus, string> = {
  draft: 'Draft',
  pending_payment: 'Payment pending',
  pending_review: 'In review',
  active: 'Active',
  paused: 'Paused',
  completed: 'Completed',
  rejected: 'Needs changes',
  cancelled: 'Cancelled',
  refund_requested: 'Refund requested',
  refunded: 'Refunded',
}
