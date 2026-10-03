import { createElement, useEffect, useMemo, useState, type ReactNode } from 'react'
import { Image, Linking, Platform, StyleSheet, View } from 'react-native'
import { useVideoPlayer, VideoView } from 'expo-video'

import { RnPressable as Pressable } from '~/co-work/components/RnPressable'
import { ContentFrame, contentPlatform } from '~/co-work/components/MeetingContentShareStage'
import { Icons, Text, XStack, YStack } from '~/components/ui'
import {
  formatMeetingChatAttachmentSize,
  meetingChatAttachmentKindLabel,
} from '~/co-work/lib/meeting-chat-attachments'
import { meetingContentExtension, meetingContentViewer } from '~/co-work/lib/meeting-content-share'
import { useCoWorkTheme } from '~/co-work/lib/theme'
import type { MeetingChatAttachment } from '~/co-work/lib/types'

const THUMB_WIDTH = 230
const THUMB_HEIGHT = 170
const VIDEO_HEIGHT = 140

function openExternally(url: string | null) {
  if (url) void Linking.openURL(url).catch(() => {})
}

/** Zoom-style file badge colour by document type. */
function documentBadge(attachment: MeetingChatAttachment): { label: string; color: string } {
  const ext = meetingContentExtension(attachment.fileName)
  const label = (ext || meetingChatAttachmentKindLabel(attachment.kind)).toUpperCase().slice(0, 4)
  if (attachment.kind === 'pdf' || ext === 'pdf') return { label, color: '#E5484D' }
  if (['doc', 'docx', 'rtf', 'odt', 'pages'].includes(ext)) return { label, color: '#2B6CE6' }
  if (['xls', 'xlsx', 'csv', 'ods', 'numbers'].includes(ext)) return { label, color: '#1E9E5A' }
  if (['ppt', 'pptx', 'odp', 'key'].includes(ext)) return { label, color: '#E8702A' }
  if (attachment.kind === 'audio') return { label, color: '#8E4EC6' }
  return { label, color: '#6B7280' }
}

/** Files the in-chat viewer can show (everything except inline-played media). */
export function canPreviewMeetingChatAttachment(attachment: MeetingChatAttachment): boolean {
  return !!attachment.url && attachment.kind !== 'video' && attachment.kind !== 'audio'
}

export function MeetingChatAttachmentView({
  attachment,
  onPreview,
}: {
  attachment: MeetingChatAttachment
  /** Opens the in-chat viewer for photos and documents. */
  onPreview?: (attachment: MeetingChatAttachment) => void
}) {
  const [imageFailed, setImageFailed] = useState(false)
  const url = attachment.url
  const preview = () => {
    if (!url) return
    if (onPreview && canPreviewMeetingChatAttachment(attachment)) onPreview(attachment)
    else openExternally(url)
  }

  if (attachment.kind === 'image' && url && !imageFailed) {
    return (
      <Pressable
        accessibilityRole="imagebutton"
        accessibilityLabel={`View photo ${attachment.fileName}`}
        onPress={preview}
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
            backgroundColor: '#1B1B1F',
          }}
        />
      </Pressable>
    )
  }

  if ((attachment.kind === 'video' || attachment.kind === 'audio') && url) {
    return <InlineMedia attachment={attachment} url={url} />
  }

  return <DocumentCard attachment={attachment} onPress={preview} />
}

function DocumentCard({ attachment, onPress }: { attachment: MeetingChatAttachment; onPress: () => void }) {
  const { ui } = useCoWorkTheme()
  const url = attachment.url
  const badge = documentBadge(attachment)
  const size = formatMeetingChatAttachmentSize(attachment.size)
  const detail = url
    ? [meetingChatAttachmentKindLabel(attachment.kind), size].filter(Boolean).join(' · ')
    : 'File unavailable'

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Preview ${attachment.fileName}`}
      disabled={!url}
      onPress={onPress}
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
        width={THUMB_WIDTH}
        maxWidth="100%"
      >
        <YStack
          width={40}
          height={48}
          borderRadius={8}
          alignItems="center"
          justifyContent="flex-end"
          paddingBottom={6}
          backgroundColor={badge.color}
        >
          <Icons.FileText size={16} color="#FFFFFF" />
          <Text fontSize={9} fontWeight="900" color="#FFFFFF" marginTop={2}>
            {badge.label}
          </Text>
        </YStack>
        <YStack flex={1} minWidth={0} gap={2}>
          <Text fontSize={13} fontWeight="700" color={ui.text} numberOfLines={2}>
            {attachment.fileName}
          </Text>
          <Text fontSize={11} color={ui.textMuted} numberOfLines={1}>
            {detail}
          </Text>
        </YStack>
        {url ? <Icons.ChevronRight size={16} color={ui.textMuted} /> : null}
      </XStack>
    </Pressable>
  )
}

function MediaCaption({ attachment }: { attachment: MeetingChatAttachment }) {
  const { ui } = useCoWorkTheme()
  const size = formatMeetingChatAttachmentSize(attachment.size)
  return (
    <XStack alignItems="center" gap="$1.5" paddingHorizontal={2} width={THUMB_WIDTH} maxWidth="100%">
      {attachment.kind === 'audio' ? (
        <Icons.Volume2 size={12} color={ui.textMuted} />
      ) : (
        <Icons.Film size={12} color={ui.textMuted} />
      )}
      <Text fontSize={11} color={ui.textMuted} numberOfLines={1} flex={1}>
        {[attachment.fileName, size].filter(Boolean).join(' · ')}
      </Text>
    </XStack>
  )
}

/** Plays inside the bubble, like Zoom chat; native players mount only after a tap. */
function InlineMedia({ attachment, url }: { attachment: MeetingChatAttachment; url: string }) {
  const audio = attachment.kind === 'audio'
  const [started, setStarted] = useState(false)

  if (Platform.OS === 'web') {
    return (
      <YStack gap={4}>
        {createElement(audio ? 'audio' : 'video', {
          src: url,
          controls: true,
          playsInline: true,
          preload: 'metadata',
          style: audio
            ? { width: THUMB_WIDTH, maxWidth: '100%' }
            : {
                width: THUMB_WIDTH,
                maxWidth: '100%',
                height: VIDEO_HEIGHT,
                borderRadius: 12,
                backgroundColor: '#000',
                objectFit: 'contain',
              },
        })}
        <MediaCaption attachment={attachment} />
      </YStack>
    )
  }

  return (
    <YStack gap={4}>
      {started ? (
        <NativeInlinePlayer url={url} height={audio ? 64 : VIDEO_HEIGHT} />
      ) : (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Play ${attachment.fileName}`}
          onPress={() => setStarted(true)}
          style={{
            width: THUMB_WIDTH,
            maxWidth: '100%',
            height: audio ? 64 : VIDEO_HEIGHT,
            borderRadius: 12,
            backgroundColor: '#111114',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <YStack
            width={audio ? 40 : 52}
            height={audio ? 40 : 52}
            borderRadius={999}
            alignItems="center"
            justifyContent="center"
            backgroundColor="rgba(255,255,255,0.18)"
            borderWidth={1}
            borderColor="rgba(255,255,255,0.35)"
          >
            <Icons.Play size={audio ? 18 : 24} color="#FFFFFF" />
          </YStack>
        </Pressable>
      )}
      <MediaCaption attachment={attachment} />
    </YStack>
  )
}

function NativeInlinePlayer({ url, height }: { url: string; height: number }) {
  const player = useVideoPlayer(url, (instance) => {
    instance.loop = false
    instance.play()
  })
  return (
    <View style={{ width: THUMB_WIDTH, maxWidth: '100%', height, borderRadius: 12, overflow: 'hidden', backgroundColor: '#000' }}>
      <VideoView
        player={player}
        style={StyleSheet.absoluteFill}
        nativeControls
        contentFit="contain"
        allowsPictureInPicture={false}
      />
    </View>
  )
}

/** In-chat preview for photos and documents, covering the chat panel. */
export function MeetingChatAttachmentViewer({
  attachment,
  onClose,
}: {
  attachment: MeetingChatAttachment
  onClose: () => void
}) {
  const { ui } = useCoWorkTheme()
  const platform = useMemo(contentPlatform, [])
  const url = attachment.url
  const viewer = url
    ? meetingContentViewer(
        { url, fileName: attachment.fileName, mimeType: attachment.mimeType, kind: attachment.kind },
        platform,
      )
    : null

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <YStack
      position="absolute"
      top={0}
      left={0}
      right={0}
      bottom={0}
      zIndex={40}
      backgroundColor={viewer?.mode === 'frame' ? '#FFFFFF' : '#000000'}
    >
      <XStack
        alignItems="center"
        gap="$2"
        paddingHorizontal="$3"
        paddingVertical="$2"
        backgroundColor={ui.surface}
        borderBottomWidth={1}
        borderBottomColor={ui.borderSoft}
      >
        <ViewerButton label="Close preview" onPress={onClose}>
          <Icons.X size={18} color={ui.text} />
        </ViewerButton>
        <YStack flex={1} minWidth={0}>
          <Text fontSize={14} fontWeight="800" color={ui.text} numberOfLines={1}>
            {attachment.fileName}
          </Text>
          <Text fontSize={11} color={ui.textMuted} numberOfLines={1}>
            {[meetingChatAttachmentKindLabel(attachment.kind), formatMeetingChatAttachmentSize(attachment.size)]
              .filter(Boolean)
              .join(' · ')}
          </Text>
        </YStack>
        <ViewerButton label="Open or download" onPress={() => openExternally(url)}>
          {attachment.kind === 'image' ? (
            <Icons.Download size={18} color={ui.text} />
          ) : (
            <Icons.ExternalLink size={18} color={ui.text} />
          )}
        </ViewerButton>
      </XStack>
      <YStack flex={1} minHeight={0}>
        {!viewer ? (
          <YStack flex={1} alignItems="center" justifyContent="center" padding="$4">
            <Text color={ui.textMuted} textAlign="center">
              This file is no longer available.
            </Text>
          </YStack>
        ) : viewer.mode === 'image' ? (
          <Image source={{ uri: viewer.url }} style={StyleSheet.absoluteFill} resizeMode="contain" />
        ) : (
          <ContentFrame url={viewer.url} title={attachment.fileName} />
        )}
      </YStack>
    </YStack>
  )
}

function ViewerButton({
  label,
  onPress,
  children,
}: {
  label: string
  onPress: () => void
  children: ReactNode
}) {
  const { ui } = useCoWorkTheme()
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={6}
      style={({ pressed }) => ({
        width: 36,
        height: 36,
        borderRadius: 999,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: pressed ? ui.surfaceMuted : 'transparent',
      })}
    >
      {children}
    </Pressable>
  )
}
