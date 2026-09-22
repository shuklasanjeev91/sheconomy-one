import type { ImageSourcePropType } from 'react-native'

import type { VirtualBackgroundSelection } from '~/co-work/lib/virtual-backgrounds'

export type VirtualBackgroundPreset = {
  id: string
  name: string
  thumbnail: ImageSourcePropType
  selection: VirtualBackgroundSelection
}

export async function resolveNativePresetFileUri(_id: string | undefined): Promise<string | null> {
  return null
}

/**
 * Web/SSR-safe presets — files live in `/public/meeting-backgrounds`.
 * Native uses `virtual-background-presets.native.ts` (Metro `require`).
 */
const PRESET_ASSETS = [
  {
    id: 'office',
    name: 'Home office',
    path: '/meeting-backgrounds/office.png',
  },
  {
    id: 'lounge',
    name: 'Co-work lounge',
    path: '/meeting-backgrounds/lounge.png',
  },
  {
    id: 'studio',
    name: 'Warm studio',
    path: '/meeting-backgrounds/studio.png',
  },
] as const

export function getVirtualBackgroundPresets(): VirtualBackgroundPreset[] {
  return PRESET_ASSETS.map(({ id, name, path }) => ({
    id,
    name,
    thumbnail: { uri: path },
    selection: {
      mode: 'image',
      id,
      imageUrl: path,
    },
  }))
}
