import { ProfileLink } from '~/community/components/ProfileLink'
import { useCommunityUi } from '~/community/lib/community-theme'
import { Avatar, Icons, Spinner, Text, XStack, YStack } from '~/components/ui'

export type EntityAdminRosterPerson = {
  user_id: string
  role: string
  username: string | null
  full_name: string
  headline: string | null
  avatar_url: string | null
}

type EntityAdminRosterProps = {
  title?: string
  subtitle?: string
  people: EntityAdminRosterPerson[]
  currentUserId?: string | null
  /** Roles that show a badge (e.g. owner, admin). */
  badgeRoles?: string[]
  /** Can the viewer promote/demote people (Make admin / Remove admin). */
  canManageRoles?: boolean
  /** Roles that cannot be toggled (e.g. owner). */
  lockedRoles?: string[]
  /** Role considered "admin" for the shield toggle. */
  adminRole?: string
  busyUserId?: string | null
  emptyMessage?: string
  onToggleAdmin?: (person: EntityAdminRosterPerson) => void
}

export function EntityAdminRoster({
  title = 'Admins',
  subtitle,
  people,
  currentUserId,
  badgeRoles = ['owner', 'admin'],
  canManageRoles = false,
  lockedRoles = ['owner'],
  adminRole = 'admin',
  busyUserId = null,
  emptyMessage = 'No people to show.',
  onToggleAdmin,
}: EntityAdminRosterProps) {
  const communityUi = useCommunityUi()

  return (
    <YStack gap={12}>
      {(title || subtitle) && (
        <YStack gap={4}>
          {title ? (
            <Text fontSize={16} fontWeight="700" color={communityUi.text}>
              {title}
            </Text>
          ) : null}
          {subtitle ? (
            <Text fontSize={13} color={communityUi.textMuted}>
              {subtitle}
            </Text>
          ) : null}
        </YStack>
      )}

      {people.length === 0 ? (
        <Text color={communityUi.textMuted} paddingVertical={8}>
          {emptyMessage}
        </Text>
      ) : (
        <YStack gap={0}>
          {people.map((person) => {
            const isMe = person.user_id === currentUserId
            const locked = lockedRoles.includes(person.role) || isMe
            const showToggle = canManageRoles && !locked && !!onToggleAdmin
            const isBusy = busyUserId === person.user_id
            const roleLabel = badgeRoles.includes(person.role)
              ? person.role === 'owner'
                ? 'Owner'
                : 'Admin'
              : null

            return (
              <XStack
                key={person.user_id}
                gap={12}
                alignItems="center"
                paddingVertical={10}
                paddingHorizontal={4}
                borderBottomWidth={1}
                borderBottomColor={communityUi.borderLight}
              >
                <ProfileLink userId={person.user_id} username={person.username}>
                  <Avatar name={person.full_name} src={person.avatar_url ?? undefined} size="$4" />
                </ProfileLink>
                <YStack flex={1} minWidth={0} gap={2}>
                  <Text fontSize={15} fontWeight="600" color={communityUi.text} numberOfLines={1}>
                    {isMe ? 'You' : person.full_name}
                  </Text>
                  {person.headline || person.username ? (
                    <Text fontSize={12.5} color={communityUi.textMuted} numberOfLines={1}>
                      {person.headline ?? `@${person.username}`}
                    </Text>
                  ) : null}
                </YStack>
                {roleLabel ? (
                  <XStack
                    paddingHorizontal={8}
                    paddingVertical={3}
                    borderRadius={999}
                    backgroundColor={communityUi.divider}
                  >
                    <Text fontSize={11} fontWeight="700" color={communityUi.brand}>
                      {roleLabel}
                    </Text>
                  </XStack>
                ) : null}
                {showToggle ? (
                  <XStack
                    onPress={() => {
                      if (!isBusy) onToggleAdmin?.(person)
                    }}
                    cursor={isBusy ? 'default' : 'pointer'}
                    width={34}
                    height={34}
                    borderRadius={999}
                    alignItems="center"
                    justifyContent="center"
                    opacity={isBusy ? 0.6 : 1}
                    hoverStyle={isBusy ? undefined : { backgroundColor: communityUi.hoverBg }}
                    pressStyle={isBusy ? undefined : { scale: 0.9 }}
                    aria-label={person.role === adminRole ? 'Remove as admin' : 'Make admin'}
                  >
                    {isBusy ? (
                      <Spinner size="small" color={communityUi.brand} />
                    ) : (
                      <Icons.Shield
                        size={17}
                        color={person.role === adminRole ? communityUi.brand : communityUi.textMuted}
                      />
                    )}
                  </XStack>
                ) : null}
              </XStack>
            )
          })}
        </YStack>
      )}
    </YStack>
  )
}
