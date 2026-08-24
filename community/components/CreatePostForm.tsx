import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Platform, useWindowDimensions } from 'react-native'
import { useRouter } from 'one'

import { CommunityAdaptiveSheet } from '~/community/components/CommunityAdaptiveSheet'
import { ProductAttachPickerPanel } from '~/community/components/ProductAttachPickerPanel'
import { GifPicker } from '~/community/components/GifPicker'
import { EmojiPickerSheet } from '~/components/emoji/EmojiPickerSheet'
import { CommunityCard } from '~/community/components/CommunityCard'
import { MentionInput } from '~/community/components/MentionInput'
import { PostComposeAiBar } from '~/community/components/PostComposeAiBar'
import { PostLinkPreviewCard } from '~/community/components/PostLinkPreviewCard'
import {
  createCommunityPost,
  type PostLinkPreview,
  type PostProduct,
} from '~/community/lib/community'
import { createEventAndFeedPost } from '~/community/lib/events'
import {
  clearComposeDraft,
  loadComposeDraft,
  saveComposeDraft,
} from '~/community/lib/compose-draft'
import { extractFirstUrl, fetchLinkPreview } from '~/lib/link-preview'
import { fetchMyCompanies } from '~/community/lib/companies'
import { fetchMyGroups } from '~/community/lib/groups'
import { fetchSellerListings, type SellerListingRow } from '~/commerce/lib/seller-dashboard'
import {
  MAX_ATTACHED_PRODUCTS,
  type ProductPickerTab,
  fetchAttachProductById,
  fetchRecentlyViewedAttachProducts,
  fetchWishlistAttachProducts,
  searchAttachProducts,
  sellerListingToPostProduct,
  togglePostProductAttachment,
} from '~/community/lib/attach-listing-products'
import { trackCommunityPostListingsAttached } from '~/community/lib/community-commerce-analytics'
import { useVendorShops, type VendorShop } from '~/hooks/useVendorShops'
import { useRecentlyViewed } from '~/commerce/lib/recently-viewed'
import { feedback } from '~/lib/platform/feedback'
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
  ScrollView,
  Spinner,
  Switch,
  Text,
  XStack,
  YStack,
  useAppToast,
} from '~/components/ui'
import { ImageUploadField, preparePickedImagesForUpload } from '~/components/media/ImageUploadField'
import { MediaDropZone } from '~/components/media/MediaDropZone'
import { UploadProgressBar } from '~/components/media/UploadProgressBar'
import { NativeVideoFile } from '~/lib/native/NativeMediaPlayers'
import { ScreenSearchField } from '~/components/search'
import { useFormValidation } from '~/hooks/useFormValidation'
import { useQueryParam } from '~/hooks/useQueryParams'
import { useProfile } from '~/hooks/useProfile'
import { pickMedia, pickImages, pickVideos, releasePickedImage, type PickedImage } from '~/lib/media/pick-image'
import { fitImagesForPostCard } from '~/lib/media/fit-post-image'
import { splitPostMediaItems } from '~/lib/media/split-post-media'
import { communityRoutes, routes } from '~/lib/routes'
import { uploadEventCoverImage, uploadPostImages, uploadPostVideos } from '~/lib/supabase/storage-upload'
import { SHEET_SEARCH_MIN_ITEMS, filterBySearchQuery } from '~/lib/search'
import { maxLength, optionalUrl } from '~/lib/validation'

const MAX_POST_LENGTH = 3000
const MAX_ARTICLE_LENGTH = 12000
const MAX_POLL_OPTIONS = 4
const MAX_PHOTOS = 9
const MAX_VIDEOS = 3
const POLL_DURATIONS = [
  { label: '1 day', days: 1 },
  { label: '3 days', days: 3 },
  { label: '1 week', days: 7 },
]
const CELEBRATION_OCCASIONS: {
  value: string
  label: string
  emoji: string
  placeholder: string
}[] = [
  { value: 'birthday', label: 'Birthday', emoji: '🎂', placeholder: 'e.g. Turning 30!' },
  { value: 'marriage_anniversary', label: 'Marriage anniversary', emoji: '💍', placeholder: 'e.g. 5 years together' },
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
type ComposeMode = 'text' | 'poll' | 'event' | 'celebration' | 'product' | 'shop' | 'article'

type CreatePostFormProps = {
  onSuccess?: () => void
  initialGroupId?: string
  initialCompanyId?: string
  initialMode?: ComposeMode
  /** Pre-fill a GIF url as media on mount. */
  initialGifUrl?: string
  /** Open the photo picker automatically on mount. */
  autoPickMedia?: boolean
  /** Open the video picker automatically on mount. */
  autoPickVideo?: boolean
  /** Pre-select celebration occasion. */
  initialOccasion?: string
  /** Pre-fill celebration title. */
  initialCelebrationTitle?: string
  /** Pre-fill post body. */
  initialContent?: string
  /** Prefill product mode with this listing. */
  initialListingId?: string
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
  autoPickVideo,
  initialOccasion,
  initialCelebrationTitle,
  initialContent,
  initialListingId,
  embedded,
}: CreatePostFormProps) {
  const communityUi = useCommunityUi()
  const router = useRouter()
  const toast = useAppToast()
  const { width: windowWidth } = useWindowDimensions()
  const { profile, user, isAuthenticated } = useProfile()
  const form = useFormValidation(
    useMemo(
      () => ({
        content: { validators: [maxLength(MAX_ARTICLE_LENGTH)] },
        imageUrl: { validators: [optionalUrl()] },
      }),
      [],
    ),
  )
  const [isPosting, setIsPosting] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<number | null>(null)
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
  const [videos, setVideos] = useState<PickedImage[]>([])
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
  const [eventEndDate, setEventEndDate] = useState('')
  const [eventEndTime, setEventEndTime] = useState('')
  const [eventLocation, setEventLocation] = useState('')
  const [eventIsOnline, setEventIsOnline] = useState(false)
  const [eventMeetingUrl, setEventMeetingUrl] = useState('')
  const [eventRsvp, setEventRsvp] = useState(true)
  const [eventCover, setEventCover] = useState<PickedImage[]>([])

  // Celebration
  const [occasion, setOccasion] = useState(
    () =>
      (initialOccasion && CELEBRATION_OCCASIONS.some((o) => o.value === initialOccasion)
        ? initialOccasion
        : 'new_job'),
  )
  const [celebrationTitle, setCelebrationTitle] = useState(initialCelebrationTitle ?? '')
  const [celebrationCover, setCelebrationCover] = useState<PickedImage[]>([])
  const [articleTitle, setArticleTitle] = useState('')
  const [articleTags, setArticleTags] = useState('')
  const [articleCover, setArticleCover] = useState<PickedImage[]>([])

  // Product / Shop (seller data)
  const { shops } = useVendorShops()
  const [activeShopId, setActiveShopId] = useState<string | null>(null)
  const [listings, setListings] = useState<SellerListingRow[]>([])
  const [loadingListings, setLoadingListings] = useState(false)
  const [selectedListing, setSelectedListing] = useState<SellerListingRow | null>(null)
  const [selectedShop, setSelectedShop] = useState<VendorShop | null>(null)
  const [listingSearchQuery, setListingSearchQuery] = useState('')
  const [shopSearchQuery, setShopSearchQuery] = useState('')
  const [attachedProducts, setAttachedProducts] = useState<PostProduct[]>([])
  const [productPickerOpen, setProductPickerOpen] = useState(false)
  const [productPickerTab, setProductPickerTab] = useState<ProductPickerTab>('yours')
  const [savedProducts, setSavedProducts] = useState<PostProduct[]>([])
  const [loadingSavedProducts, setLoadingSavedProducts] = useState(false)
  const [recentProducts, setRecentProducts] = useState<PostProduct[]>([])
  const [loadingRecentProducts, setLoadingRecentProducts] = useState(false)
  const recentIds = useRecentlyViewed()
  const [searchProducts, setSearchProducts] = useState<PostProduct[]>([])
  const [loadingSearchProducts, setLoadingSearchProducts] = useState(false)
  const [catalogSearchQuery, setCatalogSearchQuery] = useState('')
  const prefilledListingRef = useRef<string | null>(null)

  const filteredListings = useMemo(
    () => filterBySearchQuery(listings, listingSearchQuery, (listing) => [listing.title]),
    [listings, listingSearchQuery],
  )
  const filteredShops = useMemo(
    () =>
      filterBySearchQuery(shops, shopSearchQuery, (shop) => [
        shop.shop_name,
        shop.shop_description,
      ]),
    [shops, shopSearchQuery],
  )
  const productPickerTabs = useMemo(() => {
    const tabs: Array<[ProductPickerTab, string]> = []
    if (shops.length) tabs.push(['yours', 'Yours'])
    tabs.push(['recent', 'Recent'], ['saved', 'Saved'], ['search', 'Search'])
    return tabs
  }, [shops.length])

  const displayName = profile?.full_name || profile?.username || 'You'
  const content = form.fields.content.value
  const imageUrl = form.fields.imageUrl.value
  const contentLimit = composeMode === 'article' ? MAX_ARTICLE_LENGTH : MAX_POST_LENGTH
  const remaining = contentLimit - content.length
  const isOverLimit = remaining < 0
  const contentError = form.fields.content.showError ? form.fields.content.error : null
  const hasMedia = photos.length > 0 || videos.length > 0 || Boolean(imageUrl.trim())

  // Detect the first URL in a text post and unfurl an Open Graph preview
  // Debounced. Skipped once the user removes a preview or
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
          : composeMode === 'article'
            ? articleTitle.trim().length > 0 && content.trim().length > 0 && !isOverLimit
            : composeMode === 'product'
            ? !!selectedListing
            : composeMode === 'shop'
              ? !!selectedShop
              : (Boolean(content.trim()) || hasMedia || attachedProducts.length > 0) &&
                  !isOverLimit &&
                  form.fields.imageUrl.isValid

  const applyPostMediaItems = useCallback(
    (items: PickedImage[]) => {
      void (async () => {
        const { photos: imageItems, videos: videoItems } = splitPostMediaItems(items)
        if (!imageItems.length && !videoItems.length) return
        form.fields.imageUrl.setValue('')
        // Keep photos and videos together — mixed media posts are supported.
        if (imageItems.length) {
          const fitted = await fitImagesForPostCard(imageItems)
          setPhotos((current) => [...current, ...fitted].slice(0, MAX_PHOTOS))
        }
        if (videoItems.length) {
          setVideos((current) => [...current, ...videoItems].slice(0, MAX_VIDEOS))
        }
      })()
    },
    [form.fields.imageUrl],
  )

  const pickPhotos = useCallback(async () => {
    if (isPicking || photos.length >= MAX_PHOTOS) return
    setIsPicking(true)
    try {
      // LinkedIn/Facebook: no crop step — keep natural aspect, auto-fit to feed size.
      const picked = await pickImages({
        multiple: true,
        maxCount: MAX_PHOTOS - photos.length,
      })
      if (!picked.length) return
      const fitted = await fitImagesForPostCard(picked)
      form.fields.imageUrl.setValue('')
      setPhotos((current) => [...current, ...fitted].slice(0, MAX_PHOTOS))
    } catch (error) {
      toast.show('Could not add photo', {
        tone: 'danger',
        message: error instanceof Error ? error.message : 'Try again.',
      })
    } finally {
      setIsPicking(false)
    }
  }, [form.fields.imageUrl, isPicking, photos.length, toast])

  const pickPostVideos = useCallback(async () => {
    if (isPicking || videos.length >= MAX_VIDEOS) return
    setIsPicking(true)
    try {
      const picked = await pickVideos({ multiple: true, maxCount: MAX_VIDEOS - videos.length })
      if (picked.length) {
        form.fields.imageUrl.setValue('')
        setVideos((current) => [...current, ...picked].slice(0, MAX_VIDEOS))
      }
    } catch (error) {
      toast.show('Could not add video', {
        tone: 'danger',
        message: error instanceof Error ? error.message : 'Try again.',
      })
    } finally {
      setIsPicking(false)
    }
  }, [form.fields.imageUrl, isPicking, toast, videos.length])

  const pickPostMedia = useCallback(async () => {
    if (isPicking) return
    const photoSlots = MAX_PHOTOS - photos.length
    const videoSlots = MAX_VIDEOS - videos.length
    if (photoSlots <= 0 && videoSlots <= 0) return

    setIsPicking(true)
    try {
      const picked = await pickMedia({
        accept: 'media',
        multiple: true,
        maxCount: Math.max(photoSlots, videoSlots),
      })
      if (picked.length) applyPostMediaItems(picked)
    } catch (error) {
      toast.show('Could not add media', {
        tone: 'danger',
        message: error instanceof Error ? error.message : 'Try again.',
      })
    } finally {
      setIsPicking(false)
    }
  }, [applyPostMediaItems, isPicking, photos.length, toast, videos.length])

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
    if (composeParam === 'media') void pickPostMedia()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyParam, composeParam, gifParam, groupParam])

  // Restore autosaved draft (works offline on web + native).
  useEffect(() => {
    let active = true
    void loadComposeDraft().then((draft) => {
      if (!active || !draft) return
      if (draft.content && !form.fields.content.value) {
        form.fields.content.setValue(draft.content)
      }
      if (draft.articleTitle) setArticleTitle(draft.articleTitle)
      if (
        draft.mode === 'poll' ||
        draft.mode === 'event' ||
        draft.mode === 'celebration' ||
        draft.mode === 'product' ||
        draft.mode === 'shop' ||
        draft.mode === 'article' ||
        draft.mode === 'text'
      ) {
        setComposeMode(draft.mode)
      }
    })
    return () => {
      active = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Debounced autosave so drafts survive tab switches / app restarts.
  useEffect(() => {
    const timer = setTimeout(() => {
      void saveComposeDraft({
        content: form.fields.content.value,
        articleTitle,
        mode: composeMode,
      })
    }, 600)
    return () => clearTimeout(timer)
  }, [articleTitle, composeMode, form.fields.content.value])

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
      initialMode === 'shop' ||
      initialMode === 'article'
    ) {
      setComposeMode(initialMode)
    }
    if (initialOccasion && CELEBRATION_OCCASIONS.some((o) => o.value === initialOccasion)) {
      setOccasion(initialOccasion)
    }
    if (initialCelebrationTitle) setCelebrationTitle(initialCelebrationTitle)
    if (initialContent) form.fields.content.onChange(initialContent)
    if (initialGifUrl) form.fields.imageUrl.setValue(initialGifUrl)
    if (autoPickMedia) void pickPostMedia()
    if (autoPickVideo) void pickPostVideos()
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

  // Load seller listings for product posts and the "Yours" attach tab.
  useEffect(() => {
    if ((composeMode !== 'product' && !(productPickerOpen && productPickerTab === 'yours')) || !activeShopId) {
      return
    }
    let cancelled = false
    setLoadingListings(true)
    fetchSellerListings(activeShopId, { status: 'active', limit: 50 })
      .then((rows) => {
        if (!cancelled) {
          setListings(rows)
          if (initialListingId) {
            const match = rows.find((row) => row.id === initialListingId)
            if (match) setSelectedListing(match)
          }
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingListings(false)
      })
    return () => {
      cancelled = true
    }
  }, [activeShopId, composeMode, initialListingId, productPickerOpen, productPickerTab])

  // Load wishlist when the Saved tab is open.
  useEffect(() => {
    if (!productPickerOpen || productPickerTab !== 'saved' || !user?.id) return
    let cancelled = false
    setLoadingSavedProducts(true)
    void fetchWishlistAttachProducts(user.id)
      .then((rows) => {
        if (!cancelled) setSavedProducts(rows)
      })
      .finally(() => {
        if (!cancelled) setLoadingSavedProducts(false)
      })
    return () => {
      cancelled = true
    }
  }, [productPickerOpen, productPickerTab, user?.id])

  // Load recently viewed when the Recent tab is open.
  useEffect(() => {
    if (!productPickerOpen || productPickerTab !== 'recent') return
    let cancelled = false
    setLoadingRecentProducts(true)
    void fetchRecentlyViewedAttachProducts(recentIds)
      .then((rows) => {
        if (!cancelled) setRecentProducts(rows)
      })
      .finally(() => {
        if (!cancelled) setLoadingRecentProducts(false)
      })
    return () => {
      cancelled = true
    }
  }, [productPickerOpen, productPickerTab, recentIds])

  // Debounced catalog search for the Search tab.
  useEffect(() => {
    if (!productPickerOpen || productPickerTab !== 'search') return
    const query = catalogSearchQuery.trim()
    if (!query) {
      setSearchProducts([])
      setLoadingSearchProducts(false)
      return
    }
    let cancelled = false
    setLoadingSearchProducts(true)
    const timer = setTimeout(() => {
      void searchAttachProducts(query)
        .then((rows) => {
          if (!cancelled) setSearchProducts(rows)
        })
        .finally(() => {
          if (!cancelled) setLoadingSearchProducts(false)
        })
    }, 280)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [catalogSearchQuery, productPickerOpen, productPickerTab])

  // When sharing a specific listing from PDP, pin its shop if present in shops.
  useEffect(() => {
    if (!initialListingId || composeMode !== 'product' || !shops.length) return
    // Prefer already-selected listing's shop once loaded.
    if (selectedListing) return
    // Soft: if only one shop, activeShopId default handles it.
  }, [composeMode, initialListingId, selectedListing, shops.length])

  // Prefill text-mode attach from PDP share (works without owning a shop).
  useEffect(() => {
    if (!initialListingId) return
    if (composeMode === 'product') return
    if (prefilledListingRef.current === initialListingId) return
    if (attachedProducts.some((item) => item.listingId === initialListingId)) {
      prefilledListingRef.current = initialListingId
      return
    }
    let cancelled = false
    void fetchAttachProductById(initialListingId).then((product) => {
      if (cancelled || !product) return
      prefilledListingRef.current = initialListingId
      setAttachedProducts((current) => {
        if (current.some((item) => item.listingId === product.listingId)) return current
        return [...current, product].slice(0, MAX_ATTACHED_PRODUCTS)
      })
      setProductPickerOpen(true)
      setProductPickerTab(shops.length ? 'yours' : 'recent')
    })
    return () => {
      cancelled = true
    }
  }, [attachedProducts, composeMode, initialListingId, shops.length])

  // Prefer Saved/Search when the member has no shop.
  useEffect(() => {
    if (shops.length === 0 && productPickerTab === 'yours') {
      setProductPickerTab('recent')
    }
  }, [productPickerTab, shops.length])

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

  function removeVideo(index: number) {
    setVideos((current) => {
      const target = current[index]
      if (target) releasePickedImage(target)
      return current.filter((_, i) => i !== index)
    })
  }

  function toggleAttachedListing(listing: SellerListingRow) {
    const shopForListing = shops.find((shopItem) => shopItem.id === activeShopId) ?? null
    const next = sellerListingToPostProduct(
      listing,
      shopForListing?.shop_name ?? null,
      shopForListing?.shop_currency ?? null,
      activeShopId,
      shopForListing?.slug ?? null,
      user?.id ?? null,
    )
    setAttachedProducts((current) => {
      const { products, capped } = togglePostProductAttachment(current, next)
      if (capped) {
        toast.show(`You can attach up to ${MAX_ATTACHED_PRODUCTS} products`, { tone: 'default' })
      } else {
        void feedback('selection')
      }
      return products
    })
  }

  function toggleAttachedProduct(product: PostProduct) {
    setAttachedProducts((current) => {
      const { products, capped } = togglePostProductAttachment(current, product)
      if (capped) {
        toast.show(`You can attach up to ${MAX_ATTACHED_PRODUCTS} products`, { tone: 'default' })
      } else {
        void feedback('selection')
      }
      return products
    })
  }

  function moveAttachedProduct(index: number, delta: number) {
    setAttachedProducts((current) => {
      const nextIndex = index + delta
      if (nextIndex < 0 || nextIndex >= current.length) return current
      const next = [...current]
      const [item] = next.splice(index, 1)
      next.splice(nextIndex, 0, item)
      void feedback('selection')
      return next
    })
  }

  function removeAttachedProduct(listingId: string | null) {
    if (!listingId) return
    setAttachedProducts((current) => current.filter((item) => item.listingId !== listingId))
    void feedback('selection')
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
    setUploadProgress(null)
    let result: { id: string | null; error: string | null } = { id: null, error: null }
    try {
      if (composeMode === 'poll') {
        result = await createCommunityPost(user.id, {
          content: finalContent,
          visibility,
          companyId: targetCompanyId,
          groupId: targetGroupId,
          poll: {
            question: content.trim() || finalContent.trim(),
            options: filledPollOptions,
            durationDays: pollDurationDays,
          },
        })
      } else if (composeMode === 'celebration') {
        const occasionMeta = CELEBRATION_OCCASIONS.find((o) => o.value === occasion)
        let celebrationImageUrl: string | null = null
        if (celebrationCover[0]) {
          setUploadProgress(0)
          const files = await preparePickedImagesForUpload(celebrationCover)
          const { urls, error: uploadError } = await uploadPostImages(user.id, files, {
            onProgress: setUploadProgress,
          })
          if (uploadError) {
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
        const endIso =
          eventEndDate && eventEndTime
            ? new Date(`${eventEndDate}T${eventEndTime}`).toISOString()
            : undefined

        if (!startIso) {
          toast.show('Add a start date and time', { tone: 'danger' })
          return
        }

        let coverUrl: string | null = null
        if (eventCover[0]) {
          setUploadProgress(0)
          const [file] = await preparePickedImagesForUpload(eventCover)
          const { data: uploaded, error: uploadError } = await uploadEventCoverImage(user.id, file, {
            onProgress: setUploadProgress,
          })
          if (uploadError || !uploaded) {
            toast.show('Could not upload cover image', {
              tone: 'danger',
              message: uploadError ?? 'Try again shortly.',
            })
            return
          }
          coverUrl = uploaded.publicUrl
        }

        const locationLabel = eventIsOnline
          ? eventMeetingUrl.trim() || 'Online'
          : eventLocation.trim() || undefined

        const synced = await createEventAndFeedPost(user.id, {
          title: eventTitle.trim(),
          description: finalContent.trim() || undefined,
          startTime: startIso,
          endTime: endIso,
          isOnline: eventIsOnline,
          location: eventIsOnline ? undefined : locationLabel,
          meetingUrl: eventIsOnline ? eventMeetingUrl.trim() || undefined : undefined,
          imageUrl: coverUrl ?? undefined,
          isFree: true,
          shareToFeed: true,
          visibility,
          rsvpEnabled: eventRsvp,
        })

        result = { id: synced.postId, error: synced.error }
      } else if (composeMode === 'article') {
        let mediaUrls: string[] = []
        const coverSource = articleCover.length ? articleCover : photos
        if (coverSource.length) {
          setUploadProgress(0)
          const files = await preparePickedImagesForUpload(coverSource)
          const { urls, error: uploadError } = await uploadPostImages(user.id, files, {
            onProgress: setUploadProgress,
          })
          if (uploadError) {
            toast.show('Could not upload photos', {
              tone: 'danger',
              message: uploadError,
            })
            return
          }
          mediaUrls = urls
        }
        const finalImageUrl = mediaUrls.length ? mediaUrls[0] : imageUrl || null
        const tags = articleTags
          .split(',')
          .map((tag) => tag.trim())
          .filter(Boolean)
          .slice(0, 8)
        result = await createCommunityPost(user.id, {
          content: finalContent,
          imageUrl: finalImageUrl,
          mediaUrls: mediaUrls.length ? mediaUrls : null,
          visibility,
          companyId: targetCompanyId,
          groupId: targetGroupId,
          postType: 'article',
          articleTitle: articleTitle.trim(),
          articleTags: tags.length ? tags : null,
        })
      } else {
        let mediaUrls: string[] = []
        let videoUrls: string[] = []
        const photoCount = photos.length
        const videoCount = videos.length
        const totalSteps = photoCount + videoCount

        if (photoCount) {
          setUploadProgress(0)
          const files = await preparePickedImagesForUpload(photos)
          const { urls, error: uploadError } = await uploadPostImages(user.id, files, {
            onProgress: (photoProgress) => {
              if (!totalSteps) return
              const weighted = (photoProgress * photoCount) / totalSteps
              setUploadProgress(weighted)
            },
          })
          if (uploadError) {
            toast.show('Could not upload photos', {
              tone: 'danger',
              message: uploadError,
            })
            return
          }
          mediaUrls = urls
        }

        if (videoCount) {
          if (!photoCount) setUploadProgress(0)
          const files = await preparePickedImagesForUpload(videos)
          const { urls, error: uploadError } = await uploadPostVideos(user.id, files, {
            onProgress: (videoProgress) => {
              if (!totalSteps) return
              const photoShare = photoCount / totalSteps
              const weighted = photoShare + (videoProgress * videoCount) / totalSteps
              setUploadProgress(weighted)
            },
          })
          if (uploadError) {
            toast.show('Could not upload video', {
              tone: 'danger',
              message: uploadError,
            })
            return
          }
          videoUrls = urls
        }

        const finalImageUrl = mediaUrls.length || videoUrls.length ? null : imageUrl || null
        result = await createCommunityPost(user.id, {
          content: finalContent,
          imageUrl: finalImageUrl,
          mediaUrls: mediaUrls.length ? mediaUrls : null,
          videoUrls: videoUrls.length ? videoUrls : null,
          visibility,
          companyId: targetCompanyId,
          groupId: targetGroupId,
          products: attachedProducts.length ? attachedProducts : null,
          linkPreview: mediaUrls.length || videoUrls.length || finalImageUrl ? null : linkPreview,
        })
      }

      if (result.error || !result.id) {
        toast.show('Could not post', { tone: 'danger', message: result.error ?? 'Try again shortly.' })
        return
      }

      toast.show('Posted', { tone: 'success', message: 'Your update is live.' })
      if (attachedProducts.length && result.id) {
        trackCommunityPostListingsAttached({
          postId: result.id,
          listingIds: attachedProducts
            .map((product) => product.listingId)
            .filter((id): id is string => Boolean(id)),
          source: initialListingId ? 'pdp_share' : 'composer',
        })
      }
      void clearComposeDraft()
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
      setArticleTitle('')
      setSelectedListing(null)
      setSelectedShop(null)
      setAttachedProducts([])
      setProductPickerOpen(false)
      setComposeMode('text')
      setLinkPreview(null)
      setLinkLoading(false)
      dismissedUrlsRef.current.clear()
      previewUrlRef.current = null
      photos.forEach(releasePickedImage)
      setPhotos([])
      videos.forEach(releasePickedImage)
      setVideos([])
      onSuccess?.()
      // Overlay usage closes via onSuccess; the standalone route navigates home.
      if (!embedded) router.push(communityRoutes.home)
    } catch (error) {
      toast.show('Could not post', {
        tone: 'danger',
        message: error instanceof Error ? error.message : 'Try again shortly.',
      })
    } finally {
      setIsPosting(false)
      setUploadProgress(null)
    }
  }

  const contentPlaceholder =
    composeMode === 'poll'
      ? 'What do you want to ask?'
      : composeMode === 'event'
        ? 'Add details attendees should know'
        : composeMode === 'celebration'
          ? 'Say a few words about this moment…'
          : composeMode === 'article'
            ? 'Write your article…'
            : composeMode === 'product'
            ? 'Tell people why they should check this out…'
            : composeMode === 'shop'
              ? 'Share what makes your shop special…'
              : 'What do you want to talk about?'

  const audience = AUDIENCE[visibility]
  const Container = embedded ? YStack : CommunityCard

  // The six toolbar icons plus the Post button are wider than a narrow phone
  // row. On iOS/Android anything pushed past the row's edge is invisible and
  // never receives touches, so the trailing "More" button went dead there.
  const toolbarIconSize = windowWidth < 340 ? 32 : windowWidth < 400 ? 36 : 40
  const toolbarGap = windowWidth < 400 ? 2 : 4

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

        {/* Compose body — drag & drop photos/videos on web */}
        <MediaDropZone
          disabled={isPosting || (composeMode !== 'text' && composeMode !== 'article')}
          accept="media"
          multiple
          maxCount={
            composeMode === 'article'
              ? Math.max(1, MAX_PHOTOS - photos.length)
              : Math.max(1, MAX_PHOTOS - photos.length + MAX_VIDEOS - videos.length)
          }
          onDrop={(items) => applyPostMediaItems(items)}
          label="Drop photos or videos to attach"
        >
        <YStack paddingHorizontal={16} paddingBottom={12} gap={12}>
          {composeMode === 'article' ? (
            <YStack gap="$3">
              <Text fontSize={13} fontWeight="600" color={communityUi.textMuted}>
                Article headline
              </Text>
              <Input
                value={articleTitle}
                onChangeText={(value) => setArticleTitle(value.slice(0, 160))}
                placeholder="Give your article a clear title"
                fontSize={20}
                fontWeight="700"
                borderWidth={0}
                backgroundColor="transparent"
                paddingHorizontal={0}
              />
              <ImageUploadField
                label="Cover image"
                hint="Optional hero image for your article (16:9)."
                value={articleCover}
                onChange={setArticleCover}
                aspect="landscape"
                uploadProgress={uploadProgress}
                uploadLabel="Uploading cover…"
              />
              <Field label="Topics (optional)" hint="Comma-separated, up to 8">
                <Input
                  value={articleTags}
                  onChangeText={setArticleTags}
                  placeholder="Leadership, Growth, Community"
                />
              </Field>
            </YStack>
          ) : null}

          <MentionInput
            multiline
            value={content}
            onChangeText={(value) => form.fields.content.onChange(value.slice(0, contentLimit + 50))}
            onEncodedChange={(encoded) => {
              encodedContentRef.current = encoded
            }}
            invalid={!!contentError}
            placeholder={contentPlaceholder}
            minHeight={composeMode === 'article' ? 220 : composeMode === 'text' ? 150 : 96}
            fontSize={18}
            lineHeight={26}
            borderWidth={0}
            backgroundColor="transparent"
            padding={0}
          />

          <PostComposeAiBar
            mode={composeMode}
            seedPrompt={content || articleTitle || celebrationTitle || eventTitle}
            onApplyDraft={(draft) => {
              form.fields.content.onChange(draft.content.slice(0, contentLimit + 50))
              if (draft.articleTitle) {
                setArticleTitle(draft.articleTitle.slice(0, 160))
              }
            }}
          />

          {contentError ? (
            <Text fontSize={12} color="#cc1010">
              {contentError}
            </Text>
          ) : null}

          {/* Photo previews — contain like the feed post card (no crop) */}
          {composeMode === 'text' && photos.length > 0 ? (
            <XStack gap={8} flexWrap="wrap">
              {photos.map((photo, index) => (
                <YStack
                  key={`${photo.uri}-${index}`}
                  width={photos.length === 1 ? '100%' : 120}
                  height={photos.length === 1 ? 280 : 120}
                  borderRadius={12}
                  overflow="hidden"
                  borderWidth={1}
                  borderColor={communityUi.border}
                  backgroundColor="#0a0a0a"
                  position="relative"
                  alignItems="center"
                  justifyContent="center"
                >
                  <Image src={photo.uri} width="100%" height="100%" objectFit="contain" alt="" />
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
                  borderStyle="dashed"
                  borderColor={communityUi.border}
                  alignItems="center"
                  justifyContent="center"
                  cursor="pointer"
                  onPress={() => void pickPhotos()}
                >
                  <Icons.Plus size={22} color={communityUi.textMuted} />
                </YStack>
              ) : null}
            </XStack>
          ) : null}

          {/* Video previews */}
          {composeMode === 'text' && videos.length > 0 ? (
            <XStack gap={8} flexWrap="wrap">
              {videos.map((video, index) => (
                <YStack
                  key={`${video.uri}-${index}`}
                  width={videos.length === 1 ? '100%' : 160}
                  height={videos.length === 1 ? 260 : 120}
                  borderRadius={12}
                  overflow="hidden"
                  borderWidth={1}
                  borderColor={communityUi.border}
                  backgroundColor="#000"
                  position="relative"
                >
                  {/* eslint-disable-next-line jsx-a11y/media-has-caption -- preview only */}
                  {Platform.OS === 'web' ? (
                    <video
                      src={video.uri}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      muted
                      playsInline
                      controls={false}
                    />
                  ) : (
                    <NativeVideoFile uri={video.uri} autoPlay={false} />
                  )}
                  <YStack
                    position="absolute"
                    top={6}
                    left={6}
                    paddingHorizontal={8}
                    paddingVertical={4}
                    borderRadius={999}
                    backgroundColor="rgba(0,0,0,0.6)"
                  >
                    <Text fontSize={11} fontWeight="700" color="white">
                      Video
                    </Text>
                  </YStack>
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
                    aria-label="Remove video"
                    onPress={() => removeVideo(index)}
                  >
                    <Icons.X size={16} color="white" />
                  </YStack>
                </YStack>
              ))}
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
              <Image
                src={imageUrl}
                width="100%"
                maxHeight={320}
                objectFit="contain"
                alt="GIF preview"
              />
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

          {/* Link preview (URL unfurl) */}
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

          {composeMode === 'text' && (productPickerOpen || attachedProducts.length > 0) ? (
            <YStack
              gap={10}
              padding={12}
              borderRadius={12}
              borderWidth={1}
              borderColor={communityUi.border}
              backgroundColor={communityUi.pageBg}
            >
              <XStack alignItems="center" justifyContent="space-between" gap={8}>
                <YStack gap={2} flex={1}>
                  <Text fontSize={14} fontWeight="700" color={communityUi.text}>
                    Tagged products
                  </Text>
                  <Text fontSize={12} color={communityUi.textMuted}>
                    Attach up to {MAX_ATTACHED_PRODUCTS} listings to this post.
                  </Text>
                </YStack>
                <Button
                  size="$2"
                  tone="outline"
                  borderRadius={999}
                  onPress={() => setProductPickerOpen((current) => !current)}
                >
                  {productPickerOpen ? 'Done' : attachedProducts.length ? 'Edit' : 'Add products'}
                </Button>
              </XStack>

              {attachedProducts.length > 0 ? (
                <YStack gap={8}>
                  {attachedProducts.map((product, index) => (
                    <AttachedProductRow
                      key={product.listingId ?? product.slug ?? product.title}
                      product={product}
                      onRemove={() => removeAttachedProduct(product.listingId)}
                      onMoveUp={() => moveAttachedProduct(index, -1)}
                      onMoveDown={() => moveAttachedProduct(index, 1)}
                      canMoveUp={index > 0}
                      canMoveDown={index < attachedProducts.length - 1}
                    />
                  ))}
                </YStack>
              ) : null}

              {Platform.OS === 'web' && productPickerOpen ? (
                <ProductAttachPickerPanel
                  tabs={productPickerTabs}
                  productPickerTab={productPickerTab}
                  onTabChange={setProductPickerTab}
                  shops={shops}
                  activeShopId={activeShopId}
                  onActiveShopChange={setActiveShopId}
                  listings={listings}
                  loadingListings={loadingListings}
                  listingSearchQuery={listingSearchQuery}
                  onListingSearchQueryChange={setListingSearchQuery}
                  filteredListings={filteredListings}
                  onToggleListing={toggleAttachedListing}
                  recentProducts={recentProducts}
                  loadingRecentProducts={loadingRecentProducts}
                  savedProducts={savedProducts}
                  loadingSavedProducts={loadingSavedProducts}
                  searchProducts={searchProducts}
                  loadingSearchProducts={loadingSearchProducts}
                  catalogSearchQuery={catalogSearchQuery}
                  onCatalogSearchQueryChange={setCatalogSearchQuery}
                  attachedProducts={attachedProducts}
                  onToggleProduct={toggleAttachedProduct}
                  formatPrice={formatListingPrice}
                />
              ) : null}
            </YStack>
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
                  label="Start date"
                  minDate={new Date()}
                  value={eventDate}
                  onChange={setEventDate}
                  flex={1}
                  minWidth={150}
                />
                <DateTimeField
                  mode="time"
                  label="Start time"
                  value={eventTime}
                  onChange={setEventTime}
                  flex={1}
                  minWidth={150}
                />
              </XStack>
              <XStack gap={12} flexWrap="wrap">
                <DateTimeField
                  mode="date"
                  label="End date (optional)"
                  minDate={new Date()}
                  value={eventEndDate}
                  onChange={setEventEndDate}
                  flex={1}
                  minWidth={150}
                />
                <DateTimeField
                  mode="time"
                  label="End time"
                  value={eventEndTime}
                  onChange={setEventEndTime}
                  flex={1}
                  minWidth={150}
                />
              </XStack>
              <XStack gap={10} alignItems="center">
                <Switch checked={eventIsOnline} onCheckedChange={setEventIsOnline} />
                <Text fontSize={14} color={communityUi.text}>
                  Online event
                </Text>
              </XStack>
              {eventIsOnline ? (
                <Field label="Meeting link">
                  <Input
                    value={eventMeetingUrl}
                    onChangeText={setEventMeetingUrl}
                    placeholder="https://meet.example.com/…"
                    autoCapitalize="none"
                  />
                </Field>
              ) : (
                <Field label="Location (optional)">
                  <Input
                    value={eventLocation}
                    onChangeText={setEventLocation}
                    placeholder="Venue, city"
                  />
                </Field>
              )}
              <ImageUploadField
                label="Cover image (optional)"
                hint="Add a banner attendees will see on the event (16:9)."
                value={eventCover}
                onChange={setEventCover}
                aspect="landscape"
                uploadProgress={uploadProgress}
                uploadLabel="Uploading cover…"
              />
              <XStack gap={10} alignItems="center">
                <Switch checked={eventRsvp} onCheckedChange={setEventRsvp} />
                <Text fontSize={14} color={communityUi.text}>
                  Allow RSVPs
                </Text>
              </XStack>
              <Text fontSize={12} color={communityUi.textMuted}>
                Shared to your feed and listed under Events.
              </Text>
            </YStack>
          ) : null}

          {/* Celebration editor */}
          {composeMode === 'celebration' ? (
            <YStack gap={12}>
              <Text fontSize={15} fontWeight="700" color={communityUi.text}>
                What are you celebrating?
              </Text>
              <Text fontSize={13} color={communityUi.textMuted} lineHeight={18}>
                Share a milestone with your network — friends can congratulate you.
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
                    CELEBRATION_OCCASIONS.find((o) => o.value === occasion)?.placeholder ??
                    'Share the news'
                  }
                  maxLength={120}
                />
              </Field>
              <ImageUploadField
                label="Photo (optional)"
                hint="Add a photo to make your celebration stand out (16:9)."
                value={celebrationCover}
                onChange={setCelebrationCover}
                aspect="celebration"
                uploadProgress={uploadProgress}
                uploadLabel="Uploading photo…"
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
                        setListingSearchQuery('')
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
                <YStack gap={8}>
                  {listings.length >= SHEET_SEARCH_MIN_ITEMS || listingSearchQuery.length > 0 ? (
                    <ScreenSearchField
                      value={listingSearchQuery}
                      onChangeText={setListingSearchQuery}
                      placeholder="Search listings"
                      clearable
                    />
                  ) : null}
                  {filteredListings.length === 0 ? (
                    <Text fontSize={13} color={communityUi.textMuted}>
                      No listings match your search.
                    </Text>
                  ) : (
                    <ScrollView
                      style={{ maxHeight: 320 }}
                      nestedScrollEnabled={Platform.OS === 'android'}
                      keyboardShouldPersistTaps="handled"
                    >
                      <YStack gap={8}>
                        {filteredListings.map((listing) => (
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
                    </ScrollView>
                  )}
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
                <YStack gap={8}>
                  {shops.length >= SHEET_SEARCH_MIN_ITEMS || shopSearchQuery.length > 0 ? (
                    <ScreenSearchField
                      value={shopSearchQuery}
                      onChangeText={setShopSearchQuery}
                      placeholder="Search shops"
                      clearable
                    />
                  ) : null}
                  {filteredShops.length === 0 ? (
                    <Text fontSize={13} color={communityUi.textMuted}>
                      No shops match your search.
                    </Text>
                  ) : (
                    <YStack gap={8} maxHeight={320} overflow="scroll">
                      {filteredShops.map((shopItem) => (
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
              )}
            </YStack>
          ) : null}

          <XStack justifyContent="flex-end">
            <Text fontSize={12} color={isOverLimit ? '#cc1010' : communityUi.textMuted}>
              {remaining}
            </Text>
          </XStack>
        </YStack>
        </MediaDropZone>

        {/* Toolbar — LinkedIn-style: media, event, celebrate, poll, more */}
        <XStack
          paddingHorizontal={12}
          paddingVertical={10}
          borderTopWidth={1}
          borderTopColor={communityUi.borderLight}
          alignItems="center"
          justifyContent="space-between"
          gap={8}
        >
          {/* Horizontal scroll keeps every action reachable when the row runs
              out of width (long "Publish" label, upload bar, small screens). */}
          <ScrollView
            horizontal
            flex={1}
            showsHorizontalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ alignItems: 'center', gap: toolbarGap, paddingRight: 4 }}
          >
            <ToolbarButton
              icon={Icons.Image}
              color="#70b5f9"
              label="Photo"
              size={toolbarIconSize}
              active={photos.length > 0}
              onPress={() => {
                setComposeMode('text')
                void pickPhotos()
              }}
            />
            <ToolbarButton
              icon={Icons.Video}
              color="#e74c3c"
              label="Video"
              size={toolbarIconSize}
              active={videos.length > 0}
              onPress={() => {
                setComposeMode('text')
                void pickPostVideos()
              }}
            />
            <ToolbarButton
              icon={Icons.Calendar}
              color="#e7a33e"
              label="Event"
              size={toolbarIconSize}
              active={composeMode === 'event'}
              onPress={() => setComposeMode(composeMode === 'event' ? 'text' : 'event')}
            />
            <ToolbarButton
              icon={Icons.PartyPopper}
              color="#c37dda"
              label="Celebrate"
              size={toolbarIconSize}
              active={composeMode === 'celebration'}
              onPress={() => setComposeMode(composeMode === 'celebration' ? 'text' : 'celebration')}
            />
            <ToolbarButton
              icon={Icons.BarChart2}
              color="#7fc15e"
              label="Poll"
              size={toolbarIconSize}
              active={composeMode === 'poll'}
              onPress={() => setComposeMode(composeMode === 'poll' ? 'text' : 'poll')}
            />
            <ToolbarButton
              icon={Icons.MoreHorizontal}
              color={communityUi.textMuted}
              label="More"
              size={toolbarIconSize}
              active={
                composeMode === 'product' ||
                composeMode === 'shop' ||
                composeMode === 'article' ||
                productPickerOpen ||
                attachedProducts.length > 0 ||
                emojiOpen ||
                (!!imageUrl && isGifUrl(imageUrl))
              }
              onPress={() => setMoreOpen(true)}
            />
          </ScrollView>

          {uploadProgress != null ? (
            <UploadProgressBar
              progress={Math.max(uploadProgress, 1)}
              label={uploadProgress <= 0 ? 'Preparing media…' : 'Uploading media…'}
              compact
            />
          ) : null}

          <Button
            backgroundColor={canPost ? communityUi.brand : communityUi.border}
            color={canPost ? 'white' : communityUi.textMuted}
            borderRadius={999}
            paddingHorizontal="$5"
            disabled={!canPost || isPosting}
            onPress={handlePost}
            icon={isPosting ? <Spinner size="small" color="white" /> : undefined}
          >
            {isPosting ? 'Posting…' : composeMode === 'article' ? 'Publish' : 'Post'}
          </Button>
        </XStack>
      </Container>

      <GifPicker open={gifOpen} onOpenChange={setGifOpen} onSelect={form.fields.imageUrl.setValue} />

      <EmojiPickerSheet
        open={emojiOpen}
        onOpenChange={setEmojiOpen}
        onPick={(emoji) => {
          insertEmoji(emoji)
          setEmojiOpen(false)
        }}
      />

      {Platform.OS !== 'web' ? (
        <CommunityAdaptiveSheet
          open={productPickerOpen}
          onOpenChange={setProductPickerOpen}
          title="Tag products"
        >
          <ProductAttachPickerPanel
            tabs={productPickerTabs}
            productPickerTab={productPickerTab}
            onTabChange={setProductPickerTab}
            shops={shops}
            activeShopId={activeShopId}
            onActiveShopChange={setActiveShopId}
            listings={listings}
            loadingListings={loadingListings}
            listingSearchQuery={listingSearchQuery}
            onListingSearchQueryChange={setListingSearchQuery}
            filteredListings={filteredListings}
            onToggleListing={toggleAttachedListing}
            recentProducts={recentProducts}
            loadingRecentProducts={loadingRecentProducts}
            savedProducts={savedProducts}
            loadingSavedProducts={loadingSavedProducts}
            searchProducts={searchProducts}
            loadingSearchProducts={loadingSearchProducts}
            catalogSearchQuery={catalogSearchQuery}
            onCatalogSearchQueryChange={setCatalogSearchQuery}
            attachedProducts={attachedProducts}
            onToggleProduct={toggleAttachedProduct}
            formatPrice={formatListingPrice}
          />
        </CommunityAdaptiveSheet>
      ) : null}

      <CommunityAdaptiveSheet open={moreOpen} onOpenChange={setMoreOpen} title="Add to your post">
        <YStack gap={4}>
          <MoreOptionRow
            icon={Icons.Newspaper}
            tint={communityUi.brand}
            title="Write an article"
            description="Long-form thought leadership for your network"
            onPress={() => {
              setComposeMode('article')
              setMoreOpen(false)
            }}
          />
          <MoreOptionRow
            icon={Icons.Film}
            tint="#7fc15e"
            title="Add a GIF"
            description="Search and attach an animated GIF"
            onPress={() => {
              setComposeMode('text')
              setMoreOpen(false)
              setGifOpen(true)
            }}
          />
          <MoreOptionRow
            icon={Icons.Smile}
            tint="#f5a623"
            title="Add emoji"
            description="Insert emoji into your post"
            onPress={() => {
              setComposeMode('text')
              setMoreOpen(false)
              setEmojiOpen(true)
            }}
          />
          <MoreOptionRow
            icon={Icons.Tag}
            tint={communityUi.brand}
            title="Tag products in post"
            description="Attach up to 3 listings to a regular post"
            onPress={() => {
              setComposeMode('text')
              setProductPickerOpen(true)
              setMoreOpen(false)
            }}
          />
          <MoreOptionRow
            icon={Icons.Package}
            tint={communityUi.brand}
            title="Share a product"
            description="Publish a dedicated single-product post"
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
                pressStyle={{ backgroundColor: communityUi.hoverBg, opacity: 0.9 }}
                accessibilityRole="button"
                accessibilityLabel={item.label}
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
  size = 40,
  onPress,
}: {
  icon: typeof Icons.Image
  color: string
  label: string
  active?: boolean
  size?: number
  onPress: () => void
}) {
  const communityUi = useCommunityUi()
  return (
    <YStack
      width={size}
      height={size}
      flexShrink={0}
      borderRadius={999}
      alignItems="center"
      justifyContent="center"
      cursor="pointer"
      backgroundColor={active ? communityUi.accentMuted : 'transparent'}
      hoverStyle={{ backgroundColor: active ? communityUi.accentMuted : communityUi.hoverBg }}
      pressStyle={{ opacity: 0.75 }}
      animation="quick"
      onPress={onPress}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={label}
      aria-label={label}
    >
      <Icon size={size >= 40 ? 22 : 20} color={color} />
    </YStack>
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

function AttachedProductRow({
  product,
  onRemove,
  onMoveUp,
  onMoveDown,
  canMoveUp,
  canMoveDown,
}: {
  product: PostProduct
  onRemove: () => void
  onMoveUp: () => void
  onMoveDown: () => void
  canMoveUp: boolean
  canMoveDown: boolean
}) {
  const communityUi = useCommunityUi()
  return (
    <XStack
      alignItems="center"
      gap={10}
      padding={8}
      borderRadius={12}
      borderWidth={1}
      borderColor={communityUi.border}
      backgroundColor={communityUi.cardBg}
    >
      <YStack gap={4} flexShrink={0}>
        <XStack
          width={28}
          height={28}
          borderRadius={999}
          alignItems="center"
          justifyContent="center"
          opacity={canMoveUp ? 1 : 0.35}
          cursor={canMoveUp ? 'pointer' : 'default'}
          hoverStyle={canMoveUp ? { backgroundColor: communityUi.divider } : undefined}
          onPress={canMoveUp ? onMoveUp : undefined}
        >
          <Icons.ChevronUp size={16} color={communityUi.textMuted} />
        </XStack>
        <XStack
          width={28}
          height={28}
          borderRadius={999}
          alignItems="center"
          justifyContent="center"
          opacity={canMoveDown ? 1 : 0.35}
          cursor={canMoveDown ? 'pointer' : 'default'}
          hoverStyle={canMoveDown ? { backgroundColor: communityUi.divider } : undefined}
          onPress={canMoveDown ? onMoveDown : undefined}
        >
          <Icons.ChevronDown size={16} color={communityUi.textMuted} />
        </XStack>
      </YStack>
      <YStack
        width={48}
        height={48}
        borderRadius={8}
        overflow="hidden"
        backgroundColor={communityUi.pageBg}
        alignItems="center"
        justifyContent="center"
      >
        {product.imageUrl ? (
          <Image src={product.imageUrl} width={48} height={48} objectFit="cover" alt="" />
        ) : (
          <Icons.Package size={20} color={communityUi.textMuted} />
        )}
      </YStack>
      <YStack flex={1} gap={2} minWidth={0}>
        <Text fontSize={14} fontWeight="600" color={communityUi.text} numberOfLines={1}>
          {product.title}
        </Text>
        <Text fontSize={12} color={communityUi.textMuted} numberOfLines={1}>
          {[formatListingPrice(product.price, product.currency), product.shopName].filter(Boolean).join(' · ')}
        </Text>
      </YStack>
      <XStack
        width={30}
        height={30}
        borderRadius={999}
        alignItems="center"
        justifyContent="center"
        cursor="pointer"
        hoverStyle={{ backgroundColor: communityUi.divider }}
        onPress={onRemove}
      >
        <Icons.X size={16} color={communityUi.textMuted} />
      </XStack>
    </XStack>
  )
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
      pressStyle={{ backgroundColor: communityUi.hoverBg, opacity: 0.9 }}
      accessibilityRole="button"
      accessibilityLabel={title}
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
