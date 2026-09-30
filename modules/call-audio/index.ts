import { requireOptionalNativeModule, type NativeModule } from 'expo'

export type AndroidCallAudioOptions = {
  preferredOutputList?: string[]
  manageAudioFocus?: boolean
  audioMode?: 'normal' | 'inCommunication' | 'inCall'
  audioFocusMode?: 'gain' | 'gainTransient' | 'gainTransientExclusive' | 'gainTransientMayDuck'
  audioAttributesUsageType?: 'voiceCommunication' | 'media'
  audioAttributesContentType?: 'speech' | 'music'
  audioStreamType?: 'voiceCall' | 'music'
  forceHandleAudioRouting?: boolean
}

export type AppleCallAudioOptions = {
  category?: 'playAndRecord' | 'playback'
  categoryOptions?: string[]
  mode?: 'videoChat' | 'voiceChat' | 'default'
}

/** `call` = recognizer reads WebRTC's call mic audio; `mic` = recognizer opened the mic itself. */
export type CaptionSpeechMode = 'call' | 'mic'

export type CaptionSpeechEvent = {
  type: 'ready' | 'start' | 'partial' | 'final' | 'end' | 'error' | 'idle'
  mode: CaptionSpeechMode
  text?: string
  /** Android `SpeechRecognizer.ERROR_*` code. */
  code?: number
}

type CallAudioEvents = {
  onPictureInPictureModeChanged: (event: { active: boolean }) => void
  onCaptionSpeech: (event: CaptionSpeechEvent) => void
}

type CallAudioNativeModule = NativeModule<CallAudioEvents> & {
  addListener<E extends keyof CallAudioEvents>(
    eventName: E,
    listener: CallAudioEvents[E],
  ): { remove: () => void }
  configureAndroid(options: AndroidCallAudioOptions): Promise<void>
  configureApple(options: AppleCallAudioOptions): Promise<void>
  start(): Promise<void>
  stop(): Promise<void>
  /** iOS: `default` | `force_speaker`. Android: `bluetooth` | `headset` | `speaker` | `earpiece`. */
  getOutputs(): Promise<string[]>
  selectOutput(outputId: string): Promise<void>
  showRoutePicker(): Promise<void>
  /** iOS: true once the broadcast extension starts, false if the picker closes without it. */
  waitForScreenBroadcast?(timeoutMs: number): Promise<boolean>
  /** Android: Activity Picture-in-Picture (absent on older binaries). */
  isPictureInPictureSupported?(): boolean
  isInPictureInPicture?(): boolean
  enterPictureInPicture?(width: number, height: number): Promise<boolean>
  /** Android: enter PiP automatically when the user leaves the app (Home / recents). */
  setAutoPictureInPicture?(enabled: boolean, width: number, height: number): Promise<void>
  /** Android: one recognition pass; ends with an `idle` event (absent on older binaries). */
  startCaptionSpeech?(locale: string): Promise<CaptionSpeechMode>
  stopCaptionSpeech?(): Promise<void>
  cancelCaptionSpeech?(): Promise<void>
}

export default requireOptionalNativeModule<CallAudioNativeModule>('CallAudio')
