import { useEffect, useState } from 'react'
import { Share } from 'react-native'
import { useLocalSearchParams } from 'one'

import { ScreenCenter } from '~/components/layout'
import { Button, Icons, Spinner, Text, YStack, useAppToast } from '~/components/ui'
import { BRAND_NAME } from '~/config/brand'
import {
  applyPendingReferralForUser,
  storePendingInviteCode,
} from '~/lib/referral/invite'
import { appRoutes, commerceRoutes } from '~/lib/routes'
import { navigateApp } from '~/lib/platform/navigate'
import { useAppUi } from '~/lib/theme/useAppUi'
import { useSupabase } from '~/providers/SupabaseProvider'

export function InviteRedeemScreen() {
  const ui = useAppUi()
  const toast = useAppToast()
  const { user, isLoading } = useSupabase()
  const params = useLocalSearchParams<{ code?: string | string[] }>()
  const raw = params.code
  const code = (Array.isArray(raw) ? raw[0] : raw)?.trim() ?? ''
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function run() {
      if (!code) {
        setReady(true)
        return
      }
      await storePendingInviteCode(code)
      if (cancelled) return
      if (!isLoading && user?.id) {
        const result = await applyPendingReferralForUser(user.id)
        if (!cancelled && result.applied) {
          toast.show('Invite applied', {
            tone: 'success',
            message: `Welcome to ${BRAND_NAME}! Your friend's invite is linked.`,
          })
        }
        navigateApp(commerceRoutes.home)
        return
      }
      if (!isLoading && !user) {
        setReady(true)
      }
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [code, isLoading, toast, user])

  if (!code) {
    return (
      <ScreenCenter backgroundColor={ui.pageBg} padding="$6" gap="$3">
        <Icons.AlertTriangle size={28} color={ui.brand} />
        <Text fontSize={18} fontWeight="700" color={ui.text} textAlign="center">
          Invite link incomplete
        </Text>
        <Button tone="primary" borderRadius={999} onPress={() => navigateApp(commerceRoutes.home)}>
          Go home
        </Button>
      </ScreenCenter>
    )
  }

  if (!ready) {
    return (
      <ScreenCenter backgroundColor={ui.pageBg} gap="$3">
        <Spinner size="large" color={ui.brand} />
        <Text color={ui.textSecondary}>Opening invite…</Text>
      </ScreenCenter>
    )
  }

  return (
    <ScreenCenter backgroundColor={ui.pageBg} padding="$6" gap="$4">
      <YStack
        width={56}
        height={56}
        borderRadius={999}
        alignItems="center"
        justifyContent="center"
        backgroundColor={ui.roseSurface}
      >
        <Icons.Gift size={24} color={ui.brand} />
      </YStack>
      <Text fontSize={22} fontWeight="800" color={ui.text} textAlign="center">
        You are invited to {BRAND_NAME}
      </Text>
      <Text fontSize={14} color={ui.textSecondary} textAlign="center" maxWidth={360}>
        Sign up or sign in to join with invite code{' '}
        <Text fontWeight="800" color={ui.text}>
          {code.toUpperCase()}
        </Text>
        . Members who join via friends help grow our women-first network.
      </Text>
      <YStack gap="$2" width="100%" maxWidth={320}>
        <Button
          tone="primary"
          borderRadius={999}
          onPress={() => navigateApp(appRoutes.signUp ?? appRoutes.signIn)}
        >
          Create account
        </Button>
        <Button tone="outline" borderRadius={999} onPress={() => navigateApp(appRoutes.signIn)}>
          Sign in
        </Button>
        <Button
          tone="ghost"
          borderRadius={999}
          onPress={() => {
            void Share.share({
              message: `Join me on ${BRAND_NAME}: ${code}`,
              title: `${BRAND_NAME} invite`,
            })
          }}
        >
          Share this invite
        </Button>
      </YStack>
    </ScreenCenter>
  )
}
