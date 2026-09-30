/**
 * Zoom-style content share: a presenter puts a file (photos, PDF, Office
 * document, video) on everyone's stage. The file is uploaded once and every
 * client renders it from the same URL; page, slide and playback position
 * follow the presenter over realtime broadcast.
 */

export type MeetingContentKind = 'image' | 'pdf' | 'office' | 'video' | 'audio' | 'text' | 'file'

export type MeetingContentItem = {
  url: string
  fileName: string
  mimeType: string
  kind: MeetingContentKind
}

export type MeetingContentShare = {
  id: string
  from: string
  presenterName: string
  items: MeetingContentItem[]
  /** Item on stage (photo slideshow). */
  index: number
  /** 1-based PDF page. */
  page: number
  playing: boolean
  /** Video position when this update was sent. */
  positionSec: number
  /** Presenter clock: when the share began (orders competing presenters). */
  startedAt: number
  /** Presenter clock: when this update was sent (orders updates of one share). */
  updatedAt: number
}

/** Presenter re-broadcasts this often; viewers drop the share after `STALE_MS` of silence. */
export const MEETING_CONTENT_HEARTBEAT_MS = 10_000
export const MEETING_CONTENT_STALE_MS = 35_000
/** Viewers seek when their video drifts further than this from the presenter. */
export const MEETING_CONTENT_VIDEO_DRIFT_SEC = 1.5
/** A paused frame should match the presenter's, not just be close. */
export const MEETING_CONTENT_PAUSED_DRIFT_SEC = 0.25
export const MEETING_CONTENT_MAX_ITEMS = 10
export const MEETING_CONTENT_SIGNED_URL_TTL_SEC = 6 * 60 * 60

const MB = 1024 * 1024

export function meetingContentMaxBytes(kind: MeetingContentKind): number {
  if (kind === 'video') return 150 * MB
  if (kind === 'image') return 20 * MB
  return 50 * MB
}

const OFFICE_EXTENSIONS = new Set(['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'pps', 'ppsx', 'odt', 'ods', 'odp', 'rtf'])
const TEXT_EXTENSIONS = new Set(['txt', 'csv', 'md', 'json', 'log', 'xml', 'html', 'htm'])
const IMAGE_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg', 'heic', 'heif'])
const VIDEO_EXTENSIONS = new Set(['mp4', 'm4v', 'mov', 'webm', 'mkv', '3gp'])
const AUDIO_EXTENSIONS = new Set(['mp3', 'm4a', 'aac', 'wav', 'ogg', 'oga', 'flac'])

export function meetingContentExtension(fileName: string | null | undefined): string {
  const name = String(fileName || '').split('?')[0] ?? ''
  const dot = name.lastIndexOf('.')
  return dot >= 0 ? name.slice(dot + 1).toLowerCase() : ''
}

export function detectMeetingContentKind(
  mimeType: string | null | undefined,
  fileName?: string | null,
): MeetingContentKind {
  const mime = String(mimeType || '').toLowerCase()
  const ext = meetingContentExtension(fileName)
  if (mime === 'application/pdf' || ext === 'pdf') return 'pdf'
  if (mime.startsWith('image/') || IMAGE_EXTENSIONS.has(ext)) return 'image'
  if (mime.startsWith('video/') || VIDEO_EXTENSIONS.has(ext)) return 'video'
  if (mime.startsWith('audio/') || AUDIO_EXTENSIONS.has(ext)) return 'audio'
  if (
    OFFICE_EXTENSIONS.has(ext) ||
    mime.includes('officedocument') ||
    mime.includes('msword') ||
    mime.includes('ms-excel') ||
    mime.includes('ms-powerpoint') ||
    mime.includes('opendocument')
  ) {
    return 'office'
  }
  if (mime.startsWith('text/') || TEXT_EXTENSIONS.has(ext)) return 'text'
  return 'file'
}

/** Content type to upload with; pickers often report `application/octet-stream`. */
export function meetingContentMimeType(mimeType: string | null | undefined, fileName?: string | null): string {
  const mime = String(mimeType || '').toLowerCase()
  if (mime && mime !== 'application/octet-stream') return mime
  const ext = meetingContentExtension(fileName)
  const byExt: Record<string, string> = {
    pdf: 'application/pdf',
    doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    xls: 'application/vnd.ms-excel',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ppt: 'application/vnd.ms-powerpoint',
    pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    txt: 'text/plain',
    csv: 'text/csv',
    md: 'text/markdown',
    json: 'application/json',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    gif: 'image/gif',
    webp: 'image/webp',
    mp4: 'video/mp4',
    m4v: 'video/mp4',
    mov: 'video/quicktime',
    webm: 'video/webm',
    mp3: 'audio/mpeg',
    m4a: 'audio/mp4',
    wav: 'audio/wav',
  }
  return byExt[ext] ?? 'application/octet-stream'
}

export type MeetingContentPlatform = 'web' | 'web-mobile' | 'ios' | 'android'

export type MeetingContentViewer =
  | { mode: 'image'; url: string }
  | { mode: 'video'; url: string }
  | { mode: 'audio'; url: string }
  | { mode: 'frame'; url: string }

function googleViewerUrl(url: string): string {
  return `https://docs.google.com/gview?embedded=1&url=${encodeURIComponent(url)}`
}

function officeViewerUrl(url: string): string {
  return `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(url)}`
}

/**
 * How to render an item. Desktop browsers and iOS WebKit render PDFs
 * themselves; Android WebView and mobile browsers need a hosted viewer.
 */
export function meetingContentViewer(
  item: MeetingContentItem,
  platform: MeetingContentPlatform,
  page = 1,
): MeetingContentViewer {
  switch (item.kind) {
    case 'image':
      return { mode: 'image', url: item.url }
    case 'video':
      return { mode: 'video', url: item.url }
    case 'audio':
      return { mode: 'audio', url: item.url }
    case 'pdf':
      if (platform === 'web') return { mode: 'frame', url: `${item.url}#page=${Math.max(1, Math.round(page))}` }
      if (platform === 'ios') return { mode: 'frame', url: item.url }
      return { mode: 'frame', url: googleViewerUrl(item.url) }
    case 'office':
      return { mode: 'frame', url: officeViewerUrl(item.url) }
    case 'text':
      return platform === 'android' ? { mode: 'frame', url: googleViewerUrl(item.url) } : { mode: 'frame', url: item.url }
    default:
      return { mode: 'frame', url: googleViewerUrl(item.url) }
  }
}

/** Where the presenter's video is now, measured from when this client received the update. */
export function meetingContentVideoPosition(
  share: Pick<MeetingContentShare, 'playing' | 'positionSec'>,
  receivedAt: number,
  now = Date.now(),
): number {
  const base = Number.isFinite(share.positionSec) ? Math.max(0, share.positionSec) : 0
  if (!share.playing) return base
  return base + Math.max(0, now - receivedAt) / 1000
}

export function meetingContentNeedsSeek(
  actualSec: number,
  expectedSec: number,
  driftSec = MEETING_CONTENT_VIDEO_DRIFT_SEC,
): boolean {
  if (!Number.isFinite(actualSec) || !Number.isFinite(expectedSec)) return false
  return Math.abs(actualSec - expectedSec) > driftSec
}

export function meetingContentIsStale(
  lastHeardAt: number,
  now = Date.now(),
  staleMs = MEETING_CONTENT_STALE_MS,
): boolean {
  return now - lastHeardAt > staleMs
}

export type MeetingContentState = {
  share: MeetingContentShare | null
  /** Local clock time of the latest update (drives video sync and staleness). */
  receivedAt: number
}

export function emptyMeetingContentState(): MeetingContentState {
  return { share: null, receivedAt: 0 }
}

/**
 * One share at a time, like Zoom: a newer share from anyone replaces the
 * current one, and a stop only ends the share it names.
 */
export function applyMeetingContentEvent(
  state: MeetingContentState,
  event:
    | { type: 'share'; share: MeetingContentShare; receivedAt: number }
    | { type: 'stop'; id: string }
    | { type: 'clear' },
): MeetingContentState {
  if (event.type === 'clear') return emptyMeetingContentState()
  if (event.type === 'stop') {
    return state.share?.id === event.id ? emptyMeetingContentState() : state
  }
  const current = state.share
  if (current) {
    const sameShare = current.id === event.share.id
    if (sameShare && current.updatedAt > event.share.updatedAt) return state
    if (!sameShare && current.startedAt > event.share.startedAt) return state
  }
  return { share: event.share, receivedAt: event.receivedAt }
}

const CONTENT_KINDS = new Set<MeetingContentKind>(['image', 'pdf', 'office', 'video', 'audio', 'text', 'file'])

/**
 * Broadcast payloads are untrusted: only files in this project's storage may
 * be put on everyone's stage, so a participant cannot load an arbitrary page.
 */
export function isMeetingContentShare(value: unknown, storageOrigin: string): value is MeetingContentShare {
  if (!value || typeof value !== 'object') return false
  const share = value as Partial<MeetingContentShare>
  const prefix = `${storageOrigin.replace(/\/+$/, '')}/storage/v1/object/`
  return (
    typeof share.id === 'string' &&
    typeof share.from === 'string' &&
    Array.isArray(share.items) &&
    share.items.length > 0 &&
    share.items.length <= MEETING_CONTENT_MAX_ITEMS &&
    share.items.every(
      (item) =>
        !!item &&
        typeof item.url === 'string' &&
        /^https:\/\//i.test(prefix) &&
        item.url.startsWith(prefix) &&
        typeof item.fileName === 'string' &&
        CONTENT_KINDS.has(item.kind as MeetingContentKind),
    ) &&
    typeof share.startedAt === 'number' &&
    typeof share.updatedAt === 'number'
  )
}

export function createMeetingContentShareId(userId: string, now = Date.now()): string {
  return `${userId}-${now}-${Math.random().toString(36).slice(2, 8)}`
}

export function meetingContentTitle(share: MeetingContentShare): string {
  const item = share.items[Math.min(Math.max(share.index, 0), share.items.length - 1)]
  if (!item) return 'Shared content'
  if (share.items.length > 1) return `${item.fileName} (${share.index + 1} of ${share.items.length})`
  return item.fileName
}

export function meetingContentStoragePath(meetingId: string, userId: string, fileName: string, now = Date.now()): string {
  const ext = meetingContentExtension(fileName)
  const safeBase =
    String(fileName || 'file')
      .replace(/\.[^.]+$/, '')
      .replace(/[^a-zA-Z0-9_-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 48) || 'file'
  const suffix = Math.random().toString(36).slice(2, 8)
  return `meetings/${meetingId}/${userId}/${now}-${suffix}-${safeBase}${ext ? `.${ext}` : ''}`
}

/** Whiteboard strokes to send a late joiner, newest first, within a payload budget. */
export function trimToPayloadBudget<T>(rows: T[], maxBytes = 200_000): T[] {
  const out: T[] = []
  let size = 0
  for (let i = rows.length - 1; i >= 0; i--) {
    const row = rows[i]
    const bytes = JSON.stringify(row).length
    if (size + bytes > maxBytes) break
    size += bytes
    out.unshift(row as T)
  }
  return out
}
