import { useEffect, useState } from 'react'
import { Share } from 'react-native'

import { FullWidthLayout, PageSection } from '~/components/layout'
import { AppLink } from '~/components/navigation/AppLink'
import { Avatar, Button, Icons, Spinner, Text, XStack, YStack, useAppToast } from '~/components/ui'
import { BRAND_NAME } from '~/config/brand'
import { fetchPublishedProgramsPage } from '~/class/lib/programs'
import { fetchUserPosts } from '~/community/lib/user-activity'
import { fetchHostedMeetings } from '~/co-work/lib/meetings'
import { copyToClipboard } from '~/lib/platform/clipboard'
import {
  classRoutes,
  commerceRoutes,
  communityRoutes,
  coWorkRoutes,
} from '~/lib/routes'
import { getCreatorHubShareUrl } from '~/lib/share'
import { supabase } from '~/lib/supabase/client'
import { useAppUi } from '~/lib/theme/useAppUi'

type CreatorHubScreenProps = {
  username: string
}

type HubProfile = {
  id: string
  full_name: string | null
  username: string
  avatar_url: string | null
  headline: string | null
  bio: string | null
  is_verified: boolean | null
}

type HubShop = {
  id: string
  shop_name: string
  slug: string | null
  logo_url: string | null
}

export function CreatorHubScreen({ username }: CreatorHubScreenProps) {
  const ui = useAppUi()
  const toast = useAppToast()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [profile, setProfile] = useState<HubProfile | null>(null)
  const [shop, setShop] = useState<HubShop | null>(null)
  const [postCount, setPostCount] = useState(0)
  const [programCount, setProgramCount] = useState(0)
  const [meetingCount, setMeetingCount] = useState(0)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)
      const handle = username.trim().replace(/^@/, '')
      if (!handle) {
        setError('Creator not found')
        setLoading(false)
        return
      }

      const { data: row, error: profileError } = await supabase
        .from('profiles')
        .select('id, full_name, username, avatar_url, headline, bio, is_verified')
        .ilike('username', handle)
        .maybeSingle()

      if (cancelled) return
      if (profileError || !row) {
        setError('Creator not found')
        setProfile(null)
        setLoading(false)
        return
      }

      setProfile(row as HubProfile)

      const [{ data: shopRow }, posts, programs, meetings] = await Promise.all([
        supabase
          .from('shops')
          .select('id, shop_name, slug, logo_url')
          .eq('user_id', row.id)
          .eq('is_active', true)
          .order('created_at', { ascending: true })
          .limit(1)
          .maybeSingle(),
        fetchUserPosts(row.id, 0, 1),
        fetchPublishedProgramsPage(0, 1, { authorId: row.id }),
        fetchHostedMeetings(row.id).catch(() => []),
      ])

      if (cancelled) return
      setShop((shopRow as HubShop | null) ?? null)
      setPostCount(posts.items.length > 0 || posts.hasMore ? Math.max(posts.items.length, 1) : 0)
      setProgramCount(programs.programs?.length ? Math.max(programs.programs.length, 1) : 0)
      setMeetingCount(Array.isArray(meetings) ? meetings.length : 0)
      setLoading(false)
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [username])

  async function handleShare() {
    if (!profile?.username) return
    const url = getCreatorHubShareUrl(profile.username)
    try {
      await Share.share({
        title: `${profile.full_name || profile.username} on ${BRAND_NAME}`,
        message: `Visit my SHEconomy hub\n${url}`,
        url,
      })
    } catch {
      const copied = await copyToClipboard(url)
      toast.show(copied ? 'Link copied' : 'Could not share', {
        tone: copied ? 'success' : 'danger',
      })
    }
  }

  if (loading) {
    return (
      <FullWidthLayout>
        <PageSection paddingVertical="$10" alignItems="center">
          <Spinner size="large" />
        </PageSection>
      </FullWidthLayout>
    )
  }

  if (error || !profile) {
    return (
      <FullWidthLayout>
        <PageSection paddingVertical="$10" gap="$3" alignItems="center">
          <Text color={ui.textSecondary}>{error ?? 'Creator not found'}</Text>
          <AppLink href={commerceRoutes.home} asChild>
            <Button tone="primary" borderRadius={999}>
              Browse {BRAND_NAME}
            </Button>
          </AppLink>
        </PageSection>
      </FullWidthLayout>
    )
  }

  const displayName = profile.full_name?.trim() || profile.username
  const links: { key: string; label: string; href: string; subtitle: string }[] = []
  if (shop?.slug) {
    links.push({
      key: 'shop',
      label: shop.shop_name || 'Shop',
      href: commerceRoutes.shop(shop.slug) as string,
      subtitle: 'Browse products',
    })
  }
  if (postCount > 0) {
    links.push({
      key: 'posts',
      label: 'Community',
      href: communityRoutes.userProfile(profile.username) as string,
      subtitle: 'Posts and updates',
    })
  }
  if (programCount > 0) {
    links.push({
      key: 'class',
      label: 'Class',
      href: classRoutes.home as string,
      subtitle: 'Learning programs',
    })
  }
  if (meetingCount > 0) {
    links.push({
      key: 'cowork',
      label: 'Co-Work',
      href: coWorkRoutes.home as string,
      subtitle: 'Upcoming meetings',
    })
  }

  return (
    <FullWidthLayout scroll>
      <PageSection paddingVertical="$6" gap="$5" maxWidth={520} alignSelf="center" width="100%">
        <YStack alignItems="center" gap="$3">
          <Text fontSize={12} fontWeight="700" color={ui.brand} letterSpacing={0.6}>
            {BRAND_NAME}
          </Text>
          <Avatar name={displayName} src={profile.avatar_url ?? undefined} size="$8" />
          <YStack alignItems="center" gap={4}>
            <XStack alignItems="center" gap="$2">
              <Text fontSize={24} fontWeight="800" color={ui.text} textAlign="center">
                {displayName}
              </Text>
              {profile.is_verified ? <Icons.BadgeCheck size={18} color={ui.brand} /> : null}
            </XStack>
            <Text fontSize={14} color={ui.textMuted}>
              @{profile.username}
            </Text>
            {profile.headline ? (
              <Text fontSize={14} color={ui.textSecondary} textAlign="center">
                {profile.headline}
              </Text>
            ) : null}
            {profile.bio ? (
              <Text fontSize={13} color={ui.textSecondary} textAlign="center" lineHeight={19}>
                {profile.bio}
              </Text>
            ) : null}
          </YStack>
          <Button
            size="$3"
            tone="outline"
            borderRadius={999}
            icon={<Icons.Share2 size={14} />}
            onPress={() => void handleShare()}
          >
            Share hub
          </Button>
        </YStack>

        <YStack gap="$2">
          {links.length ? (
            links.map((link) => (
              <AppLink key={link.key} href={link.href as never} asChild>
                <XStack
                  alignItems="center"
                  justifyContent="space-between"
                  padding="$4"
                  borderRadius={16}
                  borderWidth={1}
                  borderColor={ui.borderSubtle}
                  backgroundColor={ui.surface}
                  pressStyle={{ opacity: 0.92 }}
                >
                  <YStack flex={1} gap={2} minWidth={0}>
                    <Text fontSize={16} fontWeight="800" color={ui.text}>
                      {link.label}
                    </Text>
                    <Text fontSize={12} color={ui.textSecondary}>
                      {link.subtitle}
                    </Text>
                  </YStack>
                  <Icons.ChevronRight size={18} color={ui.textMuted} />
                </XStack>
              </AppLink>
            ))
          ) : (
            <Text fontSize={14} color={ui.textSecondary} textAlign="center">
              This creator has not published public hubs yet.
            </Text>
          )}
        </YStack>
      </PageSection>
    </FullWidthLayout>
  )
}
