import { useMemo, useState } from 'react'

import {
  Button,
  Icons,
  Input,
  Spinner,
  Text,
  TextArea,
  XStack,
  YStack,
} from '~/components/ui'
import { LISTING_TYPE_OPTIONS_SELECTABLE, LISTING_VALIDATION } from '~/lib/listing/listing.type'
import type { ListingFormData } from '~/lib/listing/listing.type'
import type { AppUiTokens } from '~/lib/theme/app-ui'

import {
  ListingFormRow,
  ListingPublishCard,
} from '~/commerce/components/vendor/listing-publish/ListingPublishCard'
import { listingTypeIcon } from '~/commerce/components/vendor/listing-publish/ListingTypeChooser'
import { countWords } from '~/commerce/components/vendor/listing-publish/listing-publish.utils'

type BasicInfoStepProps = {
  ui: AppUiTokens
  formData: ListingFormData
  errors: Record<string, string>
  isDesktop: boolean
  onEditType: () => void
  onUpdate: <K extends keyof ListingFormData>(field: K, value: ListingFormData[K]) => void
  onAddTag: (tag: string) => void
  onRemoveTag: (tag: string) => void
  onWriteWithAi?: () => void
  writingWithAi?: boolean
}

export function BasicInfoStep({
  ui,
  formData,
  errors,
  onEditType,
  onUpdate,
  onAddTag,
  onRemoveTag,
  onWriteWithAi,
  writingWithAi,
}: BasicInfoStepProps) {
  const titleLength = formData.title?.length ?? 0
  const wordCount = useMemo(() => countWords(formData.description ?? ''), [formData.description])
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

      {onWriteWithAi ? (
        <XStack
          width="100%"
          alignItems="center"
          justifyContent="space-between"
          gap="$3"
          flexWrap="wrap"
          paddingHorizontal="$4"
          paddingVertical="$3"
          borderRadius={16}
          borderWidth={1}
          borderColor={ui.borderSubtle}
          backgroundColor={ui.surface}
        >
          <YStack flex={1} minWidth={220} gap={2}>
            <Text fontSize={14} fontWeight="800" color={ui.text}>
              Write with AI
            </Text>
            <Text fontSize={12} color={ui.textSecondary} lineHeight={17}>
              Use a product photo to suggest the title, description, price, category, and SEO. Review
              everything before you publish.
            </Text>
          </YStack>
          <Button
            tone="outline"
            borderRadius={999}
            disabled={writingWithAi}
            icon={
              writingWithAi ? (
                <Spinner size="small" color={ui.brand} />
              ) : (
                <Icons.Sparkles size={15} color={ui.brand} />
              )
            }
            onPress={onWriteWithAi}
          >
            {writingWithAi ? 'Writing with AI…' : 'Write with AI'}
          </Button>
        </XStack>
      ) : null}

      <ListingPublishCard ui={ui} title="Vital info">
        <ListingFormRow
          ui={ui}
          label="Product name"
          required
          hint={`${titleLength} / ${LISTING_VALIDATION.TITLE.MAX_LENGTH} characters`}
          error={errors.title}
        >
          <Input
            width="100%"
            value={formData.title}
            onChangeText={(value) => onUpdate('title', value)}
            placeholder="Premium Silk Velvet Evening Scarf - Amethyst"
            maxLength={LISTING_VALIDATION.TITLE.MAX_LENGTH}
            invalid={!!errors.title}
          />
        </ListingFormRow>

        <ListingFormRow
          ui={ui}
          label="Product description"
          required
          hint={`${wordCount} words · min ${LISTING_VALIDATION.DESCRIPTION.MIN_LENGTH} characters`}
          error={errors.description}
        >
          <TextArea
            width="100%"
            minHeight={140}
            value={formData.description ?? ''}
            onChangeText={(value) => onUpdate('description', value)}
            placeholder="Describe materials, craftsmanship, and what makes this piece unique..."
            maxLength={LISTING_VALIDATION.DESCRIPTION.MAX_LENGTH}
            invalid={!!errors.description}
          />
        </ListingFormRow>

        <ListingFormRow ui={ui} label="Search terms / tags">
          <YStack gap="$2" width="100%">
            <TagInput ui={ui} onAdd={onAddTag} />
            <XStack gap="$2" flexWrap="wrap">
              {(formData.tags ?? []).map((tag) => (
                <XStack
                  key={tag}
                  alignItems="center"
                  gap={6}
                  paddingHorizontal={10}
                  paddingVertical={6}
                  borderRadius={8}
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
          </YStack>
        </ListingFormRow>
      </ListingPublishCard>
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
