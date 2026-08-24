import { useEffect, useState } from 'react'
import { AppLink } from '~/components/navigation/AppLink'
import { Share } from 'react-native'

import { Button, ConfirmDialog, Icons, Spinner, Text, XStack, YStack, useAppToast } from '~/components/ui'
import { SurfaceCard } from '~/components/layout'
import { radius } from '~/config/tokens'
import { SettingsPanel } from '~/components/settings/SettingsPanel'
import { confirmSensitiveAction } from '~/features/auth/services/confirm-sensitive-action'
import { useAuth } from '~/hooks/useAuth'
import { BRAND_NAME } from '~/config/brand'
import { ensureReferralCode, getInviteShareUrl } from '~/lib/referral/invite'
import { softDeleteProfile } from '~/lib/profile/profile.service'
import { copyToClipboard } from '~/lib/platform/clipboard'
import { appRoutes, routes } from '~/lib/routes'
import { useAppUi } from '~/lib/theme/useAppUi'
import { useSupabase } from '~/providers/SupabaseProvider'
import { QA } from '~/lib/qa/test-ids'

export function AccountSettingsPanel() {
  const ui = useAppUi()
  const toast = useAppToast()
  const { user } = useSupabase()
  const { signOutLocal, signOutGlobal } = useAuth()
  const [isSigningOut, setIsSigningOut] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [confirmGlobal, setConfirmGlobal] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [inviteCode, setInviteCode] = useState<string | null>(null)
  const [inviteLoading, setInviteLoading] = useState(false)

  useEffect(() => {
    if (!user?.id) {
      setInviteCode(null)
      return
    }
    let cancelled = false
    setInviteLoading(true)
    void ensureReferralCode(user.id).then((result) => {
      if (cancelled) return
      setInviteLoading(false)
      if (result.code) setInviteCode(result.code)
    })
    return () => {
      cancelled = true
    }
  }, [user?.id])

  async function handleShareInvite() {
    if (!inviteCode) return
    const url = getInviteShareUrl(inviteCode)
    const message = `Join me on ${BRAND_NAME} with my invite code ${inviteCode}\n${url}`
    try {
      await Share.share({ title: `${BRAND_NAME} invite`, message, url })
    } catch {
      const copied = await copyToClipboard(url)
      toast.show(copied ? 'Invite link copied' : 'Could not share invite', {
        tone: copied ? 'success' : 'danger',
      })
    }
  }

  async function handleCopyInvite() {
    if (!inviteCode) return
    const url = getInviteShareUrl(inviteCode)
    const copied = await copyToClipboard(url)
    toast.show(copied ? 'Invite link copied' : 'Could not copy', {
      tone: copied ? 'success' : 'danger',
    })
  }

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
      <SurfaceCard padding="$4" borderRadius={radius.card} gap="$3">
        <XStack alignItems="center" gap="$2">
          <Icons.Gift size={18} color={ui.brand} />
          <Text fontWeight="700" color={ui.text}>
            Invite friends
          </Text>
        </XStack>
        <Text fontSize={13} color={ui.textSecondary} lineHeight={19}>
          Share your personal invite link. Friends who join via your code are linked to your
          network on {BRAND_NAME}.
        </Text>
        {inviteLoading ? (
          <Spinner size="small" color={ui.brand} />
        ) : inviteCode ? (
          <YStack gap="$2">
            <Text fontSize={12} fontWeight="700" color={ui.textMuted} letterSpacing={0.4}>
              YOUR CODE
            </Text>
            <Text fontSize={20} fontWeight="800" color={ui.text} letterSpacing={1}>
              {inviteCode}
            </Text>
            <XStack gap="$2" flexWrap="wrap">
              <Button
                size="$3"
                tone="primary"
                borderRadius={999}
                icon={<Icons.Share2 size={14} />}
                onPress={() => void handleShareInvite()}
              >
                Share invite
              </Button>
              <Button size="$3" tone="outline" borderRadius={999} onPress={() => void handleCopyInvite()}>
                Copy link
              </Button>
            </XStack>
          </YStack>
        ) : (
          <Text fontSize={13} color={ui.textMuted}>
            Sign in to get your invite code.
          </Text>
        )}
      </SurfaceCard>

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
          testID={QA.profileEdit}
          accessibilityLabel="Your profile"
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
