import { useEffect, useMemo, useState, type ReactNode } from 'react'

import {
  ImageUploadField,
  preparePickedImagesForUpload,
} from '~/components/media/ImageUploadField'
import {
  Badge,
  Button,
  Icons,
  Image,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectViewport,
  Spinner,
  Text,
  TextArea,
  useAppToast,
  XStack,
  YStack,
} from '~/components/ui'
import { PhoneInput } from '~/components/forms/PhoneInput'
import { getShadowStyle, radius } from '~/config/tokens'
import { useAppLayout } from '~/hooks/useAppLayout'
import { useUploadProgress } from '~/hooks/useUploadProgress'
import { useAppDispatch, useAppSelector } from '~/lib/store/hooks'
import type { PickedImage } from '~/lib/media/pick-image'
import { validateShopField } from '~/lib/shop/shop.validation'
import { optionalUrl, slug as slugValidator } from '~/lib/validation'
import { supabase } from '~/lib/supabase'
import { uploadShopLogoImage } from '~/lib/supabase/storage-upload'
import { useSupabase } from '~/providers/SupabaseProvider'
import {
  adminUpdateShop,
  createShop,
  deleteShop,
  loadAdminShops,
  loadPlatformStats,
  setShopActiveAdmin,
  verifyShop,
} from '~/lib/shop/shop.store'
import type { Shop, ShopFormData, ShopUpdate } from '~/lib/shop/shop.type'
import { COMMON_SHOP_CATEGORIES } from '~/lib/shop/shop.type'
import {
  formatShopHours,
  getCurrencySymbol,
  getShopCompletionPercentage,
  shopToFormData,
} from '~/lib/shop/shop.utils'

const PAGE_SIZE = 20

type ShopStatusFilter = 'all' | 'active' | 'inactive'
type VerificationFilter = 'all' | 'verified' | 'pending'
type FormMode = 'create' | 'edit'
type AdminShopView = 'list' | 'details' | 'editor'

type OwnerProfile = {
  id: string
  username: string | null
  full_name: string | null
  avatar_url: string | null
  email: string | null
  phone: string | null
  role: string | null
  occupation: string | null
  business_name: string | null
  location: string | null
  bio: string | null
  is_verified: boolean | null
  follower_count: number | null
}

type ShopFormState = Pick<
  ShopFormData,
  | 'shop_name'
  | 'shop_description'
  | 'logo_url'
  | 'website_url'
  | 'shop_phone_number'
  | 'shop_email'
  | 'shop_currency'
> & {
  ownerUserId: string
  slug: string
  categoriesText: string
  seoTitle: string
  seoDescription: string
}

const EMPTY_FORM: ShopFormState = {
  ownerUserId: '',
  shop_name: '',
  shop_description: '',
  logo_url: '',
  website_url: '',
  shop_phone_number: '',
  shop_email: '',
  shop_currency: 'INR',
  slug: '',
  categoriesText: '',
  seoTitle: '',
  seoDescription: '',
}

export function AdminShopsManager() {
  const dispatch = useAppDispatch()
  const toast = useAppToast()
  const { user } = useSupabase()
  const { isDesktop, safeBottom } = useAppLayout()
  const {
    adminShops,
    totalAdminShops,
    hasMoreAdminShops,
    platformStats,
    isLoadingShops,
    isCreating,
    isUpdating,
    isDeleting,
    error,
  } = useAppSelector((state) => state.shop)

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<ShopStatusFilter>('all')
  const [verificationFilter, setVerificationFilter] = useState<VerificationFilter>('all')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [selectedShopId, setSelectedShopId] = useState<string | null>(null)
  const [view, setView] = useState<AdminShopView>('list')
  const [formMode, setFormMode] = useState<FormMode>('create')
  const [form, setForm] = useState<ShopFormState>(EMPTY_FORM)
  const [logoImages, setLogoImages] = useState<PickedImage[]>([])
  const [isUploadingLogo, setIsUploadingLogo] = useState(false)
  const [ownerProfilesById, setOwnerProfilesById] = useState<Record<string, OwnerProfile>>({})
  const { progress: uploadProgress, track: trackUpload, reset: resetUpload } = useUploadProgress()

  const selectedShop = adminShops.find((shop) => shop.id === selectedShopId) ?? adminShops[0] ?? null
  const selectedOwner = selectedShop ? ownerProfilesById[selectedShop.user_id] ?? null : null
  const isBusy = isCreating || isUpdating || isDeleting || isUploadingLogo

  const filters = useMemo(
    () => ({
      search: search.trim() || undefined,
      isActive: statusFilter === 'all' ? undefined : statusFilter === 'active',
      verified: verificationFilter === 'all' ? undefined : verificationFilter === 'verified',
      category: categoryFilter === 'all' ? undefined : categoryFilter,
    }),
    [categoryFilter, search, statusFilter, verificationFilter],
  )

  useEffect(() => {
    dispatch(loadPlatformStats())
  }, [dispatch])

  useEffect(() => {
    dispatch(loadAdminShops({ filters, pagination: { limit: PAGE_SIZE, offset: 0 } }))
  }, [dispatch, filters])

  useEffect(() => {
    if (!selectedShopId && adminShops[0]) {
      setSelectedShopId(adminShops[0].id)
    }
  }, [adminShops, selectedShopId])

  useEffect(() => {
    const userIds = Array.from(new Set(adminShops.map((shop) => shop.user_id).filter(Boolean)))
    if (!userIds.length) return

    let cancelled = false

    async function loadOwners() {
      const { data } = await supabase
        .from('profiles')
        .select(
          'id, username, full_name, avatar_url, email, phone, role, occupation, business_name, location, bio, is_verified, follower_count',
        )
        .in('id', userIds)

      if (cancelled || !data) return

      setOwnerProfilesById((current) => {
        const next = { ...current }
        for (const profile of data) {
          next[profile.id] = profile as OwnerProfile
        }
        return next
      })
    }

    loadOwners()

    return () => {
      cancelled = true
    }
  }, [adminShops])

  function openShopDetails(shopId: string) {
    setSelectedShopId(shopId)
    setView('details')
  }

  function loadMore() {
    dispatch(
      loadAdminShops({
        filters,
        pagination: { limit: PAGE_SIZE, offset: adminShops.length },
      }),
    )
  }

  function openCreateForm() {
    setFormMode('create')
    setForm(EMPTY_FORM)
    setLogoImages([])
    resetUpload()
    setView('editor')
  }

  function openEditForm(shop: Shop) {
    const data = shopToFormData(shop)
    setFormMode('edit')
    setForm({
      ownerUserId: shop.user_id,
      shop_name: data.shop_name,
      shop_description: data.shop_description,
      logo_url: data.logo_url,
      website_url: data.website_url,
      shop_phone_number: data.shop_phone_number,
      shop_email: data.shop_email,
      shop_currency: data.shop_currency,
      slug: shop.slug ?? '',
      categoriesText: data.shop_categories.join(', '),
      seoTitle: shop.seo_title ?? '',
      seoDescription: shop.seo_description ?? '',
    })
    setLogoImages([])
    resetUpload()
    setView('editor')
  }

  async function submitForm() {
    const categories = splitCsv(form.categoriesText)

    async function uploadSelectedLogo(shopId: string, ownerUserId: string) {
      if (!logoImages.length) return form.logo_url
      if (!user?.id) throw new Error('You must be signed in to upload a shop image.')

      setIsUploadingLogo(true)
      const [file] = await preparePickedImagesForUpload(logoImages.slice(0, 1))
      if (!file) throw new Error('Please select a valid image.')

      // Prefer the shop owner's folder so storage paths stay with the storefront.
      const storageUserId = ownerUserId.trim() || user.id
      trackUpload(1)
      const { data, error: uploadError } = await uploadShopLogoImage(
        storageUserId,
        shopId,
        file,
        { onProgress: trackUpload },
      )
      if (uploadError || !data) {
        throw new Error(uploadError ?? 'Shop logo upload failed.')
      }
      return data.publicUrl
    }

    try {
      if (formMode === 'create') {
        const created = await dispatch(
          createShop({
            userId: form.ownerUserId.trim() || undefined,
            formData: {
              shop_name: form.shop_name.trim(),
              shop_description: form.shop_description.trim(),
              logo_url: '',
              website_url: form.website_url.trim(),
              shop_phone_number: form.shop_phone_number.trim(),
              shop_email: form.shop_email.trim(),
              shop_currency: form.shop_currency.trim().toUpperCase() || 'INR',
              shop_categories: categories,
            },
          }),
        ).unwrap()

        if (!created?.id) throw new Error('The shop could not be created.')
        const ownerUserId = created.user_id || form.ownerUserId.trim() || user?.id || ''
        const logoUrl = await uploadSelectedLogo(created.id, ownerUserId)
        const hasPostCreateUpdates =
          Boolean(logoUrl) || Boolean(form.slug || form.seoTitle || form.seoDescription)

        if (hasPostCreateUpdates) {
          await dispatch(
            adminUpdateShop({
              shopId: created.id,
              updates: {
                logo_url: nullableText(logoUrl),
                slug: nullableText(form.slug),
                seo_title: nullableText(form.seoTitle),
                seo_description: nullableText(form.seoDescription),
              },
            }),
          ).unwrap()
        }

        setSelectedShopId(created.id)
        toast.show('Shop created', {
          tone: 'success',
          message: 'The shop and uploaded logo were saved.',
        })
      } else {
        if (!selectedShop) return
        const logoUrl = await uploadSelectedLogo(selectedShop.id, selectedShop.user_id)
        const updates: ShopUpdate = {
          shop_name: form.shop_name.trim(),
          shop_description: nullableText(form.shop_description),
          logo_url: nullableText(logoUrl),
          website_url: nullableText(form.website_url),
          shop_phone_number: nullableText(form.shop_phone_number),
          shop_email: nullableText(form.shop_email),
          shop_currency: form.shop_currency.trim().toUpperCase() || 'INR',
          shop_categories: categories,
          slug: nullableText(form.slug),
          seo_title: nullableText(form.seoTitle),
          seo_description: nullableText(form.seoDescription),
        }

        await dispatch(adminUpdateShop({ shopId: selectedShop.id, updates })).unwrap()
        toast.show('Shop updated', { tone: 'success' })
      }

      setLogoImages([])
      resetUpload()
      setView('details')
      dispatch(loadPlatformStats())
      dispatch(loadAdminShops({ filters, pagination: { limit: PAGE_SIZE, offset: 0 } }))
    } catch (submitError) {
      toast.show(formMode === 'create' ? 'Could not create shop' : 'Could not update shop', {
        tone: 'danger',
        message: submitError instanceof Error ? submitError.message : 'Try again.',
      })
    } finally {
      setIsUploadingLogo(false)
    }
  }

  async function toggleVerified(shop: Shop) {
    await dispatch(verifyShop({ shopId: shop.id, verified: !shop.verified })).unwrap()
    dispatch(loadPlatformStats())
  }

  async function toggleActive(shop: Shop) {
    await dispatch(setShopActiveAdmin({ shopId: shop.id, isActive: !shop.is_active })).unwrap()
    dispatch(loadPlatformStats())
  }

  async function softDeleteShop(shop: Shop) {
    await dispatch(deleteShop(shop.id)).unwrap()
    dispatch(loadPlatformStats())
    setView('list')
  }

  return (
    <YStack width="100%" gap="$4" paddingHorizontal={isDesktop ? '$6' : '$4'} paddingTop="$5" paddingBottom={safeBottom + 28}>
      {error ? (
        <YStack padding="$3" borderRadius={radius.card} backgroundColor="$red3" borderWidth={1} borderColor="$red7">
          <Text color="$red11" fontWeight="700">{error}</Text>
        </YStack>
      ) : null}

      {view === 'list' ? (
        <>
          <AdminShopHeader
            total={totalAdminShops}
            platformStats={platformStats}
            onCreate={openCreateForm}
          />
          <AdminShopFilters
            search={search}
            statusFilter={statusFilter}
            verificationFilter={verificationFilter}
            categoryFilter={categoryFilter}
            onSearchChange={setSearch}
            onStatusChange={setStatusFilter}
            onVerificationChange={setVerificationFilter}
            onCategoryChange={setCategoryFilter}
          />
          <AdminShopList
            shops={adminShops}
            selectedShopId={selectedShop?.id ?? null}
            loading={isLoadingShops}
            hasMore={hasMoreAdminShops}
            total={totalAdminShops}
            onSelect={openShopDetails}
            onLoadMore={loadMore}
          />
        </>
      ) : null}

      {view === 'details' ? (
        <YStack gap="$4" width="100%" maxWidth={1180} alignSelf="center">
          <XStack alignItems="center" justifyContent="space-between" gap="$3" flexWrap="wrap">
            <Button tone="ghost" icon={Icons.ArrowLeft} onPress={() => setView('list')}>
              Back to shops
            </Button>
            {selectedShop ? (
              <Button icon={Icons.Pencil} onPress={() => openEditForm(selectedShop)}>
                Edit shop
              </Button>
            ) : null}
          </XStack>
          {selectedShop ? (
            <ShopDetailsPanel
              shop={selectedShop}
              owner={selectedOwner}
              busy={isBusy}
              onEdit={() => openEditForm(selectedShop)}
              onToggleVerified={() => toggleVerified(selectedShop)}
              onToggleActive={() => toggleActive(selectedShop)}
              onDelete={() => softDeleteShop(selectedShop)}
            />
          ) : (
            <EmptyPanel title="No shop selected" description="Return to the shop list and select a shop." />
          )}
        </YStack>
      ) : null}

      {view === 'editor' ? (
        <ShopEditorPage
          mode={formMode}
          form={form}
          currentLogoUrl={formMode === 'edit' ? form.logo_url : null}
          logoImages={logoImages}
          uploadProgress={uploadProgress}
          busy={isBusy}
          onCancel={() => setView(formMode === 'edit' ? 'details' : 'list')}
          onLogoImagesChange={setLogoImages}
          onChange={(patch) => setForm((current) => ({ ...current, ...patch }))}
          onSubmit={submitForm}
        />
      ) : null}
    </YStack>
  )
}

function AdminShopHeader({
  total,
  platformStats,
  onCreate,
}: {
  total: number
  platformStats: { totalShops: number; activeShops: number; verifiedShops: number; pendingVerification: number } | null
  onCreate: () => void
}) {
  const stats = [
    { label: 'Total', value: platformStats?.totalShops ?? total, tone: 'info' as const },
    { label: 'Active', value: platformStats?.activeShops ?? 0, tone: 'success' as const },
    { label: 'Verified', value: platformStats?.verifiedShops ?? 0, tone: 'brand' as const },
    { label: 'Pending', value: platformStats?.pendingVerification ?? 0, tone: 'warning' as const },
  ]

  return (
    <YStack gap="$3">
      <XStack alignItems="center" justifyContent="space-between" gap="$3" flexWrap="wrap">
        <YStack gap="$1">
          <Text fontSize={26} fontWeight="800" color="$color12">Shop Management</Text>
          <Text color="$color10">Review shops, inspect owner data, verify, activate, edit, create, or soft-delete.</Text>
        </YStack>
        <Button icon={Icons.Plus} onPress={onCreate}>Create shop</Button>
      </XStack>

      <XStack gap="$3" flexWrap="wrap">
        {stats.map((stat) => (
          <YStack
            key={stat.label}
            minWidth={150}
            flex={1}
            padding="$3"
            borderRadius={radius.card}
            borderWidth={1}
            borderColor="$borderColor"
            backgroundColor="$background"
            style={getShadowStyle('sm')}
          >
            <Badge tone={stat.tone}>{stat.label}</Badge>
            <Text marginTop="$2" fontSize={24} fontWeight="800" color="$color12">{stat.value}</Text>
          </YStack>
        ))}
      </XStack>
    </YStack>
  )
}

function AdminShopFilters({
  search,
  statusFilter,
  verificationFilter,
  categoryFilter,
  onSearchChange,
  onStatusChange,
  onVerificationChange,
  onCategoryChange,
}: {
  search: string
  statusFilter: ShopStatusFilter
  verificationFilter: VerificationFilter
  categoryFilter: string
  onSearchChange: (value: string) => void
  onStatusChange: (value: ShopStatusFilter) => void
  onVerificationChange: (value: VerificationFilter) => void
  onCategoryChange: (value: string) => void
}) {
  const activeCount = [
    search.trim() ? 1 : 0,
    statusFilter !== 'all' ? 1 : 0,
    verificationFilter !== 'all' ? 1 : 0,
    categoryFilter !== 'all' ? 1 : 0,
  ].reduce((total, value) => total + value, 0)

  const statusOptions: { value: ShopStatusFilter; label: string }[] = [
    { value: 'all', label: 'All shops' },
    { value: 'active', label: 'Active shops' },
    { value: 'inactive', label: 'Inactive shops' },
  ]
  const verificationOptions: { value: VerificationFilter; label: string }[] = [
    { value: 'all', label: 'All verification' },
    { value: 'verified', label: 'Verified shops' },
    { value: 'pending', label: 'Pending verification' },
  ]
  const categoryOptions = [
    { value: 'all', label: 'All categories' },
    ...COMMON_SHOP_CATEGORIES.map((category) => ({ value: category, label: category })),
  ]

  function resetFilters() {
    onSearchChange('')
    onStatusChange('all')
    onVerificationChange('all')
    onCategoryChange('all')
  }

  return (
    <YStack
      gap="$4"
      padding="$4"
      borderRadius={radius.card}
      borderWidth={1}
      borderColor="$borderColor"
      backgroundColor="$background"
      style={getShadowStyle('sm')}
    >
      <XStack alignItems="center" justifyContent="space-between" gap="$3" flexWrap="wrap">
        <XStack alignItems="center" gap="$2">
          <YStack width={34} height={34} borderRadius={999} alignItems="center" justifyContent="center" backgroundColor="$color2">
            <Icons.SlidersHorizontal size={16} color="$color10" />
          </YStack>
          <YStack>
            <Text fontWeight="800" color="$color12">Filter shops</Text>
            <Text fontSize={12} color="$color10">
              Use dropdowns to narrow the admin shop list
            </Text>
          </YStack>
        </XStack>
        <XStack alignItems="center" gap="$2">
          {activeCount > 0 ? <Badge tone="brand">{activeCount} active</Badge> : null}
          <Button tone="ghost" size="$3" onPress={resetFilters} disabled={activeCount === 0}>
            Reset
          </Button>
        </XStack>
      </XStack>

      <XStack gap="$3" flexWrap="wrap" alignItems="flex-end" width="100%">
        <FilterField label="Search" flex={1.4} minWidth={240}>
          <Input value={search} onChangeText={onSearchChange} placeholder="Search by shop name or email" />
        </FilterField>
        <FilterField label="Status" flex={1} minWidth={190}>
          <FilterSelect
            value={statusFilter}
            options={statusOptions}
            placeholder="Select status"
            onValueChange={(value) => onStatusChange(value as ShopStatusFilter)}
          />
        </FilterField>
        <FilterField label="Verification" flex={1} minWidth={210}>
          <FilterSelect
            value={verificationFilter}
            options={verificationOptions}
            placeholder="Select verification"
            onValueChange={(value) => onVerificationChange(value as VerificationFilter)}
          />
        </FilterField>
        <FilterField label="Category" flex={1.2} minWidth={240}>
          <FilterSelect
            value={categoryFilter}
            options={categoryOptions}
            placeholder="Select category"
            onValueChange={onCategoryChange}
          />
        </FilterField>
      </XStack>
    </YStack>
  )
}

function FilterField({
  label,
  children,
  flex,
  minWidth,
}: {
  label: string
  children: ReactNode
  flex?: number
  minWidth?: number
}) {
  return (
    <YStack gap="$1.5" flex={flex} minWidth={minWidth}>
      <Text fontSize={12} fontWeight="700" color="$color10">
        {label}
      </Text>
      {children}
    </YStack>
  )
}

function FilterSelect({
  value,
  options,
  placeholder,
  onValueChange,
}: {
  value: string
  options: { value: string; label: string }[]
  placeholder: string
  onValueChange: (value: string) => void
}) {
  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger width="100%" iconAfter={<Icons.ChevronDown size={16} />}>
        <Select.Value placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent zIndex={300000}>
        <SelectViewport maxHeight={320}>
          {options.map((option, index) => (
            <SelectItem key={option.value} index={index} value={option.value}>
              <Select.ItemText>{option.label}</Select.ItemText>
            </SelectItem>
          ))}
        </SelectViewport>
      </SelectContent>
    </Select>
  )
}

function AdminShopList({
  shops,
  selectedShopId,
  loading,
  hasMore,
  total,
  onSelect,
  onLoadMore,
}: {
  shops: Shop[]
  selectedShopId: string | null
  loading: boolean
  hasMore: boolean
  total: number
  onSelect: (shopId: string) => void
  onLoadMore: () => void
}) {
  if (loading && shops.length === 0) {
    return (
      <YStack minHeight={260} alignItems="center" justifyContent="center">
        <Spinner size="large" />
        <Text marginTop="$2" color="$color10">Loading shops...</Text>
      </YStack>
    )
  }

  if (!shops.length) {
    return <EmptyPanel title="No shops found" description="Try changing filters or create a new shop." />
  }

  return (
    <YStack gap="$3">
      <XStack justifyContent="space-between" alignItems="center">
        <Text fontWeight="800" color="$color12">All shops</Text>
        <Text color="$color10">{shops.length} of {total}</Text>
      </XStack>

      {shops.map((shop) => (
        <ShopRow
          key={shop.id}
          shop={shop}
          active={shop.id === selectedShopId}
          onPress={() => onSelect(shop.id)}
        />
      ))}

      {hasMore ? (
        <Button tone="outline" onPress={onLoadMore} disabled={loading}>
          {loading ? 'Loading...' : 'Load more shops'}
        </Button>
      ) : (
        <Text textAlign="center" color="$color10">End of shop list</Text>
      )}
    </YStack>
  )
}

function ShopRow({ shop, active, onPress }: { shop: Shop; active: boolean; onPress: () => void }) {
  const completion = getShopCompletionPercentage(shop)
  const categories = shopCategories(shop)

  return (
    <XStack
      gap="$3"
      padding="$3"
      borderRadius={radius.card}
      borderWidth={1}
      borderColor={active ? '$color9' : '$borderColor'}
      backgroundColor={active ? '$color2' : '$background'}
      cursor="pointer"
      animation="quick"
      hoverStyle={{ borderColor: '$color8' }}
      onPress={onPress}
      style={getShadowStyle('sm')}
    >
      <LogoBox shop={shop} size={52} />
      <YStack flex={1} minWidth={0} gap="$1">
        <XStack gap="$2" alignItems="center" flexWrap="wrap">
          <Text fontWeight="800" color="$color12" numberOfLines={1}>{shop.shop_name}</Text>
          <Badge tone={shop.verified ? 'success' : 'warning'} size="sm">
            {shop.verified ? 'Verified' : 'Pending'}
          </Badge>
          <Badge tone={shop.is_active ? 'success' : 'danger'} size="sm">
            {shop.is_active ? 'Active' : 'Inactive'}
          </Badge>
        </XStack>
        <Text color="$color10" numberOfLines={1}>{shop.shop_email || shop.user_id}</Text>
        <Text color="$color10" fontSize={12}>
          {categories.slice(0, 3).join(', ') || 'No categories'} • {completion}% complete
        </Text>
      </YStack>
      <Icons.ChevronRight size={18} color="$color10" />
    </XStack>
  )
}

export function ShopDetailsPanel({
  shop,
  owner,
  busy,
  onEdit,
  onToggleVerified,
  onToggleActive,
  onDelete,
}: {
  shop: Shop
  owner: OwnerProfile | null
  busy: boolean
  onEdit: () => void
  onToggleVerified: () => void
  onToggleActive: () => void
  onDelete: () => void
}) {
  const categories = shopCategories(shop)
  const hours = formatShopHours(shop.shop_hours as Record<string, string>)
  const socialLinks = recordEntries(shop.social_links)
  const metadata = recordEntries(shop.shop_metadata)
  const taxConfig = recordEntries(shop.tax_configuration)

  return (
    <YStack gap="$4">
      <XStack
        gap="$3"
        alignItems="center"
        padding="$4"
        borderRadius={radius.card}
        borderWidth={1}
        borderColor="$borderColor"
        backgroundColor="$background"
        style={getShadowStyle('sm')}
      >
        <LogoBox shop={shop} size={68} />
        <YStack flex={1} minWidth={0}>
          <Text fontSize={22} fontWeight="800" color="$color12" numberOfLines={1}>{shop.shop_name}</Text>
          <Text color="$color10" numberOfLines={1}>{shop.slug ? `/${shop.slug}` : shop.id}</Text>
          <XStack gap="$2" marginTop="$2" flexWrap="wrap">
            <Badge tone={shop.verified ? 'success' : 'warning'}>{shop.verified ? 'Verified' : 'Pending verification'}</Badge>
            <Badge tone={shop.is_active ? 'success' : 'danger'}>{shop.is_active ? 'Active' : 'Inactive'}</Badge>
          </XStack>
        </YStack>
      </XStack>

      <XStack
        gap="$2"
        flexWrap="wrap"
        padding="$3"
        borderRadius={radius.card}
        backgroundColor="$color2"
        borderWidth={1}
        borderColor="$borderColor"
      >
        <Button size="$3" tone="outline" icon={Icons.Pencil} onPress={onEdit} disabled={busy}>Edit</Button>
        <Button size="$3" tone={shop.verified ? 'outline' : 'primary'} onPress={onToggleVerified} disabled={busy}>
          {shop.verified ? 'Unverify' : 'Verify'}
        </Button>
        <Button size="$3" tone="outline" onPress={onToggleActive} disabled={busy}>
          {shop.is_active ? 'Deactivate' : 'Activate'}
        </Button>
        <Button size="$3" tone="destructive" icon={Icons.Trash2} onPress={onDelete} disabled={busy}>
          Soft delete
        </Button>
      </XStack>

      <DetailSection title="Owner">
        <XStack gap="$3" alignItems="center" marginBottom="$2">
          <OwnerAvatar owner={owner} size={52} />
          <YStack flex={1} minWidth={0}>
            <Text fontWeight="800" color="$color12" numberOfLines={1}>
              {owner?.full_name || owner?.username || 'Unknown owner'}
            </Text>
            <Text color="$color10" numberOfLines={1}>
              {owner?.username ? `@${owner.username}` : shop.user_id}
            </Text>
          </YStack>
          {owner?.is_verified ? <Badge tone="success">Profile verified</Badge> : null}
        </XStack>
        <DetailRow label="Owner user id" value={shop.user_id} />
        <DetailRow label="Name" value={owner?.full_name ?? 'Not available'} />
        <DetailRow label="Username" value={owner?.username ? `@${owner.username}` : 'Not available'} />
        <DetailRow label="Email" value={owner?.email ?? 'Not available'} />
        <DetailRow label="Phone" value={owner?.phone ?? 'Not available'} />
        <DetailRow label="Role" value={formatOwnerRole(owner?.role)} />
        <DetailRow label="Occupation" value={owner?.occupation ?? 'Not available'} />
        <DetailRow label="Business" value={owner?.business_name ?? 'Not available'} />
        <DetailRow label="Location" value={owner?.location ?? 'Not available'} />
        <DetailRow label="Followers" value={owner?.follower_count ?? 0} />
        <DetailRow label="Bio" value={owner?.bio ?? 'No bio'} />
        <DetailRow label="Address id" value={shop.shop_address_id ?? 'No address linked'} />
      </DetailSection>

      <DetailSection title="Shop details">
        <DetailRow label="Description" value={shop.shop_description ?? 'No description'} />
        <DetailRow label="Email" value={shop.shop_email ?? 'No email'} />
        <DetailRow label="Phone" value={shop.shop_phone_number ?? 'No phone'} />
        <DetailRow label="Website" value={shop.website_url ?? 'No website'} />
        <DetailRow label="Currency" value={`${getCurrencySymbol(shop.shop_currency)} ${shop.shop_currency}`} />
        <DetailRow label="Rating" value={`${shop.average_rating ?? 0} (${shop.total_reviews ?? 0} reviews)`} />
        <DetailRow label="Created" value={formatDate(shop.created_at)} />
        <DetailRow label="Updated" value={formatDate(shop.updated_at)} />
      </DetailSection>

      <DetailSection title="Categories">
        <XStack gap="$2" flexWrap="wrap">
          {categories.length ? categories.map((category) => <Badge key={category}>{category}</Badge>) : <Text color="$color10">No categories</Text>}
        </XStack>
      </DetailSection>

      <DetailSection title="Hours">
        {hours.length ? hours.map((item) => <DetailRow key={item.day} label={item.day} value={item.hours} />) : <Text color="$color10">No hours configured</Text>}
      </DetailSection>

      <DetailSection title="SEO">
        <DetailRow label="SEO title" value={shop.seo_title ?? shop.meta_title ?? 'No SEO title'} />
        <DetailRow label="SEO description" value={shop.seo_description ?? shop.meta_description ?? 'No SEO description'} />
        <DetailRow label="Canonical URL" value={shop.canonical_url ?? 'No canonical URL'} />
        <DetailRow label="Robots" value={`${shop.robots_index ? 'index' : 'noindex'}, ${shop.robots_follow ? 'follow' : 'nofollow'}`} />
      </DetailSection>

      <KeyValueSection title="Social links" entries={socialLinks} empty="No social links" />
      <KeyValueSection title="Tax configuration" entries={taxConfig} empty="No tax config" />
      <KeyValueSection title="Metadata" entries={metadata} empty="No metadata" />
    </YStack>
  )
}

function ShopEditorPage({
  mode,
  form,
  currentLogoUrl,
  logoImages,
  uploadProgress,
  busy,
  onCancel,
  onLogoImagesChange,
  onChange,
  onSubmit,
}: {
  mode: FormMode
  form: ShopFormState
  currentLogoUrl: string | null
  logoImages: PickedImage[]
  uploadProgress: number | null
  busy: boolean
  onCancel: () => void
  onLogoImagesChange: (images: PickedImage[]) => void
  onChange: (patch: Partial<ShopFormState>) => void
  onSubmit: () => void
}) {
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof ShopFormState, string>>>({})

  useEffect(() => {
    setFieldErrors({})
  }, [mode])

  function patchField(patch: Partial<ShopFormState>) {
    onChange(patch)
    setFieldErrors((current) => {
      const next = { ...current }
      for (const key of Object.keys(patch) as (keyof ShopFormState)[]) {
        const error = validateAdminShopField(key, patch[key] ?? '')
        if (error) next[key] = error
        else delete next[key]
      }
      return next
    })
  }

  function handleSubmit() {
    const nextErrors: Partial<Record<keyof ShopFormState, string>> = {}
    ;(
      [
        'shop_name',
        'shop_description',
        'shop_email',
        'shop_phone_number',
        'website_url',
        'shop_currency',
        'slug',
      ] as const
    ).forEach((key) => {
      const error = validateAdminShopField(key, form[key])
      if (error) nextErrors[key] = error
    })
    setFieldErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return
    onSubmit()
  }

  return (
    <YStack width="100%" maxWidth={1180} alignSelf="center" gap="$4">
      <XStack alignItems="center" justifyContent="space-between" gap="$3" flexWrap="wrap">
        <Button tone="ghost" icon={Icons.ArrowLeft} onPress={onCancel} disabled={busy}>
          Back
        </Button>
        <Button onPress={handleSubmit} disabled={busy || !form.shop_name.trim()}>
          {busy ? 'Saving...' : mode === 'create' ? 'Create shop' : 'Save changes'}
        </Button>
      </XStack>

      <YStack gap="$1">
        <Text fontSize={26} fontWeight="800" color="$color12">
          {mode === 'create' ? 'Create shop' : 'Edit shop'}
        </Text>
        <Text color="$color10">
          Add storefront details, upload the shop logo, and configure search metadata.
        </Text>
      </YStack>

      <XStack gap="$4" alignItems="flex-start" flexWrap="wrap">
        <YStack
          flex={2}
          minWidth={280}
          gap="$4"
          padding="$4"
          borderRadius={radius.card}
          borderWidth={1}
          borderColor="$borderColor"
          backgroundColor="$background"
          style={getShadowStyle('sm')}
        >
          <Text fontSize={16} fontWeight="800" color="$color12">Shop information</Text>
          <YStack gap="$3">
              {mode === 'create' ? (
                <Field label="Owner user id">
                  <Input value={form.ownerUserId} onChangeText={(ownerUserId) => patchField({ ownerUserId })} placeholder="Owner UUID, optional if current user is owner" />
                </Field>
              ) : null}
              <Field label="Shop name" required error={fieldErrors.shop_name}>
                <Input
                  value={form.shop_name}
                  onChangeText={(shop_name) => patchField({ shop_name })}
                  placeholder="Shop name"
                  invalid={Boolean(fieldErrors.shop_name)}
                />
              </Field>
              <Field label="Description" error={fieldErrors.shop_description}>
                <TextArea
                  value={form.shop_description}
                  onChangeText={(shop_description) => patchField({ shop_description })}
                  placeholder="Shop description"
                />
              </Field>
              <XStack gap="$3" flexWrap="wrap">
                <YStack flex={1} minWidth={180}>
                  <Field label="Email" error={fieldErrors.shop_email}>
                    <Input
                      value={form.shop_email}
                      onChangeText={(shop_email) => patchField({ shop_email })}
                      placeholder="shop@example.com"
                      invalid={Boolean(fieldErrors.shop_email)}
                    />
                  </Field>
                </YStack>
                <YStack flex={1} minWidth={180}>
                  <Field label="Phone" error={fieldErrors.shop_phone_number}>
                    <PhoneInput
                      value={form.shop_phone_number}
                      onChange={(shop_phone_number) => patchField({ shop_phone_number })}
                      invalid={Boolean(fieldErrors.shop_phone_number)}
                    />
                  </Field>
                </YStack>
              </XStack>
              <Field label="Website URL" error={fieldErrors.website_url}>
                <Input
                  value={form.website_url}
                  onChangeText={(website_url) => patchField({ website_url })}
                  placeholder="https://example.com"
                  invalid={Boolean(fieldErrors.website_url)}
                />
              </Field>
              <XStack gap="$3" flexWrap="wrap">
                <YStack flex={1} minWidth={160}>
                  <Field label="Currency" error={fieldErrors.shop_currency}>
                    <Input
                      value={form.shop_currency}
                      onChangeText={(shop_currency) => patchField({ shop_currency })}
                      maxLength={3}
                      placeholder="INR"
                      invalid={Boolean(fieldErrors.shop_currency)}
                    />
                  </Field>
                </YStack>
                <YStack flex={2} minWidth={220}>
                  <Field label="Categories">
                    <Input value={form.categoriesText} onChangeText={(categoriesText) => patchField({ categoriesText })} placeholder="Fashion, Beauty" />
                  </Field>
                </YStack>
              </XStack>
          </YStack>
        </YStack>

        <YStack flex={1} minWidth={280} gap="$4">
          <YStack
            gap="$3"
            padding="$4"
            borderRadius={radius.card}
            borderWidth={1}
            borderColor="$borderColor"
            backgroundColor="$background"
            style={getShadowStyle('sm')}
          >
            <Text fontSize={16} fontWeight="800" color="$color12">Shop logo</Text>
            {currentLogoUrl && logoImages.length === 0 ? (
              <XStack alignItems="center" gap="$3">
                <Image
                  source={{ uri: currentLogoUrl }}
                  width={72}
                  height={72}
                  borderRadius={radius.card}
                  backgroundColor="$color3"
                />
                <YStack flex={1} gap="$1">
                  <Text fontWeight="700" color="$color12">Current logo</Text>
                  <Text fontSize={12} color="$color10">
                    Drop a new image below to replace it.
                  </Text>
                </YStack>
              </XStack>
            ) : null}
            <ImageUploadField
              label={currentLogoUrl ? 'Replace logo' : 'Upload logo'}
              value={logoImages}
              onChange={onLogoImagesChange}
              aspect="square"
              disabled={busy}
              hint="Drag and drop an image or browse your device. PNG, JPG, WebP, or GIF up to 8 MB."
              uploadProgress={uploadProgress}
              uploadLabel="Uploading to shop-images…"
            />
          </YStack>

          <YStack
            gap="$3"
            padding="$4"
            borderRadius={radius.card}
            borderWidth={1}
            borderColor="$borderColor"
            backgroundColor="$background"
            style={getShadowStyle('sm')}
          >
            <Text fontSize={16} fontWeight="800" color="$color12">Search and sharing</Text>
            <YStack gap="$3">
              <Field label="Slug" error={fieldErrors.slug}>
                <Input
                  value={form.slug}
                  onChangeText={(slug) => patchField({ slug })}
                  placeholder="shop-slug"
                  invalid={Boolean(fieldErrors.slug)}
                />
              </Field>
              <Field label="SEO title">
                <Input value={form.seoTitle} onChangeText={(seoTitle) => patchField({ seoTitle })} placeholder="Search title" />
              </Field>
              <Field label="SEO description">
                <TextArea value={form.seoDescription} onChangeText={(seoDescription) => patchField({ seoDescription })} placeholder="Search description" />
              </Field>
            </YStack>
          </YStack>
        </YStack>
      </XStack>

      <XStack gap="$2" justifyContent="flex-end" flexWrap="wrap">
        <Button tone="outline" onPress={onCancel} disabled={busy}>Cancel</Button>
        <Button onPress={handleSubmit} disabled={busy || !form.shop_name.trim()}>
          {busy ? 'Saving...' : mode === 'create' ? 'Create shop' : 'Save changes'}
        </Button>
      </XStack>
    </YStack>
  )
}

function LogoBox({ shop, size }: { shop: Shop; size: number }) {
  if (shop.logo_url) {
    return (
      <Image
        source={{ uri: shop.logo_url }}
        width={size}
        height={size}
        borderRadius={radius.card}
        backgroundColor="$color3"
      />
    )
  }

  return (
    <YStack width={size} height={size} borderRadius={radius.card} alignItems="center" justifyContent="center" backgroundColor="$color3">
      <Icons.Store size={Math.round(size * 0.42)} color="$color10" />
    </YStack>
  )
}

function OwnerAvatar({ owner, size }: { owner: OwnerProfile | null; size: number }) {
  if (owner?.avatar_url) {
    return (
      <Image
        source={{ uri: owner.avatar_url }}
        width={size}
        height={size}
        borderRadius={999}
        backgroundColor="$color3"
      />
    )
  }

  return (
    <YStack width={size} height={size} borderRadius={999} alignItems="center" justifyContent="center" backgroundColor="$color3">
      <Icons.User size={Math.round(size * 0.42)} color="$color10" />
    </YStack>
  )
}

function DetailSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <YStack
      gap="$2.5"
      padding="$4"
      borderRadius={radius.card}
      borderWidth={1}
      borderColor="$borderColor"
      backgroundColor="$background"
      style={getShadowStyle('sm')}
    >
      <XStack alignItems="center" gap="$2">
        <YStack width={4} height={18} borderRadius={999} backgroundColor="$color9" />
        <Text fontSize={14} fontWeight="800" color="$color12">{title}</Text>
      </XStack>
      <YStack gap="$2.5">
        {children}
      </YStack>
    </YStack>
  )
}

function DetailRow({ label, value }: { label: string; value: string | number }) {
  return (
    <XStack gap="$3" justifyContent="space-between" alignItems="flex-start">
      <Text flex={1} color="$color10" fontSize={12}>{label}</Text>
      <Text flex={2} color="$color12" fontSize={12} fontWeight="600" textAlign="right">{String(value)}</Text>
    </XStack>
  )
}

function KeyValueSection({ title, entries, empty }: { title: string; entries: [string, string][]; empty: string }) {
  return (
    <DetailSection title={title}>
      {entries.length ? entries.map(([key, value]) => <DetailRow key={key} label={key} value={value} />) : <Text color="$color10">{empty}</Text>}
    </DetailSection>
  )
}

function EmptyPanel({ title, description }: { title: string; description: string }) {
  return (
    <YStack minHeight={220} alignItems="center" justifyContent="center" gap="$2" padding="$4" borderRadius={radius.card} borderWidth={1} borderColor="$borderColor" backgroundColor="$background">
      <Icons.Store size={28} color="$color10" />
      <Text fontWeight="800" color="$color12">{title}</Text>
      <Text color="$color10" textAlign="center">{description}</Text>
    </YStack>
  )
}

function Field({
  label,
  required,
  error,
  children,
}: {
  label: string
  required?: boolean
  error?: string
  children: React.ReactNode
}) {
  return (
    <YStack gap="$2">
      <Text fontSize={12} fontWeight="700" color="$color11">
        {label}{required ? ' *' : ''}
      </Text>
      {children}
      {error ? (
        <Text fontSize={12} color="$red10">
          {error}
        </Text>
      ) : null}
    </YStack>
  )
}

function validateAdminShopField(field: keyof ShopFormState, value: string): string | null {
  if (
    field === 'shop_name' ||
    field === 'shop_description' ||
    field === 'shop_email' ||
    field === 'shop_phone_number' ||
    field === 'website_url' ||
    field === 'shop_currency'
  ) {
    return validateShopField(field, value).error
  }
  if (field === 'logo_url') {
    return optionalUrl('Please enter a valid URL starting with http:// or https://.')(value)
  }
  if (field === 'slug') {
    if (!value.trim()) return null
    return slugValidator()(value.trim())
  }
  return null
}

function splitCsv(value: string) {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}

function nullableText(value: string) {
  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

function shopCategories(shop: Pick<Shop, 'shop_categories'>) {
  return Array.isArray(shop.shop_categories) ? (shop.shop_categories as string[]) : []
}

function recordEntries(value: unknown): [string, string][] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return []
  return Object.entries(value as Record<string, unknown>).map(([key, item]) => [
    key,
    typeof item === 'string' ? item : JSON.stringify(item),
  ])
}

function formatDate(value: string | null) {
  if (!value) return 'Not set'
  return new Date(value).toLocaleString()
}

function formatOwnerRole(role: string | null | undefined) {
  if (role === 'A') return 'Admin'
  if (role === 'V') return 'Vendor'
  if (role === 'U') return 'User'
  return role ?? 'Not available'
}
