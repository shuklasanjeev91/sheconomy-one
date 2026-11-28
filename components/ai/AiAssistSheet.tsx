import { useCallback, useEffect, useRef, useState } from 'react'
import { Platform } from 'react-native'

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
import { getListingSlug } from '~/lib/supabase/commerce'
import {
  aiProductLabel,
  fetchAiSuggestions,
  sendAiMessage,
  sendAiSuggestionFeedback,
  type AiAssistAction,
  type AiAssistMessage,
  type AiProduct,
  type AiSuggestion,
} from '~/lib/ai'
import { helpHref } from '~/lib/help/types'
import { productQuestionChips } from '~/lib/listing/product-questions'
import { useOptionalRegionPreferences } from '~/lib/locale'
import { useAppUi } from '~/lib/theme/useAppUi'
import {
  useAiAssistOptional,
  type AiAssistContextValue,
  type OpenAssistOptions,
} from '~/providers/ai-assist-context'
import { useListingAssistHandlersOptional } from '~/providers/listing-assist-handlers'
import type { AiRouteContext } from '~/lib/ai'
import { navigateApp } from '~/lib/platform/navigate'
import { routes } from '~/lib/routes'
import { useAppToast } from '~/components/ui/Toast'

function newLocalId() {
  return `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function RelatedListingCards({
  ids,
  onOpenListing,
}: {
  ids: string[]
  onOpenListing: (listing: ListingSummary) => void
}) {
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
  return (
    <ListingGrid
      listings={rows}
      columns={2}
      personalize={false}
      showQuickAdd
      onOpenListing={onOpenListing}
    />
  )
}

/**
 * Shared AI assistant sheet for web, Android, and iOS.
 */
export function AiAssistSheet() {
  const ui = useAppUi()
  const assist = useAiAssistOptional()
  const region = useOptionalRegionPreferences()
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
      languageName={region?.languageName ?? 'English'}
      languageCode={region?.languageCode ?? 'en'}
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
  languageName,
  languageCode,
}: {
  ui: ReturnType<typeof useAppUi>
  open: boolean
  closeAssist: AiAssistContextValue['closeAssist']
  routeContext: AiRouteContext
  override: OpenAssistOptions | null
  draftPrompt: string | null
  autoSendPrompt: boolean
  clearDraft: AiAssistContextValue['clearDraft']
  languageName: string
  languageCode: string
}) {
  const dictation = useDictationOptional()
  const toast = useAppToast()
  const listingHandlers = useListingAssistHandlersOptional()
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
  const [actingId, setActingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const sessionIdRef = useRef<string | null>(null)
  const sendingRef = useRef(false)
  const autoSentRef = useRef<string | null>(null)
  const autoRanRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    sessionIdRef.current = sessionId
  }, [sessionId])

  const runAssistAction = useCallback(
    async (action: AiAssistAction, sourceMessageId: string) => {
      const handlers = listingHandlers?.get() ?? null
      const key = `${sourceMessageId}:${action.type}:${action.label}`
      if (actingId === key) return
      setActingId(key)
      try {
        if (action.type === 'add_to_cart') {
          if (!handlers?.addToCart) {
            toast.show('Open this product page to add it to cart', { tone: 'info' })
            return
          }
          const result = await handlers.addToCart()
          if (!result.ok) {
            toast.show('Could not add to cart', { tone: 'danger', message: result.error })
            return
          }
          toast.show('Added to cart', { tone: 'success' })
          return
        }
        if (action.type === 'checkout') {
          if (!handlers?.checkout) {
            closeAssist()
            navigateApp(routes.checkout as never)
            return
          }
          const result = await handlers.checkout()
          if (!result.ok) {
            toast.show('Could not start checkout', { tone: 'danger', message: result.error })
            return
          }
          closeAssist()
          return
        }
        if (action.type === 'follow_shop') {
          if (!handlers?.followShop) {
            toast.show('Open this product page to follow the shop', { tone: 'info' })
            return
          }
          const result = await handlers.followShop()
          if (!result.ok) {
            toast.show('Could not update follow', { tone: 'danger', message: result.error })
            return
          }
          toast.show(result.following ? 'Following shop' : 'Unfollowed shop', { tone: 'success' })
          return
        }
        if (action.type === 'message_seller') {
          if (!handlers?.messageSeller) {
            toast.show('Open this product page to message the seller', { tone: 'info' })
            return
          }
          const result = await handlers.messageSeller()
          if (!result.ok) {
            toast.show('Could not open chat', { tone: 'danger', message: result.error })
            return
          }
          closeAssist()
          return
        }
        if (action.type === 'open_shop') {
          if (handlers?.openShop) {
            handlers.openShop()
            closeAssist()
            return
          }
          if (action.href) {
            closeAssist()
            navigateApp(action.href as never)
          }
          return
        }
        if (action.type === 'open_cart') {
          closeAssist()
          navigateApp(routes.cart as never)
          return
        }
        if (action.type === 'navigate' && action.href) {
          closeAssist()
          navigateApp(action.href as never)
        }
      } finally {
        setActingId(null)
      }
    },
    [actingId, closeAssist, listingHandlers, toast],
  )

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
        const assistantId = newLocalId()
        const actions = result.actions ?? []
        setMessages((prev) => [
          ...prev,
          {
            id: assistantId,
            role: 'assistant',
            content: result.answer,
            deepLinks: result.deepLinks,
            listingIds: result.listingIds,
            actions,
          },
        ])
        const auto = actions.find((action) => action.autoExecute)
        if (auto && !autoRanRef.current.has(assistantId)) {
          autoRanRef.current.add(assistantId)
          void runAssistAction(auto, assistantId)
        }
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
    [context, contextPage, input, product, runAssistAction],
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

  function openRelatedListing(listing: ListingSummary) {
    const slug = getListingSlug(listing)
    goLink(routes.listing(Platform.OS === 'web' ? slug : listing.id))
  }

  const footer = (
    <XStack gap="$2" alignItems="center" width="100%" paddingHorizontal="$4" paddingBottom="$3">
      <XStack
        flex={1}
        minWidth={0}
        alignItems="center"
        gap="$1"
        minHeight={48}
        paddingLeft="$3"
        paddingRight="$1.5"
        borderRadius={radius.pill}
        borderWidth={1}
        borderColor={ui.borderSubtle}
        backgroundColor={ui.surface}
      >
        <Input
          flex={1}
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
          borderWidth={0}
          backgroundColor="transparent"
          height={40}
          paddingHorizontal={0}
          focusStyle={{
            borderWidth: 0,
            outlineWidth: 0,
            backgroundColor: 'transparent',
            shadowOpacity: 0,
          }}
          hoverStyle={{ borderColor: 'transparent' }}
        />
        <DictationMicButton
          size={34}
          disabled={sending}
          bindValue={input}
          bindOnChangeText={setInput}
        />
      </XStack>
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
            {`Context: ${aiProductLabel(product)}${contextPage ? ` · ${contextPage}` : ''} · ${languageName}`}
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
                : languageCode === 'en'
                  ? 'AI support for Marketplace, Community, Chat, Classes, Co-Work, and your shop — including scheduling meetings, tracking orders, and seller tips.'
                  : `${AI_NAME} replies in ${languageName}. Change language anytime in Region preferences.`}
            </Text>
          </YStack>
        ) : null}

        {messages.map((message) => {
          const isUser = message.role === 'user'
          const links = onListing ? [] : (message.deepLinks ?? [])
          const actions = message.actions ?? []
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
              {actions.length ? (
                <XStack gap="$2" flexWrap="wrap">
                  {actions.map((action) => {
                    const busy = actingId === `${message.id}:${action.type}:${action.label}`
                    return (
                      <XStack
                        key={`${message.id}-${action.type}-${action.label}`}
                        paddingHorizontal={10}
                        paddingVertical={6}
                        borderRadius={radius.pill}
                        borderWidth={1}
                        borderColor={ui.brand}
                        backgroundColor={ui.chip}
                        cursor="pointer"
                        opacity={busy ? 0.7 : 1}
                        onPress={() => void runAssistAction(action, message.id)}
                      >
                        <Text fontSize={12} fontWeight="600" color={ui.brand}>
                          {busy ? 'Working…' : action.label}
                        </Text>
                      </XStack>
                    )
                  })}
                </XStack>
              ) : null}
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
              {message.listingIds?.length ? (
                <RelatedListingCards ids={message.listingIds} onOpenListing={openRelatedListing} />
              ) : null}
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
