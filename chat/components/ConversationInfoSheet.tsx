import { cloneElement, isValidElement, useCallback, useEffect, useState } from 'react'
import { Linking } from 'react-native'

import {
  addGroupParticipants,
  fetchChatCandidates,
  fetchContactProfile,
  fetchConversationParticipants,
  fetchSharedMedia,
  getChatMediaUrl,
  removeGroupParticipant,
  setGroupParticipantRole,
  sortParticipants,
  updateGroupInfo,
  type ChatCandidate,
  type ContactProfile,
  type ConversationParticipant,
  type SharedMediaItem,
} from '~/chat/lib/chats'
import { useChatTheme } from '~/chat/lib/chat-theme'
import { formatLastSeen } from '~/chat/lib/time'
import type { ChatSummary } from '~/chat/lib/types'
import {
  AppBottomSheet,
  Avatar,
  Icons,
  Image,
  Input,
  Spinner,
  Text,
  XStack,
  YStack,
  useAppToast,
} from '~/components/ui'
import { pickImages, pickedImageToBlob } from '~/lib/media/pick-image'
import { uploadGroupAvatarImage } from '~/lib/supabase/storage-upload'

type ConversationInfoSheetProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  chat: ChatSummary
  currentUserId: string
  isMuted: boolean
  blocked: boolean
  onToggleMute: () => void
  onToggleBlock: () => void
  onArchive: () => void
  onClear: () => void
  onLeaveGroup: () => void
  /** Called after membership/info changes so the parent can refresh the chat. */
  onChanged?: () => void
}

/** Contact/group info panel: profile, shared media, members, and quick actions. */
export function ConversationInfoSheet({
  open,
  onOpenChange,
  chat,
  currentUserId,
  isMuted,
  blocked,
  onToggleMute,
  onToggleBlock,
  onArchive,
  onClear,
  onLeaveGroup,
  onChanged,
}: ConversationInfoSheetProps) {
  const theme = useChatTheme()
  const toast = useAppToast()
  const isGroup = chat.type === 'group'

  const [mode, setMode] = useState<'info' | 'add'>('info')
  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState<ContactProfile | null>(null)
  const [participants, setParticipants] = useState<ConversationParticipant[]>([])
  const [media, setMedia] = useState<SharedMediaItem[]>([])
  const [mediaUrls, setMediaUrls] = useState<Record<string, string>>({})

  const [editingName, setEditingName] = useState(false)
  const [nameDraft, setNameDraft] = useState(chat.name)
  const [savingName, setSavingName] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)

  const myRole = chat.currentUserRole
  const canManage = isGroup && (myRole === 'owner' || myRole === 'admin')
  const isOwner = isGroup && myRole === 'owner'

  const loadParticipants = useCallback(async () => {
    if (!isGroup) return
    const map = await fetchConversationParticipants(chat.id)
    setParticipants(sortParticipants(map))
  }, [chat.id, isGroup])

  useEffect(() => {
    if (!open) return
    setMode('info')
    setEditingName(false)
    setNameDraft(chat.name)
    setLoading(true)
    let cancelled = false

    async function load() {
      const tasks: Promise<unknown>[] = [
        fetchSharedMedia(chat.id).then(async (items) => {
          if (cancelled) return
          setMedia(items)
          const urls: Record<string, string> = {}
          await Promise.all(
            items
              .filter((item) => item.type === 'image' && item.mediaUrl)
              .slice(0, 30)
              .map(async (item) => {
                const url = await getChatMediaUrl(item.mediaUrl as string)
                if (url) urls[item.id] = url
              }),
          )
          if (!cancelled) setMediaUrls(urls)
        }),
      ]
      if (isGroup) {
        tasks.push(loadParticipants())
      } else if (chat.otherUserId) {
        tasks.push(
          fetchContactProfile(chat.otherUserId).then((p) => {
            if (!cancelled) setProfile(p)
          }),
        )
      }
      await Promise.all(tasks)
      if (!cancelled) setLoading(false)
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [open, chat.id, chat.otherUserId, chat.name, isGroup, loadParticipants])

  async function handlePickAvatar() {
    if (uploadingAvatar) return
    try {
      const picked = await pickImages({ multiple: false, maxCount: 1 })
      const first = picked[0]
      if (!first) return
      setUploadingAvatar(true)
      const blob = await pickedImageToBlob(first)
      const { data, error } = await uploadGroupAvatarImage(currentUserId, {
        blob,
        mimeType: first.mimeType || blob.type || 'image/jpeg',
        fileName: first.fileName,
      })
      if (error || !data) {
        toast.show('Could not upload image', { tone: 'danger', message: error ?? undefined })
        return
      }
      const { error: updateError } = await updateGroupInfo(chat.id, { avatarUrl: data.publicUrl })
      if (updateError) {
        toast.show('Could not update group photo', { tone: 'danger', message: updateError })
        return
      }
      toast.show('Group photo updated')
      onChanged?.()
    } catch {
      toast.show('Could not update group photo', { tone: 'danger' })
    } finally {
      setUploadingAvatar(false)
    }
  }

  async function handleSaveName() {
    const next = nameDraft.trim()
    if (!next || next === chat.name) {
      setEditingName(false)
      return
    }
    setSavingName(true)
    const { error } = await updateGroupInfo(chat.id, { title: next })
    setSavingName(false)
    setEditingName(false)
    if (error) {
      toast.show('Could not rename group', { tone: 'danger', message: error })
      return
    }
    toast.show('Group renamed')
    onChanged?.()
  }

  async function handleRemoveMember(member: ConversationParticipant) {
    setParticipants((prev) => prev.filter((p) => p.userId !== member.userId))
    const { error } = await removeGroupParticipant(chat.id, member.userId)
    if (error) {
      toast.show('Could not remove member', { tone: 'danger', message: error })
      void loadParticipants()
      return
    }
    onChanged?.()
  }

  async function handleToggleAdmin(member: ConversationParticipant) {
    const nextRole = member.role === 'admin' ? 'member' : 'admin'
    setParticipants((prev) =>
      sortParticipants(
        Object.fromEntries(
          prev.map((p) => [p.userId, p.userId === member.userId ? { ...p, role: nextRole } : p]),
        ),
      ),
    )
    const { error } = await setGroupParticipantRole(chat.id, member.userId, nextRole)
    if (error) {
      toast.show('Could not change role', { tone: 'danger', message: error })
      void loadParticipants()
    }
  }

  async function handleAddMembers(ids: string[]) {
    const { error } = await addGroupParticipants(chat.id, ids)
    if (error) {
      toast.show('Could not add members', { tone: 'danger', message: error })
      return
    }
    toast.show(`Added ${ids.length} member${ids.length > 1 ? 's' : ''}`)
    setMode('info')
    await loadParticipants()
    onChanged?.()
  }

  async function openMedia(item: SharedMediaItem) {
    if (!item.mediaUrl) return
    const url = mediaUrls[item.id] ?? (await getChatMediaUrl(item.mediaUrl))
    if (url) void Linking.openURL(url)
  }

  const subtitle = isGroup
    ? `${participants.length} ${participants.length === 1 ? 'member' : 'members'}`
    : formatLastSeen(profile?.isOnline ?? chat.isOnline, profile?.lastSeen ?? chat.lastSeen)

  const title = mode === 'add' ? 'Add members' : isGroup ? 'Group info' : 'Contact info'

  return (
    <AppBottomSheet open={open} onOpenChange={onOpenChange} title={title} scrollable>
      {mode === 'add' ? (
        <AddMembersView
          currentUserId={currentUserId}
          existingIds={new Set(participants.map((p) => p.userId))}
          onCancel={() => setMode('info')}
          onConfirm={handleAddMembers}
        />
      ) : loading ? (
        <YStack paddingVertical={40} alignItems="center">
          <Spinner size="large" color={theme.brand} />
        </YStack>
      ) : (
        <YStack gap={16} paddingBottom={8}>
          {/* Header: avatar + name */}
          <YStack alignItems="center" gap={10} paddingTop={4}>
            <YStack
              onPress={canManage ? () => void handlePickAvatar() : undefined}
              cursor={canManage ? 'pointer' : 'default'}
              position="relative"
            >
              <Avatar size="$10" name={chat.name} src={chat.avatarUrl ?? undefined} />
              {canManage ? (
                <XStack
                  position="absolute"
                  bottom={0}
                  right={0}
                  width={30}
                  height={30}
                  borderRadius={999}
                  backgroundColor={theme.brand}
                  alignItems="center"
                  justifyContent="center"
                  borderWidth={2}
                  borderColor={theme.listBg}
                >
                  {uploadingAvatar ? (
                    <Spinner size="small" color={theme.brandContrast} />
                  ) : (
                    <Icons.Camera size={15} color={theme.brandContrast} />
                  )}
                </XStack>
              ) : null}
            </YStack>

            {editingName ? (
              <XStack gap={8} alignItems="center" width="100%" maxWidth={320}>
                <Input
                  flex={1}
                  value={nameDraft}
                  onChangeText={setNameDraft}
                  placeholder="Group name"
                  placeholderTextColor={theme.textMuted}
                  color={theme.text}
                  backgroundColor={theme.inputBg}
                  borderColor={theme.border}
                  autoFocus
                />
                <XStack
                  onPress={() => void handleSaveName()}
                  cursor="pointer"
                  width={38}
                  height={38}
                  borderRadius={999}
                  backgroundColor={theme.brand}
                  alignItems="center"
                  justifyContent="center"
                  pressStyle={{ scale: 0.92 }}
                >
                  {savingName ? (
                    <Spinner size="small" color={theme.brandContrast} />
                  ) : (
                    <Icons.Check size={18} color={theme.brandContrast} />
                  )}
                </XStack>
              </XStack>
            ) : (
              <XStack alignItems="center" gap={8}>
                <Text fontSize={21} fontWeight="800" color={theme.text} textAlign="center">
                  {chat.name}
                </Text>
                {canManage ? (
                  <XStack
                    onPress={() => {
                      setNameDraft(chat.name)
                      setEditingName(true)
                    }}
                    cursor="pointer"
                    padding={4}
                    pressStyle={{ scale: 0.9 }}
                  >
                    <Icons.Pencil size={16} color={theme.textMuted} />
                  </XStack>
                ) : null}
              </XStack>
            )}

            {!isGroup && (profile?.headline || profile?.username) ? (
              <Text fontSize={14} color={theme.textMuted} textAlign="center">
                {profile?.headline ?? `@${profile?.username}`}
              </Text>
            ) : null}
            {subtitle ? (
              <Text fontSize={13} color={theme.textMuted}>
                {subtitle}
              </Text>
            ) : null}
            {!isGroup && profile?.bio ? (
              <Text fontSize={13.5} color={theme.textSecondary} textAlign="center" lineHeight={19}>
                {profile.bio}
              </Text>
            ) : null}
          </YStack>

          {/* Quick actions */}
          <XStack gap={10} justifyContent="center" flexWrap="wrap">
            <QuickAction
              icon={isMuted ? <Icons.Bell size={20} /> : <Icons.BellOff size={20} />}
              label={isMuted ? 'Unmute' : 'Mute'}
              onPress={onToggleMute}
            />
            <QuickAction
              icon={<Icons.Archive size={20} />}
              label={chat.isArchived ? 'Unarchive' : 'Archive'}
              onPress={onArchive}
            />
            {!isGroup ? (
              <QuickAction
                icon={<Icons.Ban size={20} />}
                label={blocked ? 'Unblock' : 'Block'}
                danger
                onPress={onToggleBlock}
              />
            ) : null}
          </XStack>

          {/* Shared media */}
          {media.length > 0 ? (
            <YStack gap={8}>
              <Text fontSize={13} fontWeight="700" color={theme.textSecondary}>
                Shared media
              </Text>
              <XStack flexWrap="wrap" gap={6}>
                {media.slice(0, 12).map((item) => (
                  <YStack
                    key={item.id}
                    onPress={() => void openMedia(item)}
                    cursor="pointer"
                    width="31.5%"
                    aspectRatio={1}
                    borderRadius={8}
                    overflow="hidden"
                    backgroundColor={theme.inputBg}
                    alignItems="center"
                    justifyContent="center"
                    pressStyle={{ opacity: 0.85 }}
                  >
                    {item.type === 'image' && mediaUrls[item.id] ? (
                      <Image src={mediaUrls[item.id]} width="100%" height="100%" objectFit="cover" alt="" />
                    ) : (
                      <YStack alignItems="center" justifyContent="center" gap={4} padding={6}>
                        <Icons.FileText size={22} color={theme.textMuted} />
                        <Text fontSize={10} color={theme.textMuted} numberOfLines={1}>
                          {item.fileName ?? 'File'}
                        </Text>
                      </YStack>
                    )}
                  </YStack>
                ))}
              </XStack>
            </YStack>
          ) : null}

          {/* Group members */}
          {isGroup ? (
            <YStack gap={4}>
              <XStack alignItems="center" justifyContent="space-between">
                <Text fontSize={13} fontWeight="700" color={theme.textSecondary}>
                  {participants.length} members
                </Text>
                {canManage ? (
                  <XStack
                    onPress={() => setMode('add')}
                    cursor="pointer"
                    alignItems="center"
                    gap={5}
                    paddingVertical={4}
                    paddingHorizontal={8}
                    borderRadius={999}
                    hoverStyle={{ backgroundColor: theme.listItemHover }}
                    pressStyle={{ scale: 0.96 }}
                  >
                    <Icons.UserPlus size={16} color={theme.brand} />
                    <Text fontSize={13} fontWeight="700" color={theme.brand}>
                      Add
                    </Text>
                  </XStack>
                ) : null}
              </XStack>

              {participants.map((member) => {
                const isMe = member.userId === currentUserId
                const showRemove =
                  !isMe &&
                  member.role !== 'owner' &&
                  (isOwner || (myRole === 'admin' && member.role === 'member'))
                const showAdminToggle = isOwner && !isMe && member.role !== 'owner'
                return (
                  <XStack key={member.userId} alignItems="center" gap={12} paddingVertical={8}>
                    <Avatar size="$4" name={member.name} src={member.avatarUrl ?? undefined} />
                    <YStack flex={1} minWidth={0}>
                      <Text fontSize={15} fontWeight="600" color={theme.text} numberOfLines={1}>
                        {isMe ? 'You' : member.name}
                      </Text>
                      {member.headline || member.username ? (
                        <Text fontSize={12.5} color={theme.textMuted} numberOfLines={1}>
                          {member.headline ?? `@${member.username}`}
                        </Text>
                      ) : null}
                    </YStack>
                    {member.role !== 'member' ? (
                      <XStack
                        paddingHorizontal={8}
                        paddingVertical={3}
                        borderRadius={999}
                        backgroundColor={theme.reactionBg}
                      >
                        <Text fontSize={11} fontWeight="700" color={theme.brand}>
                          {member.role === 'owner' ? 'Owner' : 'Admin'}
                        </Text>
                      </XStack>
                    ) : null}
                    {showAdminToggle ? (
                      <XStack
                        onPress={() => void handleToggleAdmin(member)}
                        cursor="pointer"
                        width={34}
                        height={34}
                        borderRadius={999}
                        alignItems="center"
                        justifyContent="center"
                        hoverStyle={{ backgroundColor: theme.listItemHover }}
                        pressStyle={{ scale: 0.9 }}
                        aria-label={member.role === 'admin' ? 'Dismiss as admin' : 'Make admin'}
                      >
                        <Icons.Shield
                          size={17}
                          color={member.role === 'admin' ? theme.brand : theme.textMuted}
                        />
                      </XStack>
                    ) : null}
                    {showRemove ? (
                      <XStack
                        onPress={() => void handleRemoveMember(member)}
                        cursor="pointer"
                        width={34}
                        height={34}
                        borderRadius={999}
                        alignItems="center"
                        justifyContent="center"
                        hoverStyle={{ backgroundColor: theme.listItemHover }}
                        pressStyle={{ scale: 0.9 }}
                        aria-label="Remove member"
                      >
                        <Icons.UserMinus size={17} color={theme.dangerText} />
                      </XStack>
                    ) : null}
                  </XStack>
                )
              })}
            </YStack>
          ) : null}

          {/* Destructive actions */}
          <YStack gap={2} paddingTop={4} borderTopWidth={1} borderTopColor={theme.divider}>
            <ActionRow
              icon={<Icons.Eraser size={20} color={theme.dangerText} />}
              label="Clear chat"
              danger
              onPress={onClear}
            />
            {isGroup ? (
              <ActionRow
                icon={<Icons.LogOut size={20} color={theme.dangerText} />}
                label="Exit group"
                danger
                onPress={onLeaveGroup}
              />
            ) : null}
          </YStack>
        </YStack>
      )}
    </AppBottomSheet>
  )
}

function QuickAction({
  icon,
  label,
  danger,
  onPress,
}: {
  icon: React.ReactNode
  label: string
  danger?: boolean
  onPress: () => void
}) {
  const theme = useChatTheme()
  const color = danger ? theme.dangerText : theme.brand
  return (
    <YStack
      onPress={onPress}
      cursor="pointer"
      alignItems="center"
      gap={5}
      paddingVertical={10}
      paddingHorizontal={16}
      borderRadius={12}
      minWidth={82}
      backgroundColor={theme.inputBg}
      borderWidth={1}
      borderColor={theme.border}
      hoverStyle={{ backgroundColor: theme.listItemHover }}
      pressStyle={{ scale: 0.96 }}
      animation="quick"
    >
      <YStack>{withColor(icon, color)}</YStack>
      <Text fontSize={12.5} fontWeight="600" color={danger ? theme.dangerText : theme.text}>
        {label}
      </Text>
    </YStack>
  )
}

/** Clone an icon element with the resolved color. */
function withColor(icon: React.ReactNode, color: string): React.ReactNode {
  if (isValidElement(icon)) {
    return cloneElement(icon as React.ReactElement<{ color?: string }>, { color })
  }
  return icon
}

function ActionRow({
  icon,
  label,
  danger,
  onPress,
}: {
  icon: React.ReactNode
  label: string
  danger?: boolean
  onPress: () => void
}) {
  const theme = useChatTheme()
  return (
    <XStack
      onPress={onPress}
      cursor="pointer"
      alignItems="center"
      gap={14}
      paddingVertical={12}
      paddingHorizontal={6}
      borderRadius={10}
      hoverStyle={{ backgroundColor: theme.listItemHover }}
      pressStyle={{ backgroundColor: theme.listItemActive }}
      animation="quick"
    >
      {icon}
      <Text fontSize={15.5} fontWeight="600" color={danger ? theme.dangerText : theme.text}>
        {label}
      </Text>
    </XStack>
  )
}

function AddMembersView({
  currentUserId,
  existingIds,
  onCancel,
  onConfirm,
}: {
  currentUserId: string
  existingIds: Set<string>
  onCancel: () => void
  onConfirm: (ids: string[]) => void | Promise<void>
}) {
  const theme = useChatTheme()
  const [search, setSearch] = useState('')
  const [candidates, setCandidates] = useState<ChatCandidate[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<string[]>([])
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    const handle = setTimeout(() => {
      fetchChatCandidates(currentUserId, search).then((result) => {
        if (cancelled) return
        setCandidates(result.items.filter((c) => !existingIds.has(c.id)))
        setLoading(false)
      })
    }, 220)
    return () => {
      cancelled = true
      clearTimeout(handle)
    }
  }, [search, currentUserId, existingIds])

  function toggle(id: string) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  async function confirm() {
    if (selected.length === 0 || busy) return
    setBusy(true)
    await onConfirm(selected)
    setBusy(false)
  }

  return (
    <YStack gap={12} paddingBottom={8}>
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
          color={theme.text}
        />
      </XStack>

      {loading ? (
        <YStack paddingVertical={24} alignItems="center">
          <Spinner color={theme.brand} />
        </YStack>
      ) : candidates.length === 0 ? (
        <YStack paddingVertical={24} alignItems="center" gap={6}>
          <Icons.UserX size={26} color={theme.textMuted} />
          <Text fontSize={14} color={theme.textMuted}>
            No people found
          </Text>
        </YStack>
      ) : (
        <YStack maxHeight={340}>
          {candidates.map((candidate) => {
            const isSelected = selected.includes(candidate.id)
            return (
              <XStack
                key={candidate.id}
                onPress={() => toggle(candidate.id)}
                cursor="pointer"
                alignItems="center"
                gap={12}
                paddingVertical={9}
                paddingHorizontal={4}
                hoverStyle={{ backgroundColor: theme.listItemHover }}
                pressStyle={{ opacity: 0.8 }}
              >
                <Avatar size="$4" name={candidate.fullName} src={candidate.avatarUrl ?? undefined} />
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
                  {isSelected ? <Icons.Check size={14} color={theme.brandContrast} /> : null}
                </YStack>
              </XStack>
            )
          })}
        </YStack>
      )}

      <XStack gap={10}>
        <XStack
          flex={1}
          onPress={onCancel}
          cursor="pointer"
          alignItems="center"
          justifyContent="center"
          height={46}
          borderRadius={999}
          borderWidth={1}
          borderColor={theme.border}
          pressStyle={{ scale: 0.98 }}
        >
          <Text fontSize={15} fontWeight="700" color={theme.text}>
            Cancel
          </Text>
        </XStack>
        <XStack
          flex={1}
          onPress={selected.length > 0 ? () => void confirm() : undefined}
          cursor={selected.length > 0 ? 'pointer' : 'default'}
          alignItems="center"
          justifyContent="center"
          height={46}
          borderRadius={999}
          backgroundColor={selected.length > 0 ? theme.brand : theme.border}
          pressStyle={selected.length > 0 ? { scale: 0.98 } : undefined}
        >
          {busy ? (
            <Spinner size="small" color={theme.brandContrast} />
          ) : (
            <Text
              fontSize={15}
              fontWeight="700"
              color={selected.length > 0 ? theme.brandContrast : theme.textMuted}
            >
              {selected.length > 0 ? `Add ${selected.length}` : 'Add'}
            </Text>
          )}
        </XStack>
      </XStack>
    </YStack>
  )
}
