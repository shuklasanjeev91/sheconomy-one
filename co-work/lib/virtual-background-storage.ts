import { Platform } from 'react-native'

import { shouldReuseMaterializedBackground, nativeProcessorCanDecodeImageUri } from '~/co-work/lib/native-video-effects'

import { readPickedImageBytes, type PickedImage } from '~/lib/media/pick-image'
import {
  STORAGE_BUCKETS,
  uploadStorageObject,
} from '~/lib/supabase/storage-upload'
import { supabase } from '~/lib/supabase/client'
import type { VirtualBackgroundSelection } from '~/co-work/lib/virtual-backgrounds'

const MAX_BACKGROUND_BYTES = 8 * 1024 * 1024
const SIGNED_URL_TTL_SECONDS = 60 * 60

export type CustomVirtualBackground = {
  id: string
  name: string
  storagePath: string
  createdAt: string | null
  /**
   * Local file URI ready for the native/web processor right after upload.
   * Prefer this over a round-trip signed HTTPS URL (native decode can't open https).
   */
  localUri?: string
}

type VirtualBackgroundRow = {
  id: string
  name: string
  image_url: string
  created_at: string | null
}

function newBackgroundId() {
  if (typeof globalThis.crypto?.randomUUID === 'function') return globalThis.crypto.randomUUID()
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (character) => {
    const random = Math.floor(Math.random() * 16)
    const value = character === 'x' ? random : (random & 0x3) | 0x8
    return value.toString(16)
  })
}

function isLocalImageUri(uri: string) {
  return (
    uri.startsWith('file:') ||
    uri.startsWith('blob:') ||
    uri.startsWith('data:') ||
    uri.startsWith('content:') ||
    uri.startsWith('ph://') ||
    uri.startsWith('assets-library:') ||
    uri.startsWith('asset:') ||
    uri.startsWith('res:') ||
    uri.startsWith('android.resource:') ||
    (uri.startsWith('/') && !uri.startsWith('//'))
  )
}

function asFileUri(uri: string): string {
  if (uri.startsWith('file:') || uri.startsWith('content:')) return uri
  if (uri.startsWith('/') && !uri.startsWith('//')) return `file://${uri}`
  return uri
}

/**
 * Android BitmapFactory cannot open Metro / android_res / HTTPS packager URIs.
 * RN <Image> can, which is why the chip shows "Background selected" while the
 * camera stays unfiltered. Transcode through ImageManipulator into a real JPEG.
 */
async function transcodeBackgroundJpeg(uri: string, destination: string): Promise<string | null> {
  try {
    const ImageManipulator = await import('expo-image-manipulator')
    const jpeg = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width: 1280 } }],
      { compress: 0.88, format: ImageManipulator.SaveFormat.JPEG },
    )
    if (!jpeg.uri) return null
    const FileSystem = await import('expo-file-system/legacy')
    try {
      await FileSystem.copyAsync({ from: jpeg.uri, to: destination })
      return asFileUri(destination)
    } catch {
      return asFileUri(jpeg.uri)
    }
  } catch {
    return null
  }
}

async function unpackExpoAsset(uri: string): Promise<string | null> {
  try {
    const { Asset } = await import('expo-asset')
    const asset = Asset.fromURI(uri)
    await asset.downloadAsync()
    const local = asset.localUri || asset.uri
    return local ? asFileUri(local) : null
  } catch {
    return null
  }
}

/**
 * Give native processors a stable file:// JPEG. HTTPS signed URLs and packed
 * Android drawable URIs are unpacked first — the frame processor cannot open them.
 */
async function materializeLocalImage(uri: string, cacheKey: string): Promise<string> {
  if (Platform.OS === 'web') return uri
  if (shouldReuseMaterializedBackground(uri, cacheKey) && nativeProcessorCanDecodeImageUri(uri)) {
    return uri
  }

  const FileSystem = await import('expo-file-system/legacy')
  const safeKey = cacheKey.replace(/[^a-zA-Z0-9_-]/g, '-')
  const destination = `${FileSystem.cacheDirectory}meeting-background-${safeKey}-${Date.now()}.jpg`

  const transcoded = await transcodeBackgroundJpeg(uri, destination)
  if (transcoded && nativeProcessorCanDecodeImageUri(transcoded)) return transcoded

  const unpacked = await unpackExpoAsset(uri)
  if (unpacked) {
    const fromAsset = await transcodeBackgroundJpeg(unpacked, destination)
    if (fromAsset && nativeProcessorCanDecodeImageUri(fromAsset)) return fromAsset
    if (nativeProcessorCanDecodeImageUri(unpacked)) return unpacked
  }

  if (uri.startsWith('http://') || uri.startsWith('https://')) {
    const result = await FileSystem.downloadAsync(uri, destination)
    if (result.status < 200 || result.status >= 300) {
      throw new Error('Could not cache the background image.')
    }
    const downloaded = asFileUri(result.uri)
    const jpeg = await transcodeBackgroundJpeg(downloaded, destination)
    if (jpeg && nativeProcessorCanDecodeImageUri(jpeg)) return jpeg
    if (nativeProcessorCanDecodeImageUri(downloaded)) return downloaded
  }

  throw new Error('Could not prepare this background for the camera on this device.')
}

export async function listCustomVirtualBackgrounds(
  userId: string,
): Promise<CustomVirtualBackground[]> {
  const { data, error } = await supabase
    .from('virtual_backgrounds')
    .select('id, name, image_url, created_at')
    .eq('user_id', userId)
    .eq('background_type', 'image')
    .order('created_at', { ascending: false })
    .limit(12)
  if (error) throw new Error(error.message)
  return ((data ?? []) as VirtualBackgroundRow[]).map((row) => ({
    id: row.id,
    name: row.name,
    storagePath: row.image_url,
    createdAt: row.created_at,
  }))
}

export async function uploadCustomVirtualBackground(
  userId: string,
  image: PickedImage,
): Promise<CustomVirtualBackground> {
  // Dynamic import — keep expo-image-manipulator out of the lobby/meeting module graph
  // until the user uploads a custom background (avoids Vite deps_ssr pre-bundle thrash).
  const ImageManipulator = await import('expo-image-manipulator')
  const optimized = await ImageManipulator.manipulateAsync(
    image.uri,
    [{ resize: { width: 1920 } }],
    { compress: 0.86, format: ImageManipulator.SaveFormat.JPEG },
  )
  const bytes = await readPickedImageBytes({
    uri: optimized.uri,
    mimeType: 'image/jpeg',
    fileName: image.fileName?.replace(/\.[^.]+$/, '.jpg'),
  })
  if (bytes.byteLength > MAX_BACKGROUND_BYTES) {
    throw new Error('Background images must be 8 MB or smaller.')
  }
  const extension = 'jpg'
  const id = newBackgroundId()
  const path = `${userId}/${id}.${extension}`
  const upload = await uploadStorageObject(
    STORAGE_BUCKETS.meetingBackgrounds,
    path,
    bytes.buffer,
    'image/jpeg',
    { maxBytes: MAX_BACKGROUND_BYTES },
  )
  if (upload.error) throw new Error(upload.error)

  const name = image.fileName?.replace(/\.[^.]+$/, '').slice(0, 80) || 'Custom background'
  const { data, error } = await supabase
    .from('virtual_backgrounds')
    .insert({
      id,
      user_id: userId,
      name,
      image_url: path,
      background_type: 'image',
      blur_enabled: false,
      is_default: false,
    })
    .select('id, name, image_url, created_at')
    .single()
  if (error) {
    await supabase.storage.from(STORAGE_BUCKETS.meetingBackgrounds).remove([path])
    throw new Error(error.message)
  }
  const row = data as VirtualBackgroundRow
  let localUri = optimized.uri
  try {
    localUri = await materializeLocalImage(optimized.uri, id)
  } catch {
    // Still return optimized.uri — apply may succeed with the manipulator file.
  }
  return {
    id: row.id,
    name: row.name,
    storagePath: row.image_url,
    createdAt: row.created_at,
    localUri,
  }
}

export async function deleteCustomVirtualBackground(background: CustomVirtualBackground) {
  const { error: deleteError } = await supabase
    .from('virtual_backgrounds')
    .delete()
    .eq('id', background.id)
  if (deleteError) throw new Error(deleteError.message)
  const { error: storageError } = await supabase.storage
    .from(STORAGE_BUCKETS.meetingBackgrounds)
    .remove([background.storagePath])
  if (storageError) throw new Error(storageError.message)
}

async function signedBackgroundUrl(storagePath: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from(STORAGE_BUCKETS.meetingBackgrounds)
    .createSignedUrl(storagePath, SIGNED_URL_TTL_SECONDS)
  if (error || !data?.signedUrl) {
    throw new Error(error?.message ?? 'Could not load the background image.')
  }
  return data.signedUrl
}

export async function resolveVirtualBackgroundSelection(
  selection: VirtualBackgroundSelection,
): Promise<VirtualBackgroundSelection> {
  if (selection.mode !== 'image') return selection

  const cacheKey = selection.id ?? selection.storagePath ?? 'preset'
  let existing = selection.imageUrl?.trim()

  if (Platform.OS !== 'web') {
    try {
      const { resolveNativePresetFileUri } = await import('~/co-work/lib/virtual-background-presets')
      const presetFile = await resolveNativePresetFileUri(selection.id)
      if (presetFile) existing = presetFile
    } catch {
      // Fall through to imageUrl / signed storage.
    }
  }

  // Prefer a ready local/blob URI (fresh upload) — avoid HTTPS for native processors.
  if (existing && isLocalImageUri(existing)) {
    const imageUrl = await materializeLocalImage(existing, cacheKey)
    return { ...selection, imageUrl }
  }

  const source = selection.storagePath
    ? await signedBackgroundUrl(selection.storagePath)
    : existing
  if (!source) throw new Error('The selected background image is unavailable.')
  const imageUrl = await materializeLocalImage(source, cacheKey)
  return { ...selection, imageUrl }
}

export function customBackgroundSelection(
  background: CustomVirtualBackground,
): VirtualBackgroundSelection {
  return {
    mode: 'image',
    id: background.id,
    storagePath: background.storagePath,
    // Apply immediately from the local upload file when present.
    imageUrl: background.localUri,
  }
}
