import { useEffect, useMemo, useState } from 'react'

import { Checkbox, Icons, Input, Spinner, Text, XStack, YStack } from '~/components/ui'
import { loadCategories, searchCategories } from '~/lib/listing/listing-categories.store'
import type { Category } from '~/lib/listing/listing-categories.type'
import type { ListingFormData } from '~/lib/listing/listing.type'
import { LISTING_VALIDATION } from '~/lib/listing/listing.type'
import { useAppDispatch, useAppSelector } from '~/lib/store/hooks'
import type { AppUiTokens } from '~/lib/theme/app-ui'

import { ListingPublishCard, ListingPublishFieldError, ListingPublishTip } from '~/commerce/components/vendor/listing-publish/ListingPublishCard'
import { LISTING_PUBLISH_COPY } from '~/commerce/components/vendor/listing-publish/listing-publish.constants'

const SEARCH_DEBOUNCE_MS = 300

type CategoriesStepProps = {
  ui: AppUiTokens
  formData: ListingFormData
  errors: Record<string, string>
  onToggleCategory: (categoryId: string) => void
  onClearCategories: () => void
}

export function CategoriesStep({
  ui,
  formData,
  errors,
  onToggleCategory,
  onClearCategories,
}: CategoriesStepProps) {
  const dispatch = useAppDispatch()
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')

  const categories = useAppSelector((s) => s.categories.categories)
  const searchResults = useAppSelector((s) => s.categories.searchResults)
  const isLoading = useAppSelector((s) => s.categories.isLoading || s.categories.isSearching)

  const selectedIds = useMemo(
    () => new Set((formData.categories ?? []).map((row) => row.category_id)),
    [formData.categories],
  )
  const selectedCount = selectedIds.size
  const maxSelected = LISTING_VALIDATION.CATEGORIES.MAX_SELECTED

  useEffect(() => {
    void dispatch(loadCategories({ filters: { limit: 50 } }))
  }, [dispatch])

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [search])

  useEffect(() => {
    if (!debouncedSearch) return
    void dispatch(searchCategories({ term: debouncedSearch, options: { limit: 50 } }))
  }, [debouncedSearch, dispatch])

  const rows: Category[] = debouncedSearch ? searchResults : categories

  return (
    <YStack gap="$4">
      <ListingPublishCard ui={ui} noPadding>
        <YStack padding="$5" gap="$3">
          <XStack alignItems="center" gap="$2" paddingHorizontal="$3" paddingVertical="$2.5" borderRadius={12} borderWidth={1} borderColor={ui.borderSubtle} backgroundColor={ui.surfaceMuted}>
            <Icons.Search size={16} color={ui.textMuted} />
            <Input
              flex={1}
              borderWidth={0}
              backgroundColor="transparent"
              placeholder="Search all categories..."
              value={search}
              onChangeText={setSearch}
            />
          </XStack>

          <XStack alignItems="center" justifyContent="space-between">
            <Text fontSize={13} fontWeight="700" color={ui.textSecondary}>
              {selectedCount} of {maxSelected} categories selected
            </Text>
            {selectedCount > 0 ? (
              <Text
                fontSize={13}
                fontWeight="700"
                color={ui.brand}
                cursor="pointer"
                onPress={onClearCategories}
              >
                {LISTING_PUBLISH_COPY.CLEAR_ALL}
              </Text>
            ) : null}
          </XStack>

          <ListingPublishFieldError ui={ui} message={errors.categories} />

          {isLoading ? (
            <YStack alignItems="center" padding="$6">
              <Spinner size="large" />
            </YStack>
          ) : (
            <YStack gap="$2">
              {rows.map((category) => {
                const checked = selectedIds.has(category.category_id)
                const disabled = !checked && selectedCount >= maxSelected
                return (
                  <XStack
                    key={category.category_id}
                    alignItems="center"
                    gap="$3"
                    padding="$3.5"
                    borderRadius={14}
                    borderWidth={1}
                    borderColor={checked ? ui.brand : ui.borderSubtle}
                    backgroundColor={checked ? ui.roseSurface : ui.surface}
                    opacity={disabled ? 0.5 : 1}
                    cursor={disabled ? 'not-allowed' : 'pointer'}
                    onPress={() => {
                      if (!disabled || checked) onToggleCategory(category.category_id)
                    }}
                  >
                    <YStack
                      width={44}
                      height={44}
                      borderRadius={10}
                      backgroundColor={ui.chip}
                      alignItems="center"
                      justifyContent="center"
                    >
                      <Icons.Tags size={18} color={ui.brand} />
                    </YStack>
                    <YStack flex={1} gap={2}>
                      <Text fontSize={14} fontWeight="800" color={ui.text}>
                        {category.category}
                      </Text>
                      {category.description ? (
                        <Text fontSize={12} color={ui.textSecondary} numberOfLines={2}>
                          {category.description}
                        </Text>
                      ) : null}
                    </YStack>
                    <Checkbox checked={checked} disabled={disabled && !checked} />
                  </XStack>
                )
              })}
              {!rows.length ? (
                <Text fontSize={13} color={ui.textMuted} textAlign="center" padding="$4">
                  No categories found. Try a different search term.
                </Text>
              ) : null}
            </YStack>
          )}
        </YStack>
      </ListingPublishCard>

      <ListingPublishTip
        ui={ui}
        title="Listing Tip"
        body={LISTING_PUBLISH_COPY.LISTING_TIP_CATEGORIES}
      />
    </YStack>
  )
}
