import { useEffect, useState } from 'react'

import {
  createDirectConversation,
  fetchChatCandidates,
  sendMessage,
  type ChatCandidate,
} from '~/chat/lib/chats'
import { useChatTheme } from '~/chat/lib/chat-theme'
import {
  AppBottomSheet,
  Avatar,
  Icons,
  Input,
  Spinner,
  Text,
  XStack,
  YStack,
  useAppToast,
} from '~/components/ui'

type SendPostSheetProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  currentUserId: string
  /** Canonical link to the shared post. */
  shareUrl: string
  /** Short human context (e.g. "Asha on Sheconomy: …") sent alongside the link. */
  contextText?: string
  /** Called after a successful send with the target conversation id. */
  onSent: (conversationId: string) => void
}

/**
 * LinkedIn-style "Send in a message": pick a person and forward the post link
 * (plus an optional note) into a direct conversation.
 */
export function SendPostSheet({
  open,
  onOpenChange,
  currentUserId,
  shareUrl,
  contextText,
  onSent,
}: SendPostSheetProps) {
  const theme = useChatTheme()
  const toast = useAppToast()
  const [search, setSearch] = useState('')
  const [note, setNote] = useState('')
  const [candidates, setCandidates] = useState<ChatCandidate[]>([])
  const [loading, setLoading] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)

  useEffect(() => {
    if (!open) {
      setSearch('')
      setNote('')
      setBusyId(null)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    let cancelled = false
    setLoading(true)
    const handle = setTimeout(() => {
      fetchChatCandidates(currentUserId, search).then((result) => {
        if (cancelled) return
        setCandidates(result.items)
        setLoading(false)
      })
    }, 220)
    return () => {
      cancelled = true
      clearTimeout(handle)
    }
  }, [open, search, currentUserId])

  async function sendTo(candidate: ChatCandidate) {
    if (busyId) return
    setBusyId(candidate.id)

    const { conversationId, error } = await createDirectConversation(candidate.id)
    if (error || !conversationId) {
      setBusyId(null)
      toast.show('Could not open chat', { tone: 'danger', message: error ?? undefined })
      return
    }

    const content = [note.trim(), contextText?.trim(), shareUrl].filter(Boolean).join('\n')
    const { error: sendError } = await sendMessage({
      conversationId,
      senderId: currentUserId,
      content,
    })
    setBusyId(null)

    if (sendError) {
      toast.show('Could not send', { tone: 'danger', message: sendError })
      return
    }

    onOpenChange(false)
    toast.show('Sent', { tone: 'success', message: `Post sent to ${candidate.fullName}.` })
    onSent(conversationId)
  }

  return (
    <AppBottomSheet open={open} onOpenChange={onOpenChange} title="Send post" scrollable>
      <YStack gap={12} paddingBottom="$2">
        <Input
          value={note}
          onChangeText={setNote}
          placeholder="Add a note (optional)"
          placeholderTextColor={theme.textMuted}
        />

        <XStack
          alignItems="center"
          gap={8}
          backgroundColor={theme.inputBg}
          borderRadius={999}
          borderWidth={1}
          borderColor={theme.border}
          paddingHorizontal={12}
        >
          <Icons.Search size={16} color={theme.textMuted} />
          <Input
            flex={1}
            value={search}
            onChangeText={setSearch}
            placeholder="Search people"
            placeholderTextColor={theme.textMuted}
            borderWidth={0}
            backgroundColor="transparent"
            height={42}
            paddingHorizontal={0}
          />
        </XStack>

        {loading ? (
          <YStack alignItems="center" paddingVertical="$6">
            <Spinner color={theme.brand} />
          </YStack>
        ) : candidates.length === 0 ? (
          <YStack alignItems="center" paddingVertical="$6" gap={6}>
            <Icons.UserX size={28} color={theme.textMuted} />
            <Text fontSize={14} color={theme.textMuted}>
              No people found
            </Text>
          </YStack>
        ) : (
          <YStack>
            {candidates.map((candidate) => {
              const isBusy = busyId === candidate.id
              return (
                <XStack
                  key={candidate.id}
                  onPress={() => sendTo(candidate)}
                  cursor="pointer"
                  alignItems="center"
                  gap={12}
                  paddingVertical={9}
                  paddingHorizontal={4}
                  opacity={busyId && !isBusy ? 0.5 : 1}
                  hoverStyle={{ backgroundColor: theme.listItemHover }}
                  pressStyle={{ opacity: 0.8 }}
                  animation="quick"
                >
                  <YStack>
                    <Avatar size="$4" name={candidate.fullName} src={candidate.avatarUrl ?? undefined} />
                    {candidate.isOnline ? (
                      <YStack
                        position="absolute"
                        bottom={0}
                        right={0}
                        width={11}
                        height={11}
                        borderRadius={999}
                        backgroundColor={theme.onlineDot}
                        borderWidth={2}
                        borderColor={theme.listBg}
                      />
                    ) : null}
                  </YStack>
                  <YStack flex={1} minWidth={0}>
                    <Text fontSize={15} fontWeight="600" color={theme.text} numberOfLines={1}>
                      {candidate.fullName}
                    </Text>
                    {candidate.headline || candidate.username ? (
                      <Text fontSize={13} color={theme.textMuted} numberOfLines={1}>
                        {candidate.headline ?? `@${candidate.username}`}
                      </Text>
                    ) : null}
                  </YStack>
                  {isBusy ? (
                    <Spinner size="small" color={theme.brand} />
                  ) : (
                    <Icons.Send size={18} color={theme.brand} />
                  )}
                </XStack>
              )
            })}
          </YStack>
        )}
      </YStack>
    </AppBottomSheet>
  )
}
