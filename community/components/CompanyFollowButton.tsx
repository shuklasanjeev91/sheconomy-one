import { useCompanyFollow } from '~/community/hooks/useCompanyFollow'
import { AppLink } from '~/components/navigation/AppLink'
import type { CompanyPage } from '~/community/lib/companies'
import { useCommunityUi } from '~/community/lib/community-theme'
import { Spinner, Text, XStack } from '~/components/ui'
import { routes } from '~/lib/routes'

type CompanyFollowButtonProps = {
  company?: CompanyPage | null
  /** Use when only the id is known, e.g. community suggestion rows. */
  companyId?: string | null
  size?: 'sm' | 'md'
}

export function CompanyFollowButton({ company, companyId, size = 'md' }: CompanyFollowButtonProps) {
  const communityUi = useCommunityUi()
  const follow = useCompanyFollow(companyId ?? company)

  if ((!company && !companyId) || follow.isLoading) {
    return <Spinner size="small" color={communityUi.brand} />
  }

  // You manage this page — following your own page is a no-op.
  if (follow.isManager) return null

  if (!follow.isAuthenticated) {
    return (
      <AppLink href={routes.signIn} asChild>
        <Chip label="Follow" primary size={size} />
      </AppLink>
    )
  }

  return (
    <Chip
      label={follow.isFollowing ? 'Following' : 'Follow'}
      primary={!follow.isFollowing}
      size={size}
      disabled={follow.isToggling}
      onPress={follow.toggle}
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
