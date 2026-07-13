import { useState } from 'react'
import { useRouter } from 'one'

import { ProfileView } from '~/community/components/profile/ProfileView'
import type { ProfileDisplay } from '~/community/components/profile/types'
import { BRAND_BLUE } from '~/community/lib/constants'
import {
  Button,
  Spinner,
  Text,
  XStack,
  YStack,
  useAppToast,
} from '~/components/ui'
import { FullWidthLayout, PageSection } from '~/components/layout'
import { useAuth } from '~/hooks/useAuth'
import { useProfile } from '~/hooks/useProfile'
import { commerceRoutes, communityRoutes } from '~/lib/routes'
import { useAppUi } from '~/lib/theme/useAppUi'

export function ProfileScreen() {
  const ui = useAppUi()
  const router = useRouter()
  const toast = useAppToast()
  const { profile, isLoading, error, user } = useProfile()
  const { signOut } = useAuth()
  const [isSigningOut, setIsSigningOut] = useState(false)

  if (isLoading) {
    return (
      <FullWidthLayout scroll>
        <PageSection paddingVertical="$10">
          <YStack alignItems="center">
            <Spinner size="large" />
          </YStack>
        </PageSection>
      </FullWidthLayout>
    )
  }

  if (!profile) {
    return (
      <FullWidthLayout scroll>
        <PageSection paddingVertical="$8">
          <Text color={ui.textMuted}>Sign in to view your profile.</Text>
        </PageSection>
      </FullWidthLayout>
    )
  }

  const displayProfile: ProfileDisplay = {
    ...profile,
    email: profile.email || user?.email || null,
  }

  async function handleSignOut() {
    setIsSigningOut(true)
    const { error: signOutError } = await signOut()
    setIsSigningOut(false)

    if (signOutError) {
      toast.show('Sign out failed', { tone: 'danger', message: signOutError })
      return
    }

    toast.show('Signed out', { tone: 'success' })
  }

  return (
    <FullWidthLayout scroll>
      <PageSection paddingVertical="$3">
        {error ? (
        <YStack
          backgroundColor={ui.surface}
          borderRadius={8}
          borderWidth={1}
          borderColor={ui.border}
          padding="$4"
          marginBottom="$4"
        >
          <Text color="$red10">{error}</Text>
        </YStack>
      ) : null}

      <ProfileView
        profile={displayProfile}
        isOwnProfile
        headerActions={
          <>
            <ProfileActionButton
              label="My network"
              variant="outline"
              onPress={() => router.push(communityRoutes.network)}
            />
            <ProfileActionButton
              label="My shops"
              variant="outline"
              onPress={() => router.push(commerceRoutes.myShops)}
            />
          </>
        }
        sidebarFooter={
          <AccountSidebar
            email={displayProfile.email}
            username={profile.username}
            isSigningOut={isSigningOut}
            onSignOut={handleSignOut}
          />
        }
      />
      </PageSection>
    </FullWidthLayout>
  )
}

function ProfileActionButton({
  label,
  variant,
  onPress,
}: {
  label: string
  variant: 'outline' | 'primary'
  onPress?: () => void
}) {
  const ui = useAppUi()
  const isPrimary = variant === 'primary'

  return (
    <XStack
      paddingHorizontal="$4"
      paddingVertical={8}
      borderRadius={999}
      borderWidth={1}
      borderColor={isPrimary ? 'transparent' : BRAND_BLUE}
      backgroundColor={isPrimary ? BRAND_BLUE : 'transparent'}
      cursor="pointer"
      hoverStyle={{ opacity: 0.9 }}
      pressStyle={{ opacity: 0.7 }}
      onPress={onPress}
      accessibilityLabel={label}
    >
      <Text fontSize={14} fontWeight="600" color={isPrimary ? ui.onBrand : BRAND_BLUE}>
        {label}
      </Text>
    </XStack>
  )
}

function AccountSidebar({
  email,
  username,
  isSigningOut,
  onSignOut,
}: {
  email?: string | null
  username: string
  isSigningOut: boolean
  onSignOut: () => void
}) {
  const ui = useAppUi()

  return (
    <YStack
      backgroundColor={ui.surface}
      borderRadius={12}
      borderWidth={1}
      borderColor={ui.border}
      padding="$4"
      gap="$3"
      width="100%"
    >
      <Text fontSize={18} fontWeight="700" color={ui.text}>
        Account
      </Text>
      {email ? (
        <Text fontSize={14} color={ui.textMuted}>
          {email}
        </Text>
      ) : null}
      <Text fontSize={14} color={ui.textMuted}>
        @{username}
      </Text>
      <Button
        marginTop="$1"
        tone="destructive"
        size="$3"
        borderRadius={999}
        disabled={isSigningOut}
        onPress={onSignOut}
        icon={isSigningOut ? <Spinner size="small" color="white" /> : undefined}
      >
        {isSigningOut ? 'Signing out…' : 'Sign out'}
      </Button>
    </YStack>
  )
}