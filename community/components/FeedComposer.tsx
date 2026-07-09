import { Link, useRouter } from 'one'
import { useState } from 'react'
import type { Href } from 'one'

import { GifPicker } from '~/community/components/GifPicker'
import { CommunityCard } from '~/community/components/CommunityCard'
import { useCommunityUi } from '~/community/lib/community-theme'
import { Avatar, Icons, Text, XStack } from '~/components/ui'
import { communityRoutes, routes } from '~/lib/routes'
import { buildSignInUrl } from '~/lib/auth/redirect'
import { useProfile } from '~/hooks/useProfile'

type FeedComposerProps = {
  onGifSelect?: (url: string) => void
}

export function FeedComposer({ onGifSelect }: FeedComposerProps) {
  const communityUi = useCommunityUi()
  const router = useRouter()
  const { profile, isAuthenticated } = useProfile()
  const name = profile?.full_name || profile?.username || 'You'
  const [gifOpen, setGifOpen] = useState(false)

  const composeHref = (isAuthenticated ? communityRoutes.createPost : buildSignInUrl(communityRoutes.createPost)) as Href
  const eventHref = (isAuthenticated ? communityRoutes.eventCreate : buildSignInUrl(communityRoutes.eventCreate)) as Href
  const mediaHref = composeHref
  const articleHref = composeHref

  function handleGif(url: string) {
    if (!isAuthenticated) {
      router.push(buildSignInUrl(communityRoutes.createPost) as never)
      return
    }
    if (onGifSelect) {
      onGifSelect(url)
      return
    }
    router.push(`${communityRoutes.createPost}?gif=${encodeURIComponent(url)}` as never)
  }

  return (
    <>
      <CommunityCard
        padding={12}
        gap={8}
        display="none"
        $gtLg={{ display: 'flex' }}
      >
        <XStack gap={8} alignItems="center">
          <Link href={(isAuthenticated ? communityRoutes.profile : routes.signIn) as Href} asChild>
            <Avatar name={name} src={profile?.avatar_url ?? undefined} size="$4" cursor="pointer" />
          </Link>
          <Link href={composeHref} asChild>
            <XStack
              flex={1}
              backgroundColor={communityUi.pageBg}
              borderRadius={999}
              borderWidth={1}
              borderColor={communityUi.border}
              paddingHorizontal={16}
              paddingVertical={12}
              cursor="pointer"
              hoverStyle={{ backgroundColor: communityUi.borderLight }}
            >
              <Text fontSize={14} fontWeight="600" color={communityUi.textMuted}>
                {isAuthenticated ? 'Start a post' : 'Sign in to post'}
              </Text>
            </XStack>
          </Link>
        </XStack>

        <XStack borderTopWidth={1} borderTopColor={communityUi.borderLight} paddingTop={4}>
          <ComposerAction icon={Icons.Image} label="Media" color="#70b5f9" href={mediaHref} />
          <ComposerAction
            icon={Icons.Film}
            label="GIF"
            color="#7fc15e"
            onPress={() => {
              if (!isAuthenticated) {
                router.push(buildSignInUrl(communityRoutes.createPost) as never)
                return
              }
              setGifOpen(true)
            }}
          />
          <ComposerAction icon={Icons.Calendar} label="Event" color="#e7a33e" href={eventHref} />
          <ComposerAction icon={Icons.FileText} label="Write article" color="#fc9295" href={articleHref} />
        </XStack>
      </CommunityCard>

      <GifPicker
        open={gifOpen}
        onOpenChange={setGifOpen}
        onSelect={(url) => {
          handleGif(url)
          setGifOpen(false)
        }}
      />
    </>
  )
}

function ComposerAction({
  icon: Icon,
  label,
  color,
  href,
  onPress,
}: {
  icon: typeof Icons.Image
  label: string
  color: string
  href?: Href
  onPress?: () => void
}) {
  const communityUi = useCommunityUi()
  const content = (
    <XStack
      gap={8}
      alignItems="center"
      paddingVertical={12}
      paddingHorizontal={4}
      borderRadius={4}
      cursor="pointer"
      flex={1}
      justifyContent="center"
      hoverStyle={{ backgroundColor: communityUi.divider }}
      onPress={onPress}
    >
      <Icon size={20} color={color} />
      <Text fontSize={14} fontWeight="600" color={communityUi.textMuted} display="none" $gtSm={{ display: 'flex' }}>
        {label}
      </Text>
    </XStack>
  )

  if (href && !onPress) {
    return (
      <Link href={href} asChild>
        {content}
      </Link>
    )
  }

  return content
}
