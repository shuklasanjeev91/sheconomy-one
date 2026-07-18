import { useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'one'

import { AppLink } from '~/components/navigation/AppLink'
import { ProfileView } from '~/community/components/profile/ProfileView'
import type { ProfileDisplay } from '~/community/components/profile/types'
import { ProfileVisitorActions } from '~/community/components/ProfileVisitorActions'
import { fetchPublicProfile, type PublicProfile } from '~/community/lib/network'
import { parseCreatorMode } from '~/community/lib/creator-mode'
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
} from '~/components/ui'
import { FullWidthLayout, PageSection } from '~/components/layout'
import { supabase } from '~/lib/supabase/client'
import { useSupabase } from '~/providers/SupabaseProvider'
import { communityRoutes, routes } from '~/lib/routes'
import { useAppUi } from '~/lib/theme/useAppUi'
import { usePageSeo } from '~/components/seo/RouteSeo'

export function PublicProfileScreen() {
  const ui = useAppUi()
  const router = useRouter()
  const { username: handle } = useParams<{ username: string }>()
  const { user: currentUser, isLoading: authLoading } = useSupabase()
  const [profile, setProfile] = useState<PublicProfile | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [creatorMode, setCreatorMode] = useState(false)
  const [mutualCount, setMutualCount] = useState(0)

  usePageSeo(
    useMemo(() => {
      if (!profile) return null
      const name = profile.full_name || profile.username
      return {
        title: name,
        description:
          profile.headline?.trim() ||
          profile.bio?.replace(/\s+/g, ' ').trim().slice(0, 200) ||
          `See ${name}'s profile on SHEconomy.`,
        image: profile.avatar_url,
        type: 'profile' as const,
      }
    }, [profile]),
  )

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
            width="100%"
            maxWidth="100%"
            alignSelf="stretch"
          >
            <Text fontWeight="600" fontSize={22} color={ui.text}>
              Profile not found
            </Text>
            <Paragraph color={ui.textSecondary}>
              {error ?? 'This profile could not be loaded.'}
            </Paragraph>
            <AppLink href={communityRoutes.network} asChild>
              <Button tone="primary" size="$4" borderRadius={999} alignSelf="flex-start">
                Browse network
              </Button>
            </AppLink>
          </YStack>
        </PageSection>
      </FullWidthLayout>
    )
  }

  const displayProfile: ProfileDisplay = profile

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
            headerActions={({ openUserList }) => (
              <ProfileVisitorActions
                targetUserId={profile.id}
                targetUsername={profile.username}
                displayName={profile.full_name || profile.username}
                headline={profile.headline}
                industry={profile.industry}
                creatorMode={creatorMode}
                mutualCount={mutualCount}
                onViewConnections={() => openUserList('connections')}
              />
            )}
          />
        </YStack>
      </PageSection>
    </FullWidthLayout>
  )
}
