/** Web stub — Voice STT is native-only. */
export default {
  isAvailable: async () => 0,
  start: async () => undefined,
  stop: async () => undefined,
  destroy: async () => undefined,
  removeAllListeners: () => undefined,
  onSpeechPartialResults: null as null,
  onSpeechResults: null as null,
  onSpeechError: null as null,
  onSpeechEnd: null as null,
}
