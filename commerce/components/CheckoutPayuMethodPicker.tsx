import { useEffect, useMemo, useState, type ReactNode } from 'react'

import { CommerceRadio } from '~/commerce/components/commerce-ui'
import {
  CheckoutPayuMethodIcon,
  CheckoutPayuSectionIcons,
} from '~/commerce/components/CheckoutPayuMethodIcon'
import { Icons, Input, Text, XStack, YStack } from '~/components/ui'
import {
  PAYU_CARD_OPTIONS,
  PAYU_NB_OPTIONS,
  PAYU_UPI_OPTIONS,
  PAYU_WALLET_OPTIONS,
  payuGroupIdForMode,
  type PayuMethodGroupId,
  type PayuPaymentMode,
  type PayuPaymentModeId,
} from '~/commerce/lib/payu-payment-modes'

type SectionId = Section['id']

type CheckoutPayuMethodPickerProps = {
  brandColor: string
  borderColor: string
  chipColor: string
  secondaryColor: string
  textColor: string
  mode: PayuPaymentModeId
  onModeChange: (mode: PayuPaymentModeId) => void
  vpa: string
  onVpaChange: (value: string) => void
  /** Optional card form rendered under Cards when selected */
  cardFields?: ReactNode
  /** Shown but not expandable / selectable (e.g. net banking coming later). */
  disabledSectionIds?: SectionId[]
  /** When set, COD appears in the same Amazon-style list */
  cod?: {
    selected: boolean
    onSelect: () => void
    title?: string
    subtitle?: string
  } | null
}

type Section = {
  id: PayuMethodGroupId | 'more'
  title: string
  hint: string
  options: PayuPaymentMode[]
}

const MORE_OPTIONS: PayuPaymentMode[] = [
  { id: 'emi', label: 'EMI', shortLabel: 'EMI', pg: 'EMI', bankcode: 'EMI', seamlessS2s: true },
  { id: 'bnpl', label: 'Buy Now Pay Later', shortLabel: 'BNPL', pg: 'BNPL', bankcode: 'LAZYPAY', seamlessS2s: true },
  { id: 'paypal', label: 'PayPal', shortLabel: 'PayPal', pg: 'PAYPAL', bankcode: 'PAYPAL', seamlessS2s: true },
  {
    id: 'pluxee',
    label: 'Pluxee (Sodexo)',
    shortLabel: 'Pluxee',
    pg: 'MC',
    bankcode: 'SODEXO',
    seamlessS2s: true,
  },
  {
    id: 'neft',
    label: 'NEFT / RTGS',
    shortLabel: 'NEFT',
    pg: 'NEFTRTGS',
    bankcode: 'EFTAXTPV',
    extraFields: { api_version: '6' },
    seamlessS2s: true,
  },
]

/** Popular UPI first — matches how shoppers scan Amazon’s list. */
const UPI_OPTIONS_ORDERED: PayuPaymentMode[] = [
  ...PAYU_UPI_OPTIONS.filter((o) => o.id === 'upi_gpay'),
  ...PAYU_UPI_OPTIONS.filter((o) => o.id === 'upi_phonepe'),
  ...PAYU_UPI_OPTIONS.filter((o) => o.id === 'upi_paytm'),
  ...PAYU_UPI_OPTIONS.filter((o) => o.id === 'upi_qr'),
  ...PAYU_UPI_OPTIONS.filter((o) => o.id === 'upi_collect'),
  ...PAYU_UPI_OPTIONS.filter((o) => o.id === 'upi_intent'),
]

const SECTIONS: Section[] = [
  {
    id: 'upi',
    title: 'UPI',
    hint: 'Google Pay, PhonePe, Paytm & more',
    options: UPI_OPTIONS_ORDERED,
  },
  {
    id: 'cards',
    title: 'Credit or debit card',
    hint: 'Visa, Mastercard, RuPay & more',
    options: PAYU_CARD_OPTIONS,
  },
  {
    id: 'netbanking',
    title: 'Net banking',
    hint: 'All major banks',
    options: PAYU_NB_OPTIONS,
  },
  {
    id: 'wallets',
    title: 'Wallets',
    hint: 'Paytm, PhonePe, Amazon Pay…',
    options: PAYU_WALLET_OPTIONS,
  },
  {
    id: 'more',
    title: 'Other payment options',
    hint: 'EMI, BNPL, PayPal, NEFT',
    options: MORE_OPTIONS,
  },
]

function sectionContainsMode(section: Section, mode: PayuPaymentModeId): boolean {
  return section.options.some((o) => o.id === mode)
}

function selectedLabel(mode: PayuPaymentModeId): string {
  for (const section of SECTIONS) {
    const hit = section.options.find((o) => o.id === mode)
    if (hit) return hit.label
  }
  return 'Selected'
}

function sectionIdForMode(mode: PayuPaymentModeId): Section['id'] {
  const group = payuGroupIdForMode(mode)
  if (['emi', 'bnpl', 'paypal', 'pluxee', 'neft'].includes(mode)) return 'more'
  if (group === 'cards' || group === 'upi' || group === 'netbanking' || group === 'wallets') {
    return group
  }
  return 'upi'
}

/**
 * Amazon-style payment method list — one frame, radio rows, inline expansion.
 */
export function CheckoutPayuMethodPicker({
  brandColor,
  borderColor,
  chipColor,
  secondaryColor,
  textColor,
  mode,
  onModeChange,
  vpa,
  onVpaChange,
  cardFields,
  disabledSectionIds = [],
  cod = null,
}: CheckoutPayuMethodPickerProps) {
  const disabledSections = useMemo(() => new Set(disabledSectionIds), [disabledSectionIds])

  const [openId, setOpenId] = useState<Section['id'] | 'cod'>(() =>
    cod?.selected ? 'cod' : sectionIdForMode(mode),
  )

  useEffect(() => {
    if (cod?.selected) {
      setOpenId('cod')
      return
    }
    const nextOpen = sectionIdForMode(mode)
    if (disabledSections.has(nextOpen)) {
      setOpenId('upi')
      if (mode !== 'upi_gpay' && mode !== 'upi_intent') onModeChange('upi_gpay')
      return
    }
    setOpenId(nextOpen)
  }, [cod?.selected, disabledSections, mode])

  function selectSection(section: Section) {
    if (disabledSections.has(section.id)) return
    setOpenId(section.id)
    if (!sectionContainsMode(section, mode)) {
      onModeChange(section.options[0]?.id ?? 'upi_gpay')
    }
  }

  return (
    <YStack
      width="100%"
      borderWidth={1}
      borderColor={borderColor}
      borderRadius={12}
      overflow="hidden"
      backgroundColor="transparent"
    >
      {SECTIONS.map((section, sectionIndex) => {
        const disabled = disabledSections.has(section.id)
        const open = !disabled && openId === section.id && !cod?.selected
        const hasSelection = !disabled && sectionContainsMode(section, mode) && !cod?.selected
        const isLastOnline = sectionIndex === SECTIONS.length - 1 && !cod

        return (
          <YStack
            key={section.id}
            borderBottomWidth={isLastOnline ? 0 : 1}
            borderBottomColor={borderColor}
            opacity={disabled ? 0.48 : 1}
          >
            <XStack
              alignItems="flex-start"
              gap="$3"
              paddingHorizontal="$3.5"
              paddingVertical="$3.5"
              backgroundColor={open || hasSelection ? chipColor : 'transparent'}
              onPress={disabled ? undefined : () => selectSection(section)}
              cursor={disabled ? 'not-allowed' : 'pointer'}
              pressStyle={disabled ? undefined : { opacity: 0.92 }}
              accessibilityRole="radio"
              accessibilityState={{ selected: open || hasSelection, disabled }}
            >
              <YStack paddingTop={2}>
                <CommerceRadio selected={open || hasSelection} />
              </YStack>

              <YStack flex={1} minWidth={0} gap="$1.5">
                <XStack alignItems="center" justifyContent="space-between" gap="$2">
                  <YStack flex={1} minWidth={0} gap={2}>
                    <Text fontSize={15} fontWeight="700" color={textColor} letterSpacing={-0.2}>
                      {section.title}
                    </Text>
                    {!open ? (
                      <Text fontSize={12} color={hasSelection ? brandColor : secondaryColor} numberOfLines={1}>
                        {disabled
                          ? 'Currently unavailable'
                          : hasSelection
                            ? selectedLabel(mode)
                            : section.hint}
                      </Text>
                    ) : (
                      <Text fontSize={12} color={secondaryColor} numberOfLines={1}>
                        {section.hint}
                      </Text>
                    )}
                  </YStack>
                  {!open ? (
                    hasSelection ? (
                      <CheckoutPayuMethodIcon modeId={mode} size={32} />
                    ) : (
                      <CheckoutPayuSectionIcons sectionId={section.id} size={22} />
                    )
                  ) : (
                    <Icons.ChevronUp size={18} color={secondaryColor} />
                  )}
                </XStack>

                {open ? (
                  <YStack
                    gap="$2"
                    paddingTop="$2"
                    onPress={(e) => {
                      // Keep nested taps from collapsing/re-selecting the parent row.
                      e?.stopPropagation?.()
                    }}
                  >
                    {section.id === 'upi' || section.id === 'wallets' || section.id === 'more' ? (
                      <XStack gap="$2" flexWrap="wrap">
                        {section.options.map((option) => {
                          const active = mode === option.id
                          return (
                            <XStack
                              key={option.id}
                              alignItems="center"
                              gap="$2"
                              paddingVertical="$2"
                              paddingHorizontal="$2.5"
                              borderRadius={10}
                              borderWidth={1.5}
                              borderColor={active ? brandColor : borderColor}
                              backgroundColor={active ? `${brandColor}14` : 'transparent'}
                              onPress={() => onModeChange(option.id)}
                              cursor="pointer"
                              pressStyle={{ opacity: 0.9 }}
                              accessibilityRole="radio"
                              accessibilityState={{ selected: active }}
                            >
                              <CheckoutPayuMethodIcon modeId={option.id} size={28} />
                              <Text
                                fontSize={13}
                                fontWeight={active ? '700' : '500'}
                                color={active ? brandColor : textColor}
                              >
                                {option.shortLabel}
                              </Text>
                            </XStack>
                          )
                        })}
                      </XStack>
                    ) : section.id === 'netbanking' ? (
                      <YStack gap="$1.5">
                        {section.options.map((option) => {
                          const active = mode === option.id
                          return (
                            <XStack
                              key={option.id}
                              alignItems="center"
                              gap="$3"
                              paddingVertical="$2.5"
                              paddingHorizontal="$2.5"
                              borderRadius={10}
                              borderWidth={1}
                              borderColor={active ? brandColor : borderColor}
                              backgroundColor={active ? `${brandColor}12` : 'transparent'}
                              onPress={() => onModeChange(option.id)}
                              cursor="pointer"
                              pressStyle={{ opacity: 0.9 }}
                              accessibilityRole="radio"
                              accessibilityState={{ selected: active }}
                            >
                              <CommerceRadio selected={active} size={18} />
                              <CheckoutPayuMethodIcon modeId={option.id} size={30} />
                              <Text
                                flex={1}
                                fontSize={14}
                                fontWeight={active ? '700' : '500'}
                                color={active ? brandColor : textColor}
                              >
                                {option.label}
                              </Text>
                            </XStack>
                          )
                        })}
                      </YStack>
                    ) : (
                      <XStack alignItems="center" gap="$2">
                        <CheckoutPayuSectionIcons sectionId="cards" size={24} />
                        <Text fontSize={12} color={secondaryColor}>
                          Enter card details below
                        </Text>
                      </XStack>
                    )}

                    {section.id === 'upi' && mode === 'upi_qr' ? (
                      <Text fontSize={12} color={secondaryColor} lineHeight={17}>
                        After you place the order, a QR opens here — scan with any UPI app.
                      </Text>
                    ) : null}

                    {section.id === 'upi' &&
                    section.options.find((o) => o.id === mode)?.needsVpa ? (
                      <YStack gap="$1.5" paddingTop="$1">
                        <Text fontSize={12} fontWeight="600" color={textColor}>
                          Enter UPI ID
                        </Text>
                        <Input
                          value={vpa}
                          onChangeText={onVpaChange}
                          placeholder="name@oksbi / phone@ybl"
                          autoCapitalize="none"
                          autoCorrect={false}
                        />
                      </YStack>
                    ) : null}

                    {section.id === 'cards' && cardFields ? (
                      <YStack
                        gap="$2"
                        padding="$3"
                        borderRadius={10}
                        borderWidth={1}
                        borderColor={borderColor}
                        backgroundColor="transparent"
                      >
                        {cardFields}
                      </YStack>
                    ) : null}
                  </YStack>
                ) : null}
              </YStack>
            </XStack>
          </YStack>
        )
      })}

      {cod ? (
        <XStack
          alignItems="flex-start"
          gap="$3"
          paddingHorizontal="$3.5"
          paddingVertical="$3.5"
          backgroundColor={cod.selected ? chipColor : 'transparent'}
          onPress={cod.onSelect}
          cursor="pointer"
          pressStyle={{ opacity: 0.92 }}
          accessibilityRole="radio"
          accessibilityState={{ selected: cod.selected }}
        >
          <YStack paddingTop={2}>
            <CommerceRadio selected={cod.selected} />
          </YStack>
          <YStack flex={1} gap={2}>
            <Text fontSize={15} fontWeight="700" color={textColor} letterSpacing={-0.2}>
              {cod.title ?? 'Cash on delivery / Pay on delivery'}
            </Text>
            <Text fontSize={12} color={secondaryColor} lineHeight={17}>
              {cod.subtitle ?? 'Pay with cash, UPI or card when your order arrives'}
            </Text>
          </YStack>
          <Icons.Banknote size={22} color={secondaryColor} />
        </XStack>
      ) : null}
    </YStack>
  )
}
