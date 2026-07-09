import { useRouter } from 'one'
import { useMemo, useState } from 'react'

import { CommunityCard } from '~/community/components/CommunityCard'
import { CommunityShell } from '~/community/components/CommunityShell'
import { createEvent } from '~/community/lib/events'
import { useCommunityUi } from '~/community/lib/community-theme'
import {
  Button,
  Spinner,
  Text,
  ValidatedTextArea,
  ValidatedTextField,
  XStack,
  YStack,
  useAppToast,
} from '~/components/ui'
import { useFormValidation } from '~/hooks/useFormValidation'
import { communityRoutes, routes } from '~/lib/routes'
import {
  dateYmd,
  maxLength,
  minLength,
  optionalUrl,
  positiveNumber,
  required,
  timeHm,
  url,
} from '~/lib/validation'
import { useSupabase } from '~/providers/SupabaseProvider'

import { BRAND_NAME } from '~/config/brand'

const EVENT_TYPES = ['meetup', 'workshop', 'webinar', 'networking', 'conference', 'other']

export function CreateEventScreen() {
  const communityUi = useCommunityUi()
  const router = useRouter()
  const toast = useAppToast()
  const { user } = useSupabase()
  const [eventType, setEventType] = useState('meetup')
  const [isOnline, setIsOnline] = useState(false)
  const [isFree, setIsFree] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

  const form = useFormValidation(
    useMemo(
      () => ({
        title: { validators: [required('Event title is required.'), minLength(3)] },
        description: { validators: [maxLength(5000)] },
        startDate: { validators: [required('Start date is required.'), dateYmd()] },
        startTime: { validators: [required('Start time is required.'), timeHm()] },
        endDate: { validators: [dateYmd()] },
        endTime: { validators: [timeHm()] },
        location: {
          validators: isOnline ? [] : [required('Location is required for in-person events.')],
        },
        meetingUrl: {
          validators: isOnline
            ? [required('Meeting link is required for online events.'), url()]
            : [optionalUrl()],
        },
        imageUrl: { validators: [optionalUrl()] },
        price: {
          validators: isFree ? [] : [required('Price is required.'), positiveNumber()],
        },
        maxAttendees: { validators: [positiveNumber()] },
        tags: { validators: [maxLength(200)] },
      }),
      [isFree, isOnline],
    ),
  )

  if (!user) {
    return (
      <CommunityShell wide>
        <CommunityCard padding={24} gap={12}>
          <Text fontSize={18} fontWeight="600" color={communityUi.text}>
            Sign in to create an event
          </Text>
          <Button
            backgroundColor={communityUi.brand}
            color="white"
            borderRadius={999}
            onPress={() => router.push(routes.signIn)}
          >
            Sign in
          </Button>
        </CommunityCard>
      </CommunityShell>
    )
  }

  async function handleCreate() {
    if (!form.validateAll()) return

    const startIso = new Date(
      `${form.fields.startDate.value}T${form.fields.startTime.value}`,
    ).toISOString()
    const endIso =
      form.fields.endDate.value && form.fields.endTime.value
        ? new Date(`${form.fields.endDate.value}T${form.fields.endTime.value}`).toISOString()
        : undefined

    setIsSaving(true)
    const { data, error } = await createEvent(user.id, {
      title: form.fields.title.value.trim(),
      description: form.fields.description.value.trim(),
      startTime: startIso,
      endTime: endIso,
      isOnline,
      location: isOnline ? undefined : form.fields.location.value.trim(),
      meetingUrl: isOnline ? form.fields.meetingUrl.value.trim() : undefined,
      imageUrl: form.fields.imageUrl.value.trim(),
      eventType,
      isFree,
      price: isFree ? undefined : Number(form.fields.price.value) || 0,
      maxAttendees: form.fields.maxAttendees.value
        ? Number(form.fields.maxAttendees.value)
        : undefined,
      tags: form.fields.tags.value
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean),
    })
    setIsSaving(false)

    if (error || !data) {
      toast.show('Could not create event', { tone: 'danger', message: error ?? 'Try again.' })
      return
    }

    toast.show('Event created', { tone: 'success' })
    router.replace(communityRoutes.event(data.id))
  }

  return (
    <CommunityShell wide>
      <CommunityCard padding={16} gap={16}>
        <YStack gap={4}>
          <Text fontSize={24} fontWeight="700" color={communityUi.text}>
            Create event
          </Text>
          <Text fontSize={14} color={communityUi.textMuted} lineHeight={20}>
            Host a meetup, workshop, or online session for your network.
          </Text>
        </YStack>

        <ValidatedTextField
          label="Event title"
          field={form.fields.title}
          placeholder={`${BRAND_NAME} founders meetup`}
          required
        />
        <ValidatedTextArea
          label="Description"
          field={form.fields.description}
          minHeight={120}
          placeholder="What will attendees learn or experience?"
        />

        <YStack gap={8}>
          <Text fontSize={13} fontWeight="600" color={communityUi.textMuted}>
            Event type
          </Text>
          <XStack gap={8} flexWrap="wrap">
            {EVENT_TYPES.map((type) => (
              <Button
                key={type}
                size="$3"
                backgroundColor={eventType === type ? communityUi.brand : communityUi.divider}
                color={eventType === type ? 'white' : communityUi.textMuted}
                onPress={() => setEventType(type)}
              >
                {type}
              </Button>
            ))}
          </XStack>
        </YStack>

        <XStack gap={12} flexWrap="wrap">
          <ValidatedTextField
            label="Start date"
            field={form.fields.startDate}
            placeholder="YYYY-MM-DD"
            flex={1}
            required
          />
          <ValidatedTextField
            label="Start time"
            field={form.fields.startTime}
            placeholder="HH:MM"
            flex={1}
            required
          />
        </XStack>
        <XStack gap={12} flexWrap="wrap">
          <ValidatedTextField
            label="End date (optional)"
            field={form.fields.endDate}
            placeholder="YYYY-MM-DD"
            flex={1}
          />
          <ValidatedTextField
            label="End time (optional)"
            field={form.fields.endTime}
            placeholder="HH:MM"
            flex={1}
          />
        </XStack>

        <XStack gap={8}>
          <Button
            size="$3"
            backgroundColor={!isOnline ? communityUi.brand : communityUi.divider}
            color={!isOnline ? 'white' : communityUi.textMuted}
            onPress={() => setIsOnline(false)}
          >
            In person
          </Button>
          <Button
            size="$3"
            backgroundColor={isOnline ? communityUi.brand : communityUi.divider}
            color={isOnline ? 'white' : communityUi.textMuted}
            onPress={() => setIsOnline(true)}
          >
            Online
          </Button>
        </XStack>

        {isOnline ? (
          <ValidatedTextField
            label="Meeting link"
            field={form.fields.meetingUrl}
            placeholder="https://zoom.us/..."
            required
          />
        ) : (
          <ValidatedTextField
            label="Location"
            field={form.fields.location}
            placeholder="City, venue, or address"
            required
          />
        )}

        <ValidatedTextField
          label="Cover image URL"
          field={form.fields.imageUrl}
          placeholder="https://..."
        />
        <ValidatedTextField
          label="Tags (comma separated)"
          field={form.fields.tags}
          placeholder="founders, networking, wellness"
        />

        <XStack gap={8}>
          <Button
            size="$3"
            backgroundColor={isFree ? communityUi.brand : communityUi.divider}
            color={isFree ? 'white' : communityUi.textMuted}
            onPress={() => setIsFree(true)}
          >
            Free
          </Button>
          <Button
            size="$3"
            backgroundColor={!isFree ? communityUi.brand : communityUi.divider}
            color={!isFree ? 'white' : communityUi.textMuted}
            onPress={() => setIsFree(false)}
          >
            Paid
          </Button>
        </XStack>

        {!isFree ? (
          <ValidatedTextField label="Price (INR)" field={form.fields.price} placeholder="499" required />
        ) : null}
        <ValidatedTextField
          label="Max attendees (optional)"
          field={form.fields.maxAttendees}
          placeholder="100"
        />

        <Button
          backgroundColor={communityUi.brand}
          color="white"
          borderRadius={999}
          disabled={isSaving || !form.isValid}
          onPress={handleCreate}
          icon={isSaving ? <Spinner size="small" color="white" /> : undefined}
        >
          Publish event
        </Button>
      </CommunityCard>
    </CommunityShell>
  )
}