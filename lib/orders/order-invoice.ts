/**
 * Order invoice ("Download PDF") utilities.
 *
 * Migrated from the legacy `components/orders/VendorOrderPrint.js`. The legacy
 * implementation rendered a styled DOM invoice and snapshotted it with
 * `html2canvas` + `jsPDF`. Those libraries are web-only and heavy, and this app
 * is cross-platform (Expo + react-native-web). Instead we build a self-contained
 * styled HTML invoice and let the browser produce the PDF via its native
 * "Save as PDF" print target — which also avoids canvas CORS issues with remote
 * product images.
 *
 * The HTML is intentionally framework-free (inline styles) so it renders
 * identically inside the isolated print iframe, independent of the app's CSS.
 */

import { ORDER_DEFAULTS } from '~/lib/orders/order.constants'
import { formatOrderAmount, formatOrderDate } from '~/lib/orders/order.utils'
import type { OrderAddressSummary, VendorOrderItem } from '~/lib/orders/vendor-orders.type'
import { resolveVendorShippingAddress } from '~/lib/orders/vendor-orders.utils'
import {
  formatCustomerContactPhone,
} from '~/features/auth/services/account-contact'

const DEFAULT_BRAND_COLOR = '#be185d'

export type OrderInvoiceOptions = {
  /** Shop name shown in the header; falls back to the item's joined shop. */
  shopName?: string | null
  /** Brand accent colour (pass `ui.brand` to match the current theme). */
  brandColor?: string
  /** Header subtitle — vendor copy vs customer receipt. */
  copyLabel?: string | null
}

export type InvoiceResult = {
  ok: boolean
  /** Present when `ok` is false — e.g. `'unsupported'` on native. */
  reason?: 'unsupported' | 'no-data' | 'blocked'
}

/** Neutral whole-order invoice model (customer + multi-item). */
export type CustomerOrderInvoice = {
  orderNumber: string
  orderDate?: string | null
  currency?: string | null
  shopName?: string | null
  customerName?: string | null
  customerEmail?: string | null
  customerPhone?: string | null
  shippingAddress?: OrderAddressSummary | null
  subtotalAmount?: number | null
  discountAmount?: number | null
  shippingAmount?: number | null
  taxAmount?: number | null
  totalAmount?: number | null
  paymentMode?: string | null
  paymentStatus?: string | null
  items: Array<{
    title: string
    sku?: string | null
    variation?: string | null
    unitPrice?: number | null
    quantity?: number | null
    totalPrice?: number | null
  }>
}

/** Escape a value for safe interpolation into HTML text/attributes. */
function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/** Human-readable variation summary (e.g. "Size: M, Color: Red"). */
function variationText(details: unknown): string {
  if (Array.isArray(details)) {
    const parts = details.map((entry) =>
      entry && typeof entry === 'object'
        ? Object.entries(entry as Record<string, unknown>)
            .map(([key, value]) => `${key}: ${String(value)}`)
            .join(', ')
        : String(entry),
    )
    return parts.filter(Boolean).join(', ') || '-'
  }
  if (details && typeof details === 'object') {
    const text = Object.entries(details as Record<string, unknown>)
      .map(([key, value]) => `${key}: ${String(value)}`)
      .join(', ')
    return text || '-'
  }
  return details ? String(details) : '-'
}

/** Flatten an address summary into printable lines. */
function addressLines(address: OrderAddressSummary | null | undefined): string[] {
  if (!address) return []
  return [
    address.address_line_1,
    address.address_line_2,
    [address.city, address.state].filter(Boolean).join(', ') || null,
    [address.postal_code, address.country].filter(Boolean).join(' ') || null,
  ].filter((line): line is string => Boolean(line && line.trim()))
}

function resolveShopName(item: VendorOrderItem, override?: string | null): string {
  return override?.trim() || item.shops?.shop_name?.trim() || 'Unknown Shop'
}

function summaryRowHtml(
  label: string,
  value: number,
  currency: string,
  opts: { bold?: boolean; negative?: boolean } = {},
) {
  const weight = opts.bold ? '700' : '500'
  const colour = opts.negative ? '#dc2626' : '#111827'
  return `
      <div style="display:flex;justify-content:space-between;padding:6px 0;">
        <span style="font-weight:${weight};color:#374151;">${escapeHtml(label)}:</span>
        <span style="font-weight:${opts.bold ? '700' : '600'};color:${colour};">${escapeHtml(
          formatOrderAmount(value, currency),
        )}</span>
      </div>`
}

function customerRowHtml(label: string, value: string) {
  return `
    <p style="margin:4px 0;font-size:13px;color:#111827;">
      <span style="font-weight:600;">${escapeHtml(label)}:</span> ${escapeHtml(value)}
    </p>`
}

function renderInvoiceDocument(input: {
  shopName: string
  copyLabel: string
  brand: string
  orderNumber: string
  orderDate: string
  customerName: string
  customerEmail: string
  customerPhone: string
  shippingLines: string[]
  currency: string
  itemsHtml: string
  subtotal: number
  discount: number
  shipping: number
  tax: number
  total: number
  paymentLine?: string | null
}): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>order_${escapeHtml(input.orderNumber)}</title>
<style>
  * { box-sizing: border-box; }
  body { margin: 0; padding: 24px; background: #ffffff; color: #111827;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; }
  .invoice { max-width: 800px; margin: 0 auto; }
  table { width: 100%; border-collapse: collapse; }
  th, td { border: 1px solid #e5e7eb; padding: 8px; font-size: 13px; }
  th { background: #f3f4f6; text-align: left; }
  @media print {
    @page { size: A4; margin: 12mm; }
    body { padding: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .invoice { max-width: 100%; }
    tr { page-break-inside: avoid; }
  }
</style>
</head>
<body>
  <div class="invoice">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:24px;">
      <div>
        <h1 style="margin:0;font-size:24px;font-weight:800;color:#1f2937;">${escapeHtml(input.shopName)}</h1>
        <p style="margin:4px 0 0;font-size:13px;font-weight:600;color:${input.brand};">${escapeHtml(input.copyLabel)}</p>
      </div>
      <div style="text-align:right;">
        <p style="margin:0;font-size:12px;color:#6b7280;">Order Date</p>
        <p style="margin:0 0 6px;font-weight:600;">${escapeHtml(input.orderDate)}</p>
        <p style="margin:0;font-size:12px;color:#6b7280;">Order #</p>
        <p style="margin:0;font-weight:600;">${escapeHtml(input.orderNumber)}</p>
      </div>
    </div>

    <div style="display:flex;gap:16px;margin-bottom:28px;">
      <div style="flex:1;border:1px solid #e5e7eb;border-radius:8px;padding:14px;">
        <h2 style="margin:0 0 10px;font-size:15px;font-weight:700;border-bottom:1px solid #e5e7eb;padding-bottom:6px;">Customer Details</h2>
        ${customerRowHtml('Name', input.customerName)}
        ${customerRowHtml('Email', input.customerEmail)}
        ${customerRowHtml('Phone', input.customerPhone)}
        ${input.paymentLine ? customerRowHtml('Payment', input.paymentLine) : ''}
      </div>
      <div style="flex:1;border:1px solid #e5e7eb;border-radius:8px;padding:14px;">
        <h2 style="margin:0 0 10px;font-size:15px;font-weight:700;border-bottom:1px solid #e5e7eb;padding-bottom:6px;">Shipping Address</h2>
        ${
          input.shippingLines.length > 0
            ? input.shippingLines
                .map((line) => `<p style="margin:3px 0;font-size:13px;color:#374151;">${escapeHtml(line)}</p>`)
                .join('')
            : '<p style="margin:3px 0;font-size:13px;color:#6b7280;">N/A</p>'
        }
      </div>
    </div>

    <h2 style="margin:0 0 12px;font-size:15px;font-weight:700;border-bottom:1px solid #e5e7eb;padding-bottom:6px;">Order Items</h2>
    <table>
      <thead>
        <tr>
          <th>Product</th>
          <th>SKU</th>
          <th>Variation</th>
          <th style="text-align:right;">Unit Price</th>
          <th style="text-align:right;">Qty</th>
          <th style="text-align:right;">Total</th>
        </tr>
      </thead>
      <tbody>
        ${input.itemsHtml}
      </tbody>
    </table>

    <div style="display:flex;justify-content:flex-end;margin-top:24px;">
      <div style="width:280px;border:1px solid #e5e7eb;border-radius:8px;padding:16px;background:#f9fafb;">
        ${summaryRowHtml('Subtotal', input.subtotal, input.currency)}
        ${
          input.discount > 0
            ? summaryRowHtml('Discount', -input.discount, input.currency, { negative: true })
            : ''
        }
        ${summaryRowHtml('Shipping', input.shipping, input.currency)}
        ${summaryRowHtml('Tax', input.tax, input.currency)}
        <div style="border-top:1px solid #e5e7eb;margin-top:8px;padding-top:8px;">
          ${summaryRowHtml('Total', input.total, input.currency, { bold: true })}
        </div>
      </div>
    </div>

    <div style="margin-top:36px;padding-top:16px;border-top:1px solid #e5e7eb;text-align:center;font-size:12px;color:#6b7280;">
      <p style="margin:2px 0;">Thank you for shopping with SHEconomy!</p>
      <p style="margin:2px 0;">SHEconomy | sheconomy.in | ${escapeHtml(new Date().toLocaleDateString())}</p>
    </div>
  </div>
</body>
</html>`
}

/**
 * Build the standalone invoice HTML document for an order item. Pure and
 * side-effect free, so it can be unit-tested or reused by other exporters.
 */
export function buildOrderInvoiceHtml(item: VendorOrderItem, options: OrderInvoiceOptions = {}): string {
  const brand = options.brandColor || DEFAULT_BRAND_COLOR
  const order = item.orders
  const currency = order?.currency ?? ORDER_DEFAULTS.CURRENCY
  const customer = order?.profiles
  const customerPhoneLabel = formatCustomerContactPhone({ profilePhone: customer?.phone })
  const shopName = resolveShopName(item, options.shopName)
  const orderNumber = order?.order_number ?? item.order_id ?? 'N/A'
  const orderDate = formatOrderDate(order?.created_at ?? item.created_at, true)

  const address = resolveVendorShippingAddress(item)
  const shippingLines = addressLines(address)

  const subtotal = Number(order?.subtotal_amount ?? 0)
  const discount = Number(order?.discount_amount ?? 0)
  const shipping = Number(order?.shipping_amount ?? 0)
  const tax = Number(order?.tax_amount ?? 0)
  const total = Number(order?.total_amount ?? item.total_price ?? 0)

  const productTitle = item.product_title ?? item.listing?.title ?? 'Product'
  const sku = item.product_sku ?? '-'
  const variation = variationText(item.variation_details)
  const quantity = item.quantity ?? 1

  const itemsHtml = `
        <tr>
          <td>${escapeHtml(productTitle)}</td>
          <td>${escapeHtml(sku)}</td>
          <td>${escapeHtml(variation)}</td>
          <td style="text-align:right;">${escapeHtml(formatOrderAmount(item.unit_price, currency))}</td>
          <td style="text-align:right;">${escapeHtml(quantity)}</td>
          <td style="text-align:right;">${escapeHtml(formatOrderAmount(item.total_price, currency))}</td>
        </tr>`

  return renderInvoiceDocument({
    shopName,
    copyLabel: options.copyLabel?.trim() || 'SHEconomy Vendor Copy',
    brand,
    orderNumber,
    orderDate,
    customerName: customer?.full_name || 'Anonymous',
    customerEmail: customer?.email || 'N/A',
    customerPhone: customerPhoneLabel !== 'Not added' ? customerPhoneLabel : 'N/A',
    shippingLines,
    currency,
    itemsHtml,
    subtotal,
    discount,
    shipping,
    tax,
    total,
  })
}

/** Whole-order customer receipt HTML. */
export function buildCustomerOrderInvoiceHtml(
  invoice: CustomerOrderInvoice,
  options: OrderInvoiceOptions = {},
): string {
  const brand = options.brandColor || DEFAULT_BRAND_COLOR
  const currency = invoice.currency ?? ORDER_DEFAULTS.CURRENCY
  const shopName = options.shopName?.trim() || invoice.shopName?.trim() || 'SHEconomy'
  const orderNumber = invoice.orderNumber || 'N/A'
  const orderDate = formatOrderDate(invoice.orderDate, true)
  const shippingLines = addressLines(invoice.shippingAddress)

  const itemsHtml = (invoice.items.length
    ? invoice.items
    : [{ title: 'Item', sku: '-', variation: '-', unitPrice: 0, quantity: 0, totalPrice: 0 }]
  )
    .map(
      (item) => `
        <tr>
          <td>${escapeHtml(item.title)}</td>
          <td>${escapeHtml(item.sku ?? '-')}</td>
          <td>${escapeHtml(item.variation ?? '-')}</td>
          <td style="text-align:right;">${escapeHtml(formatOrderAmount(item.unitPrice, currency))}</td>
          <td style="text-align:right;">${escapeHtml(item.quantity ?? 1)}</td>
          <td style="text-align:right;">${escapeHtml(formatOrderAmount(item.totalPrice, currency))}</td>
        </tr>`,
    )
    .join('')

  const paymentLine =
    invoice.paymentMode || invoice.paymentStatus
      ? [invoice.paymentMode, invoice.paymentStatus].filter(Boolean).join(' · ')
      : null

  return renderInvoiceDocument({
    shopName,
    copyLabel: options.copyLabel?.trim() || 'SHEconomy Customer Receipt',
    brand,
    orderNumber,
    orderDate,
    customerName: invoice.customerName || 'Customer',
    customerEmail: invoice.customerEmail || 'N/A',
    customerPhone: invoice.customerPhone || 'N/A',
    shippingLines,
    currency,
    itemsHtml,
    subtotal: Number(invoice.subtotalAmount ?? 0),
    discount: Number(invoice.discountAmount ?? 0),
    shipping: Number(invoice.shippingAmount ?? 0),
    tax: Number(invoice.taxAmount ?? 0),
    total: Number(invoice.totalAmount ?? 0),
    paymentLine,
  })
}

async function printOrShareHtml(html: string, dialogTitle: string): Promise<InvoiceResult> {
  if (typeof document !== 'undefined' && typeof window !== 'undefined') {
    // Prefer a real tab: zero-size iframes behind high z-index drawers often fail
    // to open the print dialog (especially Safari / popup blockers).
    try {
      const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const win = window.open(url, '_blank', 'noopener,noreferrer')
      if (win) {
        const revoke = () => {
          try {
            URL.revokeObjectURL(url)
          } catch {
            /* ignore */
          }
        }
        const triggerPrint = () => {
          try {
            win.focus()
            win.print()
          } catch {
            /* user can still Save as PDF from the open tab */
          } finally {
            window.setTimeout(revoke, 60_000)
          }
        }
        // Some browsers fire load before we attach; always schedule a print attempt.
        window.setTimeout(triggerPrint, 400)
        return { ok: true }
      }
      URL.revokeObjectURL(url)
    } catch {
      /* fall through to iframe path */
    }

    const iframe = document.createElement('iframe')
    iframe.setAttribute('aria-hidden', 'true')
    Object.assign(iframe.style, {
      position: 'fixed',
      right: '0',
      bottom: '0',
      width: '0',
      height: '0',
      border: '0',
      opacity: '0',
    })
    document.body.appendChild(iframe)

    const cleanup = () => {
      if (iframe.parentNode) iframe.parentNode.removeChild(iframe)
    }

    const doc = iframe.contentWindow?.document
    if (!doc || !iframe.contentWindow) {
      cleanup()
      return { ok: false, reason: 'blocked' }
    }

    doc.open()
    doc.write(html)
    doc.close()

    const frameWindow = iframe.contentWindow
    const triggerPrint = () => {
      try {
        frameWindow.focus()
        frameWindow.print()
      } finally {
        window.setTimeout(cleanup, 1000)
      }
    }

    if (doc.readyState === 'complete') {
      window.setTimeout(triggerPrint, 250)
    } else {
      frameWindow.addEventListener('load', () => window.setTimeout(triggerPrint, 250), { once: true })
    }

    return { ok: true }
  }

  try {
    const Print = await import('expo-print')
    const Sharing = await import('expo-sharing')
    const file = await Print.printToFileAsync({ html })
    if (!file?.uri) return { ok: false, reason: 'blocked' }

    const canShare = await Sharing.isAvailableAsync()
    if (!canShare) return { ok: false, reason: 'unsupported' }

    await Sharing.shareAsync(file.uri, {
      mimeType: 'application/pdf',
      dialogTitle,
      UTI: 'com.adobe.pdf',
    })
    return { ok: true }
  } catch {
    return { ok: false, reason: 'blocked' }
  }
}

/**
 * Render the invoice into a hidden iframe and trigger the browser print dialog
 * (whose "Save as PDF" destination downloads the invoice). Web-only; returns
 * `{ ok: false, reason: 'unsupported' }` on native — use `shareOrderInvoice` there.
 */
export function downloadOrderInvoice(item: VendorOrderItem, options: OrderInvoiceOptions = {}): InvoiceResult {
  if (typeof document === 'undefined' || typeof window === 'undefined') {
    return { ok: false, reason: 'unsupported' }
  }
  if (!item) return { ok: false, reason: 'no-data' }
  const html = buildOrderInvoiceHtml(item, options)

  // Fire-and-forget web print path (sync API preserved for vendor callers).
  void printOrShareHtml(html, `Invoice ${item.orders?.order_number ?? item.id}`)
  return { ok: true }
}

/**
 * Cross-platform invoice share/print:
 * - web → browser print / Save as PDF
 * - iOS/Android → expo-print PDF + expo-sharing
 */
export async function shareOrderInvoice(
  item: VendorOrderItem,
  options: OrderInvoiceOptions = {},
): Promise<InvoiceResult> {
  if (!item) return { ok: false, reason: 'no-data' }
  const html = buildOrderInvoiceHtml(item, options)
  return printOrShareHtml(html, `Invoice ${item.orders?.order_number ?? item.id}`)
}

/** Customer whole-order receipt share/print. */
export async function shareCustomerOrderInvoice(
  invoice: CustomerOrderInvoice,
  options: OrderInvoiceOptions = {},
): Promise<InvoiceResult> {
  if (!invoice?.orderNumber && !invoice?.items?.length) return { ok: false, reason: 'no-data' }
  const html = buildCustomerOrderInvoiceHtml(invoice, options)
  return printOrShareHtml(html, `Receipt ${invoice.orderNumber}`)
}
