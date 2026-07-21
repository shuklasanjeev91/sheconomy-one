/** User-facing copy for vendor payment gateway UI — centralised, not hardcoded in components. */

export const PAYMENT_UI_COPY = {
  pageTitle: 'Payment Methods',
  pageSubtitle: 'Manage how you receive funds from your customers worldwide.',
  availableProviders: 'Available Providers',
  connectedProviders: 'Connected Providers',
  setupStatus: 'Setup Status',
  secureStatus: 'Secure Status',
  secureStatusValue: 'PCI-DSS Compliant',
  noProvidersWarning:
    'No payment providers connected. Connect at least one method to start accepting orders.',
  connectDrawerBack: 'Back to providers',
  secureStorageTitle: 'Secure Credential Storage',
  secureStorageBody:
    'Your credentials are encrypted at rest and in transit. We never store them in plain text, ensuring maximum security for your integration.',
  apiConfiguration: 'API Configuration',
  apiConfigurationHint: 'Configure your environment settings.',
  testModeWarning:
    'You are in Test Mode. Use your sandbox credentials. Transactions will not be processed with real money.',
  liveModeWarning:
    'You are in Live Mode. Real transactions will be processed. Double-check your credentials before connecting.',
  webhookHint: 'Endpoint to receive asynchronous payment status updates.',
  verificationTitle: 'Verification step',
  verificationBody:
    'After connecting, we validate your credentials and store them securely. You can run a local validation check before saving.',
  supportedMethodsPrefix: 'Supported payment methods via',
  runTest: 'Run validation check',
  testSuccess: 'Credentials look valid. You can connect this provider.',
  testFailed: 'Fix the highlighted fields before connecting.',
  cancel: 'Cancel',
  connectPrefix: 'Connect',
  configure: 'Configure',
  setupBankDetails: 'Setup Bank Details',
  connectProvider: 'Connect Provider',
  disconnect: 'Disconnect',
  providerConnected: 'Connected',
  providerPending: 'Pending',
  setupComplete: 'Ready',
  setupPending: 'Pending',
  setupPartial: 'In progress',
  region: 'Region',
  connection: 'Connection',
  settlement: 'Settlement',
  fees: 'Fees',
  environment: 'Environment',
  viewDocumentation: 'View documentation',
  loadError: 'Could not load payment settings.',
  connectSuccess: 'Payment provider connected.',
  connectFailed: 'Could not connect payment provider.',
  disconnectSuccess: 'Payment provider disconnected.',
  disconnectFailed: 'Could not disconnect payment provider.',
  searchProviders: 'Search providers',
  searchProvidersPlaceholder: 'Search by name, region, or payment method…',
  noSearchResults: 'No providers match your search. Try a different name or region.',
} as const

export const PAYMENT_CONNECTION_TYPE_LABELS = {
  oauth: 'OAuth',
  credential: 'API Key',
  manual: 'Manual',
} as const

export const PAYMENT_PROVIDER_BADGE_LABELS = {
  default: 'Recommended',
  global: 'Global',
  popular: 'Popular',
} as const

export function paymentConnectDescription(providerName: string): string {
  return `Enter your ${providerName} API credentials to securely connect your merchant account.`
}

export function paymentSearchResultsCount(shown: number, total: number): string {
  return `${shown} of ${total} providers`
}
