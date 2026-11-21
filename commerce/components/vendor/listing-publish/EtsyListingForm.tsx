import { Platform } from 'react-native'

import {
  Input,
  ScrollView,
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
import { LISTING_PUBLISH_STEPS, LISTING_PUBLISH_STEP_IDS, LISTING_VALIDATION } from '~/commerce/components/vendor/listing-publish/listing-publish.constants'
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

type EtsyListingFormProps = {
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

export function EtsyListingForm(props: EtsyListingFormProps) {
  const { ui, isDesktop, formData, errors, onUpdate } = props
  const titleLength = formData.title?.length ?? 0
  const tags = formData.tags ?? []
  const video = (formData.images ?? []).find((image) => image.image_type === 'video')
  const isDigital = formData.listing_type === LISTING_TYPES.DIGITAL

  function setVideoUrl(value: string) {
    const photos = (formData.images ?? []).filter((image) => image.image_type !== 'video')
    if (!value.trim()) {
      props.onChangeImages(photos)
      return
    }
    props.onChangeImages([
      ...photos,
      {
        image_url: value.trim(),
        image_type: 'video',
        is_primary: false,
        display_order: photos.length,
      },
    ])
  }

  return (
    <XStack width="100%" gap="$4" alignItems="flex-start">
      {isDesktop ? (
        <YStack width={180} gap="$1" position="sticky" top={12}>
          {LISTING_PUBLISH_STEPS.map((step) => (
            <Text
              key={step.id}
              fontSize={13}
              fontWeight="700"
              color={ui.textSecondary}
              cursor="pointer"
              paddingVertical="$1.5"
              onPress={() => scrollToListingSection(step.id)}
            >
              {step.label}
            </Text>
          ))}
        </YStack>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <XStack gap="$3" paddingBottom="$2">
            {LISTING_PUBLISH_STEPS.map((step) => (
              <Text
                key={step.id}
                fontSize={13}
                fontWeight="700"
                color={ui.brand}
                cursor="pointer"
                onPress={() => scrollToListingSection(step.id)}
              >
                {step.label}
              </Text>
            ))}
          </XStack>
        </ScrollView>
      )}

      <YStack flex={1} minWidth={0} gap="$5">
        <YStack id={`listing-section-${LISTING_PUBLISH_STEP_IDS.PHOTOS}`} gap="$3">
          <ImagesStep
            ui={ui}
            formData={formData}
            errors={errors}
            isDesktop={isDesktop}
            onChangeImages={props.onChangeImages}
          />
          <ListingPublishCard ui={ui} title="Video">
            <ListingFormRow ui={ui} label="Video link" hint="One video. Paste a link buyers can play.">
              <Input
                value={video?.image_url ?? ''}
                onChangeText={setVideoUrl}
                placeholder="https://"
                autoCapitalize="none"
                keyboardType="url"
              />
            </ListingFormRow>
          </ListingPublishCard>
        </YStack>

        <YStack id={`listing-section-${LISTING_PUBLISH_STEP_IDS.ABOUT}`} gap="$3">
          <ListingPublishCard ui={ui} title="About">
            <ListingFormRow
              ui={ui}
              label="Title"
              required
              hint={`${titleLength} / ${LISTING_VALIDATION.TITLE.MAX_LENGTH} characters. Include words buyers would search for.`}
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
            <ListingFormRow ui={ui} label="Type" required error={errors.listing_type}>
              <XStack gap="$2">
                <TypeChip
                  ui={ui}
                  label="Physical item"
                  selected={!isDigital}
                  onPress={() => onUpdate('listing_type', LISTING_TYPES.PHYSICAL)}
                />
                <TypeChip
                  ui={ui}
                  label="Digital download"
                  selected={isDigital}
                  onPress={() => onUpdate('listing_type', LISTING_TYPES.DIGITAL)}
                />
              </XStack>
            </ListingFormRow>
          </ListingPublishCard>
          <CategoriesStep
            ui={ui}
            formData={formData}
            errors={errors}
            onToggleCategory={props.onToggleCategory}
            onClearCategories={props.onClearCategories}
          />
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

        <YStack id={`listing-section-${LISTING_PUBLISH_STEP_IDS.VARIATIONS}`}>
          <VariationsSection
            ui={ui}
            formData={formData}
            errors={errors}
            currencySymbol={props.currencySymbol}
            onUpdate={onUpdate}
            onUpdateMetadata={props.onUpdateMetadata}
          />
        </YStack>

        <YStack id={`listing-section-${LISTING_PUBLISH_STEP_IDS.PERSONALIZATION}`}>
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
        </YStack>

        <YStack id={`listing-section-${LISTING_PUBLISH_STEP_IDS.SHIPPING}`}>
          <DetailsStep
            ui={ui}
            formData={formData}
            errors={errors}
            sellerCountryCode={props.sellerCountryCode}
            section={isDigital ? 'details' : 'shipping'}
            deliveryProfiles={props.deliveryProfiles}
            returnPolicies={props.returnPolicies}
            onUpdate={onUpdate}
            onUpdateMetadata={props.onUpdateMetadata}
          />
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

        <YStack id={`listing-section-${LISTING_PUBLISH_STEP_IDS.DETAILS}`} gap="$3">
          <ListingPublishCard ui={ui} title="Details">
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
            <ListingFormRow
              ui={ui}
              label="Tags"
              hint={`${tags.length} / ${LISTING_VALIDATION.TAGS.MAX_COUNT}`}
              error={errors.tags}
            >
              <TagEditor ui={ui} tags={tags} onAdd={props.onAddTag} onRemove={props.onRemoveTag} />
            </ListingFormRow>
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
              label="When was it made?"
              value={formData.when_made ?? ''}
              options={WHEN_MADE_OPTIONS}
              error={errors.when_made}
              onChange={(value) => onUpdate('when_made', value)}
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
          {!isDigital ? (
            <DetailsStep
              ui={ui}
              formData={formData}
              errors={errors}
              sellerCountryCode={props.sellerCountryCode}
              section="details"
              onUpdate={onUpdate}
              onUpdateMetadata={props.onUpdateMetadata}
            />
          ) : null}
        </YStack>
      </YStack>
    </XStack>
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
