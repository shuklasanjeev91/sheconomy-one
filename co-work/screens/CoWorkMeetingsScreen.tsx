import { useRouter } from 'one'
import { AppState, Linking, Platform, type AppStateStatus } from 'react-native'
import { useCallback, useEffect, useState } from 'react'

import { AuthSignInFlow } from '~/components/auth/AuthSignInFlow'
import { AppPage, LAYOUT_STRETCH } from '~/components/layout'
import { Button, Icons, ScreenState, Text, XStack, YStack, useAppToast } from '~/components/ui'
import { CoWorkStatusPill } from '~/co-work/components/CoWorkUi'
import { CalendarConnectionsPanel } from '~/co-work/components/CalendarConnectionsPanel'
import { MeetingCalendarOnboardingSheet } from '~/co-work/components/MeetingCalendarOnboardingSheet'
import {
  dismissCalendarOnboarding,
  loadCalendarOnboardingDismissed,
  type CalendarOnboardingProvider,
} from '~/co-work/lib/meeting-calendar-onboarding'
import { meetingFeatureFlags } from '~/co-work/lib/meeting-feature-flags'
import { connectCalendarProvider } from '~/lib/calendar/connections'
import { MeetingCardOverflowMenu } from '~/co-work/components/MeetingCardOverflowMenu'
import {
  ensureMeetingMobilePermissions,
  meetingJoinMediaFromPermissions,
} from '~/co-work/lib/meeting-media-permissions'
import { openInstantMeetingSession } from '~/co-work/lib/instant-meeting-session'
import {
  fetchMyMeetings,
  formatMeetingCode,
  getMeetingAnchorAt,
} from '~/co-work/lib/meetings'
import { canEditOrCancelMeetingForUser } from '~/co-work/lib/meeting-role-permissions'
import { useCoWorkTheme } from '~/co-work/lib/theme'
import { formatMeetingInstantForViewer } from '~/lib/calendar/timezone'
import { navigateApp } from '~/lib/platform/navigate'
import type { Meeting } from '~/co-work/lib/types'
import { coWorkRoutes } from '~/lib/routes'
import { useProfile } from '~/hooks/useProfile'
import { copyShareLink } from '~/lib/share'

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

function isRejoinable(status: Meeting['status']) {
  return status !== 'cancelled'
}

function joinLabel(status: Meeting['status']) {
  if (status === 'active') return 'Join'
  if (status === 'ended') return 'Restart'
  return 'Start'
}

type TabKey = 'upcoming' | 'pmi'

export function CoWorkMeetingsScreen() {
  const { ui } = useCoWorkTheme()
  const router = useRouter()
  const toast = useAppToast()
  const { user, profile, isAuthenticated } = useProfile()
  const [activeTab, setActiveTab] = useState<TabKey>('upcoming')
  const [meetings, setMeetings] = useState<Meeting[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [calendarOnboardingOpen, setCalendarOnboardingOpen] = useState(false)
  const [calendarConnectBusy, setCalendarConnectBusy] = useState(false)

  const userPmi = user ? `${user.id.slice(0, 3)} ${user.id.slice(3, 6)} ${user.id.slice(6, 10)}`.toUpperCase() : '849 203 1184'

  useEffect(() => {
    if (!isAuthenticated || !meetingFeatureFlags.calendarSync) return
    let cancelled = false
    void loadCalendarOnboardingDismissed().then((dismissed) => {
      if (!cancelled && !dismissed) setCalendarOnboardingOpen(true)
    })
    return () => {
      cancelled = true
    }
  }, [isAuthenticated])

  async function handleCalendarOnboardingConnect(provider: CalendarOnboardingProvider) {
    setCalendarConnectBusy(true)
    try {
      if (provider === 'device') {
        if (Platform.OS === 'ios') {
          await Linking.openURL('calshow:')
        } else if (Platform.OS === 'android') {
          await Linking.openURL('content://com.android.calendar/time/')
        } else {
          toast.show('Use Google or Microsoft on web', {
            tone: 'info',
            message: 'Device calendar connects from the Sheconomy mobile app.',
          })
        }
      } else {
        await connectCalendarProvider(provider, '/co-work/meetings')
      }
      await dismissCalendarOnboarding()
      setCalendarOnboardingOpen(false)
    } catch (connectError) {
      toast.show('Could not connect calendar', {
        tone: 'danger',
        message: connectError instanceof Error ? connectError.message : 'Try again later.',
      })
    } finally {
      setCalendarConnectBusy(false)
    }
  }

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

  const handleCopyPmi = async () => {
    await copyShareLink(`https://sheconomy.in/co-work/join?code=${userPmi.replace(/\s/g, '')}`)
    toast.show('PMI Link Copied to clipboard', { tone: 'success' })
  }

  return (
    <AppPage
      scroll
      backgroundColor={ui.pageBg}
      paddingVertical="$6"
    >
      <YStack gap="$5" width="100%" {...LAYOUT_STRETCH}>
        {/* Header */}
        <XStack justifyContent="space-between" alignItems="center" flexWrap="wrap" gap="$3">
          <YStack gap="$1">
            <Text fontSize={28} fontWeight="800" color={ui.text} letterSpacing={-0.6}>
              Meetings
            </Text>
            <Text color={ui.textSecondary} fontSize={14} lineHeight={20}>
              View and manage upcoming schedules, PMI, and invitations
            </Text>
          </YStack>

          <Button
            tone="primary"
            backgroundColor={ui.brand}
            borderRadius={10}
            icon={<Icons.Plus size={16} color="#FFFFFF" />}
            onPress={() => router.push(coWorkRoutes.schedule as never)}
          >
            Schedule a Meeting
          </Button>
        </XStack>

        {/* Subtabs: Upcoming vs Personal Meeting Room */}
        <XStack gap="$2" borderBottomWidth={1} borderBottomColor={ui.borderSoft} paddingBottom="$1">
          <Button
            tone={activeTab === 'upcoming' ? 'primary' : 'ghost'}
            backgroundColor={activeTab === 'upcoming' ? ui.brand : 'transparent'}
            color={activeTab === 'upcoming' ? '#FFFFFF' : ui.textSecondary}
            size="$3"
            borderRadius={8}
            onPress={() => setActiveTab('upcoming')}
          >
            Upcoming Meetings ({meetings.length})
          </Button>
          <Button
            tone={activeTab === 'pmi' ? 'primary' : 'ghost'}
            backgroundColor={activeTab === 'pmi' ? ui.brand : 'transparent'}
            color={activeTab === 'pmi' ? '#FFFFFF' : ui.textSecondary}
            size="$3"
            borderRadius={8}
            onPress={() => setActiveTab('pmi')}
          >
            Personal Meeting Room (PMI)
          </Button>
        </XStack>

        {activeTab === 'pmi' ? (
          /* PMI Section */
          <YStack
            backgroundColor={ui.surface}
            borderRadius={16}
            borderWidth={1}
            borderColor={ui.borderSoft}
            padding="$5"
            gap="$4"
            style={{
              boxShadow: '0 8px 24px rgba(0, 0, 0, 0.15)',
            }}
          >
            <YStack gap="$1">
              <Text fontSize={20} fontWeight="700" color={ui.text}>
                {profile?.full_name || 'My'} Personal Meeting Room
              </Text>
              <Text fontSize={13} color={ui.textSecondary}>
                Your dedicated virtual meeting space. Share this ID with colleagues for instant catch-ups.
              </Text>
            </YStack>

            <YStack
              backgroundColor={ui.surfaceElevated}
              borderRadius={12}
              borderWidth={1}
              borderColor={ui.borderSoft}
              padding="$4"
              gap="$3"
            >
              <XStack justifyContent="space-between" alignItems="center">
                <Text fontSize={13} color={ui.textSecondary}>Meeting ID</Text>
                <Text fontSize={16} fontWeight="800" color={ui.text} letterSpacing={1}>
                  {userPmi}
                </Text>
              </XStack>

              <XStack justifyContent="space-between" alignItems="center">
                <Text fontSize={13} color={ui.textSecondary}>Host</Text>
                <Text fontSize={14} fontWeight="600" color={ui.text}>
                  {profile?.full_name || profile?.username || 'You'}
                </Text>
              </XStack>

              <XStack justifyContent="space-between" alignItems="center">
                <Text fontSize={13} color={ui.textSecondary}>Passcode</Text>
                <Text fontSize={14} fontWeight="600" color={ui.text}>
                  Protected (Host admitted)
                </Text>
              </XStack>
            </YStack>

            <XStack gap="$3" flexWrap="wrap">
              <Button
                tone="primary"
                backgroundColor={ui.brand}
                borderRadius={10}
                icon={<Icons.Video size={16} color="#FFFFFF" />}
                onPress={() => navigateApp(coWorkRoutes.meeting(userPmi.replace(/\s/g, '')))}
              >
                Start Meeting
              </Button>
              <Button
                tone="outline"
                borderRadius={10}
                icon={<Icons.Copy size={16} color={ui.text} />}
                onPress={() => void handleCopyPmi()}
              >
                Copy Invitation
              </Button>
            </XStack>
          </YStack>
        ) : (
          /* Upcoming Meetings Tab */
          <YStack gap="$4">
            <CalendarConnectionsPanel redirectTo="/co-work/meetings" />

            <ScreenState
              loading={loading}
              error={error}
              empty={!loading && meetings.length === 0}
              emptyTitle="No upcoming meetings"
              emptyMessage="You don't have any scheduled meetings. Click below to schedule one."
              emptyActionLabel="Schedule Meeting"
              onEmptyAction={() => router.push(coWorkRoutes.schedule as never)}
              onRetry={() => void load()}
            />

            <YStack gap="$3">
              {meetings.map((meeting) => {
                const canManage = canEditOrCancelMeetingForUser({
                  userId: user.id,
                  hostId: meeting.host_id,
                  viewerRole: meeting.viewer_role,
                })
                return (
                  <YStack
                    key={meeting.id}
                    gap="$3"
                    padding="$4"
                    borderRadius={14}
                    borderWidth={1}
                    borderColor={ui.borderSoft}
                    backgroundColor={ui.surface}
                    style={{
                      boxShadow: '0 4px 16px rgba(0, 0, 0, 0.12)',
                    }}
                  >
                    <XStack alignItems="flex-start" justifyContent="space-between" gap="$3">
                      <YStack flex={1} gap={4} minWidth={0}>
                        <XStack alignItems="center" gap="$2">
                          <Icons.Clock size={14} color={ui.textMuted} />
                          <Text fontSize={13} fontWeight="700" color={ui.brand}>
                            {formatWhen(meeting)}
                          </Text>
                        </XStack>
                        <Text fontWeight="700" fontSize={16} color={ui.text} numberOfLines={2}>
                          {meeting.title}
                        </Text>
                        <Text fontSize={13} color={ui.textMuted} letterSpacing={0.5}>
                          Meeting ID: {formatMeetingCode(meeting.meeting_code)}
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
                          backgroundColor={ui.brand}
                          size="$3"
                          borderRadius={10}
                          icon={<Icons.Video size={16} color="#FFFFFF" />}
                          onPress={() => {
                            void (async () => {
                              const perms = await ensureMeetingMobilePermissions({
                                requestNotifications: true,
                              })
                              if (!perms.ok) {
                                toast.show('Cannot join meeting', {
                                  tone: 'error',
                                  message: perms.message,
                                })
                                return
                              }
                              const media = meetingJoinMediaFromPermissions(perms)
                              openInstantMeetingSession({
                                code: meeting.meeting_code,
                                meeting,
                                autoJoin: true,
                                audioEnabled: media.audioEnabled,
                                videoEnabled: media.videoEnabled,
                              })
                            })()
                          }}
                        >
                          {joinLabel(meeting.status)}
                        </Button>
                      ) : null}
                      <Button
                        tone="outline"
                        size="$3"
                        borderRadius={10}
                        onPress={() => navigateApp(coWorkRoutes.meeting(meeting.meeting_code))}
                      >
                        Meeting Details
                      </Button>
                    </XStack>
                  </YStack>
                )
              })}
            </YStack>
          </YStack>
        )}
      </YStack>

      <MeetingCalendarOnboardingSheet
        open={calendarOnboardingOpen}
        busy={calendarConnectBusy}
        onClose={() => {
          void dismissCalendarOnboarding()
          setCalendarOnboardingOpen(false)
        }}
        onConnect={handleCalendarOnboardingConnect}
      />
    </AppPage>
  )
}
