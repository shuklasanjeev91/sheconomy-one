import { supabase } from '~/lib/supabase'

import type { MeetingRecordingStatus } from '~/co-work/lib/meeting-recording-status'

export type MeetingRecordingSummary = {
  id: string
  meetingId: string
  hostId?: string | null
  status: MeetingRecordingStatus | string
  recordingSid?: string | null
  storagePath?: string | null
  durationSeconds?: number | null
  fileSizeBytes?: number | null
  errorMessage?: string | null
  hasShareLink?: boolean
  shareCreatedAt?: string | null
  shareRevokedAt?: string | null
  startedAt?: string | null
  endedAt?: string | null
  createdAt?: string | null
  updatedAt?: string | null
  ready?: boolean
}

export type RecordingControlResult = {
  ok: boolean
  recordingId?: string
  recordingSid?: string
  status?: MeetingRecordingStatus | string
  storagePath?: string
  recording?: MeetingRecordingSummary | null
  recordings?: MeetingRecordingSummary[]
  alreadyActive?: boolean
  alreadyStopped?: boolean
  configRequired?: boolean
  warning?: string
  error?: string
}

export type MeetingRecordingShareResult = {
  ok: boolean
  recordingId?: string
  shareUrl?: string
  sharePath?: string
  rotated?: boolean
  revoked?: boolean
  downloadUrl?: string
  playbackUrl?: string
  expiresInSeconds?: number
  status?: string
  durationSeconds?: number | null
  fileSizeBytes?: number | null
  endedAt?: string | null
  createdAt?: string | null
  recordings?: MeetingRecordingSummary[]
  error?: string
}

/**
 * supabase-js wraps non-2xx responses in a FunctionsHttpError whose message is
 * the unhelpful "Edge Function returned a non-2xx status code". The real,
 * user-facing reason (e.g. "Cloud recording is not configured…") is in the
 * response body, so read it from error.context when available.
 */
async function readFunctionErrorMessage(error: unknown, fallback: string): Promise<string> {
  if (error && typeof error === 'object' && 'context' in error) {
    const context = (error as { context?: unknown }).context
    if (typeof Response !== 'undefined' && context instanceof Response) {
      try {
        const body = (await context.clone().json()) as { error?: unknown }
        if (typeof body?.error === 'string' && body.error.trim()) return body.error
      } catch {
        // Body was not JSON — fall through to the generic message.
      }
    }
  }
  if (error instanceof Error && error.message) return error.message
  return fallback
}

const RECORDING_UNAVAILABLE =
  'Cloud recording is not available on this server yet. Please try again later.'
const RECORDING_REQUEST_TIMEOUT_MS = 20_000

/** Unreachable (undeployed/CORS/offline) or missing function — not something the user can fix. */
function isRecordingServiceUnavailable(error: unknown) {
  const name = error && typeof error === 'object' ? (error as { name?: string }).name : undefined
  const status =
    error && typeof error === 'object' && 'context' in error
      ? (error as { context?: { status?: number } }).context?.status
      : undefined
  return (
    name === 'FunctionsFetchError' ||
    name === 'FunctionsRelayError' ||
    status === 404 ||
    (error instanceof Error && /failed to send a request|timed? ?out|abort/i.test(error.message))
  )
}

async function invokeRecordingControl(body: Record<string, unknown>): Promise<RecordingControlResult> {
  const { data, error } = await supabase.functions.invoke('mediasoup-recording', {
    body,
    timeout: RECORDING_REQUEST_TIMEOUT_MS,
  })
  if (error) {
    if (isRecordingServiceUnavailable(error)) return { ok: false, error: RECORDING_UNAVAILABLE }
    return { ok: false, error: await readFunctionErrorMessage(error, 'Recording control failed') }
  }
  return (data ?? { ok: false, error: 'Recording control failed' }) as RecordingControlResult
}

async function invokeRecordingShare(body: Record<string, unknown>): Promise<MeetingRecordingShareResult> {
  const { data, error } = await supabase.functions.invoke('meeting-recording-share', { body })
  if (error) {
    return { ok: false, error: await readFunctionErrorMessage(error, 'Recording share failed') }
  }
  return (data ?? { ok: false, error: 'Recording share failed' }) as MeetingRecordingShareResult
}

export async function startCloudRecording(input: {
  meetingId: string
  roomName: string
}): Promise<RecordingControlResult> {
  return invokeRecordingControl({
    action: 'start',
    meetingId: input.meetingId,
    roomName: input.roomName,
  })
}

export async function stopCloudRecording(input: {
  meetingId: string
  roomName: string
  recordingId?: string
}): Promise<RecordingControlResult> {
  return invokeRecordingControl({
    action: 'stop',
    meetingId: input.meetingId,
    roomName: input.roomName,
    recordingId: input.recordingId,
  })
}

export async function fetchMeetingRecordingStatus(input: {
  meetingId: string
  recordingId?: string
  reconcile?: boolean
}): Promise<RecordingControlResult> {
  return invokeRecordingControl({
    action: input.reconcile ? 'reconcile' : 'status',
    meetingId: input.meetingId,
    recordingId: input.recordingId,
  })
}

export async function listMeetingRecordings(meetingId: string): Promise<MeetingRecordingShareResult> {
  return invokeRecordingShare({ action: 'list', meetingId })
}

export async function createMeetingRecordingShare(recordingId: string): Promise<MeetingRecordingShareResult> {
  return invokeRecordingShare({ action: 'createShare', recordingId })
}

export async function revokeMeetingRecordingShare(recordingId: string): Promise<MeetingRecordingShareResult> {
  return invokeRecordingShare({ action: 'revokeShare', recordingId })
}

export async function downloadMeetingRecordingUrl(recordingId: string): Promise<MeetingRecordingShareResult> {
  return invokeRecordingShare({ action: 'download', recordingId })
}

export async function resolveMeetingRecordingShare(token: string): Promise<MeetingRecordingShareResult> {
  return invokeRecordingShare({ action: 'resolve', token })
}
