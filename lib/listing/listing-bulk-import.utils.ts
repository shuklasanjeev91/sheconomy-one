import {
  getListingImageImportRuleMessages,
  getListingImageImportTemplateRuleRows,
} from '~/lib/config/listing-image-import-rules'

import {
  BULK_IMPORT_CONFIG,
  BULK_IMPORT_CSV_HEADER,
  BULK_IMPORT_CSV_SAMPLE,
} from './listing-bulk-import.constants'
import type { BulkImportRawRow, BulkImportRow } from './listing-bulk-import.type'
import { BULK_IMPORT_ROW_STATUS } from './listing-bulk-import.type'
import { validateBulkImportRow } from './listing-bulk-import.validation'
import type { PublishListingData } from './listing-publish.orchestrator'
import type {
  ListingAttributeInsert,
  ListingImageDraft,
  ListingMaterialInsert,
  ListingVariationInsert,
} from './listing.type'

// ─── Row normaliser ───────────────────────────────────────────────────────────

export function normaliseBulkImportRow(raw: BulkImportRawRow, shopId: string): PublishListingData {
  const r = Object.fromEntries(
    Object.entries(raw).map(([k, v]) => [
      k.trim().toLowerCase(),
      typeof v === 'string' ? v.trim() : String(v ?? '').trim(),
    ]),
  )

  const bool = (key: string, fallback = false) => {
    const v = r[key]
    if (v === '' || v == null) return fallback
    const normalized = String(v).trim().toLowerCase()
    return normalized === 'true' || normalized === '1' || normalized === 'yes'
  }

  const num = (key: string, fallback: number | null = null) => {
    const v = parseFloat(r[key])
    return Number.isNaN(v) ? fallback : v
  }

  const int = (key: string, fallback: number | null = null) => {
    const v = parseInt(r[key], 10)
    return Number.isNaN(v) ? fallback : v
  }

  const images: ListingImageDraft[] = []
  for (let i = 1; i <= BULK_IMPORT_CONFIG.IMAGE_SLOTS; i += 1) {
    const url = r[`image_url_${i}`]
    if (url) {
      images.push({
        image_url: url,
        alt_text: r[`image_alt_${i}`] || '',
        is_primary: i === 1,
        display_order: i - 1,
      })
    }
  }

  const variations: Partial<ListingVariationInsert>[] = []
  for (let i = 1; i <= BULK_IMPORT_CONFIG.VARIATION_SLOTS; i += 1) {
    const name = r[`variation_name_${i}`]
    const value = r[`variation_value_${i}`]
    if (name && value) {
      variations.push({
        variation_name: name,
        variation_value: value,
        price_adjustment: num(`variation_price_adjustment_${i}`, 0) ?? 0,
        stock: int(`variation_stock_${i}`),
        is_available: true,
        display_order: i - 1,
        variation_metadata: {},
      })
    }
  }

  const attributes: Partial<ListingAttributeInsert>[] = []
  for (let i = 1; i <= BULK_IMPORT_CONFIG.ATTRIBUTE_SLOTS; i += 1) {
    const name = r[`attr_name_${i}`]
    const value = r[`attr_value_${i}`]
    if (name && value) {
      attributes.push({
        attribute_name: name,
        attribute_value: value,
        attribute_type: 'text' as const,
        display_order: i - 1,
        is_filterable: false,
      })
    }
  }

  const materials: Partial<ListingMaterialInsert>[] = []
  for (let i = 1; i <= BULK_IMPORT_CONFIG.MATERIAL_SLOTS; i += 1) {
    const name = r[`material_name_${i}`]
    if (name) {
      materials.push({
        material_name: name,
        percentage: num(`material_percentage_${i}`),
        is_primary: bool(`material_is_primary_${i}`),
        is_sustainable: bool(`material_is_sustainable_${i}`),
        certification: null,
      })
    }
  }

  const tags = r.tags
    ? r.tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean)
    : []

  const shop_sections = r.shop_section_ids
    ? r.shop_section_ids
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    : []

  const dimensions =
    r.dimension_width || r.dimension_height || r.dimension_depth
      ? {
          width: num('dimension_width'),
          height: num('dimension_height'),
          depth: num('dimension_depth'),
          unit: r.dimension_unit || BULK_IMPORT_CONFIG.DEFAULT_DIMENSION_UNIT,
        }
      : {}

  return {
    shop_id: shopId,
    title: r.title || '',
    description: r.description || '',
    listing_type: (r.listing_type || BULK_IMPORT_CONFIG.DEFAULT_LISTING_TYPE) as PublishListingData['listing_type'],
    price: String(num('price', 0) ?? 0),
    quantity: int('quantity', BULK_IMPORT_CONFIG.DEFAULT_QUANTITY) ?? BULK_IMPORT_CONFIG.DEFAULT_QUANTITY,
    is_featured: bool('is_featured'),
    slug: r.slug || '',
    meta_title: r.meta_title || '',
    meta_description: r.meta_description || '',
    tags,
    images,
    variations,
    attributes,
    materials,
    shop_sections,
    categories: [],
    listing_metadata: {},
    stock: int('stock') != null ? String(int('stock')) : '',
    sku: r.sku || '',
    weight: num('weight') != null ? String(num('weight')) : '',
    dimensions,
    shipping_required: bool('shipping_required', BULK_IMPORT_CONFIG.DEFAULT_SHIPPING_REQUIRED),
    digital_file_url: r.digital_file_url || '',
    digital_file_type: r.digital_file_type || '',
    digital_file_size: int('digital_file_size') != null ? String(int('digital_file_size')) : '',
    download_limit: int('download_limit') != null ? String(int('download_limit')) : '',
    is_online: bool('is_online'),
    booking_duration_minutes:
      int('booking_duration_minutes') != null ? String(int('booking_duration_minutes')) : '',
    max_attendees: int('max_attendees', BULK_IMPORT_CONFIG.DEFAULT_MAX_ATTENDEES) ?? BULK_IMPORT_CONFIG.DEFAULT_MAX_ATTENDEES,
    requires_approval: bool('requires_approval'),
    meeting_url: r.meeting_url || '',
  }
}

export function buildBulkImportRows(rawRows: BulkImportRawRow[], shopId: string): BulkImportRow[] {
  return rawRows.map((raw, idx) => {
    const publishData = normaliseBulkImportRow(raw, shopId)
    const { valid, errors } = validateBulkImportRow(publishData)
    return {
      id: idx + 1,
      publishData,
      status: valid ? BULK_IMPORT_ROW_STATUS.PENDING : BULK_IMPORT_ROW_STATUS.FAILED,
      validationErrors: errors,
      currentStep: null,
      completedSteps: [],
      progressPct: 0,
      error: errors.length ? errors.join(' · ') : null,
      listingId: null,
    }
  })
}

// ─── File parsers ─────────────────────────────────────────────────────────────

export async function parseBulkImportCsv(text: string): Promise<BulkImportRawRow[]> {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'))

  if (lines.length < 2) return []

  const headers = lines[0].split(',').map((h) => h.replace(/^"|"$/g, '').trim())

  return lines.slice(1).map((line) => {
    const values: string[] = []
    let cur = ''
    let inQuote = false

    for (const ch of line) {
      if (ch === '"') inQuote = !inQuote
      else if (ch === ',' && !inQuote) {
        values.push(cur)
        cur = ''
      } else cur += ch
    }
    values.push(cur)

    return Object.fromEntries(
      headers.map((h, i) => [h, (values[i] || '').replace(/^"|"$/g, '').trim()]),
    )
  })
}

function parseExcelCellValue(cellValue: unknown): string {
  if (cellValue == null) return ''
  if (typeof cellValue === 'string') return cellValue.trim()
  if (typeof cellValue === 'number' || typeof cellValue === 'boolean') return String(cellValue).trim()
  if (cellValue instanceof Date) return cellValue.toISOString()

  if (typeof cellValue === 'object') {
    const obj = cellValue as Record<string, unknown>
    if (typeof obj.hyperlink === 'string' && obj.hyperlink.trim()) return obj.hyperlink.trim()
    if (typeof obj.text === 'string' && obj.text.trim()) return obj.text.trim()
    if (Array.isArray(obj.richText)) {
      const richText = obj.richText
        .map((part) => (part as { text?: string })?.text || '')
        .join('')
        .trim()
      if (richText) return richText
    }
    if (obj.result != null) return String(obj.result).trim()
  }

  return String(cellValue).trim()
}

export async function parseBulkImportExcel(buffer: ArrayBuffer): Promise<BulkImportRawRow[]> {
  const excelModule = await import('exceljs')
  const ExcelJS = excelModule.default || excelModule
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(buffer)

  const worksheet = workbook.worksheets[0]
  if (!worksheet) return []

  const headers: string[] = []
  worksheet.getRow(1).eachCell({ includeEmpty: true }, (cell, col) => {
    headers[col - 1] = parseExcelCellValue(cell.value)
  })

  const rows: BulkImportRawRow[] = []
  for (let rowNumber = 2; rowNumber <= worksheet.rowCount; rowNumber += 1) {
    const row = worksheet.getRow(rowNumber)
    const rowData: BulkImportRawRow = {}
    let hasAnyValue = false

    headers.forEach((header, index) => {
      if (!header) return
      const value = parseExcelCellValue(row.getCell(index + 1).value)
      if (value !== '') hasAnyValue = true
      rowData[header] = value
    })

    if (hasAnyValue) rows.push(rowData)
  }

  return rows
}

export async function parseBulkImportFile(file: File): Promise<BulkImportRawRow[]> {
  const lower = file.name.toLowerCase()
  if (lower.endsWith('.csv')) {
    return parseBulkImportCsv(await file.text())
  }
  if (lower.match(/\.xlsx?$/)) {
    return parseBulkImportExcel(await file.arrayBuffer())
  }
  return []
}

// ─── Template helpers ─────────────────────────────────────────────────────────

export function parseCsvTemplateLine(line: string): string[] {
  const values: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i]
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"'
        i += 1
      } else {
        inQuotes = !inQuotes
      }
    } else if (char === ',' && !inQuotes) {
      values.push(current.trim())
      current = ''
    } else {
      current += char
    }
  }

  values.push(current.trim())
  return values.map((value) => value.replace(/^"|"$/g, '').trim())
}

export function buildBulkImportCsvTemplateContent(): string {
  const ruleCommentLines = [
    '# BULK IMPORT RULES',
    ...getListingImageImportRuleMessages().map((warning) => `# - ${warning}`),
    '# For complete host allowlist, see the Rules sheet in the Excel template.',
  ]
  return [...ruleCommentLines, BULK_IMPORT_CSV_HEADER, BULK_IMPORT_CSV_SAMPLE].join('\n')
}

export function downloadBulkImportCsvTemplate(): void {
  if (typeof document === 'undefined') return
  const blob = new Blob([buildBulkImportCsvTemplateContent()], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = BULK_IMPORT_CONFIG.TEMPLATE_CSV_FILENAME
  anchor.click()
  URL.revokeObjectURL(url)
}

export async function downloadBulkImportExcelTemplate(): Promise<void> {
  if (typeof document === 'undefined') return

  try {
    const excelModule = await import('exceljs')
    const ExcelJS = excelModule.default || excelModule
    const workbook = new ExcelJS.Workbook()
    const worksheet = workbook.addWorksheet(BULK_IMPORT_CONFIG.TEMPLATE_SHEET_LISTINGS)

    const headers = parseCsvTemplateLine(BULK_IMPORT_CSV_HEADER)
    const sampleValues = parseCsvTemplateLine(BULK_IMPORT_CSV_SAMPLE)

    worksheet.columns = headers.map((header) => ({
      header,
      key: header,
      width: Math.max(16, header.length + 2),
    }))
    worksheet.addRow(sampleValues)
    worksheet.getRow(1).font = { bold: true }

    const rulesSheet = workbook.addWorksheet(BULK_IMPORT_CONFIG.TEMPLATE_SHEET_RULES)
    rulesSheet.columns = [
      { header: 'Area', key: 'area', width: 16 },
      { header: 'Rule', key: 'rule', width: 24 },
      { header: 'Requirement', key: 'requirement', width: 40 },
      { header: 'Allowed', key: 'allowed', width: 56 },
      { header: 'Not Allowed', key: 'notAllowed', width: 42 },
    ]

    getListingImageImportTemplateRuleRows().forEach((row) => {
      rulesSheet.addRow(row)
    })
    rulesSheet.getRow(1).font = { bold: true }
    rulesSheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      row.alignment = { vertical: 'top', wrapText: true }
      if (rowNumber > 1) row.height = 38
    })

    const buffer = await workbook.xlsx.writeBuffer()
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = BULK_IMPORT_CONFIG.TEMPLATE_XLSX_FILENAME
    anchor.click()
    URL.revokeObjectURL(url)
  } catch {
    downloadBulkImportCsvTemplate()
  }
}

export function recalcBulkImportOverall(rows: BulkImportRow[]) {
  const succeeded = rows.filter((r) => r.status === BULK_IMPORT_ROW_STATUS.SUCCESS).length
  const failed = rows.filter((r) => r.status === BULK_IMPORT_ROW_STATUS.FAILED).length
  const skipped = rows.filter((r) => r.status === BULK_IMPORT_ROW_STATUS.SKIPPED).length
  const processed = succeeded + failed + skipped
  return {
    total: rows.length,
    processed,
    succeeded,
    failed,
    skipped,
    pct: rows.length ? Math.round((processed / rows.length) * 100) : 0,
  }
}
