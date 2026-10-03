/**
 * Files posted in meeting chat. The upload lives in the `chat-files` bucket
 * under `meetings/<meeting>/<sender>/`; the chat row stores only the path in
 * `metadata.attachment`, and every client signs its own short-lived URL.
 */
import {
  detectMeetingContentKind,
  meetingContentMimeType,
  type MeetingContentKind,
} from '~/co-work/lib/meeting-content-share'
import type { MeetingChatAttachment, MeetingChatMessage } from '~/co-work/lib/types'

export const MEETING_CHAT_ATTACHMENT_BUCKET = 'chat-files'
export const MEETING_CHAT_MAX_PHOTOS = 10

export type MeetingChatAttachmentPick = 'photo' | 'video' | 'file'

type StoredAttachment = Omit<MeetingChatAttachment, 'url'>

const KINDS = new Set<MeetingContentKind>(['image', 'pdf', 'office', 'video', 'audio', 'text', 'file'])

export function meetingChatAttachmentPrefix(meetingId: string, senderId: string): string {
  return `meetings/${meetingId}/${senderId}/`
}

/** Only accept files the sender uploaded into this meeting's own folder. */
function parseStoredAttachment(value: unknown, meetingId: string, senderId: string): StoredAttachment | null {
  if (!value || typeof value !== 'object') return null
  const row = value as Record<string, unknown>
  const path = typeof row.path === 'string' ? row.path : ''
  if (!path.startsWith(meetingChatAttachmentPrefix(meetingId, senderId)) || path.includes('..')) return null
  const fileName =
    typeof row.fileName === 'string' && row.fileName.trim() ? row.fileName.trim() : path.split('/').pop() || 'file'
  const mimeType = meetingContentMimeType(typeof row.mimeType === 'string' ? row.mimeType : null, fileName)
  const kind = KINDS.has(row.kind as MeetingContentKind)
    ? (row.kind as MeetingContentKind)
    : detectMeetingContentKind(mimeType, fileName)
  const size = typeof row.size === 'number' && Number.isFinite(row.size) && row.size > 0 ? row.size : null
  return { path, fileName, mimeType, kind, size }
}

/** `metadata` column value for a new chat row. */
export function meetingChatAttachmentMetadata(attachment: StoredAttachment): { attachment: StoredAttachment } {
  const { path, fileName, mimeType, kind, size } = attachment
  return { attachment: { path, fileName, mimeType, kind, size } }
}

export function parseMeetingChatAttachmentMetadata(
  metadata: unknown,
  meetingId: string,
  senderId: string,
): StoredAttachment | null {
  if (!metadata || typeof metadata !== 'object') return null
  return parseStoredAttachment((metadata as { attachment?: unknown }).attachment, meetingId, senderId)
}

/** Signed URL that `createSignedUrl` returns for `path` in this project. */
export function isSignedMeetingChatAttachmentUrl(url: unknown, path: string, storageOrigin: string): url is string {
  if (typeof url !== 'string' || !/^https:\/\//i.test(storageOrigin)) return false
  const base = encodeURI(
    `${storageOrigin.replace(/\/+$/, '')}/storage/v1/object/sign/${MEETING_CHAT_ATTACHMENT_BUCKET}/${path}`,
  )
  return url.startsWith(`${base}?`)
}

/**
 * Realtime chat payloads are untrusted: keep the attachment only when it points
 * into the sender's folder for this meeting, and drop a URL that is not this
 * project's signed URL for that exact file.
 */
export function sanitizeRemoteMeetingChatMessage(
  message: MeetingChatMessage,
  storageOrigin: string,
): MeetingChatMessage {
  if (!message.attachment) return message
  const stored = parseStoredAttachment(message.attachment, message.meeting_id, message.sender_id)
  if (!stored) return { ...message, attachment: null }
  const url = isSignedMeetingChatAttachmentUrl(message.attachment.url, stored.path, storageOrigin)
    ? message.attachment.url
    : null
  return { ...message, attachment: { ...stored, url } }
}

/** Hide the auto-filled caption when it only repeats the file name. */
export function meetingChatAttachmentCaption(message: MeetingChatMessage): string | null {
  const text = message.message_text?.trim() ?? ''
  if (!message.attachment) return text || null
  return text && text !== message.attachment.fileName ? text : null
}

export function formatMeetingChatAttachmentSize(bytes: number | null | undefined): string | null {
  if (typeof bytes !== 'number' || !Number.isFinite(bytes) || bytes <= 0) return null
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  const mb = bytes / (1024 * 1024)
  return `${mb < 10 ? mb.toFixed(1) : Math.round(mb)} MB`
}

export function meetingChatAttachmentKindLabel(kind: MeetingContentKind): string {
  switch (kind) {
    case 'image':
      return 'Photo'
    case 'video':
      return 'Video'
    case 'audio':
      return 'Audio'
    case 'pdf':
      return 'PDF'
    case 'office':
      return 'Document'
    case 'text':
      return 'Text file'
    default:
      return 'File'
  }
}
