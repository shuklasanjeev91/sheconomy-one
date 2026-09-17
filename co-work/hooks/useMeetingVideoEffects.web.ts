import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocalParticipant } from '@livekit/components-react'
import {
  BackgroundProcessor,
  supportsBackgroundProcessors,
  type BackgroundProcessorWrapper,
  type SwitchBackgroundProcessorOptions,
} from '@livekit/track-processors'
import { LocalVideoTrack } from 'livekit-client'

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

const PROCESSOR_INIT_TIMEOUT_MS = 12_000

function processorOptions(selection: VirtualBackgroundSelection): SwitchBackgroundProcessorOptions {
  if (selection.mode === 'blur') {
    return { mode: 'background-blur', blurRadius: selection.blurRadius }
  }
  if (selection.mode === 'image' && selection.imageUrl) {
    return { mode: 'virtual-background', imagePath: selection.imageUrl }
  }
  return { mode: 'disabled' }
}

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

export function useMeetingVideoEffects(): MeetingVideoEffects {
  const { cameraTrack, isCameraEnabled } = useLocalParticipant()
  const [capability, setCapability] = useState<VideoEffectCapability>('checking')
  const [status, setStatus] = useState<VideoEffectStatus>('idle')
  const [selection, setSelection] = useState<VirtualBackgroundSelection>(OFF_BACKGROUND)
  const [error, setError] = useState<string | null>(null)
  const processorRef = useRef<BackgroundProcessorWrapper | null>(null)
  const attachedTrackRef = useRef<LocalVideoTrack | null>(null)
  const slowFrameCountRef = useRef(0)
  const unavailableReasonRef = useRef<string | null>(null)
  const selectionRef = useRef(selection)
  selectionRef.current = selection

  useEffect(() => {
    const resourceWarning =
      typeof navigator === 'undefined'
        ? null
        : webBackgroundResourceWarning(
            navigator as Navigator & { deviceMemory?: number },
          )
    const supported =
      typeof window !== 'undefined' && !resourceWarning && supportsBackgroundProcessors()
    unavailableReasonRef.current = resourceWarning
    setCapability(supported ? 'supported' : 'unavailable')
    if (resourceWarning) setError(resourceWarning)
    if (!supported) return
    void loadVirtualBackgroundPreference()
      .then(resolveVirtualBackgroundSelection)
      .then(setSelection)
      .catch(() => setSelection(OFF_BACKGROUND))
  }, [])

  const ensureProcessor = useCallback(async (): Promise<BackgroundProcessorWrapper | null> => {
    if (capability !== 'supported' || !isCameraEnabled) return null
    const track = cameraTrack?.track
    if (!(track instanceof LocalVideoTrack)) return null

    if (processorRef.current && attachedTrackRef.current === track) {
      return processorRef.current
    }

    if (attachedTrackRef.current && processorRef.current) {
      try {
        await attachedTrackRef.current.stopProcessor()
      } catch {
        // The old camera track may already have been stopped/replaced.
      }
      processorRef.current = null
      attachedTrackRef.current = null
    }

    const processor = BackgroundProcessor({
      mode: 'disabled',
      // Keep inference stable on typical laptops and canvas-fallback browsers.
      maxFps: 15,
      onFrameProcessed: ({ processingTimeMs }) => {
        slowFrameCountRef.current =
          processingTimeMs > 80 ? slowFrameCountRef.current + 1 : Math.max(0, slowFrameCountRef.current - 1)
        if (slowFrameCountRef.current >= 12) {
          slowFrameCountRef.current = 0
          setError('Background effect was turned off to keep the call smooth.')
          setStatus('error')
          selectionRef.current = OFF_BACKGROUND
          setSelection(OFF_BACKGROUND)
          void saveVirtualBackgroundPreference(OFF_BACKGROUND)
          void processorRef.current?.switchTo({ mode: 'disabled' }).catch(() => undefined)
        }
      },
    })
    try {
      await withTimeout(track.setProcessor(processor), PROCESSOR_INIT_TIMEOUT_MS)
    } catch (cause) {
      try {
        await track.stopProcessor()
      } catch {
        // A timed-out processor may not have attached.
      }
      throw cause
    }
    processorRef.current = processor
    attachedTrackRef.current = track
    return processor
  }, [cameraTrack?.track, capability, isCameraEnabled])

  const apply = useCallback(
    async (nextValue: VirtualBackgroundSelection): Promise<boolean> => {
      const next = normalizeVirtualBackground(nextValue)
      setError(null)

      if (next.mode !== 'off' && capability !== 'supported') {
        setError(
          unavailableReasonRef.current || virtualBackgroundUnavailableMessage('web'),
        )
        setStatus('error')
        return false
      }

      setStatus('loading')
      try {
        if (next.mode === 'image' && !next.imageUrl) {
          throw new Error('The selected background image is not available.')
        }

        const processor = await ensureProcessor()
        if (processor) {
          await withTimeout(processor.switchTo(processorOptions(next)), PROCESSOR_INIT_TIMEOUT_MS)
        } else if (next.mode !== 'off' && isCameraEnabled) {
          throw new Error('Start the camera before applying a virtual background.')
        }

        selectionRef.current = next
        setSelection(next)
        setStatus(next.mode === 'off' ? 'idle' : 'active')
        await saveVirtualBackgroundPreference(next)
        return true
      } catch (cause) {
        const message = cause instanceof Error ? cause.message : 'Could not apply background effect.'
        setError(message)
        setStatus('error')
        try {
          await processorRef.current?.switchTo({ mode: 'disabled' })
        } catch {
          // Raw-camera fallback is best-effort.
        }
        selectionRef.current = OFF_BACKGROUND
        setSelection(OFF_BACKGROUND)
        return false
      }
    },
    [capability, ensureProcessor, isCameraEnabled],
  )

  // Camera toggles and device switches create/replace the local track.
  useEffect(() => {
    if (!isCameraEnabled || capability !== 'supported') {
      const track = attachedTrackRef.current
      processorRef.current = null
      attachedTrackRef.current = null
      if (track) void track.stopProcessor().catch(() => undefined)
      return
    }
    void apply(selectionRef.current)
  }, [
    apply,
    cameraTrack?.track,
    capability,
    isCameraEnabled,
    selection.mode,
    selection.id,
    selection.imageUrl,
    selection.blurRadius,
  ])

  useEffect(
    () => () => {
      const track = attachedTrackRef.current
      processorRef.current = null
      attachedTrackRef.current = null
      if (track) void track.stopProcessor().catch(() => undefined)
    },
    [],
  )

  const retry = useCallback(() => apply(selectionRef.current), [apply])

  return { capability, status, selection, error, apply, retry }
}
