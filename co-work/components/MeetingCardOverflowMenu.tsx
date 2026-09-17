import { useState } from 'react'
import { Alert, Platform } from 'react-native'

import { MeetingShareSheet } from '~/co-work/components/MeetingShareSheet'
import {
  cancelMeeting,
  formatMeetingCode,
} from '~/co-work/lib/meetings'
import { canEditOrCancelMeetingForUser } from '~/co-work/lib/meeting-role-permissions'
import { buildMeetingInvitationText } from '~/co-work/lib/meeting-share'
import { ensureMeetingMobilePermissions } from '~/co-work/lib/meeting-media-permissions'
import { openInstantMeetingSession } from '~/co-work/lib/instant-meeting-session'
import { useCoWorkTheme } from '~/co-work/lib/theme'
import type { Meeting } from '~/co-work/lib/types'
import {
  Button,
  Icons,
  Popover,
  PopoverContent,
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

/**
 * Zoom-style ⋮ menu on meeting cards: Start, Copy / Share invitation, Edit, Delete.
 * Uses Popover with flip so the menu stays in the viewport.
 */
export function MeetingCardOverflowMenu({
  meeting,
  userId,
  onChanged,
  preferInstantSession = true,
}: MeetingCardOverflowMenuProps) {
  const { ui: coworkUi } = useCoWorkTheme()
  const toast = useAppToast()
  const [open, setOpen] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)

  const canManage = canEditOrCancelMeetingForUser({
    userId,
    hostId: meeting.host_id,
    viewerRole: meeting.viewer_role,
  })
  const canEdit =
    canManage && meeting.status !== 'cancelled' && meeting.status !== 'active'
  const canDelete = canManage && meeting.status !== 'cancelled'
  const canStart = meeting.status !== 'cancelled'

  async function startMeeting() {
    const perms = await ensureMeetingMobilePermissions({ requestNotifications: true })
    if (!perms.ok) {
      toast.show('Microphone required', { tone: 'error', message: perms.message })
      return
    }
    if (preferInstantSession) {
      openInstantMeetingSession({
        code: meeting.meeting_code,
        meeting,
        autoJoin: true,
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

  return (
    <>
      <Popover open={open} onOpenChange={setOpen} placement="top-end" allowFlip>
        <Popover.Trigger asChild>
          <Button
            tone="ghost"
            size="$2"
            circular
            icon={<Icons.MoreHorizontal size={18} color={coworkUi.textMuted} />}
            accessibilityLabel={`More actions for ${meeting.title}`}
            accessibilityHint={`Meeting ${formatMeetingCode(meeting.meeting_code)}`}
            onPress={(event) => {
              event?.stopPropagation?.()
              setOpen((current) => !current)
            }}
          />
        </Popover.Trigger>
        <PopoverContent
          elevate
          zIndex={500000}
          minWidth={220}
          padding="$1.5"
          borderRadius={14}
          backgroundColor={coworkUi.surface}
          borderWidth={1}
          borderColor={coworkUi.borderSoft}
          overflow="hidden"
        >
          <YStack gap={1}>
            {items.map((item) => {
              const Icon = item.icon
              const color = item.danger ? coworkUi.danger : coworkUi.text
              return (
                <XStack
                  key={item.key}
                  alignItems="center"
                  gap="$3"
                  minHeight={44}
                  paddingHorizontal="$3"
                  borderRadius={10}
                  cursor="pointer"
                  hoverStyle={{ backgroundColor: coworkUi.surfaceMuted }}
                  pressStyle={{ opacity: 0.85 }}
                  onPress={() => {
                    setOpen(false)
                    item.onPress()
                  }}
                >
                  <Icon size={18} color={color} />
                  <Text fontSize={15} fontWeight="600" color={color} flex={1}>
                    {item.label}
                  </Text>
                </XStack>
              )
            })}
          </YStack>
        </PopoverContent>
      </Popover>

      <MeetingShareSheet open={shareOpen} onOpenChange={setShareOpen} meeting={meeting} />
    </>
  )
}
