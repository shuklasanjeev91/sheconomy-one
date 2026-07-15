import { useEffect, useRef, useState } from 'react'

import {
  encodeMentions,
  getActiveToken,
  replaceActiveToken,
  type MentionRef,
} from '~/community/lib/mentions'
import { searchProfiles, suggestHashtags, type ProfileSuggestion } from '~/community/lib/network'
import { Avatar, Icons, Input, Spinner, Text, TextArea, XStack, YStack } from '~/components/ui'
import { useAppUi } from '~/lib/theme/useAppUi'

type SuggestionState =
  | { kind: 'mention'; items: ProfileSuggestion[] }
  | { kind: 'hashtag'; items: string[] }
  | null

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
  flex,
  ...inputStyle
}: MentionInputProps) {
  const ui = useAppUi()
  const mentionsRef = useRef<MentionRef[]>([])
  const [focused, setFocused] = useState(false)
  const [results, setResults] = useState<SuggestionState>(null)
  const [loading, setLoading] = useState(false)

  function emit(next: string) {
    onChangeText(next)
    onEncodedChange?.(encodeMentions(next, mentionsRef.current))
  }

  useEffect(() => {
    const token = getActiveToken(value)
    if (!focused || !token) {
      setResults(null)
      setLoading(false)
      return
    }

    let active = true
    setLoading(true)
    const timer = setTimeout(async () => {
      if (token.type === 'mention') {
        const items = await searchProfiles(token.query, 6)
        if (active) setResults({ kind: 'mention', items })
      } else {
        const items = await suggestHashtags(token.query, 8)
        if (active) setResults({ kind: 'hashtag', items })
      }
      if (active) setLoading(false)
    }, 160)

    return () => {
      active = false
      clearTimeout(timer)
    }
  }, [value, focused])

  function selectProfile(profile: ProfileSuggestion) {
    const token = getActiveToken(value)
    if (!token) return
    const display = profile.full_name?.trim() || profile.username || 'member'
    mentionsRef.current = [...mentionsRef.current, { id: profile.id, display }]
    emit(replaceActiveToken(value, token.start, `@${display}`))
    setResults(null)
  }

  function selectHashtag(tag: string) {
    const token = getActiveToken(value)
    if (!token) return
    emit(replaceActiveToken(value, token.start, `#${tag}`))
    setResults(null)
  }

  const showDropdown =
    focused && (loading || (results !== null && results.items.length > 0))

  const dropdown = showDropdown ? (
    <YStack
      position="absolute"
      left={0}
      right={0}
      {...(suggestionsPlacement === 'top' ? { bottom: '100%', marginBottom: 6 } : { top: '100%', marginTop: 6 })}
      zIndex={1000}
      backgroundColor={ui.elevatedSurface}
      borderWidth={1}
      borderColor={ui.border}
      borderRadius={12}
      overflow="hidden"
      maxHeight={260}
      style={{ boxShadow: ui.shadowCard as string }}
    >
      {loading && (results === null || results.items.length === 0) ? (
        <XStack padding="$3" alignItems="center" gap="$2">
          <Spinner size="small" />
          <Text fontSize={13} color={ui.textMuted}>
            Searching…
          </Text>
        </XStack>
      ) : results?.kind === 'mention' ? (
        results.items.map((profile) => (
          <XStack
            key={profile.id}
            gap="$2"
            alignItems="center"
            paddingVertical="$2"
            paddingHorizontal="$3"
            cursor="pointer"
            hoverStyle={{ backgroundColor: ui.surfaceHover }}
            onPress={() => selectProfile(profile)}
          >
            <Avatar
              name={profile.full_name || profile.username || 'member'}
              src={profile.avatar_url ?? undefined}
              size="$3"
            />
            <YStack flex={1} minWidth={0}>
              <Text fontSize={14} fontWeight="600" color={ui.text} numberOfLines={1}>
                {profile.full_name || profile.username}
              </Text>
              {profile.headline ? (
                <Text fontSize={12} color={ui.textMuted} numberOfLines={1}>
                  {profile.headline}
                </Text>
              ) : profile.username ? (
                <Text fontSize={12} color={ui.textMuted} numberOfLines={1}>
                  @{profile.username}
                </Text>
              ) : null}
            </YStack>
          </XStack>
        ))
      ) : results?.kind === 'hashtag' ? (
        results.items.map((tag) => (
          <XStack
            key={tag}
            gap="$2"
            alignItems="center"
            paddingVertical="$2"
            paddingHorizontal="$3"
            cursor="pointer"
            hoverStyle={{ backgroundColor: ui.surfaceHover }}
            onPress={() => selectHashtag(tag)}
          >
            <Icons.Hash size={16} color={ui.brand} />
            <Text fontSize={14} fontWeight="500" color={ui.text} numberOfLines={1}>
              {tag}
            </Text>
          </XStack>
        ))
      ) : null}
    </YStack>
  ) : null

  const commonProps = {
    value,
    onChangeText: emit,
    placeholder,
    autoFocus,
    onFocus: () => setFocused(true),
    // Delay so a tap on a suggestion is registered before the dropdown unmounts.
    onBlur: () => setTimeout(() => setFocused(false), 180),
    ...inputStyle,
  }

  return (
    <YStack position="relative" flex={flex}>
      {multiline ? (
        <TextArea
          width="100%"
          {...commonProps}
        />
      ) : (
        <Input
          width="100%"
          {...commonProps}
          onSubmitEditing={() => {
            const active = getActiveToken(value)
            if (active && results && results.items.length > 0) {
              if (results.kind === 'mention') selectProfile(results.items[0])
              else selectHashtag(results.items[0])
              return
            }
            onSubmitEditing?.()
          }}
        />
      )}
      {dropdown}
    </YStack>
  )
}
