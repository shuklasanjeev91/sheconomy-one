import { useMemo, useState } from 'react'
import { KeyboardAvoidingView, Platform } from 'react-native'

import { CommunityAdaptiveSheet } from '~/community/components/CommunityAdaptiveSheet'
import { Icons, Input, ScrollView, Text, XStack, YStack } from '~/components/ui'
import { countryFlagEmoji, filterGeoOptions, type GeoOption } from '~/lib/geo'
import { SHEET_SEARCH_MIN_ITEMS } from '~/lib/search'
import { useAppUi } from '~/lib/theme/useAppUi'

type GeoSearchSheetProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  options: GeoOption[]
  value: string
  onSelect: (option: GeoOption) => void
  searchPlaceholder?: string
  showFlags?: boolean
}

export function GeoSearchSheet({
  open,
  onOpenChange,
  title,
  options,
  value,
  onSelect,
  searchPlaceholder = 'Search…',
  showFlags = false,
}: GeoSearchSheetProps) {
  const ui = useAppUi()
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => filterGeoOptions(options, query), [options, query])

  function handleSelect(option: GeoOption) {
    onSelect(option)
    onOpenChange(false)
    setQuery('')
  }

  const showSearch = options.length >= SHEET_SEARCH_MIN_ITEMS || query.length > 0

  const listMaxHeight = Platform.OS === 'web' ? 420 : 360
  const sheetBody = (
    <YStack gap="$3" width="100%">
        {showSearch ? (
          <XStack
            alignItems="center"
            gap="$2"
            paddingHorizontal="$3"
            paddingVertical="$2"
            borderRadius={12}
            borderWidth={1}
            borderColor={ui.borderSubtle}
            backgroundColor={ui.surfaceMuted}
          >
            <Icons.Search size={18} color={ui.textMuted} />
            <Input
              flex={1}
              borderWidth={0}
              backgroundColor="transparent"
              placeholder={searchPlaceholder}
              value={query}
              onChangeText={setQuery}
              autoFocus
            />
          </XStack>
        ) : null}

        <ScrollView maxHeight={listMaxHeight} width="100%" keyboardShouldPersistTaps="handled">
          <YStack gap="$1" width="100%">
            {filtered.length === 0 ? (
              <Text fontSize={14} color={ui.textMuted} padding="$3">
                No matches found.
              </Text>
            ) : (
              filtered.map((option) => {
                const selected = option.value === value
                return (
                  <XStack
                    key={`${option.value}-${option.label}`}
                    paddingHorizontal="$3"
                    paddingVertical="$3"
                    gap="$3"
                    alignItems="center"
                    borderRadius={12}
                    backgroundColor={selected ? ui.roseTint : 'transparent'}
                    cursor="pointer"
                    hoverStyle={{ backgroundColor: ui.surfaceHover }}
                    pressStyle={{ opacity: 0.9 }}
                    onPress={() => handleSelect(option)}
                  >
                    {showFlags ? <Text fontSize={22}>{countryFlagEmoji(option.value)}</Text> : null}
                    <YStack flex={1} minWidth={0}>
                      <Text fontWeight={selected ? '700' : '600'} color={ui.text} numberOfLines={1}>
                        {option.label}
                      </Text>
                      {option.meta ? (
                        <Text fontSize={12} color={ui.textMuted} numberOfLines={1}>
                          {option.meta}
                        </Text>
                      ) : null}
                    </YStack>
                    {selected ? <Icons.Check size={18} color={ui.brand} /> : null}
                  </XStack>
                )
              })
            )}
          </YStack>
        </ScrollView>
      </YStack>
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
      {Platform.OS === 'web' ? (
        sheetBody
      ) : (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          {sheetBody}
        </KeyboardAvoidingView>
      )}
    </CommunityAdaptiveSheet>
  )
}
