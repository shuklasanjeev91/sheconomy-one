/**
 * Auto reverse pickup — booked platform-side the moment a vendor approves a
 * return/exchange. Buyers never enter an AWB. If Shiprocket can't book (no
 * address, credentials, or API failure) we return a `fallback` outcome so the
 * vendor can paste an AWB manually via the "Arrange return pickup" drawer.
 */

import { assignReturnTracking } from '~/commerce/lib/customer-order-trust'
import { createSheDeliveryReturn } from '~/commerce/lib/shedelivery'
import { fetchShopAddressDetails } from '~/commerce/lib/shop-address'
import { RETURN_SHIPPING_MODE } from '~/lib/orders/order.constants'
import { getVendorOrderItem } from '~/lib/orders/vendor-orders.service'
import { resolveVendorShippingAddress } from '~/lib/orders/vendor-orders.utils'

export type AutoReturnPickupOutcome =
  | { status: 'booked'; awb: string; trackingUrl: string | null }
  | { status: 'fallback'; reason: string }

function missing(value: string | null | undefined): boolean {
  return !value || !value.trim()
}

/**
 * Attempt to auto-book the reverse pickup for an accepted return/exchange.
 * On success it records the AWB via `assignReturnTracking` (mode `auto`), which
 * also writes the reverse `order_delivery` leg so tracking stays live.
 */
export async function autoBookReturnPickup(orderItemId: string): Promise<AutoReturnPickupOutcome> {
  const itemResult = await getVendorOrderItem(orderItemId)
  const item = itemResult.data
  if (itemResult.error || !item) {
    return { status: 'fallback', reason: itemResult.error ?? 'Order item not found.' }
  }

  const pickup = resolveVendorShippingAddress(item)
  if (!pickup || missing(pickup.postal_code) || missing(pickup.address_line_1)) {
    return { status: 'fallback', reason: 'Buyer pickup address is incomplete.' }
  }

  const vendorId = item.vendor_id
  if (!vendorId) return { status: 'fallback', reason: 'Item is not linked to a shop.' }

  const shopAddress = await fetchShopAddressDetails(vendorId)
  const seller = shopAddress.address
  if (!seller || missing(seller.postal_code) || missing(seller.address_line_1)) {
    return { status: 'fallback', reason: 'Shop return address is not set.' }
  }

  const buyer = item.orders?.profiles
  const shopName = item.shops?.shop_name ?? 'Shop'

  const { data, error } = await createSheDeliveryReturn({
    orderId: item.order_id,
    orderNumber: item.orders?.order_number ?? null,
    pickupCustomerName: buyer?.full_name ?? 'Customer',
    pickupPhone: buyer?.phone ?? '',
    pickupEmail: buyer?.email ?? undefined,
    pickupAddressLine1: pickup.address_line_1 ?? '',
    pickupAddressLine2: pickup.address_line_2 ?? undefined,
    pickupCity: pickup.city ?? '',
    pickupState: pickup.state ?? '',
    pickupCountry: pickup.country ?? 'India',
    pickupPostcode: pickup.postal_code ?? '',
    sellerName: shopName,
    sellerPhone: buyer?.phone ?? '',
    sellerAddressLine1: seller.address_line_1 ?? '',
    sellerAddressLine2: seller.address_line_2 ?? undefined,
    sellerCity: seller.city ?? '',
    sellerState: seller.state ?? '',
    sellerCountry: seller.country ?? 'India',
    sellerPostcode: seller.postal_code ?? '',
    weightKg: 0.5,
    items: [
      {
        name: item.product_title ?? item.listings?.title ?? 'Item',
        sku: item.product_sku ?? undefined,
        units: item.quantity ?? 1,
        sellingPrice: Number(item.unit_price ?? item.total_price ?? 0),
      },
    ],
  })

  if (error || !data?.awb) {
    return { status: 'fallback', reason: error ?? 'Courier did not return an AWB.' }
  }

  const assigned = await assignReturnTracking({
    orderItemId,
    trackingNumber: data.awb,
    courierSlug: 'shiprocket',
    customTrackingUrl: data.trackingUrl,
    shippingMode: RETURN_SHIPPING_MODE.AUTO,
  })

  if (assigned.error) {
    return { status: 'fallback', reason: assigned.error }
  }

  return { status: 'booked', awb: data.awb, trackingUrl: data.trackingUrl }
}
