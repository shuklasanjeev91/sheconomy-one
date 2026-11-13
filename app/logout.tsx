import { useEffect, useRef } from 'react'

import { PageCenter } from '~/components/layout'
import { Spinner, Text, YStack } from '~/components/ui'
import { useAuth } from '~/hooks/useAuth'
import { navigateApp } from '~/lib/platform/navigate'
import { routes } from '~/lib/routes'
import { useAppUi } from '~/lib/theme/useAppUi'

/** Explicit logout URL — clears the session then lands on home. */
export default function LogoutScreen() {
  const ui = useAppUi()
  const { signOut, isLoading, isAuthenticated } = useAuth()
  const started = useRef(false)

  useEffect(() => {
    if (isLoading || started.current) return
    started.current = true

    if (!isAuthenticated) {
      navigateApp(routes.home)
      return
    }

    void signOut()
  }, [isAuthenticated, isLoading, signOut])

  return (
    <PageCenter>
      <YStack gap="$3" alignItems="center" padding="$4">
        <Spinner size="large" color={ui.brand} />
        <Text fontSize={15} fontWeight="600" color={ui.textMuted}>
          Signing you out…
        </Text>
      </YStack>
    </PageCenter>
  )
}
