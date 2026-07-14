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

import { ORDER_DEFAULTS } from './order.constants'
import { formatOrderAmount, formatOrderDate } from './order.utils'
import type { OrderAddressSummary, VendorOrderItem } from './vendor-orders.type'

const DEFAULT_BRAND_COLOR = '#be185d'

export type OrderInvoiceOptions = {
  /** Shop name shown in the header; falls back to the item's joined shop. */
  shopName?: string | null
  /** Brand accent colour (pass `ui.brand` to match the current theme). */
  brandColor?: string
}

export type InvoiceResult = {
  ok: boolean
  /** Present when `ok` is false — e.g. `'unsupported'` on native. */
  reason?: 'unsupported' | 'no-data' | 'blocked'
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

/**
 * Build the standalone invoice HTML document for an order item. Pure and
 * side-effect free, so it can be unit-tested or reused by other exporters.
 */
export function buildOrderInvoiceHtml(item: VendorOrderItem, options: OrderInvoiceOptions = {}): string {
  const brand = options.brandColor || DEFAULT_BRAND_COLOR
  const order = item.orders
  const currency = order?.currency ?? ORDER_DEFAULTS.CURRENCY
  const customer = order?.profiles
  const shopName = resolveShopName(item, options.shopName)
  const orderNumber = order?.order_number ?? item.order_id ?? 'N/A'
  const orderDate = formatOrderDate(order?.created_at ?? item.created_at, true)

  const address = item.billing_address ?? order?.billing_address ?? null
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

  const summaryRow = (label: string, value: number, opts: { bold?: boolean; negative?: boolean } = {}) => {
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

  const customerRow = (label: string, value: string) => `
    <p style="margin:4px 0;font-size:13px;color:#111827;">
      <span style="font-weight:600;">${escapeHtml(label)}:</span> ${escapeHtml(value)}
    </p>`

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>order_${escapeHtml(orderNumber)}</title>
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
        <h1 style="margin:0;font-size:24px;font-weight:800;color:#1f2937;">${escapeHtml(shopName)}</h1>
        <p style="margin:4px 0 0;font-size:13px;font-weight:600;color:${brand};">SHEconomy Vendor Copy</p>
      </div>
      <div style="text-align:right;">
        <p style="margin:0;font-size:12px;color:#6b7280;">Order Date</p>
        <p style="margin:0 0 6px;font-weight:600;">${escapeHtml(orderDate)}</p>
        <p style="margin:0;font-size:12px;color:#6b7280;">Order #</p>
        <p style="margin:0;font-weight:600;">${escapeHtml(orderNumber)}</p>
      </div>
    </div>

    <div style="display:flex;gap:16px;margin-bottom:28px;">
      <div style="flex:1;border:1px solid #e5e7eb;border-radius:8px;padding:14px;">
        <h2 style="margin:0 0 10px;font-size:15px;font-weight:700;border-bottom:1px solid #e5e7eb;padding-bottom:6px;">Customer Details</h2>
        ${customerRow('Name', customer?.full_name || 'Anonymous')}
        ${customerRow('Email', customer?.email || 'N/A')}
        ${customerRow('Phone', customer?.phone || 'N/A')}
      </div>
      <div style="flex:1;border:1px solid #e5e7eb;border-radius:8px;padding:14px;">
        <h2 style="margin:0 0 10px;font-size:15px;font-weight:700;border-bottom:1px solid #e5e7eb;padding-bottom:6px;">Shipping Address</h2>
        ${
          shippingLines.length > 0
            ? shippingLines.map((line) => `<p style="margin:3px 0;font-size:13px;color:#374151;">${escapeHtml(line)}</p>`).join('')
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
        <tr>
          <td>${escapeHtml(productTitle)}</td>
          <td>${escapeHtml(sku)}</td>
          <td>${escapeHtml(variation)}</td>
          <td style="text-align:right;">${escapeHtml(formatOrderAmount(item.unit_price, currency))}</td>
          <td style="text-align:right;">${escapeHtml(quantity)}</td>
          <td style="text-align:right;">${escapeHtml(formatOrderAmount(item.total_price, currency))}</td>
        </tr>
      </tbody>
    </table>

    <div style="display:flex;justify-content:flex-end;margin-top:24px;">
      <div style="width:280px;border:1px solid #e5e7eb;border-radius:8px;padding:16px;background:#f9fafb;">
        ${summaryRow('Subtotal', subtotal)}
        ${discount > 0 ? summaryRow('Discount', -discount, { negative: true }) : ''}
        ${summaryRow('Shipping', shipping)}
        ${summaryRow('Tax', tax)}
        <div style="border-top:1px solid #e5e7eb;margin-top:8px;padding-top:8px;">
          ${summaryRow('Total', total, { bold: true })}
        </div>
      </div>
    </div>

    <div style="margin-top:36px;padding-top:16px;border-top:1px solid #e5e7eb;text-align:center;font-size:12px;color:#6b7280;">
      <p style="margin:2px 0;">Thank you for your business!</p>
      <p style="margin:2px 0;">SHEconomy | sheconomy.com | ${escapeHtml(new Date().toLocaleDateString())}</p>
    </div>
  </div>
</body>
</html>`
}

/**
 * Render the invoice into a hidden iframe and trigger the browser print dialog
 * (whose "Save as PDF" destination downloads the invoice). Web-only; returns
 * `{ ok: false, reason: 'unsupported' }` on native so callers can show a toast.
 */
export function downloadOrderInvoice(item: VendorOrderItem, options: OrderInvoiceOptions = {}): InvoiceResult {
  if (typeof document === 'undefined' || typeof window === 'undefined') {
    return { ok: false, reason: 'unsupported' }
  }
  if (!item) return { ok: false, reason: 'no-data' }

  const html = buildOrderInvoiceHtml(item, options)

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
      // Give the print dialog time to read the document before teardown.
      window.setTimeout(cleanup, 1000)
    }
  }

  // Wait for the iframe document (incl. product-image layout) to settle.
  if (doc.readyState === 'complete') {
    window.setTimeout(triggerPrint, 250)
  } else {
    frameWindow.addEventListener('load', () => window.setTimeout(triggerPrint, 250), { once: true })
  }

  return { ok: true }
}
