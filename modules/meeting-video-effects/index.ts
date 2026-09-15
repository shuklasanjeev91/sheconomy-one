import { requireOptionalNativeModule } from 'expo'

export type NativeBackgroundConfiguration = {
  mode: 'off' | 'blur' | 'image'
  imagePath?: string
  blurRadius?: number
}

type MeetingVideoEffectsNativeModule = {
  registerProcessor(): boolean
  configure(options: NativeBackgroundConfiguration): void
  isSupported(): boolean
}

export default requireOptionalNativeModule<MeetingVideoEffectsNativeModule>('MeetingVideoEffects')
