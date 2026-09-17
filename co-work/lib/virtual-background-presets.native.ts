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
