import { useRouter } from 'one'
import { AppLink } from '~/components/navigation/AppLink'
import { Platform } from 'react-native'
import { useCallback, useEffect, useState } from 'react'

import { AuthSignInFlow } from '~/components/auth/AuthSignInFlow'
import { AppPage, LAYOUT_STRETCH } from '~/components/layout'
import { Button, Icons, ScreenState, Text, XStack, YStack, useAppToast } from '~/components/ui'
import { CoWorkBrandChip, CoWorkStatusPill } from '~/co-work/components/CoWorkUi'
import { ensureMeetingMediaPermissions } from '~/co-work/lib/meeting-media-permissions'
import { openInstantMeetingSession } from '~/co-work/lib/instant-meeting-session'
import { fetchMyMeetings, formatMeetingCode } from '~/co-work/lib/meetings'
import { coworkGlassStyle, useCoWorkTheme } from '~/co-work/lib/theme'
import { coworkBoxShadow, pageGradientStyle } from '~/lib/platform/crossStyles'
import { navigateApp } from '~/lib/platform/navigate'
import type { Meeting } from '~/co-work/lib/types'
import { coWorkRoutes } from '~/lib/routes'
import { useProfile } from '~/hooks/useProfile'

import { BRAND_NAME } from '~/config/brand'

function formatWhen(meeting: Meeting) {
  const raw = meeting.scheduled_at ?? meeting.started_at ?? meeting.created_at
  if (!raw) return 'Time TBD'
  return new Intl.DateTimeFormat(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: meeting.time_zone ?? undefined,
  }).format(new Date(raw))
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

export function CoWorkMeetingsScreen() {
  const { ui: coworkUi, gradients: coworkGradients, shadows: coworkShadows } = useCoWorkTheme()
  const router = useRouter()
  const toast = useAppToast()
  const { user, isAuthenticated } = useProfile()
  const [meetings, setMeetings] = useState<Meeting[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!user) return
    setLoading(true)
    setError(null)
    try {
      setMeetings(await fetchMyMeetings(user.id))
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load meetings')
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    void load()
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
        <YStack gap="$3">
          <CoWorkBrandChip label="YOUR MEETINGS" />
          <Text fontSize={30} fontWeight="800" color={coworkUi.text} letterSpacing={-0.8}>
            Upcoming & active
          </Text>
          <Text color={coworkUi.textSecondary} lineHeight={22}>
            Meetings you host on {BRAND_NAME}
          </Text>
        </YStack>

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

        <YStack gap="$3">
          {meetings.map((meeting) => (
            <YStack
              key={meeting.id}
              gap="$3"
              padding="$4"
              paddingLeft="$4"
              borderRadius={coworkUi.radius.card}
              borderWidth={1}
              borderColor={coworkUi.glassBorder}
              borderLeftWidth={4}
              borderLeftColor={
                meeting.status === 'active' || meeting.status === 'instant'
                  ? coworkUi.live
                  : coworkUi.brandLight
              }
              animation="quick"
              hoverStyle={{ y: -2, borderColor: coworkUi.borderAccent }}
              style={{
                ...coworkGlassStyle(coworkUi, true),
                ...coworkBoxShadow(coworkShadows, 'card'),
              }}
            >
              <XStack alignItems="flex-start" justifyContent="space-between" gap="$3">
                <YStack flex={1} gap={4}>
                  <Text fontWeight="800" fontSize={17} color={coworkUi.text} numberOfLines={2}>
                    {meeting.title}
                  </Text>
                  <Text fontSize={13} color={coworkUi.textSecondary}>
                    {formatWhen(meeting)}
                  </Text>
                  <Text fontSize={12} color={coworkUi.textMuted}>
                    Code {formatMeetingCode(meeting.meeting_code)}
                    {meeting.max_participants ? ` · up to ${meeting.max_participants}` : ''}
                  </Text>
                </YStack>
                <CoWorkStatusPill label={meeting.status} tone={statusTone(meeting.status)} />
              </XStack>
              <XStack gap="$2" flexWrap="wrap">
                <Button
                  tone="primary"
                  size="$3"
                  borderRadius={999}
                  onPress={() => {
                    void (async () => {
                      const perms = await ensureMeetingMediaPermissions()
                      if (!perms.ok) {
                        toast.show('Camera & microphone required', {
                          tone: 'error',
                          message: perms.message,
                        })
                        return
                      }
                      if (Platform.OS === 'web') {
                        navigateApp(coWorkRoutes.meetingLive(meeting.meeting_code))
                      } else {
                        openInstantMeetingSession({
                          code: meeting.meeting_code,
                          meeting,
                        })
                      }
                    })()
                  }}
                >
                  Start
                </Button>
                <Button
                  tone="outline"
                  size="$3"
                  borderRadius={999}
                  borderColor={coworkUi.glassBorder}
                  onPress={() => navigateApp(coWorkRoutes.meeting(meeting.meeting_code))}
                >
                  Lobby
                </Button>
              </XStack>
            </YStack>
          ))}
        </YStack>
      </YStack>
    </AppPage>
  )
}