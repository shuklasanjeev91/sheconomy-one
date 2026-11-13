import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Href } from 'one'

import { PaymentErrorBoundary } from '~/commerce/components/PaymentErrorBoundary'
import { VendorPayuKycForm } from '~/commerce/components/vendor/payment/VendorPayuKycForm'
import { AppLink } from '~/components/navigation/AppLink'
import { Button, Icons, Spinner, Text, XStack, YStack, useAppToast } from '~/components/ui'
import { getShadowStyle, radius } from '~/config/tokens'
import type { PayuKycStatus, ShopPayuKycRow } from '~/lib/payment/payu-kyc'
import { toFriendlyPaymentError } from '~/lib/payment/payment.errors'
import { vendorRoutes } from '~/lib/routes'
import { supabase } from '~/lib/supabase'
import type { AppUiTokens } from '~/lib/theme/app-ui'

type VendorVerificationPanelProps = {
  ui: AppUiTokens
  shopId: string
  isDesktop: boolean
}

const STEPS: { id: PayuKycStatus | 'not_started'; label: string }[] = [
  { id: 'not_started', label: 'Not started' },
  { id: 'draft', label: 'Draft' },
  { id: 'submitted', label: 'Under review' },
  { id: 'payu_pending', label: 'PayU setup' },
  { id: 'payu_verified', label: 'Verified' },
]

const STATUS_COPY: Record<
  PayuKycStatus | 'not_started',
  { title: string; body: string; tone: 'neutral' | 'warning' | 'success' | 'danger' }
> = {
  not_started: {
    title: 'Verify your shop to get paid',
    body: 'Upload business and bank documents. SHEconomy reviews them, then PayU creates your payout account automatically.',
    tone: 'neutral',
  },
  draft: {
    title: 'Finish your application',
    body: 'Your draft is saved. Submit when all required documents are uploaded.',
    tone: 'warning',
  },
  submitted: {
    title: 'Waiting for admin review',
    body: 'We received your documents. After approval, PayU submerchant setup starts automatically.',
    tone: 'warning',
  },
  changes_requested: {
    title: 'Changes requested',
    body: 'Update the documents or details below and submit again.',
    tone: 'danger',
  },
  rejected: {
    title: 'Application not approved',
    body: 'Fix the issues noted by the reviewer and submit a new application.',
    tone: 'danger',
  },
  payu_pending: {
    title: 'PayU verification in progress',
    body: 'Your PayU child account is being created and verified. This can take a little while.',
    tone: 'warning',
  },
  payu_verified: {
    title: 'Shop verified',
    body: 'Buyers can pay online and settlements can release to your bank. Manage settlements under Payouts.',
    tone: 'success',
  },
}

function stepIndexFor(status: PayuKycStatus | 'not_started'): number {
  if (status === 'changes_requested' || status === 'rejected') return 2
  if (status === 'not_started') return 0
  if (status === 'draft') return 1
  if (status === 'submitted') return 2
  if (status === 'payu_pending') return 3
  return 4
}

export function VendorVerificationPanel({ ui, shopId, isDesktop }: VendorVerificationPanelProps) {
  const toast = useAppToast()
  const [kycRow, setKycRow] = useState<ShopPayuKycRow | null>(null)
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(true)

  const loadKyc = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('shop_payu_kyc')
      .select('*')
      .eq('shop_id', shopId)
      .maybeSingle()
    setLoading(false)
    if (error) {
      toast.show('Could not load verification', {
        tone: 'danger',
        message: toFriendlyPaymentError(error),
      })
      return
    }
    const row = (data as ShopPayuKycRow | null) ?? null
    setKycRow(row)
    setShowForm(!row || row.status !== 'payu_verified')
  }, [shopId, toast])

  useEffect(() => {
    void loadKyc()
  }, [loadKyc])

  const statusKey = (kycRow?.status ?? 'not_started') as PayuKycStatus | 'not_started'
  const copy = STATUS_COPY[statusKey]
  const activeStep = stepIndexFor(statusKey)

  const borderColor = useMemo(() => {
    if (copy.tone === 'success') return '#86EFAC'
    if (copy.tone === 'warning') return '#FCD34D'
    if (copy.tone === 'danger') return '#FECACA'
    return ui.borderSubtle
  }, [copy.tone, ui.borderSubtle])

  const backgroundColor = useMemo(() => {
    if (copy.tone === 'success') return '#F0FDF4'
    if (copy.tone === 'warning') return '#FFFBEB'
    if (copy.tone === 'danger') return '#FEF2F2'
    return ui.surface
  }, [copy.tone, ui.surface])

  if (loading && !kycRow) {
    return (
      <XStack alignItems="center" gap="$2" paddingVertical="$6">
        <Spinner size="small" />
        <Text fontSize={13} color={ui.textMuted}>
          Loading verification…
        </Text>
      </XStack>
    )
  }

  return (
    <PaymentErrorBoundary
      scope="VendorVerification"
      title="Verification unavailable"
      onReset={() => void loadKyc()}
    >
      <YStack gap="$4" width="100%" maxWidth={720} alignSelf="flex-start">
        <YStack
          gap="$3"
          padding={isDesktop ? '$5' : '$4'}
          borderRadius={radius.card}
          borderWidth={1}
          borderColor={borderColor}
          backgroundColor={backgroundColor}
          style={getShadowStyle('sm')}
        >
          <XStack alignItems="flex-start" gap="$3">
            {copy.tone === 'success' ? (
              <Icons.BadgeCheck size={28} color="#16A34A" />
            ) : (
              <Icons.ShieldCheck size={28} color={ui.brand} />
            )}
            <YStack flex={1} gap="$1" minWidth={0}>
              <Text fontSize={18} fontWeight="800" color={ui.text} letterSpacing={-0.3}>
                {copy.title}
              </Text>
              <Text fontSize={13} color={ui.textSecondary} lineHeight={19}>
                {copy.body}
              </Text>
              {kycRow?.admin_note ? (
                <Text fontSize={12} color={ui.danger} fontWeight="600" marginTop="$1">
                  Reviewer note: {kycRow.admin_note}
                </Text>
              ) : null}
              {kycRow?.payu_error ? (
                <Text fontSize={12} color={ui.danger} fontWeight="600" marginTop="$1">
                  Setup note: {kycRow.payu_error}
                </Text>
              ) : null}
            </YStack>
          </XStack>

          <XStack gap="$2" flexWrap="wrap" marginTop="$1">
            {STEPS.map((step, index) => {
              const done = index <= activeStep
              const current = index === activeStep
              return (
                <XStack
                  key={step.id}
                  alignItems="center"
                  gap="$1.5"
                  paddingHorizontal="$2.5"
                  paddingVertical="$1.5"
                  borderRadius={999}
                  backgroundColor={current ? ui.roseSurface : done ? 'rgba(22,163,74,0.08)' : ui.surfaceMuted}
                  borderWidth={1}
                  borderColor={current ? ui.brand : done ? '#86EFAC' : ui.borderSubtle}
                >
                  {done && !current ? (
                    <Icons.Check size={12} color="#16A34A" />
                  ) : (
                    <Text fontSize={11} fontWeight="800" color={current ? ui.brand : ui.textMuted}>
                      {index + 1}
                    </Text>
                  )}
                  <Text
                    fontSize={11}
                    fontWeight={current ? '800' : '600'}
                    color={current ? ui.brand : done ? '#15803D' : ui.textMuted}
                  >
                    {step.label}
                  </Text>
                </XStack>
              )
            })}
          </XStack>

          {statusKey === 'payu_verified' ? (
            <AppLink href={vendorRoutes.settingsSection('payments') as Href} asChild>
              <Button size="$3" tone="primary" borderRadius={999} alignSelf="flex-start">
                Open payouts
              </Button>
            </AppLink>
          ) : null}
        </YStack>

        {statusKey === 'payu_verified' && !showForm ? (
          <Button
            size="$4"
            tone="outline"
            borderRadius={radius.chip}
            borderColor={ui.brand}
            color={ui.brand}
            fontWeight="700"
            alignSelf="flex-start"
            onPress={() => setShowForm(true)}
          >
            Update verification details
          </Button>
        ) : null}

        {showForm ? (
          <YStack
            gap="$3"
            padding={isDesktop ? '$5' : '$4'}
            borderRadius={radius.card}
            borderWidth={1}
            borderColor={ui.borderSubtle}
            backgroundColor={ui.surface}
            style={getShadowStyle('sm')}
          >
            <YStack gap="$1">
              <Text fontSize={16} fontWeight="800" color={ui.text}>
                PayU submerchant KYC
              </Text>
              <Text fontSize={13} color={ui.textSecondary} lineHeight={18}>
                Choose Individual, Sole Prop, HUF, Partnership, LLP, Pvt Ltd, Public Limited /
                Corporation, OPC, Trust, Society, NGO, or AOP — the form adapts names, IDs, and
                documents. Entity docs are for SHEconomy admin; PayU gets PAN, bank, Schedule C,
                and optional GST.
              </Text>
            </YStack>
            <VendorPayuKycForm
              ui={ui}
              shopId={shopId}
              embedded
              onSubmitted={() => {
                setShowForm(statusKey === 'payu_verified')
                void loadKyc()
              }}
            />
          </YStack>
        ) : null}
      </YStack>
    </PaymentErrorBoundary>
  )
}
