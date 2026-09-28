import { useRef, useState } from 'react'
import { Alert, Modal, Platform, StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { MeetingShareSheet } from '~/co-work/components/MeetingShareSheet'
import { RnPressable } from '~/co-work/components/RnPressable'
import {
  cancelMeeting,
  formatMeetingCode,
} from '~/co-work/lib/meetings'
import { canEditOrCancelMeetingForUser } from '~/co-work/lib/meeting-role-permissions'
import { buildMeetingInvitationText } from '~/co-work/lib/meeting-share'
import {
  ensureMeetingMobilePermissions,
  meetingJoinMediaFromPermissions,
} from '~/co-work/lib/meeting-media-permissions'
import { openInstantMeetingSession } from '~/co-work/lib/instant-meeting-session'
import { useCoWorkTheme } from '~/co-work/lib/theme'
import type { Meeting } from '~/co-work/lib/types'
import {
  AppBottomSheet,
  Button,
  Icons,
  Text,
  XStack,
  YStack,
  useAppToast,
} from '~/components/ui'
import { copyToClipboard } from '~/lib/platform/clipboard'
import { navigateApp } from '~/lib/platform/navigate'
import { coWorkRoutes } from '~/lib/routes'

type MeetingCardOverflowMenuProps = {
  meeting: Meeting
  userId: string
  /** Called after a successful cancel/delete so lists can refresh. */
  onChanged?: () => void
  /** Prefer opening the live room via InstantMeetingHost when available. */
  preferInstantSession?: boolean
}

type MenuItem = {
  key: string
  label: string
  icon: typeof Icons.Video
  danger?: boolean
  onPress: () => void
}

const isNative = Platform.OS !== 'web'

/**
 * Zoom-style ⋮ menu on meeting cards: Start, Copy / Share invitation, Edit, Delete.
 * Opens an action sheet. A popover trigger toggles twice on the same press
 * (built-in toggle plus the button handler), so the menu never appears.
 *
 * Native uses an RN `Modal` (its own window): inside the teleported Tamagui
 * sheet, gesture-handler taps on the card underneath won and cancelled the rows.
 */
export function MeetingCardOverflowMenu({
  meeting,
  userId,
  onChanged,
  preferInstantSession = true,
}: MeetingCardOverflowMenuProps) {
  const { ui: coworkUi } = useCoWorkTheme()
  const toast = useAppToast()
  const insets = useSafeAreaInsets()
  const [open, setOpen] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)
  const pendingActionRef = useRef<(() => void) | null>(null)

  const canManage = canEditOrCancelMeetingForUser({
    userId,
    hostId: meeting.host_id,
    viewerRole: meeting.viewer_role,
  })
  const canEdit =
    canManage && meeting.status !== 'cancelled' && meeting.status !== 'ended'
  // Allow Edit for scheduled + active so hosts can change title/date after start.
  const canDelete = canManage && meeting.status !== 'cancelled'
  const canStart = meeting.status !== 'cancelled'

  async function startMeeting() {
    const perms = await ensureMeetingMobilePermissions({ requestNotifications: true })
    if (!perms.ok) {
      toast.show('Cannot start meeting', { tone: 'error', message: perms.message })
      return
    }
    const media = meetingJoinMediaFromPermissions(perms)
    if (preferInstantSession) {
      openInstantMeetingSession({
        code: meeting.meeting_code,
        meeting,
        autoJoin: true,
        audioEnabled: media.audioEnabled,
        videoEnabled: media.videoEnabled,
      })
      return
    }
    navigateApp(coWorkRoutes.meeting(meeting.meeting_code))
  }

  async function copyInvitation() {
    const ok = await copyToClipboard(buildMeetingInvitationText(meeting))
    toast.show(ok ? 'Invitation copied' : 'Could not copy invitation', {
      tone: ok ? 'success' : 'danger',
    })
  }

  function confirmDelete() {
    const run = () => {
      void (async () => {
        try {
          await cancelMeeting(meeting.id)
          toast.show('Meeting deleted', { tone: 'success' })
          onChanged?.()
        } catch (error) {
          toast.show(error instanceof Error ? error.message : 'Could not delete meeting', {
            tone: 'error',
          })
        }
      })()
    }

    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const ok = window.confirm(
        meeting.status === 'ended'
          ? 'Delete this meeting? Nobody will be able to restart or rejoin it.'
          : 'Delete this meeting? Invitees will be notified that it will not take place.',
      )
      if (ok) run()
      return
    }

    Alert.alert(
      'Delete meeting?',
      meeting.status === 'ended'
        ? 'This closes the meeting for good. Nobody will be able to restart or rejoin it.'
        : 'Invitees will be notified that this meeting will not take place.',
      [
        { text: 'Keep', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: run },
      ],
    )
  }

  const items: MenuItem[] = [
    canStart
      ? {
          key: 'start',
          label: meeting.status === 'ended' ? 'Restart' : meeting.status === 'active' ? 'Join' : 'Start',
          icon: Icons.Video,
          onPress: () => void startMeeting(),
        }
      : null,
    {
      key: 'copy',
      label: 'Copy invitation',
      icon: Icons.Copy,
      onPress: () => void copyInvitation(),
    },
    {
      key: 'share',
      label: 'Share invitation',
      icon: Icons.Share2,
      onPress: () => setShareOpen(true),
    },
    canEdit
      ? {
          key: 'edit',
          label: 'Edit',
          icon: Icons.Pencil,
          onPress: () => navigateApp(coWorkRoutes.scheduleEdit(meeting.id)),
        }
      : null,
    canDelete
      ? {
          key: 'delete',
          label: 'Delete',
          icon: Icons.Trash2,
          danger: true,
          onPress: confirmDelete,
        }
      : null,
  ].filter(Boolean) as MenuItem[]

  function runPendingAction() {
    const action = pendingActionRef.current
    pendingActionRef.current = null
    action?.()
  }

  function selectItem(item: MenuItem) {
    setOpen(false)
    if (!isNative) {
      setTimeout(() => item.onPress(), 350)
      return
    }
    // iOS drops navigation and alerts presented while the modal is still
    // dismissing, so wait for `onDismiss` (with a fallback if it never fires).
    pendingActionRef.current = item.onPress
    setTimeout(runPendingAction, Platform.OS === 'ios' ? 700 : 0)
  }

  const menuRows = items.map((item) => {
    const Icon = item.icon
    const color = item.danger ? coworkUi.danger : coworkUi.text
    return (
      <RnPressable
        key={item.key}
        accessibilityRole="button"
        accessibilityLabel={item.label}
        onPress={() => selectItem(item)}
        collapsable={false}
        style={({ pressed }) => ({
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          minHeight: 48,
          paddingHorizontal: 12,
          borderRadius: 10,
          backgroundColor: pressed ? coworkUi.surfaceMuted : coworkUi.surface,
        })}
      >
        <Icon size={18} color={color} />
        <Text fontSize={15} fontWeight="600" color={color} flex={1}>
          {item.label}
        </Text>
      </RnPressable>
    )
  })

  return (
    <>
      <Button
        tone="ghost"
        size="$2"
        circular
        zIndex={2}
        icon={<Icons.MoreHorizontal size={18} color={coworkUi.textMuted} />}
        accessibilityLabel={`More actions for ${meeting.title}`}
        accessibilityHint={`Meeting ${formatMeetingCode(meeting.meeting_code)}`}
        onPress={(event) => {
          event?.stopPropagation?.()
          setOpen(true)
        }}
      />

      {isNative ? (
        <Modal
          visible={open}
          transparent
          animationType="fade"
          statusBarTranslucent
          navigationBarTranslucent
          supportedOrientations={['portrait', 'landscape']}
          onRequestClose={() => setOpen(false)}
          onDismiss={runPendingAction}
        >
          <View style={nativeMenuStyles.backdrop}>
            <RnPressable
              style={StyleSheet.absoluteFill}
              accessibilityRole="button"
              accessibilityLabel="Close menu"
              onPress={() => setOpen(false)}
            />
            <View
              style={[
                nativeMenuStyles.sheet,
                {
                  backgroundColor: coworkUi.surface,
                  paddingBottom: Math.max(insets.bottom, 12) + 8,
                },
              ]}
            >
              <XStack alignItems="center" gap="$3" paddingHorizontal="$4" paddingVertical="$3">
                <Text flex={1} fontSize={17} fontWeight="700" color={coworkUi.text} numberOfLines={2}>
                  {meeting.title}
                </Text>
                <RnPressable
                  accessibilityRole="button"
                  accessibilityLabel="Close"
                  hitSlop={8}
                  onPress={() => setOpen(false)}
                  style={nativeMenuStyles.close}
                >
                  <Icons.X size={22} color={coworkUi.text} />
                </RnPressable>
              </XStack>
              <View style={[nativeMenuStyles.divider, { backgroundColor: coworkUi.borderSoft }]} />
              <YStack gap="$1" paddingHorizontal="$3" paddingTop="$2">
                {menuRows}
              </YStack>
            </View>
          </View>
        </Modal>
      ) : (
        <AppBottomSheet
          open={open}
          onOpenChange={setOpen}
          title={meeting.title}
          fitContent
          scrollable={false}
        >
          <YStack gap="$1" width="100%">
            {menuRows}
          </YStack>
        </AppBottomSheet>
      )}

      <MeetingShareSheet open={shareOpen} onOpenChange={setShareOpen} meeting={meeting} />
    </>
  )
}

const nativeMenuStyles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(10, 10, 15, 0.45)',
  },
  sheet: {
    width: '100%',
    maxWidth: 640,
    alignSelf: 'center',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    overflow: 'hidden',
  },
  close: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    width: '100%',
  },
})
