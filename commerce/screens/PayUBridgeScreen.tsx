import { useEffect, useMemo } from 'react'
import { Platform } from 'react-native'
import { useLocalSearchParams } from 'one'

import { Spinner, Text, YStack } from '~/components/ui'
import { FullWidthLayout } from '~/components/layout'
import { useAppUi } from '~/lib/theme/useAppUi'

/**
 * Auto-POST bridge to PayU `_payment` (merchant-hosted form flow).
 * Query: ?action=<payu_url>&payload=<json fields>
 */
export function PayUBridgeScreen() {
  const ui = useAppUi()
  const params = useLocalSearchParams<{ action?: string; payload?: string }>()

  const { action, fields, error } = useMemo(() => {
    try {
      const actionUrl = typeof params.action === 'string' ? params.action : ''
      const raw = typeof params.payload === 'string' ? params.payload : ''
      if (!actionUrl || !raw) return { action: '', fields: null as Record<string, string> | null, error: 'Missing payment payload' }
      const parsed = JSON.parse(raw) as Record<string, string>
      return { action: actionUrl, fields: parsed, error: null as string | null }
    } catch {
      return { action: '', fields: null, error: 'Invalid payment payload' }
    }
  }, [params.action, params.payload])

  useEffect(() => {
    if (Platform.OS !== 'web' || !action || !fields || typeof document === 'undefined') return
    const form = document.createElement('form')
    form.method = 'POST'
    form.action = action
    form.style.display = 'none'
    for (const [name, value] of Object.entries(fields)) {
      const input = document.createElement('input')
      input.type = 'hidden'
      input.name = name
      input.value = value
      form.appendChild(input)
    }
    document.body.appendChild(form)
    form.submit()
  }, [action, fields])

  return (
    <FullWidthLayout>
      <YStack flex={1} alignItems="center" justifyContent="center" gap="$3" padding="$6">
        {error ? (
          <Text color={ui.danger}>{error}</Text>
        ) : (
          <>
            <Spinner size="large" />
            <Text color={ui.textSecondary}>Redirecting to secure payment…</Text>
          </>
        )}
      </YStack>
    </FullWidthLayout>
  )
}
