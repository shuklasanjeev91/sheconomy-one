import { z } from 'zod'

import {
  DEFAULT_EXPORT_CONFIG,
  DEFAULT_SALES_ANALYTICS_FILTERS,
  DEFAULT_SALES_ANALYTICS_PAGINATION,
  DEFAULT_SALES_ANALYTICS_SORTING,
  DELIVERY_STATUS_VALUES,
  EXPORT_FORMAT_VALUES,
  PAYMENT_MODE_VALUES,
  SALES_ANALYTICS_VALIDATION,
  SALES_DATE_RANGE_VALUES,
  SALES_DATE_TYPE_VALUES,
  SALES_SORT_BY_VALUES,
  SALES_SORT_ORDER_VALUES,
  SALES_STATUS_VALUES,
} from '~/lib/sales-analytics/sales-analytics.constants'
import type {
  SalesAnalyticsCreateInput,
  SalesAnalyticsFilterInput,
  SalesAnalyticsRefundStatusInput,
  SalesAnalyticsReturnStatusInput,
  SalesAnalyticsValidationResult,
  SalesExportConfig,
} from '~/lib/sales-analytics/sales-analytics.type'

// ============= PRIMITIVE SCHEMAS =============

export const salesDateRangeSchema = z.enum(SALES_DATE_RANGE_VALUES)
export const salesStatusSchema = z.enum(SALES_STATUS_VALUES)
export const paymentModeSchema = z.enum(PAYMENT_MODE_VALUES)
export const deliveryStatusSchema = z.enum(DELIVERY_STATUS_VALUES)
export const exportFormatSchema = z.enum(EXPORT_FORMAT_VALUES)
export const salesDateTypeSchema = z.enum(SALES_DATE_TYPE_VALUES)
export const salesSortBySchema = z.enum(SALES_SORT_BY_VALUES)
export const salesSortOrderSchema = z.enum(SALES_SORT_ORDER_VALUES)

const optionalFilterEnum = <T extends readonly [string, ...string[]]>(values: T) =>
  z.union([z.enum(values), z.literal('all')]).nullable().optional()

const isoDateSchema = z
  .string()
  .trim()
  .min(1)
  .refine((value) => !Number.isNaN(Date.parse(value)), 'Invalid date format.')

// ============= FILTER SCHEMA =============

export const salesAnalyticsFilterSchema = z
  .object({
    dateRange: salesDateRangeSchema.nullable().optional(),
    startDate: z.string().nullable().optional(),
    endDate: z.string().nullable().optional(),
    saleStatus: optionalFilterEnum(SALES_STATUS_VALUES),
    paymentMode: optionalFilterEnum(PAYMENT_MODE_VALUES),
    deliveryStatus: optionalFilterEnum(DELIVERY_STATUS_VALUES),
    region: z
      .string()
      .max(SALES_ANALYTICS_VALIDATION.SEARCH_TERM.MAX_LENGTH, 'Region is too long.')
      .nullable()
      .optional(),
    category: z.string().nullable().optional(),
    isReturned: z.boolean().nullable().optional(),
    isRefunded: z.boolean().nullable().optional(),
    searchTerm: z
      .string()
      .max(SALES_ANALYTICS_VALIDATION.SEARCH_TERM.MAX_LENGTH, 'Search term is too long.')
      .nullable()
      .optional(),
    dateType: salesDateTypeSchema.default('delivered_at'),
    page: z.coerce.number().int().min(SALES_ANALYTICS_VALIDATION.PAGE.MIN).default(1),
    limit: z.coerce
      .number()
      .int()
      .min(SALES_ANALYTICS_VALIDATION.LIMIT.MIN)
      .default(DEFAULT_SALES_ANALYTICS_PAGINATION.limit),
    sortBy: salesSortBySchema.default(DEFAULT_SALES_ANALYTICS_SORTING.sortBy),
    sortOrder: salesSortOrderSchema.default(DEFAULT_SALES_ANALYTICS_SORTING.sortOrder),
    forExport: z.boolean().optional(),
  })
  .superRefine((value, ctx) => {
    if (value.startDate && value.endDate) {
      const start = new Date(value.startDate)
      const end = new Date(value.endDate)

      if (start > end) {
        ctx.addIssue({
          code: 'custom',
          message: 'Start date cannot be after end date.',
          path: ['startDate'],
        })
      }

      if (end.getTime() - start.getTime() > SALES_ANALYTICS_VALIDATION.MAX_DATE_RANGE_MS) {
        ctx.addIssue({
          code: 'custom',
          message: 'Date range cannot exceed 2 years.',
          path: ['endDate'],
        })
      }
    }

    const maxLimit = value.forExport
      ? SALES_ANALYTICS_VALIDATION.LIMIT.EXPORT_MAX
      : SALES_ANALYTICS_VALIDATION.LIMIT.MAX

    if (value.limit > maxLimit) {
      ctx.addIssue({
        code: 'custom',
        message: value.forExport
          ? `Export limit cannot exceed ${SALES_ANALYTICS_VALIDATION.LIMIT.EXPORT_MAX}.`
          : `Limit must be between ${SALES_ANALYTICS_VALIDATION.LIMIT.MIN} and ${SALES_ANALYTICS_VALIDATION.LIMIT.MAX}.`,
        path: ['limit'],
      })
    }
  })

export const salesAnalyticsExportConfigSchema = z
  .object({
    format: exportFormatSchema,
    dateRange: z.union([salesDateRangeSchema, z.literal('CUSTOM_RANGE')]).nullable().optional(),
    startDate: z.string().nullable().optional(),
    endDate: z.string().nullable().optional(),
    includeDetails: z.boolean().default(true),
    includeReturns: z.boolean().default(true),
    includeRefunds: z.boolean().default(true),
    saleStatus: optionalFilterEnum(SALES_STATUS_VALUES),
    paymentMode: optionalFilterEnum(PAYMENT_MODE_VALUES),
    region: z.string().nullable().optional(),
  })
  .superRefine((value, ctx) => {
    if (value.dateRange === 'CUSTOM_RANGE') {
      if (!value.startDate || !value.endDate) {
        ctx.addIssue({
          code: 'custom',
          message: 'Both start and end dates are required for a custom range.',
          path: ['startDate'],
        })
        return
      }

      const start = new Date(value.startDate)
      const end = new Date(value.endDate)

      if (start > end) {
        ctx.addIssue({
          code: 'custom',
          message: 'Start date cannot be after end date.',
          path: ['startDate'],
        })
      }
    }
  })

export const salesAnalyticsCreateSchema = z.object({
  order_item_id: z.string().uuid('A valid order item is required.'),
})

export const salesAnalyticsReturnStatusSchema = z.object({
  order_item_id: z.string().uuid('A valid order item is required.'),
  is_returned: z.boolean(),
  return_reason: z.string().max(500, 'Return reason is too long.').nullable().optional(),
})

export const salesAnalyticsRefundStatusSchema = z.object({
  order_item_id: z.string().uuid('A valid order item is required.'),
  refund_amount: z.coerce.number().min(0, 'Refund amount must be 0 or greater.'),
  refund_status: z.enum([
    'requested',
    'processing',
    'approved',
    'completed',
    'rejected',
    'cancelled',
  ] as const),
})

export const salesAnalyticsExportParamsSchema = z.object({
  shopId: z.string().uuid('A valid shop is required.'),
  format: exportFormatSchema,
  filters: salesAnalyticsFilterSchema.optional(),
})

// ============= HELPERS =============

function zodErrorsToValidationResult(error: z.ZodError): SalesAnalyticsValidationResult {
  const errors: Record<string, string> = {}
  const fieldErrors: string[] = []

  for (const issue of error.issues) {
    const path = issue.path.join('.') || 'form'
    if (!errors[path]) errors[path] = issue.message
    fieldErrors.push(issue.message)
  }

  return { isValid: false, errors, fieldErrors }
}

export function buildDefaultSalesAnalyticsFilters(): SalesAnalyticsFilterInput {
  return { ...DEFAULT_SALES_ANALYTICS_FILTERS }
}

export function buildDefaultExportConfig(): SalesExportConfig {
  return { ...DEFAULT_EXPORT_CONFIG }
}

export function parseSalesAnalyticsFilter(
  filters: SalesAnalyticsFilterInput = {},
): SalesAnalyticsFilterInput {
  return salesAnalyticsFilterSchema.parse(filters)
}

export function validateSalesAnalyticsFilter(
  filters: SalesAnalyticsFilterInput = {},
): SalesAnalyticsValidationResult {
  const result = salesAnalyticsFilterSchema.safeParse(filters)
  if (result.success) return { isValid: true, errors: {}, fieldErrors: [] }
  return zodErrorsToValidationResult(result.error)
}

export function parseSalesAnalyticsExportConfig(config: SalesExportConfig): SalesExportConfig {
  return salesAnalyticsExportConfigSchema.parse(config)
}

export function validateSalesAnalyticsExportConfig(
  config: SalesExportConfig,
): SalesAnalyticsValidationResult {
  const result = salesAnalyticsExportConfigSchema.safeParse(config)
  if (result.success) return { isValid: true, errors: {}, fieldErrors: [] }
  return zodErrorsToValidationResult(result.error)
}

export function parseSalesAnalyticsCreate(input: SalesAnalyticsCreateInput): SalesAnalyticsCreateInput {
  return salesAnalyticsCreateSchema.parse(input)
}

export function parseSalesAnalyticsReturnStatus(
  input: SalesAnalyticsReturnStatusInput,
): SalesAnalyticsReturnStatusInput {
  return salesAnalyticsReturnStatusSchema.parse(input)
}

export function parseSalesAnalyticsRefundStatus(
  input: SalesAnalyticsRefundStatusInput,
): SalesAnalyticsRefundStatusInput {
  return salesAnalyticsRefundStatusSchema.parse(input)
}

export function validateSalesAnalyticsExportParams(
  shopId: string,
  format: SalesExportConfig['format'],
  filters?: SalesAnalyticsFilterInput,
): SalesAnalyticsValidationResult {
  const result = salesAnalyticsExportParamsSchema.safeParse({ shopId, format, filters })
  if (result.success) return { isValid: true, errors: {}, fieldErrors: [] }
  return zodErrorsToValidationResult(result.error)
}

export { isoDateSchema }
