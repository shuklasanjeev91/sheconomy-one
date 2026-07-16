import { useRouter } from 'one'
import { AppLink } from '~/components/navigation/AppLink'
import { useState } from 'react'
import type { Href } from 'one'

import { GifPicker } from '~/community/components/GifPicker'
import { CommunityCard } from '~/community/components/CommunityCard'
import { openComposer, type ComposerOptions } from '~/community/lib/composer-store'
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

  // Every entry point opens the shared composer overlay. Unauthenticated users
  // are routed through sign-in first (returning to the feed afterwards).
  function compose(options: ComposerOptions = {}) {
    if (!isAuthenticated) {
      router.push(buildSignInUrl(communityRoutes.home) as never)
      return
    }
    openComposer(options)
  }

  function handleGif(url: string) {
    if (onGifSelect) {
      onGifSelect(url)
      return
    }
    compose({ gifUrl: url })
  }

  return (
    <>
      <CommunityCard padding={16} gap={12}>
        <XStack gap={10} alignItems="center">
          <AppLink href={(isAuthenticated ? communityRoutes.profile : routes.signIn) as Href} asChild>
            <Avatar name={name} src={profile?.avatar_url ?? undefined} size="$4" cursor="pointer" />
          </AppLink>
          <XStack
            flex={1}
            backgroundColor={communityUi.pageBg}
            borderRadius={999}
            borderWidth={1}
            borderColor={communityUi.border}
            paddingHorizontal={18}
            paddingVertical={13}
            cursor="pointer"
            animation="quick"
            hoverStyle={{ backgroundColor: communityUi.borderLight, borderColor: communityUi.brand }}
            onPress={() => compose()}
          >
            <Text fontSize={14} fontWeight="600" color={communityUi.textMuted}>
              {isAuthenticated ? 'Share what’s on your mind' : 'Sign in to post'}
            </Text>
          </XStack>
        </XStack>

        <XStack borderTopWidth={1} borderTopColor={communityUi.borderLight} paddingTop={8}>
          <ComposerAction icon={Icons.Image} label="Media" color="#70b5f9" onPress={() => compose({ media: true })} />
          <ComposerAction
            icon={Icons.Film}
            label="GIF"
            color="#7fc15e"
            onPress={() => {
              if (!isAuthenticated) {
                router.push(buildSignInUrl(communityRoutes.home) as never)
                return
              }
              setGifOpen(true)
            }}
          />
          <ComposerAction icon={Icons.BarChart2} label="Poll" color="#c37dda" onPress={() => compose({ mode: 'poll' })} />
          <ComposerAction icon={Icons.Calendar} label="Event" color="#e7a33e" onPress={() => compose({ mode: 'event' })} />
          <ComposerAction icon={Icons.PartyPopper} label="Celebrate" color="#e7a33e" onPress={() => compose({ mode: 'celebration' })} />
          <ComposerAction icon={Icons.Tag} label="Product" color="#0a66c2" onPress={() => compose({ mode: 'product' })} />
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
  onPress,
}: {
  icon: typeof Icons.Image
  label: string
  color: string
  onPress: () => void
}) {
  const communityUi = useCommunityUi()
  return (
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
}
