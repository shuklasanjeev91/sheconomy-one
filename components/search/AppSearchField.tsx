import { useGlobalSearchParams, usePathname } from 'one'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Platform } from 'react-native'

import { SearchSuggestPanel } from '~/components/search/SearchSuggestPanel'
import { Icons, Input, Spinner, XStack, YStack, useAppToast } from '~/components/ui'
import { useAccess } from '~/hooks/useAccess'
import { useAppLayout } from '~/hooks/useAppLayout'
import { useVoiceSearch } from '~/hooks/useVoiceSearch'
import { useUserGeo } from '~/commerce/hooks/useUserGeo'
import { useProfile } from '~/hooks/useProfile'
import {
  clearAppSearchHistory,
  recordAppSearchTerm,
  removeAppSearchTerm,
  SEARCH_SCOPE_LABELS,
  searchQueryFromImage,
  searchScopeFromPath,
  searchScopeFromRouteParams,
  searchSuggest,
  useAppSearchHistory,
  type SearchHit,
  type SearchScope,
} from '~/lib/search'
import { buildSheaiSearchHref } from '~/lib/search/sheai'
import { useSheaiRecommend } from '~/hooks/useSheaiRecommend'
import { appRoutes } from '~/lib/routes'
import { navigateApp } from '~/lib/platform/navigate'
import { useAppUi } from '~/lib/theme/useAppUi'

type AppSearchFieldProps = {
  compact?: boolean
  initialQuery?: string
  /** Force scope override; defaults from pathname. */
  scope?: SearchScope
}

function SearchIconButton({
  label,
  onPress,
  disabled,
  active,
  children,
}: {
  label: string
  onPress: () => void
  disabled?: boolean
  active?: boolean
  children: ReactNode
}) {
  const ui = useAppUi()
  return (
    <XStack
      width={28}
      height={28}
      flexShrink={0}
      alignItems="center"
      justifyContent="center"
      borderRadius={999}
      cursor={disabled ? 'default' : 'pointer'}
      opacity={disabled ? 0.45 : 1}
      backgroundColor={active ? ui.surfaceMuted : 'transparent'}
      // 28px icons sit 6px apart inside the pill, so the touch area can only
      // grow to the full 44 vertically — horizontally it stops at half the gap
      // so neighbouring icons never steal each other's taps.
      hitSlop={{ top: 8, bottom: 8, left: 3, right: 3 }}
      hoverStyle={disabled ? undefined : { backgroundColor: ui.surfaceHover }}
      pressStyle={disabled ? undefined : { opacity: 0.8 }}
      onPress={disabled ? undefined : onPress}
      accessibilityRole="button"
      aria-label={label}
      accessibilityState={{ disabled: Boolean(disabled), selected: Boolean(active) }}
    >
      {children}
    </XStack>
  )
}

/**
 * Omnibox with suggestions, voice/image/AI controls, and a clear control;
 * scope stays implicit from the route.
 */
export function AppSearchField({ compact, initialQuery = '', scope: scopeProp }: AppSearchFieldProps) {
  const ui = useAppUi()
  const toast = useAppToast()
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
  const [imageBusy, setImageBusy] = useState(false)
  const routeMode = typeof routeParams.mode === 'string' ? routeParams.mode : Array.isArray(routeParams.mode) ? routeParams.mode[0] : ''
  const [sheaiActive, setSheaiActive] = useState(routeMode === 'sheai')
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const blurCloseRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const submitVoiceRef = useRef<(term: string) => void>(() => {})

  const fieldHeight = compact ? 40 : isDesktop ? 44 : 42
  const showFocusRing = focused || open || sheaiActive
  const placeholder = sheaiActive
    ? 'e.g. something special for my mother’s 60th birthday…'
    : 'Search for anything'

  const sheaiSuggestEnabled =
    Boolean(sheaiActive || activeScope === 'listings' || activeScope === 'all') &&
    open &&
    query.trim().length >= 3
  const sheaiSuggest = useSheaiRecommend(query, sheaiSuggestEnabled, 6)

  const voice = useVoiceSearch({
    onPartial: (text) => {
      setQuery(text)
      if (!open) setOpen(true)
    },
    onFinal: (text) => {
      const trimmed = text.trim()
      if (!trimmed) return
      setQuery(trimmed)
      submitVoiceRef.current(trimmed)
    },
  })

  useEffect(() => {
    setQuery(initialQuery)
  }, [initialQuery])

  useEffect(() => {
    setSheaiActive(routeMode === 'sheai')
  }, [routeMode])

  useEffect(() => {
    if (!voice.error) return
    toast.show('Voice search', { tone: 'danger', message: voice.error })
    voice.clearError()
  }, [voice.error, voice.clearError, toast])

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

  function submitSearch(term?: string, mode?: 'ai' | 'sheai' | null) {
    const trimmed = (term ?? query).trim()
    if (trimmed) recordAppSearchTerm(trimmed)
    setOpen(false)
    setFocused(false)
    void voice.stop()
    const useSheai = mode === 'sheai' || (mode == null && sheaiActive)
    if (useSheai) {
      navigateApp(buildSheaiSearchHref(trimmed || undefined) as never)
      return
    }
    if (mode === 'ai') {
      if (!trimmed) {
        toast.show('Ask AI', {
          tone: 'danger',
          message: 'Describe what you are looking for, then tap Ask AI.',
        })
        return
      }
      navigateApp(appRoutes.search(trimmed, 'listings', 'ai') as never)
      return
    }
    navigateApp(appRoutes.search(trimmed || undefined, activeScope) as never)
  }

  function toggleSheai() {
    if (sheaiActive) {
      setSheaiActive(false)
      if (routeMode === 'sheai') {
        navigateApp(appRoutes.search(query.trim() || undefined, 'listings') as never)
      }
      return
    }
    setSheaiActive(true)
    setOpen(true)
    setFocused(true)
    const trimmed = query.trim()
    if (trimmed) {
      submitSearch(trimmed, 'sheai')
      return
    }
    navigateApp(buildSheaiSearchHref() as never)
  }

  submitVoiceRef.current = (term: string) => submitSearch(term)

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

  async function handleImageSearch() {
    if (imageBusy) return
    setImageBusy(true)
    setOpen(false)
    try {
      const result = await searchQueryFromImage()
      if (!result) return
      setQuery(result.query)
      recordAppSearchTerm(result.query)
      navigateApp(appRoutes.search(result.query, 'listings') as never)
    } catch (error) {
      toast.show('Image search', {
        tone: 'danger',
        message: error instanceof Error ? error.message : 'Could not search from that photo.',
      })
    } finally {
      setImageBusy(false)
    }
  }

  const actionColor = ui.textMuted

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
        gap={6}
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
          placeholder={
            voice.listening ? 'Listening…' : imageBusy ? 'Identifying product…' : placeholder
          }
          fontSize={compact ? 14 : 15}
          fontWeight="500"
          color={ui.text}
          placeholderTextColor={ui.textMuted}
          borderWidth={0}
          backgroundColor="transparent"
          {...(Platform.OS === 'web'
            ? ({
                onClick: handleFocus,
                style: { outline: 'none', height: '100%', lineHeight: `${compact ? 14 : 15}px` },
              } as object)
            : {})}
        />

        {imageBusy ? (
          <Spinner size="small" color={ui.brand} />
        ) : (
          <SearchIconButton label="Search with image" onPress={() => void handleImageSearch()}>
            <Icons.Camera size={15} color={actionColor} />
          </SearchIconButton>
        )}

        {voice.supported ? (
          <SearchIconButton
            label={voice.listening ? 'Stop voice search' : 'Search with voice'}
            onPress={() => void voice.toggle()}
            active={voice.listening}
          >
            {voice.listening ? (
              <Icons.MicOff size={15} color={ui.brand} />
            ) : (
              <Icons.Mic size={15} color={actionColor} />
            )}
          </SearchIconButton>
        ) : null}

        <SearchIconButton
          label={sheaiActive ? 'Turn off SHEai' : 'Ask SHEai'}
          onPress={toggleSheai}
          active={sheaiActive}
        >
          <Icons.Sparkles size={15} color={sheaiActive ? ui.brand : actionColor} />
        </SearchIconButton>

        {query.length > 0 ? (
          <SearchIconButton
            label="Clear search"
            onPress={() => {
              setQuery('')
              setOpen(true)
            }}
          >
            <Icons.X size={15} color={ui.textMuted} />
          </SearchIconButton>
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
        sheaiActive={sheaiActive}
        sheaiHits={sheaiSuggest.items}
        sheaiLoading={sheaiSuggest.loading}
        onAskSheai={
          query.trim()
            ? () => {
                setSheaiActive(true)
                submitSearch(undefined, 'sheai')
              }
            : undefined
        }
        onPickSheaiChip={(term) => {
          setQuery(term)
          setSheaiActive(true)
          submitSearch(term, 'sheai')
        }}
      />
    </YStack>
  )
}
