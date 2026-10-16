import { requireOptionalNativeModule } from 'expo'

export type NativeBackgroundConfiguration = {
  mode: 'off' | 'blur' | 'image'
  imagePath?: string
  blurRadius?: number
  /** Whole-frame grade. Older binaries ignore this and leave the camera unchanged. */
  filter?: 'none' | 'warm' | 'cool' | 'vivid' | 'mono' | 'soft'
}

type MeetingVideoEffectsNativeModule = {
  registerProcessor(): boolean
  configure(options: NativeBackgroundConfiguration): void
  isSupported(): boolean
}

export default requireOptionalNativeModule<MeetingVideoEffectsNativeModule>('MeetingVideoEffects')
