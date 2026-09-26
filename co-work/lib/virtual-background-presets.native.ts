import { Image, Platform, type ImageSourcePropType } from 'react-native'

import type { VirtualBackgroundSelection } from '~/co-work/lib/virtual-backgrounds'

export type VirtualBackgroundPreset = {
  id: string
  name: string
  thumbnail: ImageSourcePropType
  selection: VirtualBackgroundSelection
}

const PRESET_ASSETS = [
  {
    id: 'office',
    name: 'Home office',
    asset: require('../../public/meeting-backgrounds/office.png') as number,
    fileName: 'office.png',
  },
  {
    id: 'lounge',
    name: 'Co-work lounge',
    asset: require('../../public/meeting-backgrounds/lounge.png') as number,
    fileName: 'lounge.png',
  },
  {
    id: 'studio',
    name: 'Warm studio',
    asset: require('../../public/meeting-backgrounds/studio.png') as number,
    fileName: 'studio.png',
  },
] as const

/** Packed path inside the release APK (`assets/assets/public/...`). */
function androidAssetUri(fileName: string): string {
  return `file:///android_asset/assets/public/meeting-backgrounds/${fileName}`
}

/**
 * Prefer Metro asset module ids. On Android release, also fall back to
 * `Image.resolveAssetSource` when Hermes needs an explicit URI for `<Image>`.
 */
function thumbnailSource(asset: number, _fileName: string): ImageSourcePropType {
  if (Platform.OS === 'android') {
    try {
      const resolved = Image.resolveAssetSource(asset)
      if (resolved?.uri) return { uri: resolved.uri }
    } catch {
      // Fall through to the packed module id.
    }
  }
  return asset
}

function asFileUri(uri: string): string {
  if (uri.startsWith('file:') || uri.startsWith('content:')) return uri
  if (uri.startsWith('/') && !uri.startsWith('//')) return `file://${uri}`
  return uri
}

/**
 * Unpack a preset into a real cache JPEG the Android frame processor can decode.
 * Prefer expo-asset fromModule (reliable) — android_asset + ImageManipulator often fails.
 */
export async function resolveNativePresetFileUri(id: string | undefined): Promise<string | null> {
  const row = PRESET_ASSETS.find((item) => item.id === id)
  if (!row) return null

  try {
    const FileSystem = await import('expo-file-system/legacy')
    const dest = `${FileSystem.cacheDirectory}meeting-background-preset-${row.id}.jpg`
    const existing = await FileSystem.getInfoAsync(dest)
    if (existing.exists && (existing.size ?? 0) > 1024) return asFileUri(dest)

    const { Asset } = await import('expo-asset')
    const asset = Asset.fromModule(row.asset)
    await asset.downloadAsync()
    const local = asset.localUri || asset.uri
    if (!local) {
      // Last resort: copy the packed APK asset into cache.
      try {
        await FileSystem.copyAsync({ from: androidAssetUri(row.fileName), to: dest })
        const copied = await FileSystem.getInfoAsync(dest)
        if (copied.exists && (copied.size ?? 0) > 0) return asFileUri(dest)
      } catch {
        return null
      }
      return null
    }

    // Transcode to a stable JPEG BitmapFactory can open every time.
    try {
      const ImageManipulator = await import('expo-image-manipulator')
      const jpeg = await ImageManipulator.manipulateAsync(
        local,
        [{ resize: { width: 960 } }],
        { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG },
      )
      if (jpeg.uri) {
        try {
          await FileSystem.copyAsync({ from: jpeg.uri, to: dest })
          return asFileUri(dest)
        } catch {
          return asFileUri(jpeg.uri)
        }
      }
    } catch {
      // Fall back to the unpacked asset file directly.
    }

    try {
      await FileSystem.copyAsync({ from: local, to: dest })
      return asFileUri(dest)
    } catch {
      return asFileUri(local)
    }
  } catch {
    return null
  }
}

export function getVirtualBackgroundPresets(): VirtualBackgroundPreset[] {
  return PRESET_ASSETS.map(({ id, name, asset, fileName }) => ({
    id,
    name,
    thumbnail: thumbnailSource(asset, fileName),
    selection: {
      mode: 'image',
      id,
      // Materialized on apply via resolveNativePresetFileUri(id).
    },
  }))
}

/** Soft-preview / confirmation strip source for a preset id (Android-safe URI). */
export function getPresetThumbnailSource(id: string | undefined): ImageSourcePropType | null {
  if (!id) return null
  const row = PRESET_ASSETS.find((item) => item.id === id)
  if (!row) return null
  return thumbnailSource(row.asset, row.fileName)
}
