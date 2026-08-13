import { useParams, useRouter } from 'one'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Platform, Pressable } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import {
  deleteStory,
  fetchStoryRings,
  fetchStoryViewers,
  fetchUserStories,
  markStoryViewed,
  replyToStory,
  type StoryRing,
  type StorySlide,
  type StoryViewer,
} from '~/community/lib/stories'
import { useCommunityUi } from '~/community/lib/community-theme'
import {
  AppBottomSheet,
  Avatar,
  Icons,
  Image,
  Input,
  Spinner,
  Text,
  XStack,
  YStack,
  useAppToast,
} from '~/components/ui'
import { NativeVideoFile } from '~/lib/native/NativeMediaPlayers'
import { chatRoutes, communityRoutes } from '~/lib/routes'
import { useSupabase } from '~/providers/SupabaseProvider'

const TEXT_IMAGE_SLIDE_MS = 5000
const VIDEO_MAX_SLIDE_MS = 30000
const HOLD_MS = 180

function formatViewedAt(value: string | null): string {
  if (!value) return ''
  try {
    return new Date(value).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })
  } catch {
    return ''
  }
}

export function StoryViewerScreen() {
  const communityUi = useCommunityUi()
  const { userId } = useParams<{ userId: string }>()
  const router = useRouter()
  const toast = useAppToast()
  const { user } = useSupabase()
  const insets = useSafeAreaInsets()

  const [slides, setSlides] = useState<StorySlide[]>([])
  const [rings, setRings] = useState<StoryRing[]>([])
  const [index, setIndex] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [paused, setPaused] = useState(false)
  const [progress, setProgress] = useState(0)
  const [videoDurationMs, setVideoDurationMs] = useState<number | null>(null)
  const [replyText, setReplyText] = useState('')
  const [isSendingReply, setIsSendingReply] = useState(false)
  const [viewersOpen, setViewersOpen] = useState(false)
  const [viewers, setViewers] = useState<StoryViewer[]>([])
  const [viewersLoading, setViewersLoading] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const holdingRef = useRef(false)
  const rafRef = useRef<number | null>(null)
  const startedAtRef = useRef(0)
  const elapsedRef = useRef(0)
  const advancingRef = useRef(false)
  const webVideoRef = useRef<HTMLVideoElement | null>(null)
  const viewedIdsRef = useRef<Set<string>>(new Set())
  const pausedRef = useRef(false)
  const videoDurationMsRef = useRef<number | null>(null)
  const slideMediaTypeRef = useRef<string | null>(null)

  const isOwnStory = Boolean(user?.id && userId && user.id === userId)
  const slide = slides[index]
  pausedRef.current = paused
  videoDurationMsRef.current = videoDurationMs
  slideMediaTypeRef.current = slide?.media_type ?? null

  const authorQueue = useMemo(() => {
    if (!userId || !rings.length) return [userId].filter(Boolean) as string[]
    const start = rings.findIndex((r) => r.user_id === userId)
    if (start < 0) return [userId]
    return [...rings.slice(start), ...rings.slice(0, start)].map((r) => r.user_id)
  }, [rings, userId])

  const load = useCallback(async () => {
    if (!userId) return
    setIsLoading(true)
    const [data, ringData] = await Promise.all([
      fetchUserStories(userId),
      user ? fetchStoryRings(user.id) : Promise.resolve([] as StoryRing[]),
    ])
    setRings(ringData)
    setSlides(data)
    const firstUnseen = data.findIndex((s) => !s.user_viewed)
    setIndex(firstUnseen >= 0 ? firstUnseen : 0)
    setProgress(0)
    setVideoDurationMs(null)
    setIsLoading(false)
  }, [user, userId])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    const current = slides[index]
    if (!current || !user) return
    if (viewedIdsRef.current.has(current.id)) return
    viewedIdsRef.current.add(current.id)
    void markStoryViewed(current.id, user.id)
  }, [index, slides, user])

  const goToNextAuthorOrExit = useCallback(() => {
    if (!userId) {
      router.push(communityRoutes.home)
      return
    }
    const pos = authorQueue.indexOf(userId)
    const nextAuthor = pos >= 0 ? authorQueue[pos + 1] : undefined
    if (nextAuthor && nextAuthor !== userId) {
      router.push(communityRoutes.storyUser(nextAuthor))
      return
    }
    router.push(communityRoutes.home)
  }, [authorQueue, router, userId])

  const goNext = useCallback(() => {
    if (advancingRef.current) return
    advancingRef.current = true
    if (index < slides.length - 1) {
      setIndex((i) => i + 1)
      setProgress(0)
      setVideoDurationMs(null)
      elapsedRef.current = 0
      // Allow the next slide's timer to advance again on the following frame.
      requestAnimationFrame(() => {
        advancingRef.current = false
      })
      return
    }
    goToNextAuthorOrExit()
  }, [goToNextAuthorOrExit, index, slides.length])

  const goPrev = useCallback(() => {
    advancingRef.current = false
    if (index > 0) {
      setIndex((i) => i - 1)
      setProgress(0)
      setVideoDurationMs(null)
      elapsedRef.current = 0
      return
    }
    router.back()
  }, [index, router])

  // Animated timed progress + auto-advance (paused while holding / sheet open).
  // For video, duration may arrive after mount — refs keep the running loop current.
  useEffect(() => {
    if (!slide || viewersOpen) return
    advancingRef.current = false
    elapsedRef.current = 0
    setProgress(0)
    startedAtRef.current = performance.now()

    const tick = (now: number) => {
      if (pausedRef.current || holdingRef.current) {
        startedAtRef.current = now
        rafRef.current = requestAnimationFrame(tick)
        return
      }
      const delta = now - startedAtRef.current
      startedAtRef.current = now
      elapsedRef.current += delta
      const knownVideoMs = videoDurationMsRef.current
      const duration =
        slideMediaTypeRef.current === 'video'
          ? Math.min(knownVideoMs && knownVideoMs > 0 ? knownVideoMs : VIDEO_MAX_SLIDE_MS, VIDEO_MAX_SLIDE_MS)
          : TEXT_IMAGE_SLIDE_MS
      const next = Math.min(1, elapsedRef.current / duration)
      setProgress(next)
      if (next >= 1) {
        goNext()
        return
      }
      rafRef.current = requestAnimationFrame(tick)
    }

    rafRef.current = requestAnimationFrame(tick)

    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
  }, [goNext, slide?.id, viewersOpen])

  // Pause / resume web video with hold state.
  useEffect(() => {
    const el = webVideoRef.current
    if (!el) return
    if (paused || viewersOpen) {
      el.pause()
    } else {
      void el.play().catch(() => {})
    }
  }, [paused, viewersOpen, slide?.id])

  const clearHoldTimer = () => {
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current)
      holdTimerRef.current = null
    }
  }

  const onPressIn = () => {
    clearHoldTimer()
    holdTimerRef.current = setTimeout(() => {
      holdingRef.current = true
      setPaused(true)
    }, HOLD_MS)
  }

  const onPressOut = () => {
    const wasHolding = holdingRef.current
    clearHoldTimer()
    holdingRef.current = false
    setPaused(false)
    return wasHolding
  }

  const openViewers = async () => {
    if (!slide || !isOwnStory) return
    setViewersOpen(true)
    setPaused(true)
    setViewersLoading(true)
    const { items, error } = await fetchStoryViewers(slide.id)
    setViewersLoading(false)
    if (error) {
      toast.show('Could not load viewers', { tone: 'danger', message: error })
      return
    }
    setViewers(items)
  }

  const handleDelete = async () => {
    if (!slide || !user || !isOwnStory || isDeleting) return
    setIsDeleting(true)
    const { error } = await deleteStory(slide.id, user.id)
    setIsDeleting(false)
    if (error) {
      toast.show('Could not delete story', { tone: 'danger', message: error })
      return
    }
    toast.show('Story deleted', { tone: 'success' })
    const remaining = slides.filter((s) => s.id !== slide.id)
    if (!remaining.length) {
      router.push(communityRoutes.home)
      return
    }
    setSlides(remaining)
    setIndex((i) => Math.min(i, remaining.length - 1))
    setProgress(0)
    setVideoDurationMs(null)
  }

  const handleReply = async () => {
    if (!slide || !user || isOwnStory || isSendingReply) return
    const text = replyText.trim()
    if (!text) return
    setIsSendingReply(true)
    const { conversationId, error } = await replyToStory({
      authorId: slide.user_id,
      senderId: user.id,
      storyId: slide.id,
      text,
      previewUrl: slide.media_url,
      previewText: slide.content,
    })
    setIsSendingReply(false)
    if (error) {
      toast.show('Could not send reply', { tone: 'danger', message: error })
      return
    }
    setReplyText('')
    toast.show('Reply sent', { tone: 'success' })
    if (conversationId) {
      router.push(chatRoutes.conversation(conversationId))
    }
  }

  if (isLoading) {
    return (
      <YStack flex={1} alignItems="center" justifyContent="center" backgroundColor="#000">
        <Spinner size="large" color="white" />
      </YStack>
    )
  }

  if (!slides.length || !slide) {
    return (
      <YStack flex={1} alignItems="center" justifyContent="center" backgroundColor="#000" padding={24}>
        <Text color="white">No active stories.</Text>
      </YStack>
    )
  }

  return (
    <YStack flex={1} backgroundColor="#000" position="relative">
      <XStack position="absolute" top={16} left={16} right={16} gap={4} zIndex={4}>
        {slides.map((s, i) => (
          <YStack
            key={s.id}
            flex={1}
            height={3}
            borderRadius={2}
            backgroundColor="rgba(255,255,255,0.3)"
            overflow="hidden"
          >
            <YStack
              height="100%"
              width={i < index ? '100%' : i === index ? `${Math.round(progress * 100)}%` : '0%'}
              backgroundColor="white"
            />
          </YStack>
        ))}
      </XStack>

      <XStack
        position="absolute"
        top={28}
        left={16}
        right={16}
        zIndex={5}
        alignItems="center"
        justifyContent="space-between"
        pointerEvents="box-none"
      >
        <XStack
          alignItems="center"
          gap={8}
          cursor="pointer"
          onPress={() => router.back()}
          accessibilityLabel="Close story"
        >
          <Icons.X size={22} color="white" />
        </XStack>

        {isOwnStory ? (
          <XStack gap={12} alignItems="center">
            <XStack
              alignItems="center"
              gap={6}
              paddingHorizontal={10}
              paddingVertical={6}
              borderRadius={999}
              backgroundColor="rgba(0,0,0,0.45)"
              cursor="pointer"
              onPress={() => void openViewers()}
              accessibilityLabel="Seen by"
            >
              <Icons.Eye size={16} color="white" />
              <Text color="white" fontSize={13} fontWeight="600">
                {slide.view_count ?? 0}
              </Text>
            </XStack>
            <XStack
              width={36}
              height={36}
              borderRadius={999}
              alignItems="center"
              justifyContent="center"
              backgroundColor="rgba(0,0,0,0.45)"
              cursor="pointer"
              opacity={isDeleting ? 0.5 : 1}
              onPress={() => void handleDelete()}
              accessibilityLabel="Delete story"
            >
              {isDeleting ? <Spinner size="small" color="white" /> : <Icons.Trash2 size={16} color="white" />}
            </XStack>
          </XStack>
        ) : null}
      </XStack>

      {/* Tap / hold zones — leave bottom strip free for reply bar */}
      <Pressable
        style={{ position: 'absolute', top: 0, left: 0, bottom: 72, width: '50%', zIndex: 3 }}
        onPressIn={onPressIn}
        onPressOut={() => {
          if (!onPressOut()) goPrev()
        }}
      />
      <Pressable
        style={{ position: 'absolute', top: 0, right: 0, bottom: 72, width: '50%', zIndex: 3 }}
        onPressIn={onPressIn}
        onPressOut={() => {
          if (!onPressOut()) goNext()
        }}
      />

      <YStack flex={1} alignItems="center" justifyContent="center" padding={24} gap={16} paddingBottom={56}>
        {slide.media_type === 'image' && slide.media_url ? (
          <Image
            source={{ uri: slide.media_url }}
            style={{ width: '100%', maxWidth: 520, height: '80%', maxHeight: 640 }}
            resizeMode="contain"
          />
        ) : slide.media_type === 'video' && slide.media_url ? (
          Platform.OS === 'web' ? (
            <video
              key={slide.id}
              ref={(el) => {
                webVideoRef.current = el
              }}
              src={slide.media_url}
              autoPlay
              playsInline
              muted={false}
              controls={false}
              style={{ maxWidth: '100%', maxHeight: '80vh', objectFit: 'contain', background: '#000' }}
              onLoadedMetadata={(e) => {
                const d = (e.currentTarget as HTMLVideoElement).duration
                if (Number.isFinite(d) && d > 0) setVideoDurationMs(Math.round(d * 1000))
              }}
              onEnded={goNext}
            />
          ) : (
            <YStack width="100%" maxWidth={420}>
              <NativeVideoFile
                uri={slide.media_url}
                autoPlay
                paused={paused || viewersOpen}
                onDurationMs={setVideoDurationMs}
                onEnded={goNext}
              />
            </YStack>
          )
        ) : (
          <YStack
            width="100%"
            maxWidth={420}
            minHeight={320}
            borderRadius={16}
            backgroundColor={slide.background_color ?? communityUi.brand}
            alignItems="center"
            justifyContent="center"
            padding={32}
          >
            <Text fontSize={24} fontWeight="600" color={slide.text_color ?? 'white'} textAlign="center">
              {slide.content}
            </Text>
          </YStack>
        )}

        {slide.content && slide.media_type !== 'text' && slide.media_url ? (
          <Text fontSize={15} color="white" textAlign="center" maxWidth={420}>
            {slide.content}
          </Text>
        ) : null}
      </YStack>

      {!isOwnStory ? (
        <XStack
          position="absolute"
          left={12}
          right={12}
          // Absolute inside a full-bleed viewer — clear the nav bar itself.
          bottom={Math.max(insets.bottom, 16)}
          zIndex={6}
          gap={8}
          alignItems="center"
        >
          <Input
            flex={1}
            value={replyText}
            onChangeText={setReplyText}
            placeholder="Reply to story…"
            placeholderTextColor="rgba(255,255,255,0.55)"
            color="white"
            backgroundColor="rgba(255,255,255,0.12)"
            borderColor="rgba(255,255,255,0.25)"
            borderRadius={999}
            height={44}
            paddingHorizontal={16}
            onFocus={() => setPaused(true)}
            onBlur={() => {
              if (!viewersOpen) setPaused(false)
            }}
          />
          <XStack
            width={44}
            height={44}
            borderRadius={999}
            alignItems="center"
            justifyContent="center"
            backgroundColor={communityUi.brand}
            cursor="pointer"
            opacity={isSendingReply || !replyText.trim() ? 0.5 : 1}
            onPress={() => void handleReply()}
            accessibilityLabel="Send reply"
          >
            {isSendingReply ? <Spinner size="small" color="white" /> : <Icons.Send size={18} color="white" />}
          </XStack>
        </XStack>
      ) : null}

      <AppBottomSheet
        open={viewersOpen}
        onOpenChange={(open) => {
          setViewersOpen(open)
          if (!open) setPaused(false)
        }}
        title="Seen by"
        maxHeightRatio={0.7}
      >
        {viewersLoading ? (
          <YStack alignItems="center" padding={24}>
            <Spinner size="small" color={communityUi.brand} />
          </YStack>
        ) : viewers.length === 0 ? (
          <Text color={communityUi.textMuted} textAlign="center" paddingVertical={24}>
            No views yet
          </Text>
        ) : (
          viewers.map((viewer) => (
            <XStack key={viewer.viewer_id} alignItems="center" gap={12}>
              <Avatar name={viewer.full_name} src={viewer.avatar_url ?? undefined} size="$3" />
              <YStack flex={1} gap={2}>
                <Text fontWeight="600" color={communityUi.text}>
                  {viewer.full_name}
                </Text>
                <Text fontSize={12} color={communityUi.textMuted}>
                  {formatViewedAt(viewer.viewed_at)}
                </Text>
              </YStack>
            </XStack>
          ))
        )}
      </AppBottomSheet>
    </YStack>
  )
}
