import { useCallback, useEffect, useRef } from 'react'
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native'

type UseScrollNearEndOptions = {
  enabled?: boolean
  /** Distance from bottom (px) that triggers the callback. */
  threshold?: number
  /** While true, suppresses repeat triggers until loading finishes. */
  loading?: boolean
}

/**
 * Fires when a scroll container is scrolled near its bottom — for infinite lists
 * inside panels, bottom sheets, and nested ScrollViews.
 */
export function useScrollNearEnd(
  onNearEnd: () => void,
  { enabled = true, threshold = 120, loading = false }: UseScrollNearEndOptions = {},
) {
  const onNearEndRef = useRef(onNearEnd)
  const inFlight = useRef(false)

  useEffect(() => {
    onNearEndRef.current = onNearEnd
  }, [onNearEnd])

  useEffect(() => {
    if (!enabled || !loading) inFlight.current = false
  }, [enabled, loading])

  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (!enabled || inFlight.current) return
      const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent
      const distanceFromBottom =
        contentSize.height - layoutMeasurement.height - contentOffset.y
      if (distanceFromBottom > threshold) return
      inFlight.current = true
      onNearEndRef.current()
    },
    [enabled, threshold],
  )

  const handleWebScroll = useCallback(
    (event: { currentTarget: EventTarget & { scrollTop: number; clientHeight: number; scrollHeight: number } }) => {
      if (!enabled || inFlight.current) return
      const el = event.currentTarget
      const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight
      if (distanceFromBottom > threshold) return
      inFlight.current = true
      onNearEndRef.current()
    },
    [enabled, threshold],
  )

  const release = useCallback(() => {
    inFlight.current = false
  }, [])

  return { handleScroll, handleWebScroll, release }
}