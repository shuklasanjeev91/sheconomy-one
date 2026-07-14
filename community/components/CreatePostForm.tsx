import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'one'

import { CommunityAdaptiveSheet } from '~/community/components/CommunityAdaptiveSheet'
import { GifPicker } from '~/community/components/GifPicker'
import { CommunityCard } from '~/community/components/CommunityCard'
import { MentionInput } from '~/community/components/MentionInput'
import { PostLinkPreviewCard } from '~/community/components/PostLinkPreviewCard'
import { createCommunityPost, type PostLinkPreview } from '~/community/lib/community'
import { extractFirstUrl, fetchLinkPreview } from '~/lib/link-preview'
import { fetchMyCompanies } from '~/community/lib/companies'
import { fetchMyGroups } from '~/community/lib/groups'
import { fetchSellerListings, type SellerListingRow } from '~/commerce/lib/seller-dashboard'
import { useVendorShops, type VendorShop } from '~/hooks/useVendorShops'
import { isGifUrl } from '~/community/lib/giphy'
import { useCommunityUi } from '~/community/lib/community-theme'
import {
  Avatar,
  Button,
  DateTimeField,
  Field,
  Icons,
  Image,
  Input,
  Spinner,
  Switch,
  Text,
  XStack,
  YStack,
  useAppToast,
} from '~/components/ui'
import { ImageUploadField, preparePickedImagesForUpload } from '~/components/media/ImageUploadField'
import { useFormValidation } from '~/hooks/useFormValidation'
import { useQueryParam } from '~/hooks/useQueryParams'
import { useProfile } from '~/hooks/useProfile'
import { pickImages, releasePickedImage, type PickedImage } from '~/lib/media/pick-image'
import { communityRoutes, routes } from '~/lib/routes'
import { uploadEventCoverImage, uploadPostImages } from '~/lib/supabase/storage-upload'
import { maxLength, optionalUrl } from '~/lib/validation'

const MAX_POST_LENGTH = 3000
const MAX_POLL_OPTIONS = 4
const MAX_PHOTOS = 9
const POLL_DURATIONS = [
  { label: '1 day', days: 1 },
  { label: '3 days', days: 3 },
  { label: '1 week', days: 7 },
]
const QUICK_EMOJIS = ['😀', '😂', '😍', '🎉', '🙌', '🔥', '👏', '💯', '❤️', '🚀', '✨', '🙏']

const CELEBRATION_OCCASIONS: {
  value: string
  label: string
  emoji: string
  placeholder: string
}[] = [
  { value: 'new_job', label: 'New position', emoji: '💼', placeholder: 'e.g. Senior Designer at Acme' },
  { value: 'work_anniversary', label: 'Work anniversary', emoji: '🎊', placeholder: 'e.g. 3 years at Acme' },
  { value: 'education', label: 'Certification', emoji: '🎓', placeholder: 'e.g. Certified Product Manager' },
  { value: 'award', label: 'Award', emoji: '🏆', placeholder: 'e.g. Employee of the Year' },
  { value: 'launch', label: 'Launch', emoji: '🚀', placeholder: 'e.g. Launched my new shop' },
  { value: 'milestone', label: 'Milestone', emoji: '📈', placeholder: 'e.g. Crossed 1,000 customers' },
  { value: 'welcome', label: 'Welcome', emoji: '👋', placeholder: 'e.g. Welcome Priya to the team' },
]

type Visibility = 'public' | 'connections'
const AUDIENCE: Record<Visibility, { label: string; description: string; icon: typeof Icons.Globe }> = {
  public: { label: 'Anyone', description: 'Anyone on and off the platform', icon: Icons.Globe },
  connections: { label: 'Connections only', description: 'Only your connections', icon: Icons.Users },
}

type PostContext = 'profile' | 'company' | 'group'
type ComposeMode = 'text' | 'poll' | 'event' | 'celebration' | 'product' | 'shop'

type CreatePostFormProps = {
  onSuccess?: () => void
  initialGroupId?: string
  initialCompanyId?: string
  initialMode?: ComposeMode
  /** Pre-fill a GIF url as media on mount. */
  initialGifUrl?: string
  /** Open the photo picker automatically on mount. */
  autoPickMedia?: boolean
  /**
   * When true the form is rendered inside an overlay (sheet/dialog): it drops
   * its own card chrome and closes via onSuccess instead of navigating away.
   */
  embedded?: boolean
}

export function CreatePostForm({
  onSuccess,
  initialGroupId,
  initialCompanyId,
  initialMode,
  initialGifUrl,
  autoPickMedia,
  embedded,
}: CreatePostFormProps) {
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
  const [audienceOpen, setAudienceOpen] = useState(false)
  const [emojiOpen, setEmojiOpen] = useState(false)
  const [visibility, setVisibility] = useState<Visibility>('public')
  const encodedContentRef = useRef('')
  const [postContext, setPostContext] = useState<PostContext>('profile')
  const [companyId, setCompanyId] = useState<string | null>(initialCompanyId ?? null)
  const [groupId, setGroupId] = useState<string | null>(initialGroupId ?? null)
  const [companies, setCompanies] = useState<{ id: string; name: string }[]>([])
  const [groups, setGroups] = useState<{ id: string; title: string }[]>([])
  const [photos, setPhotos] = useState<PickedImage[]>([])
  const [isPicking, setIsPicking] = useState(false)

  const [linkPreview, setLinkPreview] = useState<PostLinkPreview | null>(null)
  const [linkLoading, setLinkLoading] = useState(false)
  const dismissedUrlsRef = useRef<Set<string>>(new Set())
  const previewUrlRef = useRef<string | null>(null)

  const [composeMode, setComposeMode] = useState<ComposeMode>('text')
  const [moreOpen, setMoreOpen] = useState(false)
  const [pollOptions, setPollOptions] = useState<string[]>(['', ''])
  const [pollDurationDays, setPollDurationDays] = useState(1)
  const [eventTitle, setEventTitle] = useState('')
  const [eventDate, setEventDate] = useState('')
  const [eventTime, setEventTime] = useState('')
  const [eventLocation, setEventLocation] = useState('')
  const [eventRsvp, setEventRsvp] = useState(true)
  const [eventCover, setEventCover] = useState<PickedImage[]>([])

  // Celebration
  const [occasion, setOccasion] = useState('new_job')
  const [celebrationTitle, setCelebrationTitle] = useState('')
  const [celebrationCover, setCelebrationCover] = useState<PickedImage[]>([])

  // Product / Shop (seller data)
  const { shops } = useVendorShops()
  const [activeShopId, setActiveShopId] = useState<string | null>(null)
  const [listings, setListings] = useState<SellerListingRow[]>([])
  const [loadingListings, setLoadingListings] = useState(false)
  const [selectedListing, setSelectedListing] = useState<SellerListingRow | null>(null)
  const [selectedShop, setSelectedShop] = useState<VendorShop | null>(null)

  const displayName = profile?.full_name || profile?.username || 'You'
  const content = form.fields.content.value
  const imageUrl = form.fields.imageUrl.value
  const remaining = MAX_POST_LENGTH - content.length
  const isOverLimit = remaining < 0
  const contentError = form.fields.content.showError ? form.fields.content.error : null
  const hasMedia = photos.length > 0 || Boolean(imageUrl.trim())

  // Detect the first URL in a text post and unfurl an Open Graph preview
  // (LinkedIn-style), debounced. Skipped once the user removes a preview or
  // adds their own media/GIF.
  useEffect(() => {
    if (composeMode !== 'text' || hasMedia) {
      setLinkPreview(null)
      setLinkLoading(false)
      previewUrlRef.current = null
      return
    }
    const url = extractFirstUrl(content)
    if (!url) {
      setLinkPreview(null)
      setLinkLoading(false)
      previewUrlRef.current = null
      return
    }
    if (dismissedUrlsRef.current.has(url)) {
      setLinkPreview(null)
      setLinkLoading(false)
      return
    }
    if (url === previewUrlRef.current) return

    let cancelled = false
    setLinkLoading(true)
    const handle = setTimeout(() => {
      void fetchLinkPreview(url).then((result) => {
        if (cancelled) return
        previewUrlRef.current = url
        setLinkPreview(result)
        setLinkLoading(false)
      })
    }, 600)
    return () => {
      cancelled = true
      clearTimeout(handle)
    }
  }, [content, composeMode, hasMedia])

  const filledPollOptions = pollOptions.map((option) => option.trim()).filter(Boolean)
  const canPost =
    composeMode === 'poll'
      ? content.trim().length > 0 && filledPollOptions.length >= 2 && !isOverLimit
      : composeMode === 'event'
        ? eventTitle.trim().length > 0 && eventDate.trim().length > 0 && eventTime.trim().length > 0
        : composeMode === 'celebration'
          ? celebrationTitle.trim().length > 0 && !isOverLimit
          : composeMode === 'product'
            ? !!selectedListing
            : composeMode === 'shop'
              ? !!selectedShop
              : (Boolean(content.trim()) || hasMedia) && !isOverLimit && form.fields.imageUrl.isValid

  const pickPhotos = useCallback(async () => {
    if (isPicking || photos.length >= MAX_PHOTOS) return
    setIsPicking(true)
    try {
      const picked = await pickImages({ multiple: true, maxCount: MAX_PHOTOS - photos.length })
      if (picked.length) {
        form.fields.imageUrl.setValue('')
        setPhotos((current) => [...current, ...picked].slice(0, MAX_PHOTOS))
      }
    } catch (error) {
      toast.show('Could not add photo', {
        tone: 'danger',
        message: error instanceof Error ? error.message : 'Try again.',
      })
    } finally {
      setIsPicking(false)
    }
  }, [form.fields.imageUrl, isPicking, photos.length, toast])

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
    if (composeParam === 'media') void pickPhotos()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyParam, composeParam, gifParam, groupParam])

  // Apply overlay/sheet options once on mount (takes precedence over query params).
  const initializedRef = useRef(false)
  useEffect(() => {
    if (initializedRef.current) return
    initializedRef.current = true
    if (
      initialMode === 'poll' ||
      initialMode === 'event' ||
      initialMode === 'celebration' ||
      initialMode === 'product' ||
      initialMode === 'shop'
    ) {
      setComposeMode(initialMode)
    }
    if (initialGifUrl) form.fields.imageUrl.setValue(initialGifUrl)
    if (autoPickMedia) void pickPhotos()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!user) return
    fetchMyCompanies(user.id).then((rows) => setCompanies(rows.map((c) => ({ id: c.id, name: c.name }))))
    fetchMyGroups(user.id).then((rows) => setGroups(rows.map((g) => ({ id: g.id, title: g.title }))))
  }, [user])

  // Default the product picker to the first shop once shops load.
  useEffect(() => {
    if (!activeShopId && shops.length) setActiveShopId(shops[0].id)
  }, [activeShopId, shops])

  // Load listings for the active shop when composing a product post.
  useEffect(() => {
    if (composeMode !== 'product' || !activeShopId) return
    let cancelled = false
    setLoadingListings(true)
    fetchSellerListings(activeShopId, { status: 'active', limit: 50 })
      .then((rows) => {
        if (!cancelled) setListings(rows)
      })
      .finally(() => {
        if (!cancelled) setLoadingListings(false)
      })
    return () => {
      cancelled = true
    }
  }, [activeShopId, composeMode])

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

  function removePhoto(index: number) {
    setPhotos((current) => {
      const target = current[index]
      if (target) releasePickedImage(target)
      return current.filter((_, i) => i !== index)
    })
  }

  function insertEmoji(emoji: string) {
    form.fields.content.onChange(`${content}${emoji}`)
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
        visibility,
        companyId: targetCompanyId,
        groupId: targetGroupId,
        poll: { question: content, options: pollOptions, durationDays: pollDurationDays },
      })
    } else if (composeMode === 'celebration') {
      const occasionMeta = CELEBRATION_OCCASIONS.find((o) => o.value === occasion)
      let celebrationImageUrl: string | null = null
      if (celebrationCover[0]) {
        const files = await preparePickedImagesForUpload(celebrationCover)
        const { urls, error: uploadError } = await uploadPostImages(user.id, files)
        if (uploadError) {
          setIsPosting(false)
          toast.show('Could not upload photo', { tone: 'danger', message: uploadError })
          return
        }
        celebrationImageUrl = urls[0] ?? null
      }
      result = await createCommunityPost(user.id, {
        content: finalContent,
        visibility,
        companyId: targetCompanyId,
        groupId: targetGroupId,
        celebration: {
          occasion,
          title: celebrationTitle.trim(),
          subtitle: occasionMeta?.label ?? null,
          imageUrl: celebrationImageUrl,
        },
      })
    } else if (composeMode === 'product' && selectedListing) {
      const shopForListing = shops.find((s) => s.id === activeShopId) ?? null
      result = await createCommunityPost(user.id, {
        content: finalContent,
        visibility,
        companyId: targetCompanyId,
        groupId: targetGroupId,
        product: {
          listingId: selectedListing.id,
          title: selectedListing.title,
          price: selectedListing.price,
          currency: shopForListing?.shop_currency ?? null,
          imageUrl: selectedListing.primaryImageUrl,
          slug: selectedListing.slug,
          shopName: shopForListing?.shop_name ?? null,
        },
      })
    } else if (composeMode === 'shop' && selectedShop) {
      result = await createCommunityPost(user.id, {
        content: finalContent,
        visibility,
        companyId: targetCompanyId,
        groupId: targetGroupId,
        shop: {
          shopId: selectedShop.id,
          name: selectedShop.shop_name,
          logoUrl: selectedShop.logo_url,
          slug: selectedShop.slug,
          description: selectedShop.shop_description,
        },
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
        visibility,
        companyId: targetCompanyId,
        groupId: targetGroupId,
        eventTitle: eventTitle.trim(),
        eventDescription: finalContent.trim() || null,
        eventStartTime: startIso,
        eventLocation: eventLocation.trim() || null,
        eventRsvpEnabled: eventRsvp,
      })
    } else {
      let mediaUrls: string[] = []
      if (photos.length) {
        const files = await preparePickedImagesForUpload(photos)
        const { urls, error: uploadError } = await uploadPostImages(user.id, files)
        if (uploadError) {
          setIsPosting(false)
          toast.show('Could not upload photos', {
            tone: 'danger',
            message: uploadError,
          })
          return
        }
        mediaUrls = urls
      }

      const finalImageUrl = mediaUrls.length ? null : imageUrl || null
      result = await createCommunityPost(user.id, {
        content: finalContent,
        imageUrl: finalImageUrl,
        mediaUrls: mediaUrls.length ? mediaUrls : null,
        visibility,
        companyId: targetCompanyId,
        groupId: targetGroupId,
        linkPreview: mediaUrls.length || finalImageUrl ? null : linkPreview,
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
    setCelebrationTitle('')
    setOccasion('new_job')
    setCelebrationCover([])
    setSelectedListing(null)
    setSelectedShop(null)
    setComposeMode('text')
    setLinkPreview(null)
    setLinkLoading(false)
    dismissedUrlsRef.current.clear()
    previewUrlRef.current = null
    photos.forEach(releasePickedImage)
    setPhotos([])
    onSuccess?.()
    // Overlay usage closes via onSuccess; the standalone route navigates home.
    if (!embedded) router.replace(communityRoutes.home)
  }

  const contentPlaceholder =
    composeMode === 'poll'
      ? 'What do you want to ask?'
      : composeMode === 'event'
        ? 'Add details attendees should know'
        : composeMode === 'celebration'
          ? 'Say a few words about this moment…'
          : composeMode === 'product'
            ? 'Tell people why they should check this out…'
            : composeMode === 'shop'
              ? 'Share what makes your shop special…'
              : 'What do you want to talk about?'

  const audience = AUDIENCE[visibility]
  const Container = embedded ? YStack : CommunityCard

  return (
    <>
      <Container gap={0}>
        {/* Author + audience */}
        <XStack padding={16} gap={12} alignItems="center">
          <Avatar name={displayName} src={profile?.avatar_url ?? undefined} size="$5" />
          <YStack gap={4} flex={1}>
            <Text fontSize={16} fontWeight="700" color={communityUi.text}>
              {displayName}
            </Text>
            <XStack
              alignSelf="flex-start"
              alignItems="center"
              gap={6}
              paddingHorizontal={10}
              paddingVertical={5}
              borderRadius={999}
              borderWidth={1}
              borderColor={communityUi.border}
              cursor="pointer"
              hoverStyle={{ backgroundColor: communityUi.hoverBg }}
              onPress={() => setAudienceOpen(true)}
            >
              <audience.icon size={14} color={communityUi.textMuted} />
              <Text fontSize={12} fontWeight="700" color={communityUi.textMuted}>
                {audience.label}
              </Text>
              <Icons.ChevronDown size={14} color={communityUi.textMuted} />
            </XStack>
          </YStack>
        </XStack>

        {/* Post-as context (page / group) */}
        {companies.length > 0 || groups.length > 0 ? (
          <XStack paddingHorizontal={16} paddingBottom={12} gap={8} flexWrap="wrap">
            <ContextChip label="You" active={postContext === 'profile'} onPress={() => setPostContext('profile')} />
            {companies.length > 0
              ? companies.map((company) => (
                  <ContextChip
                    key={company.id}
                    label={company.name}
                    active={postContext === 'company' && companyId === company.id}
                    onPress={() => {
                      setPostContext('company')
                      setCompanyId(company.id)
                    }}
                  />
                ))
              : null}
            {groups.length > 0
              ? groups.map((group) => (
                  <ContextChip
                    key={group.id}
                    label={group.title}
                    active={postContext === 'group' && groupId === group.id}
                    onPress={() => {
                      setPostContext('group')
                      setGroupId(group.id)
                    }}
                  />
                ))
              : null}
          </XStack>
        ) : null}

        {/* Compose body */}
        <YStack paddingHorizontal={16} paddingBottom={12} gap={12}>
          <MentionInput
            multiline
            value={content}
            onChangeText={(value) => form.fields.content.onChange(value.slice(0, MAX_POST_LENGTH + 50))}
            onEncodedChange={(encoded) => {
              encodedContentRef.current = encoded
            }}
            invalid={!!contentError}
            placeholder={contentPlaceholder}
            minHeight={composeMode === 'text' ? 150 : 96}
            fontSize={18}
            lineHeight={26}
            borderWidth={0}
            backgroundColor="transparent"
            padding={0}
          />

          {contentError ? (
            <Text fontSize={12} color="#cc1010">
              {contentError}
            </Text>
          ) : null}

          {/* Quick emoji row */}
          {emojiOpen ? (
            <XStack gap={6} flexWrap="wrap" paddingVertical={4}>
              {QUICK_EMOJIS.map((emoji) => (
                <XStack
                  key={emoji}
                  width={38}
                  height={38}
                  alignItems="center"
                  justifyContent="center"
                  borderRadius={999}
                  cursor="pointer"
                  hoverStyle={{ backgroundColor: communityUi.hoverBg }}
                  onPress={() => insertEmoji(emoji)}
                >
                  <Text fontSize={22}>{emoji}</Text>
                </XStack>
              ))}
            </XStack>
          ) : null}

          {/* Photo previews */}
          {composeMode === 'text' && photos.length > 0 ? (
            <XStack gap={8} flexWrap="wrap">
              {photos.map((photo, index) => (
                <YStack
                  key={`${photo.uri}-${index}`}
                  width={photos.length === 1 ? '100%' : 120}
                  height={photos.length === 1 ? 260 : 120}
                  borderRadius={12}
                  overflow="hidden"
                  borderWidth={1}
                  borderColor={communityUi.border}
                  backgroundColor={communityUi.pageBg}
                  position="relative"
                >
                  <Image src={photo.uri} width="100%" height="100%" objectFit="cover" alt="" />
                  <YStack
                    position="absolute"
                    top={6}
                    right={6}
                    width={28}
                    height={28}
                    borderRadius={999}
                    alignItems="center"
                    justifyContent="center"
                    backgroundColor="rgba(0,0,0,0.6)"
                    cursor="pointer"
                    aria-label="Remove photo"
                    onPress={() => removePhoto(index)}
                  >
                    <Icons.X size={16} color="white" />
                  </YStack>
                </YStack>
              ))}
              {photos.length < MAX_PHOTOS ? (
                <YStack
                  width={120}
                  height={120}
                  borderRadius={12}
                  borderWidth={1}
                  borderColor={communityUi.border}
                  borderStyle="dashed"
                  alignItems="center"
                  justifyContent="center"
                  cursor="pointer"
                  hoverStyle={{ backgroundColor: communityUi.hoverBg }}
                  onPress={() => void pickPhotos()}
                >
                  {isPicking ? (
                    <Spinner size="small" color={communityUi.brand} />
                  ) : (
                    <Icons.Plus size={24} color={communityUi.textMuted} />
                  )}
                </YStack>
              ) : null}
            </XStack>
          ) : null}

          {/* GIF preview */}
          {composeMode === 'text' && imageUrl && isGifUrl(imageUrl) ? (
            <YStack
              borderRadius={12}
              overflow="hidden"
              backgroundColor={communityUi.pageBg}
              position="relative"
            >
              {/* eslint-disable-next-line jsx-a11y/alt-text */}
              <img src={imageUrl} style={{ width: '100%', maxHeight: 320, objectFit: 'contain' }} />
              <YStack
                position="absolute"
                top={8}
                right={8}
                width={30}
                height={30}
                borderRadius={999}
                alignItems="center"
                justifyContent="center"
                backgroundColor="rgba(0,0,0,0.6)"
                cursor="pointer"
                aria-label="Remove GIF"
                onPress={() => form.fields.imageUrl.setValue('')}
              >
                <Icons.X size={16} color="white" />
              </YStack>
            </YStack>
          ) : null}

          {/* Link preview (LinkedIn-style URL unfurl) */}
          {composeMode === 'text' && !hasMedia && (linkLoading || linkPreview) ? (
            <PostLinkPreviewCard
              preview={linkPreview}
              loading={linkLoading}
              onRemove={() => {
                const url = linkPreview?.url ?? extractFirstUrl(content)
                if (url) dismissedUrlsRef.current.add(url)
                previewUrlRef.current = null
                setLinkPreview(null)
                setLinkLoading(false)
              }}
            />
          ) : null}

          {/* Poll editor */}
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
                <XStack gap={6} alignItems="center" cursor="pointer" alignSelf="flex-start" onPress={addPollOption}>
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

          {/* Event editor */}
          {composeMode === 'event' ? (
            <YStack gap={12}>
              <Field label="Event title">
                <Input value={eventTitle} onChangeText={setEventTitle} placeholder="Founders meetup" />
              </Field>
              <XStack gap={12} flexWrap="wrap">
                <DateTimeField
                  mode="date"
                  label="Date"
                  minDate={new Date()}
                  value={eventDate}
                  onChange={setEventDate}
                  flex={1}
                  minWidth={150}
                />
                <DateTimeField
                  mode="time"
                  label="Time"
                  value={eventTime}
                  onChange={setEventTime}
                  flex={1}
                  minWidth={150}
                />
              </XStack>
              <Field label="Location (optional)">
                <Input value={eventLocation} onChangeText={setEventLocation} placeholder="Venue, city or online link" />
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

          {/* Celebration editor */}
          {composeMode === 'celebration' ? (
            <YStack gap={12}>
              <Text fontSize={13} fontWeight="600" color={communityUi.textMuted}>
                What are you celebrating?
              </Text>
              <XStack gap={8} flexWrap="wrap">
                {CELEBRATION_OCCASIONS.map((item) => (
                  <ContextChip
                    key={item.value}
                    label={`${item.emoji} ${item.label}`}
                    active={occasion === item.value}
                    onPress={() => setOccasion(item.value)}
                  />
                ))}
              </XStack>
              <Field label="Add a headline">
                <Input
                  value={celebrationTitle}
                  onChangeText={setCelebrationTitle}
                  placeholder={
                    CELEBRATION_OCCASIONS.find((o) => o.value === occasion)?.placeholder ?? 'Share the news'
                  }
                  maxLength={120}
                />
              </Field>
              <ImageUploadField
                label="Photo (optional)"
                hint="Add a photo to make your celebration stand out."
                value={celebrationCover}
                onChange={setCelebrationCover}
              />
            </YStack>
          ) : null}

          {/* Product picker */}
          {composeMode === 'product' ? (
            <YStack gap={10}>
              {shops.length > 1 ? (
                <XStack gap={8} flexWrap="wrap">
                  {shops.map((shopItem) => (
                    <ContextChip
                      key={shopItem.id}
                      label={shopItem.shop_name}
                      active={activeShopId === shopItem.id}
                      onPress={() => {
                        setActiveShopId(shopItem.id)
                        setSelectedListing(null)
                      }}
                    />
                  ))}
                </XStack>
              ) : null}

              {shops.length === 0 ? (
                <EmptyPickerHint
                  icon={Icons.ShoppingBag}
                  message="You don't have a shop yet. Create a shop to share products."
                />
              ) : loadingListings ? (
                <XStack paddingVertical={16} justifyContent="center">
                  <Spinner size="small" color={communityUi.brand} />
                </XStack>
              ) : listings.length === 0 ? (
                <EmptyPickerHint icon={Icons.Package} message="No active listings in this shop yet." />
              ) : (
                <YStack gap={8} maxHeight={320} overflow="scroll">
                  {listings.map((listing) => (
                    <PickerRow
                      key={listing.id}
                      title={listing.title}
                      subtitle={formatListingPrice(
                        listing.price,
                        shops.find((s) => s.id === activeShopId)?.shop_currency ?? null,
                      )}
                      imageUrl={listing.primaryImageUrl}
                      fallbackIcon={Icons.Package}
                      selected={selectedListing?.id === listing.id}
                      onPress={() =>
                        setSelectedListing((current) => (current?.id === listing.id ? null : listing))
                      }
                    />
                  ))}
                </YStack>
              )}
            </YStack>
          ) : null}

          {/* Shop picker */}
          {composeMode === 'shop' ? (
            <YStack gap={8}>
              {shops.length === 0 ? (
                <EmptyPickerHint
                  icon={Icons.Store}
                  message="You don't have a shop yet. Create one to promote it here."
                />
              ) : (
                <YStack gap={8} maxHeight={320} overflow="scroll">
                  {shops.map((shopItem) => (
                    <PickerRow
                      key={shopItem.id}
                      title={shopItem.shop_name}
                      subtitle={shopItem.shop_description ?? 'Your shop'}
                      imageUrl={shopItem.logo_url}
                      fallbackIcon={Icons.Store}
                      selected={selectedShop?.id === shopItem.id}
                      onPress={() =>
                        setSelectedShop((current) => (current?.id === shopItem.id ? null : shopItem))
                      }
                    />
                  ))}
                </YStack>
              )}
            </YStack>
          ) : null}

          <XStack justifyContent="flex-end">
            <Text fontSize={12} color={isOverLimit ? '#cc1010' : communityUi.textMuted}>
              {remaining}
            </Text>
          </XStack>
        </YStack>

        {/* Toolbar */}
        <XStack
          paddingHorizontal={12}
          paddingVertical={10}
          borderTopWidth={1}
          borderTopColor={communityUi.borderLight}
          alignItems="center"
          justifyContent="space-between"
          gap={8}
        >
          <XStack gap={2} alignItems="center" flex={1} flexWrap="wrap">
            <ToolbarButton
              icon={Icons.Image}
              color="#4a9cff"
              label="Photo"
              active={photos.length > 0}
              onPress={() => {
                setComposeMode('text')
                void pickPhotos()
              }}
            />
            <ToolbarButton
              icon={Icons.Film}
              color="#7fc15e"
              label="GIF"
              active={!!imageUrl && isGifUrl(imageUrl)}
              onPress={() => {
                setComposeMode('text')
                setGifOpen(true)
              }}
            />
            <ToolbarButton
              icon={Icons.BarChart2}
              color="#c37dda"
              label="Poll"
              active={composeMode === 'poll'}
              onPress={() => setComposeMode(composeMode === 'poll' ? 'text' : 'poll')}
            />
            <ToolbarButton
              icon={Icons.Calendar}
              color="#e7a33e"
              label="Event"
              active={composeMode === 'event'}
              onPress={() => setComposeMode(composeMode === 'event' ? 'text' : 'event')}
            />
            <ToolbarButton
              icon={Icons.Smile}
              color="#f5a623"
              label="Emoji"
              active={emojiOpen}
              onPress={() => setEmojiOpen((v) => !v)}
            />
            <ToolbarButton
              icon={Icons.MoreHorizontal}
              color={communityUi.textMuted}
              label="More"
              active={composeMode === 'celebration' || composeMode === 'product' || composeMode === 'shop'}
              onPress={() => setMoreOpen(true)}
            />
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
      </Container>

      <GifPicker open={gifOpen} onOpenChange={setGifOpen} onSelect={form.fields.imageUrl.setValue} />

      <CommunityAdaptiveSheet open={moreOpen} onOpenChange={setMoreOpen} title="Create">
        <YStack gap={4}>
          <MoreOptionRow
            icon={Icons.PartyPopper}
            tint="#c37dda"
            title="Celebrate an occasion"
            description="New job, work anniversary, launch and more"
            onPress={() => {
              setComposeMode('celebration')
              setMoreOpen(false)
            }}
          />
          <MoreOptionRow
            icon={Icons.Tag}
            tint="#0a66c2"
            title="Share a product"
            description="Feature a listing from your shop"
            onPress={() => {
              setComposeMode('product')
              setMoreOpen(false)
            }}
          />
          <MoreOptionRow
            icon={Icons.Store}
            tint="#059669"
            title="Promote your shop"
            description="Invite people to visit your shop"
            onPress={() => {
              setComposeMode('shop')
              setMoreOpen(false)
            }}
          />
          <MoreOptionRow
            icon={Icons.BarChart2}
            tint="#e7a33e"
            title="Create a poll"
            description="Ask your network a question"
            onPress={() => {
              setComposeMode('poll')
              setMoreOpen(false)
            }}
          />
          <MoreOptionRow
            icon={Icons.Calendar}
            tint="#e7a33e"
            title="Create an event"
            description="Share a meetup or webinar"
            onPress={() => {
              setComposeMode('event')
              setMoreOpen(false)
            }}
          />
        </YStack>
      </CommunityAdaptiveSheet>

      <CommunityAdaptiveSheet open={audienceOpen} onOpenChange={setAudienceOpen} title="Who can see your post?">
        <YStack gap={4}>
          {(Object.keys(AUDIENCE) as Visibility[]).map((key) => {
            const item = AUDIENCE[key]
            const selected = visibility === key
            return (
              <XStack
                key={key}
                alignItems="center"
                gap={12}
                paddingVertical={12}
                paddingHorizontal={6}
                borderRadius={12}
                cursor="pointer"
                hoverStyle={{ backgroundColor: communityUi.hoverBg }}
                onPress={() => {
                  setVisibility(key)
                  setAudienceOpen(false)
                }}
              >
                <XStack
                  width={40}
                  height={40}
                  borderRadius={999}
                  alignItems="center"
                  justifyContent="center"
                  backgroundColor={communityUi.accentMuted}
                >
                  <item.icon size={20} color={communityUi.brand} />
                </XStack>
                <YStack flex={1} gap={2}>
                  <Text fontSize={15} fontWeight="700" color={communityUi.text}>
                    {item.label}
                  </Text>
                  <Text fontSize={12} color={communityUi.textMuted}>
                    {item.description}
                  </Text>
                </YStack>
                {selected ? <Icons.Check size={20} color={communityUi.brand} /> : null}
              </XStack>
            )
          })}
        </YStack>
      </CommunityAdaptiveSheet>
    </>
  )
}

function ToolbarButton({
  icon: Icon,
  color,
  label,
  active,
  onPress,
}: {
  icon: typeof Icons.Image
  color: string
  label: string
  active?: boolean
  onPress: () => void
}) {
  const communityUi = useCommunityUi()
  return (
    <XStack
      gap={6}
      alignItems="center"
      paddingHorizontal={10}
      paddingVertical={8}
      borderRadius={999}
      cursor="pointer"
      backgroundColor={active ? communityUi.accentMuted : 'transparent'}
      hoverStyle={{ backgroundColor: active ? communityUi.accentMuted : communityUi.hoverBg }}
      pressStyle={{ opacity: 0.75 }}
      animation="quick"
      onPress={onPress}
    >
      <Icon size={20} color={color} />
      <Text fontSize={13} fontWeight="600" color={communityUi.textMuted} display="none" $gtSm={{ display: 'flex' }}>
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
      paddingHorizontal={12}
      paddingVertical={6}
      borderRadius={999}
      borderWidth={1}
      borderColor={active ? communityUi.brand : communityUi.border}
      backgroundColor={active ? communityUi.accentMuted : communityUi.cardBg}
      cursor="pointer"
      onPress={onPress}
    >
      <Text fontSize={12} fontWeight="600" color={active ? communityUi.brand : communityUi.textMuted}>
        {label}
      </Text>
    </XStack>
  )
}

function formatListingPrice(price: number | null, currency: string | null) {
  if (price == null) return 'Free'
  try {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: currency || 'INR',
      maximumFractionDigits: 0,
    }).format(price)
  } catch {
    return `${currency ?? '₹'}${price}`
  }
}

function MoreOptionRow({
  icon: Icon,
  tint,
  title,
  description,
  onPress,
}: {
  icon: typeof Icons.Tag
  tint: string
  title: string
  description: string
  onPress: () => void
}) {
  const communityUi = useCommunityUi()
  return (
    <XStack
      alignItems="center"
      gap={12}
      paddingVertical={12}
      paddingHorizontal={6}
      borderRadius={12}
      cursor="pointer"
      hoverStyle={{ backgroundColor: communityUi.hoverBg }}
      onPress={onPress}
    >
      <XStack
        width={40}
        height={40}
        borderRadius={999}
        alignItems="center"
        justifyContent="center"
        backgroundColor={`${tint}1A`}
      >
        <Icon size={20} color={tint} />
      </XStack>
      <YStack flex={1} gap={2}>
        <Text fontSize={15} fontWeight="700" color={communityUi.text}>
          {title}
        </Text>
        <Text fontSize={12} color={communityUi.textMuted}>
          {description}
        </Text>
      </YStack>
    </XStack>
  )
}

function EmptyPickerHint({ icon: Icon, message }: { icon: typeof Icons.Store; message: string }) {
  const communityUi = useCommunityUi()
  return (
    <XStack
      gap={10}
      alignItems="center"
      padding={14}
      borderRadius={12}
      borderWidth={1}
      borderColor={communityUi.border}
      backgroundColor={communityUi.pageBg}
    >
      <Icon size={20} color={communityUi.textMuted} />
      <Text fontSize={13} color={communityUi.textMuted} flex={1}>
        {message}
      </Text>
    </XStack>
  )
}

function PickerRow({
  title,
  subtitle,
  imageUrl,
  fallbackIcon: FallbackIcon,
  selected,
  onPress,
}: {
  title: string
  subtitle?: string
  imageUrl?: string | null
  fallbackIcon: typeof Icons.Package
  selected: boolean
  onPress: () => void
}) {
  const communityUi = useCommunityUi()
  return (
    <XStack
      alignItems="center"
      gap={12}
      padding={8}
      borderRadius={12}
      borderWidth={1}
      borderColor={selected ? communityUi.brand : communityUi.border}
      backgroundColor={selected ? communityUi.accentMuted : communityUi.cardBg}
      cursor="pointer"
      hoverStyle={{ backgroundColor: communityUi.hoverBg }}
      onPress={onPress}
    >
      <YStack
        width={48}
        height={48}
        borderRadius={8}
        overflow="hidden"
        backgroundColor={communityUi.pageBg}
        alignItems="center"
        justifyContent="center"
      >
        {imageUrl ? (
          <Image src={imageUrl} width={48} height={48} objectFit="cover" alt="" />
        ) : (
          <FallbackIcon size={20} color={communityUi.textMuted} />
        )}
      </YStack>
      <YStack flex={1} gap={2} minWidth={0}>
        <Text fontSize={14} fontWeight="600" color={communityUi.text} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text fontSize={12} color={communityUi.textMuted} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </YStack>
      {selected ? <Icons.Check size={20} color={communityUi.brand} /> : null}
    </XStack>
  )
}
