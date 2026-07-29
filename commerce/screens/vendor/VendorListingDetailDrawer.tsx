import { useEffect, useMemo, useState } from 'react'
import { Platform } from 'react-native'
import { AppLink } from '~/components/navigation'
import {
  Button,
  Icons,
  Image,
  ScrollView,
  Spinner,
  Switch,
  Text,
  XStack,
  YStack,
  useAppToast,
} from '~/components/ui'
import { getShadowStyle, radius } from '~/config/tokens'
import { useLockBodyScroll } from '~/hooks/useLockBodyScroll'
import { useVendorCurrency } from '~/hooks/useVendorCurrency'
import { loadListingCategories } from '~/lib/listing/listing-categories.store'
import { loadListingDetails } from '~/lib/listing/listing.store'
import type { ListingDetails } from '~/lib/listing/listing.service'
import { getPrimaryListingImage } from '~/lib/listing/listing.utils'
import { getCurrencyName } from '~/lib/shop/current-shop-utils'
import { overlayBackdropStyle } from '~/lib/layout/styles'
import { commerceRoutes, vendorRoutes } from '~/lib/routes'
import { useAppDispatch, useAppSelector } from '~/lib/store/hooks'
import type { AppUiTokens } from '~/lib/theme/app-ui'

import {
  listingSkuFallback,
  listingStatusLabel,
  listingTypeLabel,
} from '~/commerce/screens/vendor/vendor-listings-shared'

const PANEL_WIDTH = 720

type DetailTab = 'overview' | 'attributes' | 'variations' | 'materials' | 'categories' | 'media'

const DETAIL_TABS: { id: DetailTab; label: string; icon: (typeof Icons)[keyof typeof Icons] }[] = [
  { id: 'overview', label: 'Overview', icon: Icons.LayoutGrid },
  { id: 'attributes', label: 'Attributes', icon: Icons.List },
  { id: 'variations', label: 'Variations', icon: Icons.Layers },
  { id: 'materials', label: 'Materials', icon: Icons.Package },
  { id: 'categories', label: 'Categories', icon: Icons.Tags },
  { id: 'media', label: 'Media', icon: Icons.Image },
]

type ParsedImage = { url: string; alt?: string; isPrimary?: boolean; displayOrder?: number }
type ParsedAttribute = { name: string; value: string }
type ParsedVariation = {
  id?: string
  name: string
  value: string
  sku?: string | null
  stock?: number | null
  priceAdjustment?: number | null
  isAvailable?: boolean | null
}
type ParsedMaterial = {
  id?: string
  name: string
  percentage?: number | null
  isPrimary?: boolean
  isSustainable?: boolean
  certification?: string | null
}

type VendorListingDetailDrawerProps = {
  ui: AppUiTokens
  open: boolean
  listingId: string | null
  currency: string
  isDesktop: boolean
  safeBottom: number
  onClose: () => void
}

export function VendorListingDetailDrawer({
  ui,
  open,
  listingId,
  currency,
  isDesktop,
  safeBottom,
  onClose,
}: VendorListingDetailDrawerProps) {
  const dispatch = useAppDispatch()
  useAppToast()
  useLockBodyScroll(open)
  const { formatAmount, resolveCurrency } = useVendorCurrency()

  const listing = useAppSelector((s) => s.listing.currentListing)
  const isLoading = useAppSelector((s) => s.listing.isLoadingDetails)
  const listingCategories = useAppSelector((s) =>
    listingId ? (s.categories.listingCategories[listingId] ?? []) : [],
  )

  const [activeTab, setActiveTab] = useState<DetailTab>('overview')

  useEffect(() => {
    if (!open || !listingId) return
    setActiveTab('overview')
    void dispatch(loadListingDetails({ listingId }))
    void dispatch(loadListingCategories(listingId))
  }, [dispatch, listingId, open])

  const shopCurrency = resolveCurrency(listing?.shop_currency, currency)

  const images = useMemo(() => parseImages(listing), [listing])
  const attributes = useMemo(() => parseAttributes(listing), [listing])
  const variations = useMemo(() => parseVariations(listing), [listing])
  const materials = useMemo(() => parseMaterials(listing), [listing])
  const metadata = useMemo(() => parseListingMetadata(listing), [listing])

  if (!open) return null

  const previewHref = listing?.slug
    ? commerceRoutes.listing(listing.slug)
    : listing?.id
      ? commerceRoutes.listing(listing.id)
      : null

  return (
    <>
      <YStack
        key="listing-detail-backdrop"
        style={overlayBackdropStyle()}
        zIndex={100000}
        onPress={onClose}
      />
      <YStack
        key="listing-detail-panel"
        position="fixed"
        top={0}
        right={0}
        bottom={0}
        width={isDesktop ? PANEL_WIDTH : '100%'}
        maxWidth="100%"
        zIndex={100001}
        backgroundColor={ui.background}
        borderLeftWidth={isDesktop ? 1 : 0}
        borderLeftColor={ui.borderSubtle}
        style={getShadowStyle('lg')}
      >
        <XStack
          alignItems="center"
          justifyContent="space-between"
          paddingHorizontal="$4"
          paddingTop="$4"
          paddingBottom="$3"
          borderBottomWidth={1}
          borderBottomColor={ui.borderSubtle}
          backgroundColor={ui.surface}
        >
          <YStack gap={2} flex={1} minWidth={0}>
            <Text fontSize={11} fontWeight="700" color={ui.textMuted} letterSpacing={0.4}>
              PRODUCT DETAILS
            </Text>
            <Text fontSize={18} fontWeight="800" color={ui.text} numberOfLines={1}>
              {listing?.title ?? 'Loading product…'}
            </Text>
          </YStack>
          <YStack
            width={36}
            height={36}
            borderRadius={999}
            alignItems="center"
            justifyContent="center"
            cursor="pointer"
            hoverStyle={{ backgroundColor: ui.surfaceMuted }}
            onPress={onClose}
          >
            <Icons.X size={18} color={ui.text} />
          </YStack>
        </XStack>

        {isLoading && !listing ? (
          <YStack flex={1} alignItems="center" justifyContent="center">
            <Spinner size="large" color={ui.brand} />
          </YStack>
        ) : listing ? (
          <YStack flex={1} minHeight={0}>
            <ScrollView
              flex={1}
              minHeight={0}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{
                paddingBottom: 24 + safeBottom,
                flexGrow: 1,
                ...(Platform.OS === 'web' ? { overscrollBehavior: 'contain' as const } : {}),
              }}
            >
              <YStack gap="$4" padding="$4">
                <ListingHero
                  ui={ui}
                  listing={listing}
                  shopCurrency={shopCurrency}
                  formatAmount={formatAmount}
                  images={images}
                />

                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <XStack gap="$2">
                    {DETAIL_TABS.map((tab) => {
                      const Icon = tab.icon
                      const active = activeTab === tab.id
                      return (
                        <XStack
                          key={tab.id}
                          alignItems="center"
                          gap="$1.5"
                          paddingHorizontal="$3"
                          paddingVertical="$2.5"
                          borderRadius={999}
                          cursor="pointer"
                          borderBottomWidth={active ? 2 : 0}
                          borderBottomColor={ui.brand}
                          backgroundColor={active ? ui.roseSurface : 'transparent'}
                          onPress={() => setActiveTab(tab.id)}
                        >
                          <Icon size={14} color={active ? ui.brand : ui.textSecondary} />
                          <Text fontSize={12.5} fontWeight="800" color={active ? ui.brand : ui.textSecondary}>
                            {tab.label}
                          </Text>
                        </XStack>
                      )
                    })}
                  </XStack>
                </ScrollView>

                <TabContent
                  ui={ui}
                  tab={activeTab}
                  listing={listing}
                  shopCurrency={shopCurrency}
                  formatAmount={formatAmount}
                  images={images}
                  attributes={attributes}
                  variations={variations}
                  materials={materials}
                  metadata={metadata}
                  categories={listingCategories}
                />
              </YStack>
            </ScrollView>

            <XStack
              alignItems="center"
              justifyContent={isDesktop ? 'space-between' : 'stretch'}
              gap="$3"
              paddingHorizontal="$4"
              paddingTop="$3"
              paddingBottom={16 + safeBottom}
              borderTopWidth={1}
              borderTopColor={ui.borderSubtle}
              backgroundColor={ui.surface}
            >
              {isDesktop ? (
                <Text fontSize={12} color={ui.textMuted}>
                  Changes are saved from the listing editor when it is available.
                </Text>
              ) : null}
              <XStack gap="$2" flex={isDesktop ? undefined : 1}>
                {previewHref ? (
                  <AppLink href={previewHref} asChild>
                    <Button tone="outline" size="$3" borderRadius={999} flex={isDesktop ? undefined : 1}>
                      Preview
                    </Button>
                  </AppLink>
                ) : null}
                {listingId ? (
                  <AppLink href={vendorRoutes.editListing(listingId)} asChild>
                    <Button tone="primary" size="$3" borderRadius={999} flex={isDesktop ? undefined : 1}>
                      Edit
                    </Button>
                  </AppLink>
                ) : null}
              </XStack>
            </XStack>
          </YStack>
        ) : (
          <YStack flex={1} alignItems="center" justifyContent="center" padding="$6" gap="$2">
            <Text fontSize={15} fontWeight="700" color={ui.text}>
              Could not load this product
            </Text>
            <Button tone="outline" size="$3" borderRadius={999} onPress={onClose}>
              Close
            </Button>
          </YStack>
        )}
      </YStack>
    </>
  )
}

function ListingHero({
  ui,
  listing,
  shopCurrency,
  formatAmount,
  images,
}: {
  ui: AppUiTokens
  listing: ListingDetails
  shopCurrency: string
  formatAmount: ReturnType<typeof useVendorCurrency>['formatAmount']
  images: ParsedImage[]
}) {
  const hero = images[0]?.url ?? getPrimaryListingImage(listing as never)
  const stock = listing.quantity ?? listing.stock ?? 0
  const lowStock = stock > 0 && stock <= 5
  const sku = listing.sku?.trim() || listingSkuFallback(listing.slug, listing.id ?? '')
  const basePrice =
    listing.price == null || Number(listing.price) === 0
      ? 'Free'
      : formatAmount(listing.price, { showCode: true })

  return (
    <YStack
      gap="$4"
      padding="$4"
      borderRadius={radius.card}
      borderWidth={1}
      borderColor={ui.borderSubtle}
      backgroundColor={ui.surface}
      style={getShadowStyle('sm')}
    >
      <XStack gap="$4" flexWrap="wrap" alignItems="flex-start">
        <YStack gap="$2" width={220} flexShrink={0} $sm={{ width: '100%' }}>
          <YStack
            width="100%"
            aspectRatio={1}
            borderRadius={radius.card}
            overflow="hidden"
            backgroundColor={ui.surfaceMuted}
            alignItems="center"
            justifyContent="center"
          >
            {hero ? (
              <Image src={hero} width="100%" height="100%" objectFit="cover" alt="" />
            ) : (
              <Icons.Image size={36} color={ui.textMuted} />
            )}
          </YStack>
          {images.length > 1 ? (
            <XStack gap="$2" flexWrap="wrap">
              {images.slice(0, 4).map((image, index) => (
                <YStack
                  key={`${image.url}-${index}`}
                  width={52}
                  height={52}
                  borderRadius={radius.chip}
                  overflow="hidden"
                  borderWidth={image.isPrimary ? 2 : 1}
                  borderColor={image.isPrimary ? ui.brand : ui.borderSubtle}
                >
                  <Image src={image.url} width={52} height={52} objectFit="cover" alt="" />
                </YStack>
              ))}
            </XStack>
          ) : null}
        </YStack>

        <YStack flex={1} minWidth={240} gap="$3">
          <XStack alignItems="center" justifyContent="space-between" gap="$2" flexWrap="wrap">
            <XStack gap="$2" flexWrap="wrap">
              <StatusPill ui={ui} label={listingStatusLabel(listing.listing_status)} tone="brand" />
              {listing.is_featured ? <StatusPill ui={ui} label="Featured" tone="gold" /> : null}
              {!listing.is_active ? <StatusPill ui={ui} label="Hidden" tone="warning" /> : null}
              <StatusPill ui={ui} label={shopCurrency} tone="neutral" />
            </XStack>
            <Text fontSize={11.5} color={ui.textMuted} fontWeight="600">
              Last updated: {formatUpdatedAt(listing.updated_at)}
            </Text>
          </XStack>

          <Text fontSize={24} fontWeight="800" color={ui.text} letterSpacing={-0.5}>
            {listing.title}
          </Text>
          <Text fontSize={12.5} color={ui.textSecondary} fontWeight="600">
            SKU: {sku}
          </Text>
          {listing.shop_name ? (
            <Text fontSize={12} color={ui.textMuted} fontWeight="600">
              Shop: {listing.shop_name}
              {listing.shop_verified ? ' · Verified' : ''}
            </Text>
          ) : null}

          <XStack
            gap="$3"
            padding="$3"
            borderRadius={radius.chip}
            borderWidth={1}
            borderColor={ui.borderSubtle}
            backgroundColor={ui.surfaceMuted}
            flexWrap="wrap"
          >
            <YStack flex={1} minWidth={120} gap={4}>
              <Text fontSize={11} fontWeight="700" color={ui.textMuted}>
                SELLING PRICE ({shopCurrency})
              </Text>
              <Text fontSize={22} fontWeight="800" color={ui.text}>
                {basePrice}
              </Text>
              <Text fontSize={11} color={ui.textMuted}>
                {getCurrencyName(shopCurrency)}
              </Text>
            </YStack>
            <YStack flex={1} minWidth={120} gap={4}>
              <Text fontSize={11} fontWeight="700" color={ui.textMuted}>
                AVAILABLE STOCK
              </Text>
              <XStack alignItems="center" gap="$2" flexWrap="wrap">
                <Text fontSize={22} fontWeight="800" color={ui.text}>
                  {stock} Units
                </Text>
                {lowStock ? <StatusPill ui={ui} label="Low Stock Alert" tone="warning" /> : null}
              </XStack>
            </YStack>
          </XStack>

          <XStack
            alignItems="center"
            justifyContent="space-between"
            gap="$3"
            padding="$3"
            borderRadius={radius.chip}
            backgroundColor="#FFF8EE"
          >
            <YStack flex={1} gap={2}>
              <Text fontSize={13} fontWeight="800" color={ui.text}>
                Storefront Visibility
              </Text>
              <Text fontSize={12} color={ui.textSecondary}>
                Hide or show this product to customers
              </Text>
            </YStack>
            <Switch checked={Boolean(listing.is_active)} disabled />
          </XStack>

          {listing.description ? (
            <YStack gap="$1.5">
              <Text fontSize={12} fontWeight="800" color={ui.textMuted} letterSpacing={0.4}>
                SHORT SUMMARY
              </Text>
              <Text fontSize={13.5} color={ui.textSecondary} lineHeight={21}>
                {stripHtml(listing.description).slice(0, 280)}
                {stripHtml(listing.description).length > 280 ? '…' : ''}
              </Text>
            </YStack>
          ) : null}
        </YStack>
      </XStack>
    </YStack>
  )
}

function TabContent({
  ui,
  tab,
  listing,
  shopCurrency,
  formatAmount,
  images,
  attributes,
  variations,
  materials,
  metadata,
  categories,
}: {
  ui: AppUiTokens
  tab: DetailTab
  listing: ListingDetails
  shopCurrency: string
  formatAmount: ReturnType<typeof useVendorCurrency>['formatAmount']
  images: ParsedImage[]
  attributes: ParsedAttribute[]
  variations: ParsedVariation[]
  materials: ParsedMaterial[]
  metadata: ListingMetadataFields
  categories: { category_id: string; is_primary?: boolean | null }[]
}) {
  if (tab === 'overview') {
    return (
      <YStack gap="$4">
        <YStack gap="$3">
          <Text fontSize={15} fontWeight="800" color={ui.text}>
            Product Narrative
          </Text>
          <Text fontSize={14} color={ui.textSecondary} lineHeight={22}>
            {stripHtml(listing.description ?? '') || 'No description added yet.'}
          </Text>
        </YStack>

        <DetailGrid
          ui={ui}
          title="Listing Details"
          rows={[
            { label: 'Listing type', value: listingTypeLabel(listing.listing_type) },
            { label: 'Status', value: listingStatusLabel(listing.listing_status) },
            { label: 'Slug', value: listing.slug ?? '—' },
            {
              label: 'SKU',
              value: listing.sku?.trim() || listingSkuFallback(listing.slug, listing.id ?? ''),
            },
            {
              label: 'Base price',
              value:
                listing.price == null || Number(listing.price) === 0
                  ? 'Free'
                  : formatAmount(listing.price, { showCode: true }),
            },
            { label: 'Shop currency', value: shopCurrency },
            { label: 'Quantity', value: String(listing.quantity ?? listing.stock ?? 0) },
            { label: 'Stock', value: String(listing.stock ?? listing.quantity ?? 0) },
            {
              label: 'Min order quantity',
              value: metadata.minOrderQuantity != null ? String(metadata.minOrderQuantity) : '—',
            },
            {
              label: 'Weight',
              value: listing.weight != null ? `${listing.weight} kg` : '—',
            },
            {
              label: 'Dimensions',
              value: formatDimensions(listing.dimensions),
            },
            {
              label: 'Shipping required',
              value: listing.shipping_required == null ? '—' : listing.shipping_required ? 'Yes' : 'No',
            },
            { label: 'Featured', value: listing.is_featured ? 'Yes' : 'No' },
            { label: 'Storefront visible', value: listing.is_active ? 'Yes' : 'No' },
            {
              label: 'Published',
              value: formatDateTime(listing.published_at),
            },
            { label: 'Created', value: formatDateTime(listing.created_at) },
            { label: 'Updated', value: formatDateTime(listing.updated_at) },
          ]}
        />

        {(listing.meta_title || listing.meta_description) ? (
          <DetailGrid
            ui={ui}
            title="SEO"
            rows={[
              { label: 'Meta title', value: listing.meta_title?.trim() || '—' },
              { label: 'Meta description', value: listing.meta_description?.trim() || '—' },
            ]}
          />
        ) : null}

        {listing.tags?.length ? (
          <YStack gap="$2">
            <Text fontSize={15} fontWeight="800" color={ui.text}>
              Tags
            </Text>
            <XStack gap="$2" flexWrap="wrap">
              {listing.tags.map((tag) => (
                <XStack
                  key={tag}
                  paddingHorizontal="$2.5"
                  paddingVertical={4}
                  borderRadius={999}
                  backgroundColor={ui.surfaceMuted}
                >
                  <Text fontSize={12} fontWeight="600" color={ui.textSecondary}>
                    {tag}
                  </Text>
                </XStack>
              ))}
            </XStack>
          </YStack>
        ) : null}

        {listing.listing_type === 'digital' ? (
          <DetailGrid
            ui={ui}
            title="Digital Delivery"
            rows={[
              { label: 'File URL', value: listing.digital_file_url ?? '—' },
              {
                label: 'File size',
                value: listing.digital_file_size != null ? `${listing.digital_file_size} bytes` : '—',
              },
              { label: 'File type', value: listing.digital_file_type ?? '—' },
              {
                label: 'Download limit',
                value: listing.download_limit != null ? String(listing.download_limit) : 'Unlimited',
              },
            ]}
          />
        ) : null}

        {listing.listing_type === 'service' ? (
          <DetailGrid
            ui={ui}
            title="Service Settings"
            rows={[
              {
                label: 'Duration',
                value:
                  listing.booking_duration_minutes != null
                    ? `${listing.booking_duration_minutes} min`
                    : '—',
              },
              { label: 'Meeting URL', value: listing.meeting_url ?? '—' },
              { label: 'Max attendees', value: String(listing.max_attendees ?? 1) },
              {
                label: 'Requires approval',
                value: listing.requires_approval ? 'Yes' : 'No',
              },
              {
                label: 'Online service',
                value: listing.is_online == null ? '—' : listing.is_online ? 'Yes' : 'No',
              },
            ]}
          />
        ) : null}
      </YStack>
    )
  }

  if (tab === 'attributes') {
    return <KeyValuePanel ui={ui} title="Quick Specifications" rows={attributes} empty="No attributes yet." />
  }

  if (tab === 'variations') {
    return (
      <VariationsPanel
        ui={ui}
        variations={variations}
        basePrice={listing.price}
        formatAmount={formatAmount}
        shopCurrency={shopCurrency}
      />
    )
  }

  if (tab === 'materials') {
    return <MaterialsPanel ui={ui} materials={materials} />
  }

  if (tab === 'categories') {
    return (
      <YStack gap="$2">
        <Text fontSize={15} fontWeight="800" color={ui.text}>
          Categories
        </Text>
        {categories.length === 0 ? (
          <Text fontSize={13} color={ui.textSecondary}>
            No categories assigned yet.
          </Text>
        ) : (
          <XStack gap="$2" flexWrap="wrap">
            {categories.map((category) => (
              <XStack
                key={category.category_id}
                paddingHorizontal="$3"
                paddingVertical="$2"
                borderRadius={999}
                backgroundColor={category.is_primary ? ui.brand : ui.surfaceMuted}
              >
                <Text fontSize={12} fontWeight="700" color={category.is_primary ? ui.onBrand : ui.text}>
                  {category.category_id}
                  {category.is_primary ? ' · Primary' : ''}
                </Text>
              </XStack>
            ))}
          </XStack>
        )}
      </YStack>
    )
  }

  return (
    <YStack gap="$3">
      <Text fontSize={15} fontWeight="800" color={ui.text}>
        Media ({images.length})
      </Text>
      {images.length === 0 ? (
        <Text fontSize={13} color={ui.textSecondary}>
          No images uploaded yet.
        </Text>
      ) : (
        <YStack gap="$3">
          {images.map((image, index) => (
            <XStack
              key={`${image.url}-${index}`}
              gap="$3"
              alignItems="center"
              padding="$2.5"
              borderRadius={radius.chip}
              borderWidth={1}
              borderColor={ui.borderSubtle}
              backgroundColor={ui.surface}
            >
              <YStack
                width={80}
                height={80}
                borderRadius={radius.chip}
                overflow="hidden"
                borderWidth={image.isPrimary ? 2 : 1}
                borderColor={image.isPrimary ? ui.brand : ui.borderSubtle}
              >
                <Image src={image.url} width={80} height={80} objectFit="cover" alt="" />
              </YStack>
              <YStack flex={1} gap={4}>
                <Text fontSize={13} fontWeight="700" color={ui.text}>
                  {image.alt?.trim() || `Image ${index + 1}`}
                </Text>
                <Text fontSize={12} color={ui.textMuted}>
                  {image.isPrimary ? 'Primary · ' : ''}
                  Order {image.displayOrder ?? index}
                </Text>
              </YStack>
            </XStack>
          ))}
        </YStack>
      )}
    </YStack>
  )
}

function VariationsPanel({
  ui,
  variations,
  basePrice,
  formatAmount,
  shopCurrency,
}: {
  ui: AppUiTokens
  variations: ParsedVariation[]
  basePrice: number | null | undefined
  formatAmount: ReturnType<typeof useVendorCurrency>['formatAmount']
  shopCurrency: string
}) {
  const base = Number(basePrice ?? 0)

  return (
    <YStack
      borderRadius={radius.card}
      borderWidth={1}
      borderColor={ui.borderSubtle}
      overflow="hidden"
      backgroundColor={ui.surface}
    >
      <XStack padding="$3" backgroundColor="#FFF8EE" justifyContent="space-between" alignItems="center">
        <Text fontSize={13} fontWeight="800" color={ui.text}>
          Variations ({variations.length})
        </Text>
        <Text fontSize={11.5} fontWeight="600" color={ui.textMuted}>
          Base price: {base === 0 ? 'Free' : formatAmount(base, { showCode: true })} · {shopCurrency}
        </Text>
      </XStack>

      {variations.length === 0 ? (
        <Text fontSize={13} color={ui.textSecondary} padding="$3">
          No variations configured.
        </Text>
      ) : (
        variations.map((variation, index) => {
          const adjustment = Number(variation.priceAdjustment ?? 0)
          const finalPrice = base + (Number.isFinite(adjustment) ? adjustment : 0)
          const priceLabel =
            finalPrice === 0 && base === 0
              ? 'Free'
              : formatAmount(finalPrice, { showCode: true })
          const adjustmentLabel =
            adjustment === 0
              ? '—'
              : `${adjustment > 0 ? '+' : ''}${formatAmount(adjustment, { showCode: true })}`

          return (
            <YStack
              key={variation.id ?? `${variation.name}-${variation.value}-${index}`}
              padding="$3"
              borderTopWidth={1}
              borderTopColor={ui.borderSubtle}
              gap="$2.5"
            >
              <XStack justifyContent="space-between" alignItems="flex-start" gap="$3" flexWrap="wrap">
                <YStack gap={4} flex={1} minWidth={160}>
                  <Text fontSize={14} fontWeight="800" color={ui.text}>
                    {variation.name.trim()}: {variation.value.trim()}
                  </Text>
                  {variation.id ? (
                    <Text fontSize={11} color={ui.textMuted} fontWeight="600">
                      ID: {variation.id}
                    </Text>
                  ) : null}
                </YStack>
                <StatusPill
                  ui={ui}
                  label={variation.isAvailable === false ? 'Unavailable' : 'Available'}
                  tone={variation.isAvailable === false ? 'warning' : 'brand'}
                />
              </XStack>

              <XStack gap="$3" flexWrap="wrap">
                <VariationStat ui={ui} label="Final price" value={priceLabel} />
                <VariationStat ui={ui} label="Price adjustment" value={adjustmentLabel} />
                <VariationStat
                  ui={ui}
                  label="Stock"
                  value={variation.stock != null ? String(variation.stock) : '—'}
                />
                <VariationStat ui={ui} label="SKU" value={variation.sku?.trim() || '—'} />
              </XStack>
            </YStack>
          )
        })
      )}
    </YStack>
  )
}

function VariationStat({ ui, label, value }: { ui: AppUiTokens; label: string; value: string }) {
  return (
    <YStack minWidth={120} gap={2}>
      <Text fontSize={10.5} fontWeight="700" color={ui.textMuted} letterSpacing={0.3}>
        {label.toUpperCase()}
      </Text>
      <Text fontSize={13} fontWeight="700" color={ui.text}>
        {value}
      </Text>
    </YStack>
  )
}

function MaterialsPanel({ ui, materials }: { ui: AppUiTokens; materials: ParsedMaterial[] }) {
  return (
    <YStack
      borderRadius={radius.card}
      borderWidth={1}
      borderColor={ui.borderSubtle}
      overflow="hidden"
      backgroundColor={ui.surface}
    >
      <XStack padding="$3" backgroundColor="#FFF8EE">
        <Text fontSize={13} fontWeight="800" color={ui.text}>
          Materials ({materials.length})
        </Text>
      </XStack>

      {materials.length === 0 ? (
        <Text fontSize={13} color={ui.textSecondary} padding="$3">
          No materials listed.
        </Text>
      ) : (
        materials.map((material, index) => (
          <YStack
            key={material.id ?? `${material.name}-${index}`}
            padding="$3"
            borderTopWidth={index === 0 ? 0 : 1}
            borderTopColor={ui.borderSubtle}
            gap="$2"
          >
            <XStack justifyContent="space-between" alignItems="center" gap="$2" flexWrap="wrap">
              <Text fontSize={14} fontWeight="800" color={ui.text}>
                {material.name}
              </Text>
              <XStack gap="$2" flexWrap="wrap">
                {material.isPrimary ? <StatusPill ui={ui} label="Primary" tone="brand" /> : null}
                {material.isSustainable ? <StatusPill ui={ui} label="Sustainable" tone="gold" /> : null}
              </XStack>
            </XStack>
            <XStack gap="$3" flexWrap="wrap">
              <VariationStat
                ui={ui}
                label="Percentage"
                value={material.percentage != null ? `${material.percentage}%` : '—'}
              />
              <VariationStat
                ui={ui}
                label="Certification"
                value={material.certification?.trim() || '—'}
              />
            </XStack>
          </YStack>
        ))
      )}
    </YStack>
  )
}

function DetailGrid({
  ui,
  title,
  rows,
}: {
  ui: AppUiTokens
  title: string
  rows: { label: string; value: string }[]
}) {
  return (
    <YStack
      borderRadius={radius.card}
      borderWidth={1}
      borderColor={ui.borderSubtle}
      overflow="hidden"
      backgroundColor={ui.surface}
    >
      <XStack padding="$3" backgroundColor="#FFF8EE">
        <Text fontSize={13} fontWeight="800" color={ui.text}>
          {title}
        </Text>
      </XStack>
      {rows.map((row, index) => (
        <XStack
          key={row.label}
          paddingHorizontal="$3"
          paddingVertical="$2.5"
          borderTopWidth={index === 0 ? 0 : 1}
          borderTopColor={ui.borderSubtle}
          justifyContent="space-between"
          gap="$3"
          flexWrap="wrap"
        >
          <Text fontSize={13} fontWeight="700" color={ui.textSecondary} minWidth={140}>
            {row.label}
          </Text>
          <Text fontSize={13} fontWeight="700" color={ui.text} flex={1} textAlign="right">
            {row.value}
          </Text>
        </XStack>
      ))}
    </YStack>
  )
}

function KeyValuePanel({
  ui,
  title,
  rows,
  empty,
}: {
  ui: AppUiTokens
  title: string
  rows: ParsedAttribute[]
  empty: string
}) {
  return (
    <YStack
      borderRadius={radius.card}
      borderWidth={1}
      borderColor={ui.borderSubtle}
      overflow="hidden"
      backgroundColor={ui.surface}
    >
      <XStack padding="$3" backgroundColor="#FFF8EE">
        <Text fontSize={13} fontWeight="800" color={ui.text}>
          {title}
        </Text>
      </XStack>
      {rows.length === 0 ? (
        <Text fontSize={13} color={ui.textSecondary} padding="$3">
          {empty}
        </Text>
      ) : (
        rows.map((row, index) => (
          <XStack
            key={`${row.name}-${index}`}
            paddingHorizontal="$3"
            paddingVertical="$2.5"
            borderTopWidth={index === 0 ? 0 : 1}
            borderTopColor={ui.borderSubtle}
            justifyContent="space-between"
            gap="$3"
          >
            <Text fontSize={13} fontWeight="700" color={ui.textSecondary}>
              {row.name}
            </Text>
            <Text fontSize={13} fontWeight="700" color={ui.text} textAlign="right" flex={1}>
              {row.value}
            </Text>
          </XStack>
        ))
      )}
    </YStack>
  )
}

function StatusPill({
  ui,
  label,
  tone,
}: {
  ui: AppUiTokens
  label: string
  tone: 'brand' | 'gold' | 'warning' | 'neutral'
}) {
  const styles =
    tone === 'gold'
      ? { bg: '#FFF4D6', color: '#9A6700' }
      : tone === 'warning'
        ? { bg: '#FFF0E1', color: '#B45309' }
        : tone === 'neutral'
          ? { bg: ui.surfaceMuted, color: ui.textSecondary }
          : { bg: ui.roseSurface, color: ui.brand }

  return (
    <XStack paddingHorizontal="$2.5" paddingVertical={4} borderRadius={999} backgroundColor={styles.bg}>
      <Text fontSize={10.5} fontWeight="800" color={styles.color} letterSpacing={0.3}>
        {label.toUpperCase()}
      </Text>
    </XStack>
  )
}

type ListingMetadataFields = {
  minOrderQuantity?: number | null
}

function parseListingMetadata(listing: ListingDetails | null): ListingMetadataFields {
  const meta = asRecord(listing?.listing_metadata)
  const minOrderQuantity = readNumber(meta?.min_order_quantity)
  return { minOrderQuantity }
}

function parseImages(listing: ListingDetails | null): ParsedImage[] {
  const fromView = parseImageRows(listing?.images, 'image_url', 'alt_text')
  const meta = asRecord(listing?.listing_metadata)
  const fromMeta = parseImageRows(meta?.images, 'url', 'alt')
  const merged = new Map<string, ParsedImage>()

  for (const image of [...fromView, ...fromMeta]) {
    if (!image.url.startsWith('blob:')) {
      merged.set(image.url, image)
    } else if (!merged.has(image.url)) {
      merged.set(image.url, image)
    }
  }

  return [...merged.values()].sort((a, b) => {
    if (Boolean(a.isPrimary) !== Boolean(b.isPrimary)) return a.isPrimary ? -1 : 1
    return (a.displayOrder ?? 0) - (b.displayOrder ?? 0)
  })
}

function parseImageRows(
  raw: unknown,
  urlKey: string,
  altKey: string,
): ParsedImage[] {
  if (!Array.isArray(raw)) return []
  return raw
    .map((item) => {
      if (!item || typeof item !== 'object') return null
      const row = item as Record<string, unknown>
      const url = typeof row[urlKey] === 'string' ? row[urlKey] : null
      if (!url) return null
      return {
        url,
        alt: typeof row[altKey] === 'string' ? row[altKey] : undefined,
        isPrimary: Boolean(row.is_primary ?? row.isPrimary),
        displayOrder: readNumber(row.display_order ?? row.displayOrder) ?? undefined,
      }
    })
    .filter((item): item is ParsedImage => Boolean(item))
}

function parseAttributes(listing: ListingDetails | null): ParsedAttribute[] {
  return parseNameValueCollection(listing?.attributes, {
    nameKeys: ['attribute_name', 'name'],
    valueKeys: ['attribute_value', 'value'],
  })
}

function parseVariations(listing: ListingDetails | null): ParsedVariation[] {
  const fromView = parseVariationArray(listing?.variations)
  const meta = asRecord(listing?.listing_metadata)
  const fromMeta = parseVariationArray(meta?.variations)
  return mergeById(fromView, fromMeta)
}

function parseMaterials(listing: ListingDetails | null): ParsedMaterial[] {
  const fromView = parseMaterialArray(listing?.materials)
  const meta = asRecord(listing?.listing_metadata)
  const fromMeta = parseMaterialArray(meta?.materials)
  return mergeById(fromView, fromMeta)
}

function parseVariationArray(raw: unknown): ParsedVariation[] {
  if (!Array.isArray(raw)) return []
  return raw
    .map((item) => {
      if (!item || typeof item !== 'object') return null
      const row = item as Record<string, unknown>
      const name = readString(row.variation_name ?? row.name)
      const value = readString(row.variation_value ?? row.value)
      if (!name && !value) return null
      return {
        id: readString(row.id) ?? undefined,
        name: name || 'Option',
        value: value || '—',
        sku: readString(row.sku),
        stock: readNumber(row.stock),
        priceAdjustment: readNumber(row.price_adjustment ?? row.priceAdjustment),
        isAvailable:
          row.is_available === undefined && row.isAvailable === undefined
            ? null
            : Boolean(row.is_available ?? row.isAvailable),
      }
    })
    .filter((item): item is ParsedVariation => Boolean(item))
}

function parseMaterialArray(raw: unknown): ParsedMaterial[] {
  if (!Array.isArray(raw)) return []
  return raw
    .map((item) => {
      if (!item || typeof item !== 'object') return null
      const row = item as Record<string, unknown>
      const name = readString(row.material_name ?? row.name)
      if (!name) return null
      return {
        id: readString(row.id) ?? undefined,
        name,
        percentage: readNumber(row.percentage),
        isPrimary: Boolean(row.is_primary ?? row.isPrimary),
        isSustainable: Boolean(row.is_sustainable ?? row.isSustainable),
        certification: readString(row.certification),
      }
    })
    .filter((item): item is ParsedMaterial => Boolean(item))
}

function parseNameValueCollection(
  raw: unknown,
  keys: { nameKeys: string[]; valueKeys: string[] },
): ParsedAttribute[] {
  if (!Array.isArray(raw)) return []
  return raw
    .map((item) => {
      if (!item || typeof item !== 'object') return null
      const row = item as Record<string, unknown>
      const name = keys.nameKeys.map((key) => readString(row[key])).find(Boolean) ?? 'Item'
      const value = keys.valueKeys.map((key) => readString(row[key])).find(Boolean) ?? ''
      return value ? { name, value } : null
    })
    .filter((item): item is ParsedAttribute => Boolean(item))
}

function mergeById<T extends { id?: string }>(primary: T[], secondary: T[]): T[] {
  const source = primary.length > 0 ? primary : secondary
  if (primary.length === 0 || secondary.length === 0) return source

  const map = new Map<string, T>()
  for (const item of secondary) {
    if (item.id) map.set(item.id, item)
  }
  for (const item of primary) {
    if (item.id) map.set(item.id, { ...map.get(item.id), ...item })
    else map.set(`__noid_${map.size}`, item)
  }
  return [...map.values()]
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

function readString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null
}

function readNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

function formatDimensions(value: unknown): string {
  const record = asRecord(value)
  if (!record) return '—'
  const parts = ['length', 'width', 'height']
    .map((key) => {
      const num = readNumber(record[key])
      return num != null ? `${key[0].toUpperCase()}${key.slice(1)}: ${num}` : null
    })
    .filter(Boolean)
  return parts.length ? parts.join(' · ') : '—'
}

function stripHtml(value: string): string {
  return value.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

function formatUpdatedAt(value: string | null | undefined): string {
  if (!value) return 'Recently'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Recently'
  const now = new Date()
  const sameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  if (sameDay) {
    return `Today, ${date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}`
  }
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}
