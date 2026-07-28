import { useEffect, useState } from 'react'
import { Platform } from 'react-native'
import { useRouter } from 'one'

import { PageCenter } from '~/components/layout'
import { Button, Spinner, Text, YStack, useAppToast } from '~/components/ui'
import { approveQrLoginChallenge } from '~/features/auth/services/qr-login'
import { useAuth } from '~/hooks/useAuth'
import { buildSignInUrl } from '~/lib/auth/redirect'
import { getSearchParam } from '~/lib/platform/url'
import { useAppUi } from '~/lib/theme/useAppUi'

/**
 * Mobile (or web) deep-link target for approving a QR login challenge.
 * Requires an authenticated session on this device.
 */
export default function AuthQrApproveRoute() {
  const ui = useAppUi()
  const toast = useAppToast()
  const router = useRouter()
  const { isAuthenticated, isLoading, signIn } = useAuth()
  const [code, setCode] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fromQuery =
      getSearchParam('c') ||
      (typeof window !== 'undefined'
        ? new URLSearchParams(window.location.search).get('c')
        : null)
    setCode(fromQuery)
  }, [])

  async function approve() {
    if (!code) {
      setError('Missing login code.')
      return
    }
    setBusy(true)
    setError(null)
    const result = await approveQrLoginChallenge(code)
    setBusy(false)
    if (result.error) {
      setError(result.error)
      toast.show(result.error, { tone: 'danger' })
      return
    }
    setDone(true)
    toast.show('Web login approved', {
      tone: 'success',
      message: 'You can return to your browser.',
    })
  }

  if (isLoading) {
    return (
      <PageCenter>
        <Spinner size="large" />
      </PageCenter>
    )
  }

  if (!isAuthenticated) {
    return (
      <PageCenter>
        <YStack gap="$4" padding="$5" maxWidth={400} alignItems="center">
          <Text fontSize={18} fontWeight="800" color={ui.text} textAlign="center">
            Sign in to approve
          </Text>
          <Text fontSize={14} color={ui.textMuted} textAlign="center">
            Open this link on a phone where you&apos;re already signed in, or sign in here first.
          </Text>
          <Button
            tone="primary"
            size="$4"
            borderRadius={999}
            onPress={() => signIn(Platform.OS === 'web' ? `/auth/qr?c=${code ?? ''}` : undefined)}
          >
            Sign in
          </Button>
        </YStack>
      </PageCenter>
    )
  }

  return (
    <PageCenter>
      <YStack gap="$4" padding="$5" maxWidth={400} alignItems="center">
        <Text fontSize={20} fontWeight="800" color={ui.text} textAlign="center">
          Approve web login
        </Text>
        <Text fontSize={14} color={ui.textMuted} textAlign="center" lineHeight={20}>
          Confirm so your browser can sign in to the same SHEconomy account. This code expires in
          about two minutes.
        </Text>
        {error ? (
          <Text fontSize={13} color="$red10" textAlign="center">
            {error}
          </Text>
        ) : null}
        {done ? (
          <Text fontSize={14} color={ui.text} fontWeight="600" textAlign="center">
            Approved. You can close this screen.
          </Text>
        ) : (
          <Button
            tone="primary"
            size="$4"
            borderRadius={999}
            disabled={busy || !code}
            onPress={() => void approve()}
          >
            {busy ? 'Approving…' : 'Approve login'}
          </Button>
        )}
        <Button tone="ghost" size="$3" onPress={() => router.push(buildSignInUrl('/') as never)}>
          Cancel
        </Button>
      </YStack>
    </PageCenter>
  )
}
