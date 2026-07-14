import { useEffect, useState } from 'react'
import { Link, useParams, useRouter } from 'one'

import { ProfileConnectButton } from '~/community/components/ProfileConnectButton'
import { ProfileFollowButton } from '~/community/components/ProfileFollowButton'
import { MessageIcebreakerButton } from '~/community/components/MessageIcebreakerButton'
import { IntroductionRequestButton } from '~/community/components/IntroductionRequestButton'
import { ProfileView } from '~/community/components/profile/ProfileView'
import type { ProfileDisplay } from '~/community/components/profile/types'
import { fetchPublicProfile, type PublicProfile } from '~/community/lib/network'
import { parseCreatorMode } from '~/community/lib/creator-mode'
import { blockCommunityMember } from '~/community/lib/moderation'
import { fetchMutualConnectionsCount } from '~/community/lib/mutual'
import { trackProfileView } from '~/community/lib/profile-views'
import {
  Button,
  Icons,
  Paragraph,
  Spinner,
  Text,
  XStack,
  YStack,
  useAppToast,
} from '~/components/ui'
import { FullWidthLayout, PageSection } from '~/components/layout'
import { supabase } from '~/lib/supabase/client'
import { useSupabase } from '~/providers/SupabaseProvider'
import { communityRoutes, routes } from '~/lib/routes'
import { copyShareLink, getProfileShareUrl } from '~/lib/share'
import { useAppUi } from '~/lib/theme/useAppUi'

export function PublicProfileScreen() {
  const ui = useAppUi()
  const router = useRouter()
  const toast = useAppToast()
  const { username: handle } = useParams<{ username: string }>()
  const { user: currentUser, isLoading: authLoading } = useSupabase()
  const [profile, setProfile] = useState<PublicProfile | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [creatorMode, setCreatorMode] = useState(false)
  const [mutualCount, setMutualCount] = useState(0)
  const [blocking, setBlocking] = useState(false)

  useEffect(() => {
    if (!handle) return

    let active = true
    setIsLoading(true)
    fetchPublicProfile(handle).then(({ data, error: fetchError }) => {
      if (!active) return
      setProfile(data)
      setError(fetchError)
      setIsLoading(false)
      if (data?.id) {
        void supabase
          .from('profiles')
          .select('job_preferences')
          .eq('id', data.id)
          .maybeSingle()
          .then(({ data: row }) => {
            if (active) setCreatorMode(parseCreatorMode(row?.job_preferences).enabled)
          })
      }
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

  useEffect(() => {
    if (!profile?.id) return
    if (currentUser?.id && profile.id === currentUser.id) return
    void trackProfileView({
      profileUserId: profile.id,
      viewerUserId: currentUser?.id ?? null,
    })
  }, [currentUser?.id, profile?.id])

  useEffect(() => {
    if (!profile?.id || !currentUser?.id || profile.id === currentUser.id) {
      setMutualCount(0)
      return
    }
    let active = true
    void fetchMutualConnectionsCount(currentUser.id, profile.id).then((count) => {
      if (active) setMutualCount(count)
    })
    return () => {
      active = false
    }
  }, [currentUser?.id, profile?.id])

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
  const profileUrl = getProfileShareUrl(profile.username)

  return (
    <FullWidthLayout scroll>
      <PageSection paddingVertical="$3">
        <YStack gap="$3">
          {mutualCount > 0 ? (
            <XStack gap="$2" alignItems="center" paddingHorizontal="$1">
              <Icons.Users size={16} color={ui.textMuted} />
              <Text fontSize={14} color={ui.textMuted}>
                {mutualCount} mutual connection{mutualCount === 1 ? '' : 's'}
              </Text>
            </XStack>
          ) : null}
          <ProfileView
            profile={displayProfile}
            isOwnProfile={false}
            headerActions={
              <XStack gap="$2" flexWrap="wrap" alignItems="center">
                <MessageIcebreakerButton
                  targetUserId={profile.id}
                  targetUsername={profile.username}
                  displayName={profile.full_name || profile.username}
                  headline={profile.headline}
                  industry={profile.industry}
                  creatorMode={creatorMode}
                />
                {mutualCount > 0 ? (
                  <IntroductionRequestButton
                    targetUserId={profile.id}
                    targetUsername={profile.username}
                    targetDisplayName={profile.full_name || profile.username}
                  />
                ) : null}
                <ProfileConnectButton targetUserId={profile.id} />
                <ProfileFollowButton targetUserId={profile.id} />
                <Button
                  size="$3"
                  tone="outline"
                  borderRadius={999}
                  onPress={() => {
                    void copyShareLink(profileUrl).then((copied) => {
                      toast.show(copied ? 'Profile link copied' : 'Could not copy link', {
                        tone: copied ? 'success' : 'danger',
                      })
                    })
                  }}
                >
                  Share
                </Button>
                {currentUser?.id ? (
                  <Button
                    size="$3"
                    tone="outline"
                    borderRadius={999}
                    disabled={blocking}
                    onPress={() => {
                      setBlocking(true)
                      void blockCommunityMember(currentUser.id, profile.id).then((result) => {
                        setBlocking(false)
                        if (result.error) {
                          toast.show('Could not block', { tone: 'danger', message: result.error })
                          return
                        }
                        toast.show('Member blocked', { tone: 'default' })
                        router.push(communityRoutes.network)
                      })
                    }}
                  >
                    {blocking ? 'Blocking…' : 'Block'}
                  </Button>
                ) : null}
              </XStack>
            }
          />
        </YStack>
      </PageSection>
    </FullWidthLayout>
  )
}