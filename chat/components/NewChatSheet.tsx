import { useEffect, useState } from 'react'

import {
  createDirectConversation,
  createGroupConversation,
  fetchChatCandidates,
  type ChatCandidate,
} from '~/chat/lib/chats'
import { useChatTheme } from '~/chat/lib/chat-theme'
import { ScreenSearchField } from '~/components/search'
import {
  AppBottomSheet,
  Avatar,
  Button,
  Icons,
  Input,
  Spinner,
  Text,
  XStack,
  YStack,
  useAppToast,
} from '~/components/ui'

type NewChatSheetProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  currentUserId: string
  onConversationReady: (conversationId: string) => void
}

export function NewChatSheet({
  open,
  onOpenChange,
  currentUserId,
  onConversationReady,
}: NewChatSheetProps) {
  const theme = useChatTheme()
  const toast = useAppToast()
  const [search, setSearch] = useState('')
  const [candidates, setCandidates] = useState<ChatCandidate[]>([])
  const [loading, setLoading] = useState(false)
  const [groupMode, setGroupMode] = useState(false)
  const [selected, setSelected] = useState<ChatCandidate[]>([])
  const [groupName, setGroupName] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!open) {
      setSearch('')
      setGroupMode(false)
      setSelected([])
      setGroupName('')
      return
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
    setSelected((prev) =>
      prev.some((c) => c.id === candidate.id)
        ? prev.filter((c) => c.id !== candidate.id)
        : [...prev, candidate],
    )
  }

  async function startDirect(candidate: ChatCandidate) {
    if (busy) return
    setBusy(true)
    const { conversationId, error } = await createDirectConversation(candidate.id)
    setBusy(false)
    if (error || !conversationId) {
      toast.show('Could not start chat', { message: error ?? undefined, tone: 'danger' })
      return
    }
    onOpenChange(false)
    onConversationReady(conversationId)
  }

  async function createGroup() {
    if (busy || selected.length === 0) return
    setBusy(true)
    const { conversationId, error } = await createGroupConversation(
      selected.map((c) => c.id),
      groupName.trim() || null,
    )
    setBusy(false)
    if (error || !conversationId) {
      toast.show('Could not create group', { message: error ?? undefined, tone: 'danger' })
      return
    }
    onOpenChange(false)
    onConversationReady(conversationId)
  }

  const footer =
    groupMode && selected.length > 0 ? (
      <YStack gap={10}>
        <Input
          value={groupName}
          onChangeText={setGroupName}
          placeholder="Group name (optional)"
          placeholderTextColor={theme.textMuted}
        />
        <Button tone="primary" onPress={createGroup} disabled={busy} icon={busy ? undefined : <Icons.Users size={18} />}>
          {busy ? 'Creating…' : `Create group · ${selected.length}`}
        </Button>
      </YStack>
    ) : null

  return (
    <AppBottomSheet
      open={open}
      onOpenChange={onOpenChange}
      title={groupMode ? 'New group' : 'New chat'}
      footer={footer}
      scrollable
    >
      <YStack gap={12} paddingBottom="$2">
        <ScreenSearchField
          value={search}
          onChangeText={setSearch}
          placeholder="Search people"
          unifiedScope="people"
        />

        <XStack
          alignSelf="flex-start"
          alignItems="center"
          gap={8}
          paddingVertical={8}
          paddingHorizontal={12}
          borderRadius={999}
          cursor="pointer"
          backgroundColor={groupMode ? theme.brand : theme.listItemHover}
          onPress={() => {
            setGroupMode((v) => !v)
            setSelected([])
          }}
          animation="quick"
          pressStyle={{ scale: 0.97 }}
        >
          <Icons.Users size={16} color={groupMode ? theme.brandContrast : theme.text} />
          <Text fontSize={13} fontWeight="700" color={groupMode ? theme.brandContrast : theme.text}>
            {groupMode ? 'Group selected' : 'New group'}
          </Text>
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
              const isSelected = selected.some((c) => c.id === candidate.id)
              return (
                <XStack
                  key={candidate.id}
                  onPress={() => (groupMode ? toggleSelect(candidate) : startDirect(candidate))}
                  cursor="pointer"
                  alignItems="center"
                  gap={12}
                  paddingVertical={9}
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
                  {groupMode ? (
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
                      {isSelected ? <Icons.Check size={14} color={theme.brandContrast} /> : null}
                    </YStack>
                  ) : (
                    <Icons.MessageCircle size={18} color={theme.textMuted} />
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
