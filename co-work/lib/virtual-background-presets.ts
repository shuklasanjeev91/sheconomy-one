import { Image } from 'react-native'

import type { VirtualBackgroundSelection } from '~/co-work/lib/virtual-backgrounds'

export type VirtualBackgroundPreset = {
  id: string
  name: string
  thumbnail: number
  selection: VirtualBackgroundSelection
}

const PRESET_ASSETS = [
  {
    id: 'office',
    name: 'Home office',
    asset: require('../../public/meeting-backgrounds/office.png'),
  },
  {
    id: 'lounge',
    name: 'Co-work lounge',
    asset: require('../../public/meeting-backgrounds/lounge.png'),
  },
  {
    id: 'studio',
    name: 'Warm studio',
    asset: require('../../public/meeting-backgrounds/studio.png'),
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
