import { useEffect, useRef, useState } from 'react'
import type { TextInput } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { useChatTheme } from '~/chat/lib/chat-theme'
import { mediaPreviewLabel } from '~/chat/lib/emoji'
import {
  clearMessageDraft,
  loadMessageDraft,
  saveMessageDraft,
} from '~/chat/lib/message-drafts'
import { localChatQuickReplies } from '~/chat/lib/quick-replies'
import { fetchChatSuggestions } from '~/lib/ai'
import type { ChatComposerAttachment, ChatMessage } from '~/chat/lib/types'
import { HorizontalScrollRow } from '~/components/layout'
import { MediaDropZone } from '~/components/media/MediaDropZone'
import { UploadProgressBar } from '~/components/media/UploadProgressBar'
import { Icons, Input, Spinner, Text, XStack, YStack, useAppToast } from '~/components/ui'
import { WritingSuggestionBar } from '~/components/writing/WritingSuggestionBar'
import {
  cancelRecording,
  isRecordingSupported,
  startRecording,
  stopRecording,
} from '~/lib/media/audio-recorder'
import { useKeyboardVisible } from '~/hooks/useKeyboardVisible'
import { captureImage, pickDocument, pickImages, pickMedia, pickVideos } from '~/lib/media/pick-image'
import { sendPickedItemAsChatAttachment } from '~/lib/media/route-chat-attachment'

import { AttachmentSheet } from '~/chat/components/AttachmentSheet'
import { EmojiPickerSheet } from '~/chat/components/EmojiPickerSheet'
import { isReactionStickerValue } from '~/lib/emoji/reaction-stickers'

type MessageComposerProps = {
  conversationId?: string | null
  onSend: (text: string) => void
  onSendImage: (attachment: ChatComposerAttachment) => void
  onSendFile: (attachment: ChatComposerAttachment) => void
  onSendAudio: (attachment: ChatComposerAttachment) => void
  onCreatePoll?: () => void
  onCreateEvent?: () => void
  onCreateListing?: () => void
  onTyping: (text: string) => void
  sending?: boolean
  uploadProgress?: number | null
  replyTo?: ChatMessage | null
  replySenderName?: string | null
  peerName?: string | null
  latestMessage?: string | null
  onCancelReply?: () => void
  editing?: ChatMessage | null
  onEditSubmit?: (messageId: string, text: string) => void
  onCancelEdit?: () => void
}

function IconButton({
  children,
  onPress,
  label,
  size = 40,
}: {
  children: React.ReactNode
  onPress: () => void
  label: string
  size?: number
}) {
  const theme = useChatTheme()
  return (
    <XStack
      onPress={onPress}
      cursor="pointer"
      width={size}
      height={size}
      borderRadius={999}
      alignItems="center"
      justifyContent="center"
      hoverStyle={{ backgroundColor: theme.listItemHover }}
      pressStyle={{ scale: 0.9 }}
      animation="quick"
      aria-label={label}
    >
      {children}
    </XStack>
  )
}

export function MessageComposer({
  conversationId,
  onSend,
  onSendImage,
  onSendFile,
  onSendAudio,
  onCreatePoll,
  onCreateEvent,
  onCreateListing,
  onTyping,
  sending,
  uploadProgress,
  replyTo,
  replySenderName,
  peerName,
  latestMessage,
  onCancelReply,
  editing,
  onEditSubmit,
  onCancelEdit,
}: MessageComposerProps) {
  const theme = useChatTheme()
  const toast = useAppToast()
  const insets = useSafeAreaInsets()
  const keyboardVisible = useKeyboardVisible()
  const [text, setText] = useState('')
  const [draftReady, setDraftReady] = useState(!conversationId)
  const [attaching, setAttaching] = useState(false)
  const [attachOpen, setAttachOpen] = useState(false)
  const [emojiOpen, setEmojiOpen] = useState(false)
  const [recording, setRecording] = useState(false)
  const [recordSeconds, setRecordSeconds] = useState(0)
  const recordTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const draftTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [suggestions, setSuggestions] = useState<string[]>([])
  const inputRef = useRef<TextInput>(null)

  const isEditing = !!editing
  const canSend = text.trim().length > 0
  const canRecord = !isEditing && isRecordingSupported()

  useEffect(() => {
    return () => {
      if (recordTimerRef.current) clearInterval(recordTimerRef.current)
      if (draftTimerRef.current) clearTimeout(draftTimerRef.current)
    }
  }, [])

  useEffect(() => {
    let active = true
    setDraftReady(!conversationId)
    if (!conversationId) {
      setText('')
      return
    }
    void loadMessageDraft(conversationId).then((draft) => {
      if (!active) return
      setText(draft)
      setDraftReady(true)
    })
    return () => {
      active = false
    }
  }, [conversationId])

  useEffect(() => {
    if (!conversationId || !draftReady || isEditing) return
    if (draftTimerRef.current) clearTimeout(draftTimerRef.current)
    draftTimerRef.current = setTimeout(() => {
      void saveMessageDraft(conversationId, text)
    }, 350)
    return () => {
      if (draftTimerRef.current) clearTimeout(draftTimerRef.current)
    }
  }, [conversationId, draftReady, isEditing, text])

  function stopRecordTimer() {
    if (recordTimerRef.current) {
      clearInterval(recordTimerRef.current)
      recordTimerRef.current = null
    }
  }

  async function startVoice() {
    try {
      await startRecording()
      setRecording(true)
      setRecordSeconds(0)
      stopRecordTimer()
      recordTimerRef.current = setInterval(() => setRecordSeconds((s) => s + 1), 1000)
    } catch (error) {
      toast.show('Could not start recording', {
        message: error instanceof Error ? error.message : undefined,
        tone: 'danger',
      })
    }
  }

  async function stopVoiceAndSend() {
    stopRecordTimer()
    setRecording(false)
    try {
      const audio = await stopRecording()
      if (audio && audio.durationMs > 700) {
        onSendAudio({
          uri: audio.uri,
          mimeType: audio.mimeType,
          fileName: audio.fileName,
          fileSize: audio.blob?.size,
        })
      }
    } catch (error) {
      toast.show('Could not save recording', {
        message: error instanceof Error ? error.message : undefined,
        tone: 'danger',
      })
    } finally {
      setRecordSeconds(0)
    }
  }

  async function discardVoice() {
    stopRecordTimer()
    setRecording(false)
    setRecordSeconds(0)
    try {
      await cancelRecording()
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    if (editing) {
      setText(editing.content)
      inputRef.current?.focus()
    }
  }, [editing])

  function handleChange(value: string) {
    setText(value)
    if (!isEditing) onTyping(value)
  }

  function submit() {
    if (!canSend) return
    if (isEditing && editing) {
      onEditSubmit?.(editing.id, text)
    } else {
      onSend(text)
      onTyping('')
      if (conversationId) void clearMessageDraft(conversationId)
    }
    setText('')
  }

  function cancelContext() {
    if (isEditing) {
      onCancelEdit?.()
      if (conversationId) {
        void loadMessageDraft(conversationId).then(setText)
      } else {
        setText('')
      }
    } else {
      onCancelReply?.()
    }
  }

  async function attachFromGallery() {
    if (attaching) return
    setAttaching(true)
    try {
      const picked = await pickImages({ multiple: false })
      const first = picked[0]
      if (first) {
        onSendImage({ uri: first.uri, mimeType: first.mimeType, fileName: first.fileName })
      }
    } catch (error) {
      toast.show('Could not open the gallery', {
        message: error instanceof Error ? error.message : undefined,
        tone: 'danger',
      })
    } finally {
      setAttaching(false)
    }
  }

  async function attachFromCamera() {
    if (attaching) return
    setAttaching(true)
    try {
      const shot = await captureImage()
      if (shot) {
        onSendImage({ uri: shot.uri, mimeType: shot.mimeType, fileName: shot.fileName })
      }
    } catch (error) {
      toast.show('Could not open the camera', {
        message: error instanceof Error ? error.message : undefined,
        tone: 'danger',
      })
    } finally {
      setAttaching(false)
    }
  }

  async function attachVideo() {
    if (attaching) return
    setAttaching(true)
    try {
      const picked = await pickVideos({ multiple: false, maxCount: 1 })
      const first = picked[0]
      if (first) {
        onSendFile({
          uri: first.uri,
          mimeType: first.mimeType || 'video/mp4',
          fileName: first.fileName ?? 'video.mp4',
        })
      }
    } catch (error) {
      toast.show('Could not open videos', {
        message: error instanceof Error ? error.message : undefined,
        tone: 'danger',
      })
    } finally {
      setAttaching(false)
    }
  }

  async function attachFromBrowse() {
    if (attaching) return
    setAttaching(true)
    try {
      const picked = await pickMedia({ accept: 'any', multiple: false, maxCount: 1 })
      const first = picked[0]
      if (first) {
        sendPickedItemAsChatAttachment(first, { onSendImage, onSendFile })
      }
    } catch (error) {
      toast.show('Could not open files', {
        message: error instanceof Error ? error.message : undefined,
        tone: 'danger',
      })
    } finally {
      setAttaching(false)
    }
  }

  async function attachDocument() {
    if (attaching) return
    setAttaching(true)
    try {
      const doc = await pickDocument()
      if (doc) {
        onSendFile({
          uri: doc.uri,
          mimeType: doc.mimeType,
          fileName: doc.fileName,
          fileSize: doc.fileSize,
        })
      }
    } catch (error) {
      toast.show('Could not open documents', {
        message: error instanceof Error ? error.message : undefined,
        tone: 'danger',
      })
    } finally {
      setAttaching(false)
    }
  }

  const contextBar = isEditing
    ? { name: 'Editing message', text: editing?.content ?? '', icon: 'edit' as const }
    : replyTo
      ? {
          name: replySenderName ?? 'Reply',
          text: replyTo.content.trim().length > 0 ? replyTo.content : mediaPreviewLabel(replyTo.type),
          icon: 'reply' as const,
        }
      : null

  const showQuickReplies = !isEditing && !recording && text.trim().length === 0
  const suggestionSource = (replyTo?.content || latestMessage || '').trim()
  const suggestionName = (replyTo ? replySenderName : peerName) || ''

  const localReplies = showQuickReplies
    ? localChatQuickReplies({ isReply: Boolean(replyTo), peerName: suggestionName })
    : []

  useEffect(() => {
    if (!showQuickReplies) {
      setSuggestions([])
      return
    }
    let cancelled = false
    setSuggestions([])
    void fetchChatSuggestions({
      peerName: suggestionName,
      latestMessage: suggestionSource,
    })
      .then((rows) => {
        if (!cancelled && rows.length) setSuggestions(rows.slice(0, 3))
      })
      .catch(() => {
        if (!cancelled) setSuggestions([])
      })
    return () => {
      cancelled = true
    }
  }, [showQuickReplies, suggestionName, suggestionSource])

  const quickReplies = suggestions.length ? suggestions : localReplies

  return (
    <MediaDropZone
      disabled={attaching || sending || recording || isEditing}
      accept="any"
      multiple={false}
      maxCount={1}
      label="Drop a file to send"
      onDrop={(items) => {
        const first = items[0]
        if (!first) return
        sendPickedItemAsChatAttachment(first, { onSendImage, onSendFile })
      }}
    >
    {/* Open conversations hide the bottom tabs, so the composer owns the
        nav-bar / home-indicator inset — except while the keyboard covers it. */}
    <YStack
      backgroundColor={theme.composerBg}
      paddingBottom={keyboardVisible ? 4 : Math.max(insets.bottom, 8)}
    >
      {quickReplies.length > 0 ? (
        <YStack paddingHorizontal={8} paddingTop={8} gap={6}>
          <HorizontalScrollRow gap={8}>
            {quickReplies.map((reply) => (
              <XStack
                key={reply}
                paddingHorizontal={12}
                paddingVertical={8}
                borderRadius={999}
                borderWidth={1}
                borderColor={theme.border}
                backgroundColor={theme.inputBg}
                cursor="pointer"
                hoverStyle={{ borderColor: theme.brand }}
                pressStyle={{ opacity: 0.85 }}
                onPress={() => {
                  setText(reply)
                  onTyping(reply)
                  inputRef.current?.focus()
                }}
              >
                <Text fontSize={12.5} fontWeight="600" color={theme.text} numberOfLines={1}>
                  {reply}
                </Text>
              </XStack>
            ))}
          </HorizontalScrollRow>
        </YStack>
      ) : null}

      {contextBar ? (
        <XStack
          alignItems="center"
          gap={10}
          marginHorizontal={8}
          marginTop={8}
          paddingVertical={6}
          paddingHorizontal={10}
          backgroundColor={theme.inputBg}
          borderTopLeftRadius={14}
          borderTopRightRadius={14}
        >
          {contextBar.icon === 'edit' ? (
            <Icons.Pencil size={16} color={theme.brand} />
          ) : (
            <Icons.Reply size={16} color={theme.brand} />
          )}
          <YStack
            flex={1}
            minWidth={0}
            borderLeftWidth={3}
            borderLeftColor={theme.quoteBar}
            paddingLeft={8}
            gap={1}
          >
            <Text fontSize={12.5} fontWeight="700" color={theme.brand} numberOfLines={1}>
              {contextBar.name}
            </Text>
            <Text fontSize={13} color={theme.textMuted} numberOfLines={1}>
              {contextBar.text}
            </Text>
          </YStack>
          <IconButton onPress={cancelContext} label="Cancel" size={30}>
            <Icons.X size={18} color={theme.textSecondary} />
          </IconButton>
        </XStack>
      ) : null}

      {uploadProgress != null && uploadProgress > 0 ? (
        <YStack paddingHorizontal={12} paddingTop={8}>
          <UploadProgressBar progress={uploadProgress} label="Uploading attachment…" compact />
        </YStack>
      ) : null}

      <YStack paddingHorizontal={12}>
        {recording ? null : <WritingSuggestionBar value={text} onApply={handleChange} />}
      </YStack>

      <XStack alignItems="flex-end" gap={7} paddingHorizontal={8} paddingVertical={8}>
        {recording ? (
          <XStack
            flex={1}
            alignItems="center"
            gap={10}
            minHeight={46}
            paddingHorizontal={12}
            borderRadius={24}
            backgroundColor={theme.inputBg}
            borderWidth={1}
            borderColor={theme.border}
          >
            <IconButton onPress={() => void discardVoice()} label="Cancel recording" size={34}>
              <Icons.Trash2 size={20} color={theme.dangerText} />
            </IconButton>
            <YStack width={9} height={9} borderRadius={999} backgroundColor={theme.dangerText} />
            <Text flex={1} fontSize={15} color={theme.text}>
              {`${Math.floor(recordSeconds / 60)}:${(recordSeconds % 60).toString().padStart(2, '0')}`}
            </Text>
            <Text fontSize={12.5} color={theme.textMuted}>
              Recording…
            </Text>
          </XStack>
        ) : (
          /* Rounded input field holding emoji, text, and attachment controls. */
          <XStack
            flex={1}
            alignItems="center"
            minHeight={46}
            paddingLeft={4}
            paddingRight={4}
            borderRadius={24}
            backgroundColor={theme.inputBg}
            borderWidth={1}
            borderColor={theme.border}
          >
            <IconButton onPress={() => setEmojiOpen(true)} label="Emoji" size={38}>
              <Icons.Smile size={23} color={theme.textSecondary} />
            </IconButton>

            <Input
              ref={inputRef as never}
              flex={1}
              value={text}
              onChangeText={handleChange}
              onSubmitEditing={submit}
              placeholder={isEditing ? 'Edit message' : 'Message'}
              placeholderTextColor={theme.textMuted}
              color={theme.text}
              backgroundColor="transparent"
              borderWidth={0}
              paddingHorizontal={4}
              height={40}
              fontSize={16}
              spellCheck
              autoCorrect
              focusStyle={{
                borderWidth: 0,
                outlineWidth: 0,
                backgroundColor: 'transparent',
                shadowOpacity: 0,
              }}
              hoverStyle={{ borderColor: 'transparent' }}
              returnKeyType="send"
              blurOnSubmit={false}
            />

            {!isEditing ? (
              <IconButton onPress={() => setAttachOpen(true)} label="Attach" size={38}>
                {attaching ? (
                  <Spinner size="small" color={theme.brand} />
                ) : (
                  <Icons.Paperclip size={22} color={theme.textSecondary} />
                )}
              </IconButton>
            ) : null}
          </XStack>
        )}

        <XStack
          onPress={
            recording
              ? () => void stopVoiceAndSend()
              : canSend || isEditing
                ? submit
                : canRecord
                  ? () => void startVoice()
                  : undefined
          }
          cursor="pointer"
          width={46}
          height={46}
          borderRadius={999}
          alignItems="center"
          justifyContent="center"
          backgroundColor={theme.brand}
          hoverStyle={{ opacity: 0.9 }}
          pressStyle={{ scale: 0.92 }}
          animation="quick"
          aria-label={
            recording
              ? 'Send voice message'
              : canSend || isEditing
                ? isEditing
                  ? 'Save edit'
                  : 'Send message'
                : 'Record voice message'
          }
        >
          {sending ? (
            <Spinner size="small" color={theme.brandContrast} />
          ) : recording ? (
            <Icons.Send size={20} color={theme.brandContrast} />
          ) : isEditing ? (
            <Icons.Check size={22} color={theme.brandContrast} />
          ) : canSend ? (
            <Icons.Send size={20} color={theme.brandContrast} />
          ) : (
            <Icons.Mic size={21} color={theme.brandContrast} />
          )}
        </XStack>
      </XStack>

      <EmojiPickerSheet
        open={emojiOpen}
        onOpenChange={setEmojiOpen}
        onPick={(emoji) => {
          if (isReactionStickerValue(emoji) && !isEditing) {
            onSend(emoji)
            onTyping('')
            if (conversationId) void clearMessageDraft(conversationId)
            setText('')
            return
          }
          const next = text + emoji
          setText(next)
          if (!isEditing) onTyping(next)
        }}
      />

      <AttachmentSheet
        open={attachOpen}
        onOpenChange={setAttachOpen}
        onPickBrowse={() => void attachFromBrowse()}
        onPickGallery={() => void attachFromGallery()}
        onPickCamera={() => void attachFromCamera()}
        onPickVideo={() => void attachVideo()}
        onPickDocument={() => void attachDocument()}
        onPickPoll={onCreatePoll}
        onPickEvent={onCreateEvent}
        onPickListing={onCreateListing}
      />
    </YStack>
    </MediaDropZone>
  )
}
