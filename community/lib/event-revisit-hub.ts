import type { CommunityPost } from '~/community/lib/community'
import { fetchPostById } from '~/community/lib/community'
import type { CommunityEvent } from '~/community/lib/events'
import { collectPostMedia } from '~/community/lib/post-media'
import { fetchSavedCommunityPosts, type SavedCommunityPostEntry } from '~/community/lib/saved-posts'
import { communityRoutes } from '~/lib/routes'
import { supabase } from '~/lib/supabase/client'

export type EventRevisitSource = 'rsvp' | 'registration' | 'saved'

export type EventRevisitCandidate = {
  source: EventRevisitSource
  postId: string | null
  eventId: string | null
  title: string
  startTime: string | null
  endTime: string | null
  location: string | null
  imageUrl: string | null
  subtitle: string | null
}

export type EventRevisitCard = {
  key: string
  source: EventRevisitSource
  sourceLabel: string
  title: string
  subtitle: string | null
  whenLabel: string | null
  location: string | null
  imageUrl: string | null
  href: string
  isUpcoming: boolean
}

const SOURCE_LABELS: Record<EventRevisitSource, string> = {
  rsvp: "You're going",
  registration: 'Registered',
  saved: 'Saved',
}

const SOURCE_PRIORITY: Record<EventRevisitSource, number> = {
  rsvp: 0,
  registration: 1,
  saved: 2,
}

const REVISIT_GRACE_MS = 24 * 60 * 60 * 1000

function formatEventWhen(value: string) {
  return new Date(value).toLocaleString('en-IN', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function dedupeKey(candidate: EventRevisitCandidate): string {
  if (candidate.eventId) return `event:${candidate.eventId}`
  if (candidate.postId) return `post:${candidate.postId}`
  return `title:${candidate.title.toLowerCase()}`
}

function isEventPost(post: CommunityPost): boolean {
  return post.post_type === 'event' || Boolean(post.event_title?.trim())
}

export function isEventRevisitRelevant(startTime: string | null, now = Date.now()): boolean {
  if (!startTime) return true
  const start = new Date(startTime).getTime()
  if (Number.isNaN(start)) return true
  return start >= now - REVISIT_GRACE_MS
}

export function buildEventRevisitCards(
  candidates: EventRevisitCandidate[],
  limit = 8,
  now = Date.now(),
): EventRevisitCard[] {
  const filtered = candidates.filter((candidate) => isEventRevisitRelevant(candidate.startTime, now))

  const byKey = new Map<string, EventRevisitCandidate>()
  for (const candidate of filtered) {
    const key = dedupeKey(candidate)
    const existing = byKey.get(key)
    if (!existing || SOURCE_PRIORITY[candidate.source] < SOURCE_PRIORITY[existing.source]) {
      byKey.set(key, candidate)
    }
  }

  const merged = Array.from(byKey.values())
  merged.sort((a, b) => {
    const aTime = a.startTime ? new Date(a.startTime).getTime() : Number.MAX_SAFE_INTEGER
    const bTime = b.startTime ? new Date(b.startTime).getTime() : Number.MAX_SAFE_INTEGER
    const aUpcoming = !a.startTime || aTime >= now
    const bUpcoming = !b.startTime || bTime >= now
    if (aUpcoming !== bUpcoming) return aUpcoming ? -1 : 1
    if (aTime !== bTime) return aTime - bTime
    return SOURCE_PRIORITY[a.source] - SOURCE_PRIORITY[b.source]
  })

  return merged.slice(0, limit).map((candidate) => {
    const startMs = candidate.startTime ? new Date(candidate.startTime).getTime() : null
    const isUpcoming = startMs == null || Number.isNaN(startMs) || startMs >= now
    const whenLabel = candidate.startTime ? formatEventWhen(candidate.startTime) : null
    const href = candidate.eventId
      ? communityRoutes.event(candidate.eventId)
      : candidate.postId
        ? communityRoutes.post(candidate.postId)
        : communityRoutes.events

    return {
      key: dedupeKey(candidate),
      source: candidate.source,
      sourceLabel: SOURCE_LABELS[candidate.source],
      title: candidate.title,
      subtitle: candidate.subtitle,
      whenLabel,
      location: candidate.location,
      imageUrl: candidate.imageUrl,
      href,
      isUpcoming,
    }
  })
}

function postToCandidate(post: CommunityPost, source: EventRevisitSource): EventRevisitCandidate {
  return {
    source,
    postId: post.id,
    eventId: post.community_event_id,
    title: post.event_title?.trim() || post.content.replace(/\s+/g, ' ').trim().slice(0, 88) || 'Event',
    startTime: post.event_start_time,
    endTime: post.event_end_time,
    location: post.event_location,
    imageUrl: collectPostMedia(post).find((item) => item.kind === 'image')?.url ?? null,
    subtitle: post.event_location?.trim() || null,
  }
}

function savedEntryToCandidate(entry: SavedCommunityPostEntry): EventRevisitCandidate {
  const post = entry.post
  const candidate = postToCandidate(post, 'saved')
  if (entry.notes?.trim()) {
    candidate.subtitle = entry.notes.trim()
  } else if (entry.collectionName !== 'Saved') {
    candidate.subtitle = entry.collectionName
  }
  return candidate
}

function registrationToCandidate(
  row: { post_id: string | null; events: CommunityEvent | CommunityEvent[] | null },
): EventRevisitCandidate | null {
  const event = Array.isArray(row.events) ? row.events[0] : row.events
  if (!event || event.status === 'cancelled') return null

  return {
    source: 'registration',
    postId: row.post_id ?? event.post_id ?? null,
    eventId: event.id,
    title: event.title,
    startTime: event.start_time,
    endTime: event.end_time,
    location: event.location,
    imageUrl: event.image_url,
    subtitle: event.is_online ? 'Online event' : event.location?.trim() || null,
  }
}

export async function fetchUserEventRevisitCandidates(userId: string): Promise<EventRevisitCandidate[]> {
  const candidates: EventRevisitCandidate[] = []

  const [{ data: rsvps }, { data: registrations }, savedResult] = await Promise.all([
    supabase.from('post_event_rsvps').select('post_id').eq('user_id', userId),
    supabase
      .from('event_registrations')
      .select('post_id, events(*)')
      .eq('user_id', userId)
      .neq('status', 'cancelled'),
    fetchSavedCommunityPosts(userId),
  ])

  const rsvpPostIds = [...new Set((rsvps ?? []).map((row) => row.post_id).filter(Boolean))]
  for (const postId of rsvpPostIds) {
    const result = await fetchPostById(postId)
    if (!result.data || !isEventPost(result.data)) continue
    candidates.push(postToCandidate(result.data, 'rsvp'))
  }

  for (const row of registrations ?? []) {
    const candidate = registrationToCandidate(row as {
      post_id: string | null
      events: CommunityEvent | CommunityEvent[] | null
    })
    if (candidate) candidates.push(candidate)
  }

  for (const entry of savedResult.items) {
    if (!isEventPost(entry.post)) continue
    candidates.push(savedEntryToCandidate(entry))
  }

  return candidates
}

export async function fetchUserEventRevisitCards(
  userId: string,
  limit = 8,
): Promise<{ cards: EventRevisitCard[]; error: string | null }> {
  try {
    const candidates = await fetchUserEventRevisitCandidates(userId)
    return { cards: buildEventRevisitCards(candidates, limit), error: null }
  } catch (error) {
    return {
      cards: [],
      error: error instanceof Error ? error.message : 'Failed to load your events',
    }
  }
}
