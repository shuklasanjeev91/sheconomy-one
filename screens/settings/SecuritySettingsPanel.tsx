import { useCallback, useEffect, useState } from 'react'
import { AppLink } from '~/components/navigation/AppLink'

import {
  Badge,
  Button,
  ConfirmDialog,
  Icons,
  Input,
  Separator,
  Spinner,
  Text,
  XStack,
  YStack,
  useAppToast,
} from '~/components/ui'
import { SurfaceCard } from '~/components/layout'
import { SettingsPanel, SettingsSectionHeading } from '~/components/settings/SettingsPanel'
import { radius } from '~/config/tokens'
import { confirmSensitiveAction } from '~/features/auth/services/confirm-sensitive-action'
import {
  linkSocialAccount,
  listConnectedIdentities,
  unlinkSocialAccount,
  type ConnectedIdentity,
} from '~/features/auth/services/connected-accounts'
import {
  listLoginSessions,
  revokeLoginSession,
  type AuthLoginSession,
} from '~/features/auth/services/login-sessions'
import type { OAuthProvider } from '~/features/auth/services/oauth'
import {
  deletePasskey,
  isPasskeySignInSupported,
  listPasskeys,
  registerPasskey,
  type PasskeyInfo,
} from '~/features/auth/services/passkeys'
import {
  getSuspiciousSessions,
  signOutOtherDevicesAfterAlert,
} from '~/features/auth/services/suspicious-login'
import { approveQrLoginChallenge } from '~/features/auth/services/qr-login'
import { useAuth } from '~/hooks/useAuth'
import { useAppUi } from '~/lib/theme/useAppUi'

function formatLastSeen(iso: string): string {
  try {
    const date = new Date(iso)
    return date.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })
  } catch {
    return iso
  }
}

function providerLabel(provider: string): string {
  if (provider === 'linkedin_oidc') return 'LinkedIn'
  if (provider === 'email') return 'Email OTP'
  if (provider === 'phone') return 'Phone OTP'
  return provider.charAt(0).toUpperCase() + provider.slice(1)
}

export function SecuritySettingsPanel() {
  const ui = useAppUi()
  const toast = useAppToast()
  const { signOutLocal, signOutGlobal } = useAuth()

  const [sessions, setSessions] = useState<AuthLoginSession[]>([])
  const [identities, setIdentities] = useState<ConnectedIdentity[]>([])
  const [passkeys, setPasskeys] = useState<PasskeyInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [confirmGlobal, setConfirmGlobal] = useState(false)
  const [confirmOthers, setConfirmOthers] = useState(false)
  const [approveCode, setApproveCode] = useState('')

  const passkeysSupported = isPasskeySignInSupported()
  const suspicious = getSuspiciousSessions(sessions)

  const refresh = useCallback(async () => {
    setLoading(true)
    const [sessionResult, identityResult, passkeyResult] = await Promise.all([
      listLoginSessions(),
      listConnectedIdentities(),
      passkeysSupported ? listPasskeys() : Promise.resolve({ passkeys: [], error: null }),
    ])
    if (sessionResult.error) {
      toast.show('Could not load sessions', { tone: 'danger', message: sessionResult.error })
    } else {
      setSessions(sessionResult.sessions)
    }
    if (identityResult.error) {
      toast.show('Could not load connected accounts', {
        tone: 'danger',
        message: identityResult.error,
      })
    } else {
      setIdentities(identityResult.identities)
    }
    if (!passkeyResult.error) {
      setPasskeys(passkeyResult.passkeys)
    }
    setLoading(false)
  }, [passkeysSupported, toast])

  useEffect(() => {
    void refresh()
  }, [refresh])

  async function handleRevokeSession(session: AuthLoginSession) {
    setBusy(`revoke:${session.id}`)
    const { error } = await revokeLoginSession(session.id)
    setBusy(null)
    if (error) {
      toast.show('Could not revoke session', { tone: 'danger', message: error })
      return
    }
    toast.show('Device signed out', { tone: 'success' })
    await refresh()
  }

  async function handleSignOutOthers() {
    setBusy('others')
    const { error } = await signOutOtherDevicesAfterAlert()
    setBusy(null)
    setConfirmOthers(false)
    if (error) {
      toast.show('Could not sign out other devices', { tone: 'danger', message: error })
      return
    }
    toast.show('Signed out of all other devices', { tone: 'success' })
    await refresh()
  }

  async function handleSignOutLocal() {
    setBusy('local')
    const { error } = await signOutLocal()
    setBusy(null)
    if (error) toast.show('Sign out failed', { tone: 'danger', message: error })
  }

  async function handleSignOutGlobal() {
    const gate = await confirmSensitiveAction('Confirm sign out of all devices')
    if (!gate.ok) {
      setConfirmGlobal(false)
      toast.show('Confirmation required', { tone: 'warning', message: gate.error ?? undefined })
      return
    }
    setBusy('global')
    const { error } = await signOutGlobal()
    setBusy(null)
    setConfirmGlobal(false)
    if (error) toast.show('Sign out failed', { tone: 'danger', message: error })
  }

  async function handleRegisterPasskey() {
    setBusy('passkey-register')
    const { error } = await registerPasskey('SHEconomy')
    setBusy(null)
    if (error) {
      toast.show('Could not add passkey', { tone: 'danger', message: error })
      return
    }
    toast.show('Passkey added', { tone: 'success' })
    await refresh()
  }

  async function handleDeletePasskey(id: string) {
    const gate = await confirmSensitiveAction('Confirm passkey removal')
    if (!gate.ok) {
      toast.show('Confirmation required', { tone: 'warning', message: gate.error ?? undefined })
      return
    }
    setBusy(`passkey:${id}`)
    const { error } = await deletePasskey(id)
    setBusy(null)
    if (error) {
      toast.show('Could not remove passkey', { tone: 'danger', message: error })
      return
    }
    toast.show('Passkey removed', { tone: 'success' })
    await refresh()
  }

  async function handleLink(provider: OAuthProvider) {
    setBusy(`link:${provider}`)
    const { error } = await linkSocialAccount(provider)
    setBusy(null)
    if (error) {
      toast.show('Could not link account', { tone: 'danger', message: error })
      return
    }
    toast.show('Account linked', { tone: 'success' })
    await refresh()
  }

  async function handleUnlink(identity: ConnectedIdentity) {
    const gate = await confirmSensitiveAction('Confirm unlinking this account')
    if (!gate.ok) {
      toast.show('Confirmation required', { tone: 'warning', message: gate.error ?? undefined })
      return
    }
    setBusy(`unlink:${identity.id}`)
    const { error } = await unlinkSocialAccount(identity.identity)
    setBusy(null)
    if (error) {
      toast.show('Could not unlink account', { tone: 'danger', message: error })
      return
    }
    toast.show('Account unlinked', { tone: 'success' })
    await refresh()
  }

  const linkedProviders = new Set(identities.map((i) => i.provider))
  const linkTargets: OAuthProvider[] = ['google', 'apple', 'linkedin_oidc'].filter(
    (p) => !linkedProviders.has(p),
  ) as OAuthProvider[]

  return (
    <SettingsPanel
      title="Security & sessions"
      description="Devices, passkeys, connected accounts, and sign-out controls"
    >
      {loading ? (
        <YStack padding="$6" alignItems="center">
          <Spinner size="large" />
        </YStack>
      ) : (
        <YStack gap="$5">
          {suspicious.length > 0 ? (
            <SurfaceCard
              padding="$4"
              borderRadius={radius.card}
              borderColor="$red8"
              backgroundColor="$red2"
            >
              <YStack gap="$3">
                <XStack gap="$2" alignItems="center">
                  <Icons.AlertTriangle size={18} color="$red10" />
                  <Text fontWeight="700" color="$red11">
                    New or unusual sign-in detected
                  </Text>
                </XStack>
                <Text fontSize={13} color={ui.textSecondary} lineHeight={18}>
                  {suspicious[0]?.device_label ?? 'A new device'} signed in recently. If this
                  wasn&apos;t you, sign out of all other devices.
                </Text>
                <Button
                  tone="destructive"
                  size="$3"
                  disabled={busy != null}
                  onPress={() => setConfirmOthers(true)}
                >
                  Sign out all other devices
                </Button>
              </YStack>
            </SurfaceCard>
          ) : null}

          <YStack gap="$2">
            <SettingsSectionHeading title="Login on another device" />
            <SurfaceCard padding="$4" borderRadius={radius.card}>
              <YStack gap="$3">
                <Text fontSize={13} color={ui.textMuted} lineHeight={18}>
                  On web sign-in choose “Log in with phone”, scan the QR with this device, or paste
                  the device code here to approve the browser session.
                </Text>
                <XStack gap="$2" alignItems="center">
                  <Input
                    flex={1}
                    placeholder="Paste device code"
                    value={approveCode}
                    onChangeText={setApproveCode}
                    autoCapitalize="none"
                  />
                  <Button
                    tone="primary"
                    size="$3"
                    disabled={busy != null || !approveCode.trim()}
                    onPress={() => {
                      void (async () => {
                        setBusy('qr-approve')
                        const result = await approveQrLoginChallenge(approveCode.trim())
                        setBusy(null)
                        if (result.error) {
                          toast.show(result.error, { tone: 'danger' })
                          return
                        }
                        toast.show('Web login approved', { tone: 'success' })
                        setApproveCode('')
                      })()
                    }}
                  >
                    Approve
                  </Button>
                </XStack>
                <AppLink href={'/auth/qr' as never} asChild>
                  <Text fontSize={13} color={ui.brand} fontWeight="600">
                    Open approve screen
                  </Text>
                </AppLink>
              </YStack>
            </SurfaceCard>
          </YStack>

          <YStack gap="$2">
            <SettingsSectionHeading title="Active sessions" />
            <SurfaceCard padding="$0" borderRadius={radius.card} overflow="hidden">
              {sessions.length === 0 ? (
                <YStack padding="$4">
                  <Text fontSize={13} color={ui.textMuted}>
                    No active session records yet. They appear after your next sign-in.
                  </Text>
                </YStack>
              ) : (
                sessions.map((session, index) => (
                  <YStack key={session.id}>
                    {index > 0 ? <Separator /> : null}
                    <XStack
                      paddingHorizontal="$4"
                      paddingVertical="$3.5"
                      alignItems="center"
                      gap="$3"
                      backgroundColor={session.is_suspicious ? '$red2' : undefined}
                    >
                      <Icons.Smartphone size={18} color={ui.textSecondary} />
                      <YStack flex={1} gap={2} minWidth={0}>
                        <XStack gap="$2" alignItems="center" flexWrap="wrap">
                          <Text fontWeight="600" color={ui.text}>
                            {session.device_label ?? 'Device'}
                          </Text>
                          {session.is_current ? (
                            <Badge tone="brand">This device</Badge>
                          ) : null}
                          {session.is_suspicious ? (
                            <Badge tone="danger">New</Badge>
                          ) : null}
                        </XStack>
                        <Text fontSize={12} color={ui.textMuted}>
                          {session.platform}
                          {session.ip ? ` · ${session.ip}` : ''}
                          {' · '}
                          {formatLastSeen(session.last_seen_at)}
                        </Text>
                      </YStack>
                      {!session.is_current ? (
                        <Button
                          tone="outline"
                          size="$2"
                          disabled={busy != null}
                          onPress={() => void handleRevokeSession(session)}
                        >
                          {busy === `revoke:${session.id}` ? '…' : 'Revoke'}
                        </Button>
                      ) : null}
                    </XStack>
                  </YStack>
                ))
              )}
            </SurfaceCard>
          </YStack>

          <YStack gap="$2">
            <SettingsSectionHeading title="Sign out" />
            <SurfaceCard padding="$0" borderRadius={radius.card} overflow="hidden">
              <XStack
                paddingHorizontal="$4"
                paddingVertical="$3.5"
                alignItems="center"
                justifyContent="space-between"
                gap="$3"
              >
                <YStack flex={1} gap={2}>
                  <Text fontWeight="600" color={ui.text}>
                    Sign out this device
                  </Text>
                  <Text fontSize={13} color={ui.textMuted}>
                    Ends only the session on this device
                  </Text>
                </YStack>
                <Button
                  tone="outline"
                  size="$3"
                  disabled={busy != null}
                  onPress={() => void handleSignOutLocal()}
                >
                  {busy === 'local' ? 'Signing out…' : 'Sign out'}
                </Button>
              </XStack>
              <Separator />
              <XStack
                paddingHorizontal="$4"
                paddingVertical="$3.5"
                alignItems="center"
                justifyContent="space-between"
                gap="$3"
              >
                <YStack flex={1} gap={2}>
                  <Text fontWeight="600" color={ui.text}>
                    Sign out of all devices
                  </Text>
                  <Text fontSize={13} color={ui.textMuted}>
                    Ends every session everywhere
                  </Text>
                </YStack>
                <Button
                  tone="destructive"
                  size="$3"
                  disabled={busy != null}
                  onPress={() => setConfirmGlobal(true)}
                >
                  Sign out all
                </Button>
              </XStack>
              {sessions.some((s) => !s.is_current) ? (
                <>
                  <Separator />
                  <XStack
                    paddingHorizontal="$4"
                    paddingVertical="$3.5"
                    alignItems="center"
                    justifyContent="space-between"
                    gap="$3"
                  >
                    <YStack flex={1} gap={2}>
                      <Text fontWeight="600" color={ui.text}>
                        Sign out other devices
                      </Text>
                      <Text fontSize={13} color={ui.textMuted}>
                        Keep this device signed in
                      </Text>
                    </YStack>
                    <Button
                      tone="outline"
                      size="$3"
                      disabled={busy != null}
                      onPress={() => setConfirmOthers(true)}
                    >
                      Sign out others
                    </Button>
                  </XStack>
                </>
              ) : null}
            </SurfaceCard>
          </YStack>

          {passkeysSupported ? (
            <YStack gap="$2">
              <SettingsSectionHeading title="Passkeys" />
              <SurfaceCard padding="$0" borderRadius={radius.card} overflow="hidden">
                {passkeys.length === 0 ? (
                  <YStack padding="$4" gap="$3">
                    <Text fontSize={13} color={ui.textMuted}>
                      Add a passkey to sign in with Face ID, Touch ID, or a security key.
                    </Text>
                    <Button
                      tone="outline"
                      size="$3"
                      alignSelf="flex-start"
                      disabled={busy != null}
                      onPress={() => void handleRegisterPasskey()}
                      icon={<Icons.Fingerprint size={16} />}
                    >
                      {busy === 'passkey-register' ? 'Adding…' : 'Add passkey'}
                    </Button>
                  </YStack>
                ) : (
                  <>
                    {passkeys.map((pk, index) => (
                      <YStack key={pk.id}>
                        {index > 0 ? <Separator /> : null}
                        <XStack
                          paddingHorizontal="$4"
                          paddingVertical="$3.5"
                          alignItems="center"
                          gap="$3"
                        >
                          <Icons.KeyRound size={18} color={ui.textSecondary} />
                          <YStack flex={1} gap={2}>
                            <Text fontWeight="600" color={ui.text}>
                              {pk.friendly_name || 'Passkey'}
                            </Text>
                            {pk.created_at ? (
                              <Text fontSize={12} color={ui.textMuted}>
                                Added {formatLastSeen(pk.created_at)}
                              </Text>
                            ) : null}
                          </YStack>
                          <Button
                            tone="outline"
                            size="$2"
                            disabled={busy != null}
                            onPress={() => void handleDeletePasskey(pk.id)}
                          >
                            Remove
                          </Button>
                        </XStack>
                      </YStack>
                    ))}
                    <Separator />
                    <YStack padding="$3" paddingHorizontal="$4">
                      <Button
                        tone="outline"
                        size="$3"
                        alignSelf="flex-start"
                        disabled={busy != null}
                        onPress={() => void handleRegisterPasskey()}
                      >
                        Add another passkey
                      </Button>
                    </YStack>
                  </>
                )}
              </SurfaceCard>
            </YStack>
          ) : null}

          <YStack gap="$2">
            <SettingsSectionHeading title="Connected accounts" />
            <SurfaceCard padding="$0" borderRadius={radius.card} overflow="hidden">
              {identities.map((identity, index) => (
                <YStack key={identity.id}>
                  {index > 0 ? <Separator /> : null}
                  <XStack
                    paddingHorizontal="$4"
                    paddingVertical="$3.5"
                    alignItems="center"
                    gap="$3"
                  >
                    <Icons.Link size={18} color={ui.textSecondary} />
                    <YStack flex={1} gap={2}>
                      <Text fontWeight="600" color={ui.text}>
                        {providerLabel(identity.provider)}
                      </Text>
                      {identity.email ? (
                        <Text fontSize={12} color={ui.textMuted}>
                          {identity.email}
                        </Text>
                      ) : null}
                    </YStack>
                    {identities.length > 1 &&
                    !['email', 'phone'].includes(identity.provider) ? (
                      <Button
                        tone="outline"
                        size="$2"
                        disabled={busy != null}
                        onPress={() => void handleUnlink(identity)}
                      >
                        Unlink
                      </Button>
                    ) : null}
                  </XStack>
                </YStack>
              ))}
              {linkTargets.length > 0 ? (
                <>
                  <Separator />
                  <YStack padding="$4" gap="$2">
                    <Text fontSize={13} color={ui.textMuted}>
                      Link another login method to this account
                    </Text>
                    <XStack gap="$2" flexWrap="wrap">
                      {linkTargets.map((provider) => (
                        <Button
                          key={provider}
                          tone="outline"
                          size="$2"
                          disabled={busy != null}
                          onPress={() => void handleLink(provider)}
                        >
                          Link {providerLabel(provider)}
                        </Button>
                      ))}
                    </XStack>
                  </YStack>
                </>
              ) : null}
            </SurfaceCard>
          </YStack>
        </YStack>
      )}

      <ConfirmDialog
        open={confirmGlobal}
        onOpenChange={setConfirmGlobal}
        title="Sign out of all devices?"
        description="You'll need to sign in again on every device, including this one."
        confirmLabel="Sign out all"
        destructive
        onConfirm={() => {
          void handleSignOutGlobal()
        }}
      />
      <ConfirmDialog
        open={confirmOthers}
        onOpenChange={setConfirmOthers}
        title="Sign out other devices?"
        description="This keeps you signed in here and ends sessions everywhere else."
        confirmLabel="Sign out others"
        destructive
        onConfirm={() => {
          void handleSignOutOthers()
        }}
      />
    </SettingsPanel>
  )
}
