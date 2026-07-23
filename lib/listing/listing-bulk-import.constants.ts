import { LISTING_TYPES, LISTING_VALIDATION } from './listing.type'

/** Bulk import tuning — centralised so UI and store stay in sync. */
export const BULK_IMPORT_CONFIG = {
  CONCURRENCY: 2,
  MAX_FILE_BYTES: 10 * 1024 * 1024,
  IMAGE_SLOTS: 5,
  VARIATION_SLOTS: 3,
  ATTRIBUTE_SLOTS: 5,
  MATERIAL_SLOTS: 3,
  /** Progress weight per orchestrator step while publishing (caps at PROGRESS_CAP). */
  PROGRESS_STEP_WEIGHT: 11,
  PROGRESS_CAP: 95,
  DEFAULT_LISTING_TYPE: LISTING_TYPES.PHYSICAL,
  DEFAULT_QUANTITY: 1,
  DEFAULT_DIMENSION_UNIT: 'cm',
  DEFAULT_SHIPPING_REQUIRED: true,
  DEFAULT_MAX_ATTENDEES: 1,
  TEMPLATE_CSV_FILENAME: 'listing_bulk_import_template.csv',
  TEMPLATE_XLSX_FILENAME: 'listing_bulk_import_template.xlsx',
  TEMPLATE_SHEET_LISTINGS: 'Listings',
  TEMPLATE_SHEET_RULES: 'Rules',
} as const

export const BULK_IMPORT_TITLE_LIMITS = LISTING_VALIDATION.TITLE

/** CSV template header (physical product example). */
export const BULK_IMPORT_CSV_HEADER =
  'title,description,price,listing_type,stock,quantity,sku,category,tags,is_featured,slug,weight,dimension_width,dimension_height,dimension_depth,dimension_unit,shipping_required,image_url_1,image_alt_1,image_url_2,variation_name_1,variation_value_1,variation_price_adjustment_1,variation_stock_1,attr_name_1,attr_value_1,material_name_1,material_percentage_1,shop_section_ids'

export const BULK_IMPORT_CSV_SAMPLE =
  '"My Product","Product description here",19.99,physical,10,1,SKU-001,Home & Living,"handmade,gift",false,my-product,0.5,10,10,10,cm,true,https://example.com/image.jpg,Product image,,,,,,Material,Cotton,Cotton,100,'

export const BULK_IMPORT_ACCEPTED_EXTENSIONS = ['.csv', '.xlsx', '.xls'] as const

export const BULK_IMPORT_REQUIRED_FIELD_HINTS = [
  'Title must be between 3 and 200 characters',
  'Description is required',
  'listing_type must be physical, digital, or service',
  'At least one image_url is required (HTTPS direct link)',
  'At least one material is required for physical products',
  'At least one product variation is required for physical products',
  'digital_file_url is required for digital listings',
  'booking_duration_minutes is required for service listings',
] as const
