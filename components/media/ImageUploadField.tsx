import { useCallback, useEffect, useState } from 'react'
import { Platform } from 'react-native'

import {
  Button,
  Field,
  Icons,
  Image,
  Spinner,
  Text,
  XStack,
  YStack,
  useAppToast,
} from '~/components/ui'
import {
  pickImages,
  pickedImageToBlob,
  type PickedImage,
} from '~/lib/media/pick-image'
import { useAppUi } from '~/lib/theme/useAppUi'

type ImageUploadFieldProps = {
  label?: string
  hint?: string
  multiple?: boolean
  maxCount?: number
  value: PickedImage[]
  onChange: (images: PickedImage[]) => void
  disabled?: boolean
}

export function ImageUploadField({
  label = 'Photos',
  hint,
  multiple = false,
  maxCount = multiple ? 5 : 1,
  value,
  onChange,
  disabled = false,
}: ImageUploadFieldProps) {
  const ui = useAppUi()
  const toast = useAppToast()
  const [isPicking, setIsPicking] = useState(false)

  const canAddMore = value.length < maxCount

  const handlePick = useCallback(async () => {
    if (disabled || !canAddMore) return

    setIsPicking(true)
    try {
      const picked = await pickImages({
        multiple,
        maxCount: maxCount - value.length,
      })

      if (!picked.length) return

      onChange(multiple ? [...value, ...picked].slice(0, maxCount) : picked)
    } catch (error) {
      toast.show('Could not add photo', {
        tone: 'danger',
        message: error instanceof Error ? error.message : 'Try again.',
      })
    } finally {
      setIsPicking(false)
    }
  }, [canAddMore, disabled, maxCount, multiple, onChange, toast, value])

  function removeAt(index: number) {
    const next = value.filter((_, i) => i !== index)
    onChange(next)
  }

  return (
    <Field
      label={label}
      hint={
        hint ??
        (multiple
          ? `Add up to ${maxCount} photos. First photo is the cover image.`
          : 'Upload a square logo or cover image.')
      }
    >
      <YStack gap="$3">
        {value.length > 0 ? (
          <XStack gap="$2" flexWrap="wrap">
            {value.map((image, index) => (
              <ImagePreviewTile
                key={`${image.uri}-${index}`}
                image={image}
                isCover={index === 0}
                onRemove={() => removeAt(index)}
              />
            ))}
          </XStack>
        ) : null}

        {canAddMore ? (
          <Button
            tone="outline"
            size="$3"
            borderRadius={12}
            disabled={disabled || isPicking}
            onPress={() => void handlePick()}
            icon={isPicking ? <Spinner size="small" /> : <Icons.Upload size={18} />}
          >
            {isPicking
              ? 'Opening library…'
              : value.length > 0
                ? multiple
                  ? 'Add another photo'
                  : 'Replace photo'
                : Platform.OS === 'web'
                  ? 'Upload photo'
                  : 'Choose photo'}
          </Button>
        ) : null}
      </YStack>
    </Field>
  )
}

function ImagePreviewTile({
  image,
  isCover,
  onRemove,
}: {
  image: PickedImage
  isCover?: boolean
  onRemove: () => void
}) {
  const ui = useAppUi()

  useEffect(() => {
    return () => {
      if (Platform.OS === 'web' && image.uri.startsWith('blob:')) {
        URL.revokeObjectURL(image.uri)
      }
    }
  }, [image.uri])

  return (
    <YStack
      width={96}
      height={96}
      borderRadius={12}
      overflow="hidden"
      borderWidth={1}
      borderColor={ui.borderSubtle}
      backgroundColor={ui.surfaceMuted}
      position="relative"
    >
      <Image src={image.uri} width="100%" height="100%" objectFit="cover" alt="" />
      {isCover ? (
        <YStack
          position="absolute"
          top={6}
          left={6}
          paddingHorizontal={6}
          paddingVertical={2}
          borderRadius={999}
          backgroundColor="rgba(0,0,0,0.55)"
        >
          <Text fontSize={10} fontWeight="700" color="white">
            Cover
          </Text>
        </YStack>
      ) : null}
      <YStack
        position="absolute"
        top={4}
        right={4}
        width={28}
        height={28}
        borderRadius={999}
        alignItems="center"
        justifyContent="center"
        backgroundColor="rgba(0,0,0,0.55)"
        cursor="pointer"
        onPress={onRemove}
        aria-label="Remove photo"
      >
        <Icons.X size={14} color="white" />
      </YStack>
    </YStack>
  )
}

export async function preparePickedImagesForUpload(images: PickedImage[]) {
  const files: Array<{ blob: Blob; mimeType: string; fileName?: string }> = []

  for (const image of images) {
    const blob = await pickedImageToBlob(image)
    files.push({
      blob,
      mimeType: image.mimeType || blob.type || 'image/jpeg',
      fileName: image.fileName,
    })
  }

  return files
}
