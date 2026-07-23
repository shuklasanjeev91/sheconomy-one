export const SHIPROCKET_PROVIDER_TYPE = 'shiprocket' as const
export const CUSTOM_PROVIDER_TYPE = 'custom' as const

export const SHIPROCKET_TOKEN_TTL_MS = 10 * 24 * 60 * 60 * 1000

export const VENDOR_SHIPPING_CACHE_TTL_MS = 30_000

export const DEFAULT_PICKUP_COUNTRY = 'India'

export const GETTING_STARTED_STEPS = [
  {
    id: 'connect-shiprocket',
    title: 'Connect Shiprocket',
    description:
      'If you have a Shiprocket account, connect it to access 17+ courier partners and automated shipping.',
    compactDescription: 'Link your Shiprocket account for 17+ couriers',
  },
  {
    id: 'add-custom',
    title: 'Add Custom Partners',
    description: 'If you work with specific courier services, add them as custom shipping partners.',
    compactDescription: 'Add specific courier services',
  },
  {
    id: 'set-priority',
    title: 'Set Priority',
    description: 'Configure which shipping provider should be used by default for your orders.',
    compactDescription: 'Choose default shipping provider',
  },
  {
    id: 'configure-rates',
    title: 'Configure Rates',
    description: 'Set up shipping rates based on weight, distance, and zones for accurate shipping cost calculation.',
    compactDescription: 'Set up shipping cost calculation',
  },
] as const

export const SHIPROCKET_FEATURES = [
  'Access to 17+ courier partners',
  'Automated shipping label generation',
  'Real-time tracking and updates',
  'Lowest shipping rates guaranteed',
  'COD remittance and NDR management',
] as const

export const CUSTOM_PARTNER_SELECT = `
  *,
  shipping_providers:shipping_provider_id (
    id,
    provider_name,
    is_active,
    is_primary,
    priority
  )
` as const
