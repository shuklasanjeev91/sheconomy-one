import { useMemo, useState, type ReactNode } from 'react'

import { ImageUploadField, preparePickedImagesForUpload } from '~/components/media/ImageUploadField'
import { UploadProgressBar } from '~/components/media/UploadProgressBar'
import { CommercePanel } from '~/commerce/components'
import { createSellerListing } from '~/commerce/lib/seller-listings'
import { serializeListingProductInfo } from '~/commerce/lib/listing-product-info'
import type { Database } from '~/lib/supabase'
import { uploadListingImages, uploadListingVideos } from '~/lib/supabase/storage-upload'
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

const GST_PRESETS = ['0', '5', '12', '18', '28']

export function CreateListingForm({ shopId, onCreated, onCancel }: CreateListingFormProps) {
  const ui = useAppUi()
  const toast = useAppToast()
  const { user } = useSupabase()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [price, setPrice] = useState('')
  const [mrp, setMrp] = useState('')
  const [taxPercent, setTaxPercent] = useState('18')
  const [priceIncludesTax, setPriceIncludesTax] = useState(true)
  const [quantity, setQuantity] = useState('1')
  const [category, setCategory] = useState('')
  const [images, setImages] = useState<PickedImage[]>([])
  const [listingType, setListingType] = useState<ListingType>('physical')
  const [publishNow, setPublishNow] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<number | null>(null)

  const [brand, setBrand] = useState('')
  const [manufacturerName, setManufacturerName] = useState('')
  const [manufacturerAddress, setManufacturerAddress] = useState('')
  const [countryOfOrigin, setCountryOfOrigin] = useState('India')
  const [netQuantity, setNetQuantity] = useState('')
  const [hsnCode, setHsnCode] = useState('')
  const [materialComposition, setMaterialComposition] = useState('')
  const [careInstructions, setCareInstructions] = useState('')
  const [modelNumber, setModelNumber] = useState('')

  const parsedPrice = useMemo(() => Number.parseFloat(price), [price])
  const parsedMrp = useMemo(() => Number.parseFloat(mrp), [mrp])
  const parsedTax = useMemo(() => Number.parseFloat(taxPercent), [taxPercent])
  const parsedQuantity = useMemo(() => Number.parseInt(quantity, 10), [quantity])
  const canSubmit =
    title.trim().length >= 3 && Number.isFinite(parsedPrice) && parsedPrice > 0 && !isSaving

  async function handleSubmit() {
    if (!canSubmit || !user) return

    setIsSaving(true)
    setUploadProgress(null)

    let media: Array<{ url: string; type: 'image' | 'video' }> = []

    if (images.length > 0) {
      try {
        setUploadProgress(0)
        const photoItems = images.filter((item) => !item.mimeType?.startsWith('video/'))
        const videoItems = images.filter((item) => item.mimeType?.startsWith('video/'))

        const photoFiles = photoItems.length ? await preparePickedImagesForUpload(photoItems) : []
        const videoFiles = videoItems.length ? await preparePickedImagesForUpload(videoItems) : []

        let photoUrls: string[] = []
        let videoUrls: string[] = []

        if (photoFiles.length) {
          const { urls, error: uploadError } = await uploadListingImages(user.id, shopId, photoFiles, {
            onProgress: setUploadProgress,
          })
          if (uploadError) {
            setIsSaving(false)
            setUploadProgress(null)
            toast.show('Photo upload failed', { tone: 'danger', message: uploadError })
            return
          }
          photoUrls = urls
        }

        if (videoFiles.length) {
          const { urls, error: uploadError } = await uploadListingVideos(user.id, shopId, videoFiles, {
            onProgress: setUploadProgress,
          })
          if (uploadError) {
            setIsSaving(false)
            setUploadProgress(null)
            toast.show('Video upload failed', { tone: 'danger', message: uploadError })
            return
          }
          videoUrls = urls
        }

        let photoIndex = 0
        let videoIndex = 0
        media = images.map((item) => {
          if (item.mimeType?.startsWith('video/')) {
            const url = videoUrls[videoIndex] ?? ''
            videoIndex += 1
            return { url, type: 'video' as const }
          }
          const url = photoUrls[photoIndex] ?? ''
          photoIndex += 1
          return { url, type: 'image' as const }
        }).filter((item) => item.url)
      } catch (error) {
        setIsSaving(false)
        setUploadProgress(null)
        toast.show('Photo upload failed', {
          tone: 'danger',
          message: error instanceof Error ? error.message : 'Try again.',
        })
        return
      }
    }

    const productInfo = serializeListingProductInfo({
      brand,
      manufacturerName,
      manufacturerAddress,
      countryOfOrigin,
      netQuantity,
      hsnCode,
      materialComposition,
      careInstructions,
      modelNumber,
    })

    const { listing, error } = await createSellerListing({
      shopId,
      title,
      description,
      price: parsedPrice,
      mrp: Number.isFinite(parsedMrp) && parsedMrp > 0 ? parsedMrp : null,
      priceIncludesTax,
      taxPercent: Number.isFinite(parsedTax) ? parsedTax : null,
      productInfo,
      listingType,
      quantity: listingType === 'digital' ? undefined : parsedQuantity,
      category,
      media,
      publish: publishNow,
    })
    setIsSaving(false)
    setUploadProgress(null)

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
          Set tax-inclusive pricing, MRP, and manufacturing details shoppers expect on typical marketplaces.
        </Text>
      </YStack>

      <ValidatedBlock>
        <ImageUploadField
          label="Photos & videos"
          hint="Add up to 5 photos or product videos. Photos are cropped to square."
          accept="media"
          multiple
          maxCount={5}
          value={images}
          onChange={setImages}
          aspect="listing"
          disabled={isSaving}
          uploadProgress={uploadProgress}
          uploadLabel="Uploading media…"
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

        <Text fontSize={15} fontWeight="700" color={ui.text} paddingTop="$2">
          Pricing
        </Text>
        <Field label="Selling price (INR)" required>
          <Input value={price} onChangeText={setPrice} keyboardType="decimal-pad" placeholder="999" />
        </Field>
        <Field label="MRP (INR)">
          <Input value={mrp} onChangeText={setMrp} keyboardType="decimal-pad" placeholder="1299" />
        </Field>
        <Text fontSize={12} color={ui.textMuted}>
          Shown struck through when higher than selling price. Leave blank if MRP equals price.
        </Text>
        <XStackSwitch
          label="Price inclusive of all taxes"
          checked={priceIncludesTax}
          onCheckedChange={setPriceIncludesTax}
        />
        <Field label="GST / tax %">
          <XStack gap="$2" flexWrap="wrap" marginBottom="$2">
            {GST_PRESETS.map((preset) => (
              <Button
                key={preset}
                tone={taxPercent === preset ? 'primary' : 'outline'}
                size="$2"
                borderRadius={999}
                onPress={() => setTaxPercent(preset)}
              >
                {preset}%
              </Button>
            ))}
          </XStack>
          <Input value={taxPercent} onChangeText={setTaxPercent} keyboardType="decimal-pad" placeholder="18" />
        </Field>

        {listingType !== 'digital' ? (
          <Field label="Quantity">
            <Input value={quantity} onChangeText={setQuantity} keyboardType="number-pad" placeholder="1" />
          </Field>
        ) : null}
        <Field label="Category">
          <Input value={category} onChangeText={setCategory} placeholder="Home decor" />
        </Field>

        <Text fontSize={15} fontWeight="700" color={ui.text} paddingTop="$2">
          Manufacturing & legal details
        </Text>
        <Text fontSize={12} color={ui.textMuted} lineHeight={18}>
          Shown on the product page under Product details (brand, manufacturer, origin, HSN, etc.).
        </Text>
        <Field label="Brand">
          <Input value={brand} onChangeText={setBrand} placeholder="Your brand name" />
        </Field>
        <Field label="Manufacturer name">
          <Input
            value={manufacturerName}
            onChangeText={setManufacturerName}
            placeholder="Legal manufacturer / maker name"
          />
        </Field>
        <Field label="Manufacturer address">
          <TextArea
            value={manufacturerAddress}
            onChangeText={setManufacturerAddress}
            placeholder="Full manufacturing address"
            minHeight={72}
          />
        </Field>
        <Field label="Country of origin">
          <Input value={countryOfOrigin} onChangeText={setCountryOfOrigin} placeholder="India" />
        </Field>
        <Field label="Net quantity">
          <Input value={netQuantity} onChangeText={setNetQuantity} placeholder="e.g. 1 piece, 250 g, 500 ml" />
        </Field>
        <Field label="HSN code">
          <Input value={hsnCode} onChangeText={setHsnCode} placeholder="e.g. 6911" />
        </Field>
        <Field label="Model / item no.">
          <Input value={modelNumber} onChangeText={setModelNumber} placeholder="Optional SKU / style code" />
        </Field>
        <Field label="Material / composition">
          <Input
            value={materialComposition}
            onChangeText={setMaterialComposition}
            placeholder="e.g. 100% cotton, ceramic, brass"
          />
        </Field>
        <Field label="Care instructions">
          <Input
            value={careInstructions}
            onChangeText={setCareInstructions}
            placeholder="e.g. Hand wash only, spot clean"
          />
        </Field>

        <XStackSwitch
          label="Publish immediately"
          checked={publishNow}
          onCheckedChange={setPublishNow}
        />
      </ValidatedBlock>

      <YStack gap="$2">
        {uploadProgress != null && uploadProgress > 0 ? (
          <UploadProgressBar progress={uploadProgress} label="Uploading photos…" compact />
        ) : null}
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
