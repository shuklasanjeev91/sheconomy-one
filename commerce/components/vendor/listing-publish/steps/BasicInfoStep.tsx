import { useMemo, useState } from 'react'

import {
  Checkbox,
  Field,
  Icons,
  Input,
  Switch,
  Text,
  TextArea,
  XStack,
  YStack,
} from '~/components/ui'
import { LISTING_TYPE_OPTIONS_SELECTABLE, LISTING_VALIDATION } from '~/lib/listing/listing.type'
import type { ListingFormData } from '~/lib/listing/listing.type'
import type { AppUiTokens } from '~/lib/theme/app-ui'

import { ListingPublishCard, ListingPublishFieldError } from '~/commerce/components/vendor/listing-publish/ListingPublishCard'
import { listingTypeIcon } from '~/commerce/components/vendor/listing-publish/ListingTypeChooser'
import { LISTING_METADATA_KEYS } from '~/commerce/components/vendor/listing-publish/listing-publish.constants'
import { countWords } from '~/commerce/components/vendor/listing-publish/listing-publish.utils'

type BasicInfoStepProps = {
  ui: AppUiTokens
  formData: ListingFormData
  errors: Record<string, string>
  isDesktop: boolean
  featuredCredits?: number
  onEditType: () => void
  onUpdate: <K extends keyof ListingFormData>(field: K, value: ListingFormData[K]) => void
  onUpdateMetadata?: (key: string, value: unknown) => void
  onAddTag: (tag: string) => void
  onRemoveTag: (tag: string) => void
}

export function BasicInfoStep({
  ui,
  formData,
  errors,
  isDesktop,
  featuredCredits = 3,
  onEditType,
  onUpdate,
  onUpdateMetadata,
  onAddTag,
  onRemoveTag,
}: BasicInfoStepProps) {
  const titleLength = formData.title?.length ?? 0
  const wordCount = useMemo(() => countWords(formData.description ?? ''), [formData.description])
  const meta =
    formData.listing_metadata && typeof formData.listing_metadata === 'object'
      ? (formData.listing_metadata as Record<string, unknown>)
      : {}
  const followersOnly = Boolean(meta[LISTING_METADATA_KEYS.FOLLOWERS_ONLY])
  const selectedType = LISTING_TYPE_OPTIONS_SELECTABLE.find(
    (option) => option.value === formData.listing_type,
  )

  return (
    <YStack gap="$4" width="100%">
      {selectedType ? (
        <XStack
          width="100%"
          alignItems="center"
          gap="$3"
          paddingHorizontal="$4"
          paddingVertical="$3"
          borderRadius={16}
          borderWidth={1}
          borderColor={ui.borderSubtle}
          backgroundColor={ui.roseSurface}
        >
          {listingTypeIcon(selectedType.icon, ui.brand)}
          <YStack flex={1} minWidth={0} gap={2}>
            <Text fontSize={14} fontWeight="800" color={ui.text}>
              {selectedType.label}
            </Text>
            <Text fontSize={12} color={ui.textSecondary} lineHeight={17}>
              {selectedType.description}
            </Text>
          </YStack>
          <Text
            fontSize={13}
            fontWeight="800"
            color={ui.brand}
            cursor="pointer"
            onPress={onEditType}
          >
            Change
          </Text>
        </XStack>
      ) : null}

      <ListingPublishCard
        ui={ui}
        title="Listing Title"
        headerRight={
          <Text fontSize={11} fontWeight="700" color={ui.textMuted} letterSpacing={0.4}>
            {titleLength} / {LISTING_VALIDATION.TITLE.MAX_LENGTH} CHARACTERS
          </Text>
        }
      >
        <Field error={errors.title}>
          <XStack alignItems="center" position="relative">
            <Input
              width="100%"
              value={formData.title}
              onChangeText={(value) => onUpdate('title', value)}
              placeholder="Premium Silk Velvet Evening Scarf - Amethyst"
              maxLength={LISTING_VALIDATION.TITLE.MAX_LENGTH}
              invalid={!!errors.title}
            />
            <YStack position="absolute" right={12} pointerEvents="none">
              <Icons.Sparkles size={16} color={ui.brand} />
            </YStack>
          </XStack>
        </Field>
        <ListingPublishFieldError ui={ui} message={errors.title} />
      </ListingPublishCard>

      <ListingPublishCard
        ui={ui}
        title="Description"
        headerRight={
          <Text fontSize={11} fontWeight="700" color={ui.textMuted} letterSpacing={0.4}>
            {wordCount} WORDS
          </Text>
        }
      >
        <Field error={errors.description}>
          <TextArea
            width="100%"
            minHeight={140}
            value={formData.description ?? ''}
            onChangeText={(value) => onUpdate('description', value)}
            placeholder="Describe materials, craftsmanship, and what makes this piece unique..."
            maxLength={LISTING_VALIDATION.DESCRIPTION.MAX_LENGTH}
            invalid={!!errors.description}
          />
        </Field>
        <ListingPublishFieldError ui={ui} message={errors.description} />
      </ListingPublishCard>

      <XStack gap="$4" flexWrap="wrap" alignItems="stretch">
        <YStack flex={1} minWidth={260}>
          <ListingPublishCard ui={ui} title="Tags">
            <TagInput ui={ui} onAdd={onAddTag} />
            <XStack gap="$2" flexWrap="wrap" marginTop="$2">
              {(formData.tags ?? []).map((tag) => (
                <XStack
                  key={tag}
                  alignItems="center"
                  gap={6}
                  paddingHorizontal={10}
                  paddingVertical={6}
                  borderRadius={999}
                  backgroundColor={ui.chip}
                >
                  <Text fontSize={12} fontWeight="700" color={ui.brand}>
                    {tag}
                  </Text>
                  <YStack cursor="pointer" onPress={() => onRemoveTag(tag)}>
                    <Icons.X size={12} color={ui.brand} />
                  </YStack>
                </XStack>
              ))}
            </XStack>
          </ListingPublishCard>
        </YStack>

        <YStack flex={1} minWidth={260}>
          <ListingPublishCard ui={ui} title="Feature Listing">
            <XStack alignItems="flex-start" gap="$3">
              <Checkbox
                checked={!!formData.is_featured}
                onCheckedChange={(checked) => onUpdate('is_featured', !!checked)}
              />
              <YStack flex={1} gap="$1">
                <Text fontSize={13} fontWeight="700" color={ui.text}>
                  Feature this listing
                </Text>
                <Text fontSize={12} color={ui.textSecondary} lineHeight={18}>
                  Elevate your product to the top of the feed for 48 hours.
                </Text>
                <Text fontSize={12} fontWeight="800" color={ui.brand}>
                  {featuredCredits} credits remain
                </Text>
              </YStack>
            </XStack>
          </ListingPublishCard>
        </YStack>
      </XStack>

      {onUpdateMetadata ? (
        <ListingPublishCard ui={ui} title="Follower perk">
          <XStack alignItems="flex-start" gap="$3">
            <Switch
              checked={followersOnly}
              onCheckedChange={(checked) =>
                onUpdateMetadata(LISTING_METADATA_KEYS.FOLLOWERS_ONLY, !!checked)
              }
            />
            <YStack flex={1} gap="$1">
              <Text fontSize={13} fontWeight="700" color={ui.text}>
                Followers only
              </Text>
              <Text fontSize={12} color={ui.textSecondary} lineHeight={18}>
                Shoppers must follow your shop before they can buy this listing.
              </Text>
            </YStack>
          </XStack>
        </ListingPublishCard>
      ) : null}
    </YStack>
  )
}

function TagInput({ ui, onAdd }: { ui: AppUiTokens; onAdd: (tag: string) => void }) {
  const [draft, setDraft] = useState('')

  function commit() {
    const trimmed = draft.trim()
    if (!trimmed) return
    onAdd(trimmed)
    setDraft('')
  }

  return (
    <Input
      width="100%"
      placeholder="Add a tag..."
      value={draft}
      onChangeText={setDraft}
      onSubmitEditing={commit}
      onBlur={commit}
      returnKeyType="done"
      borderColor={ui.borderSubtle}
    />
  )
}
