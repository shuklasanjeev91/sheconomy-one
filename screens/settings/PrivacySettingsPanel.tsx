import { useCallback, useEffect, useState } from 'react'
import { Alert, Platform } from 'react-native'

import {
  Avatar,
  Button,
  ConfirmDialog,
  Icons,
  Separator,
  Spinner,
  Text,
  XStack,
  YStack,
  useAppToast,
} from '~/components/ui'
import { SurfaceCard } from '~/components/layout'
import { PreferenceRow, SettingsPanel } from '~/components/settings/SettingsPanel'
import { radius } from '~/config/tokens'
import {
  getBiometricCapability,
  isBiometricUnlockEnabled,
  setBiometricUnlockEnabled,
} from '~/features/auth/services/biometric-unlock'
import {
  listBlockedMembers,
  unblockCommunityMember,
  type BlockedMember,
} from '~/community/lib/moderation'
import { invalidateCache, INVALIDATION_TOPICS } from '~/lib/cache/invalidation'
import { feedback } from '~/lib/platform/feedback'
import { useAppUi } from '~/lib/theme/useAppUi'
import { useSupabase } from '~/providers/SupabaseProvider'

function memberLabel(member: BlockedMember) {
  return member.fullName || (member.username ? `@${member.username}` : 'Member')
}

export function PrivacySettingsPanel() {
  const ui = useAppUi()
  const toast = useAppToast()
  const { user } = useSupabase()
  const [enabled, setEnabled] = useState(false)
  const [label, setLabel] = useState('Biometric unlock')
  const [supported, setSupported] = useState(false)
  const [loading, setLoading] = useState(Platform.OS !== 'web')
  const [blocked, setBlocked] = useState<BlockedMember[]>([])
  const [blockedLoading, setBlockedLoading] = useState(!!user?.id)
  const [unblockTarget, setUnblockTarget] = useState<BlockedMember | null>(null)
  const [unblocking, setUnblocking] = useState(false)

  const refreshBlocked = useCallback(async () => {
    if (!user?.id) {
      setBlocked([])
      setBlockedLoading(false)
      return
    }
    setBlockedLoading(true)
    const result = await listBlockedMembers(user.id)
    setBlocked(result.members)
    setBlockedLoading(false)
    if (result.error) {
      toast.show('Could not load blocked members', {
        tone: 'danger',
        message: result.error,
      })
    }
  }, [toast, user?.id])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const cap = await getBiometricCapability()
      const on = await isBiometricUnlockEnabled()
      if (cancelled) return
      setSupported(cap.supported && cap.enrolled)
      setLabel(`${cap.label} unlock`)
      setEnabled(on)
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    void refreshBlocked()
  }, [refreshBlocked])

  const performUnblock = useCallback(
    async (member: BlockedMember) => {
      if (!user?.id) return
      setUnblocking(true)
      const result = await unblockCommunityMember(user.id, member.blockedId)
      setUnblocking(false)
      setUnblockTarget(null)
      if (result.error) {
        toast.show('Could not unblock', { tone: 'danger', message: result.error })
        return
      }
      void feedback('success')
      toast.show('Member unblocked', {
        tone: 'success',
        message: 'They can appear in community and chat again.',
      })
      invalidateCache(INVALIDATION_TOPICS.communityPosts, 'chats')
      await refreshBlocked()
    },
    [refreshBlocked, toast, user?.id],
  )

  function requestUnblock(member: BlockedMember) {
    if (Platform.OS === 'web') {
      setUnblockTarget(member)
      return
    }
    const name = memberLabel(member)
    Alert.alert(
      'Unblock member?',
      `${name} will be able to interact with you again in community and chat.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unblock',
          style: 'destructive',
          onPress: () => void performUnblock(member),
        },
      ],
    )
  }

  return (
    <SettingsPanel title="Privacy" description="Visibility, unlock, and blocked members">
      <SurfaceCard padding="$0" borderRadius={radius.card} overflow="hidden">
        <XStack
          alignItems="center"
          justifyContent="space-between"
          paddingHorizontal="$4"
          paddingVertical="$3.5"
          minHeight={56}
          accessibilityRole="text"
          accessibilityLabel="Profile visibility: Public"
        >
          <XStack alignItems="center" gap="$3" flex={1} minWidth={0}>
            <Icons.Eye size={18} color={ui.textSecondary} />
            <YStack gap={2} flex={1} minWidth={0}>
              <Text fontSize={15} color={ui.text}>
                Profile visibility
              </Text>
              <Text fontSize={13} color={ui.textMuted}>
                Public — everyone can find your profile
              </Text>
            </YStack>
          </XStack>
        </XStack>
        <Separator />
        {Platform.OS === 'web' ? (
          <YStack paddingHorizontal="$4" paddingVertical="$3.5">
            <Text fontSize={15} color={ui.text}>
              App unlock
            </Text>
            <Text fontSize={13} color={ui.textMuted}>
              Biometric unlock is available in the iOS and Android apps.
            </Text>
          </YStack>
        ) : (
          <PreferenceRow
            icon={Icons.Fingerprint}
            title={label}
            subtitle={
              loading
                ? 'Checking device…'
                : supported
                  ? 'Require unlock when opening the app with a remembered session'
                  : 'Not available — enroll biometrics or a device PIN in system settings'
            }
            checked={enabled}
            disabled={loading || !supported}
            onCheckedChange={(next) => {
              void (async () => {
                await setBiometricUnlockEnabled(next)
                setEnabled(next)
                toast.show(next ? `${label} enabled` : `${label} disabled`, {
                  tone: 'success',
                })
              })()
            }}
          />
        )}
      </SurfaceCard>

      <YStack gap="$3" marginTop="$4" testID="blocked-members-section">
        <Text fontSize={16} fontWeight="700" color={ui.text}>
          Blocked members
        </Text>
        <Text fontSize={13} color={ui.textMuted} lineHeight={18}>
          People you block won’t appear in your community feed. Unblocking refreshes chat and
          community exclusions immediately.
        </Text>

        <SurfaceCard padding="$0" borderRadius={radius.card} overflow="hidden">
          {!user ? (
            <YStack padding="$4">
              <Text fontSize={14} color={ui.textMuted}>
                Sign in to manage blocked members.
              </Text>
            </YStack>
          ) : blockedLoading ? (
            <YStack padding="$5" alignItems="center">
              <Spinner size="small" color={ui.brand} />
            </YStack>
          ) : blocked.length === 0 ? (
            <YStack padding="$4" gap="$1">
              <Text fontSize={14} fontWeight="600" color={ui.text}>
                No blocked members
              </Text>
              <Text fontSize={13} color={ui.textMuted}>
                When you block someone from a post or profile, they show up here.
              </Text>
            </YStack>
          ) : (
            blocked.map((member, index) => {
              const name = memberLabel(member)
              return (
                <YStack key={member.id}>
                  {index > 0 ? <Separator /> : null}
                  <XStack
                    alignItems="center"
                    gap="$3"
                    paddingHorizontal="$4"
                    paddingVertical="$3"
                    minHeight={56}
                  >
                    <Avatar size={40} src={member.avatarUrl} name={name} />
                    <YStack flex={1} minWidth={0} gap={2}>
                      <Text fontSize={15} fontWeight="600" color={ui.text} numberOfLines={1}>
                        {name}
                      </Text>
                      {member.username && member.fullName ? (
                        <Text fontSize={12} color={ui.textMuted} numberOfLines={1}>
                          @{member.username}
                        </Text>
                      ) : null}
                    </YStack>
                    <Button
                      size="$3"
                      tone="outline"
                      borderRadius={999}
                      minHeight={44}
                      disabled={unblocking}
                      onPress={() => requestUnblock(member)}
                      accessibilityLabel={`Unblock ${name}`}
                    >
                      Unblock
                    </Button>
                  </XStack>
                </YStack>
              )
            })
          )}
        </SurfaceCard>
      </YStack>

      <ConfirmDialog
        open={Platform.OS === 'web' && !!unblockTarget}
        onOpenChange={(open) => {
          if (!open) setUnblockTarget(null)
        }}
        title="Unblock member?"
        description={
          unblockTarget
            ? `${memberLabel(unblockTarget)} will be able to interact with you again in community and chat.`
            : undefined
        }
        confirmLabel="Unblock"
        cancelLabel="Cancel"
        destructive
        onConfirm={() => {
          if (unblockTarget) void performUnblock(unblockTarget)
        }}
      />
    </SettingsPanel>
  )
}
