import {
  APPLIES_TO,
  BOGO_GET_DISCOUNT_TYPES,
  BOGO_TEMPLATES,
  DISCOUNT_TYPES,
  type BogoTemplateDefinition,
} from './discount.constants'
import type {
  AppliesTo,
  BogoRuleInput,
  DiscountFormInput,
  DiscountProfile,
  DiscountStats,
  DiscountType,
} from './discount.type'
import { formatDiscountDisplay, isDiscountValid } from './discount.utils'

export type DiscountHubTab = 'all' | 'active' | 'inactive' | 'expired'

export type DiscountSummaryCard = {
  id: string
  label: string
  value: string
  hint?: string
}

export type DiscountTypeOption = {
  value: DiscountType
  label: string
  hint?: string
}

export type AppliesToOption = {
  value: AppliesTo
  label: string
}

export type DiscountFormFieldVisibility = {
  showDiscountValue: boolean
  discountValueSuffix: 'percent' | 'currency' | null
  showMaxDiscountCap: boolean
  showAppliesTo: boolean
  showEligibleListings: boolean
  showEligibleCategories: boolean
  showBogoPanel: boolean
  showMinOrderAmount: boolean
}

export type BogoScopeMode = 'products' | 'categories'

export type DiscountBogoUiState = {
  scopeMode: BogoScopeMode
  sameAsBuy: boolean
}

export function getDiscountHubTabs(): Array<{ id: DiscountHubTab; label: string }> {
  return [
    { id: 'all', label: 'All' },
    { id: 'active', label: 'Active' },
    { id: 'inactive', label: 'Inactive' },
    { id: 'expired', label: 'Expired' },
  ]
}

export function buildDiscountSummaryCards(stats: DiscountStats): DiscountSummaryCard[] {
  return [
    { id: 'total', label: 'Total', value: String(stats.total) },
    { id: 'active', label: 'Active', value: String(stats.active) },
    { id: 'inactive', label: 'Inactive', value: String(stats.inactive) },
    { id: 'expired', label: 'Expired', value: String(stats.expired) },
  ]
}

export function filterDiscountsByTab(
  discounts: DiscountProfile[],
  tab: DiscountHubTab,
): DiscountProfile[] {
  const now = new Date()

  switch (tab) {
    case 'active':
      return discounts.filter((d) => d.is_active && isDiscountValid(d).valid)
    case 'inactive':
      return discounts.filter((d) => !d.is_active)
    case 'expired':
      return discounts.filter(
        (d) => d.valid_until != null && new Date(d.valid_until) < now,
      )
    default:
      return discounts
  }
}

export function filterDiscountsBySearch(
  discounts: DiscountProfile[],
  query: string,
): DiscountProfile[] {
  const term = query.trim().toLowerCase()
  if (!term) return discounts

  return discounts.filter((d) => {
    const name = d.discount_name?.toLowerCase() ?? ''
    const code = d.discount_code?.toLowerCase() ?? ''
    const description = d.description?.toLowerCase() ?? ''
    return name.includes(term) || code.includes(term) || description.includes(term)
  })
}

export function getDiscountTypeSelectOptions(): DiscountTypeOption[] {
  return [
    { value: DISCOUNT_TYPES.PERCENTAGE, label: 'Percentage off', hint: 'Applies a percentage reduction.' },
    { value: DISCOUNT_TYPES.FIXED, label: 'Fixed amount off', hint: 'Subtracts a fixed amount from the order.' },
    { value: DISCOUNT_TYPES.BOGO, label: 'Buy one get one (BOGO)', hint: 'Reward buyers when they purchase qualifying items.' },
    { value: DISCOUNT_TYPES.FREE_SHIPPING, label: 'Free shipping', hint: 'Waives shipping fees when conditions are met.' },
  ]
}

export function getAppliesToOptionsForType(discountType: DiscountType): AppliesToOption[] {
  switch (discountType) {
    case DISCOUNT_TYPES.FREE_SHIPPING:
      return [{ value: APPLIES_TO.SHIPPING, label: 'Shipping only' }]
    case DISCOUNT_TYPES.BOGO:
      return [{ value: APPLIES_TO.ITEM, label: 'Specific products (BOGO)' }]
    default:
      return [
        { value: APPLIES_TO.ORDER, label: 'Entire order' },
        { value: APPLIES_TO.ITEM, label: 'Specific items' },
        { value: APPLIES_TO.CATEGORY, label: 'Specific categories' },
      ]
  }
}

/** @deprecated Use getDiscountTypeSelectOptions */
export function getDiscountTypeOptions() {
  return getDiscountTypeSelectOptions().filter((o) => o.value !== DISCOUNT_TYPES.BOGO)
}

/** @deprecated Use getAppliesToOptionsForType */
export function getDiscountAppliesToOptions() {
  return getAppliesToOptionsForType(DISCOUNT_TYPES.PERCENTAGE).filter(
    (o) => o.value !== APPLIES_TO.CATEGORY,
  )
}

export function getDiscountFormFieldVisibility(
  discountType: DiscountType,
  appliesTo: AppliesTo,
): DiscountFormFieldVisibility {
  if (discountType === DISCOUNT_TYPES.BOGO) {
    return {
      showDiscountValue: false,
      discountValueSuffix: null,
      showMaxDiscountCap: false,
      showAppliesTo: false,
      showEligibleListings: false,
      showEligibleCategories: false,
      showBogoPanel: true,
      showMinOrderAmount: true,
    }
  }

  if (discountType === DISCOUNT_TYPES.FREE_SHIPPING) {
    return {
      showDiscountValue: false,
      discountValueSuffix: null,
      showMaxDiscountCap: false,
      showAppliesTo: false,
      showEligibleListings: false,
      showEligibleCategories: false,
      showBogoPanel: false,
      showMinOrderAmount: true,
    }
  }

  return {
    showDiscountValue: true,
    discountValueSuffix: discountType === DISCOUNT_TYPES.PERCENTAGE ? 'percent' : 'currency',
    showMaxDiscountCap: discountType === DISCOUNT_TYPES.PERCENTAGE,
    showAppliesTo: true,
    showEligibleListings: appliesTo === APPLIES_TO.ITEM,
    showEligibleCategories: appliesTo === APPLIES_TO.CATEGORY,
    showBogoPanel: false,
    showMinOrderAmount: true,
  }
}

export function applyDiscountTypeChange(
  current: DiscountFormInput,
  discountType: DiscountType,
): DiscountFormInput {
  const appliesOptions = getAppliesToOptionsForType(discountType)
  const nextAppliesTo = appliesOptions.some((o) => o.value === current.applies_to)
    ? current.applies_to
    : appliesOptions[0]?.value ?? APPLIES_TO.ORDER

  const patch: Partial<DiscountFormInput> = {
    discount_type: discountType,
    applies_to: nextAppliesTo,
  }

  if (discountType === DISCOUNT_TYPES.FREE_SHIPPING) {
    patch.discount_value = 0
    patch.applies_to = APPLIES_TO.SHIPPING
  } else if (discountType === DISCOUNT_TYPES.BOGO) {
    patch.discount_value = 0
    patch.applies_to = APPLIES_TO.ITEM
    patch.bogo_rule = current.bogo_rule ?? {
      buy_listing_ids: [],
      get_listing_ids: [],
      buy_categories: [],
      get_categories: [],
      buy_quantity: 1,
      get_quantity: 1,
      get_discount_type: BOGO_GET_DISCOUNT_TYPES.FREE,
      get_discount_value: 100,
    }
  } else if (discountType === DISCOUNT_TYPES.PERCENTAGE && !current.discount_value) {
    patch.discount_value = 10
  } else if (discountType === DISCOUNT_TYPES.FIXED && !current.discount_value) {
    patch.discount_value = 100
  }

  return { ...current, ...patch }
}

export function applyBogoTemplate(
  current: DiscountFormInput,
  template: BogoTemplateDefinition,
): { form: DiscountFormInput; ui: DiscountBogoUiState } {
  const { defaults } = template
  const useCategories =
    defaults.use_categories === true ||
    defaults.use_categories === 'buy_only' ||
    defaults.use_categories === 'get_only'
  const scopeMode: BogoScopeMode = useCategories ? 'categories' : 'products'

  const bogoRule: BogoRuleInput = {
    ...(current.bogo_rule ?? {}),
    buy_quantity: defaults.buy_quantity,
    get_quantity: defaults.get_quantity,
    get_discount_type: defaults.get_discount_type,
    get_discount_value: defaults.get_discount_value,
    template_id: template.id,
    buy_listing_ids: scopeMode === 'products' ? (current.bogo_rule?.buy_listing_ids ?? []) : [],
    get_listing_ids:
      scopeMode === 'products' && !defaults.same_buy_get
        ? (current.bogo_rule?.get_listing_ids ?? [])
        : [],
    buy_categories: scopeMode === 'categories' ? (current.bogo_rule?.buy_categories ?? []) : [],
    get_categories:
      scopeMode === 'categories' && !defaults.same_buy_get
        ? (current.bogo_rule?.get_categories ?? [])
        : [],
  }

  return {
    form: {
      ...current,
      discount_type: DISCOUNT_TYPES.BOGO,
      discount_value: 0,
      applies_to: APPLIES_TO.ITEM,
      bogo_rule: bogoRule,
    },
    ui: {
      scopeMode,
      sameAsBuy: defaults.same_buy_get,
    },
  }
}

export function getBogoTemplateList(): BogoTemplateDefinition[] {
  return Object.values(BOGO_TEMPLATES)
}

export function parseFormNumber(value: number | string | undefined | null): number | null {
  if (value === '' || value == null) return null
  const parsed = typeof value === 'number' ? value : Number(String(value).replace(/[^\d.-]/g, ''))
  return Number.isFinite(parsed) ? parsed : null
}

export function buildDiscountRowSubtitle(discount: DiscountProfile, currencySymbol: string): string {
  const display = formatDiscountDisplay(discount, 0, currencySymbol)
  const uses = discount.total_uses ?? 0
  const maxUses = discount.max_uses_total
  const usageText = maxUses ? `${uses}/${maxUses} uses` : `${uses} uses`
  const status = discount.is_active ? 'Active' : 'Inactive'
  const validUntil = discount.valid_until
    ? ` · until ${new Date(discount.valid_until).toLocaleDateString()}`
    : ''
  return `${display.display} · ${usageText} · ${status}${validUntil}`
}

export function buildDiscountExportRows(discounts: DiscountProfile[]) {
  return discounts.map((d) => ({
    id: d.id,
    name: d.discount_name,
    code: d.discount_code ?? '',
    type: d.discount_type,
    value: d.discount_value,
    applies_to: d.applies_to,
    active: d.is_active,
    uses: d.total_uses ?? 0,
    max_uses: d.max_uses_total ?? '',
    valid_from: d.valid_from,
    valid_until: d.valid_until ?? '',
  }))
}
