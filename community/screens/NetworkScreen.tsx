import { Link } from 'one'
import type { ReactNode } from 'react'
import { useEffect, useState } from 'react'

import { CommunityShell } from '~/community/components/CommunityShell'
import { CommunityWidget } from '~/community/components/CommunityWidget'
import { CommunityCard } from '~/community/components/CommunityCard'
import { CommunityPageHeader } from '~/community/components/CommunityPageHeader'
import { MemberRow } from '~/community/components/MemberRow'
import { useCommunityUi } from '~/community/lib/community-theme'
import { fetchDiscoverMembers, type NetworkMember } from '~/community/lib/network'
import { useNetwork } from '~/community/hooks/useNetwork'
import { Button, Icons, Input, Spinner, Text, XStack, YStack } from '~/components/ui'
import { communityRoutes, routes } from '~/lib/routes'
import { useSupabase } from '~/providers/SupabaseProvider'
import { useAppUi } from '~/lib/theme/useAppUi'

import { BRAND_NAME } from '~/config/brand'

export function NetworkScreen() {
  const communityUi = useCommunityUi()
  const ui = useAppUi()
  const { user, isLoading: authLoading } = useSupabase()
  const network = useNetwork()
  const [guestSuggestions, setGuestSuggestions] = useState<NetworkMember[]>([])
  const [guestLoading, setGuestLoading] = useState(false)
  const [search, setSearch] = useState('')

  useEffect(() => {
    if (user || authLoading) return

    setGuestLoading(true)
    fetchDiscoverMembers().then((result) => {
      setGuestSuggestions(result.items)
      setGuestLoading(false)
    })
  }, [user, authLoading])

  if (authLoading || (user && network.isLoading)) {
    return (
      <CommunityShell wide>
        <YStack alignItems="center" paddingVertical="$10">
          <Spinner size="large" />
        </YStack>
      </CommunityShell>
    )
  }

  if (!user) {
    return (
      <CommunityShell wide>
        <NetworkHero connectionsCount={0} invitationsCount={0} isGuest />
        <CommunityCard padding={20} gap={16}>
          <Text fontSize={16} color={ui.textMuted} lineHeight={24}>
            Sign in to send connection requests, accept invitations, and grow your network.
          </Text>
          <Link href={routes.signIn} asChild>
            <Button
              alignSelf="flex-start"
              backgroundColor={communityUi.brand}
              color="white"
              borderRadius={999}
              paddingHorizontal="$5"
            >
              Sign in
            </Button>
          </Link>
        </CommunityCard>
        <NetworkSection title="Explore the network">
          {guestLoading ? (
            <YStack padding="$6" alignItems="center">
              <Spinner size="large" />
            </YStack>
          ) : (
            guestSuggestions.map((member) => (
              <MemberRow key={member.user_id} member={member} showConnect={false} />
            ))
          )}
        </NetworkSection>
      </CommunityShell>
    )
  }

  const sentIds = new Set(network.pendingSent.map((member) => member.user_id))
  const visibleSuggestions = network.suggestions.filter((member) => !sentIds.has(member.user_id))
  const query = search.trim().toLowerCase()

  function matchesSearch(member: NetworkMember) {
    if (!query) return true
    return (
      member.full_name.toLowerCase().includes(query) ||
      (member.headline?.toLowerCase().includes(query) ?? false)
    )
  }

  const filteredConnections = network.connections.filter(matchesSearch)

  return (
    <CommunityShell wide>
      <NetworkHero
        connectionsCount={network.connections.length}
        invitationsCount={network.pendingReceived.length}
      />

      <CommunityCard padding={12}>
        <XStack gap="$2" alignItems="center">
          <Icons.Search size={18} color={ui.textMuted} />
          <Input
            flex={1}
            value={search}
            onChangeText={setSearch}
            placeholder="Search by name or headline"
            borderWidth={0}
            backgroundColor="transparent"
            paddingHorizontal={0}
          />
        </XStack>
      </CommunityCard>

      {network.error ? (
        <CommunityCard padding={16}>
          <Text color="$red10">{network.error}</Text>
        </CommunityCard>
      ) : null}

      {network.pendingReceived.length > 0 ? (
        <NetworkSection title="Invitations" subtitle={`${network.pendingReceived.length} pending`}>
          {network.pendingReceived.filter(matchesSearch).map((member) => (
            <MemberRow key={member.user_id} member={member} />
          ))}
        </NetworkSection>
      ) : null}

      {visibleSuggestions.length > 0 ? (
        <NetworkSection title="Network suggestions" subtitle="Based on your industry and location">
          {visibleSuggestions.filter(matchesSearch).map((member) => (
            <MemberRow key={member.user_id} member={member} />
          ))}
        </NetworkSection>
      ) : null}

      {network.pendingSent.length > 0 ? (
        <NetworkSection title="Sent invitations">
          {network.pendingSent.filter(matchesSearch).map((member) => (
            <MemberRow key={member.user_id} member={member} />
          ))}
        </NetworkSection>
      ) : null}

      <NetworkSection
        title="Your connections"
        subtitle={
          network.connections.length
            ? `${network.connections.length} connections`
            : 'Start connecting with founders and creators'
        }
      >
        {filteredConnections.length === 0 ? (
          <YStack gap="$2">
            <Text color={ui.textMuted}>
              {query
                ? 'No connections match your search.'
                : 'You have not added any connections yet. Explore suggestions above or visit the feed.'}
            </Text>
            {!query ? (
              <Link href={communityRoutes.home}>
                <Text color={communityUi.brand} fontWeight="600">
                  Go to feed
                </Text>
              </Link>
            ) : null}
          </YStack>
        ) : (
          filteredConnections.map((member) => (
            <MemberRow key={member.user_id} member={member} />
          ))
        )}
      </NetworkSection>
    </CommunityShell>
  )
}

function NetworkHero({
  connectionsCount,
  invitationsCount,
  isGuest = false,
}: {
  connectionsCount: number
  invitationsCount: number
  isGuest?: boolean
}) {
  return (
    <CommunityCard padding={18} gap={12}>
      <CommunityPageHeader
        title="My network"
        subtitle={
          isGuest
            ? `Connect with women entrepreneurs, founders, and creators building on ${BRAND_NAME}.`
            : 'Manage invitations, discover network suggestions, and grow your professional network.'
        }
      />

      {!isGuest ? (
        <XStack gap="$3" flexWrap="wrap">
          <Link href={communityRoutes.peopleTab('connections')} asChild>
            <StatPill icon={Icons.Users} label="Connections" value={connectionsCount} />
          </Link>
          <Link href={communityRoutes.peopleTab('pending-received')} asChild>
            <StatPill icon={Icons.Mail} label="Invitations" value={invitationsCount} />
          </Link>
        </XStack>
      ) : null}
    </CommunityCard>
  )
}

function StatPill({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Icons.Users
  label: string
  value: number
}) {
  const communityUi = useCommunityUi()
  const ui = useAppUi()

  return (
    <XStack
      gap="$2"
      alignItems="center"
      paddingHorizontal="$4"
      paddingVertical="$3"
      borderRadius={999}
      backgroundColor={ui.surfaceMuted}
      borderWidth={1}
      borderColor={ui.borderSubtle}
      cursor="pointer"
      hoverStyle={{ opacity: 0.9 }}
    >
      <Icon size={16} color={communityUi.brand} />
      <Text fontSize={18} fontWeight="700" color={ui.text}>
        {value}
      </Text>
      <Text fontSize={13} color={ui.textMuted}>
        {label}
      </Text>
    </XStack>
  )
}

function NetworkSection({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle?: string
  children: ReactNode
}) {
  return (
    <CommunityWidget title={title} subtitle={subtitle}>
      <YStack gap={0}>{children}</YStack>
    </CommunityWidget>
  )
}