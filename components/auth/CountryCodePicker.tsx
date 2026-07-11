import { useMemo, useState } from 'react'
import { KeyboardAvoidingView, Platform } from 'react-native'

import { AUTH_LAYOUT } from '~/components/auth/auth-layout'
import { CommunityAdaptiveSheet } from '~/community/components/CommunityAdaptiveSheet'
import {
  DEFAULT_COUNTRY,
  countryFlag,
  filterCountries,
  hasStrictPhoneRule,
  type Country,
} from '~/lib/phone/countries'
import { Icons, Input, ScrollView, Text, XStack, YStack } from '~/components/ui'
import { useAppUi } from '~/lib/theme/useAppUi'

type CountryCodePickerProps = {
  value: Country
  onChange: (country: Country) => void
  disabled?: boolean
  compact?: boolean
}

export function CountryCodePicker({
  value,
  onChange,
  disabled = false,
  compact = false,
}: CountryCodePickerProps) {
  const ui = useAppUi()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')

  const countries = useMemo(() => filterCountries(query), [query])
  const listMaxHeight = Platform.OS === 'web' ? 420 : 360

  const handleSelect = (country: Country) => {
    onChange(country)
    setOpen(false)
    setQuery('')
  }

  const list = (
    <ScrollView maxHeight={listMaxHeight} width="100%" keyboardShouldPersistTaps="handled">
      <YStack gap="$1" width="100%">
        {countries.map((country) => {
          const selected = country.iso2 === value.iso2
          const strict = hasStrictPhoneRule(country.iso2)
          return (
            <XStack
              key={country.iso2}
              paddingHorizontal="$3"
              paddingVertical="$3"
              gap="$3"
              alignItems="center"
              borderRadius={12}
              backgroundColor={selected ? ui.roseTint : 'transparent'}
              cursor="pointer"
              hoverStyle={{ backgroundColor: ui.surfaceHover }}
              pressStyle={{ opacity: 0.9 }}
              onPress={() => handleSelect(country)}
            >
              <Text fontSize={24}>{countryFlag(country.iso2)}</Text>
              <YStack flex={1} minWidth={0}>
                <Text fontWeight={selected ? '700' : '600'} color={ui.text} numberOfLines={1}>
                  {country.name}
                </Text>
                <Text fontSize={12} color={ui.textMuted}>
                  {country.dialCode}
                  {strict ? ` · ${country.placeholder}` : ' · International format'}
                </Text>
              </YStack>
              {selected ? <Icons.Check size={18} color={ui.brand} /> : null}
            </XStack>
          )
        })}
      </YStack>
    </ScrollView>
  )

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

      <CommunityAdaptiveSheet
        open={open}
        onOpenChange={(next) => {
          setOpen(next)
          if (!next) setQuery('')
        }}
        title="Select country"
        maxWidth={480}
      >
        <YStack gap="$3" width="100%">
          <XStack
            alignItems="center"
            gap="$2"
            paddingHorizontal="$3"
            paddingVertical="$2"
            borderRadius={AUTH_LAYOUT.inputRadius}
            borderWidth={1}
            borderColor={ui.borderSubtle}
            backgroundColor={ui.surfaceMuted}
          >
            <Icons.Search size={18} color={ui.textMuted} />
            <Input
              flex={1}
              borderWidth={0}
              backgroundColor="transparent"
              placeholder="Search country or code"
              value={query}
              onChangeText={setQuery}
              autoFocus
            />
          </XStack>

          {Platform.OS === 'web' ? (
            list
          ) : (
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
              {list}
            </KeyboardAvoidingView>
          )}
        </YStack>
      </CommunityAdaptiveSheet>
    </>
  )
}

export { DEFAULT_COUNTRY }
