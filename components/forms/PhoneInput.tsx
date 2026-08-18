import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react'
import { View } from 'react-native'

import { CountryCodeSheet } from '~/components/forms/CountryCodeSheet'
import { AppTextField } from '~/components/forms/AppTextField'
import { Icons, Text, XStack, YStack } from '~/components/ui'
import { AUTH_LAYOUT } from '~/components/auth/auth-layout'
import {
  DEFAULT_COUNTRY,
  countryFlag,
  type Country,
} from '~/lib/phone/countries'
import {
  nationalDigits,
  normalizePhoneNumber,
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
  autoFocus?: boolean
}

export type PhoneInputHandle = {
  /**
   * Current E.164 straight from the field, pushed to `onChange` if the parent
   * is behind. Submit handlers should prefer this: on native the typed digits
   * do not always reach the parent before a button press lands.
   */
  flush: () => string
}

/**
 * App-wide phone field: flat country dial-code sheet + national digits.
 * Always emits E.164 so shop/profile storage stays a single string.
 */
export const PhoneInput = forwardRef<PhoneInputHandle, PhoneInputProps>(function PhoneInput({
  value,
  onChange,
  onBlur,
  invalid = false,
  disabled = false,
  defaultCountry = DEFAULT_COUNTRY,
  compact = false,
  placeholder,
  accessibilityLabel = 'Mobile number',
  autoFocus = false,
}: PhoneInputProps, ref) {
  const ui = useAppUi()
  const parsed = useMemo(() => (value.trim() ? parseE164Phone(value.trim()) : null), [value])
  const [country, setCountry] = useState<Country>(parsed?.country ?? defaultCountry)
  const [national, setNational] = useState(parsed?.nationalNumber ?? '')
  const [sheetOpen, setSheetOpen] = useState(false)

  const latest = useRef({ country, national, value, onChange })
  latest.current = { country, national, value, onChange }

  const flush = useCallback(() => {
    const current = latest.current
    const digits = nationalDigits(current.national)
    const next = digits ? toE164Phone(current.country, digits) : ''
    if (next !== current.value.trim()) current.onChange(next)
    return next
  }, [])

  useImperativeHandle(ref, () => ({ flush }), [flush])

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
    const trimmed = raw.trim()
    const digitCount = nationalDigits(trimmed).length

    const looksInternational =
      trimmed.includes('+') ||
      trimmed.startsWith('00') ||
      digitCount > country.maxLength

    if (looksInternational) {
      const normalized = normalizePhoneNumber(trimmed, country)
      const next = parseE164Phone(normalized)
      if (next) {
        setCountry(next.country)
        setNational(next.nationalNumber)
        onChange(toE164Phone(next.country, next.nationalNumber))
        return
      }
    }

    const digits = nationalDigits(raw).slice(0, country.maxLength)
    setNational(digits)
    emit(country, digits)
  }

  function flushToParent() {
    // Recover when native buffer updated without a reliable onChangeText stream.
    flush()
  }

  const inputHeight = compact ? 44 : 52

  return (
    <>
      <View
        collapsable={false}
        pointerEvents="auto"
        style={{
          width: '100%',
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          opacity: disabled ? 0.6 : 1,
        }}
      >
        <XStack
          alignItems="center"
          gap="$1.5"
          paddingHorizontal={compact ? '$2' : '$3'}
          height={inputHeight}
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
          <Text fontSize={compact ? 18 : 20} pointerEvents="none">
            {countryFlag(country.iso2)}
          </Text>
          <Text fontWeight="700" color={ui.text} fontSize={14} pointerEvents="none">
            {country.dialCode}
          </Text>
          {!disabled ? (
            <YStack pointerEvents="none">
              <Icons.ChevronDown size={14} color={ui.textMuted} />
            </YStack>
          ) : null}
        </XStack>

        <View style={{ flex: 1, minWidth: 0 }} collapsable={false} pointerEvents="auto">
          <AppTextField
            value={national}
            onChangeText={handleNationalChange}
            onBlur={() => {
              flushToParent()
              onBlur?.()
            }}
            onEndEditing={(event) => {
              const nativeText = event.nativeEvent.text
              if (typeof nativeText === 'string') {
                handleNationalChange(nativeText)
              } else {
                flushToParent()
              }
            }}
            placeholder={placeholder ?? country.placeholder ?? 'Mobile number'}
            keyboardType="phone-pad"
            inputMode="tel"
            autoFocus={autoFocus}
            showSoftInputOnFocus
            autoComplete="tel"
            textContentType="telephoneNumber"
            accessibilityLabel={accessibilityLabel}
            disabled={disabled}
            invalid={invalid}
            maxLength={country.maxLength + 8}
            importantForAutofill="yes"
            containerStyle={{ height: inputHeight, minHeight: inputHeight }}
          />
        </View>
      </View>

      <CountryCodeSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        value={country}
        onSelect={handleCountrySelect}
      />
    </>
  )
})

PhoneInput.displayName = 'PhoneInput'

export { DEFAULT_COUNTRY }
