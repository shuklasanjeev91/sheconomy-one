import { useRouter } from 'one'
import { AppLink } from '~/components/navigation/AppLink'
import { useEffect, useMemo } from 'react'

import { CoWorkStatusPill } from '~/co-work/components/CoWorkUi'
import { fetchUpcomingMeetings, formatMeetingCode } from '~/co-work/lib/meetings'
import { recordMeetingCode } from '~/co-work/lib/recent-meeting-codes'
import { coworkGlassStyle, useCoWorkTheme } from '~/co-work/lib/theme'
import type { Meeting } from '~/co-work/lib/types'
import { ShareButton } from '~/components/share'
import { Button, Icons, Spinner, Text, XStack, YStack, useAppToast } from '~/components/ui'
import { HorizontalScrollRow } from '~/components/layout'
import { addMeetingToDeviceCalendar } from '~/lib/calendar/device-calendar'
import { formatMeetingInstantForViewer } from '~/lib/calendar/timezone'
import { copyToClipboard } from '~/lib/platform/clipboard'
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

/** Upcoming meetings on Co-Work home (hosted + invited) — web + native. */
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
    cacheKey: user ? CACHE_KEYS.coWorkUpcoming : null,
    enabled: !!user,
    fetcher: async () => {
      const rows = await fetchUpcomingMeetings()
      return rows
        .filter((m) => m.status === 'scheduled' || m.status === 'instant' || m.status === 'active')
        .slice(0, 6)
    },
  })
  const meetings = useMemo(() => data ?? [], [data])

  useEffect(() => {
    if (refreshKey > 0) void refresh()
  }, [refreshKey, refresh])

  async function copyCode(code: string) {
    const ok = await copyToClipboard(formatMeetingCode(code))
    toast.show(ok ? 'Meeting code copied' : 'Could not copy code', {
      tone: ok ? 'success' : 'danger',
    })
  }

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
                <Icons.Video size={16} color={coworkUi.brand} />
              </XStack>
              <Text fontWeight="800" fontSize={15} color={coworkUi.text} numberOfLines={2}>
                {meeting.title}
              </Text>
              <Text fontSize={12} color={coworkUi.textSecondary} numberOfLines={1}>
                {formatWhen(meeting)}
              </Text>
              <XStack alignItems="center" justifyContent="space-between" gap="$2">
                <Text fontSize={12} fontWeight="600" color={coworkUi.textMuted} flex={1}>
                  Code {formatMeetingCode(meeting.meeting_code)}
                </Text>
                <XStack gap="$1" alignItems="center">
                  <XStack
                    padding={6}
                    borderRadius={999}
                    cursor="pointer"
                    hoverStyle={{ backgroundColor: coworkUi.surfaceMuted }}
                    pressStyle={{ opacity: 0.8 }}
                    onPress={() => void copyCode(meeting.meeting_code)}
                    accessibilityLabel="Copy meeting code"
                  >
                    <Icons.Copy size={14} color={coworkUi.brand} />
                  </XStack>
                  <ShareButton
                    variant="icon"
                    size="$3"
                    label="Share meeting"
                    meeting={meeting}
                  />
                </XStack>
              </XStack>
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