import { useCallback, useState } from 'react'
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
  pickMedia,
  pickedImageToBlob,
  type PickedImage,
} from '~/lib/media/pick-image'
import {
  captureImageWithCrop,
  cropManyIfNeeded,
  pickImagesWithCrop,
} from '~/lib/media/pick-and-crop'
import type { MediaAspectPreset, AspectRatioTuple } from '~/lib/media/aspect'
import { MediaDropZone } from '~/components/media/MediaDropZone'
import { UploadProgressBar } from '~/components/media/UploadProgressBar'
import type { MediaDropAccept } from '~/lib/media/files-from-data-transfer'
import {
  browseButtonLabel,
  dropHintLabel,
  pickMediaErrorLabel,
} from '~/lib/media/media-accept'
import { useAppUi } from '~/lib/theme/useAppUi'

type ImageUploadFieldProps = {
  label?: string
  hint?: string
  multiple?: boolean
  maxCount?: number
  value: PickedImage[]
  onChange: (images: PickedImage[]) => void
  disabled?: boolean
  /** Show native camera affordance (ignored on web or when multiple). */
  allowCamera?: boolean
  /** Byte-level upload progress (0–100) while a parent form is uploading. */
  uploadProgress?: number | null
  uploadLabel?: string
  /** What file types the drop zone accepts (default images). */
  accept?: MediaDropAccept
  /** Crop aspect for image picks (square, cover, 16:9, …). */
  aspect?: MediaAspectPreset | AspectRatioTuple | null
  /** Skip crop sheet even when aspect is set. */
  skipCrop?: boolean
  /** How previews fit their container (default cover). */
  previewObjectFit?: 'cover' | 'contain'
}

export function ImageUploadField({
  label = 'Photos',
  hint,
  multiple = false,
  maxCount = multiple ? 5 : 1,
  value,
  onChange,
  disabled = false,
  allowCamera = false,
  uploadProgress = null,
  uploadLabel = 'Uploading…',
  accept = 'image',
  aspect = null,
  skipCrop = false,
  previewObjectFit = 'cover',
}: ImageUploadFieldProps) {
  const ui = useAppUi()
  const toast = useAppToast()
  const [isPicking, setIsPicking] = useState(false)

  const canAddMore = value.length < maxCount
  const showCamera = allowCamera && !multiple && Platform.OS !== 'web'
  const isWeb = Platform.OS === 'web'
  const slotsLeft = Math.max(0, maxCount - value.length)

  const dropTargetLabel =
    accept === 'video'
      ? 'a video'
      : accept === 'media'
        ? 'photos or videos'
        : accept === 'any'
          ? 'files'
          : multiple
            ? 'photos'
            : 'a photo'

  const browseLabel = browseButtonLabel(accept, {
    hasValue: value.length > 0,
    multiple,
    isWeb,
  })

  const mergeDropped = useCallback(
    async (picked: PickedImage[]) => {
      if (!picked.length || disabled) return
      const isImageOnly = accept === 'image' || !accept
      const nextItems =
        isImageOnly && aspect && !skipCrop
          ? await cropManyIfNeeded(picked, aspect, { cropTitle: label })
          : picked
      if (!nextItems.length) return
      if (multiple) {
        onChange([...value, ...nextItems].slice(0, maxCount))
      } else {
        value.forEach((item) => {
          if (Platform.OS === 'web' && item.uri.startsWith('blob:')) {
            URL.revokeObjectURL(item.uri)
          }
        })
        onChange(nextItems.slice(0, 1))
      }
    },
    [accept, aspect, disabled, label, maxCount, multiple, onChange, skipCrop, value],
  )

  const handlePick = useCallback(async () => {
    if (disabled || !canAddMore) return

    setIsPicking(true)
    try {
      const slots = maxCount - value.length
      let picked: PickedImage[] = []

      if (accept === 'image' || !accept) {
        picked = await pickImagesWithCrop({
          multiple,
          maxCount: slots,
          aspect,
          skipCrop,
          cropTitle: label,
        })
      } else {
        picked = await pickMedia({
          accept,
          multiple,
          maxCount: slots,
        })
        if (aspect && !skipCrop) {
          const images = picked.filter((item) => !item.mimeType?.startsWith('video/'))
          const videos = picked.filter((item) => item.mimeType?.startsWith('video/'))
          const croppedImages = await cropManyIfNeeded(images, aspect, {
            cropTitle: label,
          })
          picked = [...croppedImages, ...videos]
        }
      }

      if (!picked.length) return

      if (!multiple) {
        value.forEach(revokeWebBlobUrl)
      }
      onChange(multiple ? [...value, ...picked].slice(0, maxCount) : picked)
    } catch (error) {
      toast.show(pickMediaErrorLabel(accept), {
        tone: 'danger',
        message: error instanceof Error ? error.message : 'Try again.',
      })
    } finally {
      setIsPicking(false)
    }
  }, [
    accept,
    aspect,
    canAddMore,
    disabled,
    label,
    maxCount,
    multiple,
    onChange,
    skipCrop,
    toast,
    value,
  ])

  const handleCamera = useCallback(async () => {
    if (disabled || !canAddMore || !showCamera) return
    setIsPicking(true)
    try {
      const shot = await captureImageWithCrop({
        aspect: aspect ?? 'square',
        skipCrop,
        cropTitle: label,
      })
      if (!shot) return
      onChange([shot])
    } catch (error) {
      toast.show('Could not take photo', {
        tone: 'danger',
        message: error instanceof Error ? error.message : 'Try again.',
      })
    } finally {
      setIsPicking(false)
    }
  }, [aspect, canAddMore, disabled, label, onChange, showCamera, skipCrop, toast])

  function removeAt(index: number) {
    const removed = value[index]
    if (removed) revokeWebBlobUrl(removed)
    const next = value.filter((_, i) => i !== index)
    onChange(next)
  }

  const dropHint =
    Platform.OS === 'web' ? dropHintLabel(accept, multiple, maxCount) : undefined

  const defaultHint =
    accept === 'video'
      ? multiple
        ? `Add up to ${maxCount} videos.`
        : 'Upload a video.'
      : accept === 'media'
        ? multiple
          ? `Add up to ${maxCount} photos or videos.`
          : 'Upload a photo or video.'
        : accept === 'any'
          ? multiple
            ? `Add up to ${maxCount} files.`
            : 'Upload a file.'
          : multiple
            ? `Add up to ${maxCount} photos. First photo is the cover image.`
            : 'Upload a square logo or cover image.'

  return (
    <Field
      label={label}
      hint={hint ?? dropHint ?? defaultHint}
    >
      <MediaDropZone
        disabled={disabled || !canAddMore}
        accept={accept}
        multiple={multiple}
        maxCount={slotsLeft || 1}
        onDrop={(items) => {
          void mergeDropped(items)
        }}
        label={
          accept === 'video'
            ? 'Drop video here'
            : accept === 'media'
              ? 'Drop photos or videos here'
              : multiple
                ? 'Drop photos here'
                : 'Drop photo here'
        }
        minHeight={value.length === 0 && isWeb ? 120 : undefined}
      >
        <YStack gap="$3" padding={value.length === 0 && isWeb ? '$3' : 0}>
          {value.length > 0 ? (
            <XStack gap="$2" flexWrap="wrap" width={previewObjectFit === 'contain' && !multiple ? '100%' : undefined}>
              {value.map((image, index) => (
                <ImagePreviewTile
                  key={`${image.uri}-${index}`}
                  image={image}
                  isCover={index === 0 && multiple}
                  objectFit={previewObjectFit}
                  responsive={previewObjectFit === 'contain' && !multiple}
                  onRemove={() => removeAt(index)}
                />
              ))}
            </XStack>
          ) : isWeb ? (
            <YStack
              alignItems="center"
              justifyContent="center"
              gap="$2"
              minHeight={88}
              borderRadius={12}
              borderWidth={1}
              borderStyle="dashed"
              borderColor={ui.borderSubtle}
              backgroundColor={ui.surfaceMuted}
              paddingVertical="$4"
              paddingHorizontal="$3"
              cursor={disabled || isPicking ? 'default' : 'pointer'}
              onPress={disabled || isPicking ? undefined : () => void handlePick()}
            >
              {isPicking ? (
                <Spinner size="small" />
              ) : (
                <Icons.Upload size={22} color={ui.textMuted} />
              )}
              <Text fontSize={13} color={ui.textMuted} textAlign="center">
                {isPicking ? 'Opening…' : `Drag & drop ${dropTargetLabel} here`}
              </Text>
              {!isPicking && !disabled ? (
                <Text fontSize={13} color={ui.textSecondary} textAlign="center">
                  or{' '}
                  <Text
                    fontSize={13}
                    fontWeight="600"
                    color={ui.brand}
                    cursor="pointer"
                    onPress={(event) => {
                      event?.stopPropagation?.()
                      void handlePick()
                    }}
                  >
                    {browseLabel.toLowerCase()}
                  </Text>
                </Text>
              ) : null}
            </YStack>
          ) : null}

          {canAddMore && (value.length > 0 || !isWeb) ? (
            <XStack gap="$2" flexWrap="wrap">
              {!isWeb || value.length > 0 ? (
                <Button
                  tone="outline"
                  size="$3"
                  borderRadius={12}
                  disabled={disabled || isPicking}
                  onPress={() => void handlePick()}
                  icon={isPicking ? <Spinner size="small" /> : <Icons.Upload size={18} />}
                >
                  {isPicking ? 'Opening…' : browseLabel}
                </Button>
              ) : null}
              {showCamera ? (
                <Button
                  tone="outline"
                  size="$3"
                  borderRadius={12}
                  disabled={disabled || isPicking}
                  onPress={() => void handleCamera()}
                  icon={<Icons.Camera size={18} />}
                  accessibilityLabel="Take photo with camera"
                >
                  Take photo
                </Button>
              ) : null}
            </XStack>
          ) : null}

          {uploadProgress != null && uploadProgress > 0 ? (
            <UploadProgressBar progress={uploadProgress} label={uploadLabel} compact />
          ) : null}
        </YStack>
      </MediaDropZone>
    </Field>
  )
}

function ImagePreviewTile({
  image,
  isCover,
  objectFit = 'cover',
  responsive = false,
  onRemove,
}: {
  image: PickedImage
  isCover?: boolean
  objectFit?: 'cover' | 'contain'
  /** Full-width contain preview that preserves aspect ratio. */
  responsive?: boolean
  onRemove: () => void
}) {
  const ui = useAppUi()
  const isVideo = image.mimeType?.startsWith('video/')
  const tileWidth = responsive ? '100%' : 96
  const tileHeight = responsive ? 220 : 96

  return (
    <YStack
      width={tileWidth}
      maxWidth={responsive ? '100%' : 96}
      height={tileHeight}
      borderRadius={12}
      overflow="hidden"
      borderWidth={1}
      borderColor={ui.borderSubtle}
      backgroundColor={ui.surfaceMuted}
      position="relative"
      alignSelf={responsive ? 'stretch' : undefined}
    >
      {isVideo && Platform.OS === 'web' ? (
        <video
          src={image.uri}
          style={{ width: '100%', height: '100%', objectFit }}
          muted
          playsInline
        />
      ) : isVideo ? (
        <YStack flex={1} alignItems="center" justifyContent="center" backgroundColor="#111">
          <Icons.Video size={28} color="white" />
        </YStack>
      ) : (
        <Image
          src={image.uri}
          width="100%"
          height="100%"
          objectFit={objectFit}
          alt=""
          {...(Platform.OS === 'web' ? { loading: 'lazy' as const } : null)}
        />
      )}
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
            {isVideo ? 'Video' : 'Cover'}
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
        aria-label="Remove media"
      >
        <Icons.X size={14} color="white" />
      </YStack>
    </YStack>
  )
}

function revokeWebBlobUrl(image: PickedImage) {
  if (Platform.OS !== 'web' || !image.uri.startsWith('blob:')) return
  try {
    URL.revokeObjectURL(image.uri)
  } catch {
    // The browser may already have released this object URL.
  }
}

/** Alias — supports photos, videos, and files via `accept`. */
export const MediaUploadField = ImageUploadField

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
