/** User-facing copy for vendor payment gateway UI — centralised, not hardcoded in components. */

export const PAYMENT_UI_COPY = {
  pageTitle: 'Get paid',
  pageSubtitle: 'Connect PayU once — then money from orders comes to you automatically.',
  availableProviders: 'Available Providers',
  connectedProviders: 'Connected Providers',
  setupStatus: 'Setup Status',
  secureStatus: 'Secure Status',
  secureStatusValue: 'PCI-DSS Compliant',
  statusReadyTitle: 'SHEPay is active',
  statusReadyBody:
    'Buyers can pay online. After each paid order, your share is released to your child merchant right away. Bank credit typically follows T+1.',
  statusNeededTitle: 'Connect SHEPay to receive payouts',
  statusNeededBody:
    'Buyers can still purchase your products. Until you connect, your share is held securely and transfers automatically once SHEPay is connected.',
  statusIncompleteTitle: 'Finish SHEPay setup',
  statusIncompleteBody:
    'Your account is connected, but Child MID is missing. Add it so held and new settlements can be released to your bank.',
  howItWorksTitle: 'How it works',
  howItWorksSteps: [
    'Buyers can pay you even before SHEPay is connected',
    'Connect with your existing PayU key & MID, or set up new with PayU',
    'Held amounts transfer automatically; new orders release right after payment',
  ] as const,
  withoutConnectionTitle: 'Before you connect',
  withoutConnectionBody:
    'Orders still go through. Your payout stays on hold with SHEconomy and moves to your child merchant as soon as you connect SHEPay.',
  heldTitle: 'Amount on hold',
  heldEmpty: 'No held payouts right now.',
  heldHint: 'These paid orders will transfer automatically when SHEPay is connected.',
  connectCta: 'Connect SHEPay',
  manageCta: 'Manage connection',
  finishSetupCta: 'Finish setup',
  shepayEasyTitle: 'New to PayU?',
  shepayEasyBody:
    'Complete PayU setup once. Then we’ll fetch your merchant key, MID, and webhook for you.',
  shepayChooseTitle: 'Connect SHEPay',
  shepayChooseBody: 'Choose the option that matches you. Both ways get you paid the same.',
  shepayExistingTitle: 'I already have a PayU account',
  shepayExistingBody:
    'Enter your PayU merchant key and MID. Webhook is filled automatically.',
  shepayExistingManageTitle: 'Your PayU account',
  shepayExistingFormBody:
    'Use the merchant key and MID from your PayU dashboard. We’ll save them securely and set the webhook for you.',
  shepayConnectExisting: 'Connect my PayU account',
  shepaySaveExisting: 'Save PayU details',
  shepayNewTitle: 'I’m new — set up with PayU',
  shepayNewBody: 'We’ll guide you through PayU, then fetch your details automatically.',
  shepayBackToChoose: 'Back',
  shepaySwitchToExisting: 'I already have a PayU account',
  shepaySwitchToNew: 'I’m new — set up with PayU instead',
  shepayStep1Title: 'Complete PayU setup',
  shepayStep2Title: 'Fetch & activate',
  shepayStep2Body:
    'When PayU setup is done, tap below. We’ll pull your merchant key, MID, and webhook automatically.',
  shepayOpenPayu: 'Open PayU setup',
  shepayFetchActivate: 'Fetch my details & activate',
  shepayFetching: 'Fetching from PayU…',
  shepayFetchFailed: 'Could not fetch SHEPay details yet',
  shepayShopCodeLabel: 'Your shop code',
  shepayShopCodeHint: 'If PayU asks for a shop / partner code, paste this.',
  shepayHubMissing:
    'Automatic fetch isn’t enabled yet. Choose “I already have a PayU account” and enter your key and MID, or contact SHEconomy support.',
  shepayManualLink: 'Enter details manually instead',
  shepayBackToEasy: 'Back to easy setup',
  settlementsTitle: 'Recent settlements',
  settlementsEmpty: 'No settlements yet. They appear here after a buyer pays.',
  settlementsHint: 'Connected shops get an immediate release after payment confirmation.',
  noProvidersWarning:
    'SHEPay is not connected yet. Buyers can still purchase — connect to receive held and future payouts.',
  connectDrawerBack: 'Back',
  secureStorageTitle: 'Secure Credential Storage',
  secureStorageBody:
    'Your credentials are encrypted at rest and in transit. We never store them in plain text.',
  apiConfiguration: 'Account details',
  apiConfigurationHint: 'Enter the details from your payment provider dashboard.',
  testModeWarning:
    'You are in Test Mode. Use your sandbox credentials. Transactions will not be processed with real money.',
  liveModeWarning:
    'Live mode — real transactions will be processed. Double-check your credentials before connecting.',
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
  connectProvider: 'Connect SHEPay',
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
  connectSuccess: 'SHEPay connected. Any held payouts will transfer automatically.',
  connectFailed: 'Could not connect SHEPay.',
  disconnectSuccess: 'SHEPay disconnected.',
  disconnectFailed: 'Could not disconnect SHEPay.',
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
  if (providerName === 'SHEPay') {
    return 'Connect an existing PayU account, or set up a new one — we handle the webhook.'
  }
  return `Enter your ${providerName} API credentials to securely connect your merchant account.`
}

export function paymentSearchResultsCount(shown: number, total: number): string {
  return `${shown} of ${total} providers`
}
