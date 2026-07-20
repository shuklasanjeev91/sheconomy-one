import { useEffect, useMemo, useState } from 'react'

import { CountryCodeSheet } from '~/components/forms/CountryCodeSheet'
import { Icons, Input, Text, XStack, YStack } from '~/components/ui'
import { AUTH_LAYOUT } from '~/components/auth/auth-layout'
import {
  DEFAULT_COUNTRY,
  countryFlag,
  type Country,
} from '~/lib/phone/countries'
import {
  nationalDigits,
  parseE164Phone,
  toE164Phone,
} from '~/lib/phone/phone'
import { useAppUi } from '~/lib/theme/useAppUi'

export type PhoneInputProps = {
  /** E.164 value (`+9198…`) or empty. */
  value: string
  onChange: (e164: string) => void
  onBlur?: () => void
  invalid?: boolean
  disabled?: boolean
  /** Used when `value` is empty / unparsable. */
  defaultCountry?: Country
  compact?: boolean
  placeholder?: string
  accessibilityLabel?: string
}

/**
 * App-wide phone field: flat country dial-code sheet + national digits.
 * Always emits E.164 so shop/profile storage stays a single string.
 */
export function PhoneInput({
  value,
  onChange,
  onBlur,
  invalid = false,
  disabled = false,
  defaultCountry = DEFAULT_COUNTRY,
  compact = false,
  placeholder,
  accessibilityLabel = 'Mobile number',
}: PhoneInputProps) {
  const ui = useAppUi()
  const parsed = useMemo(() => (value.trim() ? parseE164Phone(value.trim()) : null), [value])
  const [country, setCountry] = useState<Country>(parsed?.country ?? defaultCountry)
  const [national, setNational] = useState(parsed?.nationalNumber ?? '')
  const [sheetOpen, setSheetOpen] = useState(false)

  // Sync inward when parent resets / loads a different E.164.
  useEffect(() => {
    if (!value.trim()) {
      setNational('')
      return
    }
    const next = parseE164Phone(value.trim())
    if (!next) return
    setCountry(next.country)
    setNational(next.nationalNumber)
  }, [value])

  function emit(nextCountry: Country, nextNational: string) {
    const digits = nationalDigits(nextNational)
    if (!digits) {
      onChange('')
      return
    }
    onChange(toE164Phone(nextCountry, digits))
  }

  function handleCountrySelect(next: Country) {
    setCountry(next)
    emit(next, national)
  }

  function handleNationalChange(raw: string) {
    const digits = nationalDigits(raw)
    setNational(digits)
    emit(country, digits)
  }

  const triggerPad = compact ? '$2' : '$2.5'
  const inputHeight = compact ? 44 : 52

  return (
    <>
      <XStack
        width="100%"
        alignItems="center"
        gap="$2"
        opacity={disabled ? 0.6 : 1}
      >
        <XStack
          alignItems="center"
          gap="$1.5"
          paddingHorizontal={compact ? '$2' : '$3'}
          paddingVertical={triggerPad}
          minHeight={inputHeight}
          borderRadius={AUTH_LAYOUT.inputRadius}
          borderWidth={1}
          borderColor={invalid ? ui.error : ui.borderSubtle}
          backgroundColor={ui.surface}
          cursor={disabled ? 'default' : 'pointer'}
          hoverStyle={disabled ? undefined : { backgroundColor: ui.surfaceMuted }}
          pressStyle={disabled ? undefined : { opacity: 0.9 }}
          onPress={disabled ? undefined : () => setSheetOpen(true)}
          accessibilityRole="button"
          accessibilityLabel="Country code"
        >
          <Text fontSize={compact ? 18 : 20}>{countryFlag(country.iso2)}</Text>
          <Text fontWeight="700" color={ui.text} fontSize={14}>
            {country.dialCode}
          </Text>
          {!disabled ? <Icons.ChevronDown size={14} color={ui.textMuted} /> : null}
        </XStack>

        <YStack flex={1} minWidth={0}>
          <Input
            width="100%"
            value={national}
            onChangeText={handleNationalChange}
            onBlur={onBlur}
            placeholder={placeholder ?? country.placeholder ?? 'Mobile number'}
            keyboardType="phone-pad"
            inputMode="tel"
            autoComplete="tel"
            {...({ textContentType: 'telephoneNumber' } as object)}
            returnKeyType="done"
            enterKeyHint="done"
            accessibilityLabel={accessibilityLabel}
            disabled={disabled}
            editable={!disabled}
            invalid={invalid}
            height={inputHeight}
            borderRadius={AUTH_LAYOUT.inputRadius}
          />
        </YStack>
      </XStack>

      <CountryCodeSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        value={country}
        onSelect={handleCountrySelect}
      />
    </>
  )
}

export { DEFAULT_COUNTRY }
