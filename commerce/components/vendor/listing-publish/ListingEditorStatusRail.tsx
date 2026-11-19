import { Platform } from 'react-native'

import { Button, Image, Spinner, Text, XStack, YStack } from '~/components/ui'
import type { ListingFormData } from '~/lib/listing/listing.type'
import type { AppUiTokens } from '~/lib/theme/app-ui'

import { LISTING_PUBLISH_COPY } from '~/commerce/components/vendor/listing-publish/listing-publish.constants'
import {
  formatRelativeLastSaved,
  resolveProductStructure,
  variationPriceRange,
} from '~/commerce/components/vendor/listing-publish/listing-publish.utils'
import { PRODUCT_STRUCTURES } from '~/commerce/components/vendor/listing-publish/listing-publish.constants'

type ListingEditorStatusRailProps = {
  ui: AppUiTokens
  formData: ListingFormData
  currencySymbol: string
  isEditMode: boolean
  lastSavedAt: string | null
  isSaving: boolean
  isPublishing: boolean
  onSaveDraft: () => void
  onPublish: () => void
  onCancel: () => void
}

export function ListingEditorStatusRail({
  ui,
  formData,
  currencySymbol,
  isEditMode,
  lastSavedAt,
  isSaving,
  isPublishing,
  onSaveDraft,
  onPublish,
  onCancel,
}: ListingEditorStatusRailProps) {
  const busy = isSaving || isPublishing
  const primaryImage =
    formData.images?.find((img) => img.is_primary)?.image_url ||
    formData.images?.[0]?.image_url ||
    null
  const structure = resolveProductStructure(formData)
  const range = variationPriceRange(formData.variations)
  const priceLabel =
    structure === PRODUCT_STRUCTURES.VARIABLE && range
      ? range.min === range.max
        ? `${currencySymbol}${range.min.toFixed(0)}`
        : `${currencySymbol}${range.min.toFixed(0)} – ${currencySymbol}${range.max.toFixed(0)}`
      : structure === PRODUCT_STRUCTURES.GROUPED
        ? 'Grouped'
        : formData.price
          ? `${currencySymbol}${Number(formData.price).toFixed(0)}`
          : 'No price'

  const savedLabel = lastSavedAt
    ? `${LISTING_PUBLISH_COPY.LAST_SAVED_PREFIX} ${formatRelativeLastSaved(lastSavedAt)}`
    : LISTING_PUBLISH_COPY.LAST_SAVED_NEVER

  const structureLabel =
    structure === PRODUCT_STRUCTURES.VARIABLE
      ? 'Variable'
      : structure === PRODUCT_STRUCTURES.GROUPED
        ? 'Grouped'
        : 'Simple'

  return (
    <YStack
      width="100%"
      gap="$3"
      padding="$4"
      borderRadius={16}
      borderWidth={1}
      borderColor={ui.borderSubtle}
      backgroundColor={ui.surface}
      style={
        Platform.OS === 'web'
          ? ({ position: 'sticky', top: 88 } as const)
          : undefined
      }
    >
      <Text fontSize={14} fontWeight="800" color={ui.text}>
        Product status
      </Text>

      <YStack
        width="100%"
        aspectRatio={1}
        borderRadius={12}
        overflow="hidden"
        backgroundColor={ui.surfaceMuted}
        borderWidth={1}
        borderColor={ui.borderSubtle}
        alignItems="center"
        justifyContent="center"
      >
        {primaryImage ? (
          <Image source={{ uri: primaryImage }} width={248} height={248} />
        ) : (
          <Text fontSize={12} color={ui.textMuted} textAlign="center" padding="$3">
            Add media to preview
          </Text>
        )}
      </YStack>

      <YStack gap="$1">
        <Text fontSize={15} fontWeight="800" color={ui.text} numberOfLines={2}>
          {formData.title?.trim() || 'Untitled product'}
        </Text>
        <XStack gap="$2" flexWrap="wrap">
          <Text fontSize={12} fontWeight="700" color={ui.brand}>
            {structureLabel}
          </Text>
          <Text fontSize={12} color={ui.textMuted}>
            ·
          </Text>
          <Text fontSize={12} fontWeight="700" color={ui.textSecondary}>
            {priceLabel}
          </Text>
        </XStack>
        <Text fontSize={11} color={ui.textMuted}>
          {savedLabel}
        </Text>
      </YStack>

      <Button
        tone="primary"
        size="$4"
        borderRadius={12}
        width="100%"
        disabled={busy}
        onPress={onPublish}
        icon={busy ? <Spinner size="small" color="white" /> : undefined}
      >
        {isEditMode ? 'Update product' : LISTING_PUBLISH_COPY.PUBLISH}
      </Button>
      <Button
        tone="outline"
        size="$3"
        borderRadius={12}
        width="100%"
        disabled={busy}
        onPress={onSaveDraft}
        icon={isSaving ? <Spinner size="small" /> : undefined}
      >
        {LISTING_PUBLISH_COPY.SAVE_DRAFT}
      </Button>
      <Button tone="ghost" size="$3" borderRadius={12} width="100%" disabled={busy} onPress={onCancel}>
        {LISTING_PUBLISH_COPY.CANCEL_CHANGES}
      </Button>
    </YStack>
  )
}
