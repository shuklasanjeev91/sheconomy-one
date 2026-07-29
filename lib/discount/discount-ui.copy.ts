export const DISCOUNT_UI_COPY = {
  screenTitle: 'Promotions & discounts',
  screenSubtitle: (shopName: string) => `Manage coupons and offers for ${shopName}`,
  noShopTitle: 'No shop yet',
  noShopBody: 'Create a shop first to manage discounts and promotions.',
  loadError: 'Could not load discounts',
  refreshSuccess: 'Discounts refreshed',
  createSuccess: 'Discount created',
  createError: 'Could not create discount',
  updateSuccess: 'Discount updated',
  updateError: 'Could not update discount',
  deleteSuccess: 'Discount deleted',
  deleteError: 'Could not delete discount',
  toggleActiveSuccess: (active: boolean) => (active ? 'Discount activated' : 'Discount deactivated'),
  hubErrorTitle: 'Discounts unavailable',
  emptyList: 'No discounts match your filters.',
  emptyListHint: 'Create a promotion to attract buyers with coupon codes.',
  exportEmpty: 'No discounts to export',
  exportSuccess: 'Export ready',
  createPanelTitle: 'Create discount',
  listPanelTitle: 'Your discounts',
  filtersTitle: 'Filters',
  searchPlaceholder: 'Search by name or code…',
  createPage: {
    backLabel: 'Back to discounts',
    title: 'Create new discount',
    subtitle: 'Set up promotional discounts and upload marketing posters.',
    createButton: 'Create discount',
    cancelButton: 'Cancel',
    saveFirstHint: 'Save the discount first to upload marketing posters.',
    steps: {
      details: 'Discount details',
      posters: 'Marketing posters',
      postersLocked: '(Save first)',
    },
    sections: {
      basic: 'Basic information',
      valueRules: 'Discount value & rules',
      bogo: 'BOGO configuration',
      usage: 'Usage limits',
      advanced: 'Advanced settings',
      advancedHint: 'Date ranges, customer eligibility, and activation settings',
      optional: 'Optional',
    },
  },
  tabs: {
    all: 'All',
    active: 'Active',
    inactive: 'Inactive',
    expired: 'Expired',
  },
  form: {
    name: 'Discount name',
    nameHint: 'A clear, descriptive name for internal use',
    namePlaceholder: 'e.g., Summer Sale 2024',
    code: 'Discount code',
    codeHint: "First enter a name, then click 'Generate' to create a code",
    codePlaceholder: 'SUMMER2024',
    generateCode: 'Generate',
    description: 'Description',
    descriptionHint: 'Optional customer-facing description',
    descriptionPlaceholder: 'Describe this discount offer to customers…',
    type: 'Discount type',
    typePlaceholder: 'Select discount type',
    value: 'Discount value',
    valuePercentHint: 'Enter percentage (0–100)',
    valueFixedHint: 'Enter fixed amount off',
    maxCap: 'Maximum discount cap',
    maxCapHint: 'Optional: cap the maximum discount amount',
    appliesTo: 'Applies to',
    appliesToPlaceholder: 'Select where this discount applies',
    minOrder: 'Minimum order amount',
    minOrderHint: 'Optional: minimum cart value required',
    maxUses: 'Total usage limit',
    maxUsesHint: 'Leave empty for unlimited uses',
    maxUsesPerCustomer: 'Uses per customer',
    maxUsesPerCustomerHint: 'How many times each customer can use this',
    validFrom: 'Valid from',
    validUntil: 'Valid until',
    eligibleUsers: 'Eligible customers',
    activeOnCreate: 'Activate immediately',
    create: 'Create discount',
    eligibleListings: 'Eligible products',
    eligibleCategories: 'Eligible categories',
    searchProducts: 'Search products by name or SKU…',
    searchCategories: 'Search categories…',
    bogoTemplates: 'Quick templates',
    bogoScopeProducts: 'Products',
    bogoScopeCategories: 'Categories',
    bogoBuy: 'Buy products',
    bogoGet: 'Get products (free / discounted)',
    bogoSameAsBuy: "Same as 'Buy' selection (applies to cheapest item)",
    bogoBuyQty: 'Buy quantity',
    bogoGetQty: 'Get quantity',
    bogoGetDiscount: "Discount on 'Get' items",
    bogoGetFree: 'Free (100% off)',
    bogoGetPercent: 'Percentage off',
  },
  types: {
    percentage: 'Percentage off',
    fixed: 'Fixed amount off',
    bogo: 'Buy one get one (BOGO)',
    free_shipping: 'Free shipping',
  },
  appliesTo: {
    order: 'Entire order',
    item: 'Specific items',
    shipping: 'Shipping only',
    category: 'Specific categories',
  },
  actions: {
    activate: 'Activate',
    deactivate: 'Deactivate',
    delete: 'Delete',
    refresh: 'Refresh',
    export: 'Export CSV',
    createNew: 'Create new discount',
  },
} as const
