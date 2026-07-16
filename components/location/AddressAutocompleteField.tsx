import { useEffect, useRef, useState } from 'react'
import { Platform } from 'react-native'

import { AdaptiveTypeaheadPanel } from '~/components/search/AdaptiveTypeaheadPanel'
import { SuggestSectionHeader } from '~/components/search/SuggestSectionHeader'
import { Icons, Input, Spinner, Text, XStack, YStack } from '~/components/ui'
import {
  autocompletePlaces,
  createPlacesSessionToken,
  getPlaceDetails,
  type PlaceSuggestion,
  type ResolvedAddress,
} from '~/lib/location'
import { useAppUi } from '~/lib/theme/useAppUi'

type AddressAutocompleteFieldProps = {
  country?: string
  onResolved: (address: ResolvedAddress) => void
  placeholder?: string
  disabled?: boolean
}

/** Street-level Places search via Edge Function; degrades silently if unavailable. */
export function AddressAutocompleteField({
  country,
  onResolved,
  placeholder = 'Search address…',
  disabled,
}: AddressAutocompleteFieldProps) {
  const ui = useAppUi()
  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([])
  const [loading, setLoading] = useState(false)
  const [hidden, setHidden] = useState(false)
  const [focused, setFocused] = useState(false)
  const [panelOpen, setPanelOpen] = useState(false)
  const sessionToken = useRef(createPlacesSessionToken())
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (query.trim().length < 2 || disabled || hidden) {
      setSuggestions([])
      return
    }

    debounceRef.current = setTimeout(() => {
      void (async () => {
        setLoading(true)
        const result = await autocompletePlaces(query, {
          country,
          sessionToken: sessionToken.current,
        })
        setLoading(false)
        if (result.unavailable) {
          setHidden(true)
          setSuggestions([])
          return
        }
        setSuggestions(result.data ?? [])
      })()
    }, 280)

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [query, country, disabled, hidden])

  useEffect(() => {
    if (!focused) {
      setPanelOpen(false)
      return
    }
    if (query.trim().length >= 2) {
      setPanelOpen(loading || suggestions.length > 0)
    } else {
      setPanelOpen(false)
    }
  }, [focused, loading, query, suggestions.length])

  async function handleSelect(suggestion: PlaceSuggestion) {
    setLoading(true)
    const details = await getPlaceDetails(suggestion.placeId, {
      sessionToken: sessionToken.current,
    })
    setLoading(false)
    sessionToken.current = createPlacesSessionToken()
    if (details.data) {
      onResolved(details.data)
      setQuery(details.data.formatted || suggestion.description)
      setSuggestions([])
      setPanelOpen(false)
    }
  }

  if (hidden) return null

  return (
    <YStack gap="$2" width="100%" position="relative" zIndex={20}>
      <XStack
        alignItems="center"
        gap="$2"
        paddingHorizontal="$3"
        borderRadius={12}
        borderWidth={1}
        borderColor={ui.borderSubtle}
        backgroundColor={ui.surface}
      >
        <Icons.Search size={16} color={ui.textMuted} />
        <Input
          flex={1}
          borderWidth={0}
          backgroundColor="transparent"
          value={query}
          editable={!disabled}
          onChangeText={setQuery}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 180)}
          placeholder={placeholder}
          autoComplete={Platform.OS === 'web' ? ('street-address' as never) : undefined}
          textContentType={Platform.OS === 'ios' ? 'fullStreetAddress' : undefined}
        />
        {loading ? <Spinner size="small" /> : null}
      </XStack>

      <AdaptiveTypeaheadPanel
        open={panelOpen}
        onOpenChange={setPanelOpen}
        title="Addresses"
        maxHeight={480}
        zIndex={500}
        searchValue={query}
        onSearchChange={setQuery}
        searchPlaceholder={placeholder}
      >
        <YStack gap="$1" width="100%" paddingBottom="$2" paddingTop="$2">
          <SuggestSectionHeader label="ADDRESSES" />
          {loading && suggestions.length === 0 ? (
            <YStack padding="$4" alignItems="center">
              <Spinner size="small" />
            </YStack>
          ) : null}
          {suggestions.map((suggestion) => (
            <YStack
              key={suggestion.placeId}
              paddingHorizontal="$3"
              paddingVertical="$3"
              borderRadius={10}
              cursor="pointer"
              hoverStyle={{ backgroundColor: ui.surfaceMuted }}
              onPress={() => void handleSelect(suggestion)}
            >
              <Text fontSize={14} fontWeight="600" color={ui.text}>
                {suggestion.mainText}
              </Text>
              {suggestion.secondaryText ? (
                <Text fontSize={12} color={ui.textMuted} numberOfLines={2}>
                  {suggestion.secondaryText}
                </Text>
              ) : null}
            </YStack>
          ))}
        </YStack>
      </AdaptiveTypeaheadPanel>
    </YStack>
  )
}
