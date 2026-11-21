import { useCallback, useState } from 'react'

import { Button, Icons, Image, Spinner, Text, XStack, YStack, useAppToast } from '~/components/ui'
import { pickImages, type PickedImage } from '~/lib/media/pick-image'
import type { ListingFormData, ListingImageDraft } from '~/lib/listing/listing.type'
import type { AppUiTokens } from '~/lib/theme/app-ui'

import { ListingPublishCard, ListingPublishFieldError } from '../ListingPublishCard'
import {
  LISTING_PUBLISH_COPY,
  LISTING_PUBLISH_IMAGE_HINTS,
} from '../listing-publish.constants'

type ImagesStepProps = {
  ui: AppUiTokens
  formData: ListingFormData
  errors: Record<string, string>
  onChangeImages: (images: ListingImageDraft[]) => void
}

export function ImagesStep({ ui, formData, errors, onChangeImages }: ImagesStepProps) {
  const toast = useAppToast()
  const [isPicking, setIsPicking] = useState(false)
  const images = formData.images ?? []
  const showBanner = images.length < LISTING_PUBLISH_IMAGE_HINTS.MIN_RECOMMENDED

  const handlePick = useCallback(async () => {
    setIsPicking(true)
    try {
      const picked = await pickImages({ multiple: true, maxCount: 12 })
      if (!picked.length) return

      const next = [...images]
      for (const file of picked) {
        next.push(pickedToDraft(file, next.length))
      }
      normalizePrimary(next)
      onChangeImages(next)
    } catch (error) {
      toast.show('Could not add images', {
        tone: 'danger',
        message: error instanceof Error ? error.message : 'Try again with JPG, PNG, or WebP files.',
      })
    } finally {
      setIsPicking(false)
    }
  }, [images, onChangeImages, toast])

  function removeAt(index: number) {
    const next = images.filter((_, i) => i !== index)
    normalizePrimary(next)
    onChangeImages(next)
  }

  function setPrimary(index: number) {
    const next = images.map((img, i) => ({ ...img, is_primary: i === index }))
    onChangeImages(next)
  }

  return (
    <XStack gap="$4" alignItems="flex-start" flexWrap="wrap">
      <YStack flex={1} minWidth={280} gap="$4">
        {showBanner ? (
          <XStack
            gap="$2"
            padding="$3.5"
            borderRadius={12}
            backgroundColor="#FFF4E5"
            borderWidth={1}
            borderColor="#F5C26B"
            alignItems="flex-start"
          >
            <Icons.AlertTriangle size={18} color="#C27803" />
            <Text fontSize={13} color="#8A5A00" fontWeight="600" flex={1} lineHeight={19}>
              {LISTING_PUBLISH_COPY.IMAGES_REQUIRED_BANNER}
            </Text>
          </XStack>
        ) : null}

        <ListingPublishCard ui={ui} noPadding>
          <YStack
            padding="$6"
            alignItems="center"
            justifyContent="center"
            gap="$3"
            borderWidth={2}
            borderStyle="dashed"
            borderColor={ui.borderSubtle}
            borderRadius={16}
            margin="$5"
            minHeight={180}
            cursor="pointer"
            hoverStyle={{ borderColor: ui.brand, backgroundColor: ui.roseSurface }}
            onPress={() => void handlePick()}
          >
            {isPicking ? (
              <Spinner size="large" />
            ) : (
              <>
                <Icons.ImagePlus size={32} color={ui.brand} />
                <Text fontSize={16} fontWeight="800" color={ui.text}>
                  Select Images
                </Text>
                <Text fontSize={12} color={ui.textSecondary} textAlign="center" maxWidth={360}>
                  Drag and drop or click to browse. Supports {LISTING_PUBLISH_IMAGE_HINTS.ACCEPTED_FORMATS_LABEL}{' '}
                  (max {LISTING_PUBLISH_IMAGE_HINTS.MAX_SIZE_MB}MB per image).
                </Text>
              </>
            )}
          </YStack>

          <ListingPublishFieldError ui={ui} message={errors.images} />

          <XStack gap="$3" flexWrap="wrap" paddingHorizontal="$5" paddingBottom="$5">
            {images.map((image, index) => (
              <YStack key={`${image.id ?? image.image_url}-${index}`} width={140} gap="$1.5" position="relative">
                <Image
                  source={{ uri: image.image_url }}
                  width={140}
                  height={140}
                  borderRadius={12}
                  backgroundColor={ui.surfaceMuted}
                />
                {image.is_primary ? (
                  <XStack
                    position="absolute"
                    top={8}
                    left={8}
                    paddingHorizontal={8}
                    paddingVertical={3}
                    borderRadius={999}
                    backgroundColor={ui.brand}
                  >
                    <Text fontSize={10} fontWeight="800" color="white">
                      PRIMARY
                    </Text>
                  </XStack>
                ) : (
                  <Button
                    tone="ghost"
                    size="$2"
                    position="absolute"
                    top={6}
                    right={6}
                    onPress={() => setPrimary(index)}
                  >
                    Set primary
                  </Button>
                )}
                <Button tone="ghost" size="$2" icon={<Icons.X size={12} />} onPress={() => removeAt(index)}>
                  Remove
                </Button>
              </YStack>
            ))}

            <YStack
              width={140}
              height={140}
              borderRadius={12}
              borderWidth={2}
              borderStyle="dashed"
              borderColor={ui.borderSubtle}
              alignItems="center"
              justifyContent="center"
              cursor="pointer"
              onPress={() => void handlePick()}
            >
              <Icons.Plus size={28} color={ui.textMuted} />
            </YStack>
          </XStack>
        </ListingPublishCard>
      </YStack>

      <YStack width={280} maxWidth="100%" gap="$3">
        <ListingPublishCard ui={ui} title="Image Guidelines">
          <YStack gap="$2">
            {LISTING_PUBLISH_COPY.IMAGE_GUIDELINES.map((line) => (
              <XStack key={line} gap="$2" alignItems="flex-start">
                <Icons.Check size={14} color={ui.brand} marginTop={2} />
                <Text fontSize={12} color={ui.textSecondary} lineHeight={18} flex={1}>
                  {line}
                </Text>
              </XStack>
            ))}
          </YStack>
          <Text fontSize={12} color={ui.textMuted} fontStyle="italic" marginTop="$2">
            Tip: Quality images increase conversion rates by up to 40%.
          </Text>
        </ListingPublishCard>
      </YStack>
    </XStack>
  )
}

function pickedToDraft(picked: PickedImage, order: number): ListingImageDraft {
  return {
    image_url: picked.uri,
    mimeType: picked.mimeType,
    fileName: picked.fileName,
    blob: picked.file,
    is_primary: order === 0,
    display_order: order,
  }
}

function normalizePrimary(images: ListingImageDraft[]) {
  if (!images.length) return
  const hasPrimary = images.some((img) => img.is_primary)
  if (!hasPrimary) images[0].is_primary = true
  images.forEach((img, index) => {
    img.display_order = index
  })
}
