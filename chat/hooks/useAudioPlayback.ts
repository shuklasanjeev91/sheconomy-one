export type AudioPlaybackState = {
  isPlaying: boolean
  positionMs: number
  durationMs: number
  toggle: () => void
}

export function useAudioPlayback(_url: string | null): AudioPlaybackState {
  return { isPlaying: false, positionMs: 0, durationMs: 0, toggle: () => {} }
}
