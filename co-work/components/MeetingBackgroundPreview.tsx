import '~/lib/polyfills/install-dom-exception'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  BackgroundProcessor,
  supportsBackgroundProcessors,
  type BackgroundProcessorWrapper,
} from '@livekit/track-processors'
import { createLocalVideoTrack, type LocalVideoTrack } from 'livekit-client'

import {
  MeetingBackgroundQuickPicker,
  type MeetingBackgroundQuickCustomItem,
} from '~/co-work/components/MeetingBackgroundQuickPicker'
import { pickImagesWithCrop } from '~/lib/media/pick-and-crop'
import { clearImageCropQueue } from '~/lib/media/crop-session'
import {
  customBackgroundSelection,
  listCustomVirtualBackgrounds,
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
import { useAppToast } from '~/components/ui'

type MeetingBackgroundPreviewProps = {
  userId?: string | null
}

export function MeetingBackgroundPreview({ userId }: MeetingBackgroundPreviewProps = {}) {
  const toast = useAppToast()
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const trackRef = useRef<LocalVideoTrack | null>(null)
  const processorRef = useRef<BackgroundProcessorWrapper | null>(null)
  const effectsAvailableRef = useRef(false)
  const [selection, setSelection] = useState<VirtualBackgroundSelection>(OFF_BACKGROUND)
  const [busy, setBusy] = useState(true)
  const [uploadBusy, setUploadBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [effectsAvailable, setEffectsAvailable] = useState(true)
  const [customs, setCustoms] = useState<MeetingBackgroundQuickCustomItem[]>([])

  const refreshCustoms = useCallback(async () => {
    if (!userId) {
      setCustoms([])
      return
    }
    try {
      const rows = await listCustomVirtualBackgrounds(userId)
      const items: MeetingBackgroundQuickCustomItem[] = []
      for (const row of rows) {
        try {
          const resolved = await resolveVirtualBackgroundSelection(customBackgroundSelection(row))
          items.push({
            id: row.id,
            name: row.name || 'Custom',
            imageUri: resolved.imageUrl,
            selection: {
              ...customBackgroundSelection(row),
              imageUrl: resolved.imageUrl,
            },
          })
        } catch {
          items.push({
            id: row.id,
            name: row.name || 'Custom',
            selection: customBackgroundSelection(row),
          })
        }
      }
      setCustoms(items)
    } catch {
      // Library load is best-effort on the lobby.
    }
  }, [userId])

  const apply = useCallback(async (value: VirtualBackgroundSelection) => {
    const next = await resolveVirtualBackgroundSelection(normalizeVirtualBackground(value))
    setSelection(next)
    await saveVirtualBackgroundPreference(next)

    if (!effectsAvailableRef.current && next.mode !== 'off') {
      setError(
        'Preview effects are unavailable in this browser. Your selection is saved and will apply when you join.',
      )
      setBusy(false)
      return
    }

    const processor = processorRef.current
    if (!processor) {
      setBusy(false)
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
    } catch (cause) {
      try {
        await processor.switchTo({ mode: 'disabled' })
      } catch {
        // Keep the ordinary camera preview even if cleanup fails.
      }
      setError(
        cause instanceof Error
          ? cause.message
          : 'Could not preview this background. It is still saved for when you join.',
      )
    } finally {
      setBusy(false)
    }
  }, [])

  const upload = useCallback(async () => {
    if (!userId) {
      setError('Sign in to upload a custom background.')
      toast.show('Sign in required', { tone: 'danger', message: 'Sign in to upload a background.' })
      return
    }
    clearImageCropQueue()
    try {
      const picked = await pickImagesWithCrop({
        multiple: false,
        maxCount: 1,
        aspect: [16, 9],
        skipCrop: true,
        allowsEditing: false,
      })
      const image = picked[0]
      if (!image?.uri) {
        // User cancelled the picker — stay quiet.
        return
      }
      setUploadBusy(true)
      setError(null)
      const created = await uploadCustomVirtualBackground(userId, image)
      const selectionValue = customBackgroundSelection(created)
      setCustoms((prev) => {
        const nextItem: MeetingBackgroundQuickCustomItem = {
          id: created.id,
          name: created.name || 'Custom',
          imageUri: created.localUri ?? selectionValue.imageUrl,
          selection: selectionValue,
        }
        return [nextItem, ...prev.filter((row) => row.id !== created.id)]
      })
      await apply(selectionValue)
      void refreshCustoms()
      toast.show('Background applied', {
        tone: 'success',
        message: 'Your custom image is ready for this meeting.',
      })
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Could not upload this background.'
      setError(message)
      toast.show('Upload failed', { tone: 'danger', message })
    } finally {
      setUploadBusy(false)
    }
  }, [apply, refreshCustoms, toast, userId])

  useEffect(() => {
    clearImageCropQueue()
    void refreshCustoms()
  }, [refreshCustoms])

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
        if (!cancelled) setBusy(false)

        if (!supported) {
          setError(
            resourceWarning ||
              'Preview effects are unavailable in this browser. You can still upload an image — it will apply when you join.',
          )
          const saved = await loadVirtualBackgroundPreference()
          if (!cancelled) {
            setSelection(normalizeVirtualBackground(saved))
            await saveVirtualBackgroundPreference(normalizeVirtualBackground(saved))
          }
          return
        }

        try {
          const processor = BackgroundProcessor({ mode: 'disabled', maxFps: 15 })
          await track.setProcessor(processor)
          processorRef.current = processor
          const saved = await loadVirtualBackgroundPreference()
          if (!cancelled) await apply(saved)
        } catch (cause) {
          effectsAvailableRef.current = false
          if (!cancelled) {
            setEffectsAvailable(false)
            setError(
              cause instanceof Error
                ? cause.message
                : 'Background effects failed to start. You can still upload — it will apply when you join.',
            )
            setBusy(false)
          }
        }
      } catch (cause) {
        if (!cancelled) {
          setError(cause instanceof Error ? cause.message : 'Could not start camera preview.')
          setBusy(false)
        }
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

  const previewImageUri =
    selection.mode === 'image' && selection.imageUrl ? selection.imageUrl : null

  return (
    <MeetingBackgroundQuickPicker
      selection={selection}
      busy={busy}
      error={error}
      effectsAvailable={effectsAvailable}
      onSelect={(value) => void apply(value)}
      onUpload={userId ? () => void upload() : undefined}
      uploadBusy={uploadBusy}
      customItems={customs}
      selectedImageUri={previewImageUri}
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
