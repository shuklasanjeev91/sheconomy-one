/**
 * Per-warehouse listing stock. Sum syncs to listings.quantity for checkout.
 * Ship-from address remains EasyShip resolveSellerOrigin (warehouse → shop address).
 */
import { fetchDefaultWarehouse, fetchActiveWarehouses, type WarehouseRow } from '~/commerce/lib/warehouse'
import { supabase } from '~/lib/supabase'

export type WarehouseInventoryQty = {
  warehouseId: string
  warehouseName: string
  isDefault: boolean
  availableQuantity: number
  inventoryId: string | null
}

export type ListingWarehouseStock = {
  listingId: string
  listingQuantity: number
  hasWarehouseRows: boolean
  warehouses: WarehouseInventoryQty[]
  /** Ship-from label for UI when no warehouse is configured. */
  shipFromLabel: string
}

const INV_SELECT =
  'id, warehouse_id, listing_id, variant_id, available_quantity, is_active, status'

export async function fetchListingWarehouseStock(input: {
  shopId: string
  listingId: string
  listingQuantity?: number | null
  variantId?: string | null
}): Promise<{ stock: ListingWarehouseStock | null; error: string | null }> {
  const { shopId, listingId } = input
  if (!shopId || !listingId) {
    return { stock: null, error: 'Shop and listing are required.' }
  }

  const { warehouses, error: whError } = await fetchActiveWarehouses(shopId)
  if (whError) return { stock: null, error: whError }

  let listingQuantity = input.listingQuantity ?? 0
  if (input.listingQuantity == null) {
    const { data: listing } = await supabase
      .from('listings')
      .select('quantity, stock')
      .eq('id', listingId)
      .maybeSingle()
    listingQuantity = Number(listing?.quantity ?? listing?.stock ?? 0) || 0
  }

  if (!warehouses.length) {
    return {
      stock: {
        listingId,
        listingQuantity,
        hasWarehouseRows: false,
        warehouses: [],
        shipFromLabel: 'Shop address (set a warehouse under Fulfillment)',
      },
      error: null,
    }
  }

  let query = supabase
    .from('warehouse_inventory')
    .select(INV_SELECT)
    .eq('listing_id', listingId)
    .eq('is_active', true)

  if (input.variantId) {
    query = query.eq('variant_id', input.variantId)
  } else {
    query = query.is('variant_id', null)
  }

  const { data: rows, error } = await query
  if (error) return { stock: null, error: error.message }

  const byWh = new Map(
    (rows ?? []).map((row) => [
      row.warehouse_id as string,
      {
        inventoryId: row.id as string,
        availableQuantity: Number(row.available_quantity) || 0,
      },
    ]),
  )

  const hasWarehouseRows = byWh.size > 0
  const defaultWh = warehouses.find((w) => w.is_default) ?? warehouses[0]

  const mapped: WarehouseInventoryQty[] = warehouses.map((w) => {
    const existing = byWh.get(w.id)
    // Prefill default warehouse with listing qty when no WH rows yet (unsaved seed).
    const availableQuantity =
      existing?.availableQuantity ??
      (!hasWarehouseRows && w.id === defaultWh?.id ? listingQuantity : 0)
    return {
      warehouseId: w.id,
      warehouseName: w.warehouse_name,
      isDefault: Boolean(w.is_default || w.id === defaultWh?.id),
      availableQuantity,
      inventoryId: existing?.inventoryId ?? null,
    }
  })

  return {
    stock: {
      listingId,
      listingQuantity: hasWarehouseRows
        ? mapped.reduce((sum, row) => sum + row.availableQuantity, 0)
        : listingQuantity,
      hasWarehouseRows,
      warehouses: mapped,
      shipFromLabel: defaultWh
        ? `${defaultWh.warehouse_name}${defaultWh.city ? ` · ${defaultWh.city}` : ''}`
        : 'Shop address',
    },
    error: null,
  }
}

export async function setWarehouseInventoryQty(input: {
  shopId: string
  warehouseId: string
  listingId: string
  availableQuantity: number
  variantId?: string | null
}): Promise<{ listingQuantity: number | null; error: string | null }> {
  const qty = Math.max(0, Math.floor(Number(input.availableQuantity) || 0))
  const { data, error } = await supabase.rpc('vendor_set_warehouse_inventory' as never, {
    p_shop_id: input.shopId,
    p_warehouse_id: input.warehouseId,
    p_listing_id: input.listingId,
    p_available_quantity: qty,
    p_variant_id: input.variantId ?? null,
  } as never)

  if (error) return { listingQuantity: null, error: error.message }

  const listingQuantity =
    data && typeof data === 'object' && 'listing_quantity' in (data as object)
      ? Number((data as { listing_quantity?: number }).listing_quantity)
      : null

  return {
    listingQuantity: Number.isFinite(listingQuantity) ? listingQuantity : null,
    error: null,
  }
}

/** Persist all warehouse qtys for a listing (absolute values). */
export async function saveListingWarehouseStock(input: {
  shopId: string
  listingId: string
  quantities: Array<{ warehouseId: string; availableQuantity: number }>
  variantId?: string | null
}): Promise<{ listingQuantity: number | null; error: string | null }> {
  let lastQty: number | null = null
  for (const row of input.quantities) {
    const result = await setWarehouseInventoryQty({
      shopId: input.shopId,
      warehouseId: row.warehouseId,
      listingId: input.listingId,
      availableQuantity: row.availableQuantity,
      variantId: input.variantId,
    })
    if (result.error) return result
    lastQty = result.listingQuantity
  }
  return { listingQuantity: lastQty, error: null }
}

/**
 * After publish/create: seed default warehouse with listing quantity when a warehouse exists.
 */
export async function seedDefaultWarehouseFromListing(input: {
  shopId: string
  listingId: string
  quantity: number | null | undefined
}): Promise<{ seeded: boolean; error: string | null }> {
  const qty = Math.max(0, Math.floor(Number(input.quantity) || 0))
  if (!input.shopId || !input.listingId || qty <= 0) {
    return { seeded: false, error: null }
  }

  const { warehouse, error } = await fetchDefaultWarehouse(input.shopId)
  if (error) return { seeded: false, error }
  if (!warehouse) return { seeded: false, error: null }

  const { data: existing } = await supabase
    .from('warehouse_inventory')
    .select('id')
    .eq('warehouse_id', warehouse.id)
    .eq('listing_id', input.listingId)
    .is('variant_id', null)
    .maybeSingle()

  if (existing?.id) return { seeded: false, error: null }

  const result = await setWarehouseInventoryQty({
    shopId: input.shopId,
    warehouseId: warehouse.id,
    listingId: input.listingId,
    availableQuantity: qty,
  })
  if (result.error) return { seeded: false, error: result.error }
  return { seeded: true, error: null }
}

export type { WarehouseRow }
