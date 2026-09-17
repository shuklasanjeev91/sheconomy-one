import { supabase } from '~/lib/supabase/client'
import { meetingFeatureFlags } from '~/co-work/lib/meeting-feature-flags'
import { openExternalUrl } from '~/lib/platform/openUrl'

export type CalendarProvider = 'google' | 'microsoft'

export type CalendarConnection = {
  id: string
  provider: CalendarProvider
  provider_email: string | null
  status: 'active' | 'expired' | 'revoked' | 'error'
  last_error: string | null
  updated_at: string | null
}

export type CalendarSyncResult = {
  provider: CalendarProvider
  ok: boolean
  externalUrl?: string | null
  error?: string
}

const CONNECTION_SELECT =
  'id, provider, provider_email, status, last_error, updated_at'

export async function fetchCalendarConnections(): Promise<CalendarConnection[]> {
  const { data, error } = await supabase
    .from('calendar_connections')
    .select(CONNECTION_SELECT)
    .order('provider', { ascending: true })

  if (error) throw new Error(error.message)
  return (data ?? []).map((row) => ({
    id: row.id as string,
    provider: row.provider as CalendarProvider,
    provider_email: (row.provider_email as string | null) ?? null,
    status: row.status as CalendarConnection['status'],
    last_error: (row.last_error as string | null) ?? null,
    updated_at: (row.updated_at as string | null) ?? null,
  }))
}

export async function startCalendarOAuth(
  provider: CalendarProvider,
  redirectTo = '/co-work/meetings',
): Promise<{ authorizationUrl: string }> {
  const { data, error } = await supabase.functions.invoke('calendar-oauth-start', {
    body: { provider, redirectTo },
  })
  if (error) throw new Error(error.message || `Could not connect ${provider}`)
  const payload = data as { authorizationUrl?: string; error?: string; configured?: boolean }
  if (payload.error || !payload.authorizationUrl) {
    throw new Error(payload.error || `${provider} calendar is not configured`)
  }
  return { authorizationUrl: payload.authorizationUrl }
}

export async function connectCalendarProvider(
  provider: CalendarProvider,
  redirectTo = '/co-work/meetings',
): Promise<void> {
  const { authorizationUrl } = await startCalendarOAuth(provider, redirectTo)
  const opened = await openExternalUrl(authorizationUrl)
  if (!opened) throw new Error('Could not open the calendar authorization page')
}

export async function revokeCalendarConnection(provider: CalendarProvider): Promise<void> {
  const { data, error } = await supabase.functions.invoke('calendar-oauth-revoke', {
    body: { provider },
  })
  if (error) throw new Error(error.message || `Could not disconnect ${provider}`)
  const payload = data as { error?: string }
  if (payload?.error) throw new Error(payload.error)
}

export async function upsertMeetingCalendarEvent(
  provider: CalendarProvider,
  meetingId: string,
): Promise<CalendarSyncResult> {
  const { data, error } = await supabase.functions.invoke('calendar-event-upsert', {
    body: { provider, meetingId },
  })
  if (error) {
    return { provider, ok: false, error: error.message || 'Calendar sync failed' }
  }
  const payload = data as {
    ok?: boolean
    error?: string
    event?: { external_url?: string | null }
  }
  if (!payload.ok || payload.error) {
    return { provider, ok: false, error: payload.error || 'Calendar sync failed' }
  }
  return {
    provider,
    ok: true,
    externalUrl: payload.event?.external_url ?? null,
  }
}

/**
 * Push a scheduled meeting to every active Google/Microsoft connection.
 * Returns empty results when calendar sync is disabled or nothing is connected.
 */
export async function syncMeetingToConnectedCalendars(
  meetingId: string,
): Promise<CalendarSyncResult[]> {
  if (!meetingFeatureFlags.calendarSync) return []

  let connections: CalendarConnection[] = []
  try {
    connections = await fetchCalendarConnections()
  } catch {
    return []
  }

  const active = connections.filter((row) => row.status === 'active')
  if (active.length === 0) return []

  const results: CalendarSyncResult[] = []
  for (const connection of active) {
    results.push(await upsertMeetingCalendarEvent(connection.provider, meetingId))
  }
  return results
}

export function calendarProviderLabel(provider: CalendarProvider): string {
  return provider === 'google' ? 'Google Calendar' : 'Outlook Calendar'
}
