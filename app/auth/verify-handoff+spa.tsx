import { useEffect, useState } from 'react'
import { Linking } from 'react-native'
import { useLocalSearchParams } from 'one'

import { GenderVerificationScreen } from '~/components/gender-verification/GenderVerificationScreen'
import { PageCenter } from '~/components/layout'
import { Spinner, Text, YStack } from '~/components/ui'
import { getSearchParam } from '~/lib/platform/url'
import { useAppUi } from '~/lib/theme/useAppUi'

function tokenFromUrl(url: string | null): string | null {
  if (!url) return null
  try {
    return new URL(url).searchParams.get('t')
  } catch {
    return null
  }
}

/**
 * Opened when a phone scans the human-verification QR code.
 * No sign-in: the token belongs to the account that displayed the code.
 */
export default function VerifyHandoffRoute() {
  const ui = useAppUi()
  const params = useLocalSearchParams<{ t?: string | string[] }>()
  const routeToken = Array.isArray(params.t) ? params.t[0] : params.t
  const [token, setToken] = useState<string | null | undefined>(routeToken ?? undefined)

  useEffect(() => {
    const fromRouteOrWindow = routeToken || getSearchParam('t')
    if (fromRouteOrWindow) {
      setToken(fromRouteOrWindow)
      return
    }

    let active = true
    void Linking.getInitialURL().then((url) => {
      if (!active) return
      setToken(tokenFromUrl(url))
    })
    const subscription = Linking.addEventListener('url', ({ url }) => {
      const next = tokenFromUrl(url)
      if (next) setToken(next)
    })
    return () => {
      active = false
      subscription.remove()
    }
  }, [routeToken])

  if (token === undefined) {
    return (
      <PageCenter>
        <Spinner size="large" />
      </PageCenter>
    )
  }

  if (!token) {
    return (
      <PageCenter>
        <YStack padding="$5" maxWidth={420} gap="$2">
          <Text fontSize={18} fontWeight="800" color={ui.text} textAlign="center">
            Verification link is incomplete
          </Text>
          <Text fontSize={14} color={ui.textMuted} textAlign="center" lineHeight={20}>
            Scan the QR code again from the device where you started human verification.
          </Text>
        </YStack>
      </PageCenter>
    )
  }

  return <GenderVerificationScreen handoffToken={token} autoStart />
}
