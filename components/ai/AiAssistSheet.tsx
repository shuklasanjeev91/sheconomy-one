import { useRouter } from 'one'
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
import { HorizontalScrollRow } from '~/components/layout'
import { BRAND_NAME } from '~/config/brand'
import { radius } from '~/config/tokens'
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
import { useAppUi } from '~/lib/theme/useAppUi'
import { useAiAssist } from '~/providers/AiAssistProvider'

function newLocalId() {
  return `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

const QUICK_ACTIONS: Record<AiProduct, Array<{ label: string; prompt: string; href?: string }>> = {
  commerce: [
    { label: 'Buy t-shirt', prompt: 'I want to buy a t-shirt — show me matching listings' },
    { label: 'Track order', prompt: 'Help me track my recent orders' },
    { label: 'Returns', prompt: 'How do returns and refunds work?' },
    { label: 'Open Help', prompt: '', href: '/help?product=commerce' },
  ],
  community: [
    { label: 'What to post', prompt: 'Suggest a professional post topic for today' },
    { label: 'Grow network', prompt: 'Suggest how to grow my professional network this week' },
    { label: 'Jobs tips', prompt: 'Tips for applying to roles on SHEconomy' },
    { label: 'Open Help', prompt: '', href: '/help?product=community' },
  ],
  chat: [
    { label: 'Start chat', prompt: 'How do I start a new conversation?' },
    { label: 'Mute tips', prompt: 'How do I mute a noisy conversation?' },
    { label: 'Group chat', prompt: 'How do group chats work?' },
    { label: 'Open Help', prompt: '', href: '/help?product=chat' },
  ],
  class: [
    { label: 'Browse classes', prompt: 'Help me find a class to enroll in' },
    { label: 'Enroll', prompt: 'How do I enroll in a class or program?' },
    { label: 'Playback', prompt: 'Video or audio will not play — what should I try?' },
    { label: 'Open Help', prompt: '', href: '/help?product=class' },
  ],
  cowork: [
    { label: 'Host meeting', prompt: 'How do I host a Co-Work meeting?' },
    { label: 'Join with code', prompt: 'How do I join a meeting with a code?' },
    { label: 'AV help', prompt: 'Camera or mic is blocked — how do I fix it?' },
    { label: 'Open Help', prompt: '', href: '/help?product=cowork' },
  ],
  shop: [
    { label: 'New orders', prompt: 'Show me how to manage new shop orders' },
    { label: 'Boost sales', prompt: 'How can I increase my shop sales this week?' },
    { label: 'Low stock', prompt: 'What should I do about low-stock listings?' },
    { label: 'Open Help', prompt: '', href: '/help?product=shop' },
  ],
  account: [
    { label: 'Notifications', prompt: 'Help me tune alerts across products' },
    { label: 'Shop marketplace', prompt: 'I want to buy something on the marketplace' },
    { label: 'Open Help', prompt: '', href: '/help' },
  ],
}

/**
 * Shared AI assistant sheet for web, Android, and iOS.
 */
export function AiAssistSheet() {
  const ui = useAppUi()
  const router = useRouter()
  const {
    open,
    closeAssist,
    routeContext,
    override,
    draftPrompt,
    autoSendPrompt,
    clearDraft,
  } = useAiAssist()

  const product: AiProduct = override?.product ?? routeContext.product
  const contextPage = override?.contextPage ?? routeContext.contextPage
  const context = { ...routeContext.context, ...(override?.context ?? {}) }

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
          },
        ])
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Something went wrong.')
        setMessages((prev) => [
          ...prev,
          {
            id: newLocalId(),
            role: 'assistant',
            content: `I couldn’t reach ${BRAND_NAME} AI just now. Try again, or open Help & Support.`,
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
    if (!open) {
      autoSentRef.current = null
      return
    }
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
    router.push(href as never)
  }

  const footer = (
    <XStack gap="$2" alignItems="center" width="100%" paddingHorizontal="$4" paddingBottom="$3">
      <YStack flex={1} minWidth={0}>
        <Input
          value={input}
          onChangeText={setInput}
          placeholder={`Ask about ${aiProductLabel(product).toLowerCase()}…`}
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
      title={`${BRAND_NAME} AI`}
      footer={footer}
    >
      <YStack gap="$4" paddingHorizontal="$4" paddingTop="$2" paddingBottom="$4">
        <Text fontSize={13} color={ui.textMuted}>
          Context: {aiProductLabel(product)}
          {contextPage ? ` · ${contextPage}` : ''}
        </Text>

        <HorizontalScrollRow gap="$2">
          {(QUICK_ACTIONS[product] ?? QUICK_ACTIONS.account).map((action) => (
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
              onPress={() => {
                if (action.href) {
                  goLink(action.href)
                  return
                }
                void handleSend(action.prompt)
              }}
            >
              <Text fontSize={13} fontWeight="600" color={ui.text} numberOfLines={1}>
                {action.label}
              </Text>
            </XStack>
          ))}
        </HorizontalScrollRow>

        {suggestions.length > 0 ? (
          <YStack gap="$2">
            <Text
              fontSize={12}
              fontWeight="700"
              color={ui.textSecondary}
              textTransform="uppercase"
              letterSpacing={0.6}
            >
              Suggestions
            </Text>
            <HorizontalScrollRow gap="$2">
              {suggestions.map((suggestion) => (
                <XStack
                  key={suggestion.id}
                  paddingHorizontal={12}
                  paddingVertical={8}
                  borderRadius={radius.pill}
                  borderWidth={1}
                  borderColor={ui.borderSubtle}
                  backgroundColor={ui.chip}
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
          </YStack>
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
              How can I help?
            </Text>
            <Text fontSize={14} color={ui.textMuted} lineHeight={20}>
              Ask about orders, community, chat, classes, Co-Work, or your shop — answers stay grounded to
              your account.
            </Text>
          </YStack>
        ) : null}

        {messages.map((message) => {
          const isUser = message.role === 'user'
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
              {message.deepLinks?.length ? (
                <XStack gap="$2" flexWrap="wrap">
                  {message.deepLinks.map((link) => (
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
      </YStack>
    </AppBottomSheet>
  )
}
