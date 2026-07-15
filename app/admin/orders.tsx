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

type OrderRow = Tables<'orders'>
type OrderUpdate = TablesUpdate<'orders'>
type OrderItemRow = Tables<'order_items'>
type OrderItemInsert = TablesInsert<'order_items'>
type OrderItemUpdate = TablesUpdate<'order_items'>
type OrderPaymentRow = Tables<'order_payments'>
type OrderPaymentInsert = TablesInsert<'order_payments'>
type OrderPaymentUpdate = TablesUpdate<'order_payments'>
type FulfillmentRow = Tables<'order_fulfillments'>
type FulfillmentInsert = TablesInsert<'order_fulfillments'>
type FulfillmentUpdate = TablesUpdate<'order_fulfillments'>
type FulfillmentEventRow = Tables<'fulfillment_events'>
type OrderIssueRow = Tables<'order_issues'>
type OrderIssueInsert = TablesInsert<'order_issues'>
type OrderIssueUpdate = TablesUpdate<'order_issues'>
type StatusLogRow = Tables<'order_status_logs'>
type AddressRow = Tables<'addresses'>
type ProfileRow = Tables<'profiles'>
type ShopRow = Tables<'shops'>
type ListingRow = Tables<'listings'>
type ListingImageRow = Tables<'listing_images'>

type OrderStatus = OrderItemRow['item_status']
type PaymentStatus = OrderPaymentRow['payment_status']
type PaymentMode = OrderPaymentRow['payment_mode']
type FulfillmentStatus = FulfillmentRow['fulfillment_status']
type StatusFilter = 'all' | OrderStatus

type OrderBundle = {
  order: OrderRow | null
  customer: ProfileRow | null
  shop: ShopRow | null
  owner: ProfileRow | null
  listing: ListingRow | null
  image: ListingImageRow | null
  shippingAddress: AddressRow | null
  billingAddress: AddressRow | null
  payments: OrderPaymentRow[]
  fulfillments: FulfillmentRow[]
  fulfillmentEvents: FulfillmentEventRow[]
  issues: OrderIssueRow[]
  logs: StatusLogRow[]
}

type OrderItemForm = {
  order_id: string
  listing_id: string
  vendor_id: string
  product_title: string
  product_description: string
  product_sku: string
  quantity: string
  unit_price: string
  total_price: string
  item_discount_amount: string
  item_status: OrderStatus
  digital_download_url: string
  download_expires_at: string
  variationDetailsText: string
}

type PaymentForm = {
  amount: string
  payment_mode: PaymentMode
  payment_status: PaymentStatus
  transaction_id: string
  payment_gateway: string
  failure_reason: string
  metadataText: string
}

type FulfillmentForm = {
  fulfillment_number: string
  fulfilled_by: string
  quantity_to_fulfill: string
  fulfillment_status: FulfillmentStatus
  carrier_name: string
  carrier_code: string
  tracking_number: string
  estimated_ship_date: string
  estimated_delivery_date: string
  shipping_cost: string
  package_weight_grams: string
  notes: string
}

type IssueForm = {
  issue_title: string
  description: string
  issue_type: string
  issue_priority: string
  status: string
  resolution_note: string
}

const PAGE_SIZE = 20

const EMPTY_BUNDLE: OrderBundle = {
  order: null,
  customer: null,
  shop: null,
  owner: null,
  listing: null,
  image: null,
  shippingAddress: null,
  billingAddress: null,
  payments: [],
  fulfillments: [],
  fulfillmentEvents: [],
  issues: [],
  logs: [],
}

const EMPTY_ITEM_FORM: OrderItemForm = {
  order_id: '',
  listing_id: '',
  vendor_id: '',
  product_title: '',
  product_description: '',
  product_sku: '',
  quantity: '1',
  unit_price: '0',
  total_price: '0',
  item_discount_amount: '',
  item_status: 'pending',
  digital_download_url: '',
  download_expires_at: '',
  variationDetailsText: '{}',
}

const EMPTY_PAYMENT_FORM: PaymentForm = {
  amount: '0',
  payment_mode: 'online',
  payment_status: 'pending',
  transaction_id: '',
  payment_gateway: '',
  failure_reason: '',
  metadataText: '{}',
}

const EMPTY_FULFILLMENT_FORM: FulfillmentForm = {
  fulfillment_number: '',
  fulfilled_by: '',
  quantity_to_fulfill: '1',
  fulfillment_status: 'pending',
  carrier_name: '',
  carrier_code: '',
  tracking_number: '',
  estimated_ship_date: '',
  estimated_delivery_date: '',
  shipping_cost: '',
  package_weight_grams: '',
  notes: '',
}

const EMPTY_ISSUE_FORM: IssueForm = {
  issue_title: '',
  description: '',
  issue_type: 'other',
  issue_priority: 'normal',
  status: 'open',
  resolution_note: '',
}

export default function AdminOrdersPage() {
  return <AdminOrdersManager />
}

function AdminOrdersManager() {
  const router = useRouter()
  const toast = useAppToast()
  const { isDesktop, safeBottom } = useAppLayout()

  const [items, setItems] = useState<OrderItemRow[]>([])
  const [bundlesByItemId, setBundlesByItemId] = useState<Record<string, OrderBundle>>({})
  const [totalItems, setTotalItems] = useState(0)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null)
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [itemFormOpen, setItemFormOpen] = useState(false)
  const [itemFormMode, setItemFormMode] = useState<'create' | 'edit'>('create')
  const [itemForm, setItemForm] = useState<OrderItemForm>(EMPTY_ITEM_FORM)
  const [paymentFormOpen, setPaymentFormOpen] = useState(false)
  const [paymentForm, setPaymentForm] = useState<PaymentForm>(EMPTY_PAYMENT_FORM)
  const [fulfillmentFormOpen, setFulfillmentFormOpen] = useState(false)
  const [fulfillmentForm, setFulfillmentForm] = useState<FulfillmentForm>(EMPTY_FULFILLMENT_FORM)
  const [issueFormOpen, setIssueFormOpen] = useState(false)
  const [issueForm, setIssueForm] = useState<IssueForm>(EMPTY_ISSUE_FORM)

  const selectedItem = items.find((item) => item.id === selectedItemId) ?? items[0] ?? null
  const selectedBundle = selectedItem ? bundlesByItemId[selectedItem.id] ?? EMPTY_BUNDLE : EMPTY_BUNDLE
  const hasMore = items.length < totalItems

  const filters = useMemo(
    () => ({
      search: search.trim(),
      status: statusFilter,
    }),
    [search, statusFilter],
  )

  useEffect(() => {
    void loadItems({ reset: true })
  }, [filters])

  useEffect(() => {
    if (!selectedItemId && items[0]) {
      setSelectedItemId(items[0].id)
    }
  }, [items, selectedItemId])

  async function loadItems({ reset }: { reset: boolean }) {
    setLoading(true)
    setError(null)

    const from = reset ? 0 : items.length
    const to = from + PAGE_SIZE - 1
    let query = supabase
      .from('order_items')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to)

    if (filters.search) {
      const value = escapeSearch(filters.search)
      query = query.or(`product_title.ilike.%${value}%,product_sku.ilike.%${value}%,product_description.ilike.%${value}%`)
    }

    if (filters.status !== 'all') {
      query = query.eq('item_status', filters.status)
    }

    const { data, count, error: loadError } = await query
    if (loadError) {
      setError(loadError.message)
      setLoading(false)
      return
    }

    const nextItems = (data ?? []) as OrderItemRow[]
    setItems((current) => (reset ? nextItems : [...current, ...nextItems]))
    setTotalItems(count ?? nextItems.length)
    await loadBundlesForItems(nextItems)
    setLoading(false)
  }

  async function loadBundlesForItems(orderItems: OrderItemRow[]) {
    if (!orderItems.length) return

    const orderIds = unique(orderItems.map((item) => item.order_id))
    const itemIds = unique(orderItems.map((item) => item.id))
    const shopIds = unique(orderItems.map((item) => item.vendor_id))
    const listingIds = unique(orderItems.map((item) => item.listing_id))

    const [ordersRes, shopsRes, listingsRes, paymentsRes, fulfillmentsRes, issuesRes] = await Promise.all([
      supabase.from('orders').select('*').in('id', orderIds),
      supabase.from('shops').select('*').in('id', shopIds),
      supabase.from('listings').select('*').in('id', listingIds),
      supabase.from('order_payments').select('*').in('order_id', orderIds).order('created_at', { ascending: false }),
      supabase.from('order_fulfillments').select('*').in('order_item_id', itemIds).order('created_at', { ascending: false }),
      supabase.from('order_issues').select('*').in('order_id', orderIds).order('created_at', { ascending: false }),
    ])

    const firstError = ordersRes.error ?? shopsRes.error ?? listingsRes.error ?? paymentsRes.error ?? fulfillmentsRes.error ?? issuesRes.error
    if (firstError) {
      setError(firstError.message)
      return
    }

    const orders = indexBy((ordersRes.data ?? []) as OrderRow[], 'id')
    const shops = indexBy((shopsRes.data ?? []) as ShopRow[], 'id')
    const listings = indexBy((listingsRes.data ?? []) as ListingRow[], 'id')
    const paymentsByOrderId = groupBy((paymentsRes.data ?? []) as OrderPaymentRow[], 'order_id')
    const fulfillmentsByItemId = groupBy((fulfillmentsRes.data ?? []) as FulfillmentRow[], 'order_item_id')
    const issues = (issuesRes.data ?? []) as OrderIssueRow[]
    const issuesByOrderId = groupBy(issues, 'order_id')

    const customerIds = unique(Object.values(orders).map((order) => order.user_id))
    const ownerIds = unique(Object.values(shops).map((shop) => shop.user_id))
    const addressIds = unique(
      Object.values(orders).flatMap((order) => [order.shipping_address_id, order.billing_address_id]).filter(Boolean) as string[],
    )
    const fulfillmentIds = unique(((fulfillmentsRes.data ?? []) as FulfillmentRow[]).map((fulfillment) => fulfillment.id))

    const [customersRes, ownersRes, addressesRes, imagesRes, eventsRes, logsRes] = await Promise.all([
      customerIds.length ? supabase.from('profiles').select('*').in('id', customerIds) : emptyResult<ProfileRow>(),
      ownerIds.length ? supabase.from('profiles').select('*').in('id', ownerIds) : emptyResult<ProfileRow>(),
      addressIds.length ? supabase.from('addresses').select('*').in('id', addressIds) : emptyResult<AddressRow>(),
      listingIds.length
        ? supabase.from('listing_images').select('*').in('listing_id', listingIds).order('is_primary', { ascending: false }).order('display_order', { ascending: true })
        : emptyResult<ListingImageRow>(),
      fulfillmentIds.length
        ? supabase.from('fulfillment_events').select('*').in('fulfillment_id', fulfillmentIds).order('event_timestamp', { ascending: false })
        : emptyResult<FulfillmentEventRow>(),
      orderIds.length ? supabase.from('order_status_logs').select('*').in('order_id', orderIds).order('changed_at', { ascending: false }) : emptyResult<StatusLogRow>(),
    ])

    const secondError = customersRes.error ?? ownersRes.error ?? addressesRes.error ?? imagesRes.error ?? eventsRes.error ?? logsRes.error
    if (secondError) {
      setError(secondError.message)
      return
    }

    const customers = indexBy((customersRes.data ?? []) as ProfileRow[], 'id')
    const owners = indexBy((ownersRes.data ?? []) as ProfileRow[], 'id')
    const addresses = indexBy((addressesRes.data ?? []) as AddressRow[], 'id')
    const imagesByListingId = groupBy((imagesRes.data ?? []) as ListingImageRow[], 'listing_id')
    const eventsByFulfillmentId = groupBy((eventsRes.data ?? []) as FulfillmentEventRow[], 'fulfillment_id')
    const logsByOrderId = groupBy((logsRes.data ?? []) as StatusLogRow[], 'order_id')

    setBundlesByItemId((current) => {
      const next = { ...current }
      for (const item of orderItems) {
        const order = orders[item.order_id] ?? null
        const shop = shops[item.vendor_id] ?? null
        const listing = listings[item.listing_id] ?? null
        const fulfillments = fulfillmentsByItemId[item.id] ?? []
        next[item.id] = {
          order,
          customer: order ? customers[order.user_id] ?? null : null,
          shop,
          owner: shop ? owners[shop.user_id] ?? null : null,
          listing,
          image: getPrimaryImage(imagesByListingId[item.listing_id] ?? []),
          shippingAddress: order?.shipping_address_id ? addresses[order.shipping_address_id] ?? null : null,
          billingAddress: order?.billing_address_id ? addresses[order.billing_address_id] ?? null : null,
          payments: paymentsByOrderId[item.order_id] ?? [],
          fulfillments,
          fulfillmentEvents: fulfillments.flatMap((fulfillment) => eventsByFulfillmentId[fulfillment.id] ?? []),
          issues: (issuesByOrderId[item.order_id] ?? []).filter((issue) => !issue.order_item_id || issue.order_item_id === item.id),
          logs: logsByOrderId[item.order_id] ?? [],
        }
      }
      return next
    })
  }

  async function refreshSelected() {
    if (!selectedItem) return
    await loadBundlesForItems([selectedItem])
  }

  function openDetails(item: OrderItemRow) {
    setSelectedItemId(item.id)
    setDetailsOpen(true)
    void loadBundlesForItems([item])
  }

  function openCreateItem() {
    setItemFormMode('create')
    setItemForm(EMPTY_ITEM_FORM)
    setItemFormOpen(true)
  }

  function openEditItem(item: OrderItemRow) {
    setItemFormMode('edit')
    setItemForm(itemToForm(item))
    setItemFormOpen(true)
  }

  async function submitItem() {
    const validationError = validateItemForm(itemForm)
    if (validationError) {
      toast.show('Check order item', { tone: 'danger', message: validationError })
      return
    }

    setSaving(true)
    const payload = formToItemPayload(itemForm)
    const result =
      itemFormMode === 'create'
        ? await supabase.from('order_items').insert(payload as OrderItemInsert).select('*').single()
        : selectedItem
          ? await supabase.from('order_items').update(payload as OrderItemUpdate).eq('id', selectedItem.id).select('*').single()
          : null

    if (!result) {
      setSaving(false)
      return
    }

    if (result.error) {
      setError(result.error.message)
      toast.show('Unable to save order item', { tone: 'danger', message: result.error.message })
      setSaving(false)
      return
    }

    const saved = result.data as OrderItemRow
    setItems((current) => (itemFormMode === 'create' ? [saved, ...current] : current.map((item) => (item.id === saved.id ? saved : item))))
    setSelectedItemId(saved.id)
    await loadBundlesForItems([saved])
    setItemFormOpen(false)
    setSaving(false)
    toast.show(itemFormMode === 'create' ? 'Order item created' : 'Order item updated', { tone: 'success' })
  }

  async function patchItemStatus(item: OrderItemRow, status: OrderStatus) {
    await patchItem(item.id, { item_status: status })
    await supabase.from('order_status_logs').insert({
      order_id: item.order_id,
      from_status: item.item_status,
      to_status: status,
      note: 'Admin updated item status',
      change_reason: 'admin_action',
      system_generated: false,
      change_metadata: { item_id: item.id } as Json,
    })
    await refreshSelected()
  }

  async function patchItem(itemId: string, patch: OrderItemUpdate) {
    setSaving(true)
    const { data, error: patchError } = await supabase.from('order_items').update(patch).eq('id', itemId).select('*').single()
    if (patchError) {
      setError(patchError.message)
      toast.show('Unable to update order item', { tone: 'danger', message: patchError.message })
      setSaving(false)
      return
    }
    const updated = data as OrderItemRow
    setItems((current) => current.map((item) => (item.id === updated.id ? updated : item)))
    setSaving(false)
  }

  async function patchParentOrderStatus(order: OrderRow, status: OrderStatus) {
    setSaving(true)
    const patch: OrderUpdate = { order_status: status }
    if (status === 'confirmed') patch.confirmed_at = new Date().toISOString()
    if (status === 'shipped') patch.shipped_at = new Date().toISOString()
    if (status === 'delivered') patch.delivered_at = new Date().toISOString()
    if (status === 'completed') patch.completed_at = new Date().toISOString()

    const { error: patchError } = await supabase.from('orders').update(patch).eq('id', order.id)
    if (patchError) {
      setError(patchError.message)
      toast.show('Unable to update order', { tone: 'danger', message: patchError.message })
    } else {
      await supabase.from('order_status_logs').insert({
        order_id: order.id,
        from_status: order.order_status,
        to_status: status,
        note: 'Admin updated parent order status',
        change_reason: 'admin_action',
        system_generated: false,
        change_metadata: {} as Json,
      })
      await refreshSelected()
    }
    setSaving(false)
  }

  async function deleteItem(item: OrderItemRow) {
    setSaving(true)
    const { error: deleteError } = await supabase.from('order_items').delete().eq('id', item.id)
    if (deleteError) {
      setError(deleteError.message)
      toast.show('Unable to delete order item', { tone: 'danger', message: deleteError.message })
    } else {
      setItems((current) => current.filter((row) => row.id !== item.id))
      setDetailsOpen(false)
      setSelectedItemId(null)
      toast.show('Order item deleted', { tone: 'success' })
    }
    setSaving(false)
  }

  async function submitPayment() {
    if (!selectedItem) return
    setSaving(true)
    const payload: OrderPaymentInsert = {
      order_id: selectedItem.order_id,
      amount: toNumber(paymentForm.amount, 0),
      payment_mode: paymentForm.payment_mode,
      payment_status: paymentForm.payment_status,
      transaction_id: nullableText(paymentForm.transaction_id),
      payment_gateway: nullableText(paymentForm.payment_gateway),
      failure_reason: nullableText(paymentForm.failure_reason),
      processed_at: paymentForm.payment_status === 'completed' ? new Date().toISOString() : null,
      payment_metadata: parseJson(paymentForm.metadataText, {}) as Json,
    }
    const { error: insertError } = await supabase.from('order_payments').insert(payload)
    if (insertError) {
      setError(insertError.message)
      toast.show('Unable to create payment', { tone: 'danger', message: insertError.message })
    } else {
      setPaymentFormOpen(false)
      setPaymentForm(EMPTY_PAYMENT_FORM)
      await refreshSelected()
    }
    setSaving(false)
  }

  async function updatePaymentStatus(payment: OrderPaymentRow, status: PaymentStatus) {
    const patch: OrderPaymentUpdate = { payment_status: status }
    if (status === 'completed') patch.processed_at = new Date().toISOString()
    await simpleUpdate('order_payments', payment.id, patch, 'payment')
    await refreshSelected()
  }

  async function deletePayment(payment: OrderPaymentRow) {
    await simpleDelete('order_payments', payment.id, 'payment')
    await refreshSelected()
  }

  async function submitFulfillment() {
    if (!selectedItem) return
    setSaving(true)
    const payload: FulfillmentInsert = {
      order_item_id: selectedItem.id,
      fulfilled_by: fulfillmentForm.fulfilled_by.trim() || selectedItem.vendor_id,
      fulfillment_number: fulfillmentForm.fulfillment_number.trim() || `FUL-${Date.now()}`,
      quantity_to_fulfill: toNumber(fulfillmentForm.quantity_to_fulfill, selectedItem.quantity),
      fulfillment_status: fulfillmentForm.fulfillment_status,
      carrier_name: nullableText(fulfillmentForm.carrier_name),
      carrier_code: nullableText(fulfillmentForm.carrier_code),
      tracking_number: nullableText(fulfillmentForm.tracking_number),
      estimated_ship_date: nullableText(fulfillmentForm.estimated_ship_date),
      estimated_delivery_date: nullableText(fulfillmentForm.estimated_delivery_date),
      shipping_cost: toNullableNumber(fulfillmentForm.shipping_cost),
      package_weight_grams: toNullableNumber(fulfillmentForm.package_weight_grams),
      fulfillment_notes: nullableText(fulfillmentForm.notes),
      fulfillment_metadata: {} as Json,
    }
    const { data, error: insertError } = await supabase.from('order_fulfillments').insert(payload).select('*').single()
    if (insertError) {
      setError(insertError.message)
      toast.show('Unable to create fulfillment', { tone: 'danger', message: insertError.message })
    } else {
      await supabase.from('fulfillment_events').insert({
        fulfillment_id: (data as FulfillmentRow).id,
        event_type: 'status_change',
        event_description: 'Admin created fulfillment',
        event_timestamp: new Date().toISOString(),
        new_status: fulfillmentForm.fulfillment_status,
        source_system: 'admin',
        event_data: {} as Json,
      })
      setFulfillmentFormOpen(false)
      setFulfillmentForm(EMPTY_FULFILLMENT_FORM)
      await refreshSelected()
    }
    setSaving(false)
  }

  async function updateFulfillmentStatus(fulfillment: FulfillmentRow, status: FulfillmentStatus) {
    const patch: FulfillmentUpdate = { fulfillment_status: status }
    if (status === 'shipped') patch.shipped_at = new Date().toISOString()
    if (status === 'delivered') patch.delivered_at = new Date().toISOString()
    await simpleUpdate('order_fulfillments', fulfillment.id, patch, 'fulfillment')
    await supabase.from('fulfillment_events').insert({
      fulfillment_id: fulfillment.id,
      event_type: 'status_change',
      event_description: `Admin changed status to ${formatLabel(status)}`,
      event_timestamp: new Date().toISOString(),
      previous_status: fulfillment.fulfillment_status,
      new_status: status,
      source_system: 'admin',
      event_data: {} as Json,
    })
    await refreshSelected()
  }

  async function deleteFulfillment(fulfillment: FulfillmentRow) {
    await simpleDelete('order_fulfillments', fulfillment.id, 'fulfillment')
    await refreshSelected()
  }

  async function submitIssue() {
    if (!selectedItem) return
    const bundle = bundlesByItemId[selectedItem.id] ?? EMPTY_BUNDLE
    if (!bundle.order) return
    setSaving(true)
    const payload: OrderIssueInsert = {
      order_id: selectedItem.order_id,
      order_item_id: selectedItem.id,
      reported_by: bundle.order.user_id,
      issue_title: issueForm.issue_title.trim(),
      description: issueForm.description.trim(),
      issue_type: issueForm.issue_type,
      issue_priority: issueForm.issue_priority,
      status: issueForm.status,
      resolution_note: nullableText(issueForm.resolution_note),
    }
    const { error: insertError } = await supabase.from('order_issues').insert(payload)
    if (insertError) {
      setError(insertError.message)
      toast.show('Unable to create issue', { tone: 'danger', message: insertError.message })
    } else {
      setIssueFormOpen(false)
      setIssueForm(EMPTY_ISSUE_FORM)
      await refreshSelected()
    }
    setSaving(false)
  }

  async function updateIssueStatus(issue: OrderIssueRow, status: string) {
    const patch: OrderIssueUpdate = { status }
    if (status === 'resolved') patch.resolved_at = new Date().toISOString()
    if (status === 'closed') patch.closed_at = new Date().toISOString()
    await simpleUpdate('order_issues', issue.id, patch, 'issue')
    await refreshSelected()
  }

  async function deleteIssue(issue: OrderIssueRow) {
    await simpleDelete('order_issues', issue.id, 'issue')
    await refreshSelected()
  }

  async function simpleUpdate(table: 'order_payments' | 'order_fulfillments' | 'order_issues', id: string, patch: object, label: string) {
    setSaving(true)
    const { error: updateError } = await supabase.from(table).update(patch).eq('id', id)
    if (updateError) {
      setError(updateError.message)
      toast.show(`Unable to update ${label}`, { tone: 'danger', message: updateError.message })
    }
    setSaving(false)
  }

  async function simpleDelete(table: 'order_payments' | 'order_fulfillments' | 'order_issues', id: string, label: string) {
    setSaving(true)
    const { error: deleteError } = await supabase.from(table).delete().eq('id', id)
    if (deleteError) {
      setError(deleteError.message)
      toast.show(`Unable to delete ${label}`, { tone: 'danger', message: deleteError.message })
    }
    setSaving(false)
  }

  const stats = getStats(items, totalItems)

  return (
    <YStack width="100%" gap="$4" paddingHorizontal={isDesktop ? '$6' : '$4'} paddingTop="$5" paddingBottom={safeBottom + 28}>
      <AdminOrdersHeader stats={stats} onCreate={openCreateItem} />

      {error ? (
        <YStack padding="$3" borderRadius={radius.card} backgroundColor="$red3" borderWidth={1} borderColor="$red7">
          <Text color="$red11" fontWeight="700">{error}</Text>
        </YStack>
      ) : null}

      <OrderFilters
        search={search}
        statusFilter={statusFilter}
        onSearchChange={setSearch}
        onStatusChange={setStatusFilter}
      />

      <OrderItemList
        items={items}
        bundles={bundlesByItemId}
        selectedItemId={selectedItem?.id ?? null}
        loading={loading}
        hasMore={hasMore}
        total={totalItems}
        onSelect={openDetails}
        onLoadMore={() => void loadItems({ reset: false })}
      />

      <OrderDetailsDialog
        open={detailsOpen}
        item={selectedItem}
        bundle={selectedBundle}
        busy={saving}
        onOpenChange={setDetailsOpen}
        onEdit={() => selectedItem && openEditItem(selectedItem)}
        onDelete={() => selectedItem && deleteItem(selectedItem)}
        onSetItemStatus={(status) => selectedItem && patchItemStatus(selectedItem, status)}
        onSetOrderStatus={(status) => selectedBundle.order && patchParentOrderStatus(selectedBundle.order, status)}
        onOpenProduct={() => selectedBundle.listing && router.push(commerceRoutes.listing(selectedBundle.listing.slug ?? selectedBundle.listing.id))}
        onOpenShop={() => selectedBundle.shop && router.push(commerceRoutes.shop(selectedBundle.shop.slug ?? selectedBundle.shop.id))}
        onCreatePayment={() => setPaymentFormOpen(true)}
        onUpdatePaymentStatus={updatePaymentStatus}
        onDeletePayment={deletePayment}
        onCreateFulfillment={() => setFulfillmentFormOpen(true)}
        onUpdateFulfillmentStatus={updateFulfillmentStatus}
        onDeleteFulfillment={deleteFulfillment}
        onCreateIssue={() => setIssueFormOpen(true)}
        onUpdateIssueStatus={updateIssueStatus}
        onDeleteIssue={deleteIssue}
      />

      <OrderItemEditorDialog
        open={itemFormOpen}
        mode={itemFormMode}
        form={itemForm}
        busy={saving}
        onOpenChange={setItemFormOpen}
        onChange={(patch) => setItemForm((current) => ({ ...current, ...patch }))}
        onSubmit={submitItem}
      />

      <PaymentDialog
        open={paymentFormOpen}
        form={paymentForm}
        busy={saving}
        onOpenChange={setPaymentFormOpen}
        onChange={(patch) => setPaymentForm((current) => ({ ...current, ...patch }))}
        onSubmit={submitPayment}
      />

      <FulfillmentDialog
        open={fulfillmentFormOpen}
        form={fulfillmentForm}
        busy={saving}
        onOpenChange={setFulfillmentFormOpen}
        onChange={(patch) => setFulfillmentForm((current) => ({ ...current, ...patch }))}
        onSubmit={submitFulfillment}
      />

      <IssueDialog
        open={issueFormOpen}
        form={issueForm}
        busy={saving}
        onOpenChange={setIssueFormOpen}
        onChange={(patch) => setIssueForm((current) => ({ ...current, ...patch }))}
        onSubmit={submitIssue}
      />
    </YStack>
  )
}

function AdminOrdersHeader({ stats, onCreate }: { stats: OrderStats; onCreate: () => void }) {
  return (
    <YStack gap="$3">
      <XStack alignItems="center" justifyContent="space-between" gap="$3" flexWrap="wrap">
        <YStack gap="$1">
          <Text fontSize={26} fontWeight="800" color="$color12">Order Management</Text>
          <Text color="$color10">Manage platform order items, buyers, vendors, products, payments, fulfillments, and disputes.</Text>
        </YStack>
        <Button icon={Icons.Plus} onPress={onCreate}>Create order item</Button>
      </XStack>
      <XStack gap="$3" flexWrap="wrap">
        {[
          { label: 'Total items', value: stats.total, tone: 'info' as const },
          { label: 'Pending', value: stats.pending, tone: 'warning' as const },
          { label: 'Shipped', value: stats.shipped, tone: 'brand' as const },
          { label: 'Delivered', value: stats.delivered, tone: 'success' as const },
        ].map((stat) => (
          <YStack key={stat.label} minWidth={150} flex={1} padding="$3" borderRadius={radius.card} borderWidth={1} borderColor="$borderColor" backgroundColor="$background" style={getShadowStyle('sm')}>
            <Badge tone={stat.tone}>{stat.label}</Badge>
            <Text marginTop="$2" fontSize={24} fontWeight="800" color="$color12">{stat.value}</Text>
          </YStack>
        ))}
      </XStack>
    </YStack>
  )
}

function OrderFilters({
  search,
  statusFilter,
  onSearchChange,
  onStatusChange,
}: {
  search: string
  statusFilter: StatusFilter
  onSearchChange: (value: string) => void
  onStatusChange: (value: StatusFilter) => void
}) {
  function reset() {
    onSearchChange('')
    onStatusChange('all')
  }

  return (
    <YStack gap="$4" padding="$4" borderRadius={radius.card} borderWidth={1} borderColor="$borderColor" backgroundColor="$background" style={getShadowStyle('sm')}>
      <XStack alignItems="center" justifyContent="space-between" gap="$3" flexWrap="wrap">
        <XStack alignItems="center" gap="$2">
          <YStack width={34} height={34} borderRadius={999} alignItems="center" justifyContent="center" backgroundColor="$color2">
            <Icons.SlidersHorizontal size={16} color="$color10" />
          </YStack>
          <YStack>
            <Text fontWeight="800" color="$color12">Filter orders</Text>
            <Text fontSize={12} color="$color10">Search by product title, SKU, or description.</Text>
          </YStack>
        </XStack>
        <Button tone="ghost" size="$3" onPress={reset} disabled={!search && statusFilter === 'all'}>Reset</Button>
      </XStack>
      <XStack gap="$3" flexWrap="wrap" alignItems="flex-end">
        <Field label="Search">
          <Input minWidth={260} value={search} onChangeText={onSearchChange} placeholder="Product, SKU, description" />
        </Field>
        <Field label="Status">
          <FilterSelect value={statusFilter} options={orderStatusOptions('All statuses')} placeholder="Status" onValueChange={(value) => onStatusChange(value as StatusFilter)} />
        </Field>
      </XStack>
    </YStack>
  )
}

function OrderItemList({
  items,
  bundles,
  selectedItemId,
  loading,
  hasMore,
  total,
  onSelect,
  onLoadMore,
}: {
  items: OrderItemRow[]
  bundles: Record<string, OrderBundle>
  selectedItemId: string | null
  loading: boolean
  hasMore: boolean
  total: number
  onSelect: (item: OrderItemRow) => void
  onLoadMore: () => void
}) {
  if (loading && items.length === 0) {
    return (
      <YStack minHeight={260} alignItems="center" justifyContent="center">
        <Spinner size="large" />
        <Text marginTop="$2" color="$color10">Loading orders...</Text>
      </YStack>
    )
  }

  if (!items.length) {
    return <EmptyPanel title="No orders found" description="Try changing filters or create an order item." />
  }

  return (
    <YStack gap="$3">
      <XStack justifyContent="space-between" alignItems="center">
        <Text fontWeight="800" color="$color12">All order items</Text>
        <Text color="$color10">{items.length} of {total}</Text>
      </XStack>
      {items.map((item) => (
        <OrderItemRowView
          key={item.id}
          item={item}
          bundle={bundles[item.id] ?? EMPTY_BUNDLE}
          active={item.id === selectedItemId}
          onPress={() => onSelect(item)}
        />
      ))}
      {hasMore ? (
        <Button tone="outline" onPress={onLoadMore} disabled={loading}>{loading ? 'Loading...' : 'Load more orders'}</Button>
      ) : (
        <Text textAlign="center" color="$color10">End of order list</Text>
      )}
    </YStack>
  )
}

function OrderItemRowView({ item, bundle, active, onPress }: { item: OrderItemRow; bundle: OrderBundle; active: boolean; onPress: () => void }) {
  return (
    <XStack gap="$3" padding="$3" borderRadius={radius.card} borderWidth={1} borderColor={active ? '$color9' : '$borderColor'} backgroundColor={active ? '$color2' : '$background'} cursor="pointer" animation="quick" hoverStyle={{ borderColor: '$color8' }} onPress={onPress} style={getShadowStyle('sm')}>
      <ProductThumb image={bundle.image} size={58} />
      <YStack flex={1} minWidth={0} gap="$1">
        <XStack gap="$2" alignItems="center" flexWrap="wrap">
          <Text fontWeight="800" color="$color12" numberOfLines={1}>{item.product_title}</Text>
          <Badge tone={statusTone(item.item_status)} size="sm">{formatLabel(item.item_status)}</Badge>
          {bundle.order ? <Badge tone="neutral" size="sm">{bundle.order.order_number}</Badge> : null}
        </XStack>
        <Text color="$color10" numberOfLines={1}>
          Buyer: {bundle.customer ? displayPerson(bundle.customer) : item.order_id} • Shop: {bundle.shop?.shop_name ?? item.vendor_id}
        </Text>
        <Text color="$color10" fontSize={12}>
          Qty {item.quantity} • {formatMoney(item.total_price, bundle.order?.currency)} • {formatDate(item.created_at)}
        </Text>
      </YStack>
      <Icons.ChevronRight size={18} color="$color10" />
    </XStack>
  )
}

function OrderDetailsDialog({
  open,
  item,
  bundle,
  busy,
  onOpenChange,
  onEdit,
  onDelete,
  onSetItemStatus,
  onSetOrderStatus,
  onOpenProduct,
  onOpenShop,
  onCreatePayment,
  onUpdatePaymentStatus,
  onDeletePayment,
  onCreateFulfillment,
  onUpdateFulfillmentStatus,
  onDeleteFulfillment,
  onCreateIssue,
  onUpdateIssueStatus,
  onDeleteIssue,
}: {
  open: boolean
  item: OrderItemRow | null
  bundle: OrderBundle
  busy: boolean
  onOpenChange: (open: boolean) => void
  onEdit: () => void
  onDelete: () => void
  onSetItemStatus: (status: OrderStatus) => void
  onSetOrderStatus: (status: OrderStatus) => void
  onOpenProduct: () => void
  onOpenShop: () => void
  onCreatePayment: () => void
  onUpdatePaymentStatus: (payment: OrderPaymentRow, status: PaymentStatus) => void
  onDeletePayment: (payment: OrderPaymentRow) => void
  onCreateFulfillment: () => void
  onUpdateFulfillmentStatus: (fulfillment: FulfillmentRow, status: FulfillmentStatus) => void
  onDeleteFulfillment: (fulfillment: FulfillmentRow) => void
  onCreateIssue: () => void
  onUpdateIssueStatus: (issue: OrderIssueRow, status: string) => void
  onDeleteIssue: (issue: OrderIssueRow) => void
}) {
  return (
    <Dialog modal open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <DialogOverlay />
        <DialogContent maxWidth={1100} maxHeight="92vh" width="94%" padding={0} overflow="hidden">
          <YStack padding="$5" paddingTop="$6" paddingRight="$10" gap="$3" backgroundColor="$color2" borderBottomWidth={1} borderBottomColor="$borderColor">
            <YStack gap="$1">
              <DialogTitle>{item?.product_title ?? 'Order details'}</DialogTitle>
              <DialogDescription>Full buyer, product, vendor, payment, fulfillment, issue, and audit information.</DialogDescription>
            </YStack>
          </YStack>
          <ScrollView maxHeight="74vh" showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 20 }}>
            {item ? (
              <OrderDetailsPanel
                item={item}
                bundle={bundle}
                busy={busy}
                onEdit={onEdit}
                onDelete={onDelete}
                onSetItemStatus={onSetItemStatus}
                onSetOrderStatus={onSetOrderStatus}
                onOpenProduct={onOpenProduct}
                onOpenShop={onOpenShop}
                onCreatePayment={onCreatePayment}
                onUpdatePaymentStatus={onUpdatePaymentStatus}
                onDeletePayment={onDeletePayment}
                onCreateFulfillment={onCreateFulfillment}
                onUpdateFulfillmentStatus={onUpdateFulfillmentStatus}
                onDeleteFulfillment={onDeleteFulfillment}
                onCreateIssue={onCreateIssue}
                onUpdateIssueStatus={onUpdateIssueStatus}
                onDeleteIssue={onDeleteIssue}
              />
            ) : (
              <EmptyPanel title="No order selected" description="Select an order item to view details." />
            )}
          </ScrollView>
        </DialogContent>
      </Dialog.Portal>
    </Dialog>
  )
}

function OrderDetailsPanel({
  item,
  bundle,
  busy,
  onEdit,
  onDelete,
  onSetItemStatus,
  onSetOrderStatus,
  onOpenProduct,
  onOpenShop,
  onCreatePayment,
  onUpdatePaymentStatus,
  onDeletePayment,
  onCreateFulfillment,
  onUpdateFulfillmentStatus,
  onDeleteFulfillment,
  onCreateIssue,
  onUpdateIssueStatus,
  onDeleteIssue,
}: {
  item: OrderItemRow
  bundle: OrderBundle
  busy: boolean
  onEdit: () => void
  onDelete: () => void
  onSetItemStatus: (status: OrderStatus) => void
  onSetOrderStatus: (status: OrderStatus) => void
  onOpenProduct: () => void
  onOpenShop: () => void
  onCreatePayment: () => void
  onUpdatePaymentStatus: (payment: OrderPaymentRow, status: PaymentStatus) => void
  onDeletePayment: (payment: OrderPaymentRow) => void
  onCreateFulfillment: () => void
  onUpdateFulfillmentStatus: (fulfillment: FulfillmentRow, status: FulfillmentStatus) => void
  onDeleteFulfillment: (fulfillment: FulfillmentRow) => void
  onCreateIssue: () => void
  onUpdateIssueStatus: (issue: OrderIssueRow, status: string) => void
  onDeleteIssue: (issue: OrderIssueRow) => void
}) {
  return (
    <YStack gap="$4">
      <XStack gap="$3" alignItems="center" padding="$4" borderRadius={radius.card} borderWidth={1} borderColor="$borderColor" backgroundColor="$background" style={getShadowStyle('sm')}>
        <ProductThumb image={bundle.image} size={82} />
        <YStack flex={1} minWidth={0}>
          <Text fontSize={22} fontWeight="800" color="$color12" numberOfLines={1}>{item.product_title}</Text>
          <Text color="$color10" numberOfLines={1}>{bundle.order?.order_number ?? item.order_id} • {bundle.shop?.shop_name ?? item.vendor_id}</Text>
          <XStack gap="$2" marginTop="$2" flexWrap="wrap">
            <Badge tone={statusTone(item.item_status)}>{formatLabel(item.item_status)}</Badge>
            {bundle.order ? <Badge tone={statusTone(bundle.order.order_status)}>Order {formatLabel(bundle.order.order_status)}</Badge> : null}
            <Badge tone="info">{formatMoney(item.total_price, bundle.order?.currency)}</Badge>
          </XStack>
        </YStack>
      </XStack>

      <XStack gap="$2" flexWrap="wrap" padding="$3" borderRadius={radius.card} backgroundColor="$color2" borderWidth={1} borderColor="$borderColor">
        <Button size="$3" tone="outline" icon={Icons.ExternalLink} onPress={onOpenProduct} disabled={busy || !bundle.listing}>Open product</Button>
        <Button size="$3" tone="outline" icon={Icons.Store} onPress={onOpenShop} disabled={busy || !bundle.shop}>Open shop</Button>
        <Button size="$3" tone="outline" icon={Icons.Pencil} onPress={onEdit} disabled={busy}>Edit item</Button>
        <FilterSelect value={item.item_status} options={orderStatusOptions()} placeholder="Item status" onValueChange={(value) => onSetItemStatus(value as OrderStatus)} />
        {bundle.order ? (
          <FilterSelect value={bundle.order.order_status} options={orderStatusOptions()} placeholder="Order status" onValueChange={(value) => onSetOrderStatus(value as OrderStatus)} />
        ) : null}
        <ConfirmDialog
          title="Delete order item?"
          description="This permanently deletes this order item row. Use carefully."
          confirmLabel="Delete item"
          destructive
          onConfirm={onDelete}
          trigger={<Button size="$3" tone="destructive" icon={Icons.Trash2} disabled={busy}>Delete item</Button>}
        />
      </XStack>

      <DetailSection title="Buyer, vendor and product">
        <XStack gap="$3" flexWrap="wrap" marginBottom="$2">
          <IdentityCard title={bundle.customer ? displayPerson(bundle.customer) : 'Unknown buyer'} subtitle={bundle.customer?.email ?? bundle.customer?.phone ?? item.order_id} imageUrl={bundle.customer?.avatar_url ?? null} icon="user" />
          <IdentityCard title={bundle.shop?.shop_name ?? 'Unknown shop'} subtitle={bundle.owner ? displayPerson(bundle.owner) : item.vendor_id} imageUrl={bundle.shop?.logo_url ?? bundle.owner?.avatar_url ?? null} icon="shop" />
        </XStack>
        <DetailRow label="Buyer id" value={bundle.order?.user_id ?? 'Not loaded'} />
        <DetailRow label="Buyer email" value={bundle.customer?.email ?? 'Not set'} />
        <DetailRow label="Buyer phone" value={bundle.customer?.phone ?? 'Not set'} />
        <DetailRow label="Vendor shop" value={bundle.shop?.shop_name ?? item.vendor_id} />
        <DetailRow label="Vendor owner" value={bundle.owner ? displayPerson(bundle.owner) : 'Not loaded'} />
        <DetailRow label="Listing id" value={item.listing_id} />
        <DetailRow label="SKU" value={item.product_sku ?? 'Not set'} />
        <DetailRow label="Variation" value={formatJson(item.variation_details)} />
      </DetailSection>

      <DetailSection title="Order totals and addresses">
        <DetailRow label="Order number" value={bundle.order?.order_number ?? 'Not loaded'} />
        <DetailRow label="Order source" value={bundle.order?.order_source ?? 'Not set'} />
        <DetailRow label="Unit price" value={formatMoney(item.unit_price, bundle.order?.currency)} />
        <DetailRow label="Quantity" value={item.quantity} />
        <DetailRow label="Item discount" value={formatMoney(item.item_discount_amount ?? 0, bundle.order?.currency)} />
        <DetailRow label="Item total" value={formatMoney(item.total_price, bundle.order?.currency)} />
        <DetailRow label="Order subtotal" value={formatMoney(bundle.order?.subtotal_amount ?? 0, bundle.order?.currency)} />
        <DetailRow label="Shipping" value={formatMoney(bundle.order?.shipping_amount ?? 0, bundle.order?.currency)} />
        <DetailRow label="Tax" value={formatMoney(bundle.order?.tax_amount ?? 0, bundle.order?.currency)} />
        <DetailRow label="Order total" value={formatMoney(bundle.order?.total_amount ?? 0, bundle.order?.currency)} />
        <DetailRow label="Shipping address" value={formatAddress(bundle.shippingAddress)} />
        <DetailRow label="Billing address" value={formatAddress(bundle.billingAddress)} />
        <DetailRow label="Customer notes" value={bundle.order?.customer_notes ?? 'None'} />
        <DetailRow label="Special instructions" value={bundle.order?.special_instructions ?? 'None'} />
      </DetailSection>

      <DetailSection title="Payments">
        <Button alignSelf="flex-start" size="$3" icon={Icons.Plus} onPress={onCreatePayment} disabled={busy}>Add payment</Button>
        {bundle.payments.length ? bundle.payments.map((payment) => (
          <YStack key={payment.id} gap="$2" padding="$3" borderRadius={radius.card} borderWidth={1} borderColor="$borderColor" backgroundColor="$color2">
            <DetailRow label={`${formatLabel(payment.payment_mode)} payment`} value={`${formatMoney(payment.amount, bundle.order?.currency)} • ${formatLabel(payment.payment_status)}`} />
            <DetailRow label="Transaction" value={payment.transaction_id ?? payment.gateway_transaction_id ?? 'Not set'} />
            <DetailRow label="Gateway" value={payment.payment_gateway ?? 'Not set'} />
            <XStack gap="$2" flexWrap="wrap">
              <FilterSelect value={payment.payment_status} options={paymentStatusOptions()} placeholder="Payment status" onValueChange={(value) => onUpdatePaymentStatus(payment, value as PaymentStatus)} />
              <Button size="$3" tone="destructive" onPress={() => onDeletePayment(payment)} disabled={busy}>Delete payment</Button>
            </XStack>
          </YStack>
        )) : <Text color="$color10">No payments recorded.</Text>}
      </DetailSection>

      <DetailSection title="Fulfillment and logistics">
        <Button alignSelf="flex-start" size="$3" icon={Icons.Plus} onPress={onCreateFulfillment} disabled={busy}>Add fulfillment</Button>
        {bundle.fulfillments.length ? bundle.fulfillments.map((fulfillment) => (
          <YStack key={fulfillment.id} gap="$2" padding="$3" borderRadius={radius.card} borderWidth={1} borderColor="$borderColor" backgroundColor="$color2">
            <DetailRow label={fulfillment.fulfillment_number} value={`${formatLabel(fulfillment.fulfillment_status)} • Qty ${fulfillment.quantity_to_fulfill}`} />
            <DetailRow label="Carrier" value={fulfillment.carrier_name ?? fulfillment.carrier_code ?? 'Not set'} />
            <DetailRow label="Tracking" value={fulfillment.tracking_number ?? fulfillment.master_tracking_number ?? 'Not set'} />
            <DetailRow label="Estimated delivery" value={formatDate(fulfillment.estimated_delivery_date)} />
            <XStack gap="$2" flexWrap="wrap">
              <FilterSelect value={fulfillment.fulfillment_status} options={fulfillmentStatusOptions()} placeholder="Fulfillment status" onValueChange={(value) => onUpdateFulfillmentStatus(fulfillment, value as FulfillmentStatus)} />
              <Button size="$3" tone="destructive" onPress={() => onDeleteFulfillment(fulfillment)} disabled={busy}>Delete fulfillment</Button>
            </XStack>
          </YStack>
        )) : <Text color="$color10">No fulfillment records.</Text>}
        {bundle.fulfillmentEvents.length ? (
          <YStack gap="$2" marginTop="$2">
            <Text fontWeight="800" color="$color12">Fulfillment timeline</Text>
            {bundle.fulfillmentEvents.slice(0, 8).map((event) => (
              <DetailRow key={event.id} label={formatDate(event.event_timestamp)} value={`${formatLabel(event.event_type)} - ${event.event_description}`} />
            ))}
          </YStack>
        ) : null}
      </DetailSection>

      <DetailSection title="Issues and disputes">
        <Button alignSelf="flex-start" size="$3" icon={Icons.Plus} onPress={onCreateIssue} disabled={busy}>Add issue</Button>
        {bundle.issues.length ? bundle.issues.map((issue) => (
          <YStack key={issue.id} gap="$2" padding="$3" borderRadius={radius.card} borderWidth={1} borderColor="$borderColor" backgroundColor="$color2">
            <DetailRow label={issue.issue_title} value={`${formatLabel(issue.issue_type)} • ${formatLabel(issue.status ?? 'open')}`} />
            <DetailRow label="Priority" value={formatLabel(issue.issue_priority ?? 'normal')} />
            <DetailRow label="Description" value={issue.description} />
            <DetailRow label="Resolution" value={issue.resolution_note ?? 'Not resolved'} />
            <XStack gap="$2" flexWrap="wrap">
              <FilterSelect value={issue.status ?? 'open'} options={issueStatusOptions()} placeholder="Issue status" onValueChange={(value) => onUpdateIssueStatus(issue, value)} />
              <Button size="$3" tone="destructive" onPress={() => onDeleteIssue(issue)} disabled={busy}>Delete issue</Button>
            </XStack>
          </YStack>
        )) : <Text color="$color10">No issues reported.</Text>}
      </DetailSection>

      <DetailSection title="Status audit log">
        {bundle.logs.length ? bundle.logs.map((log) => (
          <DetailRow key={log.id} label={formatDate(log.changed_at)} value={`${formatLabel(log.from_status ?? 'none')} -> ${formatLabel(log.to_status)}${log.note ? `: ${log.note}` : ''}`} />
        )) : <Text color="$color10">No status logs.</Text>}
      </DetailSection>
    </YStack>
  )
}

function OrderItemEditorDialog({
  open,
  mode,
  form,
  busy,
  onOpenChange,
  onChange,
  onSubmit,
}: {
  open: boolean
  mode: 'create' | 'edit'
  form: OrderItemForm
  busy: boolean
  onOpenChange: (open: boolean) => void
  onChange: (patch: Partial<OrderItemForm>) => void
  onSubmit: () => void
}) {
  return (
    <Dialog modal open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <DialogOverlay />
        <DialogContent maxWidth={820} maxHeight="90vh" width="92%">
          <DialogTitle>{mode === 'create' ? 'Create order item' : 'Edit order item'}</DialogTitle>
          <DialogDescription>Directly edits the order_items row. Use existing order, listing, and vendor/shop IDs.</DialogDescription>
          <ScrollView maxHeight="68vh" showsVerticalScrollIndicator={false}>
            <YStack gap="$3" paddingRight="$1">
              <Field label="Order id" required><Input value={form.order_id} onChangeText={(order_id) => onChange({ order_id })} /></Field>
              <XStack gap="$3" flexWrap="wrap">
                <YStack flex={1} minWidth={220}><Field label="Listing id" required><Input value={form.listing_id} onChangeText={(listing_id) => onChange({ listing_id })} /></Field></YStack>
                <YStack flex={1} minWidth={220}><Field label="Vendor shop id" required><Input value={form.vendor_id} onChangeText={(vendor_id) => onChange({ vendor_id })} /></Field></YStack>
              </XStack>
              <Field label="Product title" required><Input value={form.product_title} onChangeText={(product_title) => onChange({ product_title })} /></Field>
              <Field label="Product description"><TextArea value={form.product_description} onChangeText={(product_description) => onChange({ product_description })} /></Field>
              <XStack gap="$3" flexWrap="wrap">
                <YStack flex={1} minWidth={160}><Field label="SKU"><Input value={form.product_sku} onChangeText={(product_sku) => onChange({ product_sku })} /></Field></YStack>
                <YStack flex={1} minWidth={140}><Field label="Quantity"><Input value={form.quantity} keyboardType="number-pad" onChangeText={(quantity) => onChange({ quantity })} /></Field></YStack>
                <YStack flex={1} minWidth={160}><Field label="Status"><FilterSelect value={form.item_status} options={orderStatusOptions()} placeholder="Status" onValueChange={(item_status) => onChange({ item_status: item_status as OrderStatus })} /></Field></YStack>
              </XStack>
              <XStack gap="$3" flexWrap="wrap">
                <YStack flex={1} minWidth={160}><Field label="Unit price"><Input value={form.unit_price} keyboardType="decimal-pad" onChangeText={(unit_price) => onChange({ unit_price })} /></Field></YStack>
                <YStack flex={1} minWidth={160}><Field label="Total price"><Input value={form.total_price} keyboardType="decimal-pad" onChangeText={(total_price) => onChange({ total_price })} /></Field></YStack>
                <YStack flex={1} minWidth={160}><Field label="Discount"><Input value={form.item_discount_amount} keyboardType="decimal-pad" onChangeText={(item_discount_amount) => onChange({ item_discount_amount })} /></Field></YStack>
              </XStack>
              <Field label="Digital download URL"><Input value={form.digital_download_url} onChangeText={(digital_download_url) => onChange({ digital_download_url })} /></Field>
              <Field label="Download expires at"><Input value={form.download_expires_at} onChangeText={(download_expires_at) => onChange({ download_expires_at })} placeholder="YYYY-MM-DD or ISO timestamp" /></Field>
              <Field label="Variation JSON"><TextArea value={form.variationDetailsText} onChangeText={(variationDetailsText) => onChange({ variationDetailsText })} /></Field>
            </YStack>
          </ScrollView>
          <XStack gap="$2" justifyContent="flex-end" flexWrap="wrap">
            <Button tone="outline" onPress={() => onOpenChange(false)} disabled={busy}>Cancel</Button>
            <Button onPress={onSubmit} disabled={busy || !form.order_id.trim() || !form.product_title.trim()}>{busy ? 'Saving...' : 'Save item'}</Button>
          </XStack>
        </DialogContent>
      </Dialog.Portal>
    </Dialog>
  )
}

function PaymentDialog({ open, form, busy, onOpenChange, onChange, onSubmit }: { open: boolean; form: PaymentForm; busy: boolean; onOpenChange: (open: boolean) => void; onChange: (patch: Partial<PaymentForm>) => void; onSubmit: () => void }) {
  return (
    <SmallFormDialog open={open} title="Add payment" description="Create an order_payments row." busy={busy} onOpenChange={onOpenChange} onSubmit={onSubmit}>
      <Field label="Amount"><Input value={form.amount} keyboardType="decimal-pad" onChangeText={(amount) => onChange({ amount })} /></Field>
      <XStack gap="$3" flexWrap="wrap">
        <Field label="Mode"><FilterSelect value={form.payment_mode} options={paymentModeOptions()} placeholder="Mode" onValueChange={(payment_mode) => onChange({ payment_mode: payment_mode as PaymentMode })} /></Field>
        <Field label="Status"><FilterSelect value={form.payment_status} options={paymentStatusOptions()} placeholder="Status" onValueChange={(payment_status) => onChange({ payment_status: payment_status as PaymentStatus })} /></Field>
      </XStack>
      <Field label="Transaction id"><Input value={form.transaction_id} onChangeText={(transaction_id) => onChange({ transaction_id })} /></Field>
      <Field label="Gateway"><Input value={form.payment_gateway} onChangeText={(payment_gateway) => onChange({ payment_gateway })} /></Field>
      <Field label="Failure reason"><Input value={form.failure_reason} onChangeText={(failure_reason) => onChange({ failure_reason })} /></Field>
      <Field label="Metadata JSON"><TextArea value={form.metadataText} onChangeText={(metadataText) => onChange({ metadataText })} /></Field>
    </SmallFormDialog>
  )
}

function FulfillmentDialog({ open, form, busy, onOpenChange, onChange, onSubmit }: { open: boolean; form: FulfillmentForm; busy: boolean; onOpenChange: (open: boolean) => void; onChange: (patch: Partial<FulfillmentForm>) => void; onSubmit: () => void }) {
  return (
    <SmallFormDialog open={open} title="Add fulfillment" description="Create an order_fulfillments row and an initial event." busy={busy} onOpenChange={onOpenChange} onSubmit={onSubmit}>
      <Field label="Fulfillment number"><Input value={form.fulfillment_number} onChangeText={(fulfillment_number) => onChange({ fulfillment_number })} placeholder="Auto if blank" /></Field>
      <Field label="Fulfilled by"><Input value={form.fulfilled_by} onChangeText={(fulfilled_by) => onChange({ fulfilled_by })} placeholder="Shop/user id" /></Field>
      <XStack gap="$3" flexWrap="wrap">
        <Field label="Quantity"><Input value={form.quantity_to_fulfill} keyboardType="number-pad" onChangeText={(quantity_to_fulfill) => onChange({ quantity_to_fulfill })} /></Field>
        <Field label="Status"><FilterSelect value={form.fulfillment_status} options={fulfillmentStatusOptions()} placeholder="Status" onValueChange={(fulfillment_status) => onChange({ fulfillment_status: fulfillment_status as FulfillmentStatus })} /></Field>
      </XStack>
      <Field label="Carrier name"><Input value={form.carrier_name} onChangeText={(carrier_name) => onChange({ carrier_name })} /></Field>
      <Field label="Tracking number"><Input value={form.tracking_number} onChangeText={(tracking_number) => onChange({ tracking_number })} /></Field>
      <XStack gap="$3" flexWrap="wrap">
        <Field label="Estimated ship"><Input value={form.estimated_ship_date} onChangeText={(estimated_ship_date) => onChange({ estimated_ship_date })} /></Field>
        <Field label="Estimated delivery"><Input value={form.estimated_delivery_date} onChangeText={(estimated_delivery_date) => onChange({ estimated_delivery_date })} /></Field>
      </XStack>
      <Field label="Notes"><TextArea value={form.notes} onChangeText={(notes) => onChange({ notes })} /></Field>
    </SmallFormDialog>
  )
}

function IssueDialog({ open, form, busy, onOpenChange, onChange, onSubmit }: { open: boolean; form: IssueForm; busy: boolean; onOpenChange: (open: boolean) => void; onChange: (patch: Partial<IssueForm>) => void; onSubmit: () => void }) {
  return (
    <SmallFormDialog open={open} title="Add order issue" description="Create an order_issues row for this order item." busy={busy} onOpenChange={onOpenChange} onSubmit={onSubmit}>
      <Field label="Title"><Input value={form.issue_title} onChangeText={(issue_title) => onChange({ issue_title })} /></Field>
      <Field label="Description"><TextArea value={form.description} onChangeText={(description) => onChange({ description })} /></Field>
      <XStack gap="$3" flexWrap="wrap">
        <Field label="Type"><FilterSelect value={form.issue_type} options={issueTypeOptions()} placeholder="Type" onValueChange={(issue_type) => onChange({ issue_type })} /></Field>
        <Field label="Priority"><FilterSelect value={form.issue_priority} options={issuePriorityOptions()} placeholder="Priority" onValueChange={(issue_priority) => onChange({ issue_priority })} /></Field>
        <Field label="Status"><FilterSelect value={form.status} options={issueStatusOptions()} placeholder="Status" onValueChange={(status) => onChange({ status })} /></Field>
      </XStack>
      <Field label="Resolution note"><TextArea value={form.resolution_note} onChangeText={(resolution_note) => onChange({ resolution_note })} /></Field>
    </SmallFormDialog>
  )
}

function SmallFormDialog({ open, title, description, busy, children, onOpenChange, onSubmit }: { open: boolean; title: string; description: string; busy: boolean; children: ReactNode; onOpenChange: (open: boolean) => void; onSubmit: () => void }) {
  return (
    <Dialog modal open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <DialogOverlay />
        <DialogContent maxWidth={720} maxHeight="90vh" width="92%">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
          <ScrollView maxHeight="62vh" showsVerticalScrollIndicator={false}>
            <YStack gap="$3" paddingRight="$1">{children}</YStack>
          </ScrollView>
          <XStack gap="$2" justifyContent="flex-end" flexWrap="wrap">
            <Button tone="outline" onPress={() => onOpenChange(false)} disabled={busy}>Cancel</Button>
            <Button onPress={onSubmit} disabled={busy}>{busy ? 'Saving...' : 'Save'}</Button>
          </XStack>
        </DialogContent>
      </Dialog.Portal>
    </Dialog>
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

function IdentityCard({ title, subtitle, imageUrl, icon }: { title: string; subtitle: string; imageUrl: string | null; icon: 'user' | 'shop' }) {
  const Icon = icon === 'shop' ? Icons.Store : Icons.User
  return (
    <XStack flex={1} minWidth={240} gap="$3" alignItems="center" padding="$3" borderRadius={radius.card} borderWidth={1} borderColor="$borderColor" backgroundColor="$color2">
      {imageUrl ? (
        <Image src={imageUrl} alt={title} width={52} height={52} objectFit="cover" borderRadius={icon === 'user' ? 999 : radius.card} backgroundColor="$color3" />
      ) : (
        <YStack width={52} height={52} borderRadius={icon === 'user' ? 999 : radius.card} alignItems="center" justifyContent="center" backgroundColor="$color3">
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

function FilterSelect({ value, options, placeholder, onValueChange }: { value: string; options: { value: string; label: string }[]; placeholder: string; onValueChange: (value: string) => void }) {
  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger minWidth={170} iconAfter={<Icons.ChevronDown size={16} />}>
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

function EmptyPanel({ title, description }: { title: string; description: string }) {
  return (
    <YStack minHeight={220} alignItems="center" justifyContent="center" gap="$2" padding="$4" borderRadius={radius.card} borderWidth={1} borderColor="$borderColor" backgroundColor="$background">
      <Icons.ShoppingCart size={28} color="$color10" />
      <Text fontWeight="800" color="$color12">{title}</Text>
      <Text color="$color10" textAlign="center">{description}</Text>
    </YStack>
  )
}

type OrderStats = { total: number; pending: number; shipped: number; delivered: number }

function getStats(items: OrderItemRow[], total: number): OrderStats {
  return {
    total,
    pending: items.filter((item) => item.item_status === 'pending' || item.item_status === 'awaiting_payment').length,
    shipped: items.filter((item) => item.item_status === 'shipped' || item.item_status === 'in_transit').length,
    delivered: items.filter((item) => item.item_status === 'delivered' || item.item_status === 'completed').length,
  }
}

function itemToForm(item: OrderItemRow): OrderItemForm {
  return {
    order_id: item.order_id,
    listing_id: item.listing_id,
    vendor_id: item.vendor_id,
    product_title: item.product_title,
    product_description: item.product_description ?? '',
    product_sku: item.product_sku ?? '',
    quantity: String(item.quantity),
    unit_price: String(item.unit_price),
    total_price: String(item.total_price),
    item_discount_amount: item.item_discount_amount == null ? '' : String(item.item_discount_amount),
    item_status: item.item_status,
    digital_download_url: item.digital_download_url ?? '',
    download_expires_at: item.download_expires_at ?? '',
    variationDetailsText: formatJson(item.variation_details),
  }
}

function formToItemPayload(form: OrderItemForm): OrderItemInsert | OrderItemUpdate {
  return {
    order_id: form.order_id.trim(),
    listing_id: form.listing_id.trim(),
    vendor_id: form.vendor_id.trim(),
    product_title: form.product_title.trim(),
    product_description: nullableText(form.product_description),
    product_sku: nullableText(form.product_sku),
    quantity: toNumber(form.quantity, 1),
    unit_price: toNumber(form.unit_price, 0),
    total_price: toNumber(form.total_price, 0),
    item_discount_amount: toNullableNumber(form.item_discount_amount),
    item_status: form.item_status,
    digital_download_url: nullableText(form.digital_download_url),
    download_expires_at: nullableText(form.download_expires_at),
    variation_details: parseJson(form.variationDetailsText, {}) as Json,
  }
}

function validateItemForm(form: OrderItemForm) {
  if (!form.order_id.trim()) return 'Order id is required.'
  if (!form.listing_id.trim()) return 'Listing id is required.'
  if (!form.vendor_id.trim()) return 'Vendor shop id is required.'
  if (!form.product_title.trim()) return 'Product title is required.'
  if (toNumber(form.quantity, 0) < 1) return 'Quantity must be at least 1.'
  if (toNumber(form.total_price, -1) < 0) return 'Total price must be zero or greater.'
  if (!isJsonObject(form.variationDetailsText)) return 'Variation details must be a valid JSON object.'
  return null
}

function orderStatusOptions(allLabel?: string) {
  const options = [
    'pending',
    'awaiting_payment',
    'payment_failed',
    'confirmed',
    'processing',
    'shipped',
    'partially_shipped',
    'in_transit',
    'out_for_delivery',
    'delivered',
    'completed',
    'cancelled',
    'refunded',
    'disputed',
    'returned',
    'on_hold',
    'failed_delivery',
  ].map((value) => ({ value, label: formatLabel(value) }))
  return allLabel ? [{ value: 'all', label: allLabel }, ...options] : options
}

function paymentStatusOptions() {
  return ['pending', 'processing', 'completed', 'failed', 'cancelled', 'refunded', 'disputed', 'on_hold'].map((value) => ({ value, label: formatLabel(value) }))
}

function paymentModeOptions() {
  return ['cod', 'online', 'bank_transfer', 'wallet', 'upi', 'card', 'emi', 'pay_later'].map((value) => ({ value, label: formatLabel(value) }))
}

function fulfillmentStatusOptions() {
  return ['pending', 'processing', 'ready_to_ship', 'shipped', 'out_for_delivery', 'delivered', 'delivery_failed', 'returned_to_sender', 'cancelled', 'returned', 'exception'].map((value) => ({ value, label: formatLabel(value) }))
}

function issueStatusOptions() {
  return ['open', 'assigned', 'in_progress', 'waiting_customer', 'escalated', 'resolved', 'closed', 'cancelled'].map((value) => ({ value, label: formatLabel(value) }))
}

function issuePriorityOptions() {
  return ['low', 'medium', 'normal', 'high', 'urgent', 'critical'].map((value) => ({ value, label: formatLabel(value) }))
}

function issueTypeOptions() {
  return ['delivery_delay', 'product_defect', 'wrong_item', 'missing_item', 'damaged_item', 'payment_issue', 'billing_issue', 'return_request', 'refund_request', 'customer_complaint', 'shipping_issue', 'other'].map((value) => ({ value, label: formatLabel(value) }))
}

function getPrimaryImage(images: ListingImageRow[]) {
  return images.find((image) => image.is_primary) ?? images[0] ?? null
}

function statusTone(status: string) {
  if (['delivered', 'completed'].includes(status)) return 'success' as const
  if (['shipped', 'in_transit', 'partially_shipped', 'out_for_delivery'].includes(status)) return 'brand' as const
  if (['cancelled', 'refunded', 'returned', 'failed_delivery', 'payment_failed', 'disputed'].includes(status)) return 'danger' as const
  if (['processing', 'confirmed', 'on_hold'].includes(status)) return 'warning' as const
  return 'neutral' as const
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

function emptyResult<T>() {
  return Promise.resolve({ data: [] as T[], error: null })
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

function formatMoney(value: number | null | undefined, currency = 'INR') {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: currency || 'INR' }).format(Number(value ?? 0))
}

function formatDate(value: string | null) {
  if (!value) return 'Not set'
  return new Date(value).toLocaleString()
}

function formatLabel(value: string) {
  return value.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase())
}

function displayPerson(profile: ProfileRow) {
  return profile.full_name || profile.business_name || profile.username || profile.id
}

function formatAddress(address: AddressRow | null) {
  if (!address) return 'Not set'
  return [address.address_line_1, address.address_line_2, address.city, address.state, address.postal_code, address.country]
    .filter(Boolean)
    .join(', ')
}

function escapeSearch(value: string) {
  return value.replace(/[%(),]/g, '')
}
