import { INVALIDATION_TOPICS, invalidateCache } from '~/lib/cache/invalidation'
import { supabase } from '~/lib/supabase/client'

export const EVENT_PAGE_SIZE = 20

export type CommunityEvent = {
  id: string
  title: string
  description: string | null
  start_time: string
  end_time: string | null
  location: string | null
  meeting_url: string | null
  is_online: boolean | null
  is_free: boolean | null
  price: number | null
  currency: string | null
  image_url: string | null
  event_type: string | null
  max_attendees: number | null
  organizer_id: string
  status: string | null
  tags: string[] | null
  created_at: string | null
  /** Linked feed post when shared to the community feed. */
  post_id?: string | null
}

export type EventFilters = {
  eventType?: string
  /** 'online' | 'in-person' */
  format?: string
  /** 'free' | 'paid' */
  price?: string
  /** Only include events starting within this many days from now. */
  withinDays?: number
}

export async function fetchUpcomingEvents(
  page = 0,
  filters: EventFilters = {},
): Promise<{ items: CommunityEvent[]; hasMore: boolean; error: string | null }> {
  const from = page * EVENT_PAGE_SIZE
  const to = from + EVENT_PAGE_SIZE - 1
  const now = new Date().toISOString()

  let query = supabase
    .from('events')
    .select('*', { count: 'exact' })
    .gte('start_time', now)
    .neq('status', 'cancelled')
    .order('start_time', { ascending: true })

  if (filters.eventType) query = query.eq('event_type', filters.eventType)
  if (filters.format === 'online') query = query.eq('is_online', true)
  if (filters.format === 'in-person') query = query.eq('is_online', false)
  if (filters.price === 'free') query = query.eq('is_free', true)
  if (filters.price === 'paid') query = query.eq('is_free', false)
  if (filters.withinDays && filters.withinDays > 0) {
    const cutoff = new Date(Date.now() + filters.withinDays * 24 * 60 * 60 * 1000).toISOString()
    query = query.lte('start_time', cutoff)
  }

  const { data, error, count } = await query.range(from, to)

  if (error) return { items: [], hasMore: false, error: error.message }

  const total = count ?? 0
  return {
    items: (data ?? []) as CommunityEvent[],
    hasMore: total ? to + 1 < total : (data?.length ?? 0) === EVENT_PAGE_SIZE,
    error: null,
  }
}

/** Distinct event types for a stable filter menu. */
export async function fetchEventTypeFacets(): Promise<string[]> {
  const types = new Set<string>()

  const { data: facetRows, error } = await supabase.rpc('community_event_types')
  if (!error && facetRows) {
    for (const row of facetRows as { value: string }[]) {
      if (row.value) types.add(row.value)
    }
    return Array.from(types).sort((a, b) => a.localeCompare(b))
  }

  const now = new Date().toISOString()
  const { data } = await supabase
    .from('events')
    .select('event_type')
    .gte('start_time', now)
    .neq('status', 'cancelled')
    .limit(1000)

  for (const row of (data ?? []) as { event_type: string | null }[]) {
    if (row.event_type?.trim()) types.add(row.event_type.trim())
  }
  return Array.from(types).sort((a, b) => a.localeCompare(b))
}

export async function fetchEvent(
  id: string,
): Promise<{ data: CommunityEvent | null; error: string | null }> {
  const { data, error } = await supabase.from('events').select('*').eq('id', id).maybeSingle()
  return { data: (data as CommunityEvent | null) ?? null, error: error?.message ?? null }
}

export async function fetchEventRegistrationState(
  eventId: string,
  userId: string,
): Promise<{ isRegistered: boolean }> {
  const { data } = await supabase
    .from('event_registrations')
    .select('id')
    .eq('event_id', eventId)
    .eq('user_id', userId)
    .neq('status', 'cancelled')
    .maybeSingle()

  return { isRegistered: !!data }
}

export async function fetchEventAttendeeCount(eventId: string): Promise<number> {
  const { count } = await supabase
    .from('event_registrations')
    .select('id', { count: 'exact', head: true })
    .eq('event_id', eventId)
    .neq('status', 'cancelled')
  return count ?? 0
}

export async function registerForEvent(
  eventId: string,
  userId: string,
): Promise<{ error: string | null }> {
  const { error } = await supabase.from('event_registrations').insert({
    event_id: eventId,
    user_id: userId,
    status: 'registered',
    registration_date: new Date().toISOString(),
  })
  if (!error) invalidateCache(INVALIDATION_TOPICS.communityEvents)
  return { error: error?.message ?? null }
}

export async function cancelEventRegistration(
  eventId: string,
  userId: string,
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('event_registrations')
    .update({ status: 'cancelled' })
    .eq('event_id', eventId)
    .eq('user_id', userId)
  if (!error) invalidateCache(INVALIDATION_TOPICS.communityEvents)
  return { error: error?.message ?? null }
}

export async function fetchPostEventRsvpState(
  postId: string,
  userId: string,
): Promise<{ isRsvped: boolean }> {
  const { data } = await supabase
    .from('post_event_rsvps')
    .select('id')
    .eq('post_id', postId)
    .eq('user_id', userId)
    .maybeSingle()

  return { isRsvped: !!data }
}

export async function rsvpToPostEvent(
  postId: string,
  userId: string,
  communityEventId?: string | null,
): Promise<{ error: string | null }> {
  const { error } = await supabase.from('post_event_rsvps').insert({
    post_id: postId,
    user_id: userId,
  })
  if (error) return { error: error.message }

  if (communityEventId) {
    await registerForEvent(communityEventId, userId)
  } else {
    invalidateCache(INVALIDATION_TOPICS.communityEvents)
  }
  return { error: null }
}

export async function cancelPostEventRsvp(
  postId: string,
  userId: string,
  communityEventId?: string | null,
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('post_event_rsvps')
    .delete()
    .eq('post_id', postId)
    .eq('user_id', userId)
  if (error) return { error: error.message }

  if (communityEventId) {
    await cancelEventRegistration(communityEventId, userId)
  } else {
    invalidateCache(INVALIDATION_TOPICS.communityEvents)
  }
  return { error: null }
}

export type CreateEventInput = {
  title: string
  description?: string
  startTime: string
  endTime?: string
  isOnline: boolean
  location?: string
  meetingUrl?: string
  imageUrl?: string
  eventType?: string
  isFree: boolean
  price?: number
  currency?: string
  maxAttendees?: number
  tags?: string[]
  /** Also publish a feed event post (default true for LinkedIn-parity). */
  shareToFeed?: boolean
  visibility?: string
  rsvpEnabled?: boolean
  postId?: string | null
}

export async function createEvent(
  userId: string,
  input: CreateEventInput,
): Promise<{ data: CommunityEvent | null; error: string | null }> {
  const { data, error } = await supabase
    .from('events')
    .insert({
      title: input.title.trim(),
      description: input.description?.trim() ?? null,
      start_time: input.startTime,
      end_time: input.endTime ?? null,
      is_online: input.isOnline,
      location: input.isOnline ? null : input.location?.trim() ?? null,
      meeting_url: input.isOnline ? input.meetingUrl?.trim() ?? null : null,
      image_url: input.imageUrl?.trim() ?? null,
      event_type: input.eventType?.trim() ?? 'meetup',
      is_free: input.isFree,
      price: input.isFree ? null : input.price ?? null,
      currency: input.isFree ? null : input.currency ?? 'INR',
      max_attendees: input.maxAttendees ?? null,
      tags: input.tags?.length ? input.tags : null,
      organizer_id: userId,
      status: 'published',
      registration_required: true,
      post_id: input.postId ?? null,
    })
    .select('*')
    .maybeSingle()

  if (!error && data) {
    invalidateCache(INVALIDATION_TOPICS.communityEvents)
  }

  return { data: (data as CommunityEvent | null) ?? null, error: error?.message ?? null }
}

/**
 * Create a directory event and (optionally) a matching feed post, linked both ways.
 * Used by the composer Event mode and the Events create screen.
 */
export async function createEventAndFeedPost(
  userId: string,
  input: CreateEventInput & { shareToFeed?: boolean },
): Promise<{
  event: CommunityEvent | null
  postId: string | null
  error: string | null
}> {
  const shareToFeed = input.shareToFeed !== false
  const { createCommunityPost } = await import('~/community/lib/community')

  let postId: string | null = null

  if (shareToFeed) {
    const locationLabel = input.isOnline
      ? input.meetingUrl?.trim() || 'Online'
      : input.location?.trim() || null

    const postResult = await createCommunityPost(userId, {
      content: input.description?.trim() || input.title.trim(),
      imageUrl: input.imageUrl ?? null,
      visibility: input.visibility ?? 'public',
      postType: 'event',
      eventTitle: input.title.trim(),
      eventDescription: input.description?.trim() || null,
      eventStartTime: input.startTime,
      eventEndTime: input.endTime ?? null,
      eventLocation: locationLabel,
      eventRsvpEnabled: input.rsvpEnabled !== false,
      eventIsOnline: input.isOnline,
      eventMeetingUrl: input.meetingUrl ?? null,
    })

    if (postResult.error || !postResult.id) {
      return { event: null, postId: null, error: postResult.error ?? 'Could not create feed post.' }
    }
    postId = postResult.id
  }

  const { data: event, error } = await createEvent(userId, {
    ...input,
    postId,
  })

  if (error || !event) {
    return { event: null, postId, error: error ?? 'Could not create event.' }
  }

  if (postId) {
    // Link event id onto the feed post for RSVP dual-write + "View event".
    const { data: existing } = await supabase
      .from('posts')
      .select('post_data')
      .eq('id', postId)
      .maybeSingle()
    const prev =
      existing?.post_data && typeof existing.post_data === 'object' && !Array.isArray(existing.post_data)
        ? (existing.post_data as Record<string, unknown>)
        : {}
    await supabase
      .from('posts')
      .update({
        post_data: {
          ...prev,
          community_event_id: event.id,
        },
      })
      .eq('id', postId)
  }

  return { event, postId, error: null }
}

export type EventAttendee = {
  user_id: string
  username: string | null
  full_name: string
  headline: string | null
  avatar_url: string | null
}

export async function fetchEventAttendees(eventId: string): Promise<EventAttendee[]> {
  const { data } = await supabase
    .from('event_registrations')
    .select('user_id')
    .eq('event_id', eventId)
    .neq('status', 'cancelled')
    .order('registration_date', { ascending: false })
    .limit(50)

  const userIds = (data ?? []).map((row) => row.user_id).filter(Boolean)
  if (!userIds.length) return []

  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, username, full_name, headline, avatar_url')
    .in('id', userIds)

  return (profiles ?? []).map((profile) => ({
    user_id: profile.id,
    username: profile.username,
    full_name: profile.full_name ?? profile.username,
    headline: profile.headline,
    avatar_url: profile.avatar_url,
  }))
}

export async function fetchEventsByOrganizers(
  organizerIds: string[],
): Promise<CommunityEvent[]> {
  if (!organizerIds.length) return []

  const now = new Date().toISOString()
  const { data } = await supabase
    .from('events')
    .select('*')
    .in('organizer_id', organizerIds)
    .gte('start_time', now)
    .neq('status', 'cancelled')
    .order('start_time', { ascending: true })
    .limit(20)

  return (data ?? []) as CommunityEvent[]
}
