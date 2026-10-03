import { Platform } from 'react-native'

import {
  MEETING_CONTENT_SIGNED_URL_TTL_SEC,
  detectMeetingContentKind,
  meetingContentMaxBytes,
  meetingContentMimeType,
  meetingContentStoragePath,
  type MeetingContentItem,
} from '~/co-work/lib/meeting-content-share'
import { supabase } from '~/lib/supabase'
import { supabaseConfig } from '~/lib/supabase/env'

/** Any signed-in user (guests included) may upload here; signed URLs are readable by everyone in the call. */
export const MEETING_CONTENT_BUCKET = 'chat-files'

export type MeetingContentSource = {
  uri: string
  fileName?: string | null
  mimeType?: string | null
  fileSize?: number | null
  /** Web pickers hand back the File itself. */
  file?: Blob
}

function fileNameFromUri(uri: string): string {
  const last = decodeURIComponent(uri.split('?')[0]?.split('/').pop() || '')
  return last || 'file'
}

function tooLargeMessage(maxBytes: number): string {
  return `Files up to ${Math.round(maxBytes / (1024 * 1024))} MB can be shared.`
}

async function uploadFromWeb(
  path: string,
  source: MeetingContentSource,
  mimeType: string,
  maxBytes: number,
): Promise<number> {
  const body = source.file ?? (await (await fetch(source.uri)).blob())
  if (body.size <= 0) throw new Error('The selected file is empty.')
  if (body.size > maxBytes) throw new Error(tooLargeMessage(maxBytes))
  const { error } = await supabase.storage
    .from(MEETING_CONTENT_BUCKET)
    .upload(path, body, { contentType: mimeType, upsert: false })
  if (error) throw new Error(error.message || 'Upload failed.')
  return body.size
}

/** Streams the file from disk — reading a large video into JS memory crashes phones. */
async function uploadFromDevice(
  path: string,
  source: MeetingContentSource,
  mimeType: string,
  maxBytes: number,
): Promise<number> {
  const FileSystem = await import('expo-file-system/legacy')
  const info = await FileSystem.getInfoAsync(source.uri)
  const size = info.exists && 'size' in info && typeof info.size === 'number' ? info.size : source.fileSize ?? 0
  if (info.exists && size <= 0) throw new Error('The selected file is empty.')
  if (size > maxBytes) throw new Error(tooLargeMessage(maxBytes))

  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (!token) throw new Error('Sign in to share files in the meeting.')

  const encodedPath = path.split('/').map(encodeURIComponent).join('/')
  const result = await FileSystem.uploadAsync(
    `${supabaseConfig.url}/storage/v1/object/${MEETING_CONTENT_BUCKET}/${encodedPath}`,
    source.uri,
    {
      httpMethod: 'POST',
      uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: supabaseConfig.anonKey,
        'Content-Type': mimeType,
        'x-upsert': 'false',
      },
    },
  )
  if (result.status < 200 || result.status >= 300) {
    let message = `Upload failed (${result.status}).`
    try {
      const body = JSON.parse(result.body) as { message?: string; error?: string }
      message = body.message || body.error || message
    } catch {
      // Keep the status message.
    }
    throw new Error(message)
  }
  return size > 0 ? size : source.fileSize ?? 0
}

export type UploadedMeetingFile = MeetingContentItem & {
  path: string
  size: number
}

/** Upload a picked file into the meeting's storage folder and sign it for viewing. */
export async function uploadMeetingFile(
  meetingId: string,
  userId: string,
  source: MeetingContentSource,
): Promise<UploadedMeetingFile> {
  const fileName =
    source.fileName?.trim() || (source.file as File | undefined)?.name || fileNameFromUri(source.uri)
  const mimeType = meetingContentMimeType(source.mimeType || source.file?.type, fileName)
  const kind = detectMeetingContentKind(mimeType, fileName)
  const maxBytes = meetingContentMaxBytes(kind)
  if (typeof source.fileSize === 'number' && source.fileSize > maxBytes) {
    throw new Error(tooLargeMessage(maxBytes))
  }

  const path = meetingContentStoragePath(meetingId, userId, fileName)
  const size =
    Platform.OS === 'web'
      ? await uploadFromWeb(path, source, mimeType, maxBytes)
      : await uploadFromDevice(path, source, mimeType, maxBytes)

  const { data, error } = await supabase.storage
    .from(MEETING_CONTENT_BUCKET)
    .createSignedUrl(path, MEETING_CONTENT_SIGNED_URL_TTL_SEC)
  if (error || !data?.signedUrl) throw new Error(error?.message || 'Could not prepare the file for sharing.')
  return { url: data.signedUrl, fileName, mimeType, kind, path, size }
}

/** Upload a picked file and return the item every participant can open. */
export async function uploadMeetingContent(
  meetingId: string,
  userId: string,
  source: MeetingContentSource,
): Promise<MeetingContentItem> {
  const { url, fileName, mimeType, kind } = await uploadMeetingFile(meetingId, userId, source)
  return { url, fileName, mimeType, kind }
}
