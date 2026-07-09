import { useEffect, useState } from 'react'
import { Link, useParams, useRouter } from 'one'

import { CommunityShell } from '~/community/components/CommunityShell'
import { ProfileConnectButton } from '~/community/components/ProfileConnectButton'
import { ProfileFollowButton } from '~/community/components/ProfileFollowButton'
import { ProfileView } from '~/community/components/profile/ProfileView'
import type { ProfileDisplay } from '~/community/components/profile/types'
import { fetchPublicProfile, type PublicProfile } from '~/community/lib/network'
import {
  Button,
  Paragraph,
  Spinner,
  Text,
  XStack,
  YStack,
} from '~/components/ui'
import { FullWidthLayout, PageSection } from '~/components/layout'
import { useSupabase } from '~/providers/SupabaseProvider'
import { communityRoutes, routes } from '~/lib/routes'
import { useAppUi } from '~/lib/theme/useAppUi'

export function PublicProfileScreen() {
  const ui = useAppUi()
  const router = useRouter()
  const { username: handle } = useParams<{ username: string }>()
  const { user: currentUser, isLoading: authLoading } = useSupabase()
  const [profile, setProfile] = useState<PublicProfile | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!handle) return

    let active = true
    setIsLoading(true)
    fetchPublicProfile(handle).then(({ data, error: fetchError }) => {
      if (!active) return
      setProfile(data)
      setError(fetchError)
      setIsLoading(false)
    })

    return () => {
      active = false
    }
  }, [handle])

  useEffect(() => {
    if (authLoading || isLoading || !profile || !currentUser) return
    if (profile.id === currentUser.id) {
      router.replace(routes.profile)
    }
  }, [authLoading, currentUser, isLoading, profile, router])

  if (isLoading || authLoading) {
    return (
      <FullWidthLayout scroll>
        <PageSection paddingVertical="$10">
          <YStack alignItems="center">
            <Spinner size="large" />
          </YStack>
        </PageSection>
      </FullWidthLayout>
    )
  }

  if (error || !profile) {
    return (
      <FullWidthLayout scroll>
        <PageSection paddingVertical="$8">
          <YStack
            gap="$4"
            padding="$6"
            borderRadius={12}
            borderWidth={1}
            borderColor={ui.border}
            backgroundColor={ui.surface}
            maxWidth={480}
          >
            <Text fontWeight="600" fontSize={22} color={ui.text}>
              Profile not found
            </Text>
            <Paragraph color={ui.textSecondary}>
              {error ?? 'This profile could not be loaded.'}
            </Paragraph>
            <Link href={communityRoutes.network} asChild>
              <Button tone="primary" size="$4" borderRadius={999} alignSelf="flex-start">
                Browse network
              </Button>
            </Link>
          </YStack>
        </PageSection>
      </FullWidthLayout>
    )
  }

  const displayProfile: ProfileDisplay = profile

  return (
    <CommunityShell wide>
      <ProfileView
        profile={displayProfile}
        isOwnProfile={false}
        headerActions={
          <XStack gap="$2" flexWrap="wrap" alignItems="center">
            <ProfileConnectButton targetUserId={profile.id} />
            <ProfileFollowButton targetUserId={profile.id} />
          </XStack>
        }
      />
    </CommunityShell>
  )
}