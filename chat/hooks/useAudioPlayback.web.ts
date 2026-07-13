import { useCallback, useEffect, useRef, useState } from 'react'
import type { AudioPlaybackState } from '~/chat/hooks/useAudioPlayback'

export type { AudioPlaybackState }

export function useAudioPlayback(url: string | null): AudioPlaybackState {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [positionMs, setPositionMs] = useState(0)
  const [durationMs, setDurationMs] = useState(0)

  useEffect(() => {
    return () => {
      audioRef.current?.pause()
      audioRef.current = null
    }
  }, [url])

  const toggle = useCallback(() => {
    if (!url) return
    let audio = audioRef.current
    if (!audio) {
      audio = new Audio(url)
      audio.addEventListener('loadedmetadata', () => {
        setDurationMs(Number.isFinite(audio!.duration) ? audio!.duration * 1000 : 0)
      })
      audio.addEventListener('timeupdate', () => setPositionMs(audio!.currentTime * 1000))
      audio.addEventListener('ended', () => {
        setIsPlaying(false)
        setPositionMs(0)
        audio!.currentTime = 0
      })
      audioRef.current = audio
    }
    if (audio.paused) {
      void audio.play()
      setIsPlaying(true)
    } else {
      audio.pause()
      setIsPlaying(false)
    }
  }, [url])

  return { isPlaying, positionMs, durationMs, toggle }
}
