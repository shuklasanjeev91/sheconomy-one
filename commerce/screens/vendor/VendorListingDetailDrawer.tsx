import { useEffect, useMemo, useState } from 'react'
import { Platform } from 'react-native'
import { Link } from 'one'

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
import { loadListingCategories } from '~/lib/listing/listing-categories.store'
import { loadListingDetails } from '~/lib/listing/listing.store'
import type { ListingDetails } from '~/lib/listing/listing.service'
import { LISTING_STATUS } from '~/lib/listing/listing.type'
import { formatListingPrice, getPrimaryListingImage } from '~/lib/listing/listing.utils'
import { overlayBackdropStyle } from '~/lib/layout/styles'
import { commerceRoutes, vendorRoutes } from '~/lib/routes'
import { useAppDispatch, useAppSelector } from '~/lib/store/hooks'
import type { AppUiTokens } from '~/lib/theme/app-ui'

import { listingSkuFallback, listingStatusLabel } from './vendor-listings-shared'

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
  const toast = useAppToast()
  useLockBodyScroll(open)

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

  const images = useMemo(() => parseImages(listing), [listing])
  const attributes = useMemo(() => parseAttributes(listing), [listing])
  const variations = useMemo(() => parseVariations(listing), [listing])
  const materials = useMemo(() => parseMaterials(listing), [listing])

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
                <ListingHero ui={ui} listing={listing} currency={currency} images={images} />

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
                  currency={currency}
                  images={images}
                  attributes={attributes}
                  variations={variations}
                  materials={materials}
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
                  <Link href={previewHref} asChild>
                    <Button tone="outline" size="$3" borderRadius={999} flex={isDesktop ? undefined : 1}>
                      Preview
                    </Button>
                  </Link>
                ) : null}
                {listingId ? (
                  <Link href={vendorRoutes.editListing(listingId)} asChild>
                    <Button tone="primary" size="$3" borderRadius={999} flex={isDesktop ? undefined : 1}>
                      Edit
                    </Button>
                  </Link>
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
  currency,
  images,
}: {
  ui: AppUiTokens
  listing: ListingDetails
  currency: string
  images: { url: string; isPrimary?: boolean }[]
}) {
  const hero = images[0]?.url ?? getPrimaryListingImage(listing as never)
  const stock = listing.quantity ?? listing.stock ?? 0
  const lowStock = stock > 0 && stock <= 5

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
        <YStack gap="$2" width={isDesktopWidth(220) ? 220 : '100%'}>
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
        </YStack>

        <YStack flex={1} minWidth={240} gap="$3">
          <XStack alignItems="center" justifyContent="space-between" gap="$2" flexWrap="wrap">
            <XStack gap="$2" flexWrap="wrap">
              <StatusPill ui={ui} label={listingStatusLabel(listing.listing_status)} tone="brand" />
              {listing.is_featured ? <StatusPill ui={ui} label="Featured" tone="gold" /> : null}
            </XStack>
            <Text fontSize={11.5} color={ui.textMuted} fontWeight="600">
              Last updated: {formatUpdatedAt(listing.updated_at)}
            </Text>
          </XStack>

          <Text fontSize={24} fontWeight="800" color={ui.text} letterSpacing={-0.5}>
            {listing.title}
          </Text>
          <Text fontSize={12.5} color={ui.textSecondary} fontWeight="600">
            SKU: {listingSkuFallback(listing.slug, listing.id ?? '')}
          </Text>

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
                SELLING PRICE
              </Text>
              <Text fontSize={22} fontWeight="800" color={ui.text}>
                {formatListingPrice(listing.price, listing.shop_currency ?? currency)}
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
  currency,
  images,
  attributes,
  variations,
  materials,
  categories,
}: {
  ui: AppUiTokens
  tab: DetailTab
  listing: ListingDetails
  currency: string
  images: { url: string; isPrimary?: boolean }[]
  attributes: { name: string; value: string }[]
  variations: { name: string; value: string }[]
  materials: { name: string; value: string }[]
  categories: { category_id: string; is_primary?: boolean | null }[]
}) {
  if (tab === 'overview') {
    return (
      <YStack gap="$3">
        <Text fontSize={15} fontWeight="800" color={ui.text}>
          Product Narrative
        </Text>
        <Text fontSize={14} color={ui.textSecondary} lineHeight={22}>
          {stripHtml(listing.description ?? '') || 'No description added yet.'}
        </Text>
      </YStack>
    )
  }

  if (tab === 'attributes') {
    return <KeyValuePanel ui={ui} title="Quick Specifications" rows={attributes} empty="No attributes yet." />
  }

  if (tab === 'variations') {
    return <KeyValuePanel ui={ui} title="Variations" rows={variations} empty="No variations configured." />
  }

  if (tab === 'materials') {
    return <KeyValuePanel ui={ui} title="Materials" rows={materials} empty="No materials listed." />
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
        Media
      </Text>
      {images.length === 0 ? (
        <Text fontSize={13} color={ui.textSecondary}>
          No images uploaded yet.
        </Text>
      ) : (
        <XStack gap="$3" flexWrap="wrap">
          {images.map((image, index) => (
            <YStack
              key={`${image.url}-${index}`}
              width={120}
              height={120}
              borderRadius={radius.chip}
              overflow="hidden"
              borderWidth={image.isPrimary ? 2 : 1}
              borderColor={image.isPrimary ? ui.brand : ui.borderSubtle}
            >
              <Image src={image.url} width={120} height={120} objectFit="cover" alt="" />
            </YStack>
          ))}
        </XStack>
      )}
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
  rows: { name: string; value: string }[]
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
  tone: 'brand' | 'gold' | 'warning'
}) {
  const styles =
    tone === 'gold'
      ? { bg: '#FFF4D6', color: '#9A6700' }
      : tone === 'warning'
        ? { bg: '#FFF0E1', color: '#B45309' }
        : { bg: ui.roseSurface, color: ui.brand }

  return (
    <XStack paddingHorizontal="$2.5" paddingVertical={4} borderRadius={999} backgroundColor={styles.bg}>
      <Text fontSize={10.5} fontWeight="800" color={styles.color} letterSpacing={0.3}>
        {label.toUpperCase()}
      </Text>
    </XStack>
  )
}

function parseImages(listing: ListingDetails | null): { url: string; isPrimary?: boolean }[] {
  if (!listing?.images) return []
  const raw = listing.images
  if (!Array.isArray(raw)) return []
  return raw
    .map((item) => {
      if (!item || typeof item !== 'object') return null
      const row = item as Record<string, unknown>
      const url = typeof row.image_url === 'string' ? row.image_url : null
      if (!url) return null
      return { url, isPrimary: Boolean(row.is_primary) }
    })
    .filter((item): item is { url: string; isPrimary?: boolean } => Boolean(item))
}

function parseCollection(
  listing: ListingDetails | null,
  key: 'attributes' | 'variations' | 'materials',
): { name: string; value: string }[] {
  const raw = listing?.[key]
  if (!Array.isArray(raw)) return []
  return raw
    .map((item) => {
      if (!item || typeof item !== 'object') return null
      const row = item as Record<string, unknown>
      const name =
        typeof row.attribute_name === 'string'
          ? row.attribute_name
          : typeof row.variation_name === 'string'
            ? row.variation_name
            : typeof row.material_name === 'string'
              ? row.material_name
              : typeof row.name === 'string'
                ? row.name
                : 'Item'
      const value =
        typeof row.attribute_value === 'string'
          ? row.attribute_value
          : typeof row.variation_value === 'string'
            ? row.variation_value
            : typeof row.material_value === 'string'
              ? row.material_value
              : typeof row.value === 'string'
                ? row.value
                : ''
      return value ? { name, value } : null
    })
    .filter((item): item is { name: string; value: string } => Boolean(item))
}

function parseAttributes(listing: ListingDetails | null) {
  return parseCollection(listing, 'attributes')
}

function parseVariations(listing: ListingDetails | null) {
  return parseCollection(listing, 'variations')
}

function parseMaterials(listing: ListingDetails | null) {
  return parseCollection(listing, 'materials')
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

function isDesktopWidth(min: number) {
  return min > 0
}
