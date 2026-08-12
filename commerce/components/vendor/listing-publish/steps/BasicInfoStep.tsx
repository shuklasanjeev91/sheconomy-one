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
import { LISTING_TYPE_OPTIONS, LISTING_VALIDATION } from '~/lib/listing/listing.type'
import type { ListingFormData, ListingType } from '~/lib/listing/listing.type'
import type { AppUiTokens } from '~/lib/theme/app-ui'

import { ListingPublishCard, ListingPublishFieldError } from '~/commerce/components/vendor/listing-publish/ListingPublishCard'
import { LISTING_METADATA_KEYS } from '~/commerce/components/vendor/listing-publish/listing-publish.constants'
import { countWords } from '~/commerce/components/vendor/listing-publish/listing-publish.utils'

type BasicInfoStepProps = {
  ui: AppUiTokens
  formData: ListingFormData
  errors: Record<string, string>
  featuredCredits?: number
  onChangeType: (type: ListingType) => void
  onUpdate: <K extends keyof ListingFormData>(field: K, value: ListingFormData[K]) => void
  onUpdateMetadata?: (key: string, value: unknown) => void
  onAddTag: (tag: string) => void
  onRemoveTag: (tag: string) => void
}

function typeIcon(icon: string, color: string) {
  switch (icon) {
    case 'package':
      return <Icons.Package size={22} color={color} />
    case 'download':
      return <Icons.Cloud size={22} color={color} />
    case 'zap':
      return <Icons.Wand2 size={22} color={color} />
    default:
      return <Icons.Box size={22} color={color} />
  }
}

export function BasicInfoStep({
  ui,
  formData,
  errors,
  featuredCredits = 3,
  onChangeType,
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

  return (
    <YStack gap="$4">
      <XStack gap="$3" flexWrap="wrap">
        {LISTING_TYPE_OPTIONS.map((option) => {
          const selected = formData.listing_type === option.value
          const disabled = option.disabled
          return (
            <YStack
              key={option.value}
              flex={1}
              minWidth={200}
              maxWidth={320}
              gap="$2"
              padding="$4"
              borderRadius={16}
              borderWidth={selected ? 2 : 1}
              borderColor={selected ? ui.brand : ui.borderSubtle}
              backgroundColor={selected ? ui.roseSurface : ui.surface}
              opacity={disabled ? 0.55 : 1}
              cursor={disabled ? 'not-allowed' : 'pointer'}
              onPress={() => {
                if (!disabled) onChangeType(option.value)
              }}
            >
              <XStack alignItems="center" justifyContent="space-between">
                {typeIcon(option.icon, selected ? ui.brand : ui.textSecondary)}
                {selected ? <Icons.CheckCircle2 size={18} color={ui.brand} /> : null}
                {disabled ? (
                  <Text fontSize={10} fontWeight="800" color={ui.textMuted} letterSpacing={0.5}>
                    SOON
                  </Text>
                ) : null}
              </XStack>
              <Text fontSize={14} fontWeight="800" color={ui.text}>
                {option.label}
              </Text>
              <Text fontSize={12} color={ui.textSecondary} lineHeight={18}>
                {option.description}
              </Text>
            </YStack>
          )
        })}
      </XStack>

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
