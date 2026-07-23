import { Platform } from 'react-native'

import { supabase } from '~/lib/supabase/client'
import { supabaseConfig } from '~/lib/supabase/env'

export type UploadProgressHandler = (percent: number) => void

function encodeObjectPath(path: string) {
  return path
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/')
}

/** Upload with byte progress on web (XHR); native falls back to standard upload. */
export async function uploadBlobWithProgress(
  bucket: string,
  path: string,
  blob: Blob,
  contentType: string,
  options?: { upsert?: boolean; onProgress?: UploadProgressHandler },
): Promise<{ error: string | null }> {
  const onProgress = options?.onProgress

  if (Platform.OS !== 'web' || typeof XMLHttpRequest === 'undefined') {
    onProgress?.(0)
    const { error } = await supabase.storage.from(bucket).upload(path, blob, {
      contentType,
      upsert: options?.upsert ?? true,
      cacheControl: '3600',
    })
    onProgress?.(error ? 0 : 100)
    return { error: error?.message ?? null }
  }

  const {
    data: { session },
  } = await supabase.auth.getSession()
  const token = session?.access_token
  if (!token) return { error: 'Not signed in' }

  const url = `${supabaseConfig.url}/storage/v1/object/${encodeURIComponent(bucket)}/${encodeObjectPath(path)}`

  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', url)
    xhr.setRequestHeader('Authorization', `Bearer ${token}`)
    xhr.setRequestHeader('apikey', supabaseConfig.anonKey)
    xhr.setRequestHeader('Content-Type', contentType)
    if (options?.upsert ?? true) {
      xhr.setRequestHeader('x-upsert', 'true')
    }
    xhr.setRequestHeader('cache-control', '3600')

    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable) return
      onProgress?.(Math.round((event.loaded / event.total) * 100))
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress?.(100)
        resolve({ error: null })
        return
      }
      resolve({ error: xhr.responseText || `Upload failed (${xhr.status})` })
    }

    xhr.onerror = () => resolve({ error: 'Upload failed' })
    xhr.send(blob)
  })
}

export async function uploadFilesWithAggregateProgress(
  files: Array<{ blob: Blob; mimeType: string }>,
  uploadOne: (
    file: { blob: Blob; mimeType: string },
    onFileProgress: UploadProgressHandler,
  ) => Promise<{ error: string | null }>,
  onProgress?: UploadProgressHandler,
) {
  if (!files.length) return { error: null as string | null }

  for (let index = 0; index < files.length; index += 1) {
    const file = files[index]
    const { error } = await uploadOne(file, (filePercent) => {
      const overall = Math.round(((index + filePercent / 100) / files.length) * 100)
      onProgress?.(overall)
    })
    if (error) return { error }
  }

  onProgress?.(100)
  return { error: null as string | null }
}
