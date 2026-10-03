/**
 * Who is actually in the room right now. `meeting_participants` rows stay
 * `admitted` when a tab is closed or an app is killed without "Leave", so the
 * database alone over-counts. Realtime presence (keyed by user id) and the
 * media server's peer list are the live signals; a row counts only while one
 * of them sees that user.
 */
import type { MeetingParticipant } from '~/co-work/lib/types'

export type MeetingRosterSignals = {
  localUserId: string
  /**
   * User ids in realtime presence, from the last sync that included this
   * client. `null` until then — the database is trusted as-is.
   */
  onlineUserIds: readonly string[] | null
  /** Remote users connected to the media server. */
  mediaUserIds?: readonly string[]
}

export type MeetingRosterPlaceholder = {
  identity: string
  name: string
  avatarUrl: string | null
}

function participantName(row: MeetingParticipant): string {
  return row.display_name?.trim() || row.profile?.full_name?.trim() || row.profile?.username?.trim() || 'Guest'
}

export function isMeetingParticipantLive(row: MeetingParticipant, signals: MeetingRosterSignals): boolean {
  if (row.status !== 'admitted') return true
  if (row.user_id === signals.localUserId) return true
  if (signals.onlineUserIds === null) return true
  return signals.onlineUserIds.includes(row.user_id) || !!signals.mediaUserIds?.includes(row.user_id)
}

/**
 * Participant rows with offline `admitted` rows dropped (waiting / left rows
 * pass through untouched) and one admitted row per user.
 */
export function meetingLiveParticipants(
  participants: readonly MeetingParticipant[],
  signals: MeetingRosterSignals,
): MeetingParticipant[] {
  const seenAdmitted = new Set<string>()
  return participants.filter((row) => {
    if (!isMeetingParticipantLive(row, signals)) return false
    if (row.status !== 'admitted') return true
    if (seenAdmitted.has(row.user_id)) return false
    seenAdmitted.add(row.user_id)
    return true
  })
}

export function meetingLiveAdmittedCount(participants: readonly MeetingParticipant[]): number {
  return participants.filter((row) => row.status === 'admitted').length
}

/**
 * Remote admitted participants seen in realtime presence, for "Connecting…"
 * stage tiles. Empty until presence has synced — before that the database
 * could resurrect ghosts.
 */
export function meetingOnlineRemoteParticipants(
  participants: readonly MeetingParticipant[],
  signals: Pick<MeetingRosterSignals, 'localUserId' | 'onlineUserIds'>,
): MeetingRosterPlaceholder[] {
  const online = signals.onlineUserIds
  if (!online) return []
  const out: MeetingRosterPlaceholder[] = []
  const seen = new Set<string>()
  for (const row of participants) {
    if (row.status !== 'admitted' || row.user_id === signals.localUserId) continue
    if (!online.includes(row.user_id) || seen.has(row.user_id)) continue
    seen.add(row.user_id)
    out.push({ identity: row.user_id, name: participantName(row), avatarUrl: row.profile?.avatar_url ?? null })
  }
  return out
}

/** Same members in any order — avoids re-rendering on presence syncs that change nothing. */
export function sameUserIdSet(a: readonly string[] | null, b: readonly string[] | null): boolean {
  if (a === b) return true
  if (!a || !b || a.length !== b.length) return false
  const set = new Set(a)
  return b.every((id) => set.has(id))
}
