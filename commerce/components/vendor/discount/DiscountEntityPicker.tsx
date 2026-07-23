import { useEffect, useMemo, useState } from 'react'

import { Checkbox, Icons, Input, Spinner, Text, XStack, YStack } from '~/components/ui'
import { loadCategories, searchCategories } from '~/lib/listing/listing-categories.store'
import type { Category } from '~/lib/listing/listing-categories.type'
import { loadShopListings } from '~/lib/listing/listing.store'
import type { ShopListingRow } from '~/lib/listing/listing.service'
import { formatListingPrice } from '~/lib/listing/listing.utils'
import { useAppDispatch, useAppSelector } from '~/lib/store/hooks'
import type { AppUiTokens } from '~/lib/theme/app-ui'

import { listingSkuFallback } from '~/commerce/screens/vendor/vendor-listings-shared'

const SEARCH_DEBOUNCE_MS = 300

type DiscountEntityPickerProps = {
  ui: AppUiTokens
  mode: 'products' | 'categories'
  shopId: string
  currency: string
  selectedIds: string[]
  onChange: (ids: string[]) => void
  searchPlaceholder: string
  emptyLabel?: string
}

export function DiscountEntityPicker({
  ui,
  mode,
  shopId,
  currency,
  selectedIds,
  onChange,
  searchPlaceholder,
  emptyLabel = 'No matches found.',
}: DiscountEntityPickerProps) {
  const dispatch = useAppDispatch()
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [productRows, setProductRows] = useState<ShopListingRow[]>([])
  const [loadingProducts, setLoadingProducts] = useState(false)

  const categories = useAppSelector((s) => s.categories.categories)
  const searchResults = useAppSelector((s) => s.categories.searchResults)
  const loadingCategories = useAppSelector((s) => s.categories.isLoading || s.categories.isSearching)

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds])

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [search])

  useEffect(() => {
    if (mode !== 'categories') return
    if (debouncedSearch) {
      void dispatch(searchCategories({ term: debouncedSearch, options: { limit: 50 } }))
      return
    }
    void dispatch(loadCategories({ filters: { limit: 50 } }))
  }, [debouncedSearch, dispatch, mode])

  useEffect(() => {
    if (mode !== 'products' || !shopId) return
    setLoadingProducts(true)
    void dispatch(
      loadShopListings({
        shopId,
        query: {
          search: debouncedSearch || undefined,
          limit: 50,
          offset: 0,
        },
      }),
    )
      .unwrap()
      .then((rows) => setProductRows(rows))
      .catch(() => setProductRows([]))
      .finally(() => setLoadingProducts(false))
  }, [debouncedSearch, dispatch, mode, shopId])

  const categoryRows: Category[] = debouncedSearch ? searchResults : categories
  const loading = mode === 'products' ? loadingProducts : loadingCategories

  function toggleId(id: string) {
    if (selectedSet.has(id)) {
      onChange(selectedIds.filter((rowId) => rowId !== id))
      return
    }
    onChange([...selectedIds, id])
  }

  return (
    <YStack gap="$3">
      <XStack
        alignItems="center"
        gap="$2"
        paddingHorizontal="$3"
        paddingVertical="$2.5"
        borderRadius={12}
        borderWidth={1}
        borderColor={ui.borderSubtle}
        backgroundColor={ui.surfaceMuted}
      >
        <Icons.Search size={16} color={ui.textMuted} />
        <Input
          flex={1}
          borderWidth={0}
          backgroundColor="transparent"
          placeholder={searchPlaceholder}
          value={search}
          onChangeText={setSearch}
        />
      </XStack>

      <Text fontSize={12} fontWeight="700" color={ui.textSecondary}>
        {selectedIds.length} selected
      </Text>

      {loading ? (
        <YStack alignItems="center" padding="$5">
          <Spinner size="large" />
        </YStack>
      ) : (
        <YStack gap="$2" maxHeight={320}>
          {mode === 'products'
            ? productRows.map((row) => {
                const checked = selectedSet.has(row.id)
                return (
                  <EntityRow
                    key={row.id}
                    ui={ui}
                    checked={checked}
                    title={row.title}
                    subtitle={`SKU: ${listingSkuFallback(row.slug, row.id)} · ${formatListingPrice(row.price, currency)}`}
                    onPress={() => toggleId(row.id)}
                  />
                )
              })
            : categoryRows.map((category) => {
                const checked = selectedSet.has(category.category_id)
                return (
                  <EntityRow
                    key={category.category_id}
                    ui={ui}
                    checked={checked}
                    title={category.category}
                    subtitle={category.description ?? undefined}
                    onPress={() => toggleId(category.category_id)}
                  />
                )
              })}
          {!loading &&
          ((mode === 'products' && !productRows.length) ||
            (mode === 'categories' && !categoryRows.length)) ? (
            <Text fontSize={13} color={ui.textMuted} textAlign="center" padding="$4">
              {emptyLabel}
            </Text>
          ) : null}
        </YStack>
      )}
    </YStack>
  )
}

function EntityRow({
  ui,
  checked,
  title,
  subtitle,
  onPress,
}: {
  ui: AppUiTokens
  checked: boolean
  title: string
  subtitle?: string
  onPress: () => void
}) {
  return (
    <XStack
      alignItems="center"
      gap="$3"
      padding="$3"
      borderRadius={14}
      borderWidth={1}
      borderColor={checked ? ui.brand : ui.borderSubtle}
      backgroundColor={checked ? ui.roseSurface : ui.surface}
      cursor="pointer"
      onPress={onPress}
    >
      <YStack
        width={40}
        height={40}
        borderRadius={10}
        backgroundColor={ui.chip}
        alignItems="center"
        justifyContent="center"
      >
        <Icons.Package size={18} color={ui.brand} />
      </YStack>
      <YStack flex={1} minWidth={0} gap={2}>
        <Text fontSize={14} fontWeight="800" color={ui.text} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text fontSize={12} color={ui.textSecondary} numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}
      </YStack>
      <Checkbox checked={checked} />
    </XStack>
  )
}
