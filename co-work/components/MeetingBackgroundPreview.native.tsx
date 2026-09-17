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

ensureLiveKitGlobals()

type NativeEffectTrack = MediaStreamTrack & {
  _setVideoEffects(names: string[]): void
}

type MeetingBackgroundPreviewProps = {
  userId?: string | null
}

export function MeetingBackgroundPreview({ userId }: MeetingBackgroundPreviewProps = {}) {
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
      // Library load is best-effort on the lobby.
    }
  }, [userId])

  const apply = useCallback(async (value: VirtualBackgroundSelection) => {
    const next = await resolveVirtualBackgroundSelection(normalizeVirtualBackground(value))
    const track = trackRef.current?.mediaStreamTrack as NativeEffectTrack | undefined

    // Always persist — Join Now must remember the choice even if preview effects
    // are offline on this build/device.
    setSelection(next)
    await saveVirtualBackgroundPreference(next)

    if (!effectsSupportedRef.current && next.mode !== 'off') {
      setError(
        'Preview effects need the latest app build. Your selection is saved and will apply when you join.',
      )
      setBusy(false)
      return
    }
    if (!track) {
      setBusy(false)
      return
    }

    setBusy(true)
    setError(null)
    try {
      MeetingVideoEffectsNative?.configure({
        mode: next.mode,
        imagePath: next.imageUrl,
        blurRadius: next.blurRadius,
      })
      if (typeof track._setVideoEffects === 'function') {
        track._setVideoEffects(next.mode === 'off' ? [] : ['sheconomyVirtualBackground'])
      }
    } catch (cause) {
      try {
        if (typeof track._setVideoEffects === 'function') track._setVideoEffects([])
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
      return
    }
    try {
      // Skip in-app crop on the lobby — OS picker is enough; ImageManipulator resizes.
      // allowsEditing:false avoids empty iPad picker results after the system crop UI.
      const picked = await pickImagesWithCrop({
        multiple: false,
        maxCount: 1,
        aspect: [16, 9],
        skipCrop: true,
        allowsEditing: false,
        cropTitle: 'Crop virtual background',
      })
      const image = picked[0]
      if (!image) {
        setError('No image selected. Pick a photo from your library to use as a background.')
        return
      }
      setUploadBusy(true)
      setError(null)
      const created = await uploadCustomVirtualBackground(userId, image)
      await refreshCustoms()
      await apply(customBackgroundSelection(created))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not upload this background.')
    } finally {
      setUploadBusy(false)
    }
  }, [apply, refreshCustoms, userId])

  useEffect(() => {
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
        if (!effectsSupportedRef.current && !cancelled) {
          setError(
            'Preview effects need the latest app build. You can still upload an image — it will apply when you join.',
          )
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
