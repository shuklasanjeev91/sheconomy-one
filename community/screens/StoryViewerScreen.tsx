import { useParams, useRouter } from 'one'
import { useCallback, useEffect, useState } from 'react'

import { fetchUserStories, markStoryViewed, type StorySlide } from '~/community/lib/stories'
import { useCommunityUi } from '~/community/lib/community-theme'
import { Spinner, Text, XStack, YStack } from '~/components/ui'
import { communityRoutes } from '~/lib/routes'
import { useSupabase } from '~/providers/SupabaseProvider'

const SLIDE_MS = 5000

export function StoryViewerScreen() {
  const communityUi = useCommunityUi()
  const { userId } = useParams<{ userId: string }>()
  const router = useRouter()
  const { user } = useSupabase()
  const [slides, setSlides] = useState<StorySlide[]>([])
  const [index, setIndex] = useState(0)
  const [isLoading, setIsLoading] = useState(true)

  const load = useCallback(async () => {
    if (!userId) return
    setIsLoading(true)
    const data = await fetchUserStories(userId)
    setSlides(data)
    setIndex(0)
    setIsLoading(false)
  }, [userId])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    const slide = slides[index]
    if (!slide || !user) return
    markStoryViewed(slide.id, user.id)
  }, [index, slides, user])

  useEffect(() => {
    if (!slides.length) return
    const timer = setTimeout(() => {
      if (index < slides.length - 1) setIndex((i) => i + 1)
      else router.replace(communityRoutes.home)
    }, SLIDE_MS)
    return () => clearTimeout(timer)
  }, [index, slides.length, router])

  if (isLoading) {
    return (
      <YStack flex={1} alignItems="center" justifyContent="center" backgroundColor="#000">
        <Spinner size="large" color="white" />
      </YStack>
    )
  }

  if (!slides.length) {
    return (
      <YStack flex={1} alignItems="center" justifyContent="center" backgroundColor="#000" padding={24}>
        <Text color="white">No active stories.</Text>
      </YStack>
    )
  }

  const slide = slides[index]
  const progress = (index + 1) / slides.length

  return (
    <YStack flex={1} backgroundColor="#000" position="relative">
      <XStack position="absolute" top={16} left={16} right={16} gap={4} zIndex={2}>
        {slides.map((s, i) => (
          <YStack key={s.id} flex={1} height={3} borderRadius={2} backgroundColor="rgba(255,255,255,0.3)" overflow="hidden">
            <YStack
              height="100%"
              width={i < index ? '100%' : i === index ? `${progress * 100}%` : '0%'}
              backgroundColor="white"
            />
          </YStack>
        ))}
      </XStack>

      <XStack
        position="absolute"
        top={0}
        left={0}
        right="50%"
        bottom={0}
        zIndex={3}
        cursor="pointer"
        onPress={() => (index > 0 ? setIndex(index - 1) : router.back())}
      />
      <XStack
        position="absolute"
        top={0}
        left="50%"
        right={0}
        bottom={0}
        zIndex={3}
        cursor="pointer"
        onPress={() => (index < slides.length - 1 ? setIndex(index + 1) : router.replace(communityRoutes.home))}
      />

      <YStack flex={1} alignItems="center" justifyContent="center" padding={24}>
        {slide.media_type === 'image' && slide.media_url ? (
          // eslint-disable-next-line jsx-a11y/alt-text
          <img src={slide.media_url} style={{ maxWidth: '100%', maxHeight: '80vh', objectFit: 'contain' }} />
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
      </YStack>
    </YStack>
  )
}