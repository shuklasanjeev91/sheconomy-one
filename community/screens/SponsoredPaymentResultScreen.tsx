import { useEffect, useState } from 'react'
import { useRouter } from 'one'

import { CommunityPageHeader } from '~/community/components/CommunityPageHeader'
import { CommunityShell } from '~/community/components/CommunityShell'
import {
  fetchSponsoredPaymentByTxn,
  type SponsoredCampaignPayment,
} from '~/community/lib/sponsored-ads'
import { Button, Icons, Spinner, Text, YStack } from '~/components/ui'
import { formatCurrency } from '~/lib/format'
import { communityRoutes } from '~/lib/routes'
import { useAppUi } from '~/lib/theme/useAppUi'

export function SponsoredPaymentResultScreen({
  transactionId,
  failed = false,
}: {
  transactionId: string
  failed?: boolean
}) {
  const ui = useAppUi()
  const router = useRouter()
  const [payment, setPayment] = useState<SponsoredCampaignPayment | null>(null)
  const [loading, setLoading] = useState(!failed)

  useEffect(() => {
    if (failed || !transactionId) {
      setLoading(false)
      return
    }
    let active = true
    let attempts = 0

    async function poll() {
      const result = await fetchSponsoredPaymentByTxn(transactionId)
      if (!active) return
      if (result.data) setPayment(result.data)
      attempts += 1
      if (result.data?.status === 'completed' || attempts >= 8) {
        setLoading(false)
        return
      }
      setTimeout(poll, 2000)
    }

    void poll()
    return () => {
      active = false
    }
  }, [failed, transactionId])

  const success = payment?.status === 'completed'
  return (
    <CommunityShell>
      <CommunityPageHeader
        title={failed ? 'Payment not completed' : 'Campaign payment'}
        subtitle="Your sponsored-post payment status."
      />
      <YStack
        gap="$4"
        padding="$6"
        alignItems="center"
        borderRadius="$4"
        borderWidth={1}
        borderColor={ui.border}
        backgroundColor={ui.surface}
      >
        {loading ? (
          <>
            <Spinner size="large" />
            <Text color={ui.textSecondary}>Confirming payment with PayU…</Text>
          </>
        ) : (
          <>
            {success ? (
              <Icons.CheckCircle size={48} color={ui.success} />
            ) : (
              <Icons.XCircle size={48} color={ui.danger} />
            )}
            <Text fontSize={21} fontWeight="800" color={ui.text} textAlign="center">
              {success ? 'Payment confirmed' : 'Payment was not completed'}
            </Text>
            <Text color={ui.textSecondary} textAlign="center" lineHeight={22}>
              {success
                ? 'Your campaign is now in review. It will start after approval and within its scheduled dates.'
                : payment?.failure_reason || 'You can retry payment from Ads Manager on the website.'}
            </Text>
            {payment ? (
              <Text color={ui.text} fontWeight="700">
                {formatCurrency(payment.amount, payment.currency)}
              </Text>
            ) : null}
            <Button tone="primary" onPress={() => router.replace(communityRoutes.ads)}>
              Open Ads Manager
            </Button>
          </>
        )}
      </YStack>
    </CommunityShell>
  )
}
