import { useMemo, useRef, useState } from 'react'

import { MentionHashtagSuggestPanel } from '~/community/components/MentionHashtagSuggestPanel'
import {
  encodeMentions,
  getActiveToken,
  replaceActiveToken,
  type MentionRef,
} from '~/community/lib/mentions'
import type { ProfileSuggestion } from '~/community/lib/network'
import { useMentionHashtagSuggestions } from '~/community/hooks/useMentionHashtagSuggestions'
import { useAppLayout } from '~/hooks/useAppLayout'
import { Input, TextArea, YStack } from '~/components/ui'

type MentionInputProps = {
  value: string
  onChangeText: (text: string) => void
  /** Called with the submit-ready value where mentions are encoded as tokens. */
  onEncodedChange?: (encoded: string) => void
  placeholder?: string
  multiline?: boolean
  suggestionsPlacement?: 'top' | 'bottom'
  onSubmitEditing?: () => void
  autoFocus?: boolean
  testID?: string
  accessibilityLabel?: string
  // Style passthrough forwarded to the underlying input.
  minHeight?: number
  fontSize?: number
  lineHeight?: number
  borderWidth?: number
  borderRadius?: number
  backgroundColor?: string
  padding?: number
  flex?: number
  invalid?: boolean
}

export function MentionInput({
  value,
  onChangeText,
  onEncodedChange,
  placeholder,
  multiline = false,
  suggestionsPlacement = 'bottom',
  onSubmitEditing,
  autoFocus,
  testID,
  accessibilityLabel,
  flex,
  ...inputStyle
}: MentionInputProps) {
  const mentionsRef = useRef<MentionRef[]>([])
  const [focused, setFocused] = useState(false)
  const [panelOpen, setPanelOpen] = useState(false)
  const { isDesktop } = useAppLayout()

  const activeToken = useMemo(() => getActiveToken(value), [value])
  const suggestEnabled = activeToken != null && panelOpen && (isDesktop ? focused : true)

  const { results, loading, loadingMore, error, hasMore, loadMore, clear } =
    useMentionHashtagSuggestions({
      token: activeToken,
      enabled: suggestEnabled,
    })

  function emit(next: string) {
    onChangeText(next)
    onEncodedChange?.(encodeMentions(next, mentionsRef.current))
  }

  function updateActiveTokenQuery(nextQuery: string) {
    const token = getActiveToken(value)
    if (!token) return
    const prefix = token.type === 'mention' ? '@' : '#'
    emit(`${value.slice(0, token.start)}${prefix}${nextQuery}`)
    setPanelOpen(true)
  }

  function selectProfile(profile: ProfileSuggestion) {
    const token = getActiveToken(value)
    if (!token) return
    const display = profile.full_name?.trim() || profile.username || 'member'
    mentionsRef.current = [...mentionsRef.current, { id: profile.id, display }]
    emit(replaceActiveToken(value, token.start, `@${display}`))
    clear()
    setPanelOpen(false)
  }

  function selectHashtag(tag: string) {
    const token = getActiveToken(value)
    if (!token) return
    emit(replaceActiveToken(value, token.start, `#${tag}`))
    clear()
    setPanelOpen(false)
  }

  function handleFocus() {
    setFocused(true)
    if (getActiveToken(value)) setPanelOpen(true)
  }

  function handleBlur() {
    // Desktop: close anchored panel when the input blurs.
    // Mobile: keep the bottom sheet open until the user picks someone or dismisses it.
    setTimeout(() => {
      setFocused(false)
      if (isDesktop) setPanelOpen(false)
    }, 180)
  }

  const showPanel =
    panelOpen &&
    activeToken != null &&
    (isDesktop ? focused : true) &&
    (loading || error != null || results != null)

  const commonProps = {
    value,
    onChangeText: (next: string) => {
      emit(next)
      const token = getActiveToken(next)
      setPanelOpen(focused && token != null)
    },
    placeholder,
    autoFocus,
    onFocus: handleFocus,
    onBlur: handleBlur,
    testID,
    accessibilityLabel: accessibilityLabel ?? placeholder,
    ...inputStyle,
  }

  return (
    <YStack position="relative" flex={flex}>
      {multiline ? (
        <TextArea width="100%" writingPaused={showPanel} {...commonProps} />
      ) : (
        <Input
          width="100%"
          writingAssist
          writingPaused={showPanel}
          {...commonProps}
          onSubmitEditing={() => {
            const token = getActiveToken(value)
            if (token && results && results.items.length > 0) {
              if (results.kind === 'mention') selectProfile(results.items[0])
              else selectHashtag(results.items[0].tag)
              return
            }
            onSubmitEditing?.()
          }}
        />
      )}

      {activeToken && showPanel ? (
        <MentionHashtagSuggestPanel
          open={showPanel}
          onOpenChange={setPanelOpen}
          kind={activeToken.type}
          query={activeToken.query}
          onQueryChange={updateActiveTokenQuery}
          results={results}
          loading={loading}
          loadingMore={loadingMore}
          error={error}
          hasMore={hasMore}
          placement={suggestionsPlacement}
          onSelectProfile={selectProfile}
          onSelectHashtag={selectHashtag}
          onLoadMore={loadMore}
        />
      ) : null}
    </YStack>
  )
}
