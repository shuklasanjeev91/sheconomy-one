import type { ReactNode } from 'react'
import { AppLink } from '~/components/navigation/AppLink'
import { useEffect, useState } from 'react'

import { CommunityShell } from '~/community/components/CommunityShell'
import { CommunityWidget } from '~/community/components/CommunityWidget'
import { CommunityCard } from '~/community/components/CommunityCard'
import { CommunityPageHeader } from '~/community/components/CommunityPageHeader'
import { MemberRow } from '~/community/components/MemberRow'
import { UserListBottomSheet } from '~/community/components/UserListBottomSheet'
import { useCommunityUi } from '~/community/lib/community-theme'
import type { UserListKind } from '~/community/lib/user-lists'
import { fetchDiscoverMembers, type NetworkMember } from '~/community/lib/network'
import { inviteNetworkByEmail } from '~/community/lib/network-invites'
import {
  dismissNetworkSuggestion,
  useDismissedNetworkSuggestions,
} from '~/community/lib/dismissed-suggestions'
import { useNetwork } from '~/community/hooks/useNetwork'
import { Button, Icons, Input, Spinner, Text, XStack, YStack, useAppToast } from '~/components/ui'
import { useProfile } from '~/hooks/useProfile'
import { buildAbsoluteUrl } from '~/lib/platform/url'
import { communityRoutes, routes } from '~/lib/routes'
import { getProfileShareUrl, shareViaSystem } from '~/lib/share'
import { useSupabase } from '~/providers/SupabaseProvider'
import { useAppUi } from '~/lib/theme/useAppUi'

import { BRAND_NAME } from '~/config/brand'

export function NetworkScreen() {
  const communityUi = useCommunityUi()
  const ui = useAppUi()
  const { user, isLoading: authLoading } = useSupabase()
  const { profile } = useProfile()
  const network = useNetwork()
  const dismissedIds = useDismissedNetworkSuggestions()
  const toast = useAppToast()
  const [guestSuggestions, setGuestSuggestions] = useState<NetworkMember[]>([])
  const [guestLoading, setGuestLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteMessage, setInviteMessage] = useState('')
  const [inviteSending, setInviteSending] = useState(false)
  const [inviteSharing, setInviteSharing] = useState(false)
  const [listSheetKind, setListSheetKind] = useState<UserListKind | null>(null)
  const [listSheetOpen, setListSheetOpen] = useState(false)

  function openUserList(kind: UserListKind) {
    setListSheetKind(kind)
    setListSheetOpen(true)
  }

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
          <AppLink href={routes.signIn} asChild>
            <Button
              alignSelf="flex-start"
              backgroundColor={communityUi.brand}
              color="white"
              borderRadius={999}
              paddingHorizontal="$5"
            >
              Sign in
            </Button>
          </AppLink>
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
  const dismissed = new Set(dismissedIds)
  const visibleSuggestions = network.suggestions.filter(
    (member) => !sentIds.has(member.user_id) && !dismissed.has(member.user_id),
  )
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
        onOpenConnections={() => openUserList('connections')}
        onOpenInvitations={() => openUserList('pending-received')}
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

      <ManageMyNetwork
        connectionsCount={network.connections.length}
        invitationsCount={network.pendingReceived.length}
        suggestionsCount={visibleSuggestions.length}
        onOpenConnections={() => openUserList('connections')}
        onOpenInvitations={() => openUserList('pending-received')}
      />

      <CommunityCard padding={16} gap={12}>
        <XStack gap="$2" alignItems="center">
          <Icons.Mail size={18} color={communityUi.brand} />
          <Text fontWeight="700" fontSize={16} color={ui.text}>
            Invite by email
          </Text>
        </XStack>
        <Text fontSize={13} color={ui.textMuted} lineHeight={18}>
          Send a connection invite to someone already on {BRAND_NAME}, or save an invite for when they join.
        </Text>
        <Input
          value={inviteEmail}
          onChangeText={setInviteEmail}
          placeholder="colleague@email.com"
          autoCapitalize="none"
          keyboardType="email-address"
        />
        <Input
          value={inviteMessage}
          onChangeText={setInviteMessage}
          placeholder="Optional note (hi, let’s connect…)"
        />
        <XStack gap="$2" flexWrap="wrap">
          <Button
            alignSelf="flex-start"
            tone="primary"
            borderRadius={999}
            disabled={inviteSending || !inviteEmail.trim()}
            onPress={() => {
              setInviteSending(true)
              void inviteNetworkByEmail(inviteEmail, inviteMessage).then((result) => {
                setInviteSending(false)
                if (result.error || result.status === 'error') {
                  toast.show('Could not send invite', {
                    tone: 'danger',
                    message: result.error || result.message,
                  })
                  return
                }
                toast.show(
                  result.status === 'pending_signup' ? 'Invite saved' : 'Invitation sent',
                  {
                    tone: 'success',
                    message: result.message,
                  },
                )
                setInviteEmail('')
                setInviteMessage('')
                if (result.status === 'sent') void network.reload()
              })
            }}
          >
            {inviteSending ? 'Sending…' : 'Send invite'}
          </Button>
          <Button
            alignSelf="flex-start"
            tone="outline"
            borderRadius={999}
            icon={<Icons.Share2 size={15} />}
            disabled={inviteSharing}
            onPress={() => {
              setInviteSharing(true)
              const url = profile?.username
                ? getProfileShareUrl(profile.username)
                : buildAbsoluteUrl(communityRoutes.network)
              const note =
                inviteMessage.trim() ||
                `Connect with me on ${BRAND_NAME}${profile?.full_name ? ` — ${profile.full_name}` : ''}`
              void shareViaSystem({
                url,
                title: `Connect on ${BRAND_NAME}`,
                text: note,
              }).then((result) => {
                setInviteSharing(false)
                if (result === 'cancelled') return
                toast.show(result === 'copied' ? 'Invite link copied' : 'Invite ready to share', {
                  tone: 'success',
                })
              })
            }}
          >
            {inviteSharing ? 'Sharing…' : 'Share invite link'}
          </Button>
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
        <NetworkSection
          title="People you may know"
          subtitle="Based on your industry, location, and mutual connections"
        >
          {visibleSuggestions.filter(matchesSearch).map((member) => (
            <MemberRow
              key={member.user_id}
              member={member}
              onDismiss={() => {
                dismissNetworkSuggestion(member.user_id)
                toast.show('Suggestion hidden', { tone: 'info' })
              }}
            />
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
              <AppLink href={communityRoutes.home}>
                <Text color={communityUi.brand} fontWeight="600">
                  Go to feed
                </Text>
              </AppLink>
            ) : null}
          </YStack>
        ) : (
          filteredConnections.map((member) => (
            <MemberRow key={member.user_id} member={member} />
          ))
        )}
      </NetworkSection>

      {user ? (
        <UserListBottomSheet
          open={listSheetOpen}
          onOpenChange={setListSheetOpen}
          kind={listSheetKind}
          userId={user.id}
          isOwnProfile
        />
      ) : null}
    </CommunityShell>
  )
}

function NetworkHero({
  connectionsCount,
  invitationsCount,
  isGuest = false,
  onOpenConnections,
  onOpenInvitations,
}: {
  connectionsCount: number
  invitationsCount: number
  isGuest?: boolean
  onOpenConnections?: () => void
  onOpenInvitations?: () => void
}) {
  return (
    <CommunityCard padding={18} gap={12}>
      <CommunityPageHeader
        title="My network"
        subtitle={
          isGuest
            ? `Connect with women entrepreneurs, founders, and creators building on ${BRAND_NAME}.`
            : 'Grow your professional circle with invitations, connections, and people you may know.'
        }
      />

      {!isGuest ? (
        <XStack gap="$3" flexWrap="wrap">
          <StatPill
            icon={Icons.Users}
            label="Connections"
            value={connectionsCount}
            onPress={connectionsCount > 0 ? onOpenConnections : undefined}
          />
          <StatPill
            icon={Icons.UserPlus}
            label="Invitations"
            value={invitationsCount}
            onPress={invitationsCount > 0 ? onOpenInvitations : undefined}
          />
        </XStack>
      ) : null}
    </CommunityCard>
  )
}

function ManageMyNetwork({
  connectionsCount,
  invitationsCount,
  suggestionsCount,
  onOpenConnections,
  onOpenInvitations,
}: {
  connectionsCount: number
  invitationsCount: number
  suggestionsCount: number
  onOpenConnections: () => void
  onOpenInvitations: () => void
}) {
  const communityUi = useCommunityUi()

  const tiles = [
    {
      label: 'Connections',
      value: connectionsCount,
      icon: Icons.Users,
      onPress: onOpenConnections,
      href: null as string | null,
    },
    {
      label: 'Invitations',
      value: invitationsCount,
      icon: Icons.Mail,
      onPress: onOpenInvitations,
      href: null as string | null,
    },
    {
      label: 'People you may know',
      value: suggestionsCount,
      icon: Icons.UserPlus,
      onPress: null as (() => void) | null,
      href: communityRoutes.peopleTab('suggestions'),
    },
    {
      label: 'Groups',
      value: null as number | null,
      icon: Icons.Network,
      onPress: null,
      href: communityRoutes.groups,
    },
    {
      label: 'Events',
      value: null,
      icon: Icons.Calendar,
      onPress: null,
      href: communityRoutes.events,
    },
    {
      label: 'Saved posts',
      value: null,
      icon: Icons.Bookmark,
      onPress: null,
      href: communityRoutes.saved,
    },
    {
      label: 'Pages',
      value: null,
      icon: Icons.Building2,
      onPress: null,
      href: communityRoutes.companies,
    },
  ]

  return (
    <CommunityWidget title="Manage my network" subtitle="Quick access to your professional graph">
      <YStack gap={0}>
        {tiles.map((tile) => {
          const Icon = tile.icon
          const row = (
            <XStack
              alignItems="center"
              justifyContent="space-between"
              paddingVertical={12}
              paddingHorizontal={4}
              borderBottomWidth={1}
              borderBottomColor={communityUi.borderLight}
              cursor="pointer"
              hoverStyle={{ backgroundColor: communityUi.hoverBg }}
              onPress={tile.onPress ?? undefined}
            >
              <XStack gap={12} alignItems="center" flex={1}>
                <XStack
                  width={36}
                  height={36}
                  borderRadius={8}
                  backgroundColor={communityUi.accentMuted}
                  alignItems="center"
                  justifyContent="center"
                >
                  <Icon size={18} color={communityUi.brand} />
                </XStack>
                <Text fontSize={14} fontWeight="600" color={communityUi.text}>
                  {tile.label}
                </Text>
              </XStack>
              <XStack gap={8} alignItems="center">
                {tile.value != null ? (
                  <Text fontSize={14} fontWeight="700" color={communityUi.textMuted}>
                    {tile.value}
                  </Text>
                ) : null}
                <Icons.ChevronRight size={18} color={communityUi.textSubtle} />
              </XStack>
            </XStack>
          )

          if (tile.href) {
            return (
              <AppLink key={tile.label} href={tile.href as never}>
                {row}
              </AppLink>
            )
          }

          return <YStack key={tile.label}>{row}</YStack>
        })}
      </YStack>
    </CommunityWidget>
  )
}

function StatPill({
  icon: Icon,
  label,
  value,
  onPress,
}: {
  icon: typeof Icons.Users
  label: string
  value: number
  onPress?: () => void
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
      cursor={onPress ? 'pointer' : 'default'}
      hoverStyle={onPress ? { opacity: 0.9 } : undefined}
      onPress={onPress}
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