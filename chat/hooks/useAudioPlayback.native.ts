import { useCallback, useEffect, useRef, useState } from 'react'
import type { AudioPlaybackState } from '~/chat/hooks/useAudioPlayback'

export type { AudioPlaybackState }

type NativePlayer = {
  play: () => void
  pause: () => void
  remove: () => void
  playing: boolean
  currentTime: number
  duration: number
}

export function useAudioPlayback(url: string | null): AudioPlaybackState {
  const playerRef = useRef<NativePlayer | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [positionMs, setPositionMs] = useState(0)
  const [durationMs, setDurationMs] = useState(0)

  const cleanup = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
    try {
      playerRef.current?.remove()
    } catch {
      // ignore
    }
    playerRef.current = null
  }, [])

  useEffect(() => {
    cleanup()
    setIsPlaying(false)
    setPositionMs(0)
    setDurationMs(0)
  }, [url, cleanup])

  useEffect(() => cleanup, [cleanup])

  const toggle = useCallback(async () => {
    if (!url) return
    let player = playerRef.current
    if (!player) {
      const { createAudioPlayer } = await import('expo-audio')
      player = createAudioPlayer({ uri: url }) as unknown as NativePlayer
      playerRef.current = player
      intervalRef.current = setInterval(() => {
        const active = playerRef.current
        if (!active) return
        setPositionMs((active.currentTime ?? 0) * 1000)
        setDurationMs((active.duration ?? 0) * 1000)
        setIsPlaying(!!active.playing)
        if (active.duration && active.currentTime >= active.duration) {
          setIsPlaying(false)
        }
      }, 300)
    }
    if (player.playing) {
      player.pause()
      setIsPlaying(false)
    } else {
      player.play()
      setIsPlaying(true)
    }
  }, [url])

  return { isPlaying, positionMs, durationMs, toggle: () => void toggle() }
}
