import { useState } from 'react'
import { Image, Platform } from 'react-native'

import { Button, Icons, Spinner, Text, XStack, YStack, useAppToast } from '~/components/ui'
import { captureImage, pickImages, pickedImageToBlob } from '~/lib/media/pick-image'
import { uploadImage } from '~/lib/profile/profile.service'
import { useAppUi } from '~/lib/theme/useAppUi'

type AvatarCaptureFieldProps = {
  userId: string
  avatarUrl: string | null
  onUploaded: (url: string) => void
  disabled?: boolean
}

/**
 * Avatar picker for onboarding — library on all platforms, camera on native.
 */
export function AvatarCaptureField({
  userId,
  avatarUrl,
  onUploaded,
  disabled = false,
}: AvatarCaptureFieldProps) {
  const ui = useAppUi()
  const toast = useAppToast()
  const [busy, setBusy] = useState<'library' | 'camera' | null>(null)

  async function uploadPicked(uri: string, mimeType: string, fileName?: string) {
    const blob = await pickedImageToBlob({ uri, mimeType, fileName })
    const result = await uploadImage(
      userId,
      { blob, mimeType: mimeType || 'image/jpeg', fileName },
      'avatar',
    )
    if (result.error || !result.data?.avatar_url) {
      throw new Error(result.error ?? 'Upload failed.')
    }
    onUploaded(result.data.avatar_url)
  }

  async function handleLibrary() {
    if (disabled || busy) return
    setBusy('library')
    try {
      const picked = await pickImages({ multiple: false, maxCount: 1 })
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
    }
  }

  async function handleCamera() {
    if (disabled || busy || Platform.OS === 'web') return
    setBusy('camera')
    try {
      const shot = await captureImage()
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
    }
  }

  return (
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
        <XStack gap="$2" flexWrap="wrap">
          <Button
            tone="outline"
            size="$2"
            borderRadius={999}
            disabled={disabled || !!busy}
            onPress={() => void handleLibrary()}
            icon={busy === 'library' ? <Spinner size="small" /> : <Icons.Image size={16} />}
            accessibilityLabel="Choose photo from library"
          >
            {busy === 'library' ? 'Opening…' : 'Choose photo'}
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
      </YStack>
    </XStack>
  )
}
