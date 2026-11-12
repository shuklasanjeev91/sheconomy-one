/**
 * Normalize PayU get_checkout_details into accordion sections for checkout.
 */

import {
  PAYU_CARD_OPTIONS,
  PAYU_NB_OPTIONS,
  PAYU_UPI_OPTIONS,
  PAYU_WALLET_OPTIONS,
  type PayuPaymentMode,
  type PayuPaymentModeId,
} from '~/commerce/lib/payu-payment-modes'

export type PayuCheckoutInstrument = {
  bankcode: string
  title: string
  shortName?: string | null
  isDown?: boolean
  tenure?: number | null
  monthlyEmi?: number | null
  minimumAmount?: number | null
}

export type PayuCheckoutDetailsPayload = {
  upi?: { enabled?: boolean; isDown?: boolean }
  cards?: { enabled?: boolean }
  netbanking?: PayuCheckoutInstrument[]
  wallets?: PayuCheckoutInstrument[]
  emi?: PayuCheckoutInstrument[]
  bnpl?: PayuCheckoutInstrument[]
  paypal?: boolean
  pluxee?: boolean
  neft?: boolean
  error?: string
}

export type PayuCheckoutSectionId =
  | 'upi'
  | 'cards'
  | 'netbanking'
  | 'wallets'
  | 'emi'
  | 'bnpl'
  | 'paypal'
  | 'pluxee'
  | 'neft'

export type PayuCheckoutSection = {
  id: PayuCheckoutSectionId
  title: string
  hint: string
  options: PayuPaymentMode[]
}

const UPI_OPTIONS_ORDERED: PayuPaymentMode[] = [
  ...PAYU_UPI_OPTIONS.filter((o) => o.id === 'upi_gpay'),
  ...PAYU_UPI_OPTIONS.filter((o) => o.id === 'upi_phonepe'),
  ...PAYU_UPI_OPTIONS.filter((o) => o.id === 'upi_paytm'),
  ...PAYU_UPI_OPTIONS.filter((o) => o.id === 'upi_qr'),
  ...PAYU_UPI_OPTIONS.filter((o) => o.id === 'upi_collect'),
  ...PAYU_UPI_OPTIONS.filter((o) => o.id === 'upi_intent'),
]

function instrumentToMode(
  prefix: 'nb' | 'wallet' | 'emi' | 'bnpl',
  row: PayuCheckoutInstrument,
  pg: string,
): PayuPaymentMode {
  const id = `${prefix}_${row.bankcode.toLowerCase()}` as PayuPaymentModeId
  return {
    id,
    label: row.title,
    shortLabel: row.shortName?.trim() || row.title,
    pg,
    bankcode: row.bankcode.toUpperCase(),
    seamlessS2s: false,
  }
}

/** Static fallback when PayU details are unavailable. */
export function buildFallbackPayuCheckoutSections(): PayuCheckoutSection[] {
  return [
    {
      id: 'upi',
      title: 'UPI',
      hint: 'Google Pay, PhonePe, Paytm & more',
      options: UPI_OPTIONS_ORDERED,
    },
    {
      id: 'cards',
      title: 'Credit / Debit card',
      hint: 'Visa, Mastercard, RuPay & more',
      options: PAYU_CARD_OPTIONS,
    },
    {
      id: 'netbanking',
      title: 'Net banking',
      hint: 'All banks enabled on your PayU account',
      options: PAYU_NB_OPTIONS,
    },
    {
      id: 'wallets',
      title: 'Wallets',
      hint: 'MobiKwik, Ola Money & more',
      options: PAYU_WALLET_OPTIONS,
    },
    {
      id: 'emi',
      title: 'EMI',
      hint: 'Credit / debit card & cardless EMI',
      options: [
        { id: 'emi', label: 'EMI', shortLabel: 'EMI', pg: 'EMI', bankcode: 'EMI', seamlessS2s: false },
      ],
    },
    {
      id: 'bnpl',
      title: 'Buy Now Pay Later',
      hint: 'LazyPay and other BNPL partners',
      options: [
        {
          id: 'bnpl',
          label: 'Buy Now Pay Later',
          shortLabel: 'BNPL',
          pg: 'BNPL',
          bankcode: 'LAZYPAY',
          seamlessS2s: false,
        },
      ],
    },
    {
      id: 'paypal',
      title: 'PayPal',
      hint: 'Pay with your PayPal balance',
      options: [
        {
          id: 'paypal',
          label: 'PayPal',
          shortLabel: 'PayPal',
          pg: 'PAYPAL',
          bankcode: 'PAYPAL',
          seamlessS2s: false,
        },
      ],
    },
    {
      id: 'pluxee',
      title: 'Pluxee (Sodexo)',
      hint: 'Meal / gift cards',
      options: [
        {
          id: 'pluxee',
          label: 'Pluxee (Sodexo)',
          shortLabel: 'Pluxee',
          pg: 'MC',
          bankcode: 'SODEXO',
          seamlessS2s: false,
        },
      ],
    },
    {
      id: 'neft',
      title: 'NEFT / RTGS',
      hint: 'Bank transfer',
      options: [
        {
          id: 'neft',
          label: 'NEFT / RTGS',
          shortLabel: 'NEFT',
          pg: 'NEFTRTGS',
          bankcode: 'EFTAXTPV',
          extraFields: { api_version: '6' },
          seamlessS2s: false,
        },
      ],
    },
  ]
}

/** Merge PayU live instruments into accordion sections (hide empty groups). */
export function buildPayuCheckoutSections(
  details: PayuCheckoutDetailsPayload | null | undefined,
): PayuCheckoutSection[] {
  const fallback = buildFallbackPayuCheckoutSections()
  if (!details || details.error) return fallback

  const sections: PayuCheckoutSection[] = []

  if (details.upi?.enabled !== false && details.upi?.isDown !== true) {
    sections.push(fallback.find((s) => s.id === 'upi')!)
  }

  if (details.cards?.enabled !== false) {
    sections.push(fallback.find((s) => s.id === 'cards')!)
  }

  const nbOptions =
    details.netbanking && details.netbanking.length > 0
      ? details.netbanking.map((row) => instrumentToMode('nb', row, 'NB'))
      : PAYU_NB_OPTIONS
  if (nbOptions.length) {
    sections.push({
      id: 'netbanking',
      title: 'Net banking',
      hint: `${nbOptions.length} bank${nbOptions.length === 1 ? '' : 's'} available`,
      options: nbOptions,
    })
  }

  const walletOptions =
    details.wallets && details.wallets.length > 0
      ? details.wallets.map((row) => instrumentToMode('wallet', row, 'CASH'))
      : PAYU_WALLET_OPTIONS
  if (walletOptions.length) {
    sections.push({
      id: 'wallets',
      title: 'Wallets',
      hint: walletOptions.map((o) => o.shortLabel).slice(0, 3).join(', '),
      options: walletOptions,
    })
  }

  if (details.emi && details.emi.length > 0) {
    sections.push({
      id: 'emi',
      title: 'EMI',
      hint: `${details.emi.length} tenure option${details.emi.length === 1 ? '' : 's'}`,
      options: details.emi.map((row) => instrumentToMode('emi', row, 'EMI')),
    })
  } else {
    sections.push(fallback.find((s) => s.id === 'emi')!)
  }

  if (details.bnpl && details.bnpl.length > 0) {
    sections.push({
      id: 'bnpl',
      title: 'Buy Now Pay Later',
      hint: details.bnpl.map((r) => r.title).slice(0, 2).join(', '),
      options: details.bnpl.map((row) => instrumentToMode('bnpl', row, 'BNPL')),
    })
  } else if (details.bnpl === undefined) {
    sections.push(fallback.find((s) => s.id === 'bnpl')!)
  }

  if (details.paypal !== false) {
    sections.push(fallback.find((s) => s.id === 'paypal')!)
  }

  if (details.pluxee !== false) {
    sections.push(fallback.find((s) => s.id === 'pluxee')!)
  }

  if (details.neft !== false) {
    sections.push(fallback.find((s) => s.id === 'neft')!)
  }

  return sections.length ? sections : fallback
}

export function sectionIdForPayuMode(
  mode: PayuPaymentModeId | string,
  sections: PayuCheckoutSection[],
): PayuCheckoutSectionId {
  for (const section of sections) {
    if (section.options.some((o) => o.id === mode)) return section.id
  }
  const id = String(mode)
  if (id.startsWith('upi') || id === 'qr') return 'upi'
  if (id.startsWith('nb_') || id === 'netbanking') return 'netbanking'
  if (id.startsWith('wallet_') || id === 'wallets') return 'wallets'
  if (id.startsWith('emi') || id === 'emi') return 'emi'
  if (id.startsWith('bnpl') || id === 'bnpl') return 'bnpl'
  if (id === 'cards') return 'cards'
  if (id === 'paypal') return 'paypal'
  if (id === 'pluxee') return 'pluxee'
  if (id === 'neft') return 'neft'
  return sections[0]?.id ?? 'upi'
}
