import type { Href } from 'one'

import { AppLink } from '~/components/navigation/AppLink'
import { Button, Text, YStack } from '~/components/ui'
import { radius } from '~/config/tokens'
import { vendorRoutes } from '~/lib/routes'
import type { AppUiTokens } from '~/lib/theme/app-ui'
import type { PayuKycStatus } from '~/lib/payment/payu-kyc'

const STATUS_HINT: Record<PayuKycStatus | 'missing', string> = {
  missing: 'Submit payout verification to publish listings and accept orders.',
  draft: 'Finish and submit payout verification to unlock selling.',
  submitted: 'Your KYC is under review. Selling unlocks after PayU verification.',
  changes_requested: 'Update the requested KYC details and resubmit to unlock selling.',
  payu_pending: 'PayU is verifying your payout account. Selling unlocks when it finishes.',
  payu_verified: '',
  rejected: 'Update your KYC documents and resubmit to unlock selling.',
}

type VendorKycRequiredBannerProps = {
  ui: AppUiTokens
  status: PayuKycStatus | null
}

/** Sticky vendor-hub callout when the shop cannot sell yet. */
export function VendorKycRequiredBanner({ ui, status }: VendorKycRequiredBannerProps) {
  if (status === 'payu_verified') return null
  const key = status ?? 'missing'
  const hint = STATUS_HINT[key]
  const cta =
    status === 'submitted' || status === 'payu_pending' ? 'View verification' : 'Complete verification'

  return (
    <YStack
      marginHorizontal="$3"
      marginTop="$3"
      marginBottom="$1"
      padding="$3.5"
      gap="$2"
      borderRadius={radius.card}
      borderWidth={1}
      borderColor="rgba(185, 28, 28, 0.28)"
      backgroundColor="rgba(185, 28, 28, 0.06)"
    >
      <Text fontSize={14} fontWeight="800" color={ui.text}>
        Verification required to sell
      </Text>
      <Text fontSize={13} color={ui.textSecondary} lineHeight={18}>
        {hint} Listings stay off the storefront and checkout is blocked until KYC is verified.
      </Text>
      <AppLink href={vendorRoutes.settingsSection('verification') as Href} asChild>
        <Button size="$3" tone="primary" alignSelf="flex-start">
          {cta}
        </Button>
      </AppLink>
    </YStack>
  )
}
