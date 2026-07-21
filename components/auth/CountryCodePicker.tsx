import { useState } from 'react'

import { CountryCodeSheet } from '~/components/forms/CountryCodeSheet'
import { Icons, Text, XStack } from '~/components/ui'
import { AUTH_LAYOUT } from '~/components/auth/auth-layout'
import {
  DEFAULT_COUNTRY,
  countryFlag,
  type Country,
} from '~/lib/phone/countries'
import { useAppUi } from '~/lib/theme/useAppUi'

type CountryCodePickerProps = {
  value: Country
  onChange: (country: Country) => void
  disabled?: boolean
  compact?: boolean
}

/**
 * Dial-code trigger + flat country sheet.
 * Prefer `PhoneInput` for full phone fields; keep this for rare split layouts.
 */
export function CountryCodePicker({
  value,
  onChange,
  disabled = false,
  compact = false,
}: CountryCodePickerProps) {
  const ui = useAppUi()
  const [open, setOpen] = useState(false)

  return (
    <>
      <XStack
        alignItems="center"
        gap="$1.5"
        paddingHorizontal={compact ? '$2' : '$3'}
        paddingVertical={compact ? '$2' : '$2.5'}
        borderRadius={compact ? 10 : AUTH_LAYOUT.inputRadius}
        borderWidth={compact ? 0 : 1}
        borderColor={ui.borderSubtle}
        backgroundColor={compact ? 'transparent' : ui.surface}
        opacity={disabled ? 0.6 : 1}
        cursor={disabled ? 'default' : 'pointer'}
        hoverStyle={disabled ? undefined : { backgroundColor: compact ? ui.surfaceHover : ui.surfaceMuted }}
        onPress={disabled ? undefined : () => setOpen(true)}
      >
        <Text fontSize={compact ? 20 : 22}>{countryFlag(value.iso2)}</Text>
        <Text fontWeight="700" color={ui.text} fontSize={14}>
          {value.dialCode}
        </Text>
        {!disabled ? <Icons.ChevronDown size={14} color={ui.textMuted} /> : null}
      </XStack>

      <CountryCodeSheet
        open={open}
        onOpenChange={setOpen}
        value={value}
        onSelect={onChange}
      />
    </>
  )
}

export { DEFAULT_COUNTRY }
