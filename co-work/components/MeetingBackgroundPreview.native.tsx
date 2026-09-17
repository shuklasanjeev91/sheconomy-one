import '~/lib/polyfills/install-dom-exception'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createLocalVideoTrack, type LocalVideoTrack } from 'livekit-client'
import { MediaStream, RTCView } from '@livekit/react-native-webrtc'

import MeetingVideoEffectsNative from '~/modules/meeting-video-effects'
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

  const apply = useCallback(async (value: VirtualBackgroundSelection) => {
    const next = await resolveVirtualBackgroundSelection(normalizeVirtualBackground(value))
    const track = trackRef.current?.mediaStreamTrack as NativeEffectTrack | undefined
    if (!track) return
    if (!effectsSupportedRef.current && next.mode !== 'off') {
      setError('Virtual backgrounds require the latest app build. Camera preview is still active.')
      setSelection(OFF_BACKGROUND)
      await saveVirtualBackgroundPreference(OFF_BACKGROUND)
      return
    }
    setBusy(true)
    setError(null)
    try {
      if (effectsSupportedRef.current) {
        MeetingVideoEffectsNative?.configure({
          mode: next.mode,
          imagePath: next.imageUrl,
          blurRadius: next.blurRadius,
        })
        if (typeof track._setVideoEffects === 'function') {
          track._setVideoEffects(next.mode === 'off' ? [] : ['sheconomyVirtualBackground'])
        }
      }
      setSelection(next)
      await saveVirtualBackgroundPreference(next)
    } catch (cause) {
      try {
        if (typeof track._setVideoEffects === 'function') track._setVideoEffects([])
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
    if (!effectsSupportedRef.current) {
      setError('Virtual backgrounds require the latest app build. Camera preview is still active.')
      return
    }
    const picked = await pickImagesWithCrop({
      multiple: false,
      maxCount: 1,
      aspect: [16, 9],
      cropTitle: 'Crop virtual background',
    })
    const image = picked[0]
    if (!image) return
    setUploadBusy(true)
    setError(null)
    try {
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
        if (effectsSupportedRef.current) {
          const saved = await loadVirtualBackgroundPreference()
          await apply(saved)
        } else {
          setError(
            'Virtual backgrounds require the latest app build. Camera preview is still active.',
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
