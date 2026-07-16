import { useEffect, useState } from 'react'

import {
  createDirectConversation,
  fetchChatCandidates,
  sendMessage,
  type ChatCandidate,
} from '~/chat/lib/chats'
import { useChatTheme } from '~/chat/lib/chat-theme'
import { ScreenSearchField } from '~/components/search'
import {
  AppBottomSheet,
  Avatar,
  Button,
  Icons,
  Image,
  Input,
  Separator,
  Spinner,
  Text,
  XStack,
  YStack,
  useAppToast,
} from '~/components/ui'
import { copyShareLink } from '~/lib/share'

type SendPostPreview = {
  authorName: string
  authorAvatar?: string | null
  snippet?: string | null
  thumbUrl?: string | null
}

type SendPostSheetProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  currentUserId: string
  /** Canonical link to the shared post. */
  shareUrl: string
  /** Short human context (e.g. "Asha on Sheconomy: …") sent alongside the link. */
  contextText?: string
  /** Compact post card shown at the top of the sheet. */
  preview?: SendPostPreview | null
  /** Called after a successful send with the target conversation id (last recipient). */
  onSent: (conversationId: string) => void
  /** Optional: open external / social share sheet. */
  onShareElsewhere?: () => void
}

/**
 * Professional-network “Send post”: search people, multi-select, optional note,
 * then deliver the post link into direct conversations.
 */
export function SendPostSheet({
  open,
  onOpenChange,
  currentUserId,
  shareUrl,
  contextText,
  preview,
  onSent,
  onShareElsewhere,
}: SendPostSheetProps) {
  const theme = useChatTheme()
  const toast = useAppToast()
  const [search, setSearch] = useState('')
  const [note, setNote] = useState('')
  const [candidates, setCandidates] = useState<ChatCandidate[]>([])
  const [selected, setSelected] = useState<ChatCandidate[]>([])
  const [loading, setLoading] = useState(false)
  const [sending, setSending] = useState(false)

  useEffect(() => {
    if (!open) {
      setSearch('')
      setNote('')
      setSelected([])
      setSending(false)
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

  function toggleSelect(candidate: ChatCandidate) {
    setSelected((current) => {
      if (current.some((item) => item.id === candidate.id)) {
        return current.filter((item) => item.id !== candidate.id)
      }
      return [...current, candidate]
    })
  }

  async function sendSelected() {
    if (!selected.length || sending) return
    setSending(true)

    const content = [note.trim(), contextText?.trim(), shareUrl].filter(Boolean).join('\n')
    let lastConversationId: string | null = null
    let successCount = 0
    let lastError: string | null = null

    for (const candidate of selected) {
      const { conversationId, error } = await createDirectConversation(candidate.id)
      if (error || !conversationId) {
        lastError = error ?? 'Could not open chat'
        continue
      }
      const { error: sendError } = await sendMessage({
        conversationId,
        senderId: currentUserId,
        content,
      })
      if (sendError) {
        lastError = sendError
        continue
      }
      successCount += 1
      lastConversationId = conversationId
    }

    setSending(false)

    if (successCount === 0) {
      toast.show('Could not send', { tone: 'danger', message: lastError ?? undefined })
      return
    }

    onOpenChange(false)
    const names =
      selected.length === 1
        ? selected[0].fullName
        : `${successCount} people`
    toast.show('Sent', { tone: 'success', message: `Post sent to ${names}.` })
    if (lastConversationId) onSent(lastConversationId)
  }

  async function copyLink() {
    const copied = await copyShareLink(shareUrl)
    if (copied) {
      toast.show('Link copied', { tone: 'success', message: 'Post link copied to clipboard.' })
      return
    }
    toast.show('Could not copy link', { tone: 'danger' })
  }

  return (
    <AppBottomSheet open={open} onOpenChange={onOpenChange} title="Send post" scrollable>
      <YStack gap={14} paddingBottom="$2">
        {preview ? (
          <XStack
            gap={12}
            alignItems="center"
            padding={12}
            borderRadius={12}
            borderWidth={1}
            borderColor={theme.border}
            backgroundColor={theme.inputBg}
          >
            <Avatar
              size="$4"
              name={preview.authorName}
              src={preview.authorAvatar ?? undefined}
            />
            <YStack flex={1} minWidth={0} gap={2}>
              <Text fontSize={14} fontWeight="700" color={theme.text} numberOfLines={1}>
                {preview.authorName}
              </Text>
              {preview.snippet ? (
                <Text fontSize={13} color={theme.textMuted} numberOfLines={2}>
                  {preview.snippet}
                </Text>
              ) : null}
            </YStack>
            {preview.thumbUrl ? (
              <Image
                src={preview.thumbUrl}
                width={52}
                height={52}
                borderRadius={8}
                objectFit="cover"
                alt=""
              />
            ) : null}
          </XStack>
        ) : null}

        <Input
          value={note}
          onChangeText={setNote}
          placeholder="Write a message…"
          placeholderTextColor={theme.textMuted}
        />

        {selected.length > 0 ? (
          <XStack flexWrap="wrap" gap={8}>
            {selected.map((person) => (
              <XStack
                key={person.id}
                alignItems="center"
                gap={6}
                paddingHorizontal={10}
                paddingVertical={6}
                borderRadius={999}
                backgroundColor={theme.inputBg}
                borderWidth={1}
                borderColor={theme.border}
                cursor="pointer"
                onPress={() => toggleSelect(person)}
              >
                <Avatar size="$2" name={person.fullName} src={person.avatarUrl ?? undefined} />
                <Text fontSize={13} fontWeight="600" color={theme.text} numberOfLines={1}>
                  {person.fullName.split(' ')[0]}
                </Text>
                <Icons.X size={14} color={theme.textMuted} />
              </XStack>
            ))}
          </XStack>
        ) : null}

        <ScreenSearchField
          value={search}
          onChangeText={setSearch}
          placeholder="Search connections"
          unifiedScope="people"
        />

        <Text fontSize={13} fontWeight="700" color={theme.textMuted}>
          {search.trim() ? 'Results' : 'Suggested'}
        </Text>

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
              const isSelected = selected.some((item) => item.id === candidate.id)
              return (
                <XStack
                  key={candidate.id}
                  onPress={() => toggleSelect(candidate)}
                  cursor="pointer"
                  alignItems="center"
                  gap={12}
                  paddingVertical={10}
                  paddingHorizontal={4}
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
                  <YStack
                    width={22}
                    height={22}
                    borderRadius={999}
                    borderWidth={2}
                    borderColor={isSelected ? theme.brand : theme.border}
                    backgroundColor={isSelected ? theme.brand : 'transparent'}
                    alignItems="center"
                    justifyContent="center"
                  >
                    {isSelected ? <Icons.Check size={14} color="white" /> : null}
                  </YStack>
                </XStack>
              )
            })}
          </YStack>
        )}

        <Button
          backgroundColor={selected.length ? theme.brand : theme.inputBg}
          color={selected.length ? 'white' : theme.textMuted}
          borderRadius={999}
          disabled={!selected.length || sending}
          opacity={!selected.length || sending ? 0.7 : 1}
          onPress={sendSelected}
          icon={sending ? <Spinner size="small" color="white" /> : <Icons.Send size={16} color={selected.length ? 'white' : theme.textMuted} />}
        >
          {sending
            ? 'Sending…'
            : selected.length
              ? `Send${selected.length > 1 ? ` (${selected.length})` : ''}`
              : 'Select people to send'}
        </Button>

        <Separator />

        <YStack gap={4}>
          <XStack
            alignItems="center"
            gap={12}
            paddingVertical={10}
            cursor="pointer"
            hoverStyle={{ backgroundColor: theme.listItemHover }}
            onPress={copyLink}
          >
            <Icons.Link size={18} color={theme.textMuted} />
            <Text fontSize={14} fontWeight="600" color={theme.text}>
              Copy link to post
            </Text>
          </XStack>
          {onShareElsewhere ? (
            <XStack
              alignItems="center"
              gap={12}
              paddingVertical={10}
              cursor="pointer"
              hoverStyle={{ backgroundColor: theme.listItemHover }}
              onPress={() => {
                onOpenChange(false)
                onShareElsewhere()
              }}
            >
              <Icons.Share2 size={18} color={theme.textMuted} />
              <Text fontSize={14} fontWeight="600" color={theme.text}>
                Share via…
              </Text>
            </XStack>
          ) : null}
        </YStack>
      </YStack>
    </AppBottomSheet>
  )
}
