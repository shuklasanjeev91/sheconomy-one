import { Platform } from 'react-native'

import { supabase } from '~/lib/supabase/client'
import { supabaseConfig } from '~/lib/supabase/env'

export type UploadProgressHandler = (percent: number) => void

export type UploadBody = Blob | ArrayBuffer | Uint8Array

/** Per-file ceiling so a stalled native upload cannot leave Posting… forever. */
const NATIVE_UPLOAD_TIMEOUT_MS = 120_000

function encodeObjectPath(path: string) {
  return path
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/')
}

async function toArrayBuffer(data: UploadBody): Promise<ArrayBuffer | null> {
  if (data instanceof ArrayBuffer) {
    return data.byteLength > 0 ? data : null
  }
  if (data instanceof Uint8Array) {
    if (data.byteLength <= 0) return null
    // Copy into a standalone ArrayBuffer (avoid SharedArrayBuffer typing issues).
    const copy = new Uint8Array(data.byteLength)
    copy.set(data)
    return copy.buffer
  }
  // React Native Blob.arrayBuffer() is known to hang indefinitely — never call it.
  if (Platform.OS !== 'web') {
    return null
  }
  try {
    const buffer = await data.arrayBuffer()
    return buffer.byteLength > 0 ? buffer : null
  } catch {
    return null
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), ms)
    promise.then(
      (value) => {
        clearTimeout(timer)
        resolve(value)
      },
      (error) => {
        clearTimeout(timer)
        reject(error)
      },
    )
  })
}

/** Upload with byte progress on web (XHR); native falls back to standard upload. */
export async function uploadBlobWithProgress(
  bucket: string,
  path: string,
  data: UploadBody,
  contentType: string,
  options?: { upsert?: boolean; onProgress?: UploadProgressHandler },
): Promise<{ error: string | null }> {
  const onProgress = options?.onProgress

  if (Platform.OS !== 'web' || typeof XMLHttpRequest === 'undefined') {
    onProgress?.(0)
    // React Native Blob uploads are unreliable with supabase-js. Always send bytes.
    const buffer = await toArrayBuffer(data)
    if (!buffer) {
      return {
        error:
          data instanceof Blob
            ? 'Could not read media bytes for upload. Try picking the file again.'
            : 'Image data is empty.',
      }
    }
    try {
      const { error } = await withTimeout(
        supabase.storage.from(bucket).upload(path, new Uint8Array(buffer), {
          contentType,
          upsert: options?.upsert ?? true,
          cacheControl: '3600',
        }),
        NATIVE_UPLOAD_TIMEOUT_MS,
        'Upload timed out. Check your connection and try again.',
      )
      onProgress?.(error ? 0 : 100)
      return { error: error?.message ?? null }
    } catch (error) {
      onProgress?.(0)
      return {
        error: error instanceof Error ? error.message : 'Upload failed.',
      }
    }
  }

  const blob =
    data instanceof Blob
      ? data
      : new Blob([data instanceof Uint8Array ? data : new Uint8Array(data)], {
          type: contentType,
        })

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
    xhr.ontimeout = () => resolve({ error: 'Upload timed out. Check your connection and try again.' })
    xhr.timeout = NATIVE_UPLOAD_TIMEOUT_MS
    xhr.send(blob)
  })
}

export async function uploadFilesWithAggregateProgress<T extends { mimeType: string }>(
  files: T[],
  uploadOne: (file: T, onFileProgress: UploadProgressHandler) => Promise<{ error: string | null }>,
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
