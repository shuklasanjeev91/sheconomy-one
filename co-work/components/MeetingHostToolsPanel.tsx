import { useMemo, useState } from 'react'
import { Alert, Platform } from 'react-native'

import { MeetingPanelHeader } from '~/co-work/components/MeetingPanelHeader'
import { CoWorkPanelShell, CoWorkSectionLabel } from '~/co-work/components/CoWorkUi'
import { ScheduleToggleRow } from '~/co-work/components/ScheduleFormFields'
import {
  canChangeParticipantPermissions,
  canOpenHostTools,
} from '~/co-work/lib/meeting-role-permissions'
import { updateMeetingLiveSettings } from '~/co-work/lib/meetings'
import { useCoWorkTheme } from '~/co-work/lib/theme'
import type { Meeting, MeetingParticipantChatWith, MeetingRole } from '~/co-work/lib/types'
import { Button, Icons, ScrollView, Text, XStack, YStack, useAppToast } from '~/components/ui'

type HostToolsPage = 'root' | 'security' | 'participants' | 'general' | 'chat_with'

type MeetingHostToolsPanelProps = {
  meeting: Meeting
  viewerRole: MeetingRole
  isLocked?: boolean
  captionsActive?: boolean
  onClose: () => void
  onMeetingUpdated: (meeting: Meeting) => void
  onOpenSecurityShortcuts?: () => void
  onToggleLock?: () => void
  onOpenParticipants: () => void
  onOpenInfo: () => void
  onToggleCaptions: () => void
  onMuteAll?: () => void
  onAskAllToMute?: () => void
  fullWidth?: boolean
}

function chatWithLabel(value: MeetingParticipantChatWith | undefined) {
  switch (value) {
    case 'hosts':
      return 'Host and co-hosts'
    case 'off':
      return 'No one'
    default:
      return 'Everyone'
  }
}

function HostToolsRow({
  label,
  icon: Icon,
  value,
  onPress,
  danger,
}: {
  label: string
  icon: typeof Icons.Shield
  value?: string
  onPress: () => void
  danger?: boolean
}) {
  const { ui: coworkUi } = useCoWorkTheme()
  const color = danger ? coworkUi.danger : coworkUi.text
  return (
    <XStack
      alignItems="center"
      gap="$3"
      minHeight={52}
      paddingHorizontal="$3.5"
      paddingVertical="$2.5"
      borderBottomWidth={1}
      borderBottomColor={coworkUi.borderSoft}
      cursor="pointer"
      hoverStyle={{ backgroundColor: coworkUi.surfaceMuted }}
      pressStyle={{ opacity: 0.85 }}
      onPress={onPress}
    >
      <Icon size={20} color={color} />
      <Text flex={1} fontSize={15} fontWeight="600" color={color}>
        {label}
      </Text>
      {value ? (
        <Text fontSize={13} color={coworkUi.textMuted} numberOfLines={1} maxWidth={140}>
          {value}
        </Text>
      ) : null}
      {!danger ? <Icons.ChevronRight size={18} color={coworkUi.textMuted} /> : null}
    </XStack>
  )
}

/**
 * Zoom-style Host tools sheet for host + co-host.
 * Participant permission toggles are host-only; co-hosts can navigate and manage people.
 */
export function MeetingHostToolsPanel({
  meeting,
  viewerRole,
  isLocked = false,
  captionsActive = false,
  onClose,
  onMeetingUpdated,
  onToggleLock,
  onOpenParticipants,
  onOpenInfo,
  onToggleCaptions,
  onMuteAll,
  onAskAllToMute,
  fullWidth,
}: MeetingHostToolsPanelProps) {
  const { ui: coworkUi } = useCoWorkTheme()
  const toast = useAppToast()
  const [page, setPage] = useState<HostToolsPage>('root')
  const [saving, setSaving] = useState(false)

  const canOpen = canOpenHostTools(viewerRole)
  const canEditPermissions = canChangeParticipantPermissions(viewerRole)
  const security = meeting.security_settings
  const chatWith = security?.participantChatWith ?? 'everyone'

  const title = useMemo(() => {
    switch (page) {
      case 'security':
        return 'Security'
      case 'participants':
        return 'Participants'
      case 'general':
        return 'General'
      case 'chat_with':
        return 'Chat with'
      default:
        return 'Host tools'
    }
  }, [page])

  if (!canOpen) return null

  async function patchSecurity(patch: Partial<NonNullable<Meeting['security_settings']>>) {
    if (!canEditPermissions) {
      toast.show('Only the host can change participant permissions', { tone: 'info' })
      return
    }
    if (saving) return
    setSaving(true)
    try {
      const next = await updateMeetingLiveSettings(meeting.id, { securitySettings: patch })
      onMeetingUpdated(next)
      toast.show('Meeting settings updated', { tone: 'success' })
    } catch (error) {
      toast.show(error instanceof Error ? error.message : 'Could not update settings', {
        tone: 'danger',
      })
    } finally {
      setSaving(false)
    }
  }

  function confirmSuspend() {
    if (!canEditPermissions) {
      toast.show('Only the host can suspend participant activities', { tone: 'info' })
      return
    }
    const run = () => {
      void (async () => {
        await patchSecurity({
          allowScreenShare: false,
          participantChatWith: 'off',
          allowChat: false,
          allowSelfUnmute: false,
          allowSelfStartVideo: false,
          allowHandRaise: false,
        })
        onMuteAll?.()
        onAskAllToMute?.()
        toast.show('Participant activities suspended', {
          tone: 'success',
          message: 'Share, chat, unmute, and camera start are off for participants.',
        })
      })()
    }

    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      if (
        window.confirm(
          'Suspend participant activities? This mutes everyone and turns off share, chat, unmute, and camera start for participants.',
        )
      ) {
        run()
      }
      return
    }

    Alert.alert(
      'Suspend participant activities?',
      'This mutes everyone and turns off share, chat, unmute, and camera start for participants.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Suspend', style: 'destructive', onPress: run },
      ],
    )
  }

  return (
    <CoWorkPanelShell fullWidth={fullWidth}>
      {page === 'root' ? (
        <MeetingPanelHeader
          title="Host tools"
          subtitle={canEditPermissions ? 'Host controls' : 'Co-host tools'}
          icon={<Icons.ShieldCheck size={18} color={coworkUi.brandLight} />}
          onClose={onClose}
        />
      ) : (
        <XStack
          paddingHorizontal="$3"
          paddingVertical="$3"
          alignItems="center"
          gap="$2"
          borderBottomWidth={1}
          borderBottomColor={coworkUi.borderSoft}
        >
          <Button
            tone="ghost"
            size="$2"
            circular
            icon={<Icons.ChevronLeft size={20} color={coworkUi.text} />}
            onPress={() => setPage(page === 'chat_with' ? 'participants' : 'root')}
            accessibilityLabel="Back"
          />
          <Text flex={1} textAlign="center" fontWeight="800" fontSize={16} color={coworkUi.text}>
            {title}
          </Text>
          <YStack width={36} />
        </XStack>
      )}

      <ScrollView flex={1} padding="$3">
        {page === 'root' ? (
          <YStack gap="$3">
            <YStack
              borderRadius={16}
              borderWidth={1}
              borderColor={coworkUi.borderSoft}
              backgroundColor="rgba(255,255,255,0.03)"
              overflow="hidden"
            >
              <HostToolsRow
                label="Security"
                icon={Icons.Shield}
                onPress={() => setPage('security')}
              />
              <HostToolsRow
                label="General"
                icon={Icons.Settings}
                onPress={() => setPage('general')}
              />
              <HostToolsRow
                label="Captions and translations"
                icon={Icons.Captions}
                value={captionsActive ? 'On' : 'Off'}
                onPress={onToggleCaptions}
              />
              <HostToolsRow
                label="Participants"
                icon={Icons.Users}
                onPress={() => setPage('participants')}
              />
              <HostToolsRow
                label="My Notes"
                icon={Icons.FileText}
                onPress={() =>
                  toast.show('Notes coming soon', {
                    tone: 'info',
                    message: 'Personal meeting notes will land in a future update.',
                  })
                }
              />
            </YStack>

            {canEditPermissions ? (
              <Button
                tone="outline"
                borderRadius={14}
                borderColor="rgba(244,63,104,0.35)"
                backgroundColor={coworkUi.dangerMuted}
                color={coworkUi.danger}
                onPress={confirmSuspend}
                disabled={saving}
              >
                Suspend participant activities
              </Button>
            ) : null}
          </YStack>
        ) : null}

        {page === 'security' ? (
          <YStack gap="$4">
            <YStack
              borderRadius={16}
              borderWidth={1}
              borderColor={coworkUi.borderSoft}
              padding="$3"
              gap="$2"
            >
              <ScheduleToggleRow
                label="Lock meeting"
                description="No new participants can join until unlocked"
                checked={isLocked}
                onCheckedChange={() => {
                  if (!canEditPermissions) {
                    toast.show('Only the host can lock the meeting', { tone: 'info' })
                    return
                  }
                  onToggleLock?.()
                }}
              />
              <ScheduleToggleRow
                label="Waiting room"
                description="Admit guests before they enter"
                checked={security?.waitingRoom !== false}
                onCheckedChange={(checked) => void patchSecurity({ waitingRoom: checked })}
              />
            </YStack>
            <Button tone="outline" borderRadius={999} onPress={() => setPage('participants')}>
              Participant permissions
            </Button>
          </YStack>
        ) : null}

        {page === 'general' ? (
          <YStack gap="$3">
            <Text color={coworkUi.textSecondary} fontSize={13} lineHeight={18}>
              Meeting details, host leave behavior, and invite options.
            </Text>
            <Button
              tone="primary"
              borderRadius={999}
              onPress={onOpenInfo}
              icon={<Icons.Info size={16} color="white" />}
            >
              Open meeting info
            </Button>
            <Button tone="outline" borderRadius={999} onPress={onOpenParticipants}>
              Manage participants
            </Button>
          </YStack>
        ) : null}

        {page === 'participants' ? (
          <YStack gap="$3">
            {!canEditPermissions ? (
              <Text color={coworkUi.textMuted} fontSize={12} lineHeight={17}>
                Co-hosts can manage people, but only the host can change these permissions.
              </Text>
            ) : null}
            <YStack
              borderRadius={16}
              borderWidth={1}
              borderColor={coworkUi.borderSoft}
              backgroundColor="rgba(255,255,255,0.03)"
              overflow="hidden"
              opacity={canEditPermissions ? 1 : 0.72}
            >
              <YStack paddingHorizontal="$3.5" paddingTop="$3" paddingBottom="$1">
                <CoWorkSectionLabel>During the meeting</CoWorkSectionLabel>
              </YStack>
              <YStack paddingHorizontal="$3.5">
                <ScheduleToggleRow
                  label="Share screen"
                  checked={security?.allowScreenShare !== false}
                  onCheckedChange={(checked) => void patchSecurity({ allowScreenShare: checked })}
                />
              </YStack>
              <HostToolsRow
                label="Chat with"
                icon={Icons.MessageSquare}
                value={chatWithLabel(chatWith)}
                onPress={() => {
                  if (!canEditPermissions) {
                    toast.show('Only the host can change chat permissions', { tone: 'info' })
                    return
                  }
                  setPage('chat_with')
                }}
              />
              <YStack paddingHorizontal="$3.5">
                <ScheduleToggleRow
                  label="Rename"
                  checked={security?.allowParticipantRename !== false}
                  onCheckedChange={(checked) =>
                    void patchSecurity({ allowParticipantRename: checked })
                  }
                />
                <ScheduleToggleRow
                  label="Unmute"
                  description="Participants may unmute themselves"
                  checked={security?.allowSelfUnmute !== false}
                  onCheckedChange={(checked) => void patchSecurity({ allowSelfUnmute: checked })}
                />
                <ScheduleToggleRow
                  label="Start video"
                  checked={security?.allowSelfStartVideo !== false}
                  onCheckedChange={(checked) =>
                    void patchSecurity({ allowSelfStartVideo: checked })
                  }
                />
                <ScheduleToggleRow
                  label="Raise hand"
                  checked={security?.allowHandRaise !== false}
                  onCheckedChange={(checked) => void patchSecurity({ allowHandRaise: checked })}
                />
                <ScheduleToggleRow
                  label="Record meeting"
                  description="Host may start a cloud recording"
                  checked={security?.allowRecording !== false}
                  onCheckedChange={(checked) => void patchSecurity({ allowRecording: checked })}
                />
              </YStack>
            </YStack>
            <Button tone="outline" borderRadius={999} onPress={onOpenParticipants}>
              Open participants list
            </Button>
          </YStack>
        ) : null}

        {page === 'chat_with' ? (
          <YStack
            borderRadius={16}
            borderWidth={1}
            borderColor={coworkUi.borderSoft}
            overflow="hidden"
          >
            {(
              [
                { key: 'everyone', label: 'Everyone' },
                { key: 'hosts', label: 'Host and co-hosts' },
                { key: 'off', label: 'No one' },
              ] as const
            ).map((option) => {
              const active = chatWith === option.key
              return (
                <XStack
                  key={option.key}
                  alignItems="center"
                  justifyContent="space-between"
                  minHeight={52}
                  paddingHorizontal="$4"
                  borderBottomWidth={1}
                  borderBottomColor={coworkUi.borderSoft}
                  cursor="pointer"
                  onPress={() => {
                    void patchSecurity({
                      participantChatWith: option.key,
                      allowChat: option.key !== 'off',
                    }).then(() => setPage('participants'))
                  }}
                >
                  <Text fontSize={15} fontWeight="600" color={coworkUi.text}>
                    {option.label}
                  </Text>
                  {active ? <Icons.Check size={18} color={coworkUi.brand} /> : null}
                </XStack>
              )
            })}
          </YStack>
        ) : null}
      </ScrollView>
    </CoWorkPanelShell>
  )
}
