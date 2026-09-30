import { useCallback, useEffect, useRef, useState } from 'react'

import type { MediasoupVideoEffectsInput } from '~/co-work/hooks/useMediasoupMeeting'
import type { MeetingVideoEffects } from '~/co-work/lib/meeting-video-effects'
import { resolveVirtualBackgroundSelection } from '~/co-work/lib/virtual-background-storage'
import {
  loadVirtualBackgroundPreference,
  normalizeVirtualBackground,
  OFF_BACKGROUND,
  saveVirtualBackgroundPreference,
  type VideoEffectCapability,
  type VideoEffectStatus,
  type VirtualBackgroundSelection,
  webBackgroundResourceWarning,
  virtualBackgroundUnavailableMessage,
} from '~/co-work/lib/virtual-backgrounds'
import {
  supportsWebBackgroundProcessor,
  webBackgroundOptionsFor,
  WebBackgroundProcessor,
} from '~/co-work/lib/web-background-processor'

const PROCESSOR_INIT_TIMEOUT_MS = 12_000

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(new Error('Background effect took too long to start.')),
      timeoutMs,
    )
    promise.then(
      (value) => {
        clearTimeout(timeout)
        resolve(value)
      },
      (cause) => {
        clearTimeout(timeout)
        reject(cause)
      },
    )
  })
}

/** Browser virtual backgrounds: MediaPipe segmentation composited onto the sent camera. */
export function useMeetingVideoEffects({ room }: MediasoupVideoEffectsInput): MeetingVideoEffects {
  const [capability, setCapability] = useState<VideoEffectCapability>('checking')
  const [status, setStatus] = useState<VideoEffectStatus>('idle')
  const [selection, setSelection] = useState<VirtualBackgroundSelection>(OFF_BACKGROUND)
  const [error, setError] = useState<string | null>(null)
  const processorRef = useRef<WebBackgroundProcessor | null>(null)
  const slowFrameCountRef = useRef(0)
  const unavailableReasonRef = useRef<string | null>(null)
  const selectionRef = useRef(selection)
  selectionRef.current = selection
  const roomRef = useRef(room)
  roomRef.current = room

  useEffect(() => {
    const resourceWarning =
      typeof navigator === 'undefined'
        ? null
        : webBackgroundResourceWarning(navigator as Navigator & { deviceMemory?: number })
    const supported = !resourceWarning && supportsWebBackgroundProcessor()
    unavailableReasonRef.current = resourceWarning
    setCapability(supported ? 'supported' : 'unavailable')
    if (resourceWarning) setError(resourceWarning)
    if (!supported) return
    void loadVirtualBackgroundPreference()
      .then(resolveVirtualBackgroundSelection)
      .then(setSelection)
      .catch(() => setSelection(OFF_BACKGROUND))
  }, [])

  const turnOffForPerformance = useCallback(() => {
    setError('Background effect was turned off to keep the call smooth.')
    setStatus('error')
    selectionRef.current = OFF_BACKGROUND
    setSelection(OFF_BACKGROUND)
    void saveVirtualBackgroundPreference(OFF_BACKGROUND)
    void roomRef.current?.setCameraProcessor(null)
  }, [])

  const ensureProcessor = useCallback((): WebBackgroundProcessor => {
    if (processorRef.current) return processorRef.current
    const processor = new WebBackgroundProcessor({
      // Keep inference stable on typical laptops.
      maxFps: 15,
      onFrameProcessed: ({ processingTimeMs }) => {
        slowFrameCountRef.current =
          processingTimeMs > 80 ? slowFrameCountRef.current + 1 : Math.max(0, slowFrameCountRef.current - 1)
        if (slowFrameCountRef.current >= 12) {
          slowFrameCountRef.current = 0
          turnOffForPerformance()
        }
      },
    })
    processorRef.current = processor
    return processor
  }, [turnOffForPerformance])

  const apply = useCallback(
    async (nextValue: VirtualBackgroundSelection): Promise<boolean> => {
      const next = normalizeVirtualBackground(nextValue)
      setError(null)

      if (next.mode !== 'off' && capability !== 'supported') {
        if (capability === 'checking') {
          selectionRef.current = next
          setSelection(next)
          await saveVirtualBackgroundPreference(next)
          return true
        }
        setError(unavailableReasonRef.current || virtualBackgroundUnavailableMessage('web'))
        setStatus('error')
        return false
      }

      setStatus('loading')
      try {
        const resolved = next.mode === 'image' ? await resolveVirtualBackgroundSelection(next) : next
        if (resolved.mode === 'image' && !resolved.imageUrl) {
          throw new Error('The selected background image is not available.')
        }

        if (resolved.mode === 'off') {
          await room?.setCameraProcessor(null)
        } else {
          const processor = ensureProcessor()
          await withTimeout(processor.switchTo(webBackgroundOptionsFor(resolved)), PROCESSOR_INIT_TIMEOUT_MS)
          await room?.setCameraProcessor(processor)
        }

        selectionRef.current = resolved
        setSelection(resolved)
        setStatus(resolved.mode === 'off' ? 'idle' : 'active')
        await saveVirtualBackgroundPreference(resolved)
        return true
      } catch (cause) {
        const message = cause instanceof Error ? cause.message : 'Could not apply background effect.'
        setError(message)
        setStatus('error')
        await room?.setCameraProcessor(null).catch(() => undefined)
        if (/too long|timed out|Timeout/i.test(message) && next.mode !== 'off') {
          // Keep the preference; the next room / camera start retries.
          selectionRef.current = next
          setSelection(next)
          return false
        }
        selectionRef.current = OFF_BACKGROUND
        setSelection(OFF_BACKGROUND)
        return false
      }
    },
    [capability, ensureProcessor, room],
  )

  // Re-apply the saved choice once support is known and the room exists.
  useEffect(() => {
    if (!room || capability !== 'supported') return
    if (selectionRef.current.mode === 'off') return
    void apply(selectionRef.current)
    // Only on room / capability changes; `apply` itself changes with them.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [capability, room])

  useEffect(
    () => () => {
      processorRef.current?.stop()
      processorRef.current = null
    },
    [],
  )

  const retry = useCallback(() => apply(selectionRef.current), [apply])

  return { capability, status, selection, error, apply, retry }
}
