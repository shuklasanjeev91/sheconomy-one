import { useGroupMembership } from '~/community/hooks/useGroupMembership'
import { AppLink } from '~/components/navigation/AppLink'
import { useCommunityUi } from '~/community/lib/community-theme'
import { Spinner, Text, XStack, useAppToast } from '~/components/ui'
import { routes } from '~/lib/routes'

type GroupJoinButtonProps = {
  groupId?: string | null
  groupType?: string | null
  size?: 'sm' | 'md'
}

/** Join / request-to-join chip for group rows outside the group screen. */
export function GroupJoinButton({ groupId, groupType, size = 'md' }: GroupJoinButtonProps) {
  const communityUi = useCommunityUi()
  const toast = useAppToast()
  const membership = useGroupMembership(groupId, groupType)

  if (!groupId || membership.isLoading) {
    return <Spinner size="small" color={communityUi.brand} />
  }

  if (!membership.isAuthenticated) {
    return (
      <AppLink href={routes.signIn} asChild>
        <Chip label="Join" primary size={size} />
      </AppLink>
    )
  }

  if (membership.isMember) {
    return <Chip label="Joined" size={size} />
  }

  if (membership.isPending) {
    return <Chip label="Pending" size={size} />
  }

  return (
    <Chip
      label={groupType === 'private' ? 'Request' : 'Join'}
      primary
      size={size}
      disabled={membership.isToggling}
      onPress={async () => {
        const result = await membership.join()
        if (result.error) {
          toast.show('Could not join', { tone: 'danger', message: result.error })
          return
        }
        toast.show(result.pending ? 'Request sent' : 'Joined group', { tone: 'success' })
      }}
    />
  )
}

function Chip({
  label,
  primary,
  disabled,
  onPress,
  size = 'md',
}: {
  label: string
  primary?: boolean
  disabled?: boolean
  onPress?: () => void
  size?: 'sm' | 'md'
}) {
  const communityUi = useCommunityUi()
  return (
    <XStack
      paddingHorizontal={size === 'sm' ? 12 : 16}
      paddingVertical={size === 'sm' ? 5 : 8}
      borderRadius={999}
      borderWidth={1}
      borderColor={primary ? communityUi.brand : communityUi.border}
      backgroundColor={primary ? communityUi.brand : communityUi.cardBg}
      opacity={disabled ? 0.6 : 1}
      cursor={disabled ? 'default' : 'pointer'}
      onPress={disabled ? undefined : onPress}
    >
      <Text
        fontSize={size === 'sm' ? 13 : 14}
        fontWeight="600"
        color={primary ? 'white' : communityUi.textMuted}
      >
        {label}
      </Text>
    </XStack>
  )
}
