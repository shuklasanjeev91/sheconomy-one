import { useEffect, useMemo, useState, type ReactNode } from 'react'

import { CommerceRadio } from '~/commerce/components/commerce-ui'
import {
  CheckoutPayuMethodIcon,
  CheckoutPayuSectionIcons,
} from '~/commerce/components/CheckoutPayuMethodIcon'
import {
  buildFallbackPayuCheckoutSections,
  sectionIdForPayuMode,
  type PayuCheckoutSection,
  type PayuCheckoutSectionId,
} from '~/commerce/lib/payu-checkout-details'
import type { PayuPaymentModeId } from '~/commerce/lib/payu-payment-modes'
import { Input, ScrollView, Text, XStack, YStack } from '~/components/ui'

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
  /** Collapse accordion and clear selection (e.g. COD is selected). */
  collapsed?: boolean
  /** Live / fallback accordion sections from PayU get_checkout_details. */
  sections?: PayuCheckoutSection[]
  /** When set, COD appears in the same Amazon-style list */
  cod?: {
    selected: boolean
    onSelect: () => void
    title?: string
    subtitle?: string
  } | null
}

function selectedLabel(mode: PayuPaymentModeId, sections: PayuCheckoutSection[]): string {
  for (const section of sections) {
    const hit = section.options.find((o) => o.id === mode)
    if (hit) return hit.label
  }
  return 'Selected'
}

/**
 * Amazon-style payment method list — one frame, radio rows, inline expansion.
 * Sections come from PayU get_checkout_details (with static fallback).
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
  collapsed = false,
  sections: sectionsProp,
  cod = null,
}: CheckoutPayuMethodPickerProps) {
  const sections = useMemo(
    () => (sectionsProp?.length ? sectionsProp : buildFallbackPayuCheckoutSections()),
    [sectionsProp],
  )

  const [openId, setOpenId] = useState<PayuCheckoutSectionId | 'cod' | null>(() =>
    cod?.selected || collapsed ? null : sectionIdForPayuMode(mode, sections),
  )

  useEffect(() => {
    if (collapsed || cod?.selected) {
      setOpenId(null)
      return
    }
    setOpenId(sectionIdForPayuMode(mode, sections))
  }, [collapsed, cod?.selected, mode, sections])

  function selectSection(section: PayuCheckoutSection) {
    setOpenId(section.id)
    const stillInSection = section.options.some((o) => o.id === mode)
    if (!stillInSection) {
      onModeChange((section.options[0]?.id ?? 'upi_gpay') as PayuPaymentModeId)
      return
    }
    // Re-select same mode so parent can clear COD / reopen online.
    if (collapsed) onModeChange(mode)
  }

  return (
    <YStack
      width="100%"
      borderWidth={1}
      borderColor={borderColor}
      borderRadius={12}
      overflow="visible"
      backgroundColor="transparent"
      flexShrink={0}
    >
      {sections.map((section, sectionIndex) => {
        const open = !collapsed && openId === section.id && !cod?.selected
        const hasSelection =
          !collapsed &&
          section.options.some((o) => o.id === mode) &&
          !cod?.selected
        const isLastOnline = sectionIndex === sections.length - 1 && !cod

        return (
          <YStack
            key={section.id}
            borderBottomWidth={isLastOnline ? 0 : 1}
            borderBottomColor={borderColor}
          >
            <XStack
              alignItems="flex-start"
              gap="$3"
              paddingHorizontal="$3.5"
              paddingVertical="$3.5"
              backgroundColor={open || hasSelection ? chipColor : 'transparent'}
              onPress={() => selectSection(section)}
              cursor="pointer"
              pressStyle={{ opacity: 0.92 }}
              accessibilityRole="radio"
              accessibilityState={{ selected: open || hasSelection }}
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
                      <Text
                        fontSize={12}
                        color={hasSelection ? brandColor : secondaryColor}
                        numberOfLines={1}
                      >
                        {hasSelection ? selectedLabel(mode, sections) : section.hint}
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
                    <Text fontSize={16} color={secondaryColor} fontWeight="700">
                      ⌃
                    </Text>
                  )}
                </XStack>

                {open ? (
                  <YStack
                    gap="$2"
                    paddingTop="$2"
                    onPress={(e) => {
                      e?.stopPropagation?.()
                    }}
                  >
                    {section.id === 'cards' ? (
                      <XStack alignItems="center" gap="$2">
                        <CheckoutPayuSectionIcons sectionId="cards" size={24} />
                        <Text fontSize={12} color={secondaryColor}>
                          Enter card details below
                        </Text>
                      </XStack>
                    ) : section.id === 'upi' ||
                      section.id === 'wallets' ||
                      section.id === 'emi' ||
                      section.id === 'bnpl' ? (
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
                              onPress={() => onModeChange(option.id as PayuPaymentModeId)}
                              cursor="pointer"
                              pressStyle={{ opacity: 0.9 }}
                              accessibilityRole="radio"
                              accessibilityState={{ selected: active }}
                            >
                              <CheckoutPayuMethodIcon
                                modeId={option.id as PayuPaymentModeId}
                                size={28}
                              />
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
                    ) : (
                      <ScrollView maxHeight={280} nestedScrollEnabled>
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
                                onPress={() => onModeChange(option.id as PayuPaymentModeId)}
                                cursor="pointer"
                                pressStyle={{ opacity: 0.9 }}
                                accessibilityRole="radio"
                                accessibilityState={{ selected: active }}
                              >
                                <CommerceRadio selected={active} size={18} />
                                <CheckoutPayuMethodIcon
                                  modeId={option.id as PayuPaymentModeId}
                                  size={30}
                                />
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
                      </ScrollView>
                    )}

                    {section.id === 'upi' && mode === 'upi_qr' ? (
                      <Text fontSize={12} color={secondaryColor} lineHeight={17}>
                        After you tap Pay, a QR opens here — scan with any UPI app.
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
          <YStack
            width={36}
            height={36}
            borderRadius={8}
            alignItems="center"
            justifyContent="center"
            backgroundColor="#E8F5E9"
            borderWidth={1}
            borderColor="#1B5E2018"
            flexShrink={0}
          >
            <Text fontSize={10} fontWeight="800" color="#1B5E20">
              COD
            </Text>
          </YStack>
        </XStack>
      ) : null}
    </YStack>
  )
}
