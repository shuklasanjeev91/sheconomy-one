import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'one'

import {
  Button,
  Checkbox,
  Icons,
  Image,
  Input,
  Popover,
  PopoverContent,
  Spinner,
  Text,
  XStack,
  YStack,
  useAppToast,
} from '~/components/ui'
import { radius } from '~/config/tokens'
import { loadShopListings } from '~/lib/listing/listing.store'
import type { ShopListingRow } from '~/lib/listing/listing.service'
import { LISTING_TYPES, type ListingStatus, type ListingType } from '~/lib/listing/listing.type'
import { formatListingPrice } from '~/lib/listing/listing.utils'
import { vendorRoutes } from '~/lib/routes'
import { useAppDispatch } from '~/lib/store/hooks'
import type { AppUiTokens } from '~/lib/theme/app-ui'
import { bulkUpdateVendorListings } from '~/commerce/lib/vendor-operations'

import {
  LISTING_STATUS_FILTER_OPTIONS,
  LISTING_TYPE_FILTER_OPTIONS,
  ListingsCard,
  ListingsFilterDropdown,
  ListingsPagerButton,
  listingSkuFallback,
  listingStatusLabel,
  listingStatusTone,
  listingTypeLabel,
} from './vendor-listings-shared'

const PAGE_SIZE = 10

type TypeFilter = ListingType | 'all'
type StatusFilter = ListingStatus | 'all'

type AppliedFilters = {
  search: string
  type: TypeFilter
  status: StatusFilter
}

type VendorListingsProductsTabProps = {
  ui: AppUiTokens
  shopId: string
  currency: string
  isDesktop: boolean
  onOpenListing: (listingId: string) => void
}

export function VendorListingsProductsTab({
  ui,
  shopId,
  currency,
  isDesktop,
  onOpenListing,
}: VendorListingsProductsTabProps) {
  const dispatch = useAppDispatch()
  const toast = useAppToast()

  const [searchDraft, setSearchDraft] = useState('')
  const [typeDraft, setTypeDraft] = useState<TypeFilter>('all')
  const [statusDraft, setStatusDraft] = useState<StatusFilter>('all')
  const [applied, setApplied] = useState<AppliedFilters>({ search: '', type: 'all', status: 'all' })

  const [rows, setRows] = useState<ShopListingRow[]>([])
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null)
  const [bulkPricePercent, setBulkPricePercent] = useState('')
  const [bulkStockDelta, setBulkStockDelta] = useState('')
  const [bulkCategory, setBulkCategory] = useState('')
  const [bulkUpdating, setBulkUpdating] = useState(false)

  const hasFilters = applied.search.trim().length > 0 || applied.type !== 'all' || applied.status !== 'all'

  const fetchPage = useCallback(async () => {
    setLoading(true)
    try {
      const data = await dispatch(
        loadShopListings({
          shopId,
          query: {
            search: applied.search.trim() || undefined,
            listingType: applied.type === 'all' ? undefined : applied.type,
            listingStatus: applied.status === 'all' ? undefined : applied.status,
            limit: PAGE_SIZE,
            offset: (page - 1) * PAGE_SIZE,
          },
        }),
      ).unwrap()
      setRows(data)
      setHasMore(data.length === PAGE_SIZE)
    } catch (error) {
      toast.show('Could not load products', {
        tone: 'danger',
        message: error instanceof Error ? error.message : String(error),
      })
      setRows([])
      setHasMore(false)
    } finally {
      setLoading(false)
    }
  }, [applied.search, applied.status, applied.type, dispatch, page, shopId, toast])

  useEffect(() => {
    void fetchPage()
  }, [fetchPage])

  const rangeStart = rows.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1
  const rangeEnd = (page - 1) * PAGE_SIZE + rows.length

  const allSelected = rows.length > 0 && rows.every((row) => selectedIds.has(row.id))

  function applyFilters() {
    setApplied({
      search: searchDraft,
      type: typeDraft,
      status: statusDraft,
    })
    setPage(1)
    setSelectedIds(new Set())
  }

  function clearFilters() {
    setSearchDraft('')
    setTypeDraft('all')
    setStatusDraft('all')
    setApplied({ search: '', type: 'all', status: 'all' })
    setPage(1)
    setSelectedIds(new Set())
  }

  function toggleAll() {
    if (allSelected) {
      setSelectedIds(new Set())
      return
    }
    setSelectedIds(new Set(rows.map((row) => row.id)))
  }

  function toggleOne(id: string) {
    setSelectedIds((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function applyBulk(input: {
    status?: string
    pricePercent?: number
    stockDelta?: number
    category?: string
  }) {
    if (!selectedIds.size) return
    setBulkUpdating(true)
    const result = await bulkUpdateVendorListings({
      shopId,
      listingIds: [...selectedIds],
      ...input,
    })
    setBulkUpdating(false)
    if (result.error) {
      toast.show('Bulk update failed', { tone: 'danger', message: result.error })
      return
    }
    toast.show(`${result.count} products updated`, { tone: 'success' })
    setSelectedIds(new Set())
    setBulkPricePercent('')
    setBulkStockDelta('')
    setBulkCategory('')
    await fetchPage()
  }

  const statusColors = useMemo(
    () => ({
      success: { bg: '#E8F8EE', text: '#1F7A45', dot: '#2ECC71' },
      warning: { bg: '#FFF4E5', text: '#9A6700', dot: '#E6A23C' },
      danger: { bg: '#FDECEC', text: '#B42318', dot: '#E74C3C' },
      neutral: { bg: ui.surfaceMuted, text: ui.textSecondary, dot: ui.textMuted },
    }),
    [ui],
  )

  return (
    <YStack gap="$4" width="100%">
      <ListingsCard ui={ui}>
        <XStack gap="$3" flexWrap="wrap" alignItems="flex-end">
          <YStack gap="$1.5" flex={1} minWidth={220}>
            <Text fontSize={11} fontWeight="700" color={ui.textMuted} letterSpacing={0.4}>
              SEARCH PRODUCTS
            </Text>
            <XStack
              alignItems="center"
              gap="$2"
              paddingHorizontal="$3"
              height={44}
              borderRadius={radius.chip}
              borderWidth={1}
              borderColor={ui.borderSubtle}
              backgroundColor={ui.surfaceMuted}
            >
              <Icons.Search size={16} color={ui.textMuted} />
              <Input
                flex={1}
                borderWidth={0}
                backgroundColor="transparent"
                paddingHorizontal={0}
                height="$4"
                placeholder="By name or SKU…"
                value={searchDraft}
                onChangeText={setSearchDraft}
                onSubmitEditing={applyFilters}
              />
            </XStack>
          </YStack>

          <YStack gap="$1.5" minWidth={140}>
            <Text fontSize={11} fontWeight="700" color={ui.textMuted} letterSpacing={0.4}>
              TYPE
            </Text>
            <ListingsFilterDropdown
              ui={ui}
              label="All Types"
              options={LISTING_TYPE_FILTER_OPTIONS}
              value={typeDraft}
              onChange={(value) => setTypeDraft(value as TypeFilter)}
            />
          </YStack>

          <YStack gap="$1.5" minWidth={140}>
            <Text fontSize={11} fontWeight="700" color={ui.textMuted} letterSpacing={0.4}>
              STATUS
            </Text>
            <ListingsFilterDropdown
              ui={ui}
              label="All Status"
              options={LISTING_STATUS_FILTER_OPTIONS}
              value={statusDraft}
              onChange={(value) => setStatusDraft(value as StatusFilter)}
            />
          </YStack>

          <XStack gap="$2" alignItems="center" paddingBottom={1}>
            <Button tone="ghost" size="$3" onPress={clearFilters}>
              Clear Filters
            </Button>
            <Button tone="outline" size="$3" borderRadius={999} onPress={applyFilters}>
              Apply
            </Button>
          </XStack>
        </XStack>
      </ListingsCard>

      {selectedIds.size > 0 ? (
        <ListingsCard ui={ui}>
          <YStack gap="$3">
            <Text fontSize={13} fontWeight="800" color={ui.text}>
              Bulk edit {selectedIds.size} selected products
            </Text>
            <XStack gap="$2" flexWrap="wrap" alignItems="center">
              <Button
                tone="outline"
                size="$3"
                disabled={bulkUpdating}
                onPress={() => void applyBulk({ status: 'active' })}
              >
                Activate
              </Button>
              <Button
                tone="outline"
                size="$3"
                disabled={bulkUpdating}
                onPress={() => void applyBulk({ status: 'paused' })}
              >
                Pause
              </Button>
              <Input
                width={120}
                placeholder="Price %"
                keyboardType="decimal-pad"
                value={bulkPricePercent}
                onChangeText={setBulkPricePercent}
              />
              <Button
                tone="outline"
                size="$3"
                disabled={!Number.isFinite(Number(bulkPricePercent)) || bulkPricePercent.trim() === ''}
                onPress={() => void applyBulk({ pricePercent: Number(bulkPricePercent) })}
              >
                Apply price
              </Button>
              <Input
                width={120}
                placeholder="Stock +/-"
                keyboardType="number-pad"
                value={bulkStockDelta}
                onChangeText={setBulkStockDelta}
              />
              <Button
                tone="outline"
                size="$3"
                disabled={!Number.isFinite(Number(bulkStockDelta)) || bulkStockDelta.trim() === ''}
                onPress={() => void applyBulk({ stockDelta: Number(bulkStockDelta) })}
              >
                Apply stock
              </Button>
              <Input
                minWidth={150}
                placeholder="Category"
                value={bulkCategory}
                onChangeText={setBulkCategory}
              />
              <Button
                tone="primary"
                size="$3"
                disabled={!bulkCategory.trim()}
                onPress={() => void applyBulk({ category: bulkCategory })}
              >
                Set category
              </Button>
            </XStack>
          </YStack>
        </ListingsCard>
      ) : null}

      <ListingsCard ui={ui}>
        {loading ? (
          <YStack alignItems="center" justifyContent="center" paddingVertical="$8">
            <Spinner size="large" color={ui.brand} />
          </YStack>
        ) : rows.length === 0 ? (
          <YStack alignItems="center" justifyContent="center" paddingVertical="$8" gap="$3">
            <Icons.Package size={30} color={ui.brand} />
            <Text fontSize={16} fontWeight="800" color={ui.text}>
              {hasFilters ? 'No matching products' : 'No products yet'}
            </Text>
            <Text fontSize={13} color={ui.textSecondary} textAlign="center" maxWidth={360}>
              {hasFilters
                ? 'Try adjusting your search or filters.'
                : 'Create your first listing to start selling from your storefront.'}
            </Text>
            {!hasFilters ? (
              <Link href={vendorRoutes.createListing} asChild>
                <Button tone="primary" size="$3" borderRadius={999}>
                  Create listing
                </Button>
              </Link>
            ) : null}
          </YStack>
        ) : isDesktop ? (
          <YStack gap="$1">
            <XStack
              paddingVertical="$2"
              paddingHorizontal="$2"
              borderBottomWidth={1}
              borderBottomColor={ui.borderSubtle}
            >
              <XStack width={44} alignItems="center" justifyContent="center">
                <Checkbox checked={allSelected} onCheckedChange={toggleAll} />
              </XStack>
              <Text flex={2.2} fontSize={11} fontWeight="700" color={ui.textMuted} letterSpacing={0.5}>
                PRODUCT
              </Text>
              <Text flex={0.9} fontSize={11} fontWeight="700" color={ui.textMuted} letterSpacing={0.5}>
                TYPE
              </Text>
              <Text flex={0.8} fontSize={11} fontWeight="700" color={ui.textMuted} letterSpacing={0.5}>
                PRICE
              </Text>
              <Text flex={0.9} fontSize={11} fontWeight="700" color={ui.textMuted} letterSpacing={0.5}>
                STOCK
              </Text>
              <Text flex={0.9} fontSize={11} fontWeight="700" color={ui.textMuted} letterSpacing={0.5}>
                STATUS
              </Text>
              <XStack width={44} />
            </XStack>

            {rows.map((row) => (
              <ProductTableRow
                key={row.id}
                ui={ui}
                row={row}
                currency={currency}
                selected={selectedIds.has(row.id)}
                statusColors={statusColors}
                menuOpen={menuOpenId === row.id}
                onToggleSelect={() => toggleOne(row.id)}
                onOpenMenu={() => setMenuOpenId(row.id)}
                onCloseMenu={() => setMenuOpenId(null)}
                onView={() => {
                  setMenuOpenId(null)
                  onOpenListing(row.id)
                }}
              />
            ))}
          </YStack>
        ) : (
          <YStack gap="$3">
            {rows.map((row) => (
              <ProductMobileCard
                key={row.id}
                ui={ui}
                row={row}
                currency={currency}
                statusColors={statusColors}
                onPress={() => onOpenListing(row.id)}
              />
            ))}
          </YStack>
        )}

        {!loading && rows.length > 0 ? (
          <XStack alignItems="center" justifyContent="space-between" gap="$3" paddingTop="$3" flexWrap="wrap">
            <Text fontSize={12.5} color={ui.textSecondary} fontWeight="600">
              Showing {rangeStart}-{rangeEnd}
              {hasMore ? '+' : ''} products
            </Text>
            <XStack gap="$2" alignItems="center">
              <ListingsPagerButton
                ui={ui}
                icon={Icons.ChevronLeft}
                disabled={page <= 1}
                onPress={() => setPage((value) => Math.max(1, value - 1))}
              />
              <ListingsPagerButton
                ui={ui}
                icon={Icons.ChevronRight}
                disabled={!hasMore}
                onPress={() => setPage((value) => value + 1)}
              />
            </XStack>
          </XStack>
        ) : null}
      </ListingsCard>
    </YStack>
  )
}

function ProductTableRow({
  ui,
  row,
  currency,
  selected,
  statusColors,
  menuOpen,
  onToggleSelect,
  onOpenMenu,
  onCloseMenu,
  onView,
}: {
  ui: AppUiTokens
  row: ShopListingRow
  currency: string
  selected: boolean
  statusColors: Record<string, { bg: string; text: string; dot: string }>
  menuOpen: boolean
  onToggleSelect: () => void
  onOpenMenu: () => void
  onCloseMenu: () => void
  onView: () => void
}) {
  const tone = listingStatusTone(row.listing_status)
  const palette = statusColors[tone]
  const stock = row.quantity ?? 0
  const isOutOfStock = row.listing_type === LISTING_TYPES.PHYSICAL && stock <= 0

  return (
    <XStack
      alignItems="center"
      paddingVertical="$3"
      paddingHorizontal="$2"
      borderBottomWidth={1}
      borderBottomColor={ui.borderSubtle}
      gap="$2"
      cursor="pointer"
      hoverStyle={{ backgroundColor: ui.surfaceMuted }}
      onPress={onView}
    >
      <XStack width={44} alignItems="center" justifyContent="center" onPress={(e) => e?.stopPropagation?.()}>
        <Checkbox checked={selected} onCheckedChange={onToggleSelect} />
      </XStack>

      <XStack flex={2.2} gap="$3" alignItems="center" minWidth={0}>
        <YStack
          width={48}
          height={48}
          borderRadius={radius.chip}
          overflow="hidden"
          backgroundColor={ui.surfaceMuted}
          alignItems="center"
          justifyContent="center"
        >
          {row.primary_image_url ? (
            <Image src={row.primary_image_url} width={48} height={48} objectFit="cover" alt="" />
          ) : (
            <Icons.Image size={18} color={ui.textMuted} />
          )}
        </YStack>
        <YStack flex={1} minWidth={0} gap={2}>
          <Text fontSize={14} fontWeight="800" color={ui.text} numberOfLines={1}>
            {row.title}
          </Text>
          <Text fontSize={11.5} color={ui.textMuted} fontWeight="600">
            SKU: {listingSkuFallback(row.slug, row.id)}
          </Text>
        </YStack>
      </XStack>

      <XStack flex={0.9}>
        <XStack paddingHorizontal="$2.5" paddingVertical={4} borderRadius={999} backgroundColor="#E8F1FF">
          <Text fontSize={11.5} fontWeight="700" color="#2B6CB0">
            {listingTypeLabel(row.listing_type)}
          </Text>
        </XStack>
      </XStack>

      <Text flex={0.8} fontSize={13.5} fontWeight="700" color={ui.text}>
        {formatListingPrice(row.price, currency)}
      </Text>

      <Text flex={0.9} fontSize={13} fontWeight="700" color={isOutOfStock ? ui.danger : ui.text}>
        {row.listing_type === LISTING_TYPES.DIGITAL || row.listing_type === LISTING_TYPES.SERVICE
          ? '—'
          : isOutOfStock
            ? '0'
            : `${stock} in stock`}
      </Text>

      <XStack flex={0.9}>
        <XStack
          alignItems="center"
          gap={6}
          paddingHorizontal="$2.5"
          paddingVertical={4}
          borderRadius={999}
          backgroundColor={palette.bg}
        >
          <YStack width={6} height={6} borderRadius={999} backgroundColor={palette.dot} />
          <Text fontSize={11.5} fontWeight="700" color={palette.text}>
            {listingStatusLabel(row.listing_status)}
          </Text>
        </XStack>
      </XStack>

      <XStack width={44} justifyContent="center" onPress={(e) => e?.stopPropagation?.()}>
        <Popover open={menuOpen} onOpenChange={(open) => (open ? onOpenMenu() : onCloseMenu())} placement="bottom-end">
          <Popover.Trigger asChild>
            <YStack
              width={32}
              height={32}
              borderRadius={999}
              alignItems="center"
              justifyContent="center"
              cursor="pointer"
              hoverStyle={{ backgroundColor: ui.surfaceMuted }}
            >
              <Icons.MoreVertical size={16} color={ui.textSecondary} />
            </YStack>
          </Popover.Trigger>
          <PopoverContent>
            <YStack minWidth={160} gap={2}>
              <MenuAction ui={ui} label="View details" onPress={onView} />
            </YStack>
          </PopoverContent>
        </Popover>
      </XStack>
    </XStack>
  )
}

function ProductMobileCard({
  ui,
  row,
  currency,
  statusColors,
  onPress,
}: {
  ui: AppUiTokens
  row: ShopListingRow
  currency: string
  statusColors: Record<string, { bg: string; text: string; dot: string }>
  onPress: () => void
}) {
  const tone = listingStatusTone(row.listing_status)
  const palette = statusColors[tone]
  const stock = row.quantity ?? 0

  return (
    <XStack
      gap="$3"
      padding="$3"
      borderRadius={radius.chip}
      borderWidth={1}
      borderColor={ui.borderSubtle}
      backgroundColor={ui.surfaceMuted}
      cursor="pointer"
      pressStyle={{ opacity: 0.85 }}
      onPress={onPress}
    >
      <YStack
        width={56}
        height={56}
        borderRadius={radius.chip}
        overflow="hidden"
        backgroundColor={ui.surface}
        alignItems="center"
        justifyContent="center"
      >
        {row.primary_image_url ? (
          <Image src={row.primary_image_url} width={56} height={56} objectFit="cover" alt="" />
        ) : (
          <Icons.Image size={20} color={ui.textMuted} />
        )}
      </YStack>
      <YStack flex={1} minWidth={0} gap="$1.5">
        <Text fontSize={14} fontWeight="800" color={ui.text} numberOfLines={2}>
          {row.title}
        </Text>
        <Text fontSize={12} color={ui.textMuted}>
          {formatListingPrice(row.price, currency)} · {listingTypeLabel(row.listing_type)}
        </Text>
        <XStack alignItems="center" gap="$2" flexWrap="wrap">
          <XStack
            alignItems="center"
            gap={6}
            paddingHorizontal="$2"
            paddingVertical={3}
            borderRadius={999}
            backgroundColor={palette.bg}
          >
            <YStack width={6} height={6} borderRadius={999} backgroundColor={palette.dot} />
            <Text fontSize={11} fontWeight="700" color={palette.text}>
              {listingStatusLabel(row.listing_status)}
            </Text>
          </XStack>
          {row.listing_type === LISTING_TYPES.PHYSICAL ? (
            <Text fontSize={11.5} fontWeight="600" color={stock <= 0 ? ui.danger : ui.textSecondary}>
              {stock <= 0 ? 'Out of stock' : `${stock} in stock`}
            </Text>
          ) : null}
        </XStack>
      </YStack>
    </XStack>
  )
}

function MenuAction({ ui, label, onPress }: { ui: AppUiTokens; label: string; onPress: () => void }) {
  return (
    <XStack
      paddingHorizontal="$3"
      paddingVertical="$2.5"
      borderRadius={radius.chip}
      cursor="pointer"
      hoverStyle={{ backgroundColor: ui.surfaceMuted }}
      onPress={onPress}
    >
      <Text fontSize={13} fontWeight="600" color={ui.text}>
        {label}
      </Text>
    </XStack>
  )
}
