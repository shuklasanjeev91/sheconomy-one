import '~/lib/polyfills/install-dom-exception'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  BackgroundProcessor,
  supportsBackgroundProcessors,
  type BackgroundProcessorWrapper,
} from '@livekit/track-processors'
import { createLocalVideoTrack, type LocalVideoTrack } from 'livekit-client'

import { MeetingBackgroundQuickPicker } from '~/co-work/components/MeetingBackgroundQuickPicker'
import {
  loadVirtualBackgroundPreference,
  normalizeVirtualBackground,
  saveVirtualBackgroundPreference,
  type VirtualBackgroundSelection,
  OFF_BACKGROUND,
} from '~/co-work/lib/virtual-backgrounds'
import { resolveVirtualBackgroundSelection } from '~/co-work/lib/virtual-background-storage'

export function MeetingBackgroundPreview() {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const trackRef = useRef<LocalVideoTrack | null>(null)
  const processorRef = useRef<BackgroundProcessorWrapper | null>(null)
  const [selection, setSelection] = useState<VirtualBackgroundSelection>(OFF_BACKGROUND)
  const [busy, setBusy] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const apply = useCallback(async (value: VirtualBackgroundSelection) => {
    const next = await resolveVirtualBackgroundSelection(normalizeVirtualBackground(value))
    const processor = processorRef.current
    if (!processor) return
    setBusy(true)
    setError(null)
    try {
      if (next.mode === 'blur') {
        await processor.switchTo({ mode: 'background-blur', blurRadius: next.blurRadius })
      } else if (next.mode === 'image' && next.imageUrl) {
        await processor.switchTo({ mode: 'virtual-background', imagePath: next.imageUrl })
      } else {
        await processor.switchTo({ mode: 'disabled' })
      }
      setSelection(next)
      await saveVirtualBackgroundPreference(next)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not preview this background.')
    } finally {
      setBusy(false)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        if (!supportsBackgroundProcessors()) {
          throw new Error('Background effects are unavailable in this browser.')
        }
        const track = await createLocalVideoTrack({
          resolution: { width: 640, height: 360, frameRate: 15 },
        })
        if (cancelled) {
          track.stop()
          return
        }
        trackRef.current = track
        const processor = BackgroundProcessor({ mode: 'disabled', maxFps: 15 })
        await track.setProcessor(processor)
        processorRef.current = processor
        if (videoRef.current) track.attach(videoRef.current)
        const saved = await loadVirtualBackgroundPreference()
        await apply(saved)
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'Could not start camera preview.')
        setBusy(false)
      }
    })()
    return () => {
      cancelled = true
      const track = trackRef.current
      processorRef.current = null
      trackRef.current = null
      if (track) {
        track.detach()
        void track.stopProcessor().catch(() => undefined)
        track.stop()
      }
    }
  }, [apply])

  return (
    <MeetingBackgroundQuickPicker
      selection={selection}
      busy={busy}
      error={error}
      onSelect={(value) => void apply(value)}
      preview={
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }}
        />
      }
    />
  )
}
