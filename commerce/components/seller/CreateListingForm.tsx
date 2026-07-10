import { useMemo, useState, type ReactNode } from 'react'

import { ImageUploadField, preparePickedImagesForUpload } from '~/components/media/ImageUploadField'
import { CommercePanel } from '~/commerce/components'
import { createSellerListing } from '~/commerce/lib/seller-listings'
import type { Database } from '~/lib/supabase'
import { uploadListingImages } from '~/lib/supabase/storage-upload'
import type { PickedImage } from '~/lib/media/pick-image'
import { useSupabase } from '~/providers/SupabaseProvider'
import {
  Button,
  Field,
  Icons,
  Input,
  Spinner,
  Switch,
  Text,
  TextArea,
  XStack,
  YStack,
  useAppToast,
} from '~/components/ui'
import { useAppUi } from '~/lib/theme/useAppUi'

type ListingType = Database['public']['Enums']['listing_type_enum']

type CreateListingFormProps = {
  shopId: string
  onCreated?: () => void
  onCancel?: () => void
}

const LISTING_TYPES: { label: string; value: ListingType }[] = [
  { label: 'Physical product', value: 'physical' },
  { label: 'Digital download', value: 'digital' },
  { label: 'Service', value: 'service' },
]

export function CreateListingForm({ shopId, onCreated, onCancel }: CreateListingFormProps) {
  const ui = useAppUi()
  const toast = useAppToast()
  const { user } = useSupabase()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [price, setPrice] = useState('')
  const [quantity, setQuantity] = useState('1')
  const [category, setCategory] = useState('')
  const [images, setImages] = useState<PickedImage[]>([])
  const [listingType, setListingType] = useState<ListingType>('physical')
  const [publishNow, setPublishNow] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  const parsedPrice = useMemo(() => Number.parseFloat(price), [price])
  const parsedQuantity = useMemo(() => Number.parseInt(quantity, 10), [quantity])
  const canSubmit =
    title.trim().length >= 3 && Number.isFinite(parsedPrice) && parsedPrice > 0 && !isSaving

  async function handleSubmit() {
    if (!canSubmit || !user) return

    setIsSaving(true)

    let imageUrls: string[] = []

    if (images.length > 0) {
      try {
        const files = await preparePickedImagesForUpload(images)
        const { urls, error: uploadError } = await uploadListingImages(user.id, shopId, files)

        if (uploadError) {
          setIsSaving(false)
          toast.show('Photo upload failed', { tone: 'danger', message: uploadError })
          return
        }

        imageUrls = urls
      } catch (error) {
        setIsSaving(false)
        toast.show('Photo upload failed', {
          tone: 'danger',
          message: error instanceof Error ? error.message : 'Try again.',
        })
        return
      }
    }

    const { listing, error } = await createSellerListing({
      shopId,
      title,
      description,
      price: parsedPrice,
      listingType,
      quantity: listingType === 'digital' ? undefined : parsedQuantity,
      category,
      imageUrls,
      publish: publishNow,
    })
    setIsSaving(false)

    if (error || !listing) {
      toast.show('Could not create listing', { tone: 'danger', message: error ?? 'Try again.' })
      return
    }

    toast.show(publishNow ? 'Listing published' : 'Draft saved', { tone: 'success' })
    onCreated?.()
  }

  return (
    <CommercePanel gap="$4">
      <YStack gap="$1">
        <Text fontSize={18} fontWeight="700" color={ui.text}>
          New listing
        </Text>
        <Text fontSize={14} color={ui.textSecondary} lineHeight={20}>
          Add photos and product details. Images upload to secure storage before your listing is saved.
        </Text>
      </YStack>

      <ValidatedBlock>
        <ImageUploadField
          label="Photos"
          multiple
          maxCount={5}
          value={images}
          onChange={setImages}
          disabled={isSaving}
        />
        <Field label="Title" required>
          <Input value={title} onChangeText={setTitle} placeholder="Hand-painted ceramic bowl" />
        </Field>
        <Field label="Description">
          <TextArea
            value={description}
            onChangeText={setDescription}
            placeholder="Materials, size, care instructions, processing time…"
            minHeight={100}
          />
        </Field>
        <Field label="Type" required>
          <XStack gap="$2" flexWrap="wrap">
            {LISTING_TYPES.map((option) => (
              <Button
                key={option.value}
                tone={listingType === option.value ? 'primary' : 'outline'}
                size="$2.5"
                borderRadius={999}
                onPress={() => setListingType(option.value)}
              >
                {option.label}
              </Button>
            ))}
          </XStack>
        </Field>
        <Field label="Price (INR)" required>
          <Input value={price} onChangeText={setPrice} keyboardType="decimal-pad" placeholder="999" />
        </Field>
        {listingType !== 'digital' ? (
          <Field label="Quantity">
            <Input value={quantity} onChangeText={setQuantity} keyboardType="number-pad" placeholder="1" />
          </Field>
        ) : null}
        <Field label="Category">
          <Input value={category} onChangeText={setCategory} placeholder="Home decor" />
        </Field>
        <XStackSwitch
          label="Publish immediately"
          checked={publishNow}
          onCheckedChange={setPublishNow}
        />
      </ValidatedBlock>

      <YStack gap="$2">
        <Button
          tone="primary"
          size="$4"
          borderRadius={999}
          disabled={!canSubmit}
          onPress={() => void handleSubmit()}
          icon={isSaving ? <Spinner size="small" color="white" /> : <Icons.Plus size={18} color="white" />}
        >
          {isSaving ? 'Uploading & saving…' : publishNow ? 'Publish listing' : 'Save draft'}
        </Button>
        {onCancel ? (
          <Button tone="ghost" size="$3" onPress={onCancel}>
            Cancel
          </Button>
        ) : null}
      </YStack>
    </CommercePanel>
  )
}

function ValidatedBlock({ children }: { children: ReactNode }) {
  return <YStack gap="$3">{children}</YStack>
}

function XStackSwitch({
  label,
  checked,
  onCheckedChange,
}: {
  label: string
  checked: boolean
  onCheckedChange: (value: boolean) => void
}) {
  const ui = useAppUi()

  return (
    <YStack gap="$2" paddingVertical="$1">
      <Text fontSize={14} fontWeight="600" color={ui.text}>
        {label}
      </Text>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </YStack>
  )
}
