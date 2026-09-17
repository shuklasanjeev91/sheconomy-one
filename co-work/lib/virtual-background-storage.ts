import { Platform } from 'react-native'

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
}

type VirtualBackgroundRow = {
  id: string
  name: string
  image_url: string
  created_at: string | null
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
  const extension = bytes.mimeType.includes('png')
    ? 'png'
    : bytes.mimeType.includes('webp')
      ? 'webp'
      : 'jpg'
  const id =
    typeof globalThis.crypto?.randomUUID === 'function'
      ? globalThis.crypto.randomUUID()
      : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (character) => {
          const random = Math.floor(Math.random() * 16)
          const value = character === 'x' ? random : (random & 0x3) | 0x8
          return value.toString(16)
        })
  const path = `${userId}/${id}.${extension}`
  const upload = await uploadStorageObject(
    STORAGE_BUCKETS.meetingBackgrounds,
    path,
    bytes.buffer,
    bytes.mimeType,
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
  return { id: row.id, name: row.name, storagePath: row.image_url, createdAt: row.created_at }
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

async function cacheNativeImage(uri: string, cacheKey: string): Promise<string> {
  if (Platform.OS === 'web' || uri.startsWith('file:')) return uri
  const FileSystem = await import('expo-file-system/legacy')
  const safeKey = cacheKey.replace(/[^a-zA-Z0-9_-]/g, '-')
  const destination = `${FileSystem.cacheDirectory}meeting-background-${safeKey}.jpg`
  const existing = await FileSystem.getInfoAsync(destination)
  if (existing.exists) return destination
  const result = await FileSystem.downloadAsync(uri, destination)
  if (result.status < 200 || result.status >= 300) {
    throw new Error('Could not cache the background image.')
  }
  return result.uri
}

export async function resolveVirtualBackgroundSelection(
  selection: VirtualBackgroundSelection,
): Promise<VirtualBackgroundSelection> {
  if (selection.mode !== 'image') return selection
  const source = selection.storagePath
    ? await signedBackgroundUrl(selection.storagePath)
    : selection.imageUrl
  if (!source) throw new Error('The selected background image is unavailable.')
  const imageUrl = await cacheNativeImage(source, selection.id ?? selection.storagePath ?? 'preset')
  return { ...selection, imageUrl }
}

export function customBackgroundSelection(
  background: CustomVirtualBackground,
): VirtualBackgroundSelection {
  return {
    mode: 'image',
    id: background.id,
    storagePath: background.storagePath,
  }
}
