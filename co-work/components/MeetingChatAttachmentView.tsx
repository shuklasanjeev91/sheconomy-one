import { useState } from 'react'
import { Image, Linking } from 'react-native'

import { RnPressable as Pressable } from '~/co-work/components/RnPressable'
import { Icons, Text, XStack, YStack } from '~/components/ui'
import {
  formatMeetingChatAttachmentSize,
  meetingChatAttachmentKindLabel,
} from '~/co-work/lib/meeting-chat-attachments'
import { useCoWorkTheme } from '~/co-work/lib/theme'
import type { MeetingChatAttachment } from '~/co-work/lib/types'

const THUMB_WIDTH = 220
const THUMB_HEIGHT = 160

function iconFor(kind: MeetingChatAttachment['kind']) {
  if (kind === 'image') return Icons.Image
  if (kind === 'video') return Icons.Film
  if (kind === 'pdf' || kind === 'office' || kind === 'text') return Icons.FileText
  return Icons.Paperclip
}

export function MeetingChatAttachmentView({ attachment }: { attachment: MeetingChatAttachment }) {
  const { ui } = useCoWorkTheme()
  const [imageFailed, setImageFailed] = useState(false)
  const url = attachment.url
  const open = () => {
    if (url) void Linking.openURL(url).catch(() => {})
  }

  if (attachment.kind === 'image' && url && !imageFailed) {
    return (
      <Pressable
        accessibilityRole="imagebutton"
        accessibilityLabel={`Open photo ${attachment.fileName}`}
        onPress={open}
      >
        <Image
          source={{ uri: url }}
          onError={() => setImageFailed(true)}
          resizeMode="cover"
          style={{
            width: THUMB_WIDTH,
            maxWidth: '100%',
            height: THUMB_HEIGHT,
            borderRadius: 12,
            backgroundColor: ui.surfaceMuted,
          }}
        />
      </Pressable>
    )
  }

  const Icon = iconFor(attachment.kind)
  const size = formatMeetingChatAttachmentSize(attachment.size)
  const detail = url
    ? [meetingChatAttachmentKindLabel(attachment.kind), size].filter(Boolean).join(' · ')
    : 'File unavailable'

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open ${attachment.fileName}`}
      disabled={!url}
      onPress={open}
    >
      <XStack
        alignItems="center"
        gap="$2.5"
        padding="$2.5"
        borderRadius={12}
        backgroundColor={ui.surfaceMuted}
        borderWidth={1}
        borderColor={ui.borderSoft}
        opacity={url ? 1 : 0.6}
        minWidth={200}
      >
        <YStack
          width={36}
          height={36}
          borderRadius={10}
          alignItems="center"
          justifyContent="center"
          backgroundColor={ui.meetingControl}
        >
          <Icon size={18} color={ui.brandLight} />
        </YStack>
        <YStack flex={1} gap={2}>
          <Text fontSize={13} fontWeight="700" color={ui.text} numberOfLines={2}>
            {attachment.fileName}
          </Text>
          <Text fontSize={11} color={ui.textMuted}>
            {detail}
          </Text>
        </YStack>
        {url ? <Icons.ExternalLink size={14} color={ui.textMuted} /> : null}
      </XStack>
    </Pressable>
  )
}
