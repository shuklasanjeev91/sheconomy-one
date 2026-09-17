import '~/lib/polyfills/install-dom-exception'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createLocalVideoTrack, type LocalVideoTrack } from 'livekit-client'
import { MediaStream, RTCView } from '@livekit/react-native-webrtc'

import MeetingVideoEffectsNative from '~/modules/meeting-video-effects'
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
  type VirtualBackgroundSelection,
} from '~/co-work/lib/virtual-backgrounds'
import { ensureLiveKitGlobals } from '~/lib/livekit/ensure-globals'
import { useAppToast } from '~/components/ui'

ensureLiveKitGlobals()

type NativeEffectTrack = MediaStreamTrack & {
  _setVideoEffects(names: string[]): void
}

type MeetingBackgroundPreviewProps = {
  userId?: string | null
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export function MeetingBackgroundPreview({ userId }: MeetingBackgroundPreviewProps = {}) {
  const toast = useAppToast()
  const trackRef = useRef<LocalVideoTrack | null>(null)
  const effectsSupportedRef = useRef(false)
  const [streamUrl, setStreamUrl] = useState<string | null>(null)
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
      // Library load is best-effort on the join screen.
    }
  }, [userId])

  const applyNativeEffect = useCallback(async (next: VirtualBackgroundSelection) => {
    const track = trackRef.current?.mediaStreamTrack as NativeEffectTrack | undefined
    if (!track || typeof track._setVideoEffects !== 'function') return false
    if (!effectsSupportedRef.current) return false

    // Bounce the processor so a new imagePath always reloads (native caches by path).
    track._setVideoEffects([])
    await sleep(30)
    MeetingVideoEffectsNative?.configure({
      mode: next.mode,
      imagePath: next.imageUrl,
      blurRadius: next.blurRadius,
    })
    track._setVideoEffects(next.mode === 'off' ? [] : ['sheconomyVirtualBackground'])
    return true
  }, [])

  const apply = useCallback(
    async (value: VirtualBackgroundSelection) => {
      const next = await resolveVirtualBackgroundSelection(normalizeVirtualBackground(value))
      setSelection(next)
      await saveVirtualBackgroundPreference(next)

      if (!effectsSupportedRef.current && next.mode !== 'off') {
        setError(
          'Preview effects need the latest app build. Your selection is saved and will apply when you join.',
        )
        setBusy(false)
        return
      }

      setBusy(true)
      setError(null)
      try {
        const ok = await applyNativeEffect(next)
        if (!ok && next.mode !== 'off') {
          setError(
            'Could not preview this background on camera yet. It is saved and will apply when you join.',
          )
        }
      } catch (cause) {
        try {
          const track = trackRef.current?.mediaStreamTrack as NativeEffectTrack | undefined
          track?._setVideoEffects?.([])
        } catch {
          // Keep ordinary camera preview.
        }
        setError(
          cause instanceof Error
            ? cause.message
            : 'Could not preview this background. It is still saved for when you join.',
        )
      } finally {
        setBusy(false)
      }
    },
    [applyNativeEffect],
  )

  const upload = useCallback(async () => {
    if (!userId) {
      setError('Sign in to upload a custom background.')
      toast.show('Sign in required', { tone: 'danger', message: 'Sign in to upload a background.' })
      return
    }
    // Never leave a stale crop sheet covering the join preview.
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
      // Optimistic tile so the user sees the new image immediately.
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
        try {
          effectsSupportedRef.current = !!MeetingVideoEffectsNative?.isSupported()
          if (effectsSupportedRef.current) MeetingVideoEffectsNative?.registerProcessor()
        } catch {
          effectsSupportedRef.current = false
        }
        if (!cancelled) setEffectsAvailable(effectsSupportedRef.current)

        const track = await createLocalVideoTrack({
          resolution: { width: 640, height: 360, frameRate: 15 },
        })
        if (cancelled) {
          track.stop()
          return
        }
        trackRef.current = track
        const stream = new MediaStream([track.mediaStreamTrack as never])
        setStreamUrl(stream.toURL())
        setBusy(false)

        const saved = await loadVirtualBackgroundPreference()
        if (!cancelled) await apply(saved)
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
      trackRef.current = null
      effectsSupportedRef.current = false
      try {
        ;(track?.mediaStreamTrack as NativeEffectTrack | undefined)?._setVideoEffects([])
      } catch {
        // Track may already be closed.
      }
      track?.stop()
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
        streamUrl ? (
          <RTCView
            streamURL={streamUrl}
            objectFit="cover"
            mirror
            style={{ width: '100%', height: '100%' }}
          />
        ) : null
      }
    />
  )
}
