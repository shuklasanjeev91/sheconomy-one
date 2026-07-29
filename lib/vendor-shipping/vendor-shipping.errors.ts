export const VENDOR_SHIPPING_ERROR_CODES = {
  NOT_AUTHENTICATED: 'NOT_AUTHENTICATED',
  SHOP_NOT_FOUND: 'SHOP_NOT_FOUND',
  SHOP_ACCESS_DENIED: 'SHOP_ACCESS_DENIED',
  SHIPROCKET_AUTH_FAILED: 'SHIPROCKET_AUTH_FAILED',
  SHIPROCKET_NOT_CONNECTED: 'SHIPROCKET_NOT_CONNECTED',
  SHIPROCKET_CONNECT_FAILED: 'SHIPROCKET_CONNECT_FAILED',
  SHIPROCKET_DISCONNECT_FAILED: 'SHIPROCKET_DISCONNECT_FAILED',
  PARTNER_CREATE_FAILED: 'PARTNER_CREATE_FAILED',
  PARTNER_LOAD_FAILED: 'PARTNER_LOAD_FAILED',
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  UNKNOWN: 'UNKNOWN',
} as const

export class VendorShippingError extends Error {
  code: (typeof VENDOR_SHIPPING_ERROR_CODES)[keyof typeof VENDOR_SHIPPING_ERROR_CODES]

  constructor(
    code: (typeof VENDOR_SHIPPING_ERROR_CODES)[keyof typeof VENDOR_SHIPPING_ERROR_CODES],
    message?: string,
  ) {
    super(message ?? code)
    this.name = 'VendorShippingError'
    this.code = code
  }
}

const FRIENDLY: Record<string, string> = {
  [VENDOR_SHIPPING_ERROR_CODES.NOT_AUTHENTICATED]: 'Please sign in to manage delivery settings.',
  [VENDOR_SHIPPING_ERROR_CODES.SHOP_NOT_FOUND]: 'Shop not found.',
  [VENDOR_SHIPPING_ERROR_CODES.SHOP_ACCESS_DENIED]: 'You do not have permission to manage this shop.',
  [VENDOR_SHIPPING_ERROR_CODES.SHIPROCKET_AUTH_FAILED]: 'Shiprocket authentication failed. Check your email and password.',
  [VENDOR_SHIPPING_ERROR_CODES.SHIPROCKET_NOT_CONNECTED]: 'Shiprocket is not connected.',
  [VENDOR_SHIPPING_ERROR_CODES.SHIPROCKET_CONNECT_FAILED]: 'Could not connect Shiprocket.',
  [VENDOR_SHIPPING_ERROR_CODES.SHIPROCKET_DISCONNECT_FAILED]: 'Could not disconnect Shiprocket.',
  [VENDOR_SHIPPING_ERROR_CODES.PARTNER_CREATE_FAILED]: 'Could not add custom shipping partner.',
  [VENDOR_SHIPPING_ERROR_CODES.PARTNER_LOAD_FAILED]: 'Could not load custom shipping partners.',
  [VENDOR_SHIPPING_ERROR_CODES.VALIDATION_FAILED]: 'Please fix the highlighted fields.',
  [VENDOR_SHIPPING_ERROR_CODES.UNKNOWN]: 'Something went wrong. Please try again.',
}

export function toFriendlyVendorShippingError(error: unknown, fallback?: string): string {
  if (error instanceof VendorShippingError) {
    return FRIENDLY[error.code] ?? error.message
  }
  if (error instanceof Error && error.message.trim()) {
    return error.message
  }
  if (typeof error === 'string' && error.trim()) {
    return error
  }
  return fallback ?? FRIENDLY[VENDOR_SHIPPING_ERROR_CODES.UNKNOWN]
}
