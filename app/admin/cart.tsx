import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useRouter } from 'one'

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

type CartRow = Tables<'carts'>
type CartUpdate = TablesUpdate<'carts'>
type CartItemRow = Tables<'cart_items'>
type CartItemInsert = TablesInsert<'cart_items'>
type CartItemUpdate = TablesUpdate<'cart_items'>
type ListingRow = Tables<'listings'>
type ListingImageRow = Tables<'listing_images'>
type ListingVariationRow = Tables<'listing_variations'>
type ProfileRow = Tables<'profiles'>
type ShopRow = Tables<'shops'>
type CartStatus = CartRow['status']
type StatusFilter = 'all' | CartStatus
type OwnerFilter = 'all' | 'logged_in' | 'guest'

type CartBundle = {
  items: CartItemRow[]
  profile: ProfileRow | null
  listingsById: Record<string, ListingRow>
  imagesByListingId: Record<string, ListingImageRow[]>
  variationsById: Record<string, ListingVariationRow>
  shopsById: Record<string, ShopRow>
}

type CartEditorForm = {
  status: CartStatus
  currency: string
  discount_amount: string
  applied_discount_name: string
  applied_discount_type: string
  applied_discount_value: string
  expires_at: string
  cartMetadataText: string
}

type ItemEditorForm = {
  listing_id: string
  variant_id: string
  quantity: string
  unit_price: string
  title: string
  image_url: string
  shop_id: string
  shop_name: string
  variant_name: string
  variant_value: string
  variant_sku: string
  itemMetadataText: string
}

const PAGE_SIZE = 20

const EMPTY_BUNDLE: CartBundle = {
  items: [],
  profile: null,
  listingsById: {},
  imagesByListingId: {},
  variationsById: {},
  shopsById: {},
}

const EMPTY_ITEM_FORM: ItemEditorForm = {
  listing_id: '',
  variant_id: '',
  quantity: '1',
  unit_price: '',
  title: '',
  image_url: '',
  shop_id: '',
  shop_name: '',
  variant_name: '',
  variant_value: '',
  variant_sku: '',
  itemMetadataText: '{}',
}

export default function AdminCartPage() {
  return <AdminCartManager />
}

function AdminCartManager() {
  const router = useRouter()
  const toast = useAppToast()
  const { isDesktop, safeBottom } = useAppLayout()

  const [carts, setCarts] = useState<CartRow[]>([])
  const [bundlesByCartId, setBundlesByCartId] = useState<Record<string, CartBundle>>({})
  const [totalCarts, setTotalCarts] = useState(0)
  const [selectedCartId, setSelectedCartId] = useState<string | null>(null)
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [cartFormOpen, setCartFormOpen] = useState(false)
  const [itemFormOpen, setItemFormOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<CartItemRow | null>(null)
  const [cartForm, setCartForm] = useState<CartEditorForm | null>(null)
  const [itemForm, setItemForm] = useState<ItemEditorForm>(EMPTY_ITEM_FORM)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [ownerFilter, setOwnerFilter] = useState<OwnerFilter>('all')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const selectedCart = carts.find((cart) => cart.id === selectedCartId) ?? carts[0] ?? null
  const selectedBundle = selectedCart ? bundlesByCartId[selectedCart.id] ?? EMPTY_BUNDLE : EMPTY_BUNDLE
  const hasMore = carts.length < totalCarts
  const filters = useMemo(() => ({ search: search.trim(), status: statusFilter, owner: ownerFilter }), [ownerFilter, search, statusFilter])
  const stats = useMemo(() => getCartStats(carts, bundlesByCartId), [bundlesByCartId, carts])

  useEffect(() => {
    void loadCarts({ reset: true })
  }, [filters])

  useEffect(() => {
    if (!selectedCartId && carts[0]) setSelectedCartId(carts[0].id)
  }, [carts, selectedCartId])

  async function loadCarts({ reset }: { reset: boolean }) {
    setLoading(true)
    setError(null)
    const from = reset ? 0 : carts.length
    const to = from + PAGE_SIZE - 1

    let query = supabase
      .from('carts')
      .select('*', { count: 'exact' })
      .order('last_activity_at', { ascending: false })
      .range(from, to)

    if (filters.search) {
      const value = escapeSearch(filters.search)
      query = query.or(`id.ilike.%${value}%,session_id.ilike.%${value}%,user_id.ilike.%${value}%,applied_discount_name.ilike.%${value}%`)
    }
    if (filters.status !== 'all') query = query.eq('status', filters.status)
    if (filters.owner === 'logged_in') query = query.not('user_id', 'is', null)
    if (filters.owner === 'guest') query = query.is('user_id', null)

    const { data, count, error: loadError } = await query
    if (loadError) {
      setError(loadError.message)
      setLoading(false)
      return
    }

    const nextCarts = (data ?? []) as CartRow[]
    setCarts((current) => (reset ? nextCarts : [...current, ...nextCarts]))
    setTotalCarts(count ?? nextCarts.length)
    await loadBundles(nextCarts)
    setLoading(false)
  }

  async function loadBundles(cartRows: CartRow[]) {
    if (!cartRows.length) return
    const cartIds = unique(cartRows.map((cart) => cart.id))
    const userIds = unique(cartRows.map((cart) => cart.user_id ?? ''))
    const { data: itemsData, error: itemsError } = await supabase
      .from('cart_items')
      .select('*')
      .in('cart_id', cartIds)
      .order('created_at', { ascending: true })

    if (itemsError) {
      setError(itemsError.message)
      return
    }

    const items = (itemsData ?? []) as CartItemRow[]
    const listingIds = unique(items.map((item) => item.listing_id))
    const shopIds = unique(items.map((item) => item.shop_id))
    const variantIds = unique(items.map((item) => item.variant_id ?? ''))

    const [profilesRes, listingsRes, imagesRes, shopsRes, variationsRes] = await Promise.all([
      userIds.length ? supabase.from('profiles').select('*').in('id', userIds) : Promise.resolve({ data: [], error: null }),
      listingIds.length ? supabase.from('listings').select('*').in('id', listingIds) : Promise.resolve({ data: [], error: null }),
      listingIds.length
        ? supabase
            .from('listing_images')
            .select('*')
            .in('listing_id', listingIds)
            .order('is_primary', { ascending: false })
            .order('display_order', { ascending: true })
        : Promise.resolve({ data: [], error: null }),
      shopIds.length ? supabase.from('shops').select('*').in('id', shopIds) : Promise.resolve({ data: [], error: null }),
      variantIds.length ? supabase.from('listing_variations').select('*').in('id', variantIds) : Promise.resolve({ data: [], error: null }),
    ])

    const firstError = profilesRes.error ?? listingsRes.error ?? imagesRes.error ?? shopsRes.error ?? variationsRes.error
    if (firstError) {
      setError(firstError.message)
      return
    }

    const itemsByCartId = groupBy(items, 'cart_id')
    const profilesById = indexBy((profilesRes.data ?? []) as ProfileRow[], 'id')
    const listingsById = indexBy((listingsRes.data ?? []) as ListingRow[], 'id')
    const imagesByListingId = groupBy((imagesRes.data ?? []) as ListingImageRow[], 'listing_id')
    const shopsById = indexBy((shopsRes.data ?? []) as ShopRow[], 'id')
    const variationsById = indexBy((variationsRes.data ?? []) as ListingVariationRow[], 'id')

    setBundlesByCartId((current) => {
      const next = { ...current }
      for (const cart of cartRows) {
        next[cart.id] = {
          items: itemsByCartId[cart.id] ?? [],
          profile: cart.user_id ? profilesById[cart.user_id] ?? null : null,
          listingsById,
          imagesByListingId,
          variationsById,
          shopsById,
        }
      }
      return next
    })
  }

  async function refreshCart(cartId: string) {
    const { data, error: cartError } = await supabase.from('carts').select('*').eq('id', cartId).maybeSingle()
    if (cartError) {
      setError(cartError.message)
      return
    }
    if (!data) return
    const cart = data as CartRow
    setCarts((current) => current.map((row) => (row.id === cart.id ? cart : row)))
    await loadBundles([cart])
  }

  async function recalculateCart(cartId: string) {
    const { error: rpcError } = await supabase.rpc('update_cart_totals', { p_cart_id: cartId })
    if (rpcError) {
      setError(rpcError.message)
      toast.show('Unable to update totals', { tone: 'danger', message: rpcError.message })
      return false
    }
    await refreshCart(cartId)
    return true
  }

  function openCartDetails(cart: CartRow) {
    setSelectedCartId(cart.id)
    setDetailsOpen(true)
  }

  function openCartEditor(cart: CartRow) {
    setSelectedCartId(cart.id)
    setCartForm(cartToForm(cart))
    setCartFormOpen(true)
  }

  function openCreateItem(cart: CartRow) {
    setSelectedCartId(cart.id)
    setEditingItem(null)
    setItemForm(EMPTY_ITEM_FORM)
    setItemFormOpen(true)
  }

  function openEditItem(item: CartItemRow) {
    setEditingItem(item)
    setItemForm(itemToForm(item))
    setItemFormOpen(true)
  }

  async function submitCartForm() {
    if (!selectedCart || !cartForm) return
    if (!isJsonObject(cartForm.cartMetadataText)) {
      toast.show('Check cart metadata', { tone: 'danger', message: 'Cart metadata must be a valid JSON object.' })
      return
    }
    setSaving(true)
    setError(null)
    const { data, error: updateError } = await supabase
      .from('carts')
      .update(formToCartPayload(cartForm) as CartUpdate)
      .eq('id', selectedCart.id)
      .select('*')
      .single()

    if (updateError) {
      setError(updateError.message)
      toast.show('Unable to update cart', { tone: 'danger', message: updateError.message })
    } else {
      const updated = data as CartRow
      setCarts((current) => current.map((cart) => (cart.id === updated.id ? updated : cart)))
      setCartFormOpen(false)
      toast.show('Cart updated', { tone: 'success' })
    }
    setSaving(false)
  }

  async function prefillItemFromListing() {
    if (!itemForm.listing_id.trim()) {
      toast.show('Listing id required', { tone: 'danger', message: 'Enter a listing id first.' })
      return
    }
    const listingId = itemForm.listing_id.trim()
    const [listingRes, imageRes, variationRes] = await Promise.all([
      supabase.from('listings').select('*').eq('id', listingId).maybeSingle(),
      supabase.from('listing_images').select('*').eq('listing_id', listingId).order('is_primary', { ascending: false }).order('display_order', { ascending: true }).limit(1),
      itemForm.variant_id.trim() ? supabase.from('listing_variations').select('*').eq('id', itemForm.variant_id.trim()).maybeSingle() : Promise.resolve({ data: null, error: null }),
    ])
    const firstError = listingRes.error ?? imageRes.error ?? variationRes.error
    if (firstError) {
      toast.show('Unable to load listing', { tone: 'danger', message: firstError.message })
      return
    }
    const listing = listingRes.data as ListingRow | null
    if (!listing) {
      toast.show('Listing not found', { tone: 'danger' })
      return
    }
    const shopRes = await supabase.from('shops').select('*').eq('id', listing.shop_id).maybeSingle()
    if (shopRes.error) {
      toast.show('Unable to load shop', { tone: 'danger', message: shopRes.error.message })
      return
    }
    const variation = variationRes.data as ListingVariationRow | null
    const image = ((imageRes.data ?? []) as ListingImageRow[])[0] ?? null
    const shop = shopRes.data as ShopRow | null
    const unitPrice = Number(listing.price ?? 0) + Number(variation?.price_adjustment ?? 0)
    setItemForm((current) => ({
      ...current,
      title: listing.title,
      unit_price: String(unitPrice),
      image_url: current.image_url || image?.image_url || '',
      shop_id: listing.shop_id,
      shop_name: shop?.shop_name ?? current.shop_name,
      variant_name: variation?.variation_name ?? current.variant_name,
      variant_value: variation?.variation_value ?? current.variant_value,
      variant_sku: variation?.sku ?? current.variant_sku,
    }))
  }

  async function submitItemForm() {
    if (!selectedCart) return
    const validationError = validateItemForm(itemForm)
    if (validationError) {
      toast.show('Check cart item', { tone: 'danger', message: validationError })
      return
    }
    setSaving(true)
    setError(null)
    const payload = formToItemPayload(itemForm)
    const result = editingItem
      ? await supabase.from('cart_items').update(payload as CartItemUpdate).eq('id', editingItem.id).eq('cart_id', selectedCart.id).select('*').single()
      : await supabase.from('cart_items').insert({ ...(payload as CartItemInsert), cart_id: selectedCart.id }).select('*').single()

    if (result.error) {
      setError(result.error.message)
      toast.show('Unable to save cart item', { tone: 'danger', message: result.error.message })
      setSaving(false)
      return
    }

    await recalculateCart(selectedCart.id)
    setItemFormOpen(false)
    setEditingItem(null)
    setSaving(false)
    toast.show(editingItem ? 'Cart item updated' : 'Cart item added', { tone: 'success' })
  }

  async function updateItemQuantity(item: CartItemRow, quantity: number) {
    if (!selectedCart) return
    if (quantity <= 0) {
      await deleteItem(item)
      return
    }
    setSaving(true)
    const { error: updateError } = await supabase
      .from('cart_items')
      .update({
        quantity,
        total_price: Number(item.unit_price ?? 0) * quantity,
        updated_at: new Date().toISOString(),
      })
      .eq('id', item.id)

    if (updateError) {
      setError(updateError.message)
      toast.show('Unable to update quantity', { tone: 'danger', message: updateError.message })
    } else {
      await recalculateCart(selectedCart.id)
    }
    setSaving(false)
  }

  async function deleteItem(item: CartItemRow) {
    if (!selectedCart) return
    setSaving(true)
    const { error: deleteError } = await supabase.from('cart_items').delete().eq('id', item.id).eq('cart_id', selectedCart.id)
    if (deleteError) {
      setError(deleteError.message)
      toast.show('Unable to remove item', { tone: 'danger', message: deleteError.message })
    } else {
      await recalculateCart(selectedCart.id)
      toast.show('Item removed', { tone: 'success' })
    }
    setSaving(false)
  }

  async function updateCartStatus(cart: CartRow, status: CartStatus) {
    setSaving(true)
    const { data, error: updateError } = await supabase
      .from('carts')
      .update({ status, updated_at: new Date().toISOString(), converted_at: status === 'converted' ? new Date().toISOString() : cart.converted_at })
      .eq('id', cart.id)
      .select('*')
      .single()
    if (updateError) {
      setError(updateError.message)
      toast.show('Unable to update status', { tone: 'danger', message: updateError.message })
    } else {
      const updated = data as CartRow
      setCarts((current) => current.map((row) => (row.id === updated.id ? updated : row)))
      toast.show('Cart status updated', { tone: 'success' })
    }
    setSaving(false)
  }

  async function deleteCart(cart: CartRow) {
    setSaving(true)
    const { error: itemsError } = await supabase.from('cart_items').delete().eq('cart_id', cart.id)
    const { error: cartError } = itemsError ? { error: itemsError } : await supabase.from('carts').delete().eq('id', cart.id)
    const deleteError = itemsError ?? cartError
    if (deleteError) {
      setError(deleteError.message)
      toast.show('Unable to delete cart', { tone: 'danger', message: deleteError.message })
    } else {
      setCarts((current) => current.filter((row) => row.id !== cart.id))
      setBundlesByCartId((current) => {
        const next = { ...current }
        delete next[cart.id]
        return next
      })
      setSelectedCartId(null)
      setDetailsOpen(false)
      toast.show('Cart deleted', { tone: 'success' })
    }
    setSaving(false)
  }

  function openListing(item: CartItemRow) {
    const listing = selectedBundle.listingsById[item.listing_id]
    router.push(commerceRoutes.listing(listing?.slug ?? item.listing_id))
  }

  function openProductAdmin(item: CartItemRow) {
    router.push('/admin/products' as any)
  }

  if (loading && !carts.length) {
    return (
      <YStack minHeight={420} alignItems="center" justifyContent="center" gap="$3">
        <Spinner size="large" />
        <Text color="$color10">Loading carts...</Text>
      </YStack>
    )
  }

  return (
    <YStack width="100%" gap="$5" paddingHorizontal={isDesktop ? '$6' : '$4'} paddingTop="$5" paddingBottom={safeBottom + 28}>
      <AdminCartHeader onRefresh={() => void loadCarts({ reset: true })} />

      {error ? (
        <YStack padding="$3" borderRadius={radius.card} backgroundColor="$red3" borderWidth={1} borderColor="$red7">
          <Text color="$red11" fontWeight="700">{error}</Text>
        </YStack>
      ) : null}

      <XStack gap="$3" flexWrap="wrap">
        <StatCard label="Total carts" value={stats.total} tone="info" />
        <StatCard label="Active" value={stats.active} tone="success" />
        <StatCard label="Guest carts" value={stats.guest} tone="warning" />
        <StatCard label="Saved items" value={stats.items} tone="brand" />
        <StatCard label="Cart value" value={formatMoney(stats.value)} tone="success" />
      </XStack>

      <CartFilters search={search} status={statusFilter} owner={ownerFilter} onSearchChange={setSearch} onStatusChange={setStatusFilter} onOwnerChange={setOwnerFilter} />

      <XStack gap="$4" flexWrap="wrap" alignItems="flex-start">
        <YStack flex={1.1} minWidth={isDesktop ? 520 : 300} gap="$3">
          <CartList
            carts={carts}
            bundlesByCartId={bundlesByCartId}
            selectedId={selectedCart?.id ?? null}
            loading={loading}
            hasMore={hasMore}
            onOpen={openCartDetails}
            onEdit={openCartEditor}
            onLoadMore={() => void loadCarts({ reset: false })}
          />
        </YStack>
        <YStack flex={0.9} minWidth={isDesktop ? 420 : 300} gap="$4">
          {selectedCart ? (
            <CartSidePanel
              cart={selectedCart}
              bundle={selectedBundle}
              busy={saving}
              onOpenDetails={() => setDetailsOpen(true)}
              onEdit={() => openCartEditor(selectedCart)}
              onAddItem={() => openCreateItem(selectedCart)}
              onStatusChange={(status) => updateCartStatus(selectedCart, status)}
              onDelete={() => deleteCart(selectedCart)}
            />
          ) : (
            <EmptyPanel title="No cart selected" description="Select a cart to inspect customer, products, prices, and activity." />
          )}
        </YStack>
      </XStack>

      <CartDetailsDialog
        open={detailsOpen}
        cart={selectedCart}
        bundle={selectedBundle}
        busy={saving}
        onOpenChange={setDetailsOpen}
        onEditCart={() => selectedCart && openCartEditor(selectedCart)}
        onAddItem={() => selectedCart && openCreateItem(selectedCart)}
        onEditItem={openEditItem}
        onDeleteItem={deleteItem}
        onQuantityChange={updateItemQuantity}
        onStatusChange={(status) => selectedCart && updateCartStatus(selectedCart, status)}
        onDeleteCart={() => selectedCart && deleteCart(selectedCart)}
        onOpenListing={openListing}
        onOpenProductAdmin={openProductAdmin}
      />

      <CartEditorDialog
        open={cartFormOpen}
        form={cartForm}
        busy={saving}
        onOpenChange={setCartFormOpen}
        onChange={(patch) => setCartForm((current) => (current ? { ...current, ...patch } : current))}
        onSubmit={submitCartForm}
      />

      <CartItemEditorDialog
        open={itemFormOpen}
        mode={editingItem ? 'edit' : 'create'}
        form={itemForm}
        busy={saving}
        onOpenChange={setItemFormOpen}
        onChange={(patch) => setItemForm((current) => ({ ...current, ...patch }))}
        onPrefill={prefillItemFromListing}
        onSubmit={submitItemForm}
      />
    </YStack>
  )
}

function AdminCartHeader({ onRefresh }: { onRefresh: () => void }) {
  return (
    <XStack alignItems="center" justifyContent="space-between" gap="$3" flexWrap="wrap">
      <YStack gap="$1">
        <Text fontSize={28} fontWeight="800" color="$color12">Cart Management</Text>
        <Text color="$color10">Review all saved carts, guest carts, users, product images, item prices, discounts, and cart activity.</Text>
      </YStack>
      <Button icon={Icons.RefreshCw} tone="outline" onPress={onRefresh}>Refresh</Button>
    </XStack>
  )
}

function CartFilters({
  search,
  status,
  owner,
  onSearchChange,
  onStatusChange,
  onOwnerChange,
}: {
  search: string
  status: StatusFilter
  owner: OwnerFilter
  onSearchChange: (value: string) => void
  onStatusChange: (value: StatusFilter) => void
  onOwnerChange: (value: OwnerFilter) => void
}) {
  return (
    <YStack gap="$3" padding="$4" borderRadius={radius.card} borderWidth={1} borderColor="$borderColor" backgroundColor="$background" style={getShadowStyle('sm')}>
      <XStack gap="$3" flexWrap="wrap" alignItems="flex-end">
        <Field label="Search">
          <Input value={search} onChangeText={onSearchChange} minWidth={240} placeholder="Cart ID, user ID, session, discount..." />
        </Field>
        <Field label="Cart status">
          <FilterSelect value={status} options={[{ value: 'all', label: 'All statuses' }, ...cartStatusOptions()]} onValueChange={(value) => onStatusChange(value as StatusFilter)} />
        </Field>
        <Field label="Owner">
          <FilterSelect
            value={owner}
            options={[
              { value: 'all', label: 'All carts' },
              { value: 'logged_in', label: 'Logged-in users' },
              { value: 'guest', label: 'Guest sessions' },
            ]}
            onValueChange={(value) => onOwnerChange(value as OwnerFilter)}
          />
        </Field>
      </XStack>
    </YStack>
  )
}

function CartList({
  carts,
  bundlesByCartId,
  selectedId,
  loading,
  hasMore,
  onOpen,
  onEdit,
  onLoadMore,
}: {
  carts: CartRow[]
  bundlesByCartId: Record<string, CartBundle>
  selectedId: string | null
  loading: boolean
  hasMore: boolean
  onOpen: (cart: CartRow) => void
  onEdit: (cart: CartRow) => void
  onLoadMore: () => void
}) {
  return (
    <YStack gap="$3">
      {carts.length ? carts.map((cart) => (
        <CartRowView key={cart.id} cart={cart} bundle={bundlesByCartId[cart.id] ?? EMPTY_BUNDLE} selected={cart.id === selectedId} onOpen={() => onOpen(cart)} onEdit={() => onEdit(cart)} />
      )) : <EmptyPanel title="No carts found" description="Try changing filters or wait for customers to add products to cart." />}
      {hasMore ? (
        <Button tone="outline" onPress={onLoadMore} disabled={loading}>{loading ? 'Loading...' : 'Load more carts'}</Button>
      ) : null}
    </YStack>
  )
}

function CartRowView({ cart, bundle, selected, onOpen, onEdit }: { cart: CartRow; bundle: CartBundle; selected: boolean; onOpen: () => void; onEdit: () => void }) {
  const itemCount = getItemCount(bundle.items)
  const previewImages = bundle.items.slice(0, 4)
  return (
    <YStack gap="$3" padding="$4" borderRadius={radius.card} borderWidth={1} borderColor={selected ? '$color9' : '$borderColor'} backgroundColor={selected ? '$color2' : '$background'} style={getShadowStyle('sm')} cursor="pointer" onPress={onOpen}>
      <XStack gap="$3" alignItems="center">
        <CartImageStack items={previewImages} size={52} />
        <YStack flex={1} minWidth={0}>
          <XStack gap="$2" flexWrap="wrap" alignItems="center">
            <Text fontWeight="800" color="$color12" numberOfLines={1}>{displayCartOwner(cart, bundle.profile)}</Text>
            <Badge tone={statusTone(cart.status)} size="sm">{formatLabel(cart.status)}</Badge>
            <Badge tone={cart.user_id ? 'success' : 'warning'} size="sm">{cart.user_id ? 'Logged in' : 'Guest'}</Badge>
          </XStack>
          <Text color="$color10" numberOfLines={1}>{cart.id}</Text>
          <Text color="$color10" fontSize={12}>{itemCount} items • {formatMoney(cart.total_amount, cart.currency)} • Last active {formatDate(cart.last_activity_at)}</Text>
        </YStack>
        <Button size="$3" tone="outline" icon={Icons.Pencil} onPress={onEdit}>Edit</Button>
        <Icons.ChevronRight size={18} color="$color10" />
      </XStack>
    </YStack>
  )
}

function CartSidePanel({
  cart,
  bundle,
  busy,
  onOpenDetails,
  onEdit,
  onAddItem,
  onStatusChange,
  onDelete,
}: {
  cart: CartRow
  bundle: CartBundle
  busy: boolean
  onOpenDetails: () => void
  onEdit: () => void
  onAddItem: () => void
  onStatusChange: (status: CartStatus) => void
  onDelete: () => void
}) {
  return (
    <YStack gap="$4">
      <DetailSection title="Selected cart">
        <XStack gap="$3" alignItems="center">
          <CartImageStack items={bundle.items.slice(0, 4)} size={68} />
          <YStack flex={1} minWidth={0}>
            <Text fontWeight="800" color="$color12" numberOfLines={1}>{displayCartOwner(cart, bundle.profile)}</Text>
            <Text color="$color10" numberOfLines={1}>{cart.session_id ?? cart.user_id ?? cart.id}</Text>
            <XStack gap="$2" marginTop="$2" flexWrap="wrap">
              <Badge tone={statusTone(cart.status)}>{formatLabel(cart.status)}</Badge>
              <Badge tone="info">{formatMoney(cart.total_amount, cart.currency)}</Badge>
            </XStack>
          </YStack>
        </XStack>
        <DetailRow label="Items subtotal" value={formatMoney(cart.items_subtotal, cart.currency)} />
        <DetailRow label="Discount" value={formatMoney(cart.discount_amount, cart.currency)} />
        <DetailRow label="Items" value={getItemCount(bundle.items)} />
        <DetailRow label="Last activity" value={formatDate(cart.last_activity_at)} />
        <XStack gap="$2" flexWrap="wrap">
          <Button size="$3" icon={Icons.Eye} onPress={onOpenDetails}>Open details</Button>
          <Button size="$3" tone="outline" icon={Icons.Pencil} onPress={onEdit}>Edit cart</Button>
          <Button size="$3" tone="outline" icon={Icons.Plus} onPress={onAddItem}>Add item</Button>
          <FilterSelect value={cart.status} options={cartStatusOptions()} onValueChange={(value) => onStatusChange(value as CartStatus)} />
          <ConfirmDialog
            title="Delete cart?"
            description="This permanently deletes the cart and all items in it."
            confirmLabel="Delete cart"
            destructive
            onConfirm={onDelete}
            trigger={<Button size="$3" tone="destructive" icon={Icons.Trash2} disabled={busy}>Delete</Button>}
          />
        </XStack>
      </DetailSection>
      <DetailSection title="Products in cart">
        {bundle.items.length ? bundle.items.map((item) => <MiniItemRow key={item.id} item={item} />) : <Text color="$color10">No items in this cart.</Text>}
      </DetailSection>
    </YStack>
  )
}

function CartDetailsDialog({
  open,
  cart,
  bundle,
  busy,
  onOpenChange,
  onEditCart,
  onAddItem,
  onEditItem,
  onDeleteItem,
  onQuantityChange,
  onStatusChange,
  onDeleteCart,
  onOpenListing,
  onOpenProductAdmin,
}: {
  open: boolean
  cart: CartRow | null
  bundle: CartBundle
  busy: boolean
  onOpenChange: (open: boolean) => void
  onEditCart: () => void
  onAddItem: () => void
  onEditItem: (item: CartItemRow) => void
  onDeleteItem: (item: CartItemRow) => void
  onQuantityChange: (item: CartItemRow, quantity: number) => void
  onStatusChange: (status: CartStatus) => void
  onDeleteCart: () => void
  onOpenListing: (item: CartItemRow) => void
  onOpenProductAdmin: (item: CartItemRow) => void
}) {
  if (!cart) return null
  return (
    <Dialog modal open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <DialogOverlay />
        <DialogContent maxWidth={1120} maxHeight="92vh" width="96%">
          <DialogTitle>Cart details</DialogTitle>
          <DialogDescription>{displayCartOwner(cart, bundle.profile)} • {formatMoney(cart.total_amount, cart.currency)} • {getItemCount(bundle.items)} items</DialogDescription>
          <ScrollView maxHeight="76vh" showsVerticalScrollIndicator={false}>
            <YStack gap="$4" paddingRight="$1">
              <XStack gap="$3" flexWrap="wrap" padding="$3" borderRadius={radius.card} backgroundColor="$color2" borderWidth={1} borderColor="$borderColor">
                <Button size="$3" icon={Icons.Plus} onPress={onAddItem} disabled={busy}>Add item</Button>
                <Button size="$3" tone="outline" icon={Icons.Pencil} onPress={onEditCart} disabled={busy}>Edit cart</Button>
                <FilterSelect value={cart.status} options={cartStatusOptions()} onValueChange={(value) => onStatusChange(value as CartStatus)} />
                <ConfirmDialog
                  title="Delete cart?"
                  description="This permanently deletes the cart and all items."
                  confirmLabel="Delete cart"
                  destructive
                  onConfirm={onDeleteCart}
                  trigger={<Button size="$3" tone="destructive" icon={Icons.Trash2} disabled={busy}>Delete cart</Button>}
                />
              </XStack>

              <DetailSection title="Customer and activity">
                <XStack gap="$3" flexWrap="wrap">
                  <IdentityCard title={displayCartOwner(cart, bundle.profile)} subtitle={bundle.profile?.email ?? bundle.profile?.phone ?? cart.session_id ?? cart.id} imageUrl={bundle.profile?.avatar_url ?? null} icon="user" />
                  <IdentityCard title={cart.user_id ? 'Logged-in cart' : 'Guest cart'} subtitle={cart.user_id ?? cart.session_id ?? 'No session id'} imageUrl={null} icon="cart" />
                </XStack>
                <DetailRow label="Cart ID" value={cart.id} />
                <DetailRow label="Status" value={formatLabel(cart.status)} />
                <DetailRow label="Created" value={formatDate(cart.created_at)} />
                <DetailRow label="Updated" value={formatDate(cart.updated_at)} />
                <DetailRow label="Last activity" value={formatDate(cart.last_activity_at)} />
                <DetailRow label="Expires" value={formatDate(cart.expires_at)} />
                <DetailRow label="Converted" value={formatDate(cart.converted_at)} />
              </DetailSection>

              <DetailSection title="Money summary">
                <DetailRow label="Items subtotal" value={formatMoney(cart.items_subtotal, cart.currency)} />
                <DetailRow label="Discount amount" value={formatMoney(cart.discount_amount, cart.currency)} />
                <DetailRow label="Total amount" value={formatMoney(cart.total_amount, cart.currency)} />
                <DetailRow label="Currency" value={cart.currency} />
                <DetailRow label="Discount" value={cart.applied_discount_name ?? 'Not applied'} />
                <DetailRow label="Discount type" value={cart.applied_discount_type ?? 'Not set'} />
                <DetailRow label="Discount value" value={cart.applied_discount_value ?? 'Not set'} />
              </DetailSection>

              <DetailSection title="Cart products">
                {bundle.items.length ? bundle.items.map((item) => (
                  <CartItemCard
                    key={item.id}
                    item={item}
                    image={getItemImage(item, bundle.imagesByListingId[item.listing_id] ?? [])}
                    busy={busy}
                    onEdit={() => onEditItem(item)}
                    onDelete={() => onDeleteItem(item)}
                    onQuantityChange={(quantity) => onQuantityChange(item, quantity)}
                    onOpenListing={() => onOpenListing(item)}
                    onOpenProductAdmin={() => onOpenProductAdmin(item)}
                  />
                )) : <Text color="$color10">No products are currently saved in this cart.</Text>}
              </DetailSection>

              <DetailSection title="Metadata">
                <DetailRow label="Analytics" value={formatJson(getMetadataValue(cart.cart_metadata, 'analytics'))} />
                <DetailRow label="Full metadata" value={formatJson(cart.cart_metadata)} />
              </DetailSection>
            </YStack>
          </ScrollView>
        </DialogContent>
      </Dialog.Portal>
    </Dialog>
  )
}

function CartItemCard({
  item,
  image,
  busy,
  onEdit,
  onDelete,
  onQuantityChange,
  onOpenListing,
  onOpenProductAdmin,
}: {
  item: CartItemRow
  image: ListingImageRow | null
  busy: boolean
  onEdit: () => void
  onDelete: () => void
  onQuantityChange: (quantity: number) => void
  onOpenListing: () => void
  onOpenProductAdmin: () => void
}) {
  return (
    <YStack gap="$3" padding="$3" borderRadius={radius.card} borderWidth={1} borderColor="$borderColor" backgroundColor="$color2">
      <XStack gap="$3" alignItems="center" flexWrap="wrap">
        <ProductThumb imageUrl={item.image_url ?? image?.image_url ?? null} title={item.title} size={72} />
        <YStack flex={1} minWidth={220}>
          <Text fontWeight="800" color="$color12" numberOfLines={1}>{item.title}</Text>
          <Text color="$color10" numberOfLines={1}>{item.shop_name} • {item.variant_name || item.variant_value ? `${item.variant_name ?? 'Variant'} ${item.variant_value ?? ''}` : 'No variant'}</Text>
          <Text color="$color10" fontSize={12}>SKU {item.variant_sku ?? 'Not set'} • Listing {item.listing_id}</Text>
        </YStack>
        <YStack minWidth={140} alignItems="flex-end">
          <Text fontWeight="800" color="$color12">{formatMoney(item.total_price ?? item.unit_price * item.quantity)}</Text>
          <Text color="$color10" fontSize={12}>{formatMoney(item.unit_price)} x {item.quantity}</Text>
        </YStack>
      </XStack>
      <XStack gap="$2" flexWrap="wrap" alignItems="center">
        <Button size="$2.5" tone="outline" onPress={() => onQuantityChange(item.quantity - 1)} disabled={busy}>-</Button>
        <Badge tone="neutral">Qty {item.quantity}</Badge>
        <Button size="$2.5" tone="outline" onPress={() => onQuantityChange(item.quantity + 1)} disabled={busy}>+</Button>
        <Button size="$3" tone="outline" icon={Icons.ExternalLink} onPress={onOpenListing}>Open listing</Button>
        <Button size="$3" tone="outline" icon={Icons.Package} onPress={onOpenProductAdmin}>Admin products</Button>
        <Button size="$3" tone="outline" icon={Icons.Pencil} onPress={onEdit} disabled={busy}>Edit</Button>
        <ConfirmDialog title="Remove item?" description="This removes the product from this cart." confirmLabel="Remove item" destructive onConfirm={onDelete} trigger={<Button size="$3" tone="destructive" icon={Icons.Trash2} disabled={busy}>Remove</Button>} />
      </XStack>
      <DetailRow label="Item metadata" value={formatJson(item.item_metadata)} />
    </YStack>
  )
}

function CartEditorDialog({ open, form, busy, onOpenChange, onChange, onSubmit }: { open: boolean; form: CartEditorForm | null; busy: boolean; onOpenChange: (open: boolean) => void; onChange: (patch: Partial<CartEditorForm>) => void; onSubmit: () => void }) {
  if (!form) return null
  return (
    <Dialog modal open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <DialogOverlay />
        <DialogContent maxWidth={760} maxHeight="92vh" width="94%">
          <DialogTitle>Edit cart</DialogTitle>
          <DialogDescription>Update cart status, discount, expiry, currency, and metadata.</DialogDescription>
          <ScrollView maxHeight="70vh" showsVerticalScrollIndicator={false}>
            <YStack gap="$3" paddingRight="$1">
              <XStack gap="$3" flexWrap="wrap">
                <YStack flex={1} minWidth={180}><Field label="Status"><FilterSelect value={form.status} options={cartStatusOptions()} onValueChange={(status) => onChange({ status: status as CartStatus })} /></Field></YStack>
                <YStack flex={1} minWidth={120}><Field label="Currency"><Input value={form.currency} onChangeText={(currency) => onChange({ currency })} placeholder="INR" /></Field></YStack>
                <YStack flex={1} minWidth={160}><Field label="Discount amount"><Input value={form.discount_amount} keyboardType="decimal-pad" onChangeText={(discount_amount) => onChange({ discount_amount })} /></Field></YStack>
              </XStack>
              <XStack gap="$3" flexWrap="wrap">
                <YStack flex={1} minWidth={200}><Field label="Discount name"><Input value={form.applied_discount_name} onChangeText={(applied_discount_name) => onChange({ applied_discount_name })} /></Field></YStack>
                <YStack flex={1} minWidth={160}><Field label="Discount type"><Input value={form.applied_discount_type} onChangeText={(applied_discount_type) => onChange({ applied_discount_type })} /></Field></YStack>
                <YStack flex={1} minWidth={140}><Field label="Discount value"><Input value={form.applied_discount_value} keyboardType="decimal-pad" onChangeText={(applied_discount_value) => onChange({ applied_discount_value })} /></Field></YStack>
              </XStack>
              <Field label="Expires at"><Input value={form.expires_at} onChangeText={(expires_at) => onChange({ expires_at })} placeholder="2026-12-31T23:59:00.000Z" /></Field>
              <Field label="Cart metadata JSON"><TextArea value={form.cartMetadataText} minHeight={120} onChangeText={(cartMetadataText) => onChange({ cartMetadataText })} /></Field>
              <XStack gap="$2" justifyContent="flex-end">
                <Button tone="outline" onPress={() => onOpenChange(false)} disabled={busy}>Cancel</Button>
                <Button onPress={onSubmit} disabled={busy}>{busy ? 'Saving...' : 'Save cart'}</Button>
              </XStack>
            </YStack>
          </ScrollView>
        </DialogContent>
      </Dialog.Portal>
    </Dialog>
  )
}

function CartItemEditorDialog({ open, mode, form, busy, onOpenChange, onChange, onPrefill, onSubmit }: { open: boolean; mode: 'create' | 'edit'; form: ItemEditorForm; busy: boolean; onOpenChange: (open: boolean) => void; onChange: (patch: Partial<ItemEditorForm>) => void; onPrefill: () => void; onSubmit: () => void }) {
  return (
    <Dialog modal open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <DialogOverlay />
        <DialogContent maxWidth={880} maxHeight="92vh" width="94%">
          <DialogTitle>{mode === 'create' ? 'Add cart item' : 'Edit cart item'}</DialogTitle>
          <DialogDescription>Enter a listing id, load product data, then adjust quantity, price, image, shop, and variant information.</DialogDescription>
          <ScrollView maxHeight="70vh" showsVerticalScrollIndicator={false}>
            <YStack gap="$3" paddingRight="$1">
              <XStack gap="$3" flexWrap="wrap" alignItems="flex-end">
                <YStack flex={1} minWidth={260}><Field label="Listing ID" required><Input value={form.listing_id} onChangeText={(listing_id) => onChange({ listing_id })} /></Field></YStack>
                <YStack flex={1} minWidth={220}><Field label="Variant ID"><Input value={form.variant_id} onChangeText={(variant_id) => onChange({ variant_id })} /></Field></YStack>
                <Button tone="outline" icon={Icons.Search} onPress={onPrefill} disabled={busy}>Load listing</Button>
              </XStack>
              <XStack gap="$3" flexWrap="wrap">
                <YStack flex={1} minWidth={240}><Field label="Title" required><Input value={form.title} onChangeText={(title) => onChange({ title })} /></Field></YStack>
                <YStack flex={1} minWidth={120}><Field label="Quantity" required><Input value={form.quantity} keyboardType="number-pad" onChangeText={(quantity) => onChange({ quantity })} /></Field></YStack>
                <YStack flex={1} minWidth={140}><Field label="Unit price" required><Input value={form.unit_price} keyboardType="decimal-pad" onChangeText={(unit_price) => onChange({ unit_price })} /></Field></YStack>
              </XStack>
              <Field label="Image URL"><Input value={form.image_url} onChangeText={(image_url) => onChange({ image_url })} /></Field>
              <XStack gap="$3" flexWrap="wrap">
                <YStack flex={1} minWidth={220}><Field label="Shop ID" required><Input value={form.shop_id} onChangeText={(shop_id) => onChange({ shop_id })} /></Field></YStack>
                <YStack flex={1} minWidth={220}><Field label="Shop name" required><Input value={form.shop_name} onChangeText={(shop_name) => onChange({ shop_name })} /></Field></YStack>
              </XStack>
              <XStack gap="$3" flexWrap="wrap">
                <YStack flex={1} minWidth={180}><Field label="Variant name"><Input value={form.variant_name} onChangeText={(variant_name) => onChange({ variant_name })} /></Field></YStack>
                <YStack flex={1} minWidth={180}><Field label="Variant value"><Input value={form.variant_value} onChangeText={(variant_value) => onChange({ variant_value })} /></Field></YStack>
                <YStack flex={1} minWidth={180}><Field label="Variant SKU"><Input value={form.variant_sku} onChangeText={(variant_sku) => onChange({ variant_sku })} /></Field></YStack>
              </XStack>
              <Field label="Item metadata JSON"><TextArea value={form.itemMetadataText} minHeight={110} onChangeText={(itemMetadataText) => onChange({ itemMetadataText })} /></Field>
              <XStack gap="$2" justifyContent="flex-end">
                <Button tone="outline" onPress={() => onOpenChange(false)} disabled={busy}>Cancel</Button>
                <Button onPress={onSubmit} disabled={busy}>{busy ? 'Saving...' : 'Save item'}</Button>
              </XStack>
            </YStack>
          </ScrollView>
        </DialogContent>
      </Dialog.Portal>
    </Dialog>
  )
}

function MiniItemRow({ item }: { item: CartItemRow }) {
  return (
    <XStack gap="$3" alignItems="center" padding="$2.5" borderRadius={radius.chip} backgroundColor="$color2">
      <ProductThumb imageUrl={item.image_url} title={item.title} size={42} />
      <YStack flex={1} minWidth={0}>
        <Text fontWeight="800" color="$color12" numberOfLines={1}>{item.title}</Text>
        <Text color="$color10" fontSize={12}>{item.quantity} x {formatMoney(item.unit_price)} • {item.shop_name}</Text>
      </YStack>
    </XStack>
  )
}

function CartImageStack({ items, size }: { items: CartItemRow[]; size: number }) {
  if (!items.length) {
    return (
      <YStack width={size} height={size} borderRadius={radius.card} alignItems="center" justifyContent="center" backgroundColor="$color3">
        <Icons.ShoppingCart size={Math.round(size * 0.4)} color="$color10" />
      </YStack>
    )
  }
  return (
    <XStack width={size} height={size} flexWrap="wrap" overflow="hidden" borderRadius={radius.card} backgroundColor="$color3">
      {items.map((item) => (
        <ProductThumb key={item.id} imageUrl={item.image_url} title={item.title} size={items.length === 1 ? size : size / 2} />
      ))}
    </XStack>
  )
}

function ProductThumb({ imageUrl, title, size }: { imageUrl: string | null; title: string; size: number }) {
  if (imageUrl) return <Image src={imageUrl} alt={title} width={size} height={size} objectFit="cover" backgroundColor="$color3" />
  return (
    <YStack width={size} height={size} alignItems="center" justifyContent="center" backgroundColor="$color3">
      <Icons.Package size={Math.round(size * 0.38)} color="$color10" />
    </YStack>
  )
}

function IdentityCard({ title, subtitle, imageUrl, icon }: { title: string; subtitle: string; imageUrl: string | null; icon: 'user' | 'cart' }) {
  const Icon = icon === 'user' ? Icons.User : Icons.ShoppingCart
  return (
    <XStack flex={1} minWidth={240} gap="$3" alignItems="center" padding="$3" borderRadius={radius.card} borderWidth={1} borderColor="$borderColor" backgroundColor="$color2">
      {imageUrl ? (
        <Image src={imageUrl} alt={title} width={52} height={52} objectFit="cover" borderRadius={999} backgroundColor="$color3" />
      ) : (
        <YStack width={52} height={52} borderRadius={999} alignItems="center" justifyContent="center" backgroundColor="$color3">
          <Icon size={22} color="$color10" />
        </YStack>
      )}
      <YStack flex={1} minWidth={0}>
        <Text fontWeight="800" color="$color12" numberOfLines={1}>{title}</Text>
        <Text color="$color10" fontSize={12} numberOfLines={1}>{subtitle}</Text>
      </YStack>
    </XStack>
  )
}

function DetailSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <YStack gap="$2.5" padding="$4" borderRadius={radius.card} borderWidth={1} borderColor="$borderColor" backgroundColor="$background" style={getShadowStyle('sm')}>
      <XStack alignItems="center" gap="$2">
        <YStack width={4} height={18} borderRadius={999} backgroundColor="$color9" />
        <Text fontSize={14} fontWeight="800" color="$color12">{title}</Text>
      </XStack>
      <YStack gap="$2.5">{children}</YStack>
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

function Field({ label, required, children }: { label: string; required?: boolean; children: ReactNode }) {
  return (
    <YStack gap="$2">
      <Text fontSize={12} fontWeight="700" color="$color11">{label}{required ? ' *' : ''}</Text>
      {children}
    </YStack>
  )
}

function FilterSelect({ value, options, onValueChange }: { value: string; options: { value: string; label: string }[]; onValueChange: (value: string) => void }) {
  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger minWidth={170} iconAfter={<Icons.ChevronDown size={16} />}>
        <Select.Value />
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

function StatCard({ label, value, tone }: { label: string; value: string | number; tone: 'info' | 'success' | 'danger' | 'warning' | 'brand' }) {
  return (
    <YStack flex={1} minWidth={150} padding="$3" gap="$2" borderRadius={radius.card} borderWidth={1} borderColor="$borderColor" backgroundColor="$background" style={getShadowStyle('sm')}>
      <Badge tone={tone}>{label}</Badge>
      <Text fontSize={24} fontWeight="800" color="$color12">{value}</Text>
    </YStack>
  )
}

function EmptyPanel({ title, description }: { title: string; description: string }) {
  return (
    <YStack minHeight={220} alignItems="center" justifyContent="center" gap="$2" padding="$4" borderRadius={radius.card} borderWidth={1} borderColor="$borderColor" backgroundColor="$background">
      <Icons.ShoppingCart size={30} color="$color10" />
      <Text fontWeight="800" color="$color12">{title}</Text>
      <Text color="$color10" textAlign="center">{description}</Text>
    </YStack>
  )
}

function cartToForm(cart: CartRow): CartEditorForm {
  return {
    status: cart.status,
    currency: cart.currency,
    discount_amount: String(cart.discount_amount ?? 0),
    applied_discount_name: cart.applied_discount_name ?? '',
    applied_discount_type: cart.applied_discount_type ?? '',
    applied_discount_value: cart.applied_discount_value == null ? '' : String(cart.applied_discount_value),
    expires_at: cart.expires_at,
    cartMetadataText: formatJson(cart.cart_metadata),
  }
}

function formToCartPayload(form: CartEditorForm): CartUpdate {
  return {
    status: form.status,
    currency: form.currency.trim() || 'INR',
    discount_amount: toNumber(form.discount_amount, 0),
    applied_discount_name: nullableText(form.applied_discount_name),
    applied_discount_type: nullableText(form.applied_discount_type),
    applied_discount_value: toNullableNumber(form.applied_discount_value),
    expires_at: nullableText(form.expires_at) ?? new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString(),
    cart_metadata: parseJson(form.cartMetadataText, {}) as Json,
    updated_at: new Date().toISOString(),
  }
}

function itemToForm(item: CartItemRow): ItemEditorForm {
  return {
    listing_id: item.listing_id,
    variant_id: item.variant_id ?? '',
    quantity: String(item.quantity),
    unit_price: String(item.unit_price),
    title: item.title,
    image_url: item.image_url ?? '',
    shop_id: item.shop_id,
    shop_name: item.shop_name,
    variant_name: item.variant_name ?? '',
    variant_value: item.variant_value ?? '',
    variant_sku: item.variant_sku ?? '',
    itemMetadataText: formatJson(item.item_metadata),
  }
}

function formToItemPayload(form: ItemEditorForm): CartItemInsert | CartItemUpdate {
  const quantity = toNumber(form.quantity, 1)
  const unitPrice = toNumber(form.unit_price, 0)
  return {
    listing_id: form.listing_id.trim(),
    variant_id: nullableText(form.variant_id),
    quantity,
    unit_price: unitPrice,
    total_price: quantity * unitPrice,
    title: form.title.trim(),
    image_url: nullableText(form.image_url),
    shop_id: form.shop_id.trim(),
    shop_name: form.shop_name.trim(),
    variant_name: nullableText(form.variant_name),
    variant_value: nullableText(form.variant_value),
    variant_sku: nullableText(form.variant_sku),
    item_metadata: parseJson(form.itemMetadataText, {}) as Json,
    updated_at: new Date().toISOString(),
  }
}

function validateItemForm(form: ItemEditorForm) {
  if (!form.listing_id.trim()) return 'Listing ID is required.'
  if (!form.title.trim()) return 'Product title is required.'
  if (!form.shop_id.trim()) return 'Shop ID is required.'
  if (!form.shop_name.trim()) return 'Shop name is required.'
  if (toNumber(form.quantity, 0) < 1) return 'Quantity must be at least 1.'
  if (toNumber(form.unit_price, -1) < 0) return 'Unit price must be zero or greater.'
  if (!isJsonObject(form.itemMetadataText)) return 'Item metadata must be a valid JSON object.'
  return null
}

function cartStatusOptions() {
  return [
    { value: 'active', label: 'Active' },
    { value: 'abandoned', label: 'Abandoned' },
    { value: 'converted', label: 'Converted' },
    { value: 'expired', label: 'Expired' },
  ]
}

function getCartStats(carts: CartRow[], bundles: Record<string, CartBundle>) {
  return {
    total: carts.length,
    active: carts.filter((cart) => cart.status === 'active').length,
    guest: carts.filter((cart) => !cart.user_id).length,
    items: carts.reduce((total, cart) => total + getItemCount(bundles[cart.id]?.items ?? []), 0),
    value: carts.reduce((total, cart) => total + Number(cart.total_amount ?? 0), 0),
  }
}

function getItemCount(items: CartItemRow[]) {
  return items.reduce((total, item) => total + Number(item.quantity ?? 0), 0)
}

function getItemImage(item: CartItemRow, images: ListingImageRow[]) {
  if (item.image_url) return null
  return images.find((image) => image.is_primary) ?? images[0] ?? null
}

function displayCartOwner(cart: CartRow, profile: ProfileRow | null) {
  if (profile) return profile.full_name || profile.username || profile.email || profile.id
  if (cart.user_id) return `User ${cart.user_id}`
  return `Guest ${cart.session_id ?? cart.id.slice(0, 8)}`
}

function statusTone(status: string) {
  if (status === 'active') return 'success' as const
  if (status === 'converted') return 'brand' as const
  if (status === 'expired') return 'danger' as const
  if (status === 'abandoned') return 'warning' as const
  return 'neutral' as const
}

function formatLabel(value: string | null | undefined) {
  return String(value ?? 'not set').replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function formatMoney(value: number | null | undefined, currency = 'INR') {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: currency || 'INR' }).format(Number(value ?? 0))
}

function formatDate(value: string | null | undefined) {
  if (!value) return 'Not set'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString()
}

function formatJson(value: unknown) {
  try {
    return JSON.stringify(value ?? {}, null, 2)
  } catch {
    return String(value ?? '')
  }
}

function getMetadataValue(metadata: Json, key: string) {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return null
  return (metadata as Record<string, unknown>)[key] ?? null
}

function isJsonObject(value: string) {
  try {
    const parsed = JSON.parse(value || '{}')
    return !!parsed && typeof parsed === 'object' && !Array.isArray(parsed)
  } catch {
    return false
  }
}

function parseJson(value: string, fallback: Record<string, unknown>) {
  try {
    const parsed = JSON.parse(value || '{}')
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : fallback
  } catch {
    return fallback
  }
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
  const trimmed = value.trim()
  if (!trimmed) return null
  return toNumber(trimmed, 0)
}

function escapeSearch(value: string) {
  return value.replace(/[%_,]/g, '')
}

function unique(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)))
}

function indexBy<T extends Record<string, any>>(rows: T[], key: keyof T) {
  return rows.reduce<Record<string, T>>((acc, row) => {
    acc[String(row[key])] = row
    return acc
  }, {})
}

function groupBy<T extends Record<string, any>>(rows: T[], key: keyof T) {
  return rows.reduce<Record<string, T[]>>((acc, row) => {
    const id = String(row[key])
    acc[id] = [...(acc[id] ?? []), row]
    return acc
  }, {})
}
