import { Link } from 'one'

import { useCompanyFollow } from '~/community/hooks/useCompanyFollow'
import type { CompanyPage } from '~/community/lib/companies'
import { useCommunityUi } from '~/community/lib/community-theme'
import { Spinner, Text, XStack } from '~/components/ui'
import { routes } from '~/lib/routes'

export function CompanyFollowButton({ company }: { company?: CompanyPage | null }) {
  const communityUi = useCommunityUi()
  const follow = useCompanyFollow(company)

  if (!company || follow.isLoading) {
    return <Spinner size="small" color={communityUi.brand} />
  }

  if (!follow.isAuthenticated) {
    return (
      <Link href={routes.signIn} asChild>
        <Chip label="Follow" primary />
      </Link>
    )
  }

  return (
    <Chip
      label={follow.isFollowing ? 'Following' : 'Follow'}
      primary={!follow.isFollowing}
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
}: {
  label: string
  primary?: boolean
  disabled?: boolean
  onPress?: () => void
}) {
  const communityUi = useCommunityUi()
  return (
    <XStack
      paddingHorizontal={16}
      paddingVertical={8}
      borderRadius={999}
      borderWidth={1}
      borderColor={primary ? communityUi.brand : communityUi.border}
      backgroundColor={primary ? communityUi.brand : communityUi.cardBg}
      opacity={disabled ? 0.6 : 1}
      cursor={disabled ? 'default' : 'pointer'}
      onPress={disabled ? undefined : onPress}
    >
      <Text fontSize={14} fontWeight="600" color={primary ? 'white' : communityUi.textMuted}>
        {label}
      </Text>
    </XStack>
  )
}