import { useRouter } from 'one'
import { AppLink } from '~/components/navigation/AppLink'
import type { Href } from 'one'

import { CommunityCard } from '~/community/components/CommunityCard'
import { openComposer, type ComposerOptions } from '~/community/lib/composer-store'
import { useCommunityUi } from '~/community/lib/community-theme'
import { Avatar, Icons, Text, XStack, YStack } from '~/components/ui'
import { communityRoutes, routes } from '~/lib/routes'
import { buildSignInUrl } from '~/lib/auth/redirect'
import { useProfile } from '~/hooks/useProfile'

export function FeedComposer() {
  const communityUi = useCommunityUi()
  const router = useRouter()
  const { profile, isAuthenticated } = useProfile()
  const name = profile?.full_name || profile?.username || 'You'

  // Every entry point opens the shared composer overlay. Unauthenticated users
  // are routed through sign-in first (returning to the feed afterwards).
  function compose(options: ComposerOptions = {}) {
    if (!isAuthenticated) {
      router.push(buildSignInUrl(communityRoutes.home) as never)
      return
    }
    openComposer(options)
  }

  return (
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
          <ComposerAction icon={Icons.Image} label="Photo" color="#70b5f9" onPress={() => compose({ media: true })} />
          <ComposerAction icon={Icons.Video} label="Video" color="#e74c3c" onPress={() => compose({ video: true })} />
          <ComposerAction icon={Icons.Calendar} label="Event" color="#e7a33e" onPress={() => compose({ mode: 'event' })} />
          <ComposerAction icon={Icons.PartyPopper} label="Celebrate" color="#c37dda" onPress={() => compose({ mode: 'celebration' })} />
          <ComposerAction icon={Icons.BarChart2} label="Poll" color="#7fc15e" onPress={() => compose({ mode: 'poll' })} />
        </XStack>
      </CommunityCard>
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
    <YStack
      flex={1}
      alignItems="center"
      justifyContent="center"
      paddingVertical={8}
      borderRadius={999}
      cursor="pointer"
      hoverStyle={{ backgroundColor: communityUi.hoverBg }}
      pressStyle={{ opacity: 0.75 }}
      onPress={onPress}
      accessibilityLabel={label}
      aria-label={label}
    >
      <Icon size={22} color={color} />
      <Text fontSize={12} fontWeight="600" color={communityUi.textMuted} marginTop={4} display="none" $gtMd={{ display: 'flex' }}>
        {label}
      </Text>
    </YStack>
  )
}
