import { Platform } from 'react-native'

import {
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectViewport,
  Switch,
  Text,
  TextArea,
  XStack,
  YStack,
} from '~/components/ui'
import {
  LISTING_METADATA_KEYS,
  LISTING_PUBLISH_STEP_IDS,
  LISTING_VALIDATION,
} from '~/commerce/components/vendor/listing-publish/listing-publish.constants'
import {
  ListingFormRow,
  ListingPublishCard,
  ListingPublishFieldError,
} from '~/commerce/components/vendor/listing-publish/ListingPublishCard'
import { CategoriesStep } from '~/commerce/components/vendor/listing-publish/steps/CategoriesStep'
import { DetailsStep } from '~/commerce/components/vendor/listing-publish/steps/DetailsStep'
import { ImagesStep } from '~/commerce/components/vendor/listing-publish/steps/ImagesStep'
import { VariationsSection } from '~/commerce/components/vendor/listing-publish/steps/VariationsSection'
import {
  WHAT_IS_IT_OPTIONS,
  WHEN_MADE_OPTIONS,
  WHO_MADE_OPTIONS,
} from '~/lib/listing/product-catalog'
import { LISTING_TYPES, type ListingFormData, type ListingImageDraft } from '~/lib/listing/listing.type'
import type { AppUiTokens } from '~/lib/theme/app-ui'

type ShopSectionOption = { id: string; section_name: string }

type ListingEditorFormProps = {
  ui: AppUiTokens
  formData: ListingFormData
  errors: Record<string, string>
  isDesktop: boolean
  currencySymbol: string
  sellerCountryCode?: string | null
  deliveryProfiles: { id: string; profile_name: string }[]
  returnPolicies: { id: string; policy_name: string }[]
  shopSections: ShopSectionOption[]
  onUpdate: <K extends keyof ListingFormData>(field: K, value: ListingFormData[K]) => void
  onUpdateMetadata: (key: string, value: unknown) => void
  onChangeImages: (images: ListingImageDraft[]) => void
  onAddTag: (tag: string) => void
  onRemoveTag: (tag: string) => void
  onToggleCategory: (categoryId: string) => void
  onClearCategories: () => void
}

export function scrollToListingSection(sectionId: string) {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return
  document.getElementById(`listing-section-${sectionId}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

export function ListingEditorForm(props: ListingEditorFormProps) {
  const { ui, isDesktop, formData, errors, onUpdate } = props
  const titleLength = formData.title?.length ?? 0
  const tags = formData.tags ?? []
  const videos = (formData.images ?? []).filter((image) => image.image_type === 'video')
  const isDigital = formData.listing_type === LISTING_TYPES.DIGITAL
  const meta = (formData.listing_metadata ?? {}) as Record<string, unknown>
  const digitalFiles = readDigitalFiles(formData)

  function setVideoAt(index: number, value: string) {
    const photos = (formData.images ?? []).filter((image) => image.image_type !== 'video')
    const next = [videos[0]?.image_url ?? '', videos[1]?.image_url ?? '']
    next[index] = value.trim()
    const videoRows = next
      .filter(Boolean)
      .slice(0, 2)
      .map((image_url, order) => ({
        image_url,
        image_type: 'video' as const,
        is_primary: false,
        display_order: photos.length + order,
      }))
    props.onChangeImages([...photos, ...videoRows])
  }

  function writeDigitalFiles(next: DigitalFileDraft[]) {
    const limited = next.slice(0, 5)
    const first = limited.find((file) => file.url.trim())
    onUpdate('digital_file_url', first?.url.trim() ?? '')
    onUpdate('digital_file_type', first?.file_type.trim() ?? '')
    props.onUpdateMetadata(LISTING_METADATA_KEYS.DIGITAL_FILES, limited)
  }

  return (
    <YStack width="100%" maxWidth={760} alignSelf="center" gap={isDesktop ? '$5' : '$4'}>
        <YStack id={`listing-section-${LISTING_PUBLISH_STEP_IDS.PHOTOS}`} gap="$3">
          <ImagesStep
            ui={ui}
            formData={formData}
            errors={errors}
            isDesktop={isDesktop}
            onChangeImages={props.onChangeImages}
          />
          <ListingPublishCard ui={ui} title="Video">
            <ListingFormRow ui={ui} label="Video links" hint="Up to 2 videos, about 5–15 seconds each. Paste a link buyers can play.">
              <YStack gap="$2">
                <Input
                  value={videos[0]?.image_url ?? ''}
                  onChangeText={(value) => setVideoAt(0, value)}
                  placeholder="https://"
                  autoCapitalize="none"
                  keyboardType="url"
                />
                <Input
                  value={videos[1]?.image_url ?? ''}
                  onChangeText={(value) => setVideoAt(1, value)}
                  placeholder="Second video (optional)"
                  autoCapitalize="none"
                  keyboardType="url"
                />
              </YStack>
            </ListingFormRow>
          </ListingPublishCard>
        </YStack>

        <YStack id={`listing-section-${LISTING_PUBLISH_STEP_IDS.CATEGORY}`} gap="$3">
          <CategoriesStep
            ui={ui}
            formData={formData}
            errors={errors}
            onToggleCategory={props.onToggleCategory}
            onClearCategories={props.onClearCategories}
          />
          <ListingPublishCard ui={ui} title="Category">
            <ListingFormRow ui={ui} label="What type of item is it?" required error={errors.listing_type}>
              <XStack gap="$2" flexWrap="wrap">
                <TypeChip
                  ui={ui}
                  label="Physical item"
                  selected={!isDigital}
                  onPress={() => onUpdate('listing_type', LISTING_TYPES.PHYSICAL)}
                />
                <TypeChip
                  ui={ui}
                  label="Digital files"
                  selected={isDigital}
                  onPress={() => onUpdate('listing_type', LISTING_TYPES.DIGITAL)}
                />
              </XStack>
            </ListingFormRow>
            <ChoiceRow
              ui={ui}
              label="When was it made?"
              value={formData.when_made ?? ''}
              options={WHEN_MADE_OPTIONS}
              error={errors.when_made}
              onChange={(value) => onUpdate('when_made', value)}
            />
          </ListingPublishCard>
        </YStack>

        <YStack id={`listing-section-${LISTING_PUBLISH_STEP_IDS.ABOUT}`} gap="$3">
          <ListingPublishCard ui={ui} title="Item details">
            <ListingFormRow
              ui={ui}
              label="Title"
              required
              hint={`${titleLength} / ${LISTING_VALIDATION.TITLE.MAX_LENGTH} characters. Say what it is. Skip price and shipping.`}
              error={errors.title}
            >
              <Input
                value={formData.title}
                onChangeText={(value) => onUpdate('title', value.slice(0, LISTING_VALIDATION.TITLE.MAX_LENGTH))}
                placeholder="Handwoven cotton stole"
                maxLength={LISTING_VALIDATION.TITLE.MAX_LENGTH}
                invalid={!!errors.title}
              />
            </ListingFormRow>
            <ListingFormRow ui={ui} label="Description" required error={errors.description}>
              <TextArea
                minHeight={140}
                value={formData.description ?? ''}
                onChangeText={(value) => onUpdate('description', value)}
                placeholder="Tell the story of this piece, the materials, and how it is made."
                invalid={!!errors.description}
              />
            </ListingFormRow>
            {isDigital ? (
              <DigitalFilesEditor
                ui={ui}
                files={digitalFiles}
                errors={errors}
                onChange={writeDigitalFiles}
              />
            ) : null}
          </ListingPublishCard>
        </YStack>

        <YStack id={`listing-section-${LISTING_PUBLISH_STEP_IDS.PRICE}`}>
          <ListingPublishCard ui={ui} title="Price and inventory">
            <ListingFormRow ui={ui} label="Price" required error={errors.price}>
              <Input
                value={formData.price === undefined || formData.price === null ? '' : String(formData.price)}
                onChangeText={(value) => onUpdate('price', value)}
                placeholder={`${props.currencySymbol} 0`}
                keyboardType="numeric"
                invalid={!!errors.price}
              />
            </ListingFormRow>
            <ListingFormRow ui={ui} label="Quantity" error={errors.stock}>
              <Input
                value={formData.stock === undefined || formData.stock === null ? '' : String(formData.stock)}
                onChangeText={(value) => {
                  onUpdate('stock', value)
                  onUpdate('quantity', value)
                }}
                keyboardType="numeric"
                invalid={!!errors.stock}
              />
            </ListingFormRow>
            <ListingFormRow ui={ui} label="SKU" hint="Optional. Buyers do not see this.">
              <Input value={formData.sku ?? ''} onChangeText={(value) => onUpdate('sku', value)} placeholder="SHOP-001" />
            </ListingFormRow>
          </ListingPublishCard>
        </YStack>

        <YStack id="item-options" gap="$3">
          {!isDigital ? (
            <VariationsSection
              ui={ui}
              formData={formData}
              errors={errors}
              currencySymbol={props.currencySymbol}
              onUpdate={onUpdate}
              onUpdateMetadata={props.onUpdateMetadata}
            />
          ) : (
            <ListingPublishCard ui={ui} title="Variations">
              <Text fontSize={13} color={ui.textSecondary} lineHeight={19}>
                Digital files do not use variations. Buyers download the files you add above.
              </Text>
            </ListingPublishCard>
          )}
          <ListingPublishCard ui={ui} title="Personalization">
            <XStack alignItems="center" justifyContent="space-between">
              <Text fontSize={14} color={ui.text}>
                Buyers can personalize this
              </Text>
              <Switch
                checked={Boolean(formData.personalization_enabled)}
                onCheckedChange={(checked) => onUpdate('personalization_enabled', checked)}
              />
            </XStack>
            {formData.personalization_enabled ? (
              <YStack gap="$3">
                <ListingFormRow ui={ui} label="Instructions for buyers" required error={errors.personalization_instructions}>
                  <TextArea
                    minHeight={80}
                    value={formData.personalization_instructions ?? ''}
                    onChangeText={(value) => onUpdate('personalization_instructions', value)}
                    placeholder="Enter the name you want printed"
                  />
                </ListingFormRow>
                <ListingFormRow ui={ui} label="Character limit" error={errors.personalization_char_limit}>
                  <Input
                    value={
                      formData.personalization_char_limit != null
                        ? String(formData.personalization_char_limit)
                        : ''
                    }
                    onChangeText={(value) => onUpdate('personalization_char_limit', value)}
                    keyboardType="numeric"
                  />
                </ListingFormRow>
                <XStack alignItems="center" justifyContent="space-between">
                  <Text fontSize={13} color={ui.text}>
                    Personalization is required
                  </Text>
                  <Switch
                    checked={Boolean(formData.personalization_required)}
                    onCheckedChange={(checked) => onUpdate('personalization_required', checked)}
                  />
                </XStack>
              </YStack>
            ) : null}
          </ListingPublishCard>
          <ListingPublishCard ui={ui} title="Tags">
            <ListingFormRow
              ui={ui}
              label="Tags"
              hint={`${tags.length} / ${LISTING_VALIDATION.TAGS.MAX_COUNT}. Use words buyers would search for.`}
              error={errors.tags}
            >
              <TagEditor ui={ui} tags={tags} onAdd={props.onAddTag} onRemove={props.onRemoveTag} />
            </ListingFormRow>
          </ListingPublishCard>
        </YStack>

        <YStack id={`listing-section-${LISTING_PUBLISH_STEP_IDS.SHIPPING}`} gap="$3">
          {!isDigital ? (
            <ListingPublishCard ui={ui} title="Processing">
              <ListingFormRow ui={ui} label="Readiness">
                <XStack gap="$2" flexWrap="wrap">
                  <TypeChip
                    ui={ui}
                    label="Made to order"
                    selected={meta[LISTING_METADATA_KEYS.ITEM_READINESS] !== 'ready_to_ship'}
                    onPress={() => props.onUpdateMetadata(LISTING_METADATA_KEYS.ITEM_READINESS, 'made_to_order')}
                  />
                  <TypeChip
                    ui={ui}
                    label="Ready to ship"
                    selected={meta[LISTING_METADATA_KEYS.ITEM_READINESS] === 'ready_to_ship'}
                    onPress={() => props.onUpdateMetadata(LISTING_METADATA_KEYS.ITEM_READINESS, 'ready_to_ship')}
                  />
                </XStack>
              </ListingFormRow>
              <XStack gap="$2" flexWrap="wrap">
                <YStack flex={1} minWidth={140}>
                  <ListingFormRow ui={ui} label="Processing time, minimum days">
                    <Input
                      value={meta[LISTING_METADATA_KEYS.PROCESSING_MIN_DAYS] != null ? String(meta[LISTING_METADATA_KEYS.PROCESSING_MIN_DAYS]) : ''}
                      onChangeText={(value) => props.onUpdateMetadata(LISTING_METADATA_KEYS.PROCESSING_MIN_DAYS, value)}
                      keyboardType="numeric"
                      placeholder="1"
                    />
                  </ListingFormRow>
                </YStack>
                <YStack flex={1} minWidth={140}>
                  <ListingFormRow ui={ui} label="Processing time, maximum days">
                    <Input
                      value={meta[LISTING_METADATA_KEYS.PROCESSING_MAX_DAYS] != null ? String(meta[LISTING_METADATA_KEYS.PROCESSING_MAX_DAYS]) : ''}
                      onChangeText={(value) => props.onUpdateMetadata(LISTING_METADATA_KEYS.PROCESSING_MAX_DAYS, value)}
                      keyboardType="numeric"
                      placeholder="3"
                    />
                  </ListingFormRow>
                </YStack>
              </XStack>
            </ListingPublishCard>
          ) : null}
          {!isDigital ? (
            <>
              <DetailsStep
                ui={ui}
                formData={formData}
                errors={errors}
                sellerCountryCode={props.sellerCountryCode}
                section="shipping"
                deliveryProfiles={props.deliveryProfiles}
                returnPolicies={props.returnPolicies}
                onUpdate={onUpdate}
                onUpdateMetadata={props.onUpdateMetadata}
              />
              <DetailsStep
                ui={ui}
                formData={formData}
                errors={errors}
                sellerCountryCode={props.sellerCountryCode}
                section="details"
                onUpdate={onUpdate}
                onUpdateMetadata={props.onUpdateMetadata}
              />
            </>
          ) : null}
        </YStack>

        {!isDigital ? (
          <YStack id={`listing-section-${LISTING_PUBLISH_STEP_IDS.RETURNS}`}>
            <DetailsStep
              ui={ui}
              formData={formData}
              errors={errors}
              section="returns"
              returnPolicies={props.returnPolicies}
              onUpdate={onUpdate}
              onUpdateMetadata={props.onUpdateMetadata}
            />
          </YStack>
        ) : null}

        <YStack id={`listing-section-${LISTING_PUBLISH_STEP_IDS.MADE}`} gap="$3">
          <ListingPublishCard ui={ui} title="How it is made">
            <ChoiceRow
              ui={ui}
              label="Who made it?"
              value={formData.who_made ?? ''}
              options={WHO_MADE_OPTIONS}
              error={errors.who_made}
              onChange={(value) => onUpdate('who_made', value)}
            />
            <ChoiceRow
              ui={ui}
              label="What is it?"
              value={formData.what_is_it ?? ''}
              options={WHAT_IS_IT_OPTIONS}
              error={errors.what_is_it}
              onChange={(value) => onUpdate('what_is_it', value)}
            />
          </ListingPublishCard>
        </YStack>

        <YStack id={`listing-section-${LISTING_PUBLISH_STEP_IDS.SETTINGS}`} gap="$3">
          <ListingPublishCard ui={ui} title="Settings">
            <ListingFormRow ui={ui} label="Shop section">
              <Select
                value={formData.shop_section_id || 'none'}
                onValueChange={(value) => onUpdate('shop_section_id', value === 'none' ? null : value)}
              >
                <SelectTrigger width="100%">
                  <Select.Value placeholder="None" />
                </SelectTrigger>
                <SelectContent zIndex={300000}>
                  <SelectViewport>
                    <SelectItem index={0} value="none">
                      <Select.ItemText>None</Select.ItemText>
                    </SelectItem>
                    {props.shopSections.map((section, index) => (
                      <SelectItem key={section.id} index={index + 1} value={section.id}>
                        <Select.ItemText>{section.section_name}</Select.ItemText>
                      </SelectItem>
                    ))}
                  </SelectViewport>
                </SelectContent>
              </Select>
            </ListingFormRow>
            <XStack alignItems="center" justifyContent="space-between" gap="$3">
              <YStack flex={1} gap="$1">
                <Text fontSize={14} fontWeight="700" color={ui.text}>
                  Feature this listing
                </Text>
                <Text fontSize={12} color={ui.textSecondary} lineHeight={18}>
                  Show it at the top of your shop.
                </Text>
              </YStack>
              <Switch
                checked={Boolean(formData.is_featured)}
                onCheckedChange={(checked) => onUpdate('is_featured', checked)}
              />
            </XStack>
          </ListingPublishCard>
        </YStack>
    </YStack>
  )
}

type DigitalFileDraft = { url: string; file_type: string }

function readDigitalFiles(formData: ListingFormData): DigitalFileDraft[] {
  const raw = (formData.listing_metadata as Record<string, unknown> | null)?.digital_files
  if (Array.isArray(raw) && raw.length) {
    return raw
      .map((row) => {
        const file = row as { url?: unknown; file_type?: unknown }
        return {
          url: typeof file.url === 'string' ? file.url : '',
          file_type: typeof file.file_type === 'string' ? file.file_type : '',
        }
      })
      .slice(0, 5)
  }
  if (formData.digital_file_url?.trim()) {
    return [{ url: formData.digital_file_url, file_type: formData.digital_file_type ?? '' }]
  }
  return [{ url: '', file_type: '' }]
}

function DigitalFilesEditor({
  ui,
  files,
  errors,
  onChange,
}: {
  ui: AppUiTokens
  files: DigitalFileDraft[]
  errors: Record<string, string>
  onChange: (files: DigitalFileDraft[]) => void
}) {
  return (
    <YStack gap="$2">
      <Text fontSize={13} fontWeight="700" color={ui.text}>
        Digital files
      </Text>
      <Text fontSize={12} color={ui.textSecondary} lineHeight={18}>
        Add up to 5 files buyers download after payment.
      </Text>
      {files.map((file, index) => (
        <XStack key={index} gap="$2" flexWrap="wrap" alignItems="center">
          <Input
            flex={1}
            minWidth={160}
            value={file.url}
            onChangeText={(value) =>
              onChange(files.map((row, i) => (i === index ? { ...row, url: value } : row)))
            }
            placeholder="https://"
            autoCapitalize="none"
            keyboardType="url"
            invalid={index === 0 && !!errors.digital_file_url}
          />
          <Input
            width={120}
            value={file.file_type}
            onChangeText={(value) =>
              onChange(files.map((row, i) => (i === index ? { ...row, file_type: value } : row)))
            }
            placeholder="pdf"
            autoCapitalize="none"
            invalid={index === 0 && !!errors.digital_file_type}
          />
          {files.length > 1 ? (
            <Text fontSize={12} color={ui.textMuted} cursor="pointer" onPress={() => onChange(files.filter((_, i) => i !== index))}>
              Remove
            </Text>
          ) : null}
        </XStack>
      ))}
      {files.length < 5 ? (
        <Text
          fontSize={13}
          fontWeight="700"
          color={ui.brand}
          cursor="pointer"
          onPress={() => onChange([...files, { url: '', file_type: '' }])}
        >
          Add a file
        </Text>
      ) : null}
      <ListingPublishFieldError ui={ui} message={errors.digital_file_url || errors.digital_file_type} />
    </YStack>
  )
}

function TypeChip({
  ui,
  label,
  selected,
  onPress,
}: {
  ui: AppUiTokens
  label: string
  selected: boolean
  onPress: () => void
}) {
  return (
    <Text
      fontSize={13}
      fontWeight="700"
      color={selected ? ui.brand : ui.text}
      cursor="pointer"
      paddingHorizontal="$3"
      paddingVertical="$2"
      borderRadius={999}
      borderWidth={1}
      borderColor={selected ? ui.brand : ui.borderSubtle}
      backgroundColor={selected ? ui.roseSurface : ui.surface}
      onPress={onPress}
    >
      {label}
    </Text>
  )
}

function TagEditor({
  ui,
  tags,
  onAdd,
  onRemove,
}: {
  ui: AppUiTokens
  tags: string[]
  onAdd: (tag: string) => void
  onRemove: (tag: string) => void
}) {
  return (
    <YStack gap="$2">
      <XStack gap="$2" flexWrap="wrap">
        {tags.map((tag) => (
          <XStack key={tag} gap="$1" alignItems="center" paddingHorizontal="$2" paddingVertical="$1" borderRadius={999} backgroundColor={ui.surfaceMuted}>
            <Text fontSize={12} color={ui.text}>
              {tag}
            </Text>
            <Text fontSize={12} color={ui.textMuted} cursor="pointer" onPress={() => onRemove(tag)}>
              ×
            </Text>
          </XStack>
        ))}
      </XStack>
      <Input
        placeholder="Add a tag and press return"
        onSubmitEditing={(event) => {
          const value = event.nativeEvent.text.trim()
          if (!value || tags.length >= LISTING_VALIDATION.TAGS.MAX_COUNT) return
          onAdd(value)
        }}
      />
    </YStack>
  )
}

function ChoiceRow({
  ui,
  label,
  value,
  options,
  error,
  onChange,
}: {
  ui: AppUiTokens
  label: string
  value: string
  options: readonly { value: string; label: string }[]
  error?: string
  onChange: (value: string) => void
}) {
  return (
    <ListingFormRow ui={ui} label={label} required error={error}>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger width="100%">
          <Select.Value placeholder="Choose one" />
        </SelectTrigger>
        <SelectContent zIndex={300000}>
          <SelectViewport>
            {options.map((option, index) => (
              <SelectItem key={option.value} index={index} value={option.value}>
                <Select.ItemText>{option.label}</Select.ItemText>
              </SelectItem>
            ))}
          </SelectViewport>
        </SelectContent>
      </Select>
      <ListingPublishFieldError ui={ui} message={error} />
    </ListingFormRow>
  )
}
