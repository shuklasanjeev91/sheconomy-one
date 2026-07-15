import { useState } from 'react'
import { Link } from 'one'

import { Button, Icons, Text, XStack, YStack, useAppToast } from '~/components/ui'
import { SurfaceCard } from '~/components/layout'
import { radius } from '~/config/tokens'
import { SettingsPanel } from '~/components/settings/SettingsPanel'
import { useAuth } from '~/hooks/useAuth'
import { routes } from '~/lib/routes'
import { useAppUi } from '~/lib/theme/useAppUi'

export function AccountSettingsPanel() {
  const ui = useAppUi()
  const toast = useAppToast()
  const { signOut } = useAuth()
  const [isSigningOut, setIsSigningOut] = useState(false)

  async function handleSignOut() {
    setIsSigningOut(true)
    const { error } = await signOut()
    setIsSigningOut(false)
    if (error) {
      toast.show('Sign out failed', { tone: 'danger', message: error })
      return
    }
    toast.show('Signed out', { tone: 'success' })
  }

  return (
    <SettingsPanel title="Account" description="Sign out and manage your profile on this device">
      <SurfaceCard padding="$0" borderRadius={radius.card} overflow="hidden">
        <XStack
          alignItems="center"
          justifyContent="space-between"
          paddingHorizontal="$4"
          paddingVertical="$3"
        >
          <XStack gap="$3" alignItems="center" flex={1}>
            <Icons.LogOut size={18} color="$red10" />
            <YStack gap={2} flex={1} minWidth={0}>
              <Text fontWeight="600" color={ui.text}>
                Sign out
              </Text>
              <Text fontSize={13} color={ui.textMuted}>
                Ends your session on this device
              </Text>
            </YStack>
          </XStack>
          <Button tone="outline" size="$3" disabled={isSigningOut} onPress={handleSignOut}>
            {isSigningOut ? 'Signing out…' : 'Sign out'}
          </Button>
        </XStack>
      </SurfaceCard>

      <Link href={routes.profile} asChild>
        <XStack
          alignItems="center"
          gap="$3"
          paddingHorizontal="$4"
          paddingVertical="$3.5"
          borderRadius={radius.card}
          backgroundColor={ui.surface}
          borderWidth={1}
          borderColor={ui.border}
          hoverStyle={{ backgroundColor: ui.navHover }}
          cursor="pointer"
        >
          <Icons.User size={18} color={ui.brand} />
          <YStack flex={1} gap={2}>
            <Text fontSize={15} color={ui.text} fontWeight="600">
              Your profile
            </Text>
            <Text fontSize={13} color={ui.textMuted}>
              Photo, bio, and public details
            </Text>
          </YStack>
          <Icons.ChevronRight size={16} color={ui.textMuted} />
        </XStack>
      </Link>
    </SettingsPanel>
  )
}
