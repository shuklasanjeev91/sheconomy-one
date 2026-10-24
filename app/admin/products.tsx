import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useRouter } from 'one'
import { blockedContentMessage } from '~/lib/safety/content-screen'

import {
  Badge,
  Button,
  ConfirmDialog,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogOverlay,
  DialogTitle,
  Icons,
  Image,
  Input,
  ScrollView,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectViewport,
  Spinner,
  Switch,
  Text,
  TextArea,
  useAppToast,
  XStack,
  YStack,
} from '~/components/ui'
import { getShadowStyle, radius } from '~/config/tokens'
import { useAppLayout } from '~/hooks/useAppLayout'
import { commerceRoutes } from '~/lib/routes'
import { supabase, type Json, type Tables, type TablesInsert, type TablesUpdate } from '~/lib/supabase'

type ListingRow = Tables<'listings'>
type ListingInsert = TablesInsert<'listings'>
type ListingUpdate = TablesUpdate<'listings'>
type ListingImageRow = Tables<'listing_images'>
type ListingVariationRow = Tables<'listing_variations'>
type ListingAttributeRow = Tables<'listing_attributes'>
type ListingMaterialRow = Tables<'listing_materials'>
type ShopRow = Tables<'shops'>
type ProfileRow = Tables<'profiles'>

type ListingType = ListingRow['listing_type']
type ListingStatus = ListingRow['listing_status']
type TypeFilter = 'all' | ListingType
type StatusFilter = 'all' | ListingStatus
type ActiveFilter = 'all' | 'active' | 'inactive' | 'featured'
type ProductFormMode = 'create' | 'edit'

type ListingBundle = {
  images: ListingImageRow[]
  variations: ListingVariationRow[]
  attributes: ListingAttributeRow[]
  materials: ListingMaterialRow[]
}

type ProductFormState = {
  shop_id: string
  title: string
  description: string
  listing_type: ListingType
  price: string
  quantity: string
  category: string
  sku: string
  slug: string
  listing_status: ListingStatus
  is_active: boolean
  is_featured: boolean
  stock: string
  weight: string
  shipping_required: boolean
  dimensionsText: string
  digital_file_url: string
  digital_file_size: string
  digital_file_type: string
  download_limit: string
  is_online: boolean
  booking_duration_minutes: string
  meeting_url: string
  max_attendees: string
  requires_approval: boolean
  meta_title: string
  meta_description: string
  tagsText: string
  listingMetadataText: string
}

const PAGE_SIZE = 20

const EMPTY_FORM: ProductFormState = {
  shop_id: '',
  title: '',
  description: '',
  listing_type: 'physical',
  price: '',
  quantity: '1',
  category: '',
  sku: '',
  slug: '',
  listing_status: 'draft',
  is_active: true,
  is_featured: false,
  stock: '1',
  weight: '',
  shipping_required: true,
  dimensionsText: '{}',
  digital_file_url: '',
  digital_file_size: '',
  digital_file_type: '',
  download_limit: '',
  is_online: false,
  booking_duration_minutes: '',
  meeting_url: '',
  max_attendees: '1',
  requires_approval: false,
  meta_title: '',
  meta_description: '',
  tagsText: '',
  listingMetadataText: '{}',
}

const EMPTY_BUNDLE: ListingBundle = {
  images: [],
  variations: [],
  attributes: [],
  materials: [],
}

export default function AdminProductsPage() {
  return <AdminProductsManager />
}

function AdminProductsManager() {
  const router = useRouter()
  const toast = useAppToast()
  const { isDesktop, safeBottom } = useAppLayout()

  const [listings, setListings] = useState<ListingRow[]>([])
  const [shopsById, setShopsById] = useState<Record<string, ShopRow>>({})
  const [ownersById, setOwnersById] = useState<Record<string, ProfileRow>>({})
  const [bundlesByListingId, setBundlesByListingId] = useState<Record<string, ListingBundle>>({})
  const [sameShopListings, setSameShopListings] = useState<ListingRow[]>([])
  const [totalListings, setTotalListings] = useState(0)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>('all')
  const [selectedListingId, setSelectedListingId] = useState<string | null>(null)
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [formOpen, setFormOpen] = useState(false)
  const [formMode, setFormMode] = useState<ProductFormMode>('create')
  const [form, setForm] = useState<ProductFormState>(EMPTY_FORM)
  const [imageUrl, setImageUrl] = useState('')
  const [imageAlt, setImageAlt] = useState('')

  const selectedListing = listings.find((listing) => listing.id === selectedListingId) ?? listings[0] ?? null
  const selectedShop = selectedListing ? shopsById[selectedListing.shop_id] ?? null : null
  const selectedOwner = selectedShop ? ownersById[selectedShop.user_id] ?? null : null
  const selectedBundle = selectedListing ? bundlesByListingId[selectedListing.id] ?? EMPTY_BUNDLE : EMPTY_BUNDLE
  const hasMore = listings.length < totalListings

  const filters = useMemo(
    () => ({
      search: search.trim(),
      type: typeFilter,
      status: statusFilter,
      active: activeFilter,
    }),
    [activeFilter, search, statusFilter, typeFilter],
  )

  useEffect(() => {
    void loadListings({ reset: true })
  }, [filters])

  useEffect(() => {
    if (!selectedListingId && listings[0]) {
      setSelectedListingId(listings[0].id)
    }
  }, [listings, selectedListingId])

  async function loadListings({ reset }: { reset: boolean }) {
    setLoading(true)
    setError(null)

    const from = reset ? 0 : listings.length
    const to = from + PAGE_SIZE - 1
    let query = supabase
      .from('listings')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to)

    if (filters.search) {
      const value = escapeSearch(filters.search)
      query = query.or(
        `title.ilike.%${value}%,description.ilike.%${value}%,sku.ilike.%${value}%,category.ilike.%${value}%,slug.ilike.%${value}%`,
      )
    }

    if (filters.type !== 'all') {
      query = query.eq('listing_type', filters.type)
    }

    if (filters.status !== 'all') {
      query = query.eq('listing_status', filters.status)
    }

    if (filters.active === 'active') {
      query = query.eq('is_active', true)
    } else if (filters.active === 'inactive') {
      query = query.eq('is_active', false)
    } else if (filters.active === 'featured') {
      query = query.eq('is_featured', true)
    }

    const { data, count, error: loadError } = await query

    if (loadError) {
      setError(loadError.message)
      setLoading(false)
      return
    }

    const nextListings = (data ?? []) as ListingRow[]
    setListings((current) => (reset ? nextListings : [...current, ...nextListings]))
    setTotalListings(count ?? nextListings.length)
    await Promise.all([
      loadShops(nextListings.map((listing) => listing.shop_id)),
      loadListingImagesForList(nextListings.map((listing) => listing.id)),
    ])
    setLoading(false)
  }

  async function loadListingImagesForList(listingIds: string[]) {
    const ids = Array.from(new Set(listingIds.filter(Boolean)))
    if (!ids.length) return

    const { data, error: imagesError } = await supabase
      .from('listing_images')
      .select('*')
      .in('listing_id', ids)
      .order('is_primary', { ascending: false })
      .order('display_order', { ascending: true })

    if (imagesError) {
      setError(imagesError.message)
      return
    }

    const imagesByListingId = new Map<string, ListingImageRow[]>()
    for (const image of (data ?? []) as ListingImageRow[]) {
      imagesByListingId.set(image.listing_id, [...(imagesByListingId.get(image.listing_id) ?? []), image])
    }

    setBundlesByListingId((current) => {
      const next = { ...current }
      for (const listingId of ids) {
        next[listingId] = {
          ...(next[listingId] ?? EMPTY_BUNDLE),
          images: imagesByListingId.get(listingId) ?? [],
        }
      }
      return next
    })
  }

  async function loadShops(shopIds: string[]) {
    const ids = Array.from(new Set(shopIds.filter(Boolean)))
    if (!ids.length) return

    const { data, error: shopsError } = await supabase.from('shops').select('*').in('id', ids)
    if (shopsError) {
      setError(shopsError.message)
      return
    }

    const shops = (data ?? []) as ShopRow[]
    setShopsById((current) => {
      const next = { ...current }
      for (const shop of shops) next[shop.id] = shop
      return next
    })

    await loadOwners(shops.map((shop) => shop.user_id))
  }

  async function loadOwners(userIds: string[]) {
    const ids = Array.from(new Set(userIds.filter(Boolean)))
    if (!ids.length) return

    const { data, error: ownersError } = await supabase.from('profiles').select('*').in('id', ids)
    if (ownersError) {
      setError(ownersError.message)
      return
    }

    setOwnersById((current) => {
      const next = { ...current }
      for (const owner of (data ?? []) as ProfileRow[]) next[owner.id] = owner
      return next
    })
  }

  async function loadListingDetails(listing: ListingRow) {
    setSelectedListingId(listing.id)
    setDetailsOpen(true)
    await Promise.all([loadListingBundle(listing.id), loadSameShopListings(listing)])
  }

  async function loadListingBundle(listingId: string) {
    const [images, variations, attributes, materials] = await Promise.all([
      supabase.from('listing_images').select('*').eq('listing_id', listingId).order('display_order', { ascending: true }),
      supabase.from('listing_variations').select('*').eq('listing_id', listingId).order('display_order', { ascending: true }),
      supabase.from('listing_attributes').select('*').eq('listing_id', listingId).order('display_order', { ascending: true }),
      supabase.from('listing_materials').select('*').eq('listing_id', listingId).order('is_primary', { ascending: false }),
    ])

    const firstError = images.error ?? variations.error ?? attributes.error ?? materials.error
    if (firstError) {
      setError(firstError.message)
      return
    }

    setBundlesByListingId((current) => ({
      ...current,
      [listingId]: {
        images: (images.data ?? []) as ListingImageRow[],
        variations: (variations.data ?? []) as ListingVariationRow[],
        attributes: (attributes.data ?? []) as ListingAttributeRow[],
        materials: (materials.data ?? []) as ListingMaterialRow[],
      },
    }))
  }

  async function loadSameShopListings(listing: ListingRow) {
    const { data, error: sameError } = await supabase
      .from('listings')
      .select('*')
      .eq('shop_id', listing.shop_id)
      .neq('id', listing.id)
      .order('created_at', { ascending: false })
      .limit(12)

    if (sameError) {
      setError(sameError.message)
      return
    }

    setSameShopListings((data ?? []) as ListingRow[])
  }

  function openCreateForm() {
    setFormMode('create')
    setForm(EMPTY_FORM)
    setFormOpen(true)
  }

  function openEditForm(listing: ListingRow) {
    setFormMode('edit')
    setForm(listingToForm(listing))
    setFormOpen(true)
  }

  function openListing(listing: ListingRow) {
    router.push(commerceRoutes.listing(listing.slug ?? listing.id))
  }

  function openShop(shop: ShopRow) {
    router.push(commerceRoutes.shop(shop.slug ?? shop.id))
  }

  async function submitForm() {
    const validationError = validateProductForm(form)
    if (validationError) {
      toast.show('Check product details', { tone: 'danger', message: validationError })
      return
    }

    setSaving(true)
    setError(null)
    const payload = formToListingPayload(form)
    const blocked = await blockedContentMessage([
      String(payload.title ?? ''),
      String(payload.description ?? ''),
    ])
    if (blocked) {
      setSaving(false)
      setError(blocked)
      toast.show('Unable to save product', { tone: 'danger', message: blocked })
      return
    }
    const result =
      formMode === 'create'
        ? await supabase.from('listings').insert(payload as ListingInsert).select('*').single()
        : selectedListing
          ? await supabase.from('listings').update(payload as ListingUpdate).eq('id', selectedListing.id).select('*').single()
          : null

    if (!result) {
      setSaving(false)
      return
    }

    if (result.error) {
      setError(result.error.message)
      toast.show('Unable to save product', { tone: 'danger', message: result.error.message })
      setSaving(false)
      return
    }

    const saved = result.data as ListingRow
    setListings((current) => {
      if (formMode === 'create') return [saved, ...current]
      return current.map((listing) => (listing.id === saved.id ? saved : listing))
    })
    setSelectedListingId(saved.id)
    await loadShops([saved.shop_id])
    setFormOpen(false)
    setSaving(false)
    toast.show(formMode === 'create' ? 'Product created' : 'Product updated', { tone: 'success' })
  }

  async function patchListing(listingId: string, patch: ListingUpdate) {
    setSaving(true)
    setError(null)

    const { data, error: patchError } = await supabase.from('listings').update(patch).eq('id', listingId).select('*').single()
    if (patchError) {
      setError(patchError.message)
      toast.show('Unable to update product', { tone: 'danger', message: patchError.message })
      setSaving(false)
      return
    }

    const updated = data as ListingRow
    setListings((current) => current.map((listing) => (listing.id === updated.id ? updated : listing)))
    setSaving(false)
  }

  async function deleteListing(listing: ListingRow) {
    setSaving(true)
    setError(null)
    const { error: deleteError } = await supabase.from('listings').delete().eq('id', listing.id)

    if (deleteError) {
      setError(deleteError.message)
      toast.show('Unable to delete product', { tone: 'danger', message: deleteError.message })
      setSaving(false)
      return
    }

    setListings((current) => current.filter((item) => item.id !== listing.id))
    setDetailsOpen(false)
    setSelectedListingId(null)
    setSaving(false)
    toast.show('Product deleted', { tone: 'success' })
  }

  async function addImage() {
    if (!selectedListing || !imageUrl.trim()) return
    setSaving(true)
    const currentImages = selectedBundle.images
    const { error: insertError } = await supabase.from('listing_images').insert({
      listing_id: selectedListing.id,
      image_url: imageUrl.trim(),
      alt_text: nullableText(imageAlt),
      is_primary: currentImages.length === 0,
      display_order: currentImages.length,
    })

    if (insertError) {
      setError(insertError.message)
      toast.show('Unable to add image', { tone: 'danger', message: insertError.message })
    } else {
      setImageUrl('')
      setImageAlt('')
      await loadListingBundle(selectedListing.id)
    }
    setSaving(false)
  }

  async function deleteImage(image: ListingImageRow) {
    if (!selectedListing) return
    setSaving(true)
    const { error: deleteError } = await supabase.from('listing_images').delete().eq('id', image.id)
    if (deleteError) {
      setError(deleteError.message)
      toast.show('Unable to delete image', { tone: 'danger', message: deleteError.message })
    } else {
      await loadListingBundle(selectedListing.id)
    }
    setSaving(false)
  }

  async function makePrimaryImage(image: ListingImageRow) {
    if (!selectedListing) return
    setSaving(true)
    const { error: clearError } = await supabase
      .from('listing_images')
      .update({ is_primary: false })
      .eq('listing_id', selectedListing.id)
    const { error: setErrorResult } = await supabase.from('listing_images').update({ is_primary: true }).eq('id', image.id)
    const updateError = clearError ?? setErrorResult
    if (updateError) {
      setError(updateError.message)
      toast.show('Unable to update image', { tone: 'danger', message: updateError.message })
    } else {
      await loadListingBundle(selectedListing.id)
    }
    setSaving(false)
  }

  const stats = getStats(listings, totalListings)

  return (
    <YStack
      width="100%"
      gap="$4"
      paddingHorizontal={isDesktop ? '$6' : '$4'}
      paddingTop="$5"
      paddingBottom={safeBottom + 28}
    >
      <AdminProductsHeader stats={stats} onCreate={openCreateForm} />

      {error ? (
        <YStack padding="$3" borderRadius={radius.card} backgroundColor="$red3" borderWidth={1} borderColor="$red7">
          <Text color="$red11" fontWeight="700">
            {error}
          </Text>
        </YStack>
      ) : null}

      <AdminProductFilters
        search={search}
        typeFilter={typeFilter}
        statusFilter={statusFilter}
        activeFilter={activeFilter}
        onSearchChange={setSearch}
        onTypeChange={setTypeFilter}
        onStatusChange={setStatusFilter}
        onActiveChange={setActiveFilter}
      />

      <AdminProductList
        listings={listings}
        shopsById={shopsById}
        bundlesByListingId={bundlesByListingId}
        selectedListingId={selectedListing?.id ?? null}
        loading={loading}
        hasMore={hasMore}
        total={totalListings}
        onSelect={(listing) => void loadListingDetails(listing)}
        onLoadMore={() => void loadListings({ reset: false })}
      />

      <ProductDetailsDialog
        open={detailsOpen}
        listing={selectedListing}
        shop={selectedShop}
        owner={selectedOwner}
        bundle={selectedBundle}
        sameShopListings={sameShopListings}
        busy={saving}
        imageUrl={imageUrl}
        imageAlt={imageAlt}
        onOpenChange={setDetailsOpen}
        onEdit={() => selectedListing && openEditForm(selectedListing)}
        onOpenListing={() => selectedListing && openListing(selectedListing)}
        onOpenShop={() => selectedShop && openShop(selectedShop)}
        onToggleActive={() => selectedListing && patchListing(selectedListing.id, { is_active: !selectedListing.is_active })}
        onToggleFeatured={() => selectedListing && patchListing(selectedListing.id, { is_featured: !selectedListing.is_featured })}
        onSetStatus={(status) => selectedListing && patchListing(selectedListing.id, { listing_status: status })}
        onDelete={() => selectedListing && deleteListing(selectedListing)}
        onOpenRelated={openListing}
        onImageUrlChange={setImageUrl}
        onImageAltChange={setImageAlt}
        onAddImage={addImage}
        onDeleteImage={deleteImage}
        onMakePrimaryImage={makePrimaryImage}
      />

      <ProductEditorDialog
        open={formOpen}
        mode={formMode}
        form={form}
        busy={saving}
        onOpenChange={setFormOpen}
        onChange={(patch) => setForm((current) => ({ ...current, ...patch }))}
        onSubmit={submitForm}
      />
    </YStack>
  )
}

function AdminProductsHeader({ stats, onCreate }: { stats: ProductStats; onCreate: () => void }) {
  return (
    <YStack gap="$3">
      <XStack alignItems="center" justifyContent="space-between" gap="$3" flexWrap="wrap">
        <YStack gap="$1">
          <Text fontSize={26} fontWeight="800" color="$color12">
            Product Management
          </Text>
          <Text color="$color10">
            Review all listings, inspect shops and owners, manage status, feature products, and edit catalogue data.
          </Text>
        </YStack>
        <Button icon={Icons.Plus} onPress={onCreate}>
          Create product
        </Button>
      </XStack>

      <XStack gap="$3" flexWrap="wrap">
        {[
          { label: 'Total', value: stats.total, tone: 'info' as const },
          { label: 'Active', value: stats.active, tone: 'success' as const },
          { label: 'Drafts', value: stats.draft, tone: 'warning' as const },
          { label: 'Featured', value: stats.featured, tone: 'brand' as const },
        ].map((stat) => (
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
            <Text marginTop="$2" fontSize={24} fontWeight="800" color="$color12">
              {stat.value}
            </Text>
          </YStack>
        ))}
      </XStack>
    </YStack>
  )
}

function AdminProductFilters({
  search,
  typeFilter,
  statusFilter,
  activeFilter,
  onSearchChange,
  onTypeChange,
  onStatusChange,
  onActiveChange,
}: {
  search: string
  typeFilter: TypeFilter
  statusFilter: StatusFilter
  activeFilter: ActiveFilter
  onSearchChange: (value: string) => void
  onTypeChange: (value: TypeFilter) => void
  onStatusChange: (value: StatusFilter) => void
  onActiveChange: (value: ActiveFilter) => void
}) {
  const activeCount = [
    search.trim() ? 1 : 0,
    typeFilter !== 'all' ? 1 : 0,
    statusFilter !== 'all' ? 1 : 0,
    activeFilter !== 'all' ? 1 : 0,
  ].reduce((total, value) => total + value, 0)

  function resetFilters() {
    onSearchChange('')
    onTypeChange('all')
    onStatusChange('all')
    onActiveChange('all')
  }

  return (
    <YStack gap="$4" padding="$4" borderRadius={radius.card} borderWidth={1} borderColor="$borderColor" backgroundColor="$background" style={getShadowStyle('sm')}>
      <XStack alignItems="center" justifyContent="space-between" gap="$3" flexWrap="wrap">
        <XStack alignItems="center" gap="$2">
          <YStack width={34} height={34} borderRadius={999} alignItems="center" justifyContent="center" backgroundColor="$color2">
            <Icons.SlidersHorizontal size={16} color="$color10" />
          </YStack>
          <YStack>
            <Text fontWeight="800" color="$color12">
              Filter products
            </Text>
            <Text fontSize={12} color="$color10">
              Search title, description, SKU, slug, category, type, status, and active state
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
          <Input value={search} onChangeText={onSearchChange} placeholder="Search products by title, SKU, category, slug" />
        </FilterField>
        <FilterField label="Type" flex={1} minWidth={170}>
          <FilterSelect
            value={typeFilter}
            options={[
              { value: 'all', label: 'All types' },
              { value: 'physical', label: 'Physical' },
              { value: 'digital', label: 'Digital' },
              { value: 'service', label: 'Service' },
            ]}
            placeholder="Select type"
            onValueChange={(value) => onTypeChange(value as TypeFilter)}
          />
        </FilterField>
        <FilterField label="Status" flex={1} minWidth={180}>
          <FilterSelect
            value={statusFilter}
            options={statusOptions('All status')}
            placeholder="Select status"
            onValueChange={(value) => onStatusChange(value as StatusFilter)}
          />
        </FilterField>
        <FilterField label="State" flex={1} minWidth={180}>
          <FilterSelect
            value={activeFilter}
            options={[
              { value: 'all', label: 'All states' },
              { value: 'active', label: 'Active' },
              { value: 'inactive', label: 'Inactive' },
              { value: 'featured', label: 'Featured' },
            ]}
            placeholder="Select state"
            onValueChange={(value) => onActiveChange(value as ActiveFilter)}
          />
        </FilterField>
      </XStack>
    </YStack>
  )
}

function AdminProductList({
  listings,
  shopsById,
  bundlesByListingId,
  selectedListingId,
  loading,
  hasMore,
  total,
  onSelect,
  onLoadMore,
}: {
  listings: ListingRow[]
  shopsById: Record<string, ShopRow>
  bundlesByListingId: Record<string, ListingBundle>
  selectedListingId: string | null
  loading: boolean
  hasMore: boolean
  total: number
  onSelect: (listing: ListingRow) => void
  onLoadMore: () => void
}) {
  if (loading && listings.length === 0) {
    return (
      <YStack minHeight={260} alignItems="center" justifyContent="center">
        <Spinner size="large" />
        <Text marginTop="$2" color="$color10">
          Loading products...
        </Text>
      </YStack>
    )
  }

  if (!listings.length) {
    return <EmptyPanel title="No products found" description="Try changing filters or create a listing." />
  }

  return (
    <YStack gap="$3">
      <XStack justifyContent="space-between" alignItems="center">
        <Text fontWeight="800" color="$color12">
          All products
        </Text>
        <Text color="$color10">
          {listings.length} of {total}
        </Text>
      </XStack>

      {listings.map((listing) => (
        <ProductRow
          key={listing.id}
          listing={listing}
          shop={shopsById[listing.shop_id] ?? null}
          image={getPrimaryImage(bundlesByListingId[listing.id]?.images ?? [])}
          active={listing.id === selectedListingId}
          onPress={() => onSelect(listing)}
        />
      ))}

      {hasMore ? (
        <Button tone="outline" onPress={onLoadMore} disabled={loading}>
          {loading ? 'Loading...' : 'Load more products'}
        </Button>
      ) : (
        <Text textAlign="center" color="$color10">
          End of product list
        </Text>
      )}
    </YStack>
  )
}

function ProductRow({
  listing,
  shop,
  image,
  active,
  onPress,
}: {
  listing: ListingRow
  shop: ShopRow | null
  image: ListingImageRow | null
  active: boolean
  onPress: () => void
}) {
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
      <ProductThumb image={image} size={58} />
      <YStack flex={1} minWidth={0} gap="$1">
        <XStack gap="$2" alignItems="center" flexWrap="wrap">
          <Text fontWeight="800" color="$color12" numberOfLines={1}>
            {listing.title}
          </Text>
          <Badge tone={typeTone(listing.listing_type)} size="sm">
            {listing.listing_type}
          </Badge>
          <Badge tone={statusTone(listing.listing_status)} size="sm">
            {listing.listing_status.replace('_', ' ')}
          </Badge>
          {listing.is_featured ? (
            <Badge tone="brand" size="sm">
              Featured
            </Badge>
          ) : null}
        </XStack>
        <Text color="$color10" numberOfLines={1}>
          {shop?.shop_name ?? listing.shop_id}
        </Text>
        <Text color="$color10" fontSize={12}>
          {formatMoney(listing.price)} • {listing.category || 'No category'} • Stock {listing.stock ?? listing.quantity ?? 0}
        </Text>
      </YStack>
      <Icons.ChevronRight size={18} color="$color10" />
    </XStack>
  )
}

function ProductDetailsDialog({
  open,
  listing,
  shop,
  owner,
  bundle,
  sameShopListings,
  busy,
  imageUrl,
  imageAlt,
  onOpenChange,
  onEdit,
  onOpenListing,
  onOpenShop,
  onToggleActive,
  onToggleFeatured,
  onSetStatus,
  onDelete,
  onOpenRelated,
  onImageUrlChange,
  onImageAltChange,
  onAddImage,
  onDeleteImage,
  onMakePrimaryImage,
}: {
  open: boolean
  listing: ListingRow | null
  shop: ShopRow | null
  owner: ProfileRow | null
  bundle: ListingBundle
  sameShopListings: ListingRow[]
  busy: boolean
  imageUrl: string
  imageAlt: string
  onOpenChange: (open: boolean) => void
  onEdit: () => void
  onOpenListing: () => void
  onOpenShop: () => void
  onToggleActive: () => void
  onToggleFeatured: () => void
  onSetStatus: (status: ListingStatus) => void
  onDelete: () => void
  onOpenRelated: (listing: ListingRow) => void
  onImageUrlChange: (value: string) => void
  onImageAltChange: (value: string) => void
  onAddImage: () => void
  onDeleteImage: (image: ListingImageRow) => void
  onMakePrimaryImage: (image: ListingImageRow) => void
}) {
  return (
    <Dialog modal open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <DialogOverlay />
        <DialogContent maxWidth={1080} maxHeight="92vh" width="94%" padding={0} overflow="hidden">
          <YStack padding="$5" paddingTop="$6" paddingRight="$10" gap="$3" backgroundColor="$color2" borderBottomWidth={1} borderBottomColor="$borderColor">
            <YStack gap="$1">
              <DialogTitle>{listing?.title ?? 'Product details'}</DialogTitle>
              <DialogDescription>Inspect listing data, child collections, owning shop, owner, and related products.</DialogDescription>
            </YStack>
          </YStack>
          <ScrollView maxHeight="74vh" showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 20 }}>
            {listing ? (
              <ProductDetailsPanel
                listing={listing}
                shop={shop}
                owner={owner}
                bundle={bundle}
                sameShopListings={sameShopListings}
                busy={busy}
                imageUrl={imageUrl}
                imageAlt={imageAlt}
                onEdit={onEdit}
                onOpenListing={onOpenListing}
                onOpenShop={onOpenShop}
                onToggleActive={onToggleActive}
                onToggleFeatured={onToggleFeatured}
                onSetStatus={onSetStatus}
                onDelete={onDelete}
                onOpenRelated={onOpenRelated}
                onImageUrlChange={onImageUrlChange}
                onImageAltChange={onImageAltChange}
                onAddImage={onAddImage}
                onDeleteImage={onDeleteImage}
                onMakePrimaryImage={onMakePrimaryImage}
              />
            ) : (
              <EmptyPanel title="No product selected" description="Select a product to view details." />
            )}
          </ScrollView>
        </DialogContent>
      </Dialog.Portal>
    </Dialog>
  )
}

function ProductDetailsPanel({
  listing,
  shop,
  owner,
  bundle,
  sameShopListings,
  busy,
  imageUrl,
  imageAlt,
  onEdit,
  onOpenListing,
  onOpenShop,
  onToggleActive,
  onToggleFeatured,
  onSetStatus,
  onDelete,
  onOpenRelated,
  onImageUrlChange,
  onImageAltChange,
  onAddImage,
  onDeleteImage,
  onMakePrimaryImage,
}: {
  listing: ListingRow
  shop: ShopRow | null
  owner: ProfileRow | null
  bundle: ListingBundle
  sameShopListings: ListingRow[]
  busy: boolean
  imageUrl: string
  imageAlt: string
  onEdit: () => void
  onOpenListing: () => void
  onOpenShop: () => void
  onToggleActive: () => void
  onToggleFeatured: () => void
  onSetStatus: (status: ListingStatus) => void
  onDelete: () => void
  onOpenRelated: (listing: ListingRow) => void
  onImageUrlChange: (value: string) => void
  onImageAltChange: (value: string) => void
  onAddImage: () => void
  onDeleteImage: (image: ListingImageRow) => void
  onMakePrimaryImage: (image: ListingImageRow) => void
}) {
  const primaryImage = getPrimaryImage(bundle.images)

  return (
    <YStack gap="$4">
      <XStack gap="$3" alignItems="center" padding="$4" borderRadius={radius.card} borderWidth={1} borderColor="$borderColor" backgroundColor="$background" style={getShadowStyle('sm')}>
        <ProductThumb image={primaryImage} size={78} />
        <YStack flex={1} minWidth={0}>
          <Text fontSize={22} fontWeight="800" color="$color12" numberOfLines={1}>
            {listing.title}
          </Text>
          <Text color="$color10" numberOfLines={1}>
            {listing.slug ? `/listing/${listing.slug}` : listing.id}
          </Text>
          <XStack gap="$2" marginTop="$2" flexWrap="wrap">
            <Badge tone={typeTone(listing.listing_type)}>{listing.listing_type}</Badge>
            <Badge tone={statusTone(listing.listing_status)}>{listing.listing_status.replace('_', ' ')}</Badge>
            <Badge tone={listing.is_active ? 'success' : 'danger'}>{listing.is_active ? 'Active' : 'Inactive'}</Badge>
            {listing.is_featured ? <Badge tone="brand">Featured</Badge> : null}
          </XStack>
        </YStack>
      </XStack>

      <XStack gap="$2" flexWrap="wrap" padding="$3" borderRadius={radius.card} backgroundColor="$color2" borderWidth={1} borderColor="$borderColor">
        <Button size="$3" tone="outline" icon={Icons.ExternalLink} onPress={onOpenListing} disabled={busy}>
          View product
        </Button>
        <Button size="$3" tone="outline" icon={Icons.Pencil} onPress={onEdit} disabled={busy}>
          Edit
        </Button>
        <Button size="$3" tone="outline" onPress={onToggleActive} disabled={busy}>
          {listing.is_active ? 'Deactivate' : 'Activate'}
        </Button>
        <Button size="$3" tone={listing.is_featured ? 'outline' : 'primary'} onPress={onToggleFeatured} disabled={busy}>
          {listing.is_featured ? 'Unfeature' : 'Feature'}
        </Button>
        <FilterSelect
          value={listing.listing_status}
          options={statusOptions()}
          placeholder="Status"
          onValueChange={(value) => onSetStatus(value as ListingStatus)}
        />
        <ConfirmDialog
          title="Delete product?"
          description="This permanently deletes the listing row. Related child rows should cascade through the database."
          confirmLabel="Delete product"
          destructive
          onConfirm={onDelete}
          trigger={
            <Button size="$3" tone="destructive" icon={Icons.Trash2} disabled={busy}>
              Delete
            </Button>
          }
        />
      </XStack>

      <DetailSection title="Owning shop and owner">
        <XStack gap="$3" flexWrap="wrap" marginBottom="$2">
          <OwnerShopCard
            title={shop?.shop_name ?? 'Unknown shop'}
            subtitle={shop?.shop_email ?? listing.shop_id}
            imageUrl={shop?.logo_url ?? null}
            icon="shop"
          />
          <OwnerShopCard
            title={owner ? displayOwner(owner) : 'Unknown owner'}
            subtitle={owner?.email ?? owner?.phone ?? shop?.user_id ?? 'No owner profile loaded'}
            imageUrl={owner?.avatar_url ?? null}
            icon="owner"
          />
        </XStack>
        <DetailRow label="Shop" value={shop?.shop_name ?? listing.shop_id} />
        <DetailRow label="Shop id" value={listing.shop_id} />
        <DetailRow label="Shop email" value={shop?.shop_email ?? 'Not set'} />
        <DetailRow label="Shop status" value={shop ? `${shop.is_active ? 'Active' : 'Inactive'}, ${shop.verified ? 'verified' : 'pending'}` : 'Unknown'} />
        <DetailRow label="Owner" value={owner ? displayOwner(owner) : 'Unknown'} />
        <DetailRow label="Owner email" value={owner?.email ?? 'Not set'} />
        <DetailRow label="Owner phone" value={owner?.phone ?? 'Not set'} />
        {shop ? (
          <Button alignSelf="flex-start" size="$3" tone="outline" icon={Icons.Store} onPress={onOpenShop}>
            Open shop page
          </Button>
        ) : null}
      </DetailSection>

      <DetailSection title="Product details">
        <DetailRow label="Description" value={listing.description ?? 'No description'} />
        <DetailRow label="Price" value={formatMoney(listing.price)} />
        <DetailRow label="Quantity" value={listing.quantity ?? 0} />
        <DetailRow label="Stock" value={listing.stock ?? 0} />
        <DetailRow label="SKU" value={listing.sku ?? 'Not set'} />
        <DetailRow label="Category" value={listing.category ?? 'Not set'} />
        <DetailRow label="Rating" value={`${listing.average_rating ?? 0} (${listing.total_reviews ?? 0} reviews)`} />
        <DetailRow label="Created" value={formatDate(listing.created_at)} />
        <DetailRow label="Updated" value={formatDate(listing.updated_at)} />
        <DetailRow label="Published" value={formatDate(listing.published_at)} />
      </DetailSection>

      <DetailSection title="Type-specific data">
        <DetailRow label="Digital file URL" value={listing.digital_file_url ?? 'Not set'} />
        <DetailRow label="Digital file type" value={listing.digital_file_type ?? 'Not set'} />
        <DetailRow label="Digital file size" value={formatFileSize(listing.digital_file_size)} />
        <DetailRow label="Download limit" value={listing.download_limit ?? 'Not set'} />
        <DetailRow label="Weight" value={listing.weight ? `${listing.weight} kg` : 'Not set'} />
        <DetailRow label="Dimensions" value={formatJson(listing.dimensions)} />
        <DetailRow label="Shipping required" value={yesNo(listing.shipping_required)} />
        <DetailRow label="Online service" value={yesNo(listing.is_online)} />
        <DetailRow label="Booking duration" value={listing.booking_duration_minutes ? `${listing.booking_duration_minutes} minutes` : 'Not set'} />
        <DetailRow label="Meeting URL" value={listing.meeting_url ?? 'Not set'} />
        <DetailRow label="Max attendees" value={listing.max_attendees ?? 'Not set'} />
        <DetailRow label="Requires approval" value={yesNo(listing.requires_approval)} />
      </DetailSection>

      <DetailSection title="Images">
        <YStack gap="$3">
          <XStack gap="$2" flexWrap="wrap">
            <Input flex={2} minWidth={220} value={imageUrl} onChangeText={onImageUrlChange} placeholder="Image URL" />
            <Input flex={1} minWidth={180} value={imageAlt} onChangeText={onImageAltChange} placeholder="Alt text" />
            <Button disabled={busy || !imageUrl.trim()} onPress={onAddImage}>
              Add image
            </Button>
          </XStack>
          {bundle.images.length ? (
            <XStack gap="$3" flexWrap="wrap">
              {bundle.images.map((image) => (
                <ImageCard
                  key={image.id}
                  image={image}
                  busy={busy}
                  onMakePrimary={() => onMakePrimaryImage(image)}
                  onDelete={() => onDeleteImage(image)}
                />
              ))}
            </XStack>
          ) : (
            <Text color="$color10">No images attached.</Text>
          )}
        </YStack>
      </DetailSection>

      <CollectionSection title="Variations" empty="No variations">
        {bundle.variations.map((variation) => (
          <DetailRow
            key={variation.id}
            label={`${variation.variation_name}: ${variation.variation_value}`}
            value={`Stock ${variation.stock ?? 0}, ${variation.is_available ? 'available' : 'unavailable'}, adjustment ${formatMoney(variation.price_adjustment ?? 0)}`}
          />
        ))}
      </CollectionSection>

      <CollectionSection title="Attributes" empty="No attributes">
        {bundle.attributes.map((attribute) => (
          <DetailRow key={attribute.id} label={attribute.attribute_name} value={`${attribute.attribute_value} (${attribute.attribute_type ?? 'text'})`} />
        ))}
      </CollectionSection>

      <CollectionSection title="Materials" empty="No materials">
        {bundle.materials.map((material) => (
          <DetailRow
            key={material.id}
            label={material.material_name}
            value={`${material.percentage ?? 0}%${material.is_primary ? ', primary' : ''}${material.is_sustainable ? ', sustainable' : ''}`}
          />
        ))}
      </CollectionSection>

      <DetailSection title="SEO and metadata">
        <DetailRow label="Slug" value={listing.slug ?? 'Auto-generated'} />
        <DetailRow label="Meta title" value={listing.meta_title ?? 'Not set'} />
        <DetailRow label="Meta description" value={listing.meta_description ?? 'Not set'} />
        <DetailRow label="Tags" value={(listing.tags ?? []).join(', ') || 'No tags'} />
        <DetailRow label="Metadata" value={formatJson(listing.listing_metadata)} />
      </DetailSection>

      <DetailSection title="Other products from this shop">
        {sameShopListings.length ? (
          <YStack gap="$2">
            {sameShopListings.map((related) => (
              <RelatedListingRow key={related.id} listing={related} onPress={() => onOpenRelated(related)} />
            ))}
          </YStack>
        ) : (
          <Text color="$color10">This shop has no other products.</Text>
        )}
      </DetailSection>
    </YStack>
  )
}

function ProductEditorDialog({
  open,
  mode,
  form,
  busy,
  onOpenChange,
  onChange,
  onSubmit,
}: {
  open: boolean
  mode: ProductFormMode
  form: ProductFormState
  busy: boolean
  onOpenChange: (open: boolean) => void
  onChange: (patch: Partial<ProductFormState>) => void
  onSubmit: () => void
}) {
  return (
    <Dialog modal open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <DialogOverlay />
        <DialogContent maxWidth={880} maxHeight="90vh" width="92%">
          <DialogTitle>{mode === 'create' ? 'Create product listing' : 'Edit product listing'}</DialogTitle>
          <DialogDescription>
            Writes directly to the listings table. Images, variations, attributes, and materials are visible in details.
          </DialogDescription>

          <ScrollView maxHeight="68vh" showsVerticalScrollIndicator={false}>
            <YStack gap="$3" paddingRight="$1">
              <Field label="Shop id" required>
                <Input value={form.shop_id} onChangeText={(shop_id) => onChange({ shop_id })} placeholder="Shop UUID" />
              </Field>

              <Field label="Title" required>
                <Input value={form.title} onChangeText={(title) => onChange({ title })} placeholder="Product title" />
              </Field>

              <Field label="Description">
                <TextArea value={form.description} onChangeText={(description) => onChange({ description })} placeholder="Product description" />
              </Field>

              <XStack gap="$3" flexWrap="wrap">
                <YStack flex={1} minWidth={170}>
                  <Field label="Type">
                    <FilterSelect
                      value={form.listing_type}
                      options={[
                        { value: 'physical', label: 'Physical' },
                        { value: 'digital', label: 'Digital' },
                        { value: 'service', label: 'Service' },
                      ]}
                      placeholder="Select type"
                      onValueChange={(listing_type) => onChange(defaultsForType(listing_type as ListingType))}
                    />
                  </Field>
                </YStack>
                <YStack flex={1} minWidth={170}>
                  <Field label="Status">
                    <FilterSelect
                      value={form.listing_status}
                      options={statusOptions()}
                      placeholder="Select status"
                      onValueChange={(listing_status) => onChange({ listing_status: listing_status as ListingStatus })}
                    />
                  </Field>
                </YStack>
                <YStack flex={1} minWidth={160}>
                  <Field label="Price" required>
                    <Input value={form.price} onChangeText={(price) => onChange({ price })} keyboardType="decimal-pad" placeholder="0.00" />
                  </Field>
                </YStack>
              </XStack>

              <XStack gap="$3" flexWrap="wrap">
                <YStack flex={1} minWidth={160}>
                  <Field label="Quantity">
                    <Input value={form.quantity} onChangeText={(quantity) => onChange({ quantity })} keyboardType="number-pad" />
                  </Field>
                </YStack>
                <YStack flex={1} minWidth={160}>
                  <Field label="Stock">
                    <Input value={form.stock} onChangeText={(stock) => onChange({ stock })} keyboardType="number-pad" />
                  </Field>
                </YStack>
                <YStack flex={1} minWidth={180}>
                  <Field label="SKU">
                    <Input value={form.sku} onChangeText={(sku) => onChange({ sku })} placeholder="SKU" />
                  </Field>
                </YStack>
              </XStack>

              <XStack gap="$3" flexWrap="wrap">
                <YStack flex={1} minWidth={200}>
                  <Field label="Category">
                    <Input value={form.category} onChangeText={(category) => onChange({ category })} placeholder="Category" />
                  </Field>
                </YStack>
                <YStack flex={1} minWidth={200}>
                  <Field label="Slug">
                    <Input value={form.slug} onChangeText={(slug) => onChange({ slug })} placeholder="product-slug" />
                  </Field>
                </YStack>
              </XStack>

              {form.listing_type === 'physical' ? (
                <XStack gap="$3" flexWrap="wrap">
                  <YStack flex={1} minWidth={160}>
                    <Field label="Weight (kg)">
                      <Input value={form.weight} onChangeText={(weight) => onChange({ weight })} keyboardType="decimal-pad" />
                    </Field>
                  </YStack>
                  <YStack flex={2} minWidth={240}>
                    <Field label="Dimensions JSON">
                      <Input value={form.dimensionsText} onChangeText={(dimensionsText) => onChange({ dimensionsText })} placeholder='{"length":10}' />
                    </Field>
                  </YStack>
                  <ToggleField label="Shipping required" value={form.shipping_required} onChange={(shipping_required) => onChange({ shipping_required })} />
                </XStack>
              ) : null}

              {form.listing_type === 'digital' ? (
                <YStack gap="$3">
                  <Field label="Digital file URL" required>
                    <Input value={form.digital_file_url} onChangeText={(digital_file_url) => onChange({ digital_file_url })} placeholder="https://..." />
                  </Field>
                  <XStack gap="$3" flexWrap="wrap">
                    <YStack flex={1} minWidth={180}>
                      <Field label="File type" required>
                        <Input value={form.digital_file_type} onChangeText={(digital_file_type) => onChange({ digital_file_type })} placeholder="pdf" />
                      </Field>
                    </YStack>
                    <YStack flex={1} minWidth={180}>
                      <Field label="File size bytes">
                        <Input value={form.digital_file_size} onChangeText={(digital_file_size) => onChange({ digital_file_size })} keyboardType="number-pad" />
                      </Field>
                    </YStack>
                    <YStack flex={1} minWidth={180}>
                      <Field label="Download limit">
                        <Input value={form.download_limit} onChangeText={(download_limit) => onChange({ download_limit })} keyboardType="number-pad" />
                      </Field>
                    </YStack>
                  </XStack>
                </YStack>
              ) : null}

              {form.listing_type === 'service' ? (
                <YStack gap="$3">
                  <XStack gap="$3" flexWrap="wrap">
                    <YStack flex={1} minWidth={200}>
                      <Field label="Booking duration minutes" required>
                        <Input value={form.booking_duration_minutes} onChangeText={(booking_duration_minutes) => onChange({ booking_duration_minutes })} keyboardType="number-pad" />
                      </Field>
                    </YStack>
                    <YStack flex={1} minWidth={180}>
                      <Field label="Max attendees">
                        <Input value={form.max_attendees} onChangeText={(max_attendees) => onChange({ max_attendees })} keyboardType="number-pad" />
                      </Field>
                    </YStack>
                  </XStack>
                  <Field label="Meeting URL">
                    <Input value={form.meeting_url} onChangeText={(meeting_url) => onChange({ meeting_url })} placeholder="https://..." />
                  </Field>
                  <XStack gap="$3" flexWrap="wrap">
                    <ToggleField label="Online service" value={form.is_online} onChange={(is_online) => onChange({ is_online })} />
                    <ToggleField label="Requires approval" value={form.requires_approval} onChange={(requires_approval) => onChange({ requires_approval })} />
                  </XStack>
                </YStack>
              ) : null}

              <XStack gap="$3" flexWrap="wrap">
                <ToggleField label="Active" value={form.is_active} onChange={(is_active) => onChange({ is_active })} />
                <ToggleField label="Featured" value={form.is_featured} onChange={(is_featured) => onChange({ is_featured })} />
              </XStack>

              <Field label="Tags">
                <Input value={form.tagsText} onChangeText={(tagsText) => onChange({ tagsText })} placeholder="tag one, tag two" />
              </Field>
              <Field label="Meta title">
                <Input value={form.meta_title} onChangeText={(meta_title) => onChange({ meta_title })} />
              </Field>
              <Field label="Meta description">
                <TextArea value={form.meta_description} onChangeText={(meta_description) => onChange({ meta_description })} />
              </Field>
              <Field label="Listing metadata JSON">
                <TextArea value={form.listingMetadataText} onChangeText={(listingMetadataText) => onChange({ listingMetadataText })} />
              </Field>
            </YStack>
          </ScrollView>

          <XStack gap="$2" justifyContent="flex-end" flexWrap="wrap">
            <Button tone="outline" onPress={() => onOpenChange(false)} disabled={busy}>
              Cancel
            </Button>
            <Button onPress={onSubmit} disabled={busy || !form.title.trim() || !form.shop_id.trim()}>
              {busy ? 'Saving...' : mode === 'create' ? 'Create product' : 'Save changes'}
            </Button>
          </XStack>
        </DialogContent>
      </Dialog.Portal>
    </Dialog>
  )
}

function RelatedListingRow({ listing, onPress }: { listing: ListingRow; onPress: () => void }) {
  return (
    <XStack gap="$3" alignItems="center" padding="$3" borderRadius={radius.card} borderWidth={1} borderColor="$borderColor" backgroundColor="$color2" cursor="pointer" hoverStyle={{ borderColor: '$color8' }} onPress={onPress}>
      <YStack flex={1} minWidth={0}>
        <Text fontWeight="800" color="$color12" numberOfLines={1}>
          {listing.title}
        </Text>
        <Text color="$color10" fontSize={12}>
          {formatMoney(listing.price)} • {listing.listing_status.replace('_', ' ')}
        </Text>
      </YStack>
      <Icons.ExternalLink size={17} color="$color10" />
    </XStack>
  )
}

function ImageCard({
  image,
  busy,
  onMakePrimary,
  onDelete,
}: {
  image: ListingImageRow
  busy: boolean
  onMakePrimary: () => void
  onDelete: () => void
}) {
  return (
    <YStack width={180} gap="$2" padding="$2" borderRadius={radius.card} borderWidth={1} borderColor="$borderColor" backgroundColor="$color2">
      <Image src={image.image_url} alt={image.alt_text ?? 'Listing image'} width="100%" height={120} objectFit="cover" borderRadius={radius.card} />
      <XStack gap="$2" flexWrap="wrap">
        {image.is_primary ? <Badge tone="brand">Primary</Badge> : null}
        <Button size="$2" tone="outline" disabled={busy || image.is_primary} onPress={onMakePrimary}>
          Primary
        </Button>
        <Button size="$2" tone="destructive" disabled={busy} onPress={onDelete}>
          Delete
        </Button>
      </XStack>
    </YStack>
  )
}

function ProductThumb({ image, size }: { image: ListingImageRow | null; size: number }) {
  if (image?.image_url) {
    return <Image src={image.image_url} alt={image.alt_text ?? 'Product'} width={size} height={size} objectFit="cover" borderRadius={radius.card} backgroundColor="$color3" />
  }

  return (
    <YStack width={size} height={size} borderRadius={radius.card} alignItems="center" justifyContent="center" backgroundColor="$color3">
      <Icons.Package size={Math.round(size * 0.42)} color="$color10" />
    </YStack>
  )
}

function OwnerShopCard({
  title,
  subtitle,
  imageUrl,
  icon,
}: {
  title: string
  subtitle: string
  imageUrl: string | null
  icon: 'shop' | 'owner'
}) {
  const Icon = icon === 'shop' ? Icons.Store : Icons.User

  return (
    <XStack
      flex={1}
      minWidth={240}
      gap="$3"
      alignItems="center"
      padding="$3"
      borderRadius={radius.card}
      borderWidth={1}
      borderColor="$borderColor"
      backgroundColor="$color2"
    >
      {imageUrl ? (
        <Image
          src={imageUrl}
          alt={title}
          width={52}
          height={52}
          objectFit="cover"
          borderRadius={icon === 'owner' ? 999 : radius.card}
          backgroundColor="$color3"
        />
      ) : (
        <YStack
          width={52}
          height={52}
          borderRadius={icon === 'owner' ? 999 : radius.card}
          alignItems="center"
          justifyContent="center"
          backgroundColor="$color3"
        >
          <Icon size={22} color="$color10" />
        </YStack>
      )}
      <YStack flex={1} minWidth={0}>
        <Text fontWeight="800" color="$color12" numberOfLines={1}>
          {title}
        </Text>
        <Text color="$color10" fontSize={12} numberOfLines={1}>
          {subtitle}
        </Text>
      </YStack>
    </XStack>
  )
}

function CollectionSection({ title, empty, children }: { title: string; empty: string; children: ReactNode }) {
  const isEmpty = Array.isArray(children) && children.length === 0
  return (
    <DetailSection title={title}>
      {isEmpty ? <Text color="$color10">{empty}</Text> : children}
    </DetailSection>
  )
}

function FilterField({ label, children, flex, minWidth }: { label: string; children: ReactNode; flex?: number; minWidth?: number }) {
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
      <SelectTrigger minWidth={160} iconAfter={<Icons.ChevronDown size={16} />}>
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

function DetailSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <YStack gap="$2.5" padding="$4" borderRadius={radius.card} borderWidth={1} borderColor="$borderColor" backgroundColor="$background" style={getShadowStyle('sm')}>
      <XStack alignItems="center" gap="$2">
        <YStack width={4} height={18} borderRadius={999} backgroundColor="$color9" />
        <Text fontSize={14} fontWeight="800" color="$color12">
          {title}
        </Text>
      </XStack>
      <YStack gap="$2.5">{children}</YStack>
    </YStack>
  )
}

function DetailRow({ label, value }: { label: string; value: string | number }) {
  return (
    <XStack gap="$3" justifyContent="space-between" alignItems="flex-start">
      <Text flex={1} color="$color10" fontSize={12}>
        {label}
      </Text>
      <Text flex={2} color="$color12" fontSize={12} fontWeight="600" textAlign="right">
        {String(value)}
      </Text>
    </XStack>
  )
}

function EmptyPanel({ title, description }: { title: string; description: string }) {
  return (
    <YStack minHeight={220} alignItems="center" justifyContent="center" gap="$2" padding="$4" borderRadius={radius.card} borderWidth={1} borderColor="$borderColor" backgroundColor="$background">
      <Icons.Package size={28} color="$color10" />
      <Text fontWeight="800" color="$color12">
        {title}
      </Text>
      <Text color="$color10" textAlign="center">
        {description}
      </Text>
    </YStack>
  )
}

function Field({ label, required, children }: { label: string; required?: boolean; children: ReactNode }) {
  return (
    <YStack gap="$2">
      <Text fontSize={12} fontWeight="700" color="$color11">
        {label}
        {required ? ' *' : ''}
      </Text>
      {children}
    </YStack>
  )
}

function ToggleField({ label, value, onChange }: { label: string; value: boolean; onChange: (value: boolean) => void }) {
  return (
    <XStack minWidth={150} flex={1} alignItems="center" justifyContent="space-between" gap="$2" padding="$3" borderRadius={radius.card} borderWidth={1} borderColor="$borderColor">
      <Text fontWeight="700" color="$color12" fontSize={12}>
        {label}
      </Text>
      <Switch checked={value} onCheckedChange={onChange} />
    </XStack>
  )
}

type ProductStats = {
  total: number
  active: number
  draft: number
  featured: number
}

function getStats(listings: ListingRow[], totalListings: number): ProductStats {
  return {
    total: totalListings,
    active: listings.filter((listing) => listing.is_active).length,
    draft: listings.filter((listing) => listing.listing_status === 'draft').length,
    featured: listings.filter((listing) => listing.is_featured).length,
  }
}

function listingToForm(listing: ListingRow): ProductFormState {
  return {
    shop_id: listing.shop_id,
    title: listing.title,
    description: listing.description ?? '',
    listing_type: listing.listing_type,
    price: String(listing.price),
    quantity: listing.quantity == null ? '' : String(listing.quantity),
    category: listing.category ?? '',
    sku: listing.sku ?? '',
    slug: listing.slug ?? '',
    listing_status: listing.listing_status,
    is_active: listing.is_active,
    is_featured: listing.is_featured,
    stock: listing.stock == null ? '' : String(listing.stock),
    weight: listing.weight == null ? '' : String(listing.weight),
    shipping_required: listing.shipping_required ?? true,
    dimensionsText: formatJson(listing.dimensions),
    digital_file_url: listing.digital_file_url ?? '',
    digital_file_size: listing.digital_file_size == null ? '' : String(listing.digital_file_size),
    digital_file_type: listing.digital_file_type ?? '',
    download_limit: listing.download_limit == null ? '' : String(listing.download_limit),
    is_online: !!listing.is_online,
    booking_duration_minutes: listing.booking_duration_minutes == null ? '' : String(listing.booking_duration_minutes),
    meeting_url: listing.meeting_url ?? '',
    max_attendees: listing.max_attendees == null ? '1' : String(listing.max_attendees),
    requires_approval: !!listing.requires_approval,
    meta_title: listing.meta_title ?? '',
    meta_description: listing.meta_description ?? '',
    tagsText: (listing.tags ?? []).join(', '),
    listingMetadataText: formatJson(listing.listing_metadata),
  }
}

function formToListingPayload(form: ProductFormState): ListingInsert | ListingUpdate {
  const dimensions = parseJson(form.dimensionsText, {})
  const listingMetadata = parseJson(form.listingMetadataText, {})

  return {
    shop_id: form.shop_id.trim(),
    title: form.title.trim(),
    description: nullableText(form.description),
    listing_type: form.listing_type,
    price: toNumber(form.price, 0),
    quantity: toNullableNumber(form.quantity),
    category: nullableText(form.category),
    sku: nullableText(form.sku),
    slug: nullableText(form.slug),
    listing_status: form.listing_status,
    is_active: form.is_active,
    is_featured: form.is_featured,
    stock: form.listing_type === 'physical' ? toNumber(form.stock, 0) : toNullableNumber(form.stock),
    weight: toNullableNumber(form.weight),
    shipping_required: form.listing_type === 'physical' ? form.shipping_required : false,
    dimensions: dimensions as Json,
    digital_file_url: form.listing_type === 'digital' ? nullableText(form.digital_file_url) : null,
    digital_file_size: form.listing_type === 'digital' ? toNullableNumber(form.digital_file_size) : null,
    digital_file_type: form.listing_type === 'digital' ? nullableText(form.digital_file_type) : null,
    download_limit: form.listing_type === 'digital' ? toNullableNumber(form.download_limit) : null,
    is_online: form.listing_type === 'service' ? form.is_online : false,
    booking_duration_minutes: form.listing_type === 'service' ? toNumber(form.booking_duration_minutes, 0) : null,
    meeting_url: form.listing_type === 'service' ? nullableText(form.meeting_url) : null,
    max_attendees: form.listing_type === 'service' ? toNullableNumber(form.max_attendees) ?? 1 : null,
    requires_approval: form.listing_type === 'service' ? form.requires_approval : false,
    meta_title: nullableText(form.meta_title),
    meta_description: nullableText(form.meta_description),
    tags: splitCsv(form.tagsText),
    listing_metadata: listingMetadata as Json,
  }
}

function validateProductForm(form: ProductFormState) {
  if (!form.shop_id.trim()) return 'Shop id is required.'
  if (form.title.trim().length < 3) return 'Title must be at least 3 characters.'
  if (toNumber(form.price, -1) < 0) return 'Price must be zero or greater.'
  if (form.slug.trim() && !/^[a-z0-9-]{3,}$/.test(form.slug.trim())) {
    return 'Slug must be at least 3 characters and use lowercase letters, numbers, and hyphens.'
  }
  if (!isJsonObject(form.dimensionsText)) return 'Dimensions must be valid JSON object.'
  if (!isJsonObject(form.listingMetadataText)) return 'Listing metadata must be valid JSON object.'
  if (form.listing_type === 'physical' && form.stock.trim() === '') return 'Physical products require stock.'
  if (form.listing_type === 'digital' && (!form.digital_file_url.trim() || !form.digital_file_type.trim())) {
    return 'Digital products require file URL and file type.'
  }
  if (form.listing_type === 'service' && toNumber(form.booking_duration_minutes, 0) < 1) {
    return 'Services require booking duration.'
  }
  if (form.meeting_url.trim() && !/^https?:\/\//i.test(form.meeting_url.trim())) {
    return 'Meeting URL must start with http:// or https://.'
  }
  return null
}

function defaultsForType(listing_type: ListingType): Partial<ProductFormState> {
  if (listing_type === 'digital') {
    return {
      listing_type,
      stock: '',
      shipping_required: false,
      digital_file_type: 'pdf',
    }
  }
  if (listing_type === 'service') {
    return {
      listing_type,
      stock: '',
      shipping_required: false,
      booking_duration_minutes: '60',
      max_attendees: '1',
      is_online: true,
    }
  }
  return {
    listing_type,
    stock: '1',
    shipping_required: true,
  }
}

function statusOptions(allLabel?: string) {
  const options = [
    { value: 'draft', label: 'Draft' },
    { value: 'active', label: 'Active' },
    { value: 'paused', label: 'Paused' },
    { value: 'sold_out', label: 'Sold out' },
    { value: 'archived', label: 'Archived' },
  ]
  return allLabel ? [{ value: 'all', label: allLabel }, ...options] : options
}

function getPrimaryImage(images: ListingImageRow[]) {
  return images.find((image) => image.is_primary) ?? images[0] ?? null
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

function toNumber(value: string, fallback: number) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function toNullableNumber(value: string) {
  if (!value.trim()) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function parseJson(value: string, fallback: Record<string, unknown>) {
  try {
    const parsed = JSON.parse(value || '{}')
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : fallback
  } catch {
    return fallback
  }
}

function isJsonObject(value: string) {
  try {
    const parsed = JSON.parse(value || '{}')
    return !!parsed && typeof parsed === 'object' && !Array.isArray(parsed)
  } catch {
    return false
  }
}

function formatJson(value: unknown) {
  if (!value || typeof value !== 'object') return '{}'
  return JSON.stringify(value)
}

function formatMoney(value: number | null | undefined) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(Number(value ?? 0))
}

function formatFileSize(bytes: number | null | undefined) {
  if (!bytes) return 'Not set'
  const units = ['B', 'KB', 'MB', 'GB']
  let size = bytes
  let unit = 0
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024
    unit += 1
  }
  return `${size.toFixed(unit === 0 ? 0 : 1)} ${units[unit]}`
}

function formatDate(value: string | null) {
  if (!value) return 'Not set'
  return new Date(value).toLocaleString()
}

function displayOwner(owner: ProfileRow) {
  return owner.full_name || owner.business_name || owner.username || owner.id
}

function yesNo(value: boolean | null | undefined) {
  return value ? 'Yes' : 'No'
}

function escapeSearch(value: string) {
  return value.replace(/[%(),]/g, '')
}

function typeTone(type: ListingType) {
  if (type === 'digital') return 'info' as const
  if (type === 'service') return 'brand' as const
  return 'neutral' as const
}

function statusTone(status: ListingStatus) {
  if (status === 'active') return 'success' as const
  if (status === 'paused') return 'warning' as const
  if (status === 'sold_out' || status === 'archived') return 'danger' as const
  return 'neutral' as const
}
