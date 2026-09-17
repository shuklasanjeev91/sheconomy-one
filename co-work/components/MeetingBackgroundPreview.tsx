import '~/lib/polyfills/install-dom-exception'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  BackgroundProcessor,
  supportsBackgroundProcessors,
  type BackgroundProcessorWrapper,
} from '@livekit/track-processors'
import { createLocalVideoTrack, type LocalVideoTrack } from 'livekit-client'

import { MeetingBackgroundQuickPicker } from '~/co-work/components/MeetingBackgroundQuickPicker'
import { pickImagesWithCrop } from '~/lib/media/pick-and-crop'
import {
  customBackgroundSelection,
  resolveVirtualBackgroundSelection,
  uploadCustomVirtualBackground,
} from '~/co-work/lib/virtual-background-storage'
import {
  loadVirtualBackgroundPreference,
  normalizeVirtualBackground,
  OFF_BACKGROUND,
  saveVirtualBackgroundPreference,
  webBackgroundResourceWarning,
  type VirtualBackgroundSelection,
} from '~/co-work/lib/virtual-backgrounds'

type MeetingBackgroundPreviewProps = {
  userId?: string | null
}

export function MeetingBackgroundPreview({ userId }: MeetingBackgroundPreviewProps = {}) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const trackRef = useRef<LocalVideoTrack | null>(null)
  const processorRef = useRef<BackgroundProcessorWrapper | null>(null)
  const effectsAvailableRef = useRef(false)
  const [selection, setSelection] = useState<VirtualBackgroundSelection>(OFF_BACKGROUND)
  const [busy, setBusy] = useState(true)
  const [uploadBusy, setUploadBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [effectsAvailable, setEffectsAvailable] = useState(true)

  const apply = useCallback(async (value: VirtualBackgroundSelection) => {
    const next = await resolveVirtualBackgroundSelection(normalizeVirtualBackground(value))
    if (!effectsAvailableRef.current && next.mode !== 'off') {
      setError(
        'Background effects are unavailable in this browser. Camera preview is still active.',
      )
      setSelection(OFF_BACKGROUND)
      await saveVirtualBackgroundPreference(OFF_BACKGROUND)
      return
    }
    const processor = processorRef.current
    if (!processor) {
      // Camera-only preview (unsupported processors) still remembers "None".
      if (next.mode === 'off') {
        setSelection(OFF_BACKGROUND)
        await saveVirtualBackgroundPreference(OFF_BACKGROUND)
      }
      return
    }
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
      try {
        await processor.switchTo({ mode: 'disabled' })
      } catch {
        // Keep the ordinary camera preview even if cleanup fails.
      }
      setSelection(OFF_BACKGROUND)
      await saveVirtualBackgroundPreference(OFF_BACKGROUND)
      setError(cause instanceof Error ? cause.message : 'Could not preview this background.')
    } finally {
      setBusy(false)
    }
  }, [])

  const upload = useCallback(async () => {
    if (!userId) return
    if (!effectsAvailableRef.current) {
      setError(
        'Background effects are unavailable in this browser. Camera preview is still active.',
      )
      return
    }
    try {
      const picked = await pickImagesWithCrop({
        multiple: false,
        maxCount: 1,
        aspect: [16, 9],
        skipCrop: true,
        allowsEditing: true,
        cropTitle: 'Crop virtual background',
      })
      const image = picked[0]
      if (!image) {
        setError('No image selected. Pick a photo to upload as a background.')
        return
      }
      setUploadBusy(true)
      setError(null)
      const created = await uploadCustomVirtualBackground(userId, image)
      await apply(customBackgroundSelection(created))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not upload this background.')
    } finally {
      setUploadBusy(false)
    }
  }, [apply, userId])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const resourceWarning =
          typeof navigator === 'undefined'
            ? null
            : webBackgroundResourceWarning(navigator as Navigator & { deviceMemory?: number })
        const supported = !resourceWarning && supportsBackgroundProcessors()
        effectsAvailableRef.current = supported
        if (!cancelled) setEffectsAvailable(supported)

        const track = await createLocalVideoTrack({
          resolution: { width: 640, height: 360, frameRate: 15 },
        })
        if (cancelled) {
          track.stop()
          return
        }
        trackRef.current = track
        if (videoRef.current) track.attach(videoRef.current)

        if (!supported) {
          setError(
            resourceWarning ||
              'Background effects are unavailable in this browser. Camera preview is still active.',
          )
          setBusy(false)
          return
        }

        try {
          const processor = BackgroundProcessor({ mode: 'disabled', maxFps: 15 })
          await track.setProcessor(processor)
          processorRef.current = processor
          const saved = await loadVirtualBackgroundPreference()
          await apply(saved)
        } catch (cause) {
          effectsAvailableRef.current = false
          if (!cancelled) setEffectsAvailable(false)
          setError(
            cause instanceof Error
              ? cause.message
              : 'Background effects failed to start. Camera preview is still active.',
          )
          setBusy(false)
        }
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
      effectsAvailableRef.current = false
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
      effectsAvailable={effectsAvailable}
      onSelect={(value) => void apply(value)}
      onUpload={userId ? () => void upload() : undefined}
      uploadBusy={uploadBusy}
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
