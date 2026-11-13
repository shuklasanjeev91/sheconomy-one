import { useCallback, useEffect, useRef, useState } from 'react'

import {
  AppBottomSheet,
  Button,
  Icons,
  Input,
  Spinner,
  Text,
  XStack,
  YStack,
} from '~/components/ui'
import { DictationMicButton } from '~/components/ai/DictationMicButton'
import { HorizontalScrollRow } from '~/components/layout'
import { AI_NAME } from '~/config/brand'
import { useDictationOptional } from '~/providers/dictation-context'
import { radius } from '~/config/tokens'
import { ListingGrid } from '~/commerce/components/ListingGrid'
import { fetchListingsByIds, type ListingSummary } from '~/commerce/lib/commerce'
import {
  aiProductLabel,
  fetchAiSuggestions,
  sendAiMessage,
  sendAiSuggestionFeedback,
  type AiAssistMessage,
  type AiProduct,
  type AiSuggestion,
} from '~/lib/ai'
import { helpHref } from '~/lib/help/types'
import { productQuestionChips } from '~/lib/listing/product-questions'
import { useAppUi } from '~/lib/theme/useAppUi'
import {
  useAiAssistOptional,
  type AiAssistContextValue,
  type OpenAssistOptions,
} from '~/providers/ai-assist-context'
import type { AiRouteContext } from '~/lib/ai'
import { navigateApp } from '~/lib/platform/navigate'

function newLocalId() {
  return `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function RelatedListingCards({ ids }: { ids: string[] }) {
  const [rows, setRows] = useState<ListingSummary[]>([])

  useEffect(() => {
    let cancelled = false
    void fetchListingsByIds(ids).then((listings) => {
      if (cancelled) return
      const order = new Map(ids.map((id, index) => [id, index]))
      setRows(
        [...listings].sort((left, right) => (order.get(left.id) ?? 0) - (order.get(right.id) ?? 0)),
      )
    })
    return () => {
      cancelled = true
    }
  }, [ids])

  if (!rows.length) return null
  return <ListingGrid listings={rows} columns={2} personalize={false} showQuickAdd />
}

/**
 * Shared AI assistant sheet for web, Android, and iOS.
 */
export function AiAssistSheet() {
  const ui = useAppUi()
  const assist = useAiAssistOptional()
  // Avoid blanking the whole app if the provider is missing (e.g. Fast Refresh desync).
  if (!assist) return null

  const {
    open,
    closeAssist,
    routeContext,
    override,
    draftPrompt,
    autoSendPrompt,
    clearDraft,
  } = assist

  return (
    <AiAssistSheetBody
      ui={ui}
      open={open}
      closeAssist={closeAssist}
      routeContext={routeContext}
      override={override}
      draftPrompt={draftPrompt}
      autoSendPrompt={autoSendPrompt}
      clearDraft={clearDraft}
    />
  )
}

function AiAssistSheetBody({
  ui,
  open,
  closeAssist,
  routeContext,
  override,
  draftPrompt,
  autoSendPrompt,
  clearDraft,
}: {
  ui: ReturnType<typeof useAppUi>
  open: boolean
  closeAssist: AiAssistContextValue['closeAssist']
  routeContext: AiRouteContext
  override: OpenAssistOptions | null
  draftPrompt: string | null
  autoSendPrompt: boolean
  clearDraft: AiAssistContextValue['clearDraft']
}) {
  const dictation = useDictationOptional()
  const product: AiProduct = override?.product ?? routeContext.product
  const contextPage = override?.contextPage ?? routeContext.contextPage
  const context = { ...routeContext.context, ...(override?.context ?? {}) }
  const listingTitle = typeof context.listing_title === 'string' ? context.listing_title.trim() : ''
  const listingCategory = typeof context.listing_category === 'string' ? context.listing_category : ''
  const onListing = contextPage === 'listing' && Boolean(listingTitle || context.listing_slug || context.listing_id)
  const productQuestions = onListing ? productQuestionChips(listingCategory) : []

  const [suggestions, setSuggestions] = useState<AiSuggestion[]>([])
  const [messages, setMessages] = useState<AiAssistMessage[]>([])
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const sessionIdRef = useRef<string | null>(null)
  const sendingRef = useRef(false)
  const autoSentRef = useRef<string | null>(null)

  useEffect(() => {
    sessionIdRef.current = sessionId
  }, [sessionId])

  const handleSend = useCallback(
    async (raw?: string) => {
      const text = (raw ?? input).trim()
      if (!text || sendingRef.current) return

      sendingRef.current = true
      setSending(true)
      setError(null)
      setInput('')
      setMessages((prev) => [...prev, { id: newLocalId(), role: 'user', content: text }])

      try {
        const result = await sendAiMessage({
          product,
          message: text,
          sessionId: sessionIdRef.current,
          contextPage,
          context,
        })
        sessionIdRef.current = result.sessionId
        setSessionId(result.sessionId)
        setMessages((prev) => [
          ...prev,
          {
            id: newLocalId(),
            role: 'assistant',
            content: result.answer,
            deepLinks: result.deepLinks,
            listingIds: result.listingIds,
          },
        ])
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Something went wrong.')
        setMessages((prev) => [
          ...prev,
          {
            id: newLocalId(),
            role: 'assistant',
            content: `I couldn’t reach ${AI_NAME} just now. Try again, or open Help & Support.`,
            deepLinks: [{ label: 'Help Center', href: helpHref(product === 'account' ? '' : product) }],
          },
        ])
      } finally {
        sendingRef.current = false
        setSending(false)
      }
    },
    [context, contextPage, input, product],
  )

  useEffect(() => {
    if (open) return
    autoSentRef.current = null
    void dictation?.stop()
    // Only when the sheet closes — don't restart suggestion fetch on mic toggles.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- stop dictation on close only
  }, [open])

  useEffect(() => {
    if (!open) return
    setError(null)
    void fetchAiSuggestions({ product, contextPage })
      .then(setSuggestions)
      .catch(() => setSuggestions([]))
  }, [open, product, contextPage])

  useEffect(() => {
    if (!open || !draftPrompt) return
    setInput(draftPrompt)
    if (!autoSendPrompt) {
      clearDraft()
      return
    }
    if (autoSentRef.current === draftPrompt) return
    autoSentRef.current = draftPrompt
    const prompt = draftPrompt
    clearDraft()
    void handleSend(prompt)
  }, [open, draftPrompt, autoSendPrompt, clearDraft, handleSend])

  function onChip(suggestion: AiSuggestion) {
    void sendAiSuggestionFeedback({ suggestionId: suggestion.id, helpful: true }).catch(() => {})
    void handleSend(suggestion.suggestion_action || suggestion.suggestion_text)
  }

  function goLink(href: string) {
    closeAssist()
    navigateApp(href as never)
  }

  const footer = (
    <XStack gap="$2" alignItems="center" width="100%" paddingHorizontal="$4" paddingBottom="$3">
      <DictationMicButton
        size={40}
        disabled={sending}
        bindValue={input}
        bindOnChangeText={setInput}
      />
      <YStack flex={1} minWidth={0}>
        <Input
          value={input}
          onChangeText={setInput}
          placeholder={
            onListing
              ? 'Ask about this product…'
              : `Ask about ${aiProductLabel(product).toLowerCase()}…`
          }
          onSubmitEditing={() => void handleSend()}
          returnKeyType="send"
          editable={!sending}
        />
      </YStack>
      <Button
        tone="primary"
        size="$4"
        borderRadius={radius.pill}
        disabled={sending || !input.trim()}
        icon={sending ? <Spinner size="small" color="white" /> : <Icons.Send size={16} color="white" />}
        onPress={() => void handleSend()}
        aria-label="Send"
      />
    </XStack>
  )

  return (
    <AppBottomSheet
      open={open}
      onOpenChange={(next) => {
        if (!next) closeAssist()
      }}
      title={onListing && listingTitle ? listingTitle : AI_NAME}
      footer={footer}
    >
      <YStack gap="$4" paddingHorizontal="$4" paddingTop="$2" paddingBottom="$4">
        {onListing ? null : (
          <Text fontSize={13} color={ui.textMuted}>
            {`Context: ${aiProductLabel(product)}${contextPage ? ` · ${contextPage}` : ''}`}
          </Text>
        )}

        {onListing && productQuestions.length > 0 ? (
          <HorizontalScrollRow gap="$2">
            {productQuestions.map((action) => (
              <XStack
                key={action.label}
                paddingHorizontal={12}
                paddingVertical={8}
                borderRadius={radius.pill}
                borderWidth={1}
                borderColor={ui.borderSubtle}
                backgroundColor={ui.surface}
                cursor="pointer"
                pressStyle={{ opacity: 0.85 }}
                onPress={() => void handleSend(action.prompt)}
              >
                <Text fontSize={13} fontWeight="600" color={ui.text} numberOfLines={1}>
                  {action.label}
                </Text>
              </XStack>
            ))}
          </HorizontalScrollRow>
        ) : null}

        {!onListing && suggestions.length > 0 ? (
          <HorizontalScrollRow gap="$2">
            {suggestions.map((suggestion) => (
              <XStack
                key={suggestion.id}
                paddingHorizontal={12}
                paddingVertical={8}
                borderRadius={radius.pill}
                borderWidth={1}
                borderColor={ui.borderSubtle}
                backgroundColor={ui.surface}
                cursor="pointer"
                pressStyle={{ opacity: 0.85 }}
                onPress={() => onChip(suggestion)}
              >
                <Text fontSize={13} fontWeight="600" color={ui.text} numberOfLines={1}>
                  {suggestion.suggestion_text}
                </Text>
              </XStack>
            ))}
          </HorizontalScrollRow>
        ) : null}

        {messages.length === 0 && !sending ? (
          <YStack
            padding="$4"
            borderRadius={12}
            backgroundColor={ui.surface}
            borderWidth={1}
            borderColor={ui.borderSubtle}
            gap="$2"
          >
            <Text fontSize={15} fontWeight="700" color={ui.text}>
              {onListing ? 'Ask about this product' : 'How can I help?'}
            </Text>
            <Text fontSize={14} color={ui.textMuted} lineHeight={20}>
              {onListing
                ? 'Answers come from this listing.'
                : 'AI support for Marketplace, Community, Chat, Classes, Co-Work, and your shop — including scheduling meetings, tracking orders, and seller tips.'}
            </Text>
          </YStack>
        ) : null}

        {messages.map((message) => {
          const isUser = message.role === 'user'
          const links = onListing ? [] : (message.deepLinks ?? [])
          return (
            <YStack
              key={message.id}
              alignSelf={isUser ? 'flex-end' : 'flex-start'}
              maxWidth="92%"
              gap="$2"
            >
              <YStack
                paddingHorizontal="$3.5"
                paddingVertical="$3"
                borderRadius={14}
                backgroundColor={isUser ? ui.brand : ui.surface}
                borderWidth={isUser ? 0 : 1}
                borderColor={ui.borderSubtle}
              >
                <Text fontSize={14} color={isUser ? ui.onBrand : ui.text} lineHeight={20}>
                  {message.content}
                </Text>
              </YStack>
              {links.length ? (
                <XStack gap="$2" flexWrap="wrap">
                  {links.map((link) => (
                    <XStack
                      key={`${message.id}-${link.href}`}
                      paddingHorizontal={10}
                      paddingVertical={6}
                      borderRadius={radius.pill}
                      borderWidth={1}
                      borderColor={ui.borderSubtle}
                      backgroundColor={ui.chip}
                      cursor="pointer"
                      onPress={() => goLink(link.href)}
                    >
                      <Text fontSize={12} fontWeight="600" color={ui.brand}>
                        {link.label}
                      </Text>
                    </XStack>
                  ))}
                </XStack>
              ) : null}
              {message.listingIds?.length ? <RelatedListingCards ids={message.listingIds} /> : null}
            </YStack>
          )
        })}

        {sending ? (
          <XStack alignItems="center" gap="$2">
            <Spinner size="small" color={ui.brand} />
            <Text fontSize={13} color={ui.textMuted}>
              Thinking…
            </Text>
          </XStack>
        ) : null}

        {error ? (
          <Text fontSize={13} color={ui.danger}>
            {error}
          </Text>
        ) : null}

        {!onListing ? (
          <XStack
            alignItems="center"
            gap="$2"
            cursor="pointer"
            onPress={() => goLink(helpHref(product === 'account' ? '' : product))}
          >
            <Icons.HelpCircle size={16} color={ui.textMuted} />
            <Text fontSize={13} color={ui.textMuted}>
              Open Help & Support
            </Text>
          </XStack>
        ) : null}
      </YStack>
    </AppBottomSheet>
  )
}
