import { useState } from 'react'
import { Image, Platform } from 'react-native'

import { Button, Icons, Spinner, Text, XStack, YStack, useAppToast } from '~/components/ui'
import { pickedImageToBlob, type PickedImage } from '~/lib/media/pick-image'
import { captureImageWithCrop, cropIfNeeded, pickImagesWithCrop } from '~/lib/media/pick-and-crop'
import { uploadImage } from '~/lib/profile/profile.service'
import { MediaDropZone } from '~/components/media/MediaDropZone'
import { UploadProgressBar } from '~/components/media/UploadProgressBar'
import { useUploadProgress } from '~/hooks/useUploadProgress'
import { useAppUi } from '~/lib/theme/useAppUi'

type AvatarCaptureFieldProps = {
  userId: string
  avatarUrl: string | null
  onUploaded: (url: string) => void
  disabled?: boolean
}

/**
 * Avatar picker for onboarding — library on all platforms, camera on native,
 * drag-and-drop on web.
 */
export function AvatarCaptureField({
  userId,
  avatarUrl,
  onUploaded,
  disabled = false,
}: AvatarCaptureFieldProps) {
  const ui = useAppUi()
  const toast = useAppToast()
  const [busy, setBusy] = useState<'library' | 'camera' | 'drop' | null>(null)
  const { progress: uploadProgress, track: trackUpload, reset: resetUpload } = useUploadProgress()

  async function uploadPicked(uri: string, mimeType: string, fileName?: string) {
    const blob = await pickedImageToBlob({ uri, mimeType, fileName })
    trackUpload(1)
    const result = await uploadImage(
      userId,
      { blob, mimeType: mimeType || 'image/jpeg', fileName },
      'avatar',
      { onProgress: trackUpload },
    )
    if (result.error || !result.data?.avatar_url) {
      throw new Error(result.error ?? 'Upload failed.')
    }
    onUploaded(result.data.avatar_url)
  }

  async function handleDropped(items: PickedImage[]) {
    const image = items[0]
    if (!image || disabled || busy) return
    setBusy('drop')
    try {
      const cropped = await cropIfNeeded(image, 'avatar', { cropTitle: 'Profile photo' })
      if (!cropped) return
      await uploadPicked(cropped.uri, cropped.mimeType, cropped.fileName)
      toast.show('Photo updated', { tone: 'success' })
    } catch (error) {
      toast.show('Could not update photo', {
        tone: 'danger',
        message: error instanceof Error ? error.message : 'Try again.',
      })
    } finally {
      setBusy(null)
      resetUpload()
    }
  }

  async function handleLibrary() {
    if (disabled || busy) return
    setBusy('library')
    try {
      const picked = await pickImagesWithCrop({
        multiple: false,
        maxCount: 1,
        aspect: 'avatar',
        cropTitle: 'Profile photo',
      })
      const image = picked[0]
      if (!image) return
      await uploadPicked(image.uri, image.mimeType, image.fileName)
      toast.show('Photo updated', { tone: 'success' })
    } catch (error) {
      toast.show('Could not update photo', {
        tone: 'danger',
        message: error instanceof Error ? error.message : 'Try again.',
      })
    } finally {
      setBusy(null)
      resetUpload()
    }
  }

  async function handleCamera() {
    if (disabled || busy || Platform.OS === 'web') return
    setBusy('camera')
    try {
      const shot = await captureImageWithCrop({
        aspect: 'avatar',
        cropTitle: 'Profile photo',
      })
      if (!shot) return
      await uploadPicked(shot.uri, shot.mimeType, shot.fileName)
      toast.show('Photo updated', { tone: 'success' })
    } catch (error) {
      toast.show('Could not take photo', {
        tone: 'danger',
        message: error instanceof Error ? error.message : 'Try again.',
      })
    } finally {
      setBusy(null)
      resetUpload()
    }
  }

  return (
    <MediaDropZone
      disabled={disabled || !!busy}
      accept="image"
      maxCount={1}
      label="Drop a profile photo"
      onDrop={(items) => void handleDropped(items)}
    >
      <XStack gap="$3" alignItems="center">
        {avatarUrl ? (
          <Image
            source={{ uri: avatarUrl }}
            style={{ width: 72, height: 72, borderRadius: 36 }}
            accessibilityLabel="Profile photo"
          />
        ) : (
          <YStack
            width={72}
            height={72}
            borderRadius={36}
            backgroundColor={ui.surfaceMuted}
            alignItems="center"
            justifyContent="center"
          >
            <Icons.User size={30} color={ui.textMuted} />
          </YStack>
        )}
        <YStack flex={1} gap="$2">
          <Text fontWeight="600" color={ui.text}>
            {avatarUrl ? 'Photo ready' : 'Add a profile photo'}
          </Text>
          {Platform.OS === 'web' ? (
            <Text fontSize={12} color={ui.textMuted}>
              Drag & drop a photo, or choose below
            </Text>
          ) : null}
          <XStack gap="$2" flexWrap="wrap">
            <Button
              tone="outline"
              size="$2"
              borderRadius={999}
              disabled={disabled || !!busy}
              onPress={() => void handleLibrary()}
              icon={busy === 'library' || busy === 'drop' ? <Spinner size="small" /> : <Icons.Image size={16} />}
              accessibilityLabel="Choose photo from library"
            >
              {busy === 'library' || busy === 'drop' ? 'Uploading…' : 'Choose photo'}
            </Button>
            {Platform.OS !== 'web' ? (
              <Button
                tone="outline"
                size="$2"
                borderRadius={999}
                disabled={disabled || !!busy}
                onPress={() => void handleCamera()}
                icon={busy === 'camera' ? <Spinner size="small" /> : <Icons.Camera size={16} />}
                accessibilityLabel="Take a photo with camera"
              >
                {busy === 'camera' ? 'Opening…' : 'Take photo'}
              </Button>
            ) : null}
          </XStack>
          {uploadProgress != null && uploadProgress > 0 ? (
            <UploadProgressBar progress={uploadProgress} label="Uploading photo…" compact />
          ) : null}
        </YStack>
      </XStack>
    </MediaDropZone>
  )
}
