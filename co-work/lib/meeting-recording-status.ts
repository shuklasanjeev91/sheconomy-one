export type MeetingRecordingStatus =
  | 'starting'
  | 'recording'
  | 'processing'
  | 'ready'
  | 'failed'

export const ACTIVE_RECORDING_STATUSES: MeetingRecordingStatus[] = ['starting', 'recording']
export const TERMINAL_RECORDING_STATUSES: MeetingRecordingStatus[] = ['ready', 'failed']

export function isActiveRecordingStatus(status: string | null | undefined): boolean {
  return ACTIVE_RECORDING_STATUSES.includes(status as MeetingRecordingStatus)
}

export function isTerminalRecordingStatus(status: string | null | undefined): boolean {
  return TERMINAL_RECORDING_STATUSES.includes(status as MeetingRecordingStatus)
}

export async function hashShareToken(token: string): Promise<string> {
  const data = new TextEncoder().encode(token)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

export function createShareToken(bytes = 24): string {
  const buffer = new Uint8Array(bytes)
  crypto.getRandomValues(buffer)
  return Array.from(buffer)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

export function buildRecordingSharePath(token: string): string {
  return `/co-work/recording/${encodeURIComponent(token)}`
}

export function recordingStatusLabel(status: MeetingRecordingStatus | string): string {
  switch (status) {
    case 'starting':
      return 'Starting'
    case 'recording':
      return 'Recording'
    case 'processing':
      return 'Processing'
    case 'ready':
      return 'Ready'
    case 'failed':
      return 'Failed'
    default:
      return status
  }
}
