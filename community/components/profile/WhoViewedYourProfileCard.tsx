import { useEffect, useState } from 'react'
import { AppLink } from '~/components/navigation/AppLink'

import { ProfileLink } from '~/community/components/ProfileLink'
import { BRAND_BLUE } from '~/community/lib/constants'
import {
  fetchRecentProfileViewers,
  type ProfileViewer,
} from '~/community/lib/profile-views'
import {
  AppBottomSheet,
  Avatar,
  Button,
  Icons,
  Spinner,
  Text,
  XStack,
  YStack,
} from '~/components/ui'
import { getShadowStyle, radius } from '~/config/tokens'
import { communityRoutes } from '~/lib/routes'
import { useAppUi } from '~/lib/theme/useAppUi'

function formatViewedAt(value: string) {
  const date = new Date(value)
  const diff = Date.now() - date.getTime()
  const minutes = Math.floor(diff / (1000 * 60))
  if (minutes < 60) return `${Math.max(minutes, 1)}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return date.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })
}

type WhoViewedYourProfileCardProps = {
  profileUserId: string
  viewsCount?: number
}

/** professional “Who viewed your profile” card for the profile owner. */
export function WhoViewedYourProfileCard({
  profileUserId,
  viewsCount,
}: WhoViewedYourProfileCardProps) {
  const ui = useAppUi()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [viewers, setViewers] = useState<ProfileViewer[]>([])

  useEffect(() => {
    if (!open) return
    let active = true
    setLoading(true)
    void fetchRecentProfileViewers(profileUserId).then((result) => {
      if (!active) return
      setViewers(result.items)
      setLoading(false)
    })
    return () => {
      active = false
    }
  }, [open, profileUserId])

  return (
    <>
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
          <Icons.Eye size={18} color={BRAND_BLUE} />
          <Text fontSize={18} fontWeight="700" color={ui.text} letterSpacing={-0.25}>
            Who viewed your profile
          </Text>
        </XStack>
        <Text fontSize={14} color={ui.textMuted} lineHeight={20}>
          {viewsCount != null && viewsCount > 0
            ? `${viewsCount} profile view${viewsCount === 1 ? '' : 's'} in the last 30 days.`
            : 'See who recently visited your profile.'}
        </Text>
        <XStack gap="$2" flexWrap="wrap">
          <Button
            size="$3"
            tone="outline"
            borderRadius={999}
            alignSelf="flex-start"
            onPress={() => setOpen(true)}
          >
            See viewers
          </Button>
          <AppLink href={communityRoutes.analytics} asChild>
            <Button size="$3" tone="ghost" borderRadius={999} icon={<Icons.BarChart3 size={14} />}>
              Full analytics
            </Button>
          </AppLink>
        </XStack>
      </YStack>

      <AppBottomSheet
        open={open}
        onOpenChange={setOpen}
        title="Who viewed your profile"
      >
        {loading ? (
          <YStack alignItems="center" paddingVertical="$6">
            <Spinner size="large" />
          </YStack>
        ) : viewers.length === 0 ? (
          <YStack gap="$2" padding="$2">
            <Text fontSize={14} color={ui.textMuted} lineHeight={20}>
              No signed-in viewers in the last 30 days yet. Share your profile to get discovered.
            </Text>
          </YStack>
        ) : (
          <YStack gap="$3" padding="$2">
            {viewers.map((viewer) => (
              <XStack key={`${viewer.viewerId}-${viewer.viewedAt}`} gap="$3" alignItems="center">
                <ProfileLink userId={viewer.viewerId} username={viewer.username}>
                  <Avatar
                    name={viewer.fullName}
                    src={viewer.avatarUrl ?? undefined}
                    size="$4"
                    cursor="pointer"
                  />
                </ProfileLink>
                <YStack flex={1} gap={2} minWidth={0}>
                  <ProfileLink userId={viewer.viewerId} username={viewer.username}>
                    <Text fontSize={14} fontWeight="700" color={ui.text} numberOfLines={1}>
                      {viewer.fullName}
                    </Text>
                  </ProfileLink>
                  {viewer.headline ? (
                    <Text fontSize={12} color={ui.textMuted} numberOfLines={1}>
                      {viewer.headline}
                    </Text>
                  ) : null}
                </YStack>
                <Text fontSize={12} color={ui.textMuted}>
                  {formatViewedAt(viewer.viewedAt)}
                </Text>
              </XStack>
            ))}
          </YStack>
        )}
      </AppBottomSheet>
    </>
  )
}
