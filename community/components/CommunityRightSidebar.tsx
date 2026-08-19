import type { ReactNode } from 'react'
import { AppLink } from '~/components/navigation/AppLink'
import { useEffect, useState } from 'react'

import { IdleMount } from '~/components/IdleMount'
import { CommunitySuggestionsSections } from '~/community/components/CommunitySuggestionsSections'
import { CommunityWidget } from '~/community/components/CommunityWidget'
import { MemberRow } from '~/community/components/MemberRow'
import { ProfileLink } from '~/community/components/ProfileLink'
import { fetchUpcomingEvents, type CommunityEvent } from '~/community/lib/events'
import { useNetwork } from '~/community/hooks/useNetwork'
import { COMMUNITY_DISCOVER_LINKS } from '~/community/navigation/config'
import { openComposer } from '~/community/lib/composer-store'
import { useCommunityUi } from '~/community/lib/community-theme'
import { COMMUNITY_LAYOUT } from '~/community/lib/layout'
import { StickyRail } from '~/components/layout'
import { Avatar, Icons, Text, XStack, YStack } from '~/components/ui'
import { useAppLayout } from '~/hooks/useAppLayout'
import { scheduleIdle } from '~/lib/schedule-idle'
import { communityRoutes } from '~/lib/routes'
import { useSupabase } from '~/providers/SupabaseProvider'

type CommunitySidebarPin = 'document' | 'viewport'

export function CommunityRightSidebar({ pin = 'document' }: { pin?: CommunitySidebarPin }) {
  const communityUi = useCommunityUi()
  const { hasDualSideRails } = useAppLayout()
  const { user } = useSupabase()
  const network = useNetwork()
  const [upcomingEvents, setUpcomingEvents] = useState<CommunityEvent[]>([])

  useEffect(() => {
    return scheduleIdle(() => {
      fetchUpcomingEvents(0).then((result) => {
        if (!result.error) {
          setUpcomingEvents(result.items.slice(0, 3))
        }
      })
    })
  }, [])

  const contacts = user ? network.connections.slice(0, 8) : []
  const invitations = user ? network.pendingReceived.slice(0, 3) : []

  if (!hasDualSideRails) {
    return null
  }

  return (
    <StickyRail
      width={COMMUNITY_LAYOUT.rightSidebarWidth}
      gap="$2"
      scrollable={pin === 'document'}
      pin={pin}
    >
      <IdleMount>
        <CommunitySuggestionsSections perKindLimit={4} compactProducts />
      </IdleMount>

      <CommunityWidget title="Quick links">
        <YStack gap={2}>
          {COMMUNITY_DISCOVER_LINKS.map((item) => {
            const Icon = item.icon
            const row = (
              <XStack
                gap={10}
                alignItems="center"
                paddingVertical={8}
                paddingHorizontal={8}
                borderRadius={8}
                cursor="pointer"
                hoverStyle={{ backgroundColor: communityUi.divider }}
                {...(item.href === communityRoutes.createPost
                  ? { onPress: () => openComposer() }
                  : {})}
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
            )

            // "Create post" opens the composer overlay; other links navigate.
            if (item.href === communityRoutes.createPost) {
              return <YStack key={item.label}>{row}</YStack>
            }

            return (
              <AppLink key={item.label} href={item.href} asChild>
                {row}
              </AppLink>
            )
          })}
        </YStack>
      </CommunityWidget>

      {user && invitations.length > 0 ? (
        <CommunityWidget
          title="Invitations"
          headerActions={
            <AppLink href={communityRoutes.peopleTab('pending-received')} asChild>
              <Text fontSize={13} fontWeight="600" color={communityUi.brand} cursor="pointer">
                See all
              </Text>
            </AppLink>
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
            <AppLink href={communityRoutes.events} asChild>
              <Text fontSize={14} fontWeight="600" color={communityUi.brand} cursor="pointer">
                See all events
              </Text>
            </AppLink>
          }
        >
          <YStack gap={8}>
            {upcomingEvents.map((event) => (
              <AppLink key={event.id} href={communityRoutes.event(event.id)} asChild>
                <YStack
                  width="100%"
                  gap={4}
                  paddingVertical={8}
                  paddingHorizontal={8}
                  borderRadius={8}
                  cursor="pointer"
                  hoverStyle={{ backgroundColor: communityUi.divider }}
                  pressStyle={{ opacity: 0.85 }}
                >
                  <Text fontSize={14} fontWeight="600" color={communityUi.text} numberOfLines={2}>
                    {event.title}
                  </Text>
                  <Text fontSize={12} color={communityUi.textMuted}>
                    {formatEventWhen(event.start_time)}
                    {event.is_online ? ' · Online' : ''}
                  </Text>
                </YStack>
              </AppLink>
            ))}
          </YStack>
        </CommunityWidget>
      ) : null}

      {user && contacts.length > 0 ? (
        <CommunityCardSection
          title="Contacts"
          actions={
            <>
              <AppLink href={communityRoutes.peopleTab('connections')} asChild>
                <HeaderIconButton icon={Icons.Search} label="Search contacts" />
              </AppLink>
              <AppLink href={communityRoutes.network} asChild>
                <HeaderIconButton icon={Icons.MoreHorizontal} label="Network" />
              </AppLink>
            </>
          }
          footer={
            <AppLink href={communityRoutes.peopleTab('connections')} asChild>
              <Text fontSize={14} fontWeight="600" color={communityUi.brand} cursor="pointer">
                See all contacts
              </Text>
            </AppLink>
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
    </StickyRail>
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