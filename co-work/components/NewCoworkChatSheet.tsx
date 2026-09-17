import { useEffect, useState } from 'react'

import { fetchChatCandidates, type ChatCandidate } from '~/chat/lib/chats'
import {
  createCoworkDirectConversation,
  createCoworkGroupConversation,
} from '~/co-work/lib/main-chat'
import { useCoWorkTheme } from '~/co-work/lib/theme'
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

type NewCoworkChatSheetProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  currentUserId: string
  onConversationReady: (conversationId: string) => void
}

export function NewCoworkChatSheet({
  open,
  onOpenChange,
  currentUserId,
  onConversationReady,
}: NewCoworkChatSheetProps) {
  const { ui: coworkUi } = useCoWorkTheme()
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
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    let cancelled = false
    setLoading(true)
    const handle = setTimeout(() => {
      void fetchChatCandidates(currentUserId, search).then((result) => {
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
    setBusy(true)
    const result = await createCoworkDirectConversation(candidate.id)
    setBusy(false)
    if (result.error || !result.conversationId) {
      toast.show('Could not start Co-Work chat', {
        tone: 'danger',
        message: result.error ?? 'Please try again.',
      })
      return
    }
    onOpenChange(false)
    onConversationReady(result.conversationId)
  }

  async function startGroup() {
    if (selected.length === 0) return
    setBusy(true)
    const result = await createCoworkGroupConversation(
      selected.map((row) => row.id),
      groupName.trim() || null,
    )
    setBusy(false)
    if (result.error || !result.conversationId) {
      toast.show('Could not create Co-Work group', {
        tone: 'danger',
        message: result.error ?? 'Please try again.',
      })
      return
    }
    onOpenChange(false)
    onConversationReady(result.conversationId)
  }

  return (
    <AppBottomSheet open={open} onOpenChange={onOpenChange} title="New Co-Work chat">
      <YStack gap="$3" paddingBottom="$4">
        <Text fontSize={13} color={coworkUi.textMuted} lineHeight={18}>
          Co-Work Main Chat is persistent collaboration. Meeting chat stays inside a live room.
        </Text>
        <XStack gap="$2">
          <Button
            tone={!groupMode ? 'primary' : 'outline'}
            size="$2"
            borderRadius={999}
            onPress={() => setGroupMode(false)}
          >
            Direct
          </Button>
          <Button
            tone={groupMode ? 'primary' : 'outline'}
            size="$2"
            borderRadius={999}
            onPress={() => setGroupMode(true)}
          >
            Group
          </Button>
        </XStack>
        <ScreenSearchField
          value={search}
          onChangeText={setSearch}
          placeholder="Search people"
          unifiedScope="people"
        />
        {groupMode ? (
          <Input
            value={groupName}
            onChangeText={setGroupName}
            placeholder="Group name (optional)"
            borderRadius={12}
            backgroundColor="rgba(255,255,255,0.04)"
            borderColor={coworkUi.borderSoft}
            color={coworkUi.text}
          />
        ) : null}
        {loading ? <Spinner size="small" color={coworkUi.brand} /> : null}
        <YStack gap="$2" maxHeight={360}>
          {candidates.map((candidate) => {
            const active = selected.some((row) => row.id === candidate.id)
            return (
              <XStack
                key={candidate.id}
                alignItems="center"
                gap="$3"
                padding="$3"
                borderRadius={14}
                borderWidth={1}
                borderColor={active ? coworkUi.borderAccent : coworkUi.borderSoft}
                backgroundColor={active ? coworkUi.brandMuted : 'rgba(255,255,255,0.03)'}
                pressStyle={{ opacity: 0.85 }}
                onPress={() => {
                  if (groupMode) toggleSelect(candidate)
                  else void startDirect(candidate)
                }}
              >
                <Avatar
                  name={candidate.fullName || candidate.username || 'Member'}
                  src={candidate.avatarUrl ?? undefined}
                  size="$3"
                />
                <YStack flex={1} gap={2}>
                  <Text fontWeight="700" color={coworkUi.text} numberOfLines={1}>
                    {candidate.fullName || candidate.username || 'Member'}
                  </Text>
                  {candidate.username ? (
                    <Text fontSize={12} color={coworkUi.textMuted} numberOfLines={1}>
                      @{candidate.username}
                    </Text>
                  ) : null}
                </YStack>
                {groupMode && active ? <Icons.Check size={18} color={coworkUi.brandLight} /> : null}
              </XStack>
            )
          })}
          {!loading && candidates.length === 0 ? (
            <Text fontSize={13} color={coworkUi.textMuted} paddingVertical="$3">
              No people found.
            </Text>
          ) : null}
        </YStack>
        {groupMode ? (
          <Button
            tone="primary"
            borderRadius={999}
            disabled={busy || selected.length === 0}
            icon={busy ? <Spinner size="small" color="white" /> : <Icons.Users size={16} color="white" />}
            onPress={() => void startGroup()}
          >
            Create Co-Work group
          </Button>
        ) : null}
      </YStack>
    </AppBottomSheet>
  )
}
