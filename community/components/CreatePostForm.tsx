import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'one'

import { GifPicker } from '~/community/components/GifPicker'
import { CommunityCard } from '~/community/components/CommunityCard'
import { MentionInput } from '~/community/components/MentionInput'
import { PostContentText } from '~/community/components/PostContentText'
import { createCommunityPost } from '~/community/lib/community'
import { fetchMyCompanies } from '~/community/lib/companies'
import { fetchMyGroups } from '~/community/lib/groups'
import { isGifUrl } from '~/community/lib/giphy'
import { useCommunityUi } from '~/community/lib/community-theme'
import {
  Avatar,
  Button,
  Field,
  Icons,
  Input,
  Spinner,
  Switch,
  Text,
  XStack,
  YStack,
  useAppToast,
} from '~/components/ui'
import {
  ImageUploadField,
  preparePickedImagesForUpload,
} from '~/components/media/ImageUploadField'
import { useFormValidation } from '~/hooks/useFormValidation'
import { useQueryParam } from '~/hooks/useQueryParams'
import { useProfile } from '~/hooks/useProfile'
import type { PickedImage } from '~/lib/media/pick-image'
import { communityRoutes, routes } from '~/lib/routes'
import { uploadEventCoverImage } from '~/lib/supabase/storage-upload'
import { maxLength, optionalUrl } from '~/lib/validation'

const MAX_POST_LENGTH = 3000
const MAX_POLL_OPTIONS = 4
const POLL_DURATIONS = [
  { label: '1 day', days: 1 },
  { label: '3 days', days: 3 },
  { label: '1 week', days: 7 },
]

type PostContext = 'profile' | 'company' | 'group'
type ComposeMode = 'text' | 'poll' | 'event'

type CreatePostFormProps = {
  onSuccess?: () => void
  initialGroupId?: string
  initialCompanyId?: string
}

export function CreatePostForm({ onSuccess, initialGroupId, initialCompanyId }: CreatePostFormProps) {
  const communityUi = useCommunityUi()
  const router = useRouter()
  const toast = useAppToast()
  const { profile, user, isAuthenticated } = useProfile()
  const form = useFormValidation(
    useMemo(
      () => ({
        content: { validators: [maxLength(MAX_POST_LENGTH)] },
        imageUrl: { validators: [optionalUrl()] },
      }),
      [],
    ),
  )
  const [isPosting, setIsPosting] = useState(false)
  const [gifOpen, setGifOpen] = useState(false)
  const encodedContentRef = useRef('')
  const [postContext, setPostContext] = useState<PostContext>('profile')
  const [companyId, setCompanyId] = useState<string | null>(initialCompanyId ?? null)
  const [groupId, setGroupId] = useState<string | null>(initialGroupId ?? null)
  const [companies, setCompanies] = useState<{ id: string; name: string }[]>([])
  const [groups, setGroups] = useState<{ id: string; title: string }[]>([])

  const [composeMode, setComposeMode] = useState<ComposeMode>('text')
  const [pollOptions, setPollOptions] = useState<string[]>(['', ''])
  const [pollDurationDays, setPollDurationDays] = useState(1)
  const [eventTitle, setEventTitle] = useState('')
  const [eventDate, setEventDate] = useState('')
  const [eventTime, setEventTime] = useState('')
  const [eventLocation, setEventLocation] = useState('')
  const [eventRsvp, setEventRsvp] = useState(true)
  const [eventCover, setEventCover] = useState<PickedImage[]>([])

  const displayName = profile?.full_name || profile?.username || 'You'
  const content = form.fields.content.value
  const imageUrl = form.fields.imageUrl.value
  const remaining = MAX_POST_LENGTH - content.length
  const isOverLimit = remaining < 0
  const contentError = form.fields.content.showError ? form.fields.content.error : null

  const filledPollOptions = pollOptions.map((option) => option.trim()).filter(Boolean)
  const canPost =
    composeMode === 'poll'
      ? content.trim().length > 0 && filledPollOptions.length >= 2 && !isOverLimit
      : composeMode === 'event'
        ? eventTitle.trim().length > 0 && eventDate.trim().length > 0 && eventTime.trim().length > 0
        : Boolean(content.trim() || imageUrl.trim()) && !isOverLimit && form.fields.imageUrl.isValid

  const gifParam = useQueryParam('gif')
  const groupParam = useQueryParam('groupId')
  const companyParam = useQueryParam('companyId')
  const composeParam = useQueryParam('compose')

  useEffect(() => {
    if (gifParam) form.fields.imageUrl.setValue(decodeURIComponent(gifParam))
    if (groupParam) {
      setGroupId(groupParam)
      setPostContext('group')
    }
    if (companyParam) {
      setCompanyId(companyParam)
      setPostContext('company')
    }
    if (composeParam === 'poll' || composeParam === 'event') setComposeMode(composeParam)
  }, [companyParam, composeParam, gifParam, groupParam])

  useEffect(() => {
    if (!user) return
    fetchMyCompanies(user.id).then((rows) => setCompanies(rows.map((c) => ({ id: c.id, name: c.name }))))
    fetchMyGroups(user.id).then((rows) => setGroups(rows.map((g) => ({ id: g.id, title: g.title }))))
  }, [user])

  if (!isAuthenticated || !user) {
    return (
      <CommunityCard padding={24} gap={16} alignItems="center">
        <Icons.User size={40} color={communityUi.brand} />
        <Text fontSize={18} fontWeight="600" color={communityUi.text} textAlign="center">
          Sign in to share with your network
        </Text>
        <Button backgroundColor={communityUi.brand} color="white" borderRadius={999} onPress={() => router.push(routes.signIn)}>
          Sign in
        </Button>
      </CommunityCard>
    )
  }

  function updatePollOption(index: number, value: string) {
    setPollOptions((prev) => prev.map((option, i) => (i === index ? value : option)))
  }

  function addPollOption() {
    setPollOptions((prev) => (prev.length >= MAX_POLL_OPTIONS ? prev : [...prev, '']))
  }

  function removePollOption(index: number) {
    setPollOptions((prev) => (prev.length <= 2 ? prev : prev.filter((_, i) => i !== index)))
  }

  async function handlePost() {
    if (!user || !canPost) return
    form.fields.content.touch()
    form.fields.imageUrl.touch()
    if (!form.validateAll()) return

    const targetCompanyId = postContext === 'company' ? companyId : null
    const targetGroupId = postContext === 'group' ? groupId : null
    // Encoded content carries @mentions as resolvable tokens; fall back to the
    // raw text when nothing was mentioned.
    const finalContent = encodedContentRef.current || content

    setIsPosting(true)
    let result: { id: string | null; error: string | null }
    if (composeMode === 'poll') {
      result = await createCommunityPost(user.id, {
        content: finalContent,
        companyId: targetCompanyId,
        groupId: targetGroupId,
        poll: { question: content, options: pollOptions, durationDays: pollDurationDays },
      })
    } else if (composeMode === 'event') {
      const startIso =
        eventDate && eventTime ? new Date(`${eventDate}T${eventTime}`).toISOString() : null

      let coverUrl: string | null = null
      if (eventCover[0]) {
        const [file] = await preparePickedImagesForUpload(eventCover)
        const { data: uploaded, error: uploadError } = await uploadEventCoverImage(user.id, file)
        if (uploadError || !uploaded) {
          setIsPosting(false)
          toast.show('Could not upload cover image', {
            tone: 'danger',
            message: uploadError ?? 'Try again shortly.',
          })
          return
        }
        coverUrl = uploaded.publicUrl
      }

      result = await createCommunityPost(user.id, {
        content: finalContent,
        imageUrl: coverUrl,
        companyId: targetCompanyId,
        groupId: targetGroupId,
        eventTitle: eventTitle.trim(),
        eventDescription: finalContent.trim() || null,
        eventStartTime: startIso,
        eventLocation: eventLocation.trim() || null,
        eventRsvpEnabled: eventRsvp,
      })
    } else {
      result = await createCommunityPost(user.id, {
        content: finalContent,
        imageUrl: imageUrl || null,
        companyId: targetCompanyId,
        groupId: targetGroupId,
      })
    }
    setIsPosting(false)

    if (result.error || !result.id) {
      toast.show('Could not post', { tone: 'danger', message: result.error ?? 'Try again shortly.' })
      return
    }

    toast.show('Posted', { tone: 'success', message: 'Your update is live.' })
    form.resetAll()
    setPollOptions(['', ''])
    setEventTitle('')
    setEventDate('')
    setEventTime('')
    setEventLocation('')
    setEventCover([])
    onSuccess?.()
    router.replace(communityRoutes.home)
  }

  const contentLabel =
    composeMode === 'poll'
      ? 'Ask a question'
      : composeMode === 'event'
        ? 'Event details (optional)'
        : "What's on your mind?"
  const contentPlaceholder =
    composeMode === 'poll'
      ? 'What do you want to ask?'
      : composeMode === 'event'
        ? 'Add details attendees should know'
        : 'What do you want to talk about?'

  return (
    <>
      <CommunityCard gap={0}>
        <YStack padding={16} gap={12} borderBottomWidth={1} borderBottomColor={communityUi.borderLight}>
          <Text fontSize={18} fontWeight="600" color={communityUi.text}>
            Create a post
          </Text>
          <XStack gap={12} alignItems="center">
            <Avatar name={displayName} src={profile?.avatar_url ?? undefined} size="$4" />
            <YStack gap={4} flex={1}>
              <Text fontSize={14} fontWeight="600" color={communityUi.text}>
                {displayName}
              </Text>
              <XStack gap={8} flexWrap="wrap">
                <ContextChip label="Your profile" active={postContext === 'profile'} onPress={() => setPostContext('profile')} />
                {companies.length > 0 ? (
                  <ContextChip label="Page" active={postContext === 'company'} onPress={() => setPostContext('company')} />
                ) : null}
                {groups.length > 0 ? (
                  <ContextChip label="Group" active={postContext === 'group'} onPress={() => setPostContext('group')} />
                ) : null}
              </XStack>
            </YStack>
          </XStack>

          {postContext === 'company' && companies.length > 0 ? (
            <XStack gap={8} flexWrap="wrap">
              {companies.map((company) => (
                <ContextChip
                  key={company.id}
                  label={company.name}
                  active={companyId === company.id}
                  onPress={() => setCompanyId(company.id)}
                />
              ))}
            </XStack>
          ) : null}

          {postContext === 'group' && groups.length > 0 ? (
            <XStack gap={8} flexWrap="wrap">
              {groups.map((group) => (
                <ContextChip
                  key={group.id}
                  label={group.title}
                  active={groupId === group.id}
                  onPress={() => setGroupId(group.id)}
                />
              ))}
            </XStack>
          ) : null}

          <XStack gap={8} flexWrap="wrap">
            <ModeChip icon={Icons.FileText} label="Post" active={composeMode === 'text'} onPress={() => setComposeMode('text')} />
            <ModeChip icon={Icons.BarChart2} label="Poll" active={composeMode === 'poll'} onPress={() => setComposeMode('poll')} />
            <ModeChip icon={Icons.Calendar} label="Event" active={composeMode === 'event'} onPress={() => setComposeMode('event')} />
          </XStack>
        </YStack>

        <YStack padding={16} gap={12}>
          <Field label={contentLabel} error={contentError ?? undefined}>
            <MentionInput
              multiline
              value={content}
              onChangeText={(value) => form.fields.content.onChange(value.slice(0, MAX_POST_LENGTH + 50))}
              onEncodedChange={(encoded) => {
                encodedContentRef.current = encoded
              }}
              invalid={!!contentError}
              placeholder={contentPlaceholder}
              minHeight={composeMode === 'text' ? 140 : 90}
              fontSize={16}
              lineHeight={24}
              borderWidth={0}
              backgroundColor="transparent"
              padding={0}
            />
          </Field>

          <XStack justifyContent="flex-end">
            <Text fontSize={12} color={isOverLimit ? '#cc1010' : communityUi.textMuted}>
              {remaining}
            </Text>
          </XStack>

          {composeMode === 'poll' ? (
            <YStack gap={10}>
              {pollOptions.map((option, index) => (
                <XStack key={index} gap={8} alignItems="center">
                  <Input
                    flex={1}
                    value={option}
                    onChangeText={(value) => updatePollOption(index, value)}
                    placeholder={`Option ${index + 1}`}
                    maxLength={80}
                  />
                  {pollOptions.length > 2 ? (
                    <XStack
                      cursor="pointer"
                      padding={6}
                      borderRadius={999}
                      hoverStyle={{ backgroundColor: communityUi.divider }}
                      onPress={() => removePollOption(index)}
                    >
                      <Icons.X size={18} color={communityUi.textMuted} />
                    </XStack>
                  ) : null}
                </XStack>
              ))}
              {pollOptions.length < MAX_POLL_OPTIONS ? (
                <XStack
                  gap={6}
                  alignItems="center"
                  cursor="pointer"
                  alignSelf="flex-start"
                  onPress={addPollOption}
                >
                  <Icons.Plus size={18} color={communityUi.brand} />
                  <Text fontSize={13} fontWeight="600" color={communityUi.brand}>
                    Add option
                  </Text>
                </XStack>
              ) : null}

              <YStack gap={6}>
                <Text fontSize={13} fontWeight="600" color={communityUi.textMuted}>
                  Poll length
                </Text>
                <XStack gap={8} flexWrap="wrap">
                  {POLL_DURATIONS.map((duration) => (
                    <ContextChip
                      key={duration.days}
                      label={duration.label}
                      active={pollDurationDays === duration.days}
                      onPress={() => setPollDurationDays(duration.days)}
                    />
                  ))}
                </XStack>
              </YStack>
            </YStack>
          ) : null}

          {composeMode === 'event' ? (
            <YStack gap={12}>
              <Field label="Event title">
                <Input value={eventTitle} onChangeText={setEventTitle} placeholder="Founders meetup" />
              </Field>
              <XStack gap={12} flexWrap="wrap">
                <Field label="Date">
                  <Input value={eventDate} onChangeText={setEventDate} placeholder="YYYY-MM-DD" />
                </Field>
                <Field label="Time">
                  <Input value={eventTime} onChangeText={setEventTime} placeholder="HH:MM" />
                </Field>
              </XStack>
              <Field label="Location (optional)">
                <Input
                  value={eventLocation}
                  onChangeText={setEventLocation}
                  placeholder="Venue, city or online link"
                />
              </Field>
              <ImageUploadField
                label="Cover image (optional)"
                hint="Add a banner attendees will see on the event."
                value={eventCover}
                onChange={setEventCover}
              />
              <XStack gap={10} alignItems="center">
                <Switch checked={eventRsvp} onCheckedChange={setEventRsvp} />
                <Text fontSize={14} color={communityUi.text}>
                  Allow RSVPs
                </Text>
              </XStack>
            </YStack>
          ) : null}

          {composeMode === 'text' && content.trim() ? (
            <YStack padding={12} borderRadius={8} backgroundColor={communityUi.pageBg} gap={8}>
              <PostContentText content={content} collapsible={false} />
            </YStack>
          ) : null}

          {composeMode === 'text' && imageUrl ? (
            <YStack borderRadius={8} overflow="hidden" backgroundColor={communityUi.pageBg}>
              {isGifUrl(imageUrl) ? (
                // eslint-disable-next-line jsx-a11y/alt-text
                <img src={imageUrl} style={{ width: '100%', maxHeight: 280, objectFit: 'contain' }} />
              ) : null}
            </YStack>
          ) : null}
        </YStack>

        <XStack
          padding={16}
          borderTopWidth={1}
          borderTopColor={communityUi.borderLight}
          alignItems="center"
          justifyContent="space-between"
          flexWrap="wrap"
          gap={12}
        >
          <XStack gap={16} alignItems="center">
            {composeMode === 'text' ? (
              <XStack gap={6} alignItems="center" cursor="pointer" onPress={() => setGifOpen(true)}>
                <Icons.Film size={20} color="#7fc15e" />
              </XStack>
            ) : null}
          </XStack>
          <Button
            backgroundColor={canPost ? communityUi.brand : communityUi.border}
            color={canPost ? 'white' : communityUi.textMuted}
            borderRadius={999}
            paddingHorizontal="$5"
            disabled={!canPost || isPosting}
            onPress={handlePost}
            icon={isPosting ? <Spinner size="small" color="white" /> : undefined}
          >
            {isPosting ? 'Posting…' : 'Post'}
          </Button>
        </XStack>
      </CommunityCard>

      <GifPicker open={gifOpen} onOpenChange={setGifOpen} onSelect={form.fields.imageUrl.setValue} />
    </>
  )
}

function ModeChip({
  icon: Icon,
  label,
  active,
  onPress,
}: {
  icon: typeof Icons.FileText
  label: string
  active: boolean
  onPress: () => void
}) {
  const communityUi = useCommunityUi()
  return (
    <XStack
      gap={6}
      alignItems="center"
      paddingHorizontal={12}
      paddingVertical={7}
      borderRadius={999}
      borderWidth={1}
      borderColor={active ? communityUi.brand : communityUi.border}
      backgroundColor={active ? 'rgba(10,102,194,0.08)' : communityUi.cardBg}
      cursor="pointer"
      onPress={onPress}
    >
      <Icon size={16} color={active ? communityUi.brand : communityUi.textMuted} />
      <Text fontSize={13} fontWeight="600" color={active ? communityUi.brand : communityUi.textMuted}>
        {label}
      </Text>
    </XStack>
  )
}

function ContextChip({
  label,
  active,
  onPress,
}: {
  label: string
  active: boolean
  onPress: () => void
}) {
  const communityUi = useCommunityUi()
  return (
    <XStack
      paddingHorizontal={10}
      paddingVertical={5}
      borderRadius={999}
      borderWidth={1}
      borderColor={active ? communityUi.brand : communityUi.border}
      backgroundColor={active ? 'rgba(10,102,194,0.08)' : communityUi.cardBg}
      cursor="pointer"
      onPress={onPress}
    >
      <Text fontSize={12} fontWeight="600" color={active ? communityUi.brand : communityUi.textMuted}>
        {label}
      </Text>
    </XStack>
  )
}
