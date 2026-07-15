import { useState } from 'react'
import { AppLink } from '~/components/navigation/AppLink'

import { Button, ConfirmDialog, Icons, Text, XStack, YStack, useAppToast } from '~/components/ui'
import { SurfaceCard } from '~/components/layout'
import { radius } from '~/config/tokens'
import { SettingsPanel } from '~/components/settings/SettingsPanel'
import { confirmSensitiveAction } from '~/features/auth/services/confirm-sensitive-action'
import { useAuth } from '~/hooks/useAuth'
import { appRoutes, routes } from '~/lib/routes'
import { useAppUi } from '~/lib/theme/useAppUi'

export function AccountSettingsPanel() {
  const ui = useAppUi()
  const toast = useAppToast()
  const { signOutLocal, signOutGlobal } = useAuth()
  const [isSigningOut, setIsSigningOut] = useState(false)
  const [confirmGlobal, setConfirmGlobal] = useState(false)

  async function handleSignOut() {
    setIsSigningOut(true)
    const { error } = await signOutLocal()
    setIsSigningOut(false)
    if (error) {
      toast.show('Sign out failed', { tone: 'danger', message: error })
      return
    }
    toast.show('Signed out', { tone: 'success' })
  }

  async function handleSignOutAll() {
    const gate = await confirmSensitiveAction('Confirm sign out of all devices')
    if (!gate.ok) {
      setConfirmGlobal(false)
      toast.show('Confirmation required', { tone: 'warning', message: gate.error ?? undefined })
      return
    }
    setIsSigningOut(true)
    const { error } = await signOutGlobal()
    setIsSigningOut(false)
    setConfirmGlobal(false)
    if (error) {
      toast.show('Sign out failed', { tone: 'danger', message: error })
      return
    }
    toast.show('Signed out of all devices', { tone: 'success' })
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

      <SurfaceCard padding="$0" borderRadius={radius.card} overflow="hidden">
        <XStack
          alignItems="center"
          justifyContent="space-between"
          paddingHorizontal="$4"
          paddingVertical="$3"
        >
          <XStack gap="$3" alignItems="center" flex={1}>
            <Icons.ShieldAlert size={18} color="$red10" />
            <YStack gap={2} flex={1} minWidth={0}>
              <Text fontWeight="600" color={ui.text}>
                Sign out of all devices
              </Text>
              <Text fontSize={13} color={ui.textMuted}>
                Ends every session everywhere
              </Text>
            </YStack>
          </XStack>
          <Button
            tone="destructive"
            size="$3"
            disabled={isSigningOut}
            onPress={() => setConfirmGlobal(true)}
          >
            Sign out all
          </Button>
        </XStack>
      </SurfaceCard>

      <AppLink href={appRoutes.settingsSection('security')} asChild>
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
          <Icons.ShieldCheck size={18} color={ui.brand} />
          <YStack flex={1} gap={2}>
            <Text fontSize={15} color={ui.text} fontWeight="600">
              Security & sessions
            </Text>
            <Text fontSize={13} color={ui.textMuted}>
              Devices, passkeys, and connected accounts
            </Text>
          </YStack>
          <Icons.ChevronRight size={16} color={ui.textMuted} />
        </XStack>
      </AppLink>

      <AppLink href={routes.profile} asChild>
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
      </AppLink>

      <ConfirmDialog
        open={confirmGlobal}
        onOpenChange={setConfirmGlobal}
        title="Sign out of all devices?"
        description="You'll need to sign in again on every device, including this one."
        confirmLabel="Sign out all"
        destructive
        onConfirm={() => {
          void handleSignOutAll()
        }}
      />
    </SettingsPanel>
  )
}
