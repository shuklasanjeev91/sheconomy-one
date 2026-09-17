import { useRouter } from 'one'
import { AppState, type AppStateStatus } from 'react-native'
import { useCallback, useEffect, useState } from 'react'

import { AuthSignInFlow } from '~/components/auth/AuthSignInFlow'
import { AppPage, LAYOUT_STRETCH } from '~/components/layout'
import { Button, ScreenState, Text, XStack, YStack, useAppToast } from '~/components/ui'
import { CoWorkStatusPill } from '~/co-work/components/CoWorkUi'
import { CalendarConnectionsPanel } from '~/co-work/components/CalendarConnectionsPanel'
import { MeetingCardOverflowMenu } from '~/co-work/components/MeetingCardOverflowMenu'
import { ensureMeetingMobilePermissions } from '~/co-work/lib/meeting-media-permissions'
import { openInstantMeetingSession } from '~/co-work/lib/instant-meeting-session'
import {
  fetchMyMeetings,
  formatMeetingCode,
  getMeetingAnchorAt,
} from '~/co-work/lib/meetings'
import { canEditOrCancelMeetingForUser } from '~/co-work/lib/meeting-role-permissions'
import { useCoWorkTheme } from '~/co-work/lib/theme'
import { pageGradientStyle } from '~/lib/platform/crossStyles'
import { formatMeetingInstantForViewer } from '~/lib/calendar/timezone'
import { navigateApp } from '~/lib/platform/navigate'
import type { Meeting } from '~/co-work/lib/types'
import { coWorkRoutes } from '~/lib/routes'
import { useProfile } from '~/hooks/useProfile'

function formatWhen(meeting: Meeting) {
  const anchor = getMeetingAnchorAt(meeting)
  if (!anchor) return 'Time TBD'
  return formatMeetingInstantForViewer(anchor.toISOString())
}

function statusTone(status: Meeting['status']) {
  switch (status) {
    case 'active':
    case 'instant':
      return 'live' as const
    case 'scheduled':
      return 'brand' as const
    default:
      return 'brand' as const
  }
}

/** An ended meeting can be restarted, so only cancelling removes the join button. */
function isRejoinable(status: Meeting['status']) {
  return status !== 'cancelled'
}

function joinLabel(status: Meeting['status']) {
  if (status === 'active') return 'Join'
  if (status === 'ended') return 'Restart'
  return 'Start'
}

export function CoWorkMeetingsScreen() {
  const { ui: coworkUi, gradients: coworkGradients } = useCoWorkTheme()
  const router = useRouter()
  const toast = useAppToast()
  const { user, isAuthenticated } = useProfile()
  const [meetings, setMeetings] = useState<Meeting[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async (opts?: { silent?: boolean }) => {
    if (!user) return
    if (!opts?.silent) {
      setLoading(true)
      setError(null)
    }
    try {
      setMeetings(await fetchMyMeetings(user.id))
    } catch (loadError) {
      if (!opts?.silent) {
        setError(loadError instanceof Error ? loadError.message : 'Failed to load meetings')
      }
    } finally {
      if (!opts?.silent) setLoading(false)
    }
  }, [user])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    const onChange = (state: AppStateStatus) => {
      if (state === 'active') void load({ silent: true })
    }
    const sub = AppState.addEventListener('change', onChange)
    return () => sub.remove()
  }, [load])

  if (!isAuthenticated || !user) {
    return <AuthSignInFlow returnTo={String(coWorkRoutes.meetings)} />
  }

  return (
    <AppPage
      scroll
      backgroundColor={coworkUi.pageBg}
      paddingVertical="$6"
      style={pageGradientStyle(coworkGradients.page, coworkUi.pageBg)}
    >
      <YStack gap="$5" width="100%" {...LAYOUT_STRETCH}>
        <YStack gap="$2">
          <Text fontSize={28} fontWeight="800" color={coworkUi.text} letterSpacing={-0.6}>
            My meetings
          </Text>
          <Text color={coworkUi.textSecondary} fontSize={14} lineHeight={20}>
            Upcoming and recent sessions you host or co-host
          </Text>
        </YStack>

        <CalendarConnectionsPanel redirectTo="/co-work/meetings" />

        <ScreenState
          loading={loading}
          error={error}
          empty={!loading && meetings.length === 0}
          emptyTitle="No upcoming meetings yet"
          emptyMessage="Schedule one or start an instant session."
          emptyActionLabel="Schedule meeting"
          onEmptyAction={() => router.push(coWorkRoutes.schedule as never)}
          onRetry={() => void load()}
        />

        <YStack gap="$2">
          {meetings.map((meeting) => {
            const canManage = canEditOrCancelMeetingForUser({
              userId: user.id,
              hostId: meeting.host_id,
              viewerRole: meeting.viewer_role,
            })
            return (
              <YStack
                key={meeting.id}
                gap="$2.5"
                padding="$3.5"
                borderRadius={coworkUi.radius.panel}
                borderWidth={1}
                borderColor={coworkUi.glassBorder}
                backgroundColor={coworkUi.meetingBarElevated}
              >
                <XStack alignItems="flex-start" justifyContent="space-between" gap="$3">
                  <YStack flex={1} gap={3} minWidth={0}>
                    <Text fontSize={13} fontWeight="700" color={coworkUi.meetingIconMuted}>
                      {formatWhen(meeting)}
                    </Text>
                    <Text fontWeight="700" fontSize={16} color={coworkUi.text} numberOfLines={2}>
                      {meeting.title}
                    </Text>
                    <Text fontSize={12} color={coworkUi.textMuted} letterSpacing={0.5}>
                      {formatMeetingCode(meeting.meeting_code)}
                      {canManage && meeting.viewer_role === 'co_host' ? ' · Co-host' : ''}
                    </Text>
                  </YStack>
                  <XStack alignItems="center" gap="$1.5" flexShrink={0}>
                    <CoWorkStatusPill
                      label={
                        meeting.status === 'instant' || meeting.status === 'active'
                          ? 'Live'
                          : meeting.status === 'scheduled'
                            ? 'Scheduled'
                            : meeting.status
                      }
                      tone={statusTone(meeting.status)}
                    />
                    <MeetingCardOverflowMenu
                      meeting={meeting}
                      userId={user.id}
                      onChanged={() => void load({ silent: true })}
                    />
                  </XStack>
                </XStack>
                <XStack gap="$2" flexWrap="wrap" alignItems="center">
                  {isRejoinable(meeting.status) ? (
                    <Button
                      tone="primary"
                      size="$3"
                      borderRadius={12}
                      onPress={() => {
                        void (async () => {
                          const perms = await ensureMeetingMobilePermissions({
                            requestNotifications: true,
                          })
                          if (!perms.ok) {
                            toast.show('Microphone required', {
                              tone: 'error',
                              message: perms.message,
                            })
                            return
                          }
                          openInstantMeetingSession({
                            code: meeting.meeting_code,
                            meeting,
                            autoJoin: true,
                          })
                        })()
                      }}
                    >
                      {joinLabel(meeting.status)}
                    </Button>
                  ) : null}
                  <Button
                    tone="ghost"
                    size="$3"
                    borderRadius={12}
                    onPress={() => navigateApp(coWorkRoutes.meeting(meeting.meeting_code))}
                  >
                    Details
                  </Button>
                </XStack>
              </YStack>
            )
          })}
        </YStack>
      </YStack>
    </AppPage>
  )
}
