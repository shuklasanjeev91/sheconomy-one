import { useRouter } from 'one'
import { AppLink } from '~/components/navigation/AppLink'
import { useEffect, useMemo } from 'react'

import { CoWorkStatusPill } from '~/co-work/components/CoWorkUi'
import { MeetingCardOverflowMenu } from '~/co-work/components/MeetingCardOverflowMenu'
import { fetchMyMeetings, formatMeetingCode } from '~/co-work/lib/meetings'
import { recordMeetingCode } from '~/co-work/lib/recent-meeting-codes'
import { coworkGlassStyle, useCoWorkTheme } from '~/co-work/lib/theme'
import type { Meeting } from '~/co-work/lib/types'
import { Button, Icons, Spinner, Text, XStack, YStack, useAppToast } from '~/components/ui'
import { HorizontalScrollRow } from '~/components/layout'
import { addMeetingToDeviceCalendar } from '~/lib/calendar/device-calendar'
import { formatMeetingInstantForViewer } from '~/lib/calendar/timezone'
import { coworkBoxShadow } from '~/lib/platform/crossStyles'
import { coWorkRoutes } from '~/lib/routes'
import { useSupabase } from '~/providers/SupabaseProvider'
import { CACHE_KEYS } from '~/lib/bootstrap/cache-keys'
import { useCachedQuery } from '~/hooks/useCachedQuery'

function formatWhen(meeting: Meeting) {
  const raw = meeting.scheduled_at ?? meeting.started_at ?? meeting.created_at
  if (!raw) return 'Time TBD'
  return formatMeetingInstantForViewer(raw)
}

/** Upcoming meetings on Co-Work home (hosted + co-hosted + invited) — web + native. */
export function UpcomingMeetingsStrip({
  refreshKey = 0,
}: {
  /** Increment to force a reload (e.g. pull-to-refresh). */
  refreshKey?: number
}) {
  const { ui: coworkUi, shadows: coworkShadows } = useCoWorkTheme()
  const { user } = useSupabase()
  const router = useRouter()
  const toast = useAppToast()
  const { data, isLoading: loading, refresh } = useCachedQuery<Meeting[]>({
    cacheKey: user ? CACHE_KEYS.coWorkUpcoming(user.id) : null,
    enabled: !!user,
    fetcher: async () => {
      if (!user) return []
      const rows = await fetchMyMeetings(user.id)
      return rows
        .filter((m) => m.status === 'scheduled' || m.status === 'instant' || m.status === 'active')
        .slice(0, 6)
    },
  })
  const meetings = useMemo(() => data ?? [], [data])

  useEffect(() => {
    if (refreshKey > 0) void refresh()
  }, [refreshKey, refresh])

  async function addToCalendar(meeting: Meeting) {
    const result = await addMeetingToDeviceCalendar(meeting)
    if (result === 'cancelled') return
    toast.show(
      result === 'saved' || result === 'opened'
        ? 'Meeting added to calendar'
        : result === 'shared'
          ? 'Calendar event ready'
          : 'Could not open calendar',
      {
        tone: result === 'saved' || result === 'opened' || result === 'shared' ? 'success' : 'danger',
      },
    )
  }

  if (!user) return null

  return (
    <YStack gap="$3" width="100%">
      <XStack alignItems="center" justifyContent="space-between" gap="$2">
        <Text fontWeight="800" fontSize={18} color={coworkUi.text} letterSpacing={-0.3}>
          Your upcoming meetings
        </Text>
        <AppLink href={coWorkRoutes.meetings} asChild>
          <Text fontSize={13} fontWeight="600" color={coworkUi.brand} cursor="pointer">
            See all
          </Text>
        </AppLink>
      </XStack>

      {loading ? (
        <XStack paddingVertical="$3">
          <Spinner size="small" color={coworkUi.brand} />
        </XStack>
      ) : meetings.length === 0 ? (
        <YStack
          gap="$2"
          padding="$4"
          borderRadius={coworkUi.radius.card}
          borderWidth={1}
          borderColor={coworkUi.glassBorder}
          style={coworkGlassStyle(coworkUi, true)}
        >
          <Text color={coworkUi.textSecondary} fontSize={14}>
            No meetings yet. Schedule one or start an instant session.
          </Text>
          <XStack gap="$2" flexWrap="wrap">
            <AppLink href={coWorkRoutes.schedule} asChild>
              <Button tone="primary" size="$3" borderRadius={999}>
                Schedule
              </Button>
            </AppLink>
          </XStack>
        </YStack>
      ) : (
        <HorizontalScrollRow gap="$3">
          {meetings.map((meeting) => (
            <YStack
              key={meeting.id}
              width={280}
              gap="$2"
              padding="$4"
              borderRadius={coworkUi.radius.card}
              borderWidth={1}
              borderColor={coworkUi.glassBorder}
              style={{
                ...coworkGlassStyle(coworkUi, true),
                ...coworkBoxShadow(coworkShadows, 'card'),
              }}
            >
              <XStack alignItems="center" justifyContent="space-between" gap="$2">
                <CoWorkStatusPill
                  tone={
                    meeting.status === 'active' || meeting.status === 'instant' ? 'live' : 'brand'
                  }
                  label={meeting.status}
                />
                <MeetingCardOverflowMenu
                  meeting={meeting}
                  userId={user.id}
                  onChanged={() => void refresh()}
                />
              </XStack>
              <Text fontWeight="800" fontSize={15} color={coworkUi.text} numberOfLines={2}>
                {meeting.title}
              </Text>
              <Text fontSize={12} color={coworkUi.textSecondary} numberOfLines={1}>
                {formatWhen(meeting)}
              </Text>
              <Text fontSize={12} fontWeight="600" color={coworkUi.textMuted}>
                Code {formatMeetingCode(meeting.meeting_code)}
              </Text>
              <XStack gap="$2" flexWrap="wrap">
                <Button
                  tone="outline"
                  size="$3"
                  borderRadius={999}
                  icon={<Icons.Calendar size={15} />}
                  onPress={() => void addToCalendar(meeting)}
                >
                  Calendar
                </Button>
                <Button
                  tone="primary"
                  size="$3"
                  borderRadius={999}
                  flex={1}
                  minWidth={120}
                  icon={<Icons.Video size={15} color="white" />}
                  onPress={() => {
                    recordMeetingCode(meeting.meeting_code)
                    router.push(coWorkRoutes.meeting(meeting.meeting_code))
                  }}
                >
                  Open
                </Button>
              </XStack>
            </YStack>
          ))}
        </HorizontalScrollRow>
      )}
    </YStack>
  )
}
