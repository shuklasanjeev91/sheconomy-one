import { useMemo, useState } from 'react'
import { KeyboardAvoidingView, Platform } from 'react-native'

import { CommunityAdaptiveSheet } from '~/community/components/CommunityAdaptiveSheet'
import { AUTH_LAYOUT } from '~/components/auth/auth-layout'
import {
  countryFlag,
  filterCountries,
  hasStrictPhoneRule,
  type Country,
} from '~/lib/phone/countries'
import { Icons, Input, ScrollView, Text, XStack, YStack } from '~/components/ui'
import { useAppUi } from '~/lib/theme/useAppUi'

type CountryCodeSheetProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  value: Country
  onSelect: (country: Country) => void
  title?: string
}

/**
 * Flat searchable country / dial-code bottom sheet (no nested cards).
 * Used by PhoneInput and CountryCodePicker across the app.
 */
export function CountryCodeSheet({
  open,
  onOpenChange,
  value,
  onSelect,
  title = 'Select country',
}: CountryCodeSheetProps) {
  const ui = useAppUi()
  const [query, setQuery] = useState('')
  const countries = useMemo(() => filterCountries(query), [query])
  const listMaxHeight = Platform.OS === 'web' ? 420 : 360

  function handleSelect(country: Country) {
    onSelect(country)
    onOpenChange(false)
    setQuery('')
  }

  const list = (
    <ScrollView maxHeight={listMaxHeight} width="100%" keyboardShouldPersistTaps="handled">
      <YStack gap={0} width="100%">
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
              borderBottomWidth={1}
              borderBottomColor={ui.borderSubtle}
              backgroundColor={selected ? ui.roseTint : 'transparent'}
              cursor="pointer"
              hoverStyle={{ backgroundColor: ui.surfaceHover }}
              pressStyle={{ opacity: 0.9 }}
              onPress={() => handleSelect(country)}
            >
              <Text fontSize={22}>{countryFlag(country.iso2)}</Text>
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
    <CommunityAdaptiveSheet
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next)
        if (!next) setQuery('')
      }}
      title={title}
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
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
            {list}
          </KeyboardAvoidingView>
        )}
      </YStack>
    </CommunityAdaptiveSheet>
  )
}
