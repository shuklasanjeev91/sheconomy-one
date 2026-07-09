import { Link, useParams } from 'one'
import { useEffect, useState } from 'react'

import { AboutDetailRow } from '~/community/components/AboutDetailRow'
import { CommunityCard } from '~/community/components/CommunityCard'
import { CommunityShell } from '~/community/components/CommunityShell'
import { EntityPageHero } from '~/community/components/EntityPageHero'
import { EntityPageTabs } from '~/community/components/EntityPageTabs'
import { ProfileLink } from '~/community/components/ProfileLink'
import {
  cancelEventRegistration,
  fetchEvent,
  fetchEventAttendeeCount,
  fetchEventAttendees,
  fetchEventRegistrationState,
  registerForEvent,
  type CommunityEvent,
  type EventAttendee,
} from '~/community/lib/events'
import { useCommunityUi } from '~/community/lib/community-theme'
import { Avatar, Button, Icons, Spinner, Text, XStack, YStack, useAppToast } from '~/components/ui'
import { communityRoutes } from '~/lib/routes'
import { useSupabase } from '~/providers/SupabaseProvider'

type Tab = 'about' | 'attendees'

export function EventDetailScreen() {
  const communityUi = useCommunityUi()
  const { id } = useParams<{ id: string }>()
  const toast = useAppToast()
  const { user } = useSupabase()
  const [event, setEvent] = useState<CommunityEvent | null>(null)
  const [isRegistered, setIsRegistered] = useState(false)
  const [attendees, setAttendees] = useState(0)
  const [attendeeRows, setAttendeeRows] = useState<EventAttendee[]>([])
  const [tab, setTab] = useState<Tab>('about')
  const [isLoading, setIsLoading] = useState(true)
  const [isToggling, setIsToggling] = useState(false)

  useEffect(() => {
    if (!id) return
    setIsLoading(true)
    Promise.all([
      fetchEvent(id),
      fetchEventAttendeeCount(id),
      fetchEventAttendees(id),
      user ? fetchEventRegistrationState(id, user.id) : Promise.resolve({ isRegistered: false }),
    ]).then(([eventResult, count, attendeeList, reg]) => {
      setEvent(eventResult.data)
      setAttendees(count)
      setAttendeeRows(attendeeList)
      setIsRegistered(reg.isRegistered)
      setIsLoading(false)
    })
  }, [id, user])

  async function toggleRsvp() {
    if (!user || !event) return
    setIsToggling(true)
    const result = isRegistered
      ? await cancelEventRegistration(event.id, user.id)
      : await registerForEvent(event.id, user.id)
    setIsToggling(false)
    if (result.error) toast.show('RSVP failed', { tone: 'danger', message: result.error })
    else {
      setIsRegistered(!isRegistered)
      setAttendees((count) => (isRegistered ? Math.max(0, count - 1) : count + 1))
      if (!isRegistered) {
        setAttendeeRows((rows) => rows)
      }
    }
  }

  if (isLoading) {
    return (
      <CommunityShell wide>
        <YStack alignItems="center" paddingVertical="$10">
          <Spinner size="large" color={communityUi.brand} />
        </YStack>
      </CommunityShell>
    )
  }

  if (!event) {
    return (
      <CommunityShell wide>
        <CommunityCard padding={24}>
          <Text color={communityUi.textMuted}>Event not found.</Text>
        </CommunityCard>
      </CommunityShell>
    )
  }

  const isOrganizer = user?.id === event.organizer_id
  const meta = [
    formatWhen(event.start_time),
    event.end_time ? `ends ${formatTime(event.end_time)}` : null,
    event.is_online ? 'Online' : event.location,
    `${attendees} attending`,
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <CommunityShell wide>
      <YStack gap={12}>
        <EntityPageHero
          coverUrl={event.image_url}
          avatarUrl={event.image_url}
          avatarName={event.title}
          title={event.title}
          subtitle={event.event_type ? `${event.event_type} event` : undefined}
          meta={meta}
          badge={event.is_free === false ? `${event.currency ?? 'INR'} ${event.price}` : 'Free event'}
          actions={
            <>
              {user ? (
                <Button
                  backgroundColor={isRegistered ? communityUi.divider : communityUi.brand}
                  color={isRegistered ? communityUi.textMuted : 'white'}
                  borderRadius={999}
                  disabled={isToggling}
                  onPress={toggleRsvp}
                >
                  {isRegistered ? 'Cancel RSVP' : 'RSVP'}
                </Button>
              ) : null}
              {isOrganizer ? (
                <Link href={communityRoutes.eventCreate}>
                  <Button tone="outline" borderRadius={999}>
                    Create another
                  </Button>
                </Link>
              ) : null}
            </>
          }
        />

        <EntityPageTabs
          tabs={[
            { id: 'about', label: 'About' },
            { id: 'attendees', label: 'Attendees (${attendees})' },
          ]}
          active={tab}
          onChange={(value) => setTab(value as Tab)}
        />

        {tab === 'about' ? (
          <CommunityCard padding={16} gap={12}>
            <Text fontSize={15} lineHeight={22} color={communityUi.text}>
              {event.description || 'No description provided.'}
            </Text>
            <AboutDetailRow
              icon={Icons.Calendar}
              label="Date & time"
              value={`${formatWhen(event.start_time)}${event.end_time ? ` – ${formatWhen(event.end_time)}` : ''}`}
            />
            {event.is_online ? (
              <AboutDetailRow icon={Icons.Video} label="Format" value={event.meeting_url || 'Online event'} />
            ) : event.location ? (
              <AboutDetailRow icon={Icons.MapPin} label="Location" value={event.location} />
            ) : null}
            {event.max_attendees ? (
              <AboutDetailRow icon={Icons.Users} label="Capacity" value={`${attendees} / ${event.max_attendees}`} />
            ) : null}
            {event.tags?.length ? (
              <AboutDetailRow icon={Icons.Tag} label="Tags" value={event.tags.join(', ')} />
            ) : null}
          </CommunityCard>
        ) : null}

        {tab === 'attendees' ? (
          <CommunityCard padding={12} gap={8}>
            {attendeeRows.length === 0 ? (
              <Text color={communityUi.textMuted} padding={8}>
                No attendees yet. Be the first to RSVP.
              </Text>
            ) : (
              attendeeRows.map((attendee) => (
                <ProfileLink key={attendee.user_id} userId={attendee.user_id} username={attendee.username}>
                  <XStack gap={12} alignItems="center" paddingVertical={8} paddingHorizontal={8} borderRadius={8} hoverStyle={{ backgroundColor: communityUi.divider }}>
                    <Avatar name={attendee.full_name} src={attendee.avatar_url ?? undefined} size="$4" />
                    <YStack flex={1} gap={2}>
                      <Text fontSize={15} fontWeight="600" color={communityUi.text}>
                        {attendee.full_name}
                      </Text>
                      <Text fontSize={13} color={communityUi.textMuted} numberOfLines={1}>
                        {attendee.headline || 'Attending'}
                      </Text>
                    </YStack>
                  </XStack>
                </ProfileLink>
              ))
            )}
          </CommunityCard>
        ) : null}
      </YStack>
    </CommunityShell>
  )
}

function formatWhen(value: string) {
  return new Date(value).toLocaleString('en-IN', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function formatTime(value: string) {
  return new Date(value).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })
}