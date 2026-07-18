import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { useRouter } from 'one'
import { AppLink } from '~/components/navigation/AppLink'
import type { Href } from 'one'
import type { GetProps } from 'tamagui'

import {
  Avatar,
  Button,
  ConfirmDialog,
  Icons,
  LinearGradient,
  ScreenState,
  Spinner,
  Text,
  XStack,
  YStack,
  useAppToast,
} from '~/components/ui'
import { PageCenter } from '~/components/layout'
import { fetchShopAddressDetails, type ShopAddressDetails } from '~/commerce/lib/shop-address'
import { getShadowStyle, radius } from '~/config/tokens'
import { getCountryName } from '~/lib/geo'
import { useAppLayout } from '~/hooks/useAppLayout'
import { loadVendorAnalytics, selectVendorAnalytics } from '~/lib/orders/vendor-orders.store'
import { openExternalUrl as openPlatformUrl } from '~/lib/platform/openUrl'
import { commerceRoutes, vendorRoutes } from '~/lib/routes'
import { deleteShop, loadMyShops, loadShopStats, updateShop } from '~/lib/shop/shop.store'
import { getShopFollowerCount } from '~/lib/shop/shop.service'
import type { Shop, ShopStats } from '~/lib/shop/shop.type'
import { formatShopHours, getShopCompletionPercentage } from '~/lib/shop/shop.utils'
import { useAppDispatch, useAppSelector } from '~/lib/store/hooks'
import type { AppUiTokens } from '~/lib/theme/app-ui'
import { useAppUi } from '~/lib/theme/useAppUi'

type IconType = (typeof Icons)[keyof typeof Icons]

const SOCIAL_ICONS: Record<string, IconType> = {
  instagram: Icons.Instagram,
  facebook: Icons.Facebook,
  twitter: Icons.Twitter,
  x: Icons.Twitter,
  youtube: Icons.Youtube,
  linkedin: Icons.Linkedin,
  tiktok: Icons.Music2,
  pinterest: Icons.Image,
  website: Icons.Globe,
}

/** Last 7 days order counts (index 0 = 6 days ago). */
const ENGAGEMENT_DAYS = ['D-6', 'D-5', 'D-4', 'D-3', 'D-2', 'D-1', 'Today']

function openExternalUrl(url: string | null | undefined) {
  if (!url) return
  const normalized = /^https?:\/\//i.test(url) ? url : `https://${url}`
  void openPlatformUrl(normalized)
}

export function VendorMyShopScreen() {
  const ui = useAppUi()
  const { isDesktop, safeBottom } = useAppLayout()
  const router = useRouter()
  const toast = useAppToast()
  const dispatch = useAppDispatch()

  const shop = useAppSelector((s) => s.shop.currentShop)
  const stats = useAppSelector((s) => s.shop.shopStats)
  const isLoadingShops = useAppSelector((s) => s.shop.isLoadingShops)
  const shopError = useAppSelector((s) => s.shop.error)
  const isUpdating = useAppSelector((s) => s.shop.isUpdating)
  const isDeleting = useAppSelector((s) => s.shop.isDeleting)
  const analytics = useAppSelector(selectVendorAnalytics)

  const [address, setAddress] = useState<ShopAddressDetails | null>(null)
  const [followerCount, setFollowerCount] = useState<number | null>(null)
  /** Avoid an infinite spinner when `loadMyShops` hangs (network / RLS). */
  const [loadTimedOut, setLoadTimedOut] = useState(false)

  useEffect(() => {
    if (!shop) void dispatch(loadMyShops(undefined))
  }, [dispatch, shop])

  useEffect(() => {
    if (shop || !isLoadingShops) {
      setLoadTimedOut(false)
      return
    }
    const timer = setTimeout(() => setLoadTimedOut(true), 8_000)
    return () => clearTimeout(timer)
  }, [shop, isLoadingShops])

  useEffect(() => {
    if (!shop?.id) return
    void dispatch(loadShopStats(shop.id))
    // All-time order totals for this shop (since the shop was created).
    void dispatch(loadVendorAnalytics({ vendorId: shop.id, filters: { date_from: shop.created_at } }))
    let active = true
    void getShopFollowerCount(shop.id).then((result) => {
      if (active && result.success) setFollowerCount(result.data ?? 0)
    })
    return () => {
      active = false
    }
  }, [dispatch, shop?.id, shop?.created_at])

  useEffect(() => {
    if (!shop?.id) {
      setAddress(null)
      return
    }
    let active = true
    void fetchShopAddressDetails(shop.id).then(({ address: resolved }) => {
      if (active) setAddress(resolved)
    })
    return () => {
      active = false
    }
  }, [shop?.id])

  const completion = useMemo(() => getShopCompletionPercentage(shop), [shop])
  const totalOrders = analytics?.total_orders ?? null
  const engagementSeries = analytics?.engagement_series ?? [0, 0, 0, 0, 0, 0, 0]
  const retryLoadShops = () => {
    setLoadTimedOut(false)
    void dispatch(loadMyShops(undefined))
  }

  if (!shop && isLoadingShops && !loadTimedOut) {
    return (
      <PageCenter>
        <Spinner size="large" />
      </PageCenter>
    )
  }

  if (!shop && (shopError || loadTimedOut)) {
    return (
      <ScreenState
        error={shopError ?? (loadTimedOut ? 'Shop list timed out. Check your connection and try again.' : null)}
        empty
        errorTitle="Couldn’t load your shop"
        onRetry={retryLoadShops}
        minHeight={360}
      />
    )
  }

  if (!shop) {
    return (
      <YStack flex={1} alignItems="center" justifyContent="center" padding="$6" gap="$3" minHeight={360}>
        <YStack
          width={68}
          height={68}
          borderRadius={999}
          backgroundColor={ui.roseSurface}
          alignItems="center"
          justifyContent="center"
        >
          <Icons.Store size={30} color={ui.brand} />
        </YStack>
        <Text fontSize={18} fontWeight="800" color={ui.text} textAlign="center">
          No shop yet
        </Text>
        <Text fontSize={14} color={ui.textSecondary} textAlign="center" maxWidth={360} lineHeight={20}>
          Create your storefront to start selling on SHEconomy and manage it from here.
        </Text>
        <AppLink href={commerceRoutes.createShop} asChild>
          <Button tone="primary" size="$4" borderRadius={999} marginTop="$2">
            Create your shop
          </Button>
        </AppLink>
      </YStack>
    )
  }

  const previewHref = commerceRoutes.shop(shop.slug ?? shop.id)

  async function handlePauseToggle() {
    if (!shop) return
    try {
      await dispatch(
        updateShop({ shopId: shop.id, updates: { is_active: !shop.is_active } }),
      ).unwrap()
      toast.show(shop.is_active ? 'Shop paused' : 'Shop is now live', {
        tone: 'success',
        message: shop.is_active
          ? 'Your storefront is hidden from shoppers.'
          : 'Your storefront is visible to shoppers again.',
      })
    } catch (error) {
      toast.show('Could not update visibility', {
        tone: 'danger',
        message: error instanceof Error ? error.message : 'Please try again.',
      })
    }
  }

  async function handleDelete() {
    if (!shop) return
    try {
      await dispatch(deleteShop(shop.id)).unwrap()
      toast.show('Shop deleted', { tone: 'success' })
      router.replace(commerceRoutes.createShop)
    } catch (error) {
      toast.show('Could not delete shop', {
        tone: 'danger',
        message: error instanceof Error ? error.message : 'Please try again.',
      })
    }
  }

  return (
    <YStack
      width="100%"
      maxWidth="100%"
      gap="$5"
      paddingHorizontal={isDesktop ? '$6' : '$4'}
      paddingTop={isDesktop ? '$6' : '$4'}
      paddingBottom={(isDesktop ? 32 : 24) + safeBottom}
    >
      <ShopHeaderBar
        ui={ui}
        shop={shop}
        isDesktop={isDesktop}
        previewHref={previewHref}
        isDeleting={isDeleting}
        onDelete={handleDelete}
      />

      {isDesktop ? (
        <XStack gap="$5" alignItems="flex-start">
          <YStack flex={1} minWidth={0} gap="$5">
            <MainColumn
              ui={ui}
              shop={shop}
              stats={stats}
              address={address}
              totalOrders={totalOrders}
              engagementSeries={engagementSeries}
              isDesktop={isDesktop}
            />
            <DangerZone
              ui={ui}
              shop={shop}
              isUpdating={isUpdating}
              isDeleting={isDeleting}
              onPauseToggle={handlePauseToggle}
              onDelete={handleDelete}
            />
          </YStack>
          <YStack width={320} flexShrink={0} gap="$4">
            <RightRail ui={ui} shop={shop} completion={completion} />
          </YStack>
        </XStack>
      ) : (
        <YStack gap="$5">
          <MainColumn
            ui={ui}
            shop={shop}
            stats={stats}
            address={address}
            totalOrders={totalOrders}
            engagementSeries={engagementSeries}
            isDesktop={isDesktop}
          />
          <RightRail ui={ui} shop={shop} completion={completion} />
          <DangerZone
            ui={ui}
            shop={shop}
            isUpdating={isUpdating}
            isDeleting={isDeleting}
            onPauseToggle={handlePauseToggle}
            onDelete={handleDelete}
          />
        </YStack>
      )}
    </YStack>
  )
}

// ============================================================================
// Header
// ============================================================================

type ShopHeaderBarProps = {
  ui: AppUiTokens
  shop: Shop
  isDesktop: boolean
  previewHref: Href
  isDeleting: boolean
  onDelete: () => void
}

function ShopHeaderBar({ ui, shop, isDesktop, previewHref, isDeleting, onDelete }: ShopHeaderBarProps) {
  return (
    <XStack
      alignItems={isDesktop ? 'center' : 'flex-start'}
      justifyContent="space-between"
      gap="$3"
      flexWrap="wrap"
    >
      <YStack gap="$1" minWidth={0}>
        <XStack alignItems="center" gap="$1.5">
          <Icons.Store size={14} color={ui.textMuted} />
          <Text fontSize={12} fontWeight="600" color={ui.textMuted} letterSpacing={0.2}>
            Shop Management
          </Text>
          <Icons.ChevronRight size={13} color={ui.textMuted} />
          <Text fontSize={12} fontWeight="700" color={ui.brand} numberOfLines={1}>
            {shop.shop_name}
          </Text>
        </XStack>
        <Text fontSize={isDesktop ? 26 : 22} fontWeight="800" color={ui.text} letterSpacing={-0.5}>
          My Shop
        </Text>
      </YStack>

      <XStack gap="$2" flexWrap="wrap" alignItems="center">
        <AppLink href={previewHref} asChild>
          <Button tone="outline" size="$3" borderRadius={999} icon={<Icons.Eye size={16} />}>
            Preview
          </Button>
        </AppLink>
        <AppLink href={vendorRoutes.editShop} asChild>
          <Button tone="primary" size="$3" borderRadius={999} icon={<Icons.Pencil size={16} />}>
            Edit Shop
          </Button>
        </AppLink>
        <ConfirmDialog
          title="Delete this shop?"
          description="This permanently removes your storefront and its listings. This action cannot be undone."
          confirmLabel="Delete shop"
          destructive
          onConfirm={onDelete}
          trigger={
            <Button
              tone="outline"
              size="$3"
              borderRadius={999}
              disabled={isDeleting}
              icon={<Icons.Trash2 size={16} color={ui.error} />}
            >
              <Text color={ui.error} fontWeight="700">
                Delete
              </Text>
            </Button>
          }
        />
      </XStack>
    </XStack>
  )
}

// ============================================================================
// Main column
// ============================================================================

type MainColumnProps = {
  ui: AppUiTokens
  shop: Shop
  stats: ShopStats | null
  address: ShopAddressDetails | null
  totalOrders: number | null
  engagementSeries: number[]
  isDesktop: boolean
}

function MainColumn({ ui, shop, stats, address, totalOrders, engagementSeries, isDesktop }: MainColumnProps) {
  const categories = Array.isArray(shop.shop_categories) ? (shop.shop_categories as string[]) : []
  const socialLinks = (shop.social_links as Record<string, string> | null) ?? {}
  const socialEntries = Object.entries(socialLinks).filter(([, url]) => Boolean(url))
  const hours = formatShopHours(shop.shop_hours as Record<string, string> | null)
  const maxEngagement = Math.max(1, ...engagementSeries)

  const activeProducts = stats?.activeListings ?? 0
  const totalListings = stats?.totalListings ?? 0
  const listingsHint = totalListings > 0 ? `of ${totalListings} total listing${totalListings === 1 ? '' : 's'}` : undefined
  const rating = shop.average_rating
  const ratingLabel = rating != null && rating > 0 ? rating.toFixed(1) : '—'
  const reviewsLabel = shop.total_reviews ? `${shop.total_reviews} reviews` : 'No reviews yet'
  const ordersLabel = totalOrders != null ? String(totalOrders) : '—'

  return (
    <YStack gap="$5">
      {/* Identity card */}
      <Card ui={ui} padding={0} overflow="hidden">
        <YStack height={132} position="relative">
          {shop.open_graph_image ? (
            <YStack
              fullscreen
              backgroundColor={ui.roseSurface}
              // Image banner when present
            />
          ) : null}
          <LinearGradient
            fullscreen
            colors={[ui.brand, ui.coral]}
            start={[0, 0]}
            end={[1, 1]}
          />
        </YStack>
        <YStack paddingHorizontal="$5" paddingBottom="$5">
          <XStack marginTop={-40} alignItems="flex-end" gap="$3" flexWrap="wrap">
            <YStack
              borderWidth={4}
              borderColor={ui.surface}
              borderRadius={999}
              backgroundColor={ui.surface}
            >
              <Avatar size="$8" src={shop.logo_url ?? undefined} name={shop.shop_name} />
            </YStack>
            <YStack flex={1} minWidth={200} paddingBottom="$2" gap="$1.5">
              <XStack alignItems="center" gap="$2" flexWrap="wrap">
                <Text fontSize={isDesktop ? 22 : 19} fontWeight="800" color={ui.text} letterSpacing={-0.4}>
                  {shop.shop_name}
                </Text>
                {shop.verified ? (
                  <XStack
                    alignItems="center"
                    gap={4}
                    paddingHorizontal={8}
                    paddingVertical={3}
                    borderRadius={999}
                    backgroundColor={ui.badgeSuccessBg}
                  >
                    <Icons.BadgeCheck size={12} color={ui.badgeSuccessText} />
                    <Text fontSize={11} fontWeight="700" color={ui.badgeSuccessText}>
                      Verified
                    </Text>
                  </XStack>
                ) : null}
                <PlaceholderPill ui={ui} icon={Icons.Crown} label="Premium Merchant" />
              </XStack>
              <XStack alignItems="center" gap="$2" flexWrap="wrap">
                <XStack
                  alignItems="center"
                  gap={4}
                  paddingHorizontal={8}
                  paddingVertical={3}
                  borderRadius={999}
                  backgroundColor={shop.is_active ? ui.badgeSuccessBg : ui.chip}
                >
                  <YStack
                    width={7}
                    height={7}
                    borderRadius={999}
                    backgroundColor={shop.is_active ? ui.badgeSuccessText : ui.textMuted}
                  />
                  <Text
                    fontSize={11}
                    fontWeight="700"
                    color={shop.is_active ? ui.badgeSuccessText : ui.textMuted}
                  >
                    {shop.is_active ? 'Live' : 'Paused'}
                  </Text>
                </XStack>
                <Text fontSize={12} color={ui.textMuted}>
                  {shop.shop_currency?.toUpperCase() || 'INR'}
                </Text>
              </XStack>
            </YStack>
          </XStack>

          {shop.shop_description ? (
            <Text fontSize={14} color={ui.textSecondary} lineHeight={21} marginTop="$3">
              {shop.shop_description}
            </Text>
          ) : (
            <Text fontSize={14} color={ui.textMuted} lineHeight={21} marginTop="$3" fontStyle="italic">
              Add a description so shoppers know what your shop is about.
            </Text>
          )}
        </YStack>
      </Card>

      {/* Stat row */}
      <XStack width="100%" flexWrap="wrap" gap="$3">
        <StatTile
          ui={ui}
          icon={Icons.Package}
          label="Active Products"
          value={String(activeProducts)}
          hint={listingsHint}
          real
        />
        <StatTile
          ui={ui}
          icon={Icons.ShoppingBag}
          label="Total Orders"
          value={ordersLabel}
          hint="All time"
          real={totalOrders != null}
        />
        <StatTile
          ui={ui}
          icon={Icons.Star}
          label="Merchant Rating"
          value={ratingLabel}
          hint={reviewsLabel}
          real={rating != null && rating > 0}
        />
        <StatTile
          ui={ui}
          icon={Icons.Users}
          label="Followers"
          value={followerCount == null ? '—' : String(followerCount)}
          real={followerCount != null}
        />
      </XStack>

      {/* Address + Contact */}
      <XStack gap="$4" flexWrap="wrap" alignItems="stretch">
        <Card ui={ui} flex={1} minWidth={260}>
          <SectionHeading ui={ui} icon={Icons.MapPin} title="Business Address" />
          <AddressBlock ui={ui} address={address} />
        </Card>
        <Card ui={ui} flex={1} minWidth={260}>
          <SectionHeading ui={ui} icon={Icons.Phone} title="Business Contact" />
          <YStack gap="$2.5" marginTop="$1">
            <ContactRow ui={ui} icon={Icons.Mail} label="Email" value={shop.shop_email} />
            <ContactRow ui={ui} icon={Icons.Phone} label="Phone" value={shop.shop_phone_number} />
            <ContactRow ui={ui} icon={Icons.Globe} label="Website" value={shop.website_url} isLink />
          </YStack>
        </Card>
      </XStack>

      {/* Socials + Hours */}
      <XStack gap="$4" flexWrap="wrap" alignItems="stretch">
        <Card ui={ui} flex={1} minWidth={260}>
          <SectionHeading ui={ui} icon={Icons.Share2} title="Connected Socials" />
          {socialEntries.length > 0 ? (
            <XStack gap="$2" flexWrap="wrap" marginTop="$1">
              {socialEntries.map(([platform, url]) => {
                const key = platform.toLowerCase()
                const Icon = SOCIAL_ICONS[key] ?? Icons.Link
                // Keep icons; omit brand-name text for selected platforms.
                const hideBrandLabel = key === 'facebook' || key === 'linkedin' || key === 'etsy' || key === 'amazon'
                return (
                  <XStack
                    key={platform}
                    alignItems="center"
                    gap="$1.5"
                    paddingHorizontal="$3"
                    paddingVertical="$2"
                    borderRadius={999}
                    borderWidth={1}
                    borderColor={ui.borderSubtle}
                    backgroundColor={ui.surfaceMuted}
                    cursor="pointer"
                    pressStyle={{ opacity: 0.8 }}
                    onPress={() => openExternalUrl(url)}
                    accessibilityLabel="Social link"
                  >
                    <Icon size={15} color={ui.brand} />
                    {hideBrandLabel ? null : (
                      <Text fontSize={12} fontWeight="600" color={ui.text} textTransform="capitalize">
                        {platform}
                      </Text>
                    )}
                  </XStack>
                )
              })}
            </XStack>
          ) : (
            <PlaceholderNote ui={ui} text="No social links added yet." />
          )}
        </Card>
        <Card ui={ui} flex={1} minWidth={260}>
          <SectionHeading ui={ui} icon={Icons.Clock} title="Business Hours" />
          {hours.length > 0 ? (
            <YStack gap="$1.5" marginTop="$1">
              {hours.map((entry) => (
                <XStack key={entry.day} justifyContent="space-between" alignItems="center">
                  <Text fontSize={13} color={ui.textSecondary} fontWeight="600">
                    {entry.day}
                  </Text>
                  <Text fontSize={13} color={entry.isOpen ? ui.text : ui.textMuted} fontWeight="600">
                    {entry.hours}
                  </Text>
                </XStack>
              ))}
            </YStack>
          ) : (
            <PlaceholderNote ui={ui} text="Set your opening hours so shoppers know when you're available." />
          )}
        </Card>
      </XStack>

      {/* Recent engagement from order analytics */}
      <Card ui={ui}>
        <XStack alignItems="center" justifyContent="space-between">
          <SectionHeading ui={ui} icon={Icons.Activity} title="Orders · last 7 days" noMargin />
          <Text fontSize={11} fontWeight="700" color={ui.textMuted}>
            Live
          </Text>
        </XStack>
        <XStack alignItems="flex-end" justifyContent="space-between" height={120} marginTop="$3" gap="$2">
          {engagementSeries.map((value, index) => (
            <YStack key={index} flex={1} alignItems="center" gap="$1.5">
              <YStack
                width="100%"
                maxWidth={26}
                height={Math.max(8, (value / maxEngagement) * 96)}
                borderRadius={8}
                backgroundColor={index === engagementSeries.length - 1 ? ui.brand : ui.roseSurface}
              />
              <Text fontSize={10} color={ui.textMuted} fontWeight="600">
                {ENGAGEMENT_DAYS[index]}
              </Text>
            </YStack>
          ))}
        </XStack>
      </Card>

      {/* Categories + Payment methods */}
      <XStack gap="$4" flexWrap="wrap" alignItems="stretch">
        <Card ui={ui} flex={1} minWidth={260}>
          <SectionHeading ui={ui} icon={Icons.Tags} title="Shop Categories" />
          {categories.length > 0 ? (
            <XStack gap="$2" flexWrap="wrap" marginTop="$1">
              {categories.map((category) => (
                <XStack
                  key={category}
                  paddingHorizontal="$3"
                  paddingVertical="$1.5"
                  borderRadius={999}
                  backgroundColor={ui.chip}
                >
                  <Text fontSize={12} fontWeight="600" color={ui.text}>
                    {category}
                  </Text>
                </XStack>
              ))}
            </XStack>
          ) : (
            <PlaceholderNote ui={ui} text="No categories selected yet." />
          )}
        </Card>
        <Card ui={ui} flex={1} minWidth={260}>
          <XStack alignItems="center" justifyContent="space-between">
            <SectionHeading ui={ui} icon={Icons.CreditCard} title="Payment Methods" noMargin />
            <SampleBadge ui={ui} />
          </XStack>
          <XStack gap="$2" flexWrap="wrap" marginTop="$3">
            {['UPI', 'Cards', 'Net Banking', 'Cash on Delivery'].map((method) => (
              <XStack
                key={method}
                alignItems="center"
                gap="$1.5"
                paddingHorizontal="$3"
                paddingVertical="$2"
                borderRadius={999}
                borderWidth={1}
                borderColor={ui.borderSubtle}
                backgroundColor={ui.surfaceMuted}
              >
                <Icons.Check size={13} color={ui.success} />
                <Text fontSize={12} fontWeight="600" color={ui.text}>
                  {method}
                </Text>
              </XStack>
            ))}
          </XStack>
        </Card>
      </XStack>
    </YStack>
  )
}

// ============================================================================
// Danger zone
// ============================================================================

type DangerZoneProps = {
  ui: AppUiTokens
  shop: Shop
  isUpdating: boolean
  isDeleting: boolean
  onPauseToggle: () => void
  onDelete: () => void
}

function DangerZone({ ui, shop, isUpdating, isDeleting, onPauseToggle, onDelete }: DangerZoneProps) {
  return (
    <YStack
      gap="$3"
      padding="$5"
      borderRadius={radius.card}
      borderWidth={1}
      borderColor={ui.error}
      backgroundColor={ui.surface}
      style={getShadowStyle('sm')}
    >
      <XStack alignItems="center" gap="$2">
        <Icons.TriangleAlert size={18} color={ui.error} />
        <Text fontSize={16} fontWeight="800" color={ui.error}>
          Danger Zone
        </Text>
      </XStack>

      <XStack alignItems="center" justifyContent="space-between" gap="$3" flexWrap="wrap">
        <YStack flex={1} minWidth={200}>
          <Text fontSize={14} fontWeight="700" color={ui.text}>
            {shop.is_active ? 'Pause shop visibility' : 'Resume shop visibility'}
          </Text>
          <Text fontSize={12} color={ui.textSecondary} lineHeight={18}>
            {shop.is_active
              ? 'Temporarily hide your storefront and listings from shoppers.'
              : 'Make your storefront visible to shoppers again.'}
          </Text>
        </YStack>
        <Button
          tone="outline"
          size="$3"
          borderRadius={999}
          disabled={isUpdating}
          onPress={onPauseToggle}
        >
          {shop.is_active ? 'Pause shop' : 'Go live'}
        </Button>
      </XStack>

      <YStack height={1} backgroundColor={ui.borderSubtle} />

      <XStack alignItems="center" justifyContent="space-between" gap="$3" flexWrap="wrap">
        <YStack flex={1} minWidth={200}>
          <Text fontSize={14} fontWeight="700" color={ui.text}>
            Delete this shop
          </Text>
          <Text fontSize={12} color={ui.textSecondary} lineHeight={18}>
            Permanently remove your storefront and all of its listings.
          </Text>
        </YStack>
        <ConfirmDialog
          title="Delete this shop?"
          description="This permanently removes your storefront and its listings. This action cannot be undone."
          confirmLabel="Delete shop"
          destructive
          onConfirm={onDelete}
          trigger={
            <Button tone="destructive" size="$3" borderRadius={999} disabled={isDeleting}>
              Delete shop
            </Button>
          }
        />
      </XStack>
    </YStack>
  )
}

// ============================================================================
// Right rail
// ============================================================================

type RightRailProps = {
  ui: AppUiTokens
  shop: Shop
  completion: number
}

function RightRail({ ui, shop, completion }: RightRailProps) {
  const healthRows = [
    { label: 'Verification', value: shop.verified ? 'Verified' : 'Pending', ok: shop.verified, real: true },
    { label: 'Profile completeness', value: `${completion}%`, ok: completion >= 80, real: true },
    { label: 'Visibility', value: shop.is_active ? 'Live' : 'Paused', ok: shop.is_active, real: true },
    { label: 'Support responsiveness', value: 'Great', ok: true, real: false },
    { label: 'Quality score', value: 'A-', ok: true, real: false },
  ]

  return (
    <>
      {/* Performance snapshot */}
      <Card ui={ui}>
        <XStack alignItems="center" justifyContent="space-between">
          <SectionHeading ui={ui} icon={Icons.TrendingUp} title="Performance Snapshot" noMargin />
          <SampleBadge ui={ui} />
        </XStack>
        <YStack gap="$3" marginTop="$3">
          <SnapshotRow ui={ui} label="Views (7d)" value="3,420" delta="+8.2%" />
          <SnapshotRow ui={ui} label="Conversion" value="2.4%" delta="+0.3%" />
          <SnapshotRow ui={ui} label="Repeat buyers" value="34%" delta="+1.1%" />
        </YStack>
      </Card>

      {/* Shop health */}
      <Card ui={ui}>
        <SectionHeading ui={ui} icon={Icons.HeartPulse} title="Shop Health" />
        <YStack gap="$2.5" marginTop="$1">
          {healthRows.map((row) => (
            <XStack key={row.label} alignItems="center" justifyContent="space-between" gap="$2">
              <XStack alignItems="center" gap="$2" flex={1} minWidth={0}>
                <YStack
                  width={22}
                  height={22}
                  borderRadius={999}
                  alignItems="center"
                  justifyContent="center"
                  backgroundColor={row.ok ? ui.badgeSuccessBg : ui.chip}
                >
                  {row.ok ? (
                    <Icons.Check size={12} color={ui.badgeSuccessText} />
                  ) : (
                    <Icons.Clock size={12} color={ui.textMuted} />
                  )}
                </YStack>
                <Text fontSize={13} color={ui.textSecondary} fontWeight="600" numberOfLines={1}>
                  {row.label}
                </Text>
                {!row.real ? <SampleDot ui={ui} /> : null}
              </XStack>
              <Text fontSize={13} fontWeight="700" color={row.ok ? ui.text : ui.textMuted}>
                {row.value}
              </Text>
            </XStack>
          ))}
        </YStack>
      </Card>

      {/* Quick actions */}
      <Card ui={ui}>
        <SectionHeading ui={ui} icon={Icons.Zap} title="Quick Actions" />
        <YStack gap="$2" marginTop="$1">
          <AppLink href={vendorRoutes.editShop} asChild>
            <Button tone="primary" size="$3" borderRadius={999} icon={<Icons.Pencil size={15} />}>
              Edit shop details
            </Button>
          </AppLink>
          <AppLink href={vendorRoutes.products} asChild>
            <Button tone="outline" size="$3" borderRadius={999} icon={<Icons.Package size={15} />}>
              Manage products
            </Button>
          </AppLink>
          <AppLink href={vendorRoutes.orders} asChild>
            <Button tone="outline" size="$3" borderRadius={999} icon={<Icons.ShoppingBag size={15} />}>
              View orders
            </Button>
          </AppLink>
        </YStack>
      </Card>
    </>
  )
}

// ============================================================================
// Small building blocks
// ============================================================================

type CardProps = GetProps<typeof YStack> & { ui: AppUiTokens; children?: ReactNode }

function Card({ ui, children, ...props }: CardProps) {
  return (
    <YStack
      gap="$3"
      padding="$5"
      borderRadius={radius.card}
      borderWidth={1}
      borderColor={ui.borderSubtle}
      backgroundColor={ui.surface}
      style={getShadowStyle('sm')}
      {...props}
    >
      {children}
    </YStack>
  )
}

function SectionHeading({
  ui,
  icon,
  title,
  noMargin,
}: {
  ui: AppUiTokens
  icon: IconType
  title: string
  noMargin?: boolean
}) {
  const Icon = icon
  return (
    <XStack alignItems="center" gap="$2" marginBottom={noMargin ? 0 : '$1'}>
      <YStack
        width={30}
        height={30}
        borderRadius={radius.chip}
        backgroundColor={ui.roseSurface}
        alignItems="center"
        justifyContent="center"
      >
        <Icon size={16} color={ui.brand} />
      </YStack>
      <Text fontSize={15} fontWeight="800" color={ui.text} letterSpacing={-0.2}>
        {title}
      </Text>
    </XStack>
  )
}

function StatTile({
  ui,
  icon,
  label,
  value,
  hint,
  real,
}: {
  ui: AppUiTokens
  icon: IconType
  label: string
  value: string
  hint?: string
  real?: boolean
}) {
  const Icon = icon
  return (
    <YStack
      flex={1}
      minWidth={150}
      gap="$2"
      padding="$4"
      borderRadius={radius.card}
      borderWidth={1}
      borderColor={ui.borderSubtle}
      backgroundColor={ui.surface}
      style={getShadowStyle('sm')}
    >
      <XStack alignItems="center" justifyContent="space-between">
        <YStack
          width={34}
          height={34}
          borderRadius={radius.chip}
          backgroundColor={ui.roseSurface}
          alignItems="center"
          justifyContent="center"
        >
          <Icon size={17} color={ui.brand} />
        </YStack>
        {!real ? <SampleDot ui={ui} /> : null}
      </XStack>
      <Text fontSize={22} fontWeight="800" color={ui.text} letterSpacing={-0.5}>
        {value}
      </Text>
      <YStack>
        <Text fontSize={12} color={ui.textMuted} fontWeight="600">
          {label}
        </Text>
        {hint ? (
          <Text fontSize={11} color={ui.textMuted} fontWeight="500">
            {hint}
          </Text>
        ) : null}
      </YStack>
    </YStack>
  )
}

function AddressBlock({ ui, address }: { ui: AppUiTokens; address: ShopAddressDetails | null }) {
  const lines = address
    ? [
        address.address_line_1,
        address.address_line_2,
        [address.city, address.state].map((part) => part?.trim()).filter(Boolean).join(', ') || null,
        [address.postal_code, address.country ? getCountryName(address.country, address.country) : null]
          .map((part) => part?.trim())
          .filter(Boolean)
          .join(' • ') || null,
      ].filter((line): line is string => Boolean(line && line.trim()))
    : []

  if (lines.length === 0) {
    return <PlaceholderNote ui={ui} text="Connect an address to display your pickup / return location." />
  }

  return (
    <YStack gap="$1" marginTop="$1">
      {lines.map((line, index) => (
        <Text
          key={`${line}-${index}`}
          fontSize={13}
          color={index === 0 ? ui.text : ui.textSecondary}
          fontWeight={index === 0 ? '700' : '500'}
          lineHeight={19}
        >
          {line}
        </Text>
      ))}
    </YStack>
  )
}

function ContactRow({
  ui,
  icon,
  label,
  value,
  isLink,
}: {
  ui: AppUiTokens
  icon: IconType
  label: string
  value: string | null
  isLink?: boolean
}) {
  const Icon = icon
  const hasValue = Boolean(value)
  const clickable = hasValue && isLink
  return (
    <XStack alignItems="center" gap="$2.5">
      <Icon size={16} color={ui.textMuted} />
      <YStack flex={1} minWidth={0}>
        <Text fontSize={11} color={ui.textMuted} fontWeight="600">
          {label}
        </Text>
        <Text
          fontSize={13}
          color={hasValue ? (isLink ? ui.link : ui.text) : ui.textMuted}
          fontWeight="600"
          numberOfLines={1}
          cursor={clickable ? 'pointer' : undefined}
          onPress={clickable ? () => openExternalUrl(value) : undefined}
        >
          {value || 'Not provided'}
        </Text>
      </YStack>
    </XStack>
  )
}

function SnapshotRow({
  ui,
  label,
  value,
  delta,
}: {
  ui: AppUiTokens
  label: string
  value: string
  delta: string
}) {
  return (
    <XStack alignItems="center" justifyContent="space-between">
      <Text fontSize={13} color={ui.textSecondary} fontWeight="600">
        {label}
      </Text>
      <XStack alignItems="center" gap="$2">
        <Text fontSize={15} fontWeight="800" color={ui.text}>
          {value}
        </Text>
        <XStack
          alignItems="center"
          gap={2}
          paddingHorizontal={6}
          paddingVertical={2}
          borderRadius={999}
          backgroundColor={ui.badgeSuccessBg}
        >
          <Icons.TrendingUp size={10} color={ui.badgeSuccessText} />
          <Text fontSize={10} fontWeight="700" color={ui.badgeSuccessText}>
            {delta}
          </Text>
        </XStack>
      </XStack>
    </XStack>
  )
}

function PlaceholderPill({ ui, icon, label }: { ui: AppUiTokens; icon: IconType; label: string }) {
  const Icon = icon
  return (
    <XStack
      alignItems="center"
      gap={4}
      paddingHorizontal={8}
      paddingVertical={3}
      borderRadius={999}
      backgroundColor={ui.chip}
    >
      <Icon size={12} color={ui.brand} />
      <Text fontSize={11} fontWeight="700" color={ui.textSecondary}>
        {label}
      </Text>
    </XStack>
  )
}

function PlaceholderNote({ ui, text }: { ui: AppUiTokens; text: string }) {
  return (
    <Text fontSize={13} color={ui.textMuted} lineHeight={19} marginTop="$1" fontStyle="italic">
      {text}
    </Text>
  )
}

/** Small badge marking a widget whose values are illustrative placeholders. */
function SampleBadge({ ui }: { ui: AppUiTokens }) {
  return (
    <XStack
      alignItems="center"
      gap={4}
      paddingHorizontal={8}
      paddingVertical={2}
      borderRadius={999}
      backgroundColor={ui.chip}
    >
      <YStack width={6} height={6} borderRadius={999} backgroundColor={ui.textMuted} />
      <Text fontSize={10} fontWeight="700" color={ui.textMuted} letterSpacing={0.3}>
        SAMPLE
      </Text>
    </XStack>
  )
}

function SampleDot({ ui }: { ui: AppUiTokens }) {
  return (
    <XStack
      alignItems="center"
      paddingHorizontal={6}
      paddingVertical={1}
      borderRadius={999}
      backgroundColor={ui.chip}
    >
      <Text fontSize={9} fontWeight="700" color={ui.textMuted} letterSpacing={0.3}>
        SAMPLE
      </Text>
    </XStack>
  )
}
