import { useEffect, useState } from 'react'
import { Modal, Platform, Pressable } from 'react-native'

import { Button, Icons, Switch, Text, XStack, YStack } from '~/components/ui'
import { useCoWorkTheme } from '~/co-work/lib/theme'
import {
  loadMeetingMediaPrefs,
  saveMeetingMediaPrefs,
  type MeetingMediaPrefs,
} from '~/co-work/lib/meeting-media-prefs'
import {
  meetingShareContentItems,
  type MeetingShareContentKind,
} from '~/co-work/lib/meeting-share-content'

export type MeetingShareStartOptions = {
  content: MeetingShareContentKind
  shareComputerSound: boolean
  optimizeShareForVideo: boolean
  annotateAfterShare: boolean
}

type MeetingShareOptionsSheetProps = {
  open: boolean
  onClose: () => void
  onConfirm: (options: MeetingShareStartOptions) => void
  supportsScreenShare?: boolean
  supportsWhiteboard?: boolean
  /** Prefill Screen / Photos / Documents / Whiteboard when opening. */
  initialContent?: MeetingShareContentKind | null
}

/**
 * Zoom-style Share Content sheet — content tiles (Screen / Photos / Documents /
 * Whiteboard) above sound / optimize / annotate options. Sheconomy magenta accents.
 */
export function MeetingShareOptionsSheet({
  open,
  onClose,
  onConfirm,
  supportsScreenShare = true,
  supportsWhiteboard = true,
  initialContent = null,
}: MeetingShareOptionsSheetProps) {
  const { ui } = useCoWorkTheme()
  const [content, setContent] = useState<MeetingShareContentKind>('screen')
  const [shareComputerSound, setShareComputerSound] = useState(false)
  const [optimizeShareForVideo, setOptimizeShareForVideo] = useState(false)
  const [annotateAfterShare, setAnnotateAfterShare] = useState(false)
  const [ready, setReady] = useState(false)

  const contentItems = meetingShareContentItems({
    supportsScreenShare,
    supportsWhiteboard,
  })

  useEffect(() => {
    if (!open) {
      setReady(false)
      return
    }
    let cancelled = false
    void loadMeetingMediaPrefs().then((prefs) => {
      if (cancelled) return
      setShareComputerSound(prefs.shareComputerSound === true)
      setOptimizeShareForVideo(prefs.optimizeShareForVideo === true)
      setAnnotateAfterShare(prefs.annotateAfterShare === true)
      const items = meetingShareContentItems({
        supportsScreenShare,
        supportsWhiteboard,
      })
      const preferred =
        initialContent && items.some((item) => item.kind === initialContent)
          ? initialContent
          : supportsScreenShare
            ? 'screen'
            : supportsWhiteboard
              ? 'whiteboard'
              : items[0]?.kind ?? 'photos'
      setContent(preferred)
      setReady(true)
    })
    return () => {
      cancelled = true
    }
  }, [open, supportsScreenShare, supportsWhiteboard, initialContent])

  async function persistAndConfirm() {
    const next: MeetingShareStartOptions = {
      content,
      shareComputerSound,
      optimizeShareForVideo,
      annotateAfterShare,
    }
    try {
      const prefs = await loadMeetingMediaPrefs()
      const patch: MeetingMediaPrefs = {
        ...prefs,
        shareComputerSound: next.shareComputerSound,
        optimizeShareForVideo: next.optimizeShareForVideo,
        annotateAfterShare: next.annotateAfterShare,
      }
      await saveMeetingMediaPrefs(patch)
    } catch {
      // Still start share even if prefs write fails.
    }
    onConfirm(next)
  }

  if (!open) return null

  const screenOptionsVisible = content === 'screen'

  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable
        style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.65)',
          justifyContent: 'flex-end',
          alignItems: 'center',
        }}
        onPress={onClose}
      >
        <Pressable
          style={{ width: '100%', maxWidth: 480 }}
          onPress={(e) => e.stopPropagation()}
        >
          <YStack
            backgroundColor={ui.surfaceElevated}
            borderTopLeftRadius={18}
            borderTopRightRadius={18}
            borderWidth={1}
            borderColor={ui.borderSoft}
            padding="$4"
            paddingBottom="$5"
            gap="$4"
          >
            <YStack alignItems="center" paddingTop={2}>
              <YStack width={36} height={4} borderRadius={999} backgroundColor="rgba(255,255,255,0.28)" />
            </YStack>

            <XStack justifyContent="space-between" alignItems="center">
              <YStack flex={1} gap={2}>
                <Text fontSize={18} fontWeight="800" color={ui.text} letterSpacing={-0.3}>
                  Share content
                </Text>
                <Text fontSize={12} color={ui.textMuted}>
                  Screen, photos, documents, or whiteboard
                </Text>
              </YStack>
              <Button
                tone="ghost"
                size="$2"
                circular
                icon={<Icons.X size={16} color={ui.textSecondary} />}
                onPress={onClose}
                accessibilityLabel="Close"
              />
            </XStack>

            <XStack flexWrap="wrap" gap="$2.5">
              {contentItems.map((item) => {
                const active = content === item.kind
                const Icon =
                  item.kind === 'screen'
                    ? Icons.ScreenShare
                    : item.kind === 'photos'
                      ? Icons.Image
                      : item.kind === 'files'
                        ? Icons.FileText
                        : Icons.PenTool
                return (
                  <Pressable
                    key={item.kind}
                    onPress={() => setContent(item.kind)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    style={{
                      width: '47%',
                      flexGrow: 1,
                      minWidth: 140,
                      borderRadius: 14,
                      borderWidth: 1.5,
                      borderColor: active ? ui.brand : ui.borderSoft,
                      backgroundColor: active ? ui.brandMuted : 'rgba(255,255,255,0.04)',
                      paddingVertical: 14,
                      paddingHorizontal: 12,
                      gap: 8,
                    }}
                  >
                    <YStack
                      width={40}
                      height={40}
                      borderRadius={12}
                      alignItems="center"
                      justifyContent="center"
                      backgroundColor={active ? ui.brand : 'rgba(255,255,255,0.08)'}
                    >
                      <Icon size={20} color="#fff" />
                    </YStack>
                    <Text fontSize={14} fontWeight="800" color={ui.text}>
                      {item.label}
                    </Text>
                    <Text fontSize={11} color={ui.textMuted} lineHeight={15}>
                      {item.hint}
                    </Text>
                  </Pressable>
                )
              })}
            </XStack>

            {screenOptionsVisible ? (
              <YStack gap="$3" opacity={ready ? 1 : 0.6}>
                <Text fontSize={12} fontWeight="800" color={ui.brandLight} letterSpacing={0.3}>
                  SCREEN OPTIONS
                </Text>
                <ShareOptionRow
                  label="Share computer sound"
                  hint={
                    Platform.OS === 'web'
                      ? 'Includes tab or system audio when the browser supports it'
                      : 'Includes device audio when the OS capture picker allows it'
                  }
                  value={shareComputerSound}
                  onChange={setShareComputerSound}
                />
                <ShareOptionRow
                  label="Optimize for video clip"
                  hint="Prefer smoother motion encoding for movies and demos"
                  value={optimizeShareForVideo}
                  onChange={setOptimizeShareForVideo}
                />
                <ShareOptionRow
                  label="Annotate after sharing"
                  hint="Open the annotation overlay once your share starts"
                  value={annotateAfterShare}
                  onChange={setAnnotateAfterShare}
                />
              </YStack>
            ) : (
              <YStack
                padding="$3"
                borderRadius={12}
                backgroundColor="rgba(255,255,255,0.04)"
                borderWidth={1}
                borderColor={ui.borderSoft}
                gap="$1"
              >
                <Text fontSize={13} fontWeight="700" color={ui.text}>
                  {content === 'photos'
                    ? 'Share a photo attachment'
                    : content === 'files'
                      ? 'Share a document attachment'
                      : 'Open the whiteboard'}
                </Text>
                <Text fontSize={12} color={ui.textMuted} lineHeight={17}>
                  {content === 'whiteboard'
                    ? 'Everyone in the meeting can draw together.'
                    : 'The attachment is posted to Everyone in meeting chat.'}
                </Text>
              </YStack>
            )}

            <XStack gap="$2.5" paddingTop="$1">
              <Button tone="outline" flex={1} borderRadius={10} height={44} onPress={onClose}>
                Cancel
              </Button>
              <Button
                tone="primary"
                flex={1}
                borderRadius={10}
                height={44}
                backgroundColor={ui.brand}
                onPress={() => void persistAndConfirm()}
                icon={
                  content === 'screen' ? (
                    <Icons.ScreenShare size={16} color="#fff" />
                  ) : content === 'photos' ? (
                    <Icons.Image size={16} color="#fff" />
                  ) : content === 'files' ? (
                    <Icons.Paperclip size={16} color="#fff" />
                  ) : (
                    <Icons.PenTool size={16} color="#fff" />
                  )
                }
              >
                {content === 'screen'
                  ? 'Share'
                  : content === 'whiteboard'
                    ? 'Open'
                    : 'Attach'}
              </Button>
            </XStack>
          </YStack>
        </Pressable>
      </Pressable>
    </Modal>
  )
}

function ShareOptionRow({
  label,
  hint,
  value,
  onChange,
}: {
  label: string
  hint: string
  value: boolean
  onChange: (next: boolean) => void
}) {
  const { ui } = useCoWorkTheme()
  return (
    <XStack
      alignItems="center"
      justifyContent="space-between"
      gap="$3"
      paddingVertical="$2"
      paddingHorizontal="$3"
      borderRadius={12}
      backgroundColor="rgba(255,255,255,0.04)"
      borderWidth={1}
      borderColor={ui.borderSoft}
    >
      <YStack flex={1} gap={2}>
        <Text fontSize={14} fontWeight="700" color={ui.text}>
          {label}
        </Text>
        <Text fontSize={11} color={ui.textMuted} lineHeight={15}>
          {hint}
        </Text>
      </YStack>
      <Switch checked={value} onCheckedChange={onChange} />
    </XStack>
  )
}
