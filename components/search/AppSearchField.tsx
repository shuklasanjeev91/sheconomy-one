import { useGlobalSearchParams, usePathname, useRouter } from 'one'
import { useEffect, useRef, useState } from 'react'
import { Platform } from 'react-native'

import { SearchSuggestPanel } from '~/components/search/SearchSuggestPanel'
import { Icons, Input, XStack, YStack } from '~/components/ui'
import { useAccess } from '~/hooks/useAccess'
import { useAppLayout } from '~/hooks/useAppLayout'
import { useUserGeo } from '~/commerce/hooks/useUserGeo'
import { useProfile } from '~/hooks/useProfile'
import {
  clearAppSearchHistory,
  recordAppSearchTerm,
  removeAppSearchTerm,
  SEARCH_SCOPE_LABELS,
  searchScopeFromPath,
  searchScopeFromRouteParams,
  searchSuggest,
  useAppSearchHistory,
  type SearchHit,
  type SearchScope,
} from '~/lib/search'
import { appRoutes } from '~/lib/routes'
import { useAppUi } from '~/lib/theme/useAppUi'

type AppSearchFieldProps = {
  compact?: boolean
  initialQuery?: string
  /** Force scope override; defaults from pathname. */
  scope?: SearchScope
}

/**
 * Omnibox with suggestions and a clear control; scope stays implicit from the route.
 */
export function AppSearchField({ compact, initialQuery = '', scope: scopeProp }: AppSearchFieldProps) {
  const ui = useAppUi()
  const router = useRouter()
  const pathname = usePathname()
  const routeParams = useGlobalSearchParams() as Record<string, string | string[] | undefined>
  const { isDesktop } = useAppLayout()
  const { tier } = useAccess()
  const { user, profile } = useProfile()
  const userGeo = useUserGeo(profile?.location)
  const history = useAppSearchHistory()

  const activeScope =
    scopeProp ?? searchScopeFromRouteParams(routeParams) ?? searchScopeFromPath(pathname)
  const [query, setQuery] = useState(initialQuery)
  const [open, setOpen] = useState(false)
  const [focused, setFocused] = useState(false)
  const [hits, setHits] = useState<SearchHit[]>([])
  const [loading, setLoading] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const blurCloseRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const fieldHeight = compact ? 40 : isDesktop ? 44 : 42
  const showFocusRing = focused || open
  const placeholder = 'Search for anything'

  useEffect(() => {
    setQuery(initialQuery)
  }, [initialQuery])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    const trimmed = query.trim()
    if (!open) return

    if (!trimmed) {
      setHits([])
      setLoading(false)
      return
    }

    setLoading(true)
    debounceRef.current = setTimeout(() => {
      void searchSuggest(trimmed, {
        tier,
        pathname,
        scope: activeScope,
        limit: 12,
        userId: user?.id,
        latitude: userGeo.latitude,
        longitude: userGeo.longitude,
      }).then((result) => {
        setHits(result.hits)
        setLoading(false)
      })
    }, 250)

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [
    query,
    open,
    tier,
    pathname,
    activeScope,
    user?.id,
    userGeo.latitude,
    userGeo.longitude,
  ])

  function submitSearch(term?: string) {
    const trimmed = (term ?? query).trim()
    if (trimmed) recordAppSearchTerm(trimmed)
    setOpen(false)
    setFocused(false)
    router.push(appRoutes.search(trimmed || undefined, activeScope) as never)
  }

  function handleFocus() {
    if (blurCloseRef.current) clearTimeout(blurCloseRef.current)
    setFocused(true)
    setOpen(true)
  }

  function handleBlur() {
    setFocused(false)
    if (!isDesktop) return
    blurCloseRef.current = setTimeout(() => setOpen(false), 180)
  }

  return (
    <YStack
      flex={1}
      minWidth={0}
      width="100%"
      alignSelf="center"
      position="relative"
      zIndex={open && isDesktop ? 400 : 1}
      height={fieldHeight}
      minHeight={fieldHeight}
    >
      <XStack
        width="100%"
        height={fieldHeight}
        minHeight={fieldHeight}
        alignItems="center"
        gap={8}
        paddingHorizontal={compact ? 12 : 14}
        backgroundColor={ui.surface}
        borderWidth={2}
        borderColor={showFocusRing ? ui.brand : ui.inputBorder}
        borderRadius={999}
        {...(Platform.OS === 'web'
          ? {
              style: {
                boxShadow: showFocusRing
                  ? `0 0 0 3px ${ui.focusRing}`
                  : '0 1px 2px rgba(16, 12, 14, 0.06)',
              },
            }
          : {})}
      >
        <Icons.Search size={compact ? 16 : 18} color={ui.textMuted} flexShrink={0} />

        <Input
          flex={1}
          minWidth={0}
          unstyled
          value={query}
          accessibilityLabel={`Search ${SEARCH_SCOPE_LABELS[activeScope]}`}
          onChangeText={(value) => {
            setQuery(value)
            if (!open) setOpen(true)
          }}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onSubmitEditing={() => submitSearch()}
          returnKeyType="search"
          placeholder={placeholder}
          fontSize={compact ? 14 : 15}
          fontWeight="500"
          color={ui.text}
          placeholderTextColor={ui.textMuted}
          borderWidth={0}
          backgroundColor="transparent"
          {...(Platform.OS === 'web'
            ? ({
                onClick: handleFocus,
                style: { outline: 'none' },
              } as object)
            : {})}
        />

        {query.length > 0 ? (
          <XStack
            width={28}
            height={28}
            flexShrink={0}
            alignItems="center"
            justifyContent="center"
            borderRadius={999}
            cursor="pointer"
            hoverStyle={{ backgroundColor: ui.surfaceHover }}
            pressStyle={{ opacity: 0.8 }}
            onPress={() => {
              setQuery('')
              setOpen(true)
            }}
            accessibilityRole="button"
            aria-label="Clear search"
          >
            <Icons.X size={15} color={ui.textMuted} />
          </XStack>
        ) : null}
      </XStack>

      <SearchSuggestPanel
        open={open}
        onOpenChange={setOpen}
        query={query}
        onQueryChange={(value) => {
          setQuery(value)
          if (!open) setOpen(true)
        }}
        recent={history}
        hits={hits}
        loading={loading}
        onSelectRecent={(term) => {
          setQuery(term)
          submitSearch(term)
        }}
        onClearRecent={() => clearAppSearchHistory()}
        onRemoveRecent={(term) => removeAppSearchTerm(term)}
        onHitPress={() => setOpen(false)}
      />
    </YStack>
  )
}
