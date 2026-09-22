import { Image, type ImageSourcePropType } from 'react-native'

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
    // Metro bundles these for native; do not use in SSR/web.
    asset: require('../../public/meeting-backgrounds/office.png') as number,
  },
  {
    id: 'lounge',
    name: 'Co-work lounge',
    asset: require('../../public/meeting-backgrounds/lounge.png') as number,
  },
  {
    id: 'studio',
    name: 'Warm studio',
    asset: require('../../public/meeting-backgrounds/studio.png') as number,
  },
] as const

/** Unpack a Metro/drawable preset into a real file the Android processor can decode. */
export async function resolveNativePresetFileUri(id: string | undefined): Promise<string | null> {
  const row = PRESET_ASSETS.find((item) => item.id === id)
  if (!row) return null
  const { Asset } = await import('expo-asset')
  const asset = Asset.fromModule(row.asset)
  await asset.downloadAsync()
  const uri = asset.localUri || asset.uri
  if (!uri) return null
  if (uri.startsWith('file:') || uri.startsWith('content:')) return uri
  if (uri.startsWith('/') && !uri.startsWith('//')) return `file://${uri}`
  return uri
}

export function getVirtualBackgroundPresets(): VirtualBackgroundPreset[] {
  return PRESET_ASSETS.map(({ id, name, asset }) => ({
    id,
    name,
    thumbnail: asset,
    selection: {
      mode: 'image',
      id,
      imageUrl: Image.resolveAssetSource(asset).uri,
    },
  }))
}
