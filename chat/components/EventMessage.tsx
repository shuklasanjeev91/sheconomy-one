import { useEffect, useState } from 'react'

import { useChatTheme } from '~/chat/lib/chat-theme'
import type { ChatEventPayload } from '~/chat/lib/types'
import {
  cancelEventRegistration,
  fetchEventAttendeeCount,
  fetchEventRegistrationState,
  registerForEvent,
} from '~/community/lib/events'
import { Icons, Image, Spinner, Text, XStack, YStack } from '~/components/ui'

type EventMessageProps = {
  event: ChatEventPayload
  isOwn: boolean
  currentUserId: string | null
}

function formatWhen(startTime: string | null): string | null {
  if (!startTime) return null
  const date = new Date(startTime)
  if (Number.isNaN(date.getTime())) return null
  return date.toLocaleString('en-IN', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

/** Event card message: shows details and lets participants RSVP (event_registrations). */
export function EventMessage({ event, isOwn, currentUserId }: EventMessageProps) {
  const chat = useChatTheme()
  // Legacy chat events (from the old app) have no backing `events` row, so we
  // show the details without RSVP.
  const isStatic = event.isStatic || !event.eventId
  const [isRegistered, setIsRegistered] = useState(false)
  const [attendees, setAttendees] = useState(0)
  const [loading, setLoading] = useState(!isStatic)
  const [toggling, setToggling] = useState(false)

  useEffect(() => {
    if (isStatic) return
    let cancelled = false
    setLoading(true)
    Promise.all([
      currentUserId
        ? fetchEventRegistrationState(event.eventId, currentUserId)
        : Promise.resolve({ isRegistered: false }),
      fetchEventAttendeeCount(event.eventId),
    ]).then(([state, count]) => {
      if (cancelled) return
      setIsRegistered(state.isRegistered)
      setAttendees(count)
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [event.eventId, currentUserId, isStatic])

  async function toggleRsvp() {
    if (!currentUserId || toggling) return
    setToggling(true)
    const result = isRegistered
      ? await cancelEventRegistration(event.eventId, currentUserId)
      : await registerForEvent(event.eventId, currentUserId)
    if (!result.error) {
      setIsRegistered((prev) => !prev)
      setAttendees((prev) => Math.max(0, prev + (isRegistered ? -1 : 1)))
    }
    setToggling(false)
  }

  const when = formatWhen(event.startTime)
  const titleColor = isOwn ? chat.bubbleOutText : chat.bubbleInText
  const metaColor = isOwn ? chat.bubbleMetaOut : chat.bubbleMetaIn

  return (
    <YStack gap={8} minWidth={220} maxWidth={280} paddingVertical={2}>
      {event.imageUrl ? (
        <YStack borderRadius={10} overflow="hidden" marginBottom={2}>
          <Image src={event.imageUrl} width="100%" height={130} objectFit="cover" alt="" />
        </YStack>
      ) : null}

      <XStack gap={9} alignItems="center">
        <YStack
          width={40}
          height={40}
          borderRadius={10}
          alignItems="center"
          justifyContent="center"
          backgroundColor={chat.reactionBg}
        >
          <Icons.Calendar size={20} color={chat.brand} />
        </YStack>
        <YStack flex={1} minWidth={0}>
          <Text fontSize={15} fontWeight="700" color={titleColor} numberOfLines={2}>
            {event.title || 'Event'}
          </Text>
          {when ? (
            <Text fontSize={12.5} color={metaColor} numberOfLines={1}>
              {when}
            </Text>
          ) : null}
        </YStack>
      </XStack>

      {event.location ? (
        <XStack gap={5} alignItems="center">
          <Icons.MapPin size={13} color={metaColor} />
          <Text fontSize={12.5} color={metaColor} numberOfLines={1} flex={1}>
            {event.location}
          </Text>
        </XStack>
      ) : null}

      {isStatic ? (
        <XStack alignItems="center" gap={6}>
          <Icons.Calendar size={13} color={metaColor} />
          <Text fontSize={12} color={metaColor}>
            Details only — RSVP unavailable for this event
          </Text>
        </XStack>
      ) : (
        <XStack alignItems="center" justifyContent="space-between" gap={8}>
          <Text fontSize={12} color={metaColor}>
            {attendees} going
          </Text>
          <XStack
            onPress={currentUserId ? () => void toggleRsvp() : undefined}
            cursor={currentUserId ? 'pointer' : 'default'}
            alignItems="center"
            justifyContent="center"
            gap={6}
            paddingHorizontal={16}
            height={32}
            borderRadius={999}
            backgroundColor={isRegistered ? chat.reactionBg : chat.brand}
            borderWidth={isRegistered ? 1 : 0}
            borderColor={chat.border}
            pressStyle={{ scale: 0.96 }}
            animation="quick"
          >
            {loading || toggling ? (
              <Spinner size="small" color={isRegistered ? chat.brand : chat.brandContrast} />
            ) : (
              <>
                {isRegistered ? <Icons.Check size={15} color={chat.brand} /> : null}
                <Text
                  fontSize={13.5}
                  fontWeight="700"
                  color={isRegistered ? chat.brand : chat.brandContrast}
                >
                  {isRegistered ? 'Going' : 'RSVP'}
                </Text>
              </>
            )}
          </XStack>
        </XStack>
      )}
    </YStack>
  )
}
