import { useRouter } from 'one'
import { useLocalSearchParams } from 'one'
import { useEffect } from 'react'

import { Spinner, Text, YStack } from '~/components/ui'
import { FullWidthLayout } from '~/components/layout'
import { commerceRoutes } from '~/lib/routes'
import { useAppUi } from '~/lib/theme/useAppUi'

/** PayU surl/furl landing — send buyer to order success. */
export default function PayUReturnRoute() {
  const ui = useAppUi()
  const router = useRouter()
  const params = useLocalSearchParams<{ status?: string }>()

  useEffect(() => {
    const t = setTimeout(() => {
      router.replace(commerceRoutes.orders)
    }, 1200)
    return () => clearTimeout(t)
  }, [router])

  const ok = params.status === 'success'

  return (
    <FullWidthLayout>
      <YStack flex={1} alignItems="center" justifyContent="center" gap="$3" padding="$6">
        <Spinner size="large" />
        <Text color={ui.text} fontWeight="700">
          {ok ? 'Payment received' : 'Payment update received'}
        </Text>
        <Text color={ui.textSecondary} textAlign="center">
          Taking you to your orders…
        </Text>
      </YStack>
    </FullWidthLayout>
  )
}
