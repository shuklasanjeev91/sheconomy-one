import AsyncStorage from '@react-native-async-storage/async-storage'

import { createMeeting, fetchMeetingByCode } from '~/co-work/lib/meetings'
import type { CreateMeetingInput, Meeting } from '~/co-work/lib/types'

const pmiCodeKey = (userId: string) => `sheconomy.pmi.code.${userId}`

/** Display-friendly PMI-style code derived from the user id (fallback when none stored). */
export function formatPersonalMeetingDisplayCode(userId: string): string {
  const cleanId = String(userId || '').replace(/[^a-zA-Z0-9]/g, '')
  if (cleanId.length >= 9) {
    return `${cleanId.slice(0, 3)} ${cleanId.slice(3, 6)} ${cleanId.slice(6, 10)}`.toUpperCase()
  }
  return '849 203 1184'
}

export async function loadStoredPmiMeetingCode(userId: string): Promise<string | null> {
  if (!userId) return null
  try {
    return (await AsyncStorage.getItem(pmiCodeKey(userId))) || null
  } catch {
    return null
  }
}

export async function saveStoredPmiMeetingCode(userId: string, meetingCode: string): Promise<void> {
  if (!userId || !meetingCode) return
  await AsyncStorage.setItem(pmiCodeKey(userId), meetingCode.replace(/\s/g, '').toUpperCase())
}

/**
 * Start (or reopen) the host's personal meeting room.
 * Reuses the last PMI meeting code when still owned by this host; otherwise creates one.
 */
export async function startOrReusePersonalMeeting(
  hostId: string,
  input: Omit<CreateMeetingInput, 'startNow'> & { startNow?: boolean },
): Promise<Meeting> {
  const stored = await loadStoredPmiMeetingCode(hostId)
  if (stored) {
    try {
      const existing = await fetchMeetingByCode(stored)
      if (existing && existing.host_id === hostId && existing.status !== 'cancelled') {
        return existing
      }
    } catch {
      // fall through to create
    }
  }

  const meeting = await createMeeting(hostId, {
    ...input,
    startNow: input.startNow !== false,
    title: input.title || 'Personal Meeting Room',
    meetingOptions: {
      ...(input.meetingOptions ?? {}),
      // Marker for host PMI room (UI / analytics).
      layout: input.meetingOptions?.layout ?? 'grid',
    },
  })
  if (meeting.meeting_code) {
    await saveStoredPmiMeetingCode(hostId, meeting.meeting_code)
  }
  return meeting
}

/**
 * Schedule onto the host PMI (reuse stored room, or create one and bind the code).
 */
export async function scheduleOnPersonalMeeting(
  hostId: string,
  input: Omit<CreateMeetingInput, 'startNow'> & {
    scheduledAt: string
    scheduledEndAt: string
    timeZone: string
  },
): Promise<Meeting> {
  const stored = await loadStoredPmiMeetingCode(hostId)
  if (stored) {
    try {
      const existing = await fetchMeetingByCode(stored)
      if (existing && existing.host_id === hostId && existing.status !== 'cancelled') {
        const { updateMeetingSchedule } = await import('~/co-work/lib/meetings')
        return updateMeetingSchedule(existing.id, {
          title: input.title || existing.title || 'Personal Meeting Room',
          description: input.description,
          scheduledAt: input.scheduledAt,
          scheduledEndAt: input.scheduledEndAt,
          timeZone: input.timeZone,
          maxParticipants: input.maxParticipants,
          isRecurring: input.isRecurring,
          repeat: input.repeat ?? null,
          securitySettings: input.securitySettings,
          meetingOptions: input.meetingOptions,
          invitees: input.invitees,
          convertToScheduled: existing.status === 'instant' || existing.status === 'ended',
        })
      }
    } catch {
      // fall through to create
    }
  }

  const meeting = await createMeeting(hostId, {
    ...input,
    startNow: false,
    title: input.title || 'Personal Meeting Room',
  })
  if (meeting.meeting_code) {
    await saveStoredPmiMeetingCode(hostId, meeting.meeting_code)
  }
  return meeting
}
