import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link, useRouter } from 'one'

import {
  Button,
  Checkbox,
  ConfirmDialog,
  Icons,
  Image,
  Input,
  Popover,
  PopoverContent,
  Separator,
  Spinner,
  Text,
  XStack,
  YStack,
  useAppToast,
} from '~/components/ui'
import { radius } from '~/config/tokens'
import { deleteListing, loadShopListings, setListingStatus } from '~/lib/listing/listing.store'
import type { ShopListingRow } from '~/lib/listing/listing.service'
import {
  LISTING_TYPES,
  type ListingStatus,
  type ListingType,
} from '~/lib/listing/listing.type'
import type { VendorCurrencyInfo } from '~/lib/shop/current-shop-utils'
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
  listingStatusActionsFor,
  listingStatusLabel,
  listingStatusTone,
  listingTypeLabel,
} from '~/commerce/screens/vendor/vendor-listings-shared'

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
  /** Old ProductList-style currency bundle (`symbol` / `code` / `formatAmount`). */
  currencyInfo: VendorCurrencyInfo
  isDesktop: boolean
  onOpenListing: (listingId: string) => void
}

export function VendorListingsProductsTab({
  ui,
  shopId,
  currencyInfo,
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
  const [bulkPricePercent, setBulkPricePercent] = useState('')
  const [bulkStockDelta, setBulkStockDelta] = useState('')
  const [bulkCategory, setBulkCategory] = useState('')
  const [bulkUpdating, setBulkUpdating] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<ShopListingRow | null>(null)
  const [deleting, setDeleting] = useState(false)
  const router = useRouter()

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

  async function changeStatus(listingId: string, status: ListingStatus) {
    try {
      await dispatch(setListingStatus({ listingId, status })).unwrap()
      toast.show(`Status set to ${listingStatusLabel(status)}`, { tone: 'success' })
      await fetchPage()
    } catch (error) {
      toast.show('Could not update status', {
        tone: 'danger',
        message: error instanceof Error ? error.message : String(error),
      })
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await dispatch(deleteListing({ listingId: deleteTarget.id })).unwrap()
      toast.show('Product deleted', { tone: 'success' })
      setSelectedIds((current) => {
        const next = new Set(current)
        next.delete(deleteTarget.id)
        return next
      })
      setDeleteTarget(null)
      await fetchPage()
    } catch (error) {
      toast.show('Could not delete product', {
        tone: 'danger',
        message: error instanceof Error ? error.message : String(error),
      })
    } finally {
      setDeleting(false)
    }
  }

  const rowActions = {
    onView: onOpenListing,
    onEdit: (listingId: string) => router.push(vendorRoutes.editListing(listingId)),
    onStatusChange: changeStatus,
    onDelete: (row: ShopListingRow) => setDeleteTarget(row),
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
                PRICE ({currencyInfo.code})
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
                currencyInfo={currencyInfo}
                selected={selectedIds.has(row.id)}
                statusColors={statusColors}
                onToggleSelect={() => toggleOne(row.id)}
                actions={rowActions}
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
                currencyInfo={currencyInfo}
                statusColors={statusColors}
                actions={rowActions}
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

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open && !deleting) setDeleteTarget(null)
        }}
        title="Delete product?"
        description={
          deleteTarget
            ? `“${deleteTarget.title}” will be permanently removed from your catalogue.`
            : undefined
        }
        confirmLabel={deleting ? 'Deleting…' : 'Delete'}
        cancelLabel="Cancel"
        destructive
        onConfirm={() => void confirmDelete()}
      />
    </YStack>
  )
}

type ProductRowActions = {
  onView: (listingId: string) => void
  onEdit: (listingId: string) => void
  onStatusChange: (listingId: string, status: ListingStatus) => void
  onDelete: (row: ShopListingRow) => void
}

function ProductListingActionsMenu({
  ui,
  row,
  actions,
}: {
  ui: AppUiTokens
  row: ShopListingRow
  actions: ProductRowActions
}) {
  const [open, setOpen] = useState(false)
  const statusActions = listingStatusActionsFor(row.listing_status)

  function runAction(callback: () => void) {
    setOpen(false)
    callback()
  }

  return (
    <Popover open={open} onOpenChange={setOpen} placement="bottom-end" allowFlip>
      <Popover.Trigger asChild>
        <YStack
          width={32}
          height={32}
          borderRadius={999}
          alignItems="center"
          justifyContent="center"
          cursor="pointer"
          hoverStyle={{ backgroundColor: ui.surfaceMuted }}
          pressStyle={{ opacity: 0.75 }}
          onPress={(e) => e?.stopPropagation?.()}
        >
          <Icons.MoreVertical size={16} color={ui.textSecondary} />
        </YStack>
      </Popover.Trigger>
      <PopoverContent zIndex={300000} minWidth={220}>
        <YStack gap={2}>
          <MenuActionRow
            ui={ui}
            label="View details"
            icon={<Icons.Eye size={16} color={ui.textSecondary} />}
            onPress={() => runAction(() => actions.onView(row.id))}
          />
          <MenuActionRow
            ui={ui}
            label="Edit"
            icon={<Icons.Pencil size={16} color={ui.textSecondary} />}
            onPress={() => runAction(() => actions.onEdit(row.id))}
          />

          <Separator marginVertical="$1.5" borderColor={ui.borderSubtle} />

          <YStack paddingHorizontal="$1" paddingBottom="$1">
            <Text fontSize={11} fontWeight="700" color={ui.textMuted} letterSpacing={0.4}>
              SET STATUS
            </Text>
          </YStack>

          {statusActions.map((action) => {
            const Icon = action.icon
            const color =
              action.tone === 'success'
                ? '#1F7A45'
                : action.tone === 'warning'
                  ? '#9A6700'
                  : action.tone === 'danger'
                    ? ui.danger
                    : ui.textSecondary
            return (
              <MenuActionRow
                key={action.value}
                ui={ui}
                label={action.label}
                icon={<Icon size={16} color={color} />}
                onPress={() => runAction(() => actions.onStatusChange(row.id, action.value))}
              />
            )
          })}

          <Separator marginVertical="$1.5" borderColor={ui.borderSubtle} />

          <MenuActionRow
            ui={ui}
            label="Delete"
            tone="danger"
            icon={<Icons.Trash2 size={16} color={ui.danger} />}
            onPress={() => runAction(() => actions.onDelete(row))}
          />
        </YStack>
      </PopoverContent>
    </Popover>
  )
}

function MenuActionRow({
  ui,
  label,
  icon,
  tone = 'default',
  onPress,
}: {
  ui: AppUiTokens
  label: string
  icon?: ReactNode
  tone?: 'default' | 'danger'
  onPress: () => void
}) {
  return (
    <XStack
      alignItems="center"
      gap="$2.5"
      paddingHorizontal="$2.5"
      paddingVertical="$2.5"
      borderRadius={radius.chip}
      cursor="pointer"
      hoverStyle={{ backgroundColor: ui.surfaceMuted }}
      pressStyle={{ opacity: 0.85 }}
      onPress={onPress}
    >
      {icon}
      <Text fontSize={13.5} fontWeight="600" color={tone === 'danger' ? ui.danger : ui.text}>
        {label}
      </Text>
    </XStack>
  )
}

function ProductTableRow({
  ui,
  row,
  currencyInfo,
  selected,
  statusColors,
  onToggleSelect,
  actions,
}: {
  ui: AppUiTokens
  row: ShopListingRow
  currencyInfo: VendorCurrencyInfo
  selected: boolean
  statusColors: Record<string, { bg: string; text: string; dot: string }>
  onToggleSelect: () => void
  actions: ProductRowActions
}) {
  const tone = listingStatusTone(row.listing_status)
  const palette = statusColors[tone]
  const stock = row.quantity ?? 0
  const isOutOfStock = row.listing_type === LISTING_TYPES.PHYSICAL && stock <= 0
  const priceLabel =
    row.price == null || Number(row.price) === 0
      ? 'Free'
      : currencyInfo.formatAmount(row.price)

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
      onPress={() => actions.onView(row.id)}
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
            SKU: {row.sku?.trim() || listingSkuFallback(row.slug, row.id)}
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
        {priceLabel}
      </Text>

      <Text flex={0.9} fontSize={13} fontWeight="700" color={isOutOfStock ? ui.danger : ui.text}>
        {row.listing_type === LISTING_TYPES.DIGITAL || row.listing_type === LISTING_TYPES.SERVICE
          ? '—'
          : isOutOfStock
            ? '0'
            : `${stock} in stock`}
      </Text>

      <XStack flex={0.9} gap="$1.5" flexWrap="wrap" alignItems="center">
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
        {!row.is_active ? (
          <XStack
            paddingHorizontal="$2"
            paddingVertical={3}
            borderRadius={999}
            backgroundColor="#FFF0E1"
          >
            <Text fontSize={10.5} fontWeight="700" color="#B45309">
              Hidden
            </Text>
          </XStack>
        ) : null}
      </XStack>

      <XStack width={44} justifyContent="center" onPress={(e) => e?.stopPropagation?.()}>
        <ProductListingActionsMenu ui={ui} row={row} actions={actions} />
      </XStack>
    </XStack>
  )
}

function ProductMobileCard({
  ui,
  row,
  currencyInfo,
  statusColors,
  actions,
}: {
  ui: AppUiTokens
  row: ShopListingRow
  currencyInfo: VendorCurrencyInfo
  statusColors: Record<string, { bg: string; text: string; dot: string }>
  actions: ProductRowActions
}) {
  const tone = listingStatusTone(row.listing_status)
  const palette = statusColors[tone]
  const stock = row.quantity ?? 0
  const priceLabel =
    row.price == null || Number(row.price) === 0
      ? 'Free'
      : currencyInfo.formatAmount(row.price)

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
      onPress={() => actions.onView(row.id)}
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
        <XStack alignItems="flex-start" justifyContent="space-between" gap="$2">
          <Text flex={1} fontSize={14} fontWeight="800" color={ui.text} numberOfLines={2}>
            {row.title}
          </Text>
          <YStack onPress={(e) => e?.stopPropagation?.()}>
            <ProductListingActionsMenu ui={ui} row={row} actions={actions} />
          </YStack>
        </XStack>
        <Text fontSize={12} color={ui.textMuted}>
          {priceLabel} · {listingTypeLabel(row.listing_type)}
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
          {!row.is_active ? (
            <XStack paddingHorizontal="$2" paddingVertical={3} borderRadius={999} backgroundColor="#FFF0E1">
              <Text fontSize={10.5} fontWeight="700" color="#B45309">
                Hidden
              </Text>
            </XStack>
          ) : null}
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
