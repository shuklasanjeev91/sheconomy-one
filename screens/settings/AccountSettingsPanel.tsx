import { useState } from 'react'
import { AppLink } from '~/components/navigation/AppLink'

import { Button, ConfirmDialog, Icons, Text, XStack, YStack, useAppToast } from '~/components/ui'
import { SurfaceCard } from '~/components/layout'
import { radius } from '~/config/tokens'
import { SettingsPanel } from '~/components/settings/SettingsPanel'
import { confirmSensitiveAction } from '~/features/auth/services/confirm-sensitive-action'
import { useAuth } from '~/hooks/useAuth'
import { softDeleteProfile } from '~/lib/profile/profile.service'
import { appRoutes, routes } from '~/lib/routes'
import { useAppUi } from '~/lib/theme/useAppUi'
import { useSupabase } from '~/providers/SupabaseProvider'

export function AccountSettingsPanel() {
  const ui = useAppUi()
  const toast = useAppToast()
  const { user } = useSupabase()
  const { signOutLocal, signOutGlobal } = useAuth()
  const [isSigningOut, setIsSigningOut] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [confirmGlobal, setConfirmGlobal] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

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

  async function handleDeleteAccount() {
    if (!user?.id) {
      setConfirmDelete(false)
      toast.show('Sign in required', { tone: 'warning', message: 'Sign in again to delete your account.' })
      return
    }
    const gate = await confirmSensitiveAction('Confirm account deletion')
    if (!gate.ok) {
      setConfirmDelete(false)
      toast.show('Confirmation required', { tone: 'warning', message: gate.error ?? undefined })
      return
    }
    setIsDeleting(true)
    const result = await softDeleteProfile(user.id, 'User requested deletion from Settings')
    if (result.error) {
      setIsDeleting(false)
      setConfirmDelete(false)
      toast.show('Deletion failed', { tone: 'danger', message: result.error })
      return
    }
    const { error } = await signOutGlobal()
    setIsDeleting(false)
    setConfirmDelete(false)
    if (error) {
      toast.show('Account deactivated', {
        tone: 'warning',
        message: 'Your account is scheduled for deletion. Sign-out failed — close the app and sign out manually.',
      })
      return
    }
    toast.show('Account deletion started', {
      tone: 'success',
      message: 'Your account is deactivated and scheduled for permanent removal.',
    })
  }

  return (
    <SettingsPanel title="Account" description="Sign out, delete your account, and manage your profile">
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

      <SurfaceCard padding="$0" borderRadius={radius.card} overflow="hidden">
        <XStack
          alignItems="center"
          justifyContent="space-between"
          paddingHorizontal="$4"
          paddingVertical="$3"
        >
          <XStack gap="$3" alignItems="center" flex={1}>
            <Icons.Trash2 size={18} color="$red10" />
            <YStack gap={2} flex={1} minWidth={0}>
              <Text fontWeight="600" color={ui.text}>
                Delete account
              </Text>
              <Text fontSize={13} color={ui.textMuted}>
                Deactivates your account and schedules permanent deletion
              </Text>
            </YStack>
          </XStack>
          <Button
            tone="destructive"
            size="$3"
            disabled={isDeleting || isSigningOut || !user?.id}
            onPress={() => setConfirmDelete(true)}
          >
            {isDeleting ? 'Deleting…' : 'Delete'}
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

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Delete your account?"
        description="Your account will be deactivated now and scheduled for permanent deletion. You will be signed out on all devices. This cannot be undone from the app."
        confirmLabel="Delete account"
        destructive
        onConfirm={() => {
          void handleDeleteAccount()
        }}
      />
    </SettingsPanel>
  )
}
