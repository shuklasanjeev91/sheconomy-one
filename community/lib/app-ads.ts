import { supabase } from '~/lib/supabase/client'

export const APP_AD_PLACEMENTS = [
  'community_feed',
  'commerce_home',
  'commerce_search',
  'commerce_browse',
  'listing_detail',
  'shop_discovery',
] as const

export type AppAdPlacement = (typeof APP_AD_PLACEMENTS)[number]
export type AppAdEntityType = 'post' | 'listing' | 'shop' | 'profile' | 'event' | string
export type AppAdEventType = 'impression' | 'click'
export type AppAdTouchType = 'cart' | 'checkout'

export type AppAdContext = {
  query?: string
  keywords?: string[]
  category_id?: string
  listing_id?: string
  shop_id?: string
}

export type AppAdCreative = {
  id: string
  format: string
  headline: string | null
  body: string | null
  media_url: string | null
  thumbnail_url: string | null
  destination_url: string | null
  call_to_action: string | null
  disclosure: 'Sponsored'
}

export type AppAd = {
  campaign_id: string
  ad_set_id: string
  creative_id: string
  placement: AppAdPlacement
  promoted_entity: {
    type: AppAdEntityType
    id: string
    payload: {
      title?: string
      name?: string
      slug?: string
      description?: string
      image_url?: string
      thumbnail_url?: string
      price?: number
      sale_price?: number
      currency?: string
      shop_id?: string
    }
  }
  creative: AppAdCreative
  reason_label:
    | 'Sponsored recommendation'
    | 'Relevant to this content'
    | 'Relevant to your interests'
    | 'Popular in this placement'
    | 'Exploration selection'
}

export type AppAdConsent = {
  personalized_ads: boolean
  updated_at: string | null
}

export type AppAdsResult<T> = {
  data: T | null
  error: string | null
}

type AdReference = Pick<AppAd, 'campaign_id' | 'ad_set_id' | 'creative_id' | 'placement'> & {
  promoted_entity_type?: string
  promoted_entity_id?: string
}

function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error) return error.message
  return typeof error === 'string' ? error : fallback
}

async function invoke<T>(
  functionName: 'sponsored-auction' | 'sponsored-conversion',
  body: Record<string, unknown>,
): Promise<AppAdsResult<T>> {
  try {
    const { data, error } = await supabase.functions.invoke<T & { error?: string }>(functionName, {
      body,
    })
    const response = data as (T & { error?: string }) | null
    if (error) return { data: null, error: error.message }
    if (response?.error) return { data: null, error: response.error }
    return { data: response, error: null }
  } catch (error) {
    return { data: null, error: errorMessage(error, 'Sponsored ads request failed.') }
  }
}

export async function fetchAppAds(input: {
  placement: AppAdPlacement
  limit?: number
  context?: AppAdContext
}): Promise<AppAdsResult<{ ads: AppAd[]; personalized: boolean }>> {
  return invoke('sponsored-auction', {
    action: 'fetch',
    placement: input.placement,
    limit: input.limit ?? 1,
    context: input.context ?? {},
  })
}

export async function trackAppAd(input: {
  ad: AdReference
  eventType: AppAdEventType
  eventKey: string
  sessionId?: string | null
  metadata?: Record<string, unknown>
}): Promise<AppAdsResult<{ ok: true; duplicate: boolean }>> {
  return invoke('sponsored-auction', {
    action: 'track',
    campaign_id: input.ad.campaign_id,
    ad_set_id: input.ad.ad_set_id,
    creative_id: input.ad.creative_id,
    placement: input.ad.placement,
    promoted_entity_type: input.ad.promoted_entity_type,
    promoted_entity_id: input.ad.promoted_entity_id,
    event_type: input.eventType,
    touch_key: input.eventKey,
    session_id: input.sessionId ?? null,
    metadata: input.metadata ?? {},
  })
}

export async function recordAppAdTouch(input: {
  ad: AdReference
  touchType: AppAdTouchType
  touchKey: string
  sessionId?: string | null
  metadata?: Record<string, unknown>
}): Promise<AppAdsResult<{ ok: true; duplicate: boolean }>> {
  return invoke('sponsored-conversion', {
    action: 'touch',
    campaign_id: input.ad.campaign_id,
    ad_set_id: input.ad.ad_set_id,
    creative_id: input.ad.creative_id,
    placement: input.ad.placement,
    promoted_entity_type: input.ad.promoted_entity_type,
    promoted_entity_id: input.ad.promoted_entity_id,
    touch_type: input.touchType,
    touch_key: input.touchKey,
    session_id: input.sessionId ?? null,
    metadata: input.metadata ?? {},
  })
}

export async function recordAppAdPurchase(input: {
  orderId: string
  conversionKey: string
  touchKey: string
  metadata?: Record<string, unknown>
}): Promise<AppAdsResult<{ ok: true; duplicate: boolean }>> {
  return invoke('sponsored-conversion', {
    action: 'conversion',
    conversion_type: 'purchase',
    order_id: input.orderId,
    conversion_key: input.conversionKey,
    touch_key: input.touchKey,
    metadata: input.metadata ?? {},
  })
}

export async function fetchAppAdConsent(): Promise<AppAdsResult<AppAdConsent>> {
  const result = await invoke<{ preference: AppAdConsent }>('sponsored-auction', {
    action: 'get_consent',
  })
  return {
    data: result.data?.preference ?? null,
    error: result.error,
  }
}

export async function setAppAdConsent(
  personalizedAds: boolean,
): Promise<AppAdsResult<AppAdConsent>> {
  const result = await invoke<{ preference: AppAdConsent }>('sponsored-auction', {
    action: 'consent',
    personalized_ads: personalizedAds,
  })
  return {
    data: result.data?.preference ?? null,
    error: result.error,
  }
}
