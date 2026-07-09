import type { ReactNode } from 'react'
import { useEffect, useState } from 'react'
import { Link } from 'one'

import { CommunitySuggestionsSections } from '~/community/components/CommunitySuggestionsSections'
import { CommunityWidget } from '~/community/components/CommunityWidget'
import { MemberRow } from '~/community/components/MemberRow'
import { ProfileLink } from '~/community/components/ProfileLink'
import { useUnreadNotifications } from '~/community/hooks/useUnreadNotifications'
import { fetchUpcomingEvents, type CommunityEvent } from '~/community/lib/events'
import { useNetwork } from '~/community/hooks/useNetwork'
import { COMMUNITY_DISCOVER_LINKS } from '~/community/navigation/config'
import { useCommunityUi } from '~/community/lib/community-theme'
import { COMMUNITY_LAYOUT } from '~/community/lib/layout'
import { Avatar, Icons, Text, XStack, YStack } from '~/components/ui'
import { communityRoutes, commerceRoutes } from '~/lib/routes'
import { useSupabase } from '~/providers/SupabaseProvider'

import { BRAND_NAME } from '~/config/brand'

export function CommunityRightSidebar() {
  const communityUi = useCommunityUi()
  const { user } = useSupabase()
  const network = useNetwork()
  const { count: unreadNotifications } = useUnreadNotifications()
  const [upcomingEvents, setUpcomingEvents] = useState<CommunityEvent[]>([])

  useEffect(() => {
    fetchUpcomingEvents(0).then((result) => {
      if (!result.error) {
        setUpcomingEvents(result.items.slice(0, 3))
      }
    })
  }, [])

  const contacts = user ? network.connections.slice(0, 8) : []
  const invitations = user ? network.pendingReceived.slice(0, 3) : []

  return (
    <YStack
      width={COMMUNITY_LAYOUT.rightSidebarWidth}
      flexShrink={0}
      gap="$2"
      position="sticky"
      top={COMMUNITY_LAYOUT.stickyTop}
      alignSelf="flex-start"
      display="none"
      $gtLg={{ display: 'flex' }}
    >
      <CommunityWidget title="Sponsored">
        <Link href={commerceRoutes.shops} asChild>
          <XStack gap={12} alignItems="center" cursor="pointer" hoverStyle={{ opacity: 0.9 }}>
            <YStack
              width={120}
              height={120}
              borderRadius={8}
              backgroundColor={communityUi.divider}
              alignItems="center"
              justifyContent="center"
            >
              <Icons.Store size={32} color={communityUi.brand} />
            </YStack>
            <YStack flex={1} gap={4}>
              <Text fontSize={13} fontWeight="600" color={communityUi.text} lineHeight={18}>
                Grow your shop on {BRAND_NAME}
              </Text>
              <Text fontSize={12} color={communityUi.textMuted}>
                Browse shops
              </Text>
            </YStack>
          </XStack>
        </Link>
      </CommunityWidget>

      <CommunitySuggestionsSections perKindLimit={4} />

      <CommunityWidget title="Quick links">
        <YStack gap={2}>
          {COMMUNITY_DISCOVER_LINKS.map((item) => {
            const Icon = item.icon
            return (
              <Link key={item.label} href={item.href}>
                <XStack
                  gap={10}
                  alignItems="center"
                  paddingVertical={8}
                  paddingHorizontal={8}
                  borderRadius={8}
                  cursor="pointer"
                  hoverStyle={{ backgroundColor: communityUi.divider }}
                >
                  <XStack
                    width={32}
                    height={32}
                    borderRadius={999}
                    backgroundColor={item.iconBg}
                    alignItems="center"
                    justifyContent="center"
                  >
                    <Icon size={16} color="white" />
                  </XStack>
                  <Text fontSize={14} fontWeight="500" color={communityUi.text} flex={1}>
                    {item.label}
                  </Text>
                </XStack>
              </Link>
            )
          })}
        </YStack>
      </CommunityWidget>

      {user && unreadNotifications > 0 ? (
        <CommunityWidget title="Alerts">
          <Link href={communityRoutes.notifications}>
            <XStack
              gap={10}
              alignItems="center"
              paddingVertical={8}
              paddingHorizontal={8}
              borderRadius={8}
              cursor="pointer"
              hoverStyle={{ backgroundColor: communityUi.divider }}
            >
              <XStack
                width={32}
                height={32}
                borderRadius={999}
                backgroundColor="#e41e3f"
                alignItems="center"
                justifyContent="center"
              >
                <Icons.Bell size={16} color="white" />
              </XStack>
              <YStack flex={1} gap={2}>
                <Text fontSize={14} fontWeight="600" color={communityUi.text}>
                  {unreadNotifications} unread
                </Text>
                <Text fontSize={12} color={communityUi.textMuted}>
                  View notifications
                </Text>
              </YStack>
            </XStack>
          </Link>
        </CommunityWidget>
      ) : null}

      {user && invitations.length > 0 ? (
        <CommunityWidget
          title="Invitations"
          headerActions={
            <Link href={communityRoutes.peopleTab('pending-received')}>
              <Text fontSize={13} fontWeight="600" color={communityUi.brand}>
                See all
              </Text>
            </Link>
          }
        >
          <YStack gap={0}>
            {invitations.map((member) => (
              <MemberRow key={member.user_id} member={member} compact showConnect />
            ))}
          </YStack>
        </CommunityWidget>
      ) : null}

      {upcomingEvents.length > 0 ? (
        <CommunityWidget
          title="Upcoming events"
          footer={
            <Link href={communityRoutes.events}>
              <Text fontSize={14} fontWeight="600" color={communityUi.brand}>
                See all events
              </Text>
            </Link>
          }
        >
          <YStack gap={8}>
            {upcomingEvents.map((event) => (
              <Link key={event.id} href={communityRoutes.event(event.id)}>
                <YStack
                  gap={4}
                  paddingVertical={8}
                  paddingHorizontal={8}
                  borderRadius={8}
                  cursor="pointer"
                  hoverStyle={{ backgroundColor: communityUi.divider }}
                >
                  <Text fontSize={14} fontWeight="600" color={communityUi.text} numberOfLines={2}>
                    {event.title}
                  </Text>
                  <Text fontSize={12} color={communityUi.textMuted}>
                    {formatEventWhen(event.start_time)}
                    {event.is_online ? ' · Online' : ''}
                  </Text>
                </YStack>
              </Link>
            ))}
          </YStack>
        </CommunityWidget>
      ) : null}

      {user && contacts.length > 0 ? (
        <CommunityCardSection
          title="Contacts"
          actions={
            <>
              <Link href={communityRoutes.peopleTab('connections')}>
                <HeaderIconButton icon={Icons.Search} label="Search contacts" />
              </Link>
              <Link href={communityRoutes.network}>
                <HeaderIconButton icon={Icons.MoreHorizontal} label="Network" />
              </Link>
            </>
          }
          footer={
            <Link href={communityRoutes.peopleTab('connections')}>
              <Text fontSize={14} fontWeight="600" color={communityUi.brand}>
                See all contacts
              </Text>
            </Link>
          }
        >
          <YStack gap={2}>
            {contacts.map((member) => (
              <ProfileLink key={member.user_id} userId={member.user_id} username={member.username}>
                <XStack
                  gap={10}
                  alignItems="center"
                  paddingVertical={6}
                  paddingHorizontal={8}
                  borderRadius={8}
                  cursor="pointer"
                  hoverStyle={{ backgroundColor: communityUi.divider }}
                >
                  <YStack position="relative">
                    <Avatar
                      name={member.full_name}
                      src={member.avatar_url ?? undefined}
                      size="$3"
                    />
                    <YStack
                      position="absolute"
                      bottom={0}
                      right={0}
                      width={10}
                      height={10}
                      borderRadius={999}
                      backgroundColor="#31a24c"
                      borderWidth={2}
                      borderColor={communityUi.cardBg}
                    />
                  </YStack>
                  <Text fontSize={14} fontWeight="500" color={communityUi.text} numberOfLines={1} flex={1}>
                    {member.full_name}
                  </Text>
                </XStack>
              </ProfileLink>
            ))}
          </YStack>
        </CommunityCardSection>
      ) : null}
    </YStack>
  )
}

function formatEventWhen(value: string) {
  return new Date(value).toLocaleString('en-IN', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function CommunityCardSection({
  title,
  actions,
  footer,
  children,
}: {
  title: string
  actions?: ReactNode
  footer?: ReactNode
  children: ReactNode
}) {
  return (
    <CommunityWidget title={title} headerActions={actions} footer={footer}>
      {children}
    </CommunityWidget>
  )
}

function HeaderIconButton({
  icon: Icon,
  label,
}: {
  icon: typeof Icons.Search
  label: string
}) {
  const communityUi = useCommunityUi()
  return (
    <XStack
      width={32}
      height={32}
      borderRadius={999}
      alignItems="center"
      justifyContent="center"
      cursor="pointer"
      hoverStyle={{ backgroundColor: communityUi.divider }}
      accessibilityLabel={label}
    >
      <Icon size={16} color={communityUi.textMuted} />
    </XStack>
  )
}