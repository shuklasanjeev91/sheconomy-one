/** User-facing copy for vendor payout UI — white-labeled (no gateway brand names). */

export const PAYMENT_UI_COPY = {
  pageTitle: 'Get paid',
  pageSubtitle:
    'Submit your payout details once. After review, money from orders comes to you automatically.',
  availableProviders: 'Available options',
  connectedProviders: 'Connected',
  setupStatus: 'Setup Status',
  secureStatus: 'Secure Status',
  secureStatusValue: 'PCI-DSS Compliant',
  statusReadyTitle: 'Payouts are active',
  statusReadyBody:
    'Buyers pay online securely. After each paid order, your share settles to your bank (0% platform fee on item price).',
  statusNeededTitle: 'Submit payout details',
  statusNeededBody:
    'Add your legal entity, contact, and address. After review we create your payout account so settlements can release.',
  statusIncompleteTitle: 'Payout setup is in progress',
  statusIncompleteBody:
    'Your details are with SHEconomy for verification. You can sell once payout verification is complete.',
  howItWorksTitle: 'How it works',
  howItWorksSteps: [
    'Submit your legal entity, contact, and address here',
    'SHEconomy reviews and creates your payout account',
    'Once verified, each paid order settles to you automatically',
  ] as const,
  withoutConnectionTitle: 'Before you connect',
  withoutConnectionBody:
    'Orders still go through. Complete payout verification so settlements can release to your bank.',
  heldTitle: 'Amount on hold',
  heldEmpty: 'No held payouts right now.',
  heldHint:
    'Payouts stay held until the order is delivered, the return window ends, and there is no open dispute.',
  connectCta: 'Set up payouts',
  manageCta: 'Manage connection',
  finishSetupCta: 'Finish setup',
  shepayEasyTitle: 'New to payouts?',
  shepayEasyBody: 'Complete verification once. We handle onboarding and settlement.',
  shepayChooseTitle: 'Set up payouts',
  shepayChooseBody: 'Submit verification so buyers can pay and you get paid.',
  shepayExistingTitle: 'I already have a payout account',
  shepayExistingBody: 'Contact support to link an existing payout account.',
  shepayExistingManageTitle: 'Your payout account',
  shepayExistingFormBody: 'Use the payout verification form on this page.',
  shepayConnectExisting: 'Connect payout account',
  shepaySaveExisting: 'Save payout details',
  shepayNewTitle: 'I’m new — set up payouts',
  shepayNewBody: 'We’ll guide you through payout verification.',
  shepayBackToChoose: 'Back',
  shepaySwitchToExisting: 'I already have a payout account',
  shepaySwitchToNew: 'I’m new — set up payouts instead',
  shepayStep1Title: 'Complete payout verification',
  shepayStep2Title: 'Fetch & activate',
  shepayStep2Body: 'When verification is done, your shop can settle automatically.',
  shepayOpenPayu: 'Open payout setup',
  shepayFetchActivate: 'Refresh status',
  shepayFetching: 'Refreshing…',
  shepayFetchFailed: 'Could not refresh payout status yet',
  shepayShopCodeLabel: 'Your shop code',
  shepayShopCodeHint: 'Share this with support if asked.',
  shepayHubMissing: 'Contact SHEconomy support to finish payout onboarding.',
  shepayManualLink: 'Enter details on this page',
  shepayBackToEasy: 'Back',
  settlementsTitle: 'Recent settlements',
  settlementsEmpty: 'No settlements yet. They appear here after a buyer pays.',
  settlementsHint:
    'Connected shops settle at payment, then release after delivery + return window with no open dispute (0% platform fee).',
  noProvidersWarning:
    'Payouts are not connected yet. Buyers can still purchase — finish verification so settlements can release to you.',
  connectDrawerBack: 'Back',
  secureStorageTitle: 'Secure Credential Storage',
  secureStorageBody:
    'Your credentials are encrypted at rest and in transit. We never store them in plain text.',
  apiConfiguration: 'Account details',
  apiConfigurationHint: 'Enter the details from your payout dashboard.',
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
  connectProvider: 'Set up payouts',
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
  connectSuccess:
    'Payouts connected. Eligible held payouts (past delivery + return window, no dispute) will release automatically.',
  connectFailed: 'Could not connect payouts.',
  disconnectSuccess: 'Payouts disconnected.',
  disconnectFailed: 'Could not disconnect payouts.',
  searchProviders: 'Search options',
  searchProvidersPlaceholder: 'Search by name, region, or payment method…',
  noSearchResults: 'No options match your search. Try a different name or region.',
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
    return 'Submit payout verification so buyers can pay and you get settled.'
  }
  return `Enter your account details to securely connect payouts.`
}

export function paymentSearchResultsCount(shown: number, total: number): string {
  return `${shown} of ${total} options`
}
