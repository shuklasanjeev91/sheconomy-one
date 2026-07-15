import { Link } from 'one'
import { useState } from 'react'

import { useProfileFollow } from '~/community/hooks/useProfileFollow'
import { useCommunityUi } from '~/community/lib/community-theme'
import { ConfirmDialog, Spinner, Text, XStack } from '~/components/ui'
import { routes } from '~/lib/routes'

type ProfileFollowButtonProps = {
  targetUserId?: string | null
  size?: 'sm' | 'md'
}

export function ProfileFollowButton({ targetUserId, size = 'md' }: ProfileFollowButtonProps) {
  const communityUi = useCommunityUi()
  const follow = useProfileFollow(targetUserId)
  const [confirmUnfollow, setConfirmUnfollow] = useState(false)

  if (!targetUserId || follow.isLoading) {
    return (
      <XStack minWidth={size === 'sm' ? 80 : 92} minHeight={size === 'sm' ? 32 : 36} alignItems="center" justifyContent="center">
        <Spinner size="small" color={communityUi.brand} />
      </XStack>
    )
  }

  if (follow.isSelf) return null

  if (!follow.isAuthenticated) {
    return (
      <Link href={routes.signIn} asChild>
        <FollowChip label="Follow" variant="primary" size={size} />
      </Link>
    )
  }

  return (
    <>
      <FollowChip
        label={follow.isFollowing ? 'Following' : 'Follow'}
        variant="outline"
        size={size}
        disabled={follow.isToggling}
        isLoading={follow.isToggling}
        onPress={() => {
          if (follow.isFollowing) {
            setConfirmUnfollow(true)
          } else {
            void follow.toggleFollow()
          }
        }}
      />      <ConfirmDialog
        open={confirmUnfollow}
        onOpenChange={setConfirmUnfollow}
        title="Unfollow?"
        description="You'll stop seeing their posts in your feed. You can follow again anytime."
        confirmLabel="Unfollow"
        destructive
        onConfirm={() => {
          void follow.toggleFollow()
        }}
      />
    </>
  )
}

function FollowChip({
  label,
  variant,
  size,
  disabled,
  isLoading,
  onPress,
}: {
  label: string
  variant: 'primary' | 'outline'
  size: 'sm' | 'md'
  disabled?: boolean
  isLoading?: boolean
  onPress?: () => void
}) {
  const communityUi = useCommunityUi()
  const isPrimary = variant === 'primary'

  return (
    <XStack
      paddingHorizontal={size === 'sm' ? 10 : 14}
      paddingVertical={size === 'sm' ? 5 : 6}
      borderRadius={20}
      borderWidth={1}
      borderColor={isPrimary ? communityUi.brand : communityUi.border}
      backgroundColor={isPrimary ? communityUi.brand : communityUi.cardBg}
      minWidth={size === 'sm' ? 80 : 92}
      alignItems="center"
      justifyContent="center"
      opacity={disabled ? 0.6 : 1}
      cursor={disabled ? 'default' : 'pointer'}
      hoverStyle={disabled ? undefined : { opacity: 0.9 }}
      onPress={disabled ? undefined : onPress}
    >
      {isLoading ? (
        <Spinner size="small" color={isPrimary ? 'white' : communityUi.brand} />
      ) : (
        <Text
          fontSize={size === 'sm' ? 13 : 14}
          fontWeight="600"
          color={isPrimary ? 'white' : communityUi.textMuted}
        >
          {label}
        </Text>
      )}
    </XStack>
  )
}