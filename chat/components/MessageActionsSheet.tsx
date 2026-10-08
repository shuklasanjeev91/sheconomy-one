import { AppBottomSheet, Icons, Text, XStack, YStack } from '~/components/ui'
import { copyToClipboard } from '~/lib/platform/clipboard'

import { QUICK_REACTIONS } from '~/chat/lib/emoji'
import type { ChatMessage } from '~/chat/lib/types'
import { useChatTheme } from '~/chat/lib/chat-theme'
import { ReactionStickerImage } from '~/components/emoji/ReactionStickerImage'
import { REACTION_STICKERS } from '~/lib/emoji/reaction-stickers'

type MessageActionsSheetProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  message: ChatMessage | null
  isOwn: boolean
  isStarred?: boolean
  onReply: (message: ChatMessage) => void
  onForward: (message: ChatMessage) => void
  onStar: (message: ChatMessage) => void
  onSelect: (message: ChatMessage) => void
  onEdit: (message: ChatMessage) => void
  onDelete: (message: ChatMessage) => void
  onReact: (messageId: string, emoji: string) => void
}

type ActionRowProps = {
  icon: React.ReactNode
  label: string
  danger?: boolean
  onPress: () => void
}

function ActionRow({ icon, label, danger, onPress }: ActionRowProps) {
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

export function MessageActionsSheet({
  open,
  onOpenChange,
  message,
  isOwn,
  isStarred,
  onReply,
  onForward,
  onStar,
  onSelect,
  onEdit,
  onDelete,
  onReact,
}: MessageActionsSheetProps) {
  const theme = useChatTheme()

  if (!message) return null

  const isDeleted = !!message.deletedAt
  const isCall = message.type === 'call'
  const hasText = message.content.trim().length > 0
  const canEdit = isOwn && message.type === 'text' && !isDeleted
  const canDelete = isOwn && !isDeleted
  const canForward = !isDeleted && !isCall
  const canStar = !isDeleted && !isCall

  function close() {
    onOpenChange(false)
  }

  return (
    <AppBottomSheet open={open} onOpenChange={onOpenChange} scrollable={false}>
      {!isDeleted ? (
        <YStack
          alignSelf="center"
          alignItems="center"
          justifyContent="center"
          gap={8}
          paddingVertical={8}
          paddingHorizontal={10}
          marginBottom={6}
          borderRadius={18}
          backgroundColor={theme.listItemHover}
        >
          <XStack alignItems="center" justifyContent="center" gap={6}>
            {QUICK_REACTIONS.map((emoji) => (
              <XStack
                key={emoji}
                onPress={() => {
                  if (message) onReact(message.id, emoji)
                  close()
                }}
                cursor="pointer"
                width={44}
                height={44}
                borderRadius={999}
                alignItems="center"
                justifyContent="center"
                hoverStyle={{ backgroundColor: theme.listItemActive, scale: 1.08 }}
                pressStyle={{ scale: 0.9 }}
                animation="quick"
              >
                <Text fontSize={26}>{emoji}</Text>
              </XStack>
            ))}
          </XStack>
          <XStack alignItems="center" justifyContent="center" gap={6} flexWrap="wrap" maxWidth={330}>
            {REACTION_STICKERS.slice(0, 12).map((sticker) => (
              <XStack
                key={sticker.value}
                onPress={() => {
                  if (message) onReact(message.id, sticker.value)
                  close()
                }}
                cursor="pointer"
                width={42}
                height={42}
                borderRadius={12}
                alignItems="center"
                justifyContent="center"
                hoverStyle={{ backgroundColor: theme.listItemActive, scale: 1.06 }}
                pressStyle={{ scale: 0.9 }}
                animation="quick"
                accessibilityLabel={sticker.label}
              >
                <ReactionStickerImage value={sticker.value} sticker={sticker} size={34} />
              </XStack>
            ))}
          </XStack>
        </YStack>
      ) : null}

      <YStack>
        {!isDeleted ? (
          <ActionRow
            icon={<Icons.Reply size={20} color={theme.textSecondary} />}
            label="Reply"
            onPress={() => {
              if (message) onReply(message)
              close()
            }}
          />
        ) : null}

        {canStar ? (
          <ActionRow
            icon={
              isStarred ? (
                <Icons.StarOff size={20} color={theme.textSecondary} />
              ) : (
                <Icons.Star size={20} color={theme.textSecondary} />
              )
            }
            label={isStarred ? 'Unstar' : 'Star'}
            onPress={() => {
              if (message) onStar(message)
              close()
            }}
          />
        ) : null}

        {canForward ? (
          <ActionRow
            icon={<Icons.Forward size={20} color={theme.textSecondary} />}
            label="Forward"
            onPress={() => {
              if (message) onForward(message)
              close()
            }}
          />
        ) : null}

        <ActionRow
          icon={<Icons.CheckCircle size={20} color={theme.textSecondary} />}
          label="Select"
          onPress={() => {
            if (message) onSelect(message)
            close()
          }}
        />

        {hasText && !isDeleted ? (
          <ActionRow
            icon={<Icons.Copy size={20} color={theme.textSecondary} />}
            label="Copy"
            onPress={() => {
              void copyToClipboard(message?.content ?? '')
              close()
            }}
          />
        ) : null}

        {canEdit ? (
          <ActionRow
            icon={<Icons.Pencil size={20} color={theme.textSecondary} />}
            label="Edit"
            onPress={() => {
              if (message) onEdit(message)
              close()
            }}
          />
        ) : null}

        {canDelete ? (
          <ActionRow
            icon={<Icons.Trash2 size={20} color={theme.dangerText} />}
            label="Delete for everyone"
            danger
            onPress={() => {
              if (message) onDelete(message)
              close()
            }}
          />
        ) : null}
      </YStack>
    </AppBottomSheet>
  )
}
