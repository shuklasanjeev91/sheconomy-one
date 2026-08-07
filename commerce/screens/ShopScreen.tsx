import { useMemo, useState } from 'react'
import { useParams } from 'one'

import { AppLink } from '~/components/navigation/AppLink'
import {
  Button,
  Icons,
  Paragraph,
  Skeleton,
  Spinner,
  Text,
  XStack,
  YStack,
  useAppToast,
} from '~/components/ui'
import { OptionSearchSheet } from '~/components/search/OptionSearchSheet'
import { useAppLayout } from '~/hooks/useAppLayout'
import {
  AvailableOffersCard,
  ListingGrid,
  LoadMoreEnd,
  LoadMoreSentinel,
  ReviewsSection,
  ShopAnnouncementBanner,
  shopAnnouncementFromMetadata,
  ShopHero,
  ShopManagePanel,
  ShopSellerBuyBox,
} from '~/commerce/components'
import { useCanonicalShopSlug } from '~/commerce/hooks/useCanonicalSlug'
import { useListingFeed } from '~/commerce/hooks/useListingFeed'
import { useShop } from '~/commerce/hooks/useShop'
import { useShopReviews } from '~/commerce/hooks/useShopReviews'
import type { ListingSummary } from '~/commerce/lib/commerce'
import type { ShopLoaderResult } from '~/commerce/lib/shop-loader'
import { hasVisibleReviews } from '~/commerce/lib/reviews'
import { formatShopCountry } from '~/commerce/lib/shop-location'
import { FullWidthLayout, PageSection, StickyRail } from '~/components/layout'
import { getShadowStyle, radius } from '~/config/tokens'
import { useVendorShops } from '~/hooks/useVendorShops'
import { useProfile } from '~/hooks/useProfile'
import { commerceRoutes } from '~/lib/routes'
import { useAppUi } from '~/lib/theme/useAppUi'
import { usePageSeo } from '~/components/seo/RouteSeo'

type ShopTab = 'products' | 'about' | 'reviews'
type ShopSort = 'featured' | 'price-asc' | 'price-desc' | 'newest' | 'rating'

const SORT_OPTIONS: { value: ShopSort; label: string }[] = [
  { value: 'featured', label: 'Featured' },
  { value: 'price-asc', label: 'Price: Low to High' },
  { value: 'price-desc', label: 'Price: High to Low' },
  { value: 'newest', label: 'Newest Arrivals' },
  { value: 'rating', label: 'Avg. Customer Review' },
]

function sortListings(items: ListingSummary[], sort: ShopSort): ListingSummary[] {
  const next = [...items]
  switch (sort) {
    case 'price-asc':
      return next.sort((a, b) => a.price - b.price)
    case 'price-desc':
      return next.sort((a, b) => b.price - a.price)
    case 'newest':
      return next.sort(
        (a, b) =>
          new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime(),
      )
    case 'rating':
      return next.sort((a, b) => (b.average_rating ?? 0) - (a.average_rating ?? 0))
    case 'featured':
    default:
      return next.sort((a, b) => Number(!!b.is_featured) - Number(!!a.is_featured))
  }
}

export function ShopScreen(
  props: { initial?: ShopLoaderResult | null; awaitingInitial?: boolean } = {},
) {
  const { initial, awaitingInitial = false } = props
  const ui = useAppUi()
  const { slug } = useParams<{ slug: string }>()
  const { isDesktop, isWide, isTablet } = useAppLayout()
  const { shop, isLoading, error, refresh } = useShop(slug, initial, { awaitingInitial })
  useCanonicalShopSlug(slug, shop)
  const {
    reviews: shopReviews,
    summary: shopReviewSummary,
    isLoading: shopReviewsLoading,
    error: shopReviewsError,
  } = useShopReviews(shop?.id, {
    averageRating: shop?.average_rating,
    totalReviews: shop?.total_reviews,
  })
  const listingsFeed = useListingFeed({ kind: 'shop', shopId: shop?.id, enabled: !!shop?.id })
  const { user } = useProfile()
  const { updateShop } = useVendorShops()
  const toast = useAppToast()
  const gridColumns = isWide ? 4 : isDesktop ? 3 : isTablet ? 3 : 2

  const [shopName, setShopName] = useState('')
  const [shopDescription, setShopDescription] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [tab, setTab] = useState<ShopTab>('products')
  const [sort, setSort] = useState<ShopSort>('featured')
  const [sortOpen, setSortOpen] = useState(false)

  const sortedListings = useMemo(
    () => sortListings(listingsFeed.items, sort),
    [listingsFeed.items, sort],
  )
  const sortLabel = SORT_OPTIONS.find((option) => option.value === sort)?.label ?? 'Featured'

  usePageSeo(
    useMemo(() => {
      if (!shop) return null
      return {
        title: shop.shop_name,
        description:
          shop.shop_description?.trim().slice(0, 200) ||
          `Shop ${shop.shop_name} on SHEconomy — browse products from this women-led business.`,
        image: shop.logo_url ?? null,
      }
    }, [shop]),
  )

  if (isLoading) {
    return (
      <FullWidthLayout scroll>
        <YStack gap="$4" width="100%" paddingBottom="$6">
          <Skeleton height={200} borderRadius={0} />
          <PageSection gap="$3">
            <XStack gap="$3" alignItems="center">
              <Skeleton width={64} height={64} borderRadius={32} />
              <YStack flex={1} gap="$2">
                <Skeleton height={22} width="55%" />
                <Skeleton height={14} width="35%" />
              </YStack>
            </XStack>
            <Skeleton height={14} width="90%" />
            <Skeleton height={14} width="70%" />
            <XStack gap="$2" marginTop="$2">
              <Skeleton height={36} width={88} borderRadius={999} />
              <Skeleton height={36} width={96} borderRadius={999} />
              <Skeleton height={36} width={80} borderRadius={999} />
            </XStack>
          </PageSection>
          <PageSection gap="$3">
            <Skeleton height={18} width="30%" />
            <XStack gap="$3" flexWrap="wrap">
              <Skeleton height={210} width="47%" borderRadius={16} />
              <Skeleton height={210} width="47%" borderRadius={16} />
              <Skeleton height={210} width="47%" borderRadius={16} />
              <Skeleton height={210} width="47%" borderRadius={16} />
            </XStack>
          </PageSection>
        </YStack>
      </FullWidthLayout>
    )
  }

  if (error || !shop) {
    return (
      <FullWidthLayout scroll>
        <PageSection paddingVertical="$10">
          <YStack
            gap="$4"
            padding="$6"
            borderRadius={radius.card}
            borderWidth={1}
            borderColor={ui.borderSubtle}
            backgroundColor={ui.surface}
            width="100%"
            maxWidth="100%"
            alignSelf="stretch"
            style={getShadowStyle('sm')}
          >
            <Text fontWeight="600" fontSize={22} color={ui.text}>
              Shop not found
            </Text>
            <Paragraph color={ui.textSecondary}>{error ?? 'This shop could not be loaded.'}</Paragraph>
            <AppLink href={commerceRoutes.home} asChild>
              <Button tone="primary" size="$4" borderRadius={8} alignSelf="flex-start">
                Browse marketplace
              </Button>
            </AppLink>
          </YStack>
        </PageSection>
      </FullWidthLayout>
    )
  }

  const isOwner = !!user && shop.user_id === user.id
  const shopCountry = formatShopCountry(shop.address)
  const hasReviews = hasVisibleReviews(shopReviewSummary) || shopReviews.length > 0
  const listingsCount = listingsFeed.items.length
  const announcement = shopAnnouncementFromMetadata(shop.shop_metadata)
  const shopSlug = String(slug ?? shop.slug ?? shop.id)

  async function handleSave() {
    setIsSaving(true)
    const { error: saveError } = await updateShop(shop.id, {
      shop_name: shopName || shop.shop_name,
      shop_description: shopDescription,
    })
    setIsSaving(false)

    if (saveError) {
      toast.show('Update failed', { tone: 'danger', message: saveError.message })
      return
    }

    toast.show('Shop updated', { tone: 'success' })
    setIsEditing(false)
    await refresh()
  }

  function handleToggleEdit() {
    if (!isEditing) {
      setShopName(shop.shop_name)
      setShopDescription(shop.shop_description ?? '')
    }
    setIsEditing((value) => !value)
  }

  const tabs: { id: ShopTab; label: string }[] = [
    { id: 'products', label: 'Products' },
    { id: 'about', label: 'About' },
    { id: 'reviews', label: hasReviews ? `Reviews (${shopReviewSummary.totalReviews})` : 'Reviews' },
  ]

  const buyBox = (
    <ShopSellerBuyBox
      shopId={shop.id}
      shopName={shop.shop_name}
      shopSlug={shopSlug}
      logoUrl={shop.logo_url}
      owner={shop.owner}
      address={shop.address}
      shopCreatedAt={shop.created_at}
      shopCurrency={shop.shop_currency}
      listingsCount={listingsCount}
      ownerUserId={shop.owner?.id}
      onBrowseProducts={() => setTab('products')}
    />
  )

  return (
    <FullWidthLayout scroll>
      <YStack width="100%" paddingBottom="$2" backgroundColor={ui.background}>
        <ShopHero
          shopId={shop.id}
          shopName={shop.shop_name}
          logoUrl={shop.logo_url}
          description={shop.shop_description}
          verified={shop.verified}
          reviewSummary={shopReviewSummary}
          hasReviews={hasVisibleReviews(shopReviewSummary)}
          listingsCount={listingsCount}
          country={shopCountry}
          websiteUrl={shop.website_url}
          ownerUserId={shop.owner?.id}
          shopSlug={shopSlug}
        />

        {announcement ? (
          <PageSection paddingTop="$3" paddingBottom="$0">
            <ShopAnnouncementBanner message={announcement} />
          </PageSection>
        ) : null}

        <XStack
          width="100%"
          backgroundColor={ui.surface}
          borderBottomWidth={1}
          borderBottomColor={ui.borderSubtle}
          paddingHorizontal={isDesktop ? 24 : 16}
          gap="$1"
          zIndex={2}
          position="relative"
        >
          {tabs.map((item) => {
            const active = tab === item.id
            return (
              <YStack
                key={item.id}
                paddingHorizontal="$3"
                paddingVertical="$3"
                borderBottomWidth={2}
                borderBottomColor={active ? ui.brand : 'transparent'}
                cursor="pointer"
                onPress={() => setTab(item.id)}
                hoverStyle={{ opacity: 0.85 }}
                flexShrink={0}
              >
                <Text
                  fontSize={14}
                  fontWeight={active ? '700' : '500'}
                  color={active ? ui.text : ui.textSecondary}
                >
                  {item.label}
                </Text>
              </YStack>
            )
          })}
        </XStack>

        <PageSection paddingTop="$4" gap="$4" zIndex={1} position="relative">
          {tab === 'products' ? (
            <XStack gap="$5" alignItems="flex-start" width="100%">
              <YStack flex={1} minWidth={0} gap="$4" width="100%">
                {isDesktop ? (
                  <AvailableOffersCard
                    currency={shop.shop_currency ?? 'INR'}
                    shopId={shop.id}
                    title="Offers from this shop"
                  />
                ) : null}

                <YStack
                  gap="$3"
                  width="100%"
                  paddingBottom="$3"
                  borderBottomWidth={1}
                  borderBottomColor={ui.borderSubtle}
                >
                  <YStack gap={2} width="100%">
                    <Text fontSize={18} fontWeight="700" color={ui.text}>
                      Results
                    </Text>
                    <Text fontSize={13} color={ui.textSecondary}>
                      {listingsCount}
                      {listingsFeed.hasMore ? '+' : ''} result{listingsCount === 1 ? '' : 's'} for{' '}
                      <Text fontWeight="600" color={ui.text}>
                        {shop.shop_name}
                      </Text>
                    </Text>
                  </YStack>

                  <XStack gap="$2" alignItems="center" width="100%" flexWrap="wrap">
                    <Text fontSize={13} color={ui.textSecondary} flexShrink={0}>
                      Sort by:
                    </Text>
                    <Button
                      tone="outline"
                      size="$3"
                      borderRadius={8}
                      flex={1}
                      minWidth={160}
                      maxWidth={isDesktop ? 220 : undefined}
                      iconAfter={<Icons.ChevronDown size={16} />}
                      aria-label={`Sort by ${sortLabel}`}
                      onPress={() => setSortOpen(true)}
                    >
                      {sortLabel}
                    </Button>
                    <OptionSearchSheet
                      open={sortOpen}
                      onOpenChange={setSortOpen}
                      title="Sort by"
                      options={SORT_OPTIONS}
                      value={sort}
                      onSelect={(next) => {
                        setSort(next as ShopSort)
                        setSortOpen(false)
                      }}
                      searchPlaceholder="Search sort options"
                    />
                  </XStack>
                </YStack>

                {listingsFeed.isLoading ? (
                  <YStack paddingVertical="$8" alignItems="center">
                    <Spinner size="large" />
                  </YStack>
                ) : listingsCount === 0 ? (
                  <YStack
                    alignItems="center"
                    justifyContent="center"
                    paddingVertical="$10"
                    gap="$3"
                    borderRadius={8}
                    backgroundColor={ui.surface}
                    borderWidth={1}
                    borderColor={ui.borderSubtle}
                  >
                    <Icons.Store size={32} color={ui.textMuted} />
                    <Text fontWeight="700" fontSize={16} color={ui.text}>
                      No products yet
                    </Text>
                    <Text color={ui.textMuted} fontSize={14} textAlign="center" maxWidth={320}>
                      This shop hasn&apos;t published any active items. Check back soon.
                    </Text>
                  </YStack>
                ) : (
                  <YStack gap="$4" width="100%">
                    <ListingGrid listings={sortedListings} columns={gridColumns} />
                    <LoadMoreSentinel
                      hasMore={listingsFeed.hasMore}
                      isLoadingMore={listingsFeed.isLoadingMore}
                      onLoadMore={listingsFeed.loadMore}
                    />
                    {!listingsFeed.hasMore ? <LoadMoreEnd /> : null}
                  </YStack>
                )}
              </YStack>

              {isDesktop ? (
                <StickyRail width={300} flexShrink={0} pin="document">
                  <YStack gap="$3" width="100%">
                    {buyBox}
                    {isOwner ? (
                      <ShopManagePanel
                        isEditing={isEditing}
                        isSaving={isSaving}
                        shopName={shopName}
                        shopDescription={shopDescription}
                        onShopNameChange={setShopName}
                        onShopDescriptionChange={setShopDescription}
                        onToggleEdit={handleToggleEdit}
                        onSave={handleSave}
                      />
                    ) : null}
                  </YStack>
                </StickyRail>
              ) : null}
            </XStack>
          ) : null}

          {tab === 'about' ? (
            <XStack gap="$5" alignItems="flex-start" width="100%" flexWrap="wrap">
              <YStack
                flex={1}
                minWidth={280}
                gap="$4"
                padding="$5"
                borderRadius={8}
                borderWidth={1}
                borderColor={ui.borderSubtle}
                backgroundColor={ui.surface}
              >
                <Text fontSize={20} fontWeight="700" color={ui.text}>
                  About {shop.shop_name}
                </Text>
                <Text fontSize={15} color={ui.textSecondary} lineHeight={24}>
                  {shop.shop_description?.trim() ||
                    'This seller has not added a store description yet.'}
                </Text>
                <YStack height={1} backgroundColor={ui.borderSubtle} />
                <FactRow label="Location" value={shopCountry ?? '—'} />
                <FactRow
                  label="Products"
                  value={`${listingsCount}${listingsFeed.hasMore ? '+' : ''}`}
                />
                {shop.shop_currency ? (
                  <FactRow label="Currency" value={shop.shop_currency} />
                ) : null}
                {shop.website_url ? <FactRow label="Website" value={shop.website_url} /> : null}
                <YStack height={1} backgroundColor={ui.borderSubtle} />
                <Text fontSize={14} fontWeight="700" color={ui.text}>
                  Shop policies
                </Text>
                <XStack flexWrap="wrap" gap="$3">
                  {(
                    [
                      ['Privacy', commerceRoutes.shopPrivacy(shop.slug || slug)],
                      ['Terms', commerceRoutes.shopTerms(shop.slug || slug)],
                      ['Returns', commerceRoutes.shopReturns(shop.slug || slug)],
                      ['Refunds', commerceRoutes.shopRefunds(shop.slug || slug)],
                      ['Shipping', commerceRoutes.shopShipping(shop.slug || slug)],
                    ] as const
                  ).map(([label, href]) => (
                    <AppLink key={label} href={href}>
                      <Text fontSize={13} fontWeight="600" color={ui.brand}>
                        {label}
                      </Text>
                    </AppLink>
                  ))}
                </XStack>
              </YStack>
              <YStack width={isDesktop ? 300 : '100%'} flexShrink={0}>
                {buyBox}
              </YStack>
            </XStack>
          ) : null}

          {tab === 'reviews' ? (
            <YStack gap="$4" width="100%" maxWidth="100%" alignSelf="stretch">
              {hasReviews ? (
                <ReviewsSection
                  title="Customer reviews"
                  summary={shopReviewSummary}
                  reviews={shopReviews}
                  isLoading={shopReviewsLoading}
                  error={shopReviewsError}
                />
              ) : (
                <YStack
                  padding="$6"
                  borderRadius={8}
                  borderWidth={1}
                  borderColor={ui.borderSubtle}
                  backgroundColor={ui.surface}
                  gap="$2"
                >
                  <Text fontSize={18} fontWeight="700" color={ui.text}>
                    No customer reviews yet
                  </Text>
                  <Text fontSize={14} color={ui.textSecondary}>
                    Be among the first to leave a review after purchasing from this shop.
                  </Text>
                </YStack>
              )}
            </YStack>
          ) : null}

          {!isDesktop && tab === 'products' ? (
            <YStack gap="$3" width="100%" paddingTop="$2">
              {buyBox}
              {isOwner ? (
                <ShopManagePanel
                  isEditing={isEditing}
                  isSaving={isSaving}
                  shopName={shopName}
                  shopDescription={shopDescription}
                  onShopNameChange={setShopName}
                  onShopDescriptionChange={setShopDescription}
                  onToggleEdit={handleToggleEdit}
                  onSave={handleSave}
                />
              ) : null}
            </YStack>
          ) : null}
        </PageSection>
      </YStack>
    </FullWidthLayout>
  )
}

function FactRow({ label, value }: { label: string; value: string }) {
  const ui = useAppUi()
  return (
    <XStack justifyContent="space-between" gap="$4">
      <Text fontSize={13} color={ui.textMuted}>
        {label}
      </Text>
      <Text fontSize={13} color={ui.text} fontWeight="500" flex={1} textAlign="right">
        {value}
      </Text>
    </XStack>
  )
}
