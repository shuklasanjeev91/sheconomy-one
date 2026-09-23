import { useEffect, useState } from 'react'
import { Platform } from 'react-native'
import { RnPressable as Pressable } from '~/co-work/components/RnPressable'

import { AppBottomSheet, Icons, Switch, Text, XStack, YStack } from '~/components/ui'
import {
  loadMeetingMediaPrefs,
  saveMeetingMediaPrefs,
  type MeetingMediaPrefs,
} from '~/co-work/lib/meeting-media-prefs'
import { type MeetingShareContentKind } from '~/co-work/lib/meeting-share-content'
import { useCoWorkTheme } from '~/co-work/lib/theme'

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
  initialContent?: MeetingShareContentKind | null
}

type ShareListItem = {
  kind: MeetingShareContentKind
  label: string
  icon: typeof Icons.ScreenShare
  tint?: string
}

/**
 * Zoom-style Share sheet — primary green Screen action + content list.
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
  const [shareComputerSound, setShareComputerSound] = useState(false)
  const [optimizeShareForVideo, setOptimizeShareForVideo] = useState(false)
  const [annotateAfterShare, setAnnotateAfterShare] = useState(false)

  const listItems: ShareListItem[] = []
  if (supportsWhiteboard) {
    listItems.push({ kind: 'whiteboard', label: 'Whiteboards', icon: Icons.PenTool })
  }
  listItems.push(
    { kind: 'photos', label: 'Photos', icon: Icons.Image },
    { kind: 'photos', label: 'Image from file', icon: Icons.Image },
    { kind: 'files', label: 'Document', icon: Icons.FileText },
  )

  useEffect(() => {
    if (!open) return
    let cancelled = false
    void loadMeetingMediaPrefs().then((prefs) => {
      if (cancelled) return
      setShareComputerSound(prefs.shareComputerSound === true)
      setOptimizeShareForVideo(prefs.optimizeShareForVideo === true)
      setAnnotateAfterShare(prefs.annotateAfterShare === true)
    })
    return () => {
      cancelled = true
    }
  }, [open])

  useEffect(() => {
    if (!open || !initialContent || initialContent === 'screen') return
    // Deep-link from Docs / Apps into a specific share kind.
  }, [open, initialContent])

  async function startShare(content: MeetingShareContentKind) {
    const next: MeetingShareStartOptions = {
      content,
      shareComputerSound,
      optimizeShareForVideo,
      annotateAfterShare,
    }
    try {
      const prefs = await loadMeetingMediaPrefs()
      await saveMeetingMediaPrefs({
        ...prefs,
        shareComputerSound: next.shareComputerSound,
        optimizeShareForVideo: next.optimizeShareForVideo,
        annotateAfterShare: next.annotateAfterShare,
      } satisfies MeetingMediaPrefs)
    } catch {
      // Still start share even if prefs write fails.
    }
    onConfirm(next)
  }

  return (
    <AppBottomSheet
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose()
      }}
      title="Share"
      showHandle
      scrollable
      fitContent
      surfaceColor={ui.meetingBarElevated}
      handleColor={ui.borderSoft}
    >
      <YStack gap="$3" paddingBottom="$2">
        {supportsScreenShare ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Share screen"
            onPress={() => void startShare('screen')}
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 10,
              minHeight: 52,
              borderRadius: 14,
              backgroundColor: pressed ? 'rgba(34,197,94,0.22)' : 'rgba(34,197,94,0.14)',
              borderWidth: 1,
              borderColor: 'rgba(34,197,94,0.5)',
            })}
          >
            <Icons.ScreenShare size={22} color="#22C55E" />
            <Text fontSize={17} fontWeight="800" color="#22C55E">
              Screen
            </Text>
          </Pressable>
        ) : (
          <YStack
            minHeight={52}
            borderRadius={14}
            alignItems="center"
            justifyContent="center"
            paddingHorizontal={16}
            backgroundColor={ui.meetingControl}
            borderWidth={1}
            borderColor={ui.borderSoft}
          >
            <Text fontSize={14} fontWeight="600" color={ui.textMuted} textAlign="center">
              Screen share is unavailable on this build
            </Text>
          </YStack>
        )}

        <YStack
          borderRadius={14}
          overflow="hidden"
          borderWidth={1}
          borderColor={ui.borderSoft}
          backgroundColor={ui.meetingControl}
        >
          {listItems.map((item, index) => {
            const Icon = item.icon
            return (
              <Pressable
                key={`${item.label}-${index}`}
                onPress={() => void startShare(item.kind)}
                style={({ pressed }) => ({
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 14,
                  paddingHorizontal: 16,
                  paddingVertical: 14,
                  opacity: pressed ? 0.75 : 1,
                  borderTopWidth: index === 0 ? 0 : 1,
                  borderTopColor: ui.borderSoft,
                })}
              >
                <Icon size={22} color={ui.textSecondary} strokeWidth={1.8} />
                <Text flex={1} color={ui.text} fontSize={16} fontWeight="600">
                  {item.label}
                </Text>
              </Pressable>
            )
          })}
        </YStack>

        {supportsScreenShare ? (
          <YStack gap="$2.5" paddingTop="$1">
            <Text fontSize={12} fontWeight="800" color={ui.textMuted} letterSpacing={0.4}>
              SCREEN OPTIONS
            </Text>
            <ShareOptionRow
              label="Share device audio"
              hint={
                Platform.OS === 'web'
                  ? 'Includes tab or system audio when supported'
                  : 'Includes device audio when the OS capture picker allows it'
              }
              value={shareComputerSound}
              onChange={setShareComputerSound}
            />
            <ShareOptionRow
              label="Optimize for video clip"
              hint="Prefer smoother motion for movies and demos"
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
        ) : null}
      </YStack>
    </AppBottomSheet>
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
    <XStack alignItems="center" gap="$3" paddingVertical={2}>
      <YStack flex={1} gap={2} minWidth={0}>
        <Text fontSize={14} fontWeight="700" color={ui.text}>
          {label}
        </Text>
        <Text fontSize={12} color={ui.textSecondary} lineHeight={16}>
          {hint}
        </Text>
      </YStack>
      <Switch checked={value} onCheckedChange={onChange} />
    </XStack>
  )
}
