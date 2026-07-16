import { useRouter } from 'one'
import { useMemo, useState } from 'react'

import { CommunityCard } from '~/community/components/CommunityCard'
import { CommunityShell } from '~/community/components/CommunityShell'
import { createEventAndFeedPost } from '~/community/lib/events'
import { useCommunityUi } from '~/community/lib/community-theme'
import {
  Button,
  DateTimeField,
  Field,
  Input,
  Spinner,
  Text,
  ValidatedTextArea,
  ValidatedTextField,
  XStack,
  YStack,
  useAppToast,
} from '~/components/ui'
import { ImageUploadField, preparePickedImagesForUpload } from '~/components/media/ImageUploadField'
import type { PickedImage } from '~/lib/media/pick-image'
import { uploadEventCoverImage } from '~/lib/supabase/storage-upload'
import { useUploadProgress } from '~/hooks/useUploadProgress'
import { LocationPickerField } from '~/components/geo'
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
  const [eventLocation, setEventLocation] = useState('')
  const [venueDetail, setVenueDetail] = useState('')
  const [cover, setCover] = useState<PickedImage[]>([])
  const [shareToFeed, setShareToFeed] = useState(true)
  const { progress: uploadProgress, track: trackUpload, reset: resetUpload } = useUploadProgress()

  const form = useFormValidation(
    useMemo(
      () => ({
        title: { validators: [required('Event title is required.'), minLength(3)] },
        description: { validators: [maxLength(5000)] },
        startDate: { validators: [required('Start date is required.'), dateYmd()] },
        startTime: { validators: [required('Start time is required.'), timeHm()] },
        endDate: { validators: [dateYmd()] },
        endTime: { validators: [timeHm()] },
        meetingUrl: {
          validators: isOnline
            ? [required('Meeting link is required for online events.'), url()]
            : [optionalUrl()],
        },
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

    if (!isOnline && !eventLocation.trim()) {
      toast.show('Location required', {
        tone: 'danger',
        message: 'Select a city and region for in-person events.',
      })
      return
    }

    const locationLabel = [venueDetail.trim(), eventLocation.trim()].filter(Boolean).join(', ')

    const startIso = new Date(
      `${form.fields.startDate.value}T${form.fields.startTime.value}`,
    ).toISOString()
    const endIso =
      form.fields.endDate.value && form.fields.endTime.value
        ? new Date(`${form.fields.endDate.value}T${form.fields.endTime.value}`).toISOString()
        : undefined

    setIsSaving(true)

    let coverUrl = ''
    if (cover[0]) {
      const [file] = await preparePickedImagesForUpload(cover)
      trackUpload(1)
      const { data: uploaded, error: uploadError } = await uploadEventCoverImage(user.id, file, {
        onProgress: trackUpload,
      })
      if (uploadError || !uploaded) {
        setIsSaving(false)
        resetUpload()
        toast.show('Could not upload cover image', {
          tone: 'danger',
          message: uploadError ?? 'Try again shortly.',
        })
        return
      }
      coverUrl = uploaded.publicUrl
    }

    const { event, error } = await createEventAndFeedPost(user.id, {
      title: form.fields.title.value.trim(),
      description: form.fields.description.value.trim(),
      startTime: startIso,
      endTime: endIso,
      isOnline,
      location: isOnline ? undefined : locationLabel,
      meetingUrl: isOnline ? form.fields.meetingUrl.value.trim() : undefined,
      imageUrl: coverUrl,
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
      shareToFeed,
      rsvpEnabled: true,
    })
    setIsSaving(false)
    resetUpload()

    if (error || !event) {
      toast.show('Could not create event', { tone: 'danger', message: error ?? 'Try again.' })
      return
    }

    toast.show(shareToFeed ? 'Event created and shared to feed' : 'Event created', {
      tone: 'success',
    })
    router.replace(communityRoutes.event(event.id))
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
          <DateTimeField
            mode="date"
            label="Start date"
            required
            minDate={new Date()}
            value={form.fields.startDate.value}
            onChange={form.fields.startDate.onChange}
            error={form.fields.startDate.showError ? form.fields.startDate.error ?? undefined : undefined}
            flex={1}
            minWidth={150}
          />
          <DateTimeField
            mode="time"
            label="Start time"
            required
            value={form.fields.startTime.value}
            onChange={form.fields.startTime.onChange}
            error={form.fields.startTime.showError ? form.fields.startTime.error ?? undefined : undefined}
            flex={1}
            minWidth={150}
          />
        </XStack>
        <XStack gap={12} flexWrap="wrap">
          <DateTimeField
            mode="date"
            label="End date (optional)"
            minDate={new Date()}
            value={form.fields.endDate.value}
            onChange={form.fields.endDate.onChange}
            error={form.fields.endDate.showError ? form.fields.endDate.error ?? undefined : undefined}
            flex={1}
            minWidth={150}
          />
          <DateTimeField
            mode="time"
            label="End time (optional)"
            value={form.fields.endTime.value}
            onChange={form.fields.endTime.onChange}
            error={form.fields.endTime.showError ? form.fields.endTime.error ?? undefined : undefined}
            flex={1}
            minWidth={150}
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
          <YStack gap={12}>
            <LocationPickerField
              value={eventLocation}
              onChange={setEventLocation}
              label="Event location"
            />
            <Field label="Venue name or address (optional)">
              <Input
                value={venueDetail}
                onChangeText={setVenueDetail}
                placeholder="Community hall, co-working space, street address"
              />
            </Field>
          </YStack>
        )}

        <ImageUploadField
          label="Cover image (optional)"
          hint="Upload a banner attendees will see on the event."
          value={cover}
          onChange={setCover}
          uploadProgress={uploadProgress}
          uploadLabel="Uploading cover…"
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

        <XStack
          gap={12}
          alignItems="center"
          paddingVertical={8}
          paddingHorizontal={4}
          onPress={() => setShareToFeed((value) => !value)}
          cursor="pointer"
        >
          <YStack
            width={22}
            height={22}
            borderRadius={6}
            borderWidth={2}
            borderColor={shareToFeed ? communityUi.brand : communityUi.border}
            backgroundColor={shareToFeed ? communityUi.brand : 'transparent'}
            alignItems="center"
            justifyContent="center"
          >
            {shareToFeed ? (
              <Text fontSize={12} fontWeight="800" color="white">
                ✓
              </Text>
            ) : null}
          </YStack>
          <YStack flex={1} gap={2}>
            <Text fontSize={14} fontWeight="700" color={communityUi.text}>
              Also share to feed
            </Text>
            <Text fontSize={12} color={communityUi.textMuted}>
              Post this event to your network like LinkedIn
            </Text>
          </YStack>
        </XStack>

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