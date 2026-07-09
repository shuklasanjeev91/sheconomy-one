import { useRouter } from 'one'
import { useState } from 'react'

import { Icons, Input, Theme, XStack, YStack } from '~/components/ui'
import { BRAND_THEME } from '~/config/tokens'
import { commerceRoutes } from '~/lib/routes'
import { useAppUi } from '~/lib/theme/useAppUi'

type NavSearchBarProps = {
  compact?: boolean
  placeholder?: string
  initialQuery?: string
}

/** Etsy-style search — pill input, brand-filled search button on the right. */
export function NavSearchBar({
  compact,
  placeholder = 'Search for anything',
  initialQuery = '',
}: NavSearchBarProps) {
  const ui = useAppUi()
  const router = useRouter()
  const [query, setQuery] = useState(initialQuery)

  function submitSearch() {
    const trimmed = query.trim()
    if (!trimmed) {
      router.push(commerceRoutes.search())
      return
    }
    router.push(commerceRoutes.search(trimmed))
  }

  return (
    <XStack
      flex={1}
      width="100%"
      minWidth={0}
      maxWidth="100%"
      alignItems="center"
      borderWidth={2}
      borderColor={ui.inputBorder}
      borderRadius={999}
      backgroundColor={ui.surface}
      overflow="hidden"
      height={compact ? 40 : 48}
      animation="quick"
    >
      <XStack paddingLeft={compact ? '$3' : '$4'} opacity={0.45} flexShrink={0}>
        <Icons.Search size={compact ? 16 : 18} color={ui.text} />
      </XStack>
      <Input
        flex={1}
        minWidth={0}
        value={query}
        onChangeText={setQuery}
        onSubmitEditing={submitSearch}
        returnKeyType="search"
        placeholder={compact ? 'Search' : placeholder}
        borderWidth={0}
        backgroundColor="transparent"
        height="100%"
        paddingHorizontal={compact ? '$2' : '$2.5'}
        fontSize={compact ? 13 : 15}
        color={ui.inputText}
        focusStyle={{ borderWidth: 0, backgroundColor: 'transparent' }}
      />
      {!compact ? (
        <Theme name={BRAND_THEME}>
          <XStack
            height="100%"
            paddingHorizontal="$4"
            backgroundColor="$color9"
            alignItems="center"
            justifyContent="center"
            cursor="pointer"
            hoverStyle={{ backgroundColor: '$color10' }}
            pressStyle={{ backgroundColor: '$color10', scale: 0.98 }}
            onPress={submitSearch}
            aria-label="Search"
          >
            <Icons.Search size={18} color={ui.onBrand} />
          </XStack>
        </Theme>
      ) : null}
    </XStack>
  )
}