import { useEffect, useState } from 'react'
import { AppLink } from '~/components/navigation/AppLink'

import { BRAND_BLUE } from '~/community/lib/constants'
import {
  fetchFeaturedPosts,
  setPostFeatured,
} from '~/community/lib/featured-posts'
import type { CommunityPost } from '~/community/lib/community'
import { postMediaUrls } from '~/community/lib/post-media'
import { htmlToPlainText } from '~/community/lib/post-text'
import {
  Button,
  Icons,
  Image,
  Spinner,
  Text,
  XStack,
  YStack,
  useAppToast,
} from '~/components/ui'
import { getShadowStyle, radius } from '~/config/tokens'
import { communityRoutes } from '~/lib/routes'
import { useAppUi } from '~/lib/theme/useAppUi'

type FeaturedPostsSectionProps = {
  profileUserId: string
  isOwnProfile: boolean
}

export function FeaturedPostsSection({
  profileUserId,
  isOwnProfile,
}: FeaturedPostsSectionProps) {
  const ui = useAppUi()
  const toast = useAppToast()
  const [items, setItems] = useState<CommunityPost[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)

  async function reload() {
    setLoading(true)
    const result = await fetchFeaturedPosts(profileUserId)
    setItems(result.items)
    setLoading(false)
  }

  useEffect(() => {
    void reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileUserId])

  async function handleUnpin(postId: string) {
    setBusyId(postId)
    const { error } = await setPostFeatured(postId, profileUserId, false)
    setBusyId(null)
    if (error) {
      toast.show('Could not update featured post', { tone: 'danger', message: error })
      return
    }
    setItems((prev) => prev.filter((item) => item.id !== postId))
    toast.show('Removed from Featured', { tone: 'success' })
  }

  if (!loading && items.length === 0 && !isOwnProfile) return null

  return (
    <YStack
      backgroundColor={ui.surface}
      borderRadius={radius.card}
      borderWidth={1}
      borderColor={ui.borderSubtle}
      padding="$4"
      gap="$3"
      style={getShadowStyle('sm')}
    >
      <XStack gap="$2.5" alignItems="center">
        <YStack width={3} height={20} borderRadius={999} backgroundColor={ui.brand} opacity={0.85} />
        <Icons.Star size={18} color={BRAND_BLUE} />
        <Text fontSize={18} fontWeight="700" color={ui.text} letterSpacing={-0.25}>
          Featured
        </Text>
      </XStack>

      {loading ? (
        <YStack alignItems="center" paddingVertical="$4">
          <Spinner size="small" />
        </YStack>
      ) : items.length === 0 ? (
        <Text fontSize={14} color={ui.textMuted} lineHeight={20}>
          Feature up to 3 posts from the ••• menu on your posts so visitors see your best work first.
        </Text>
      ) : (
        <YStack gap="$3">
          {items.map((post) => {
            const preview = htmlToPlainText(post.content).slice(0, 140)
            const thumb = postMediaUrls(post)[0] || null
            return (
              <XStack
                key={post.id}
                gap="$3"
                alignItems="flex-start"
                padding="$3"
                borderRadius={12}
                borderWidth={1}
                borderColor={ui.borderSubtle}
                backgroundColor={ui.surfaceMuted}
              >
                <AppLink href={communityRoutes.post(post.id)} asChild>
                  <YStack flex={1} gap="$2" cursor="pointer" minWidth={0}>
                    {thumb ? (
                      <Image
                        src={thumb}
                        width="100%"
                        height={120}
                        objectFit="cover"
                        borderRadius={8}
                        alt=""
                      />
                    ) : null}
                    <Text fontSize={14} color={ui.text} lineHeight={20} numberOfLines={3}>
                      {preview || 'Featured post'}
                    </Text>
                    <Text fontSize={12} fontWeight="600" color={BRAND_BLUE}>
                      View post
                    </Text>
                  </YStack>
                </AppLink>
                {isOwnProfile ? (
                  <Button
                    size="$2"
                    tone="outline"
                    disabled={busyId === post.id}
                    onPress={() => void handleUnpin(post.id)}
                  >
                    Unpin
                  </Button>
                ) : null}
              </XStack>
            )
          })}
        </YStack>
      )}
    </YStack>
  )
}
