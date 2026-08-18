/** Platform PayU — default gateway when vendor has no own provider. */

export const PLATFORM_PAYU_EDGE_FUNCTIONS = {
  INITIATE: 'platform-payu-initiate',
  CHARGE: 'platform-payu-charge',
  VERIFY: 'platform-payu-verify',
  BIN: 'platform-payu-bin',
  CALLBACK: 'platform-payu-callback',
  WEBHOOK: 'platform-payu-webhook',
} as const

/** Server secret: PLATFORM_PAYU_ENV = live | test (independent of PAYU_ENV / SHEPay). Default live. */
export const PLATFORM_PAYU_ENV_MODES = ['live', 'test'] as const

export type PlatformPayuEnvMode = (typeof PLATFORM_PAYU_ENV_MODES)[number]

export const PLATFORM_PAYU_PROVIDER_TAG = 'platform_payu' as const

export type PlatformPayuCheckoutStatus =
  | 'idle'
  | 'initiating'
  | 'redirecting'
  | 'verifying'
  | 'success'
  | 'failed'
