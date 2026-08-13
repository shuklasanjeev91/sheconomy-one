import type { PlatformPayuInitiateRequest } from '~/lib/platform-payu'
import { usePlatformPayuStore } from '~/lib/platform-payu'
import { Button, Spinner, Text, XStack } from '~/components/ui'

type PlatformPayuPayButtonProps = {
  payload: PlatformPayuInitiateRequest
  label?: string
  disabled?: boolean
}

/**
 * Standalone PayU pay button — wire into checkout or order retry flows
 * without modifying CheckoutScreen directly.
 */
export function PlatformPayuPayButton({
  payload,
  label = 'Pay with PayU',
  disabled = false,
}: PlatformPayuPayButtonProps) {
  const { status, error, initiatePayment } = usePlatformPayuStore()
  const busy = status === 'initiating' || status === 'redirecting'

  return (
    <>
      <Button
        tone="primary"
        disabled={disabled || busy}
        onPress={() => void initiatePayment(payload)}
      >
        {busy ? (
          <XStack gap="$2" alignItems="center">
            <Spinner size="small" />
            <Text>{status === 'redirecting' ? 'Redirecting…' : 'Starting payment…'}</Text>
          </XStack>
        ) : (
          label
        )}
      </Button>
      {error ? (
        <Text fontSize={13} color="$red10" marginTop="$2">
          {error}
        </Text>
      ) : null}
    </>
  )
}
