import { useEffect, useState } from 'react'
import { Linking, Platform } from 'react-native'

import {
  Button,
  Field,
  Icons,
  Input,
  Spinner,
  Text,
  XStack,
  YStack,
  useAppToast,
} from '~/components/ui'
import { radius } from '~/config/tokens'
import { PAYMENT_UI_COPY } from '~/lib/payment/payment-ui.copy'
import { toFriendlyPaymentError } from '~/lib/payment/payment.errors'
import { paymentService } from '~/lib/payment'
import {
  connectShepayFromPayu,
  disconnectPaymentAccount,
  savePaymentCredentials,
  selectVendorPaymentLoading,
  updatePaymentSettings,
} from '~/lib/payment/payment.store'
import { PAYMENT_PROVIDERS } from '~/lib/payment/payment.constants'
import { useAppDispatch, useAppSelector } from '~/lib/store/hooks'
import type { AppUiTokens } from '~/lib/theme/app-ui'

type ShepayEasyConnectProps = {
  ui: AppUiTokens
  shopId: string
  connected: boolean
  /** When true, form sits on the payments page (no cancel / drawer chrome). */
  embedded?: boolean
  onClose?: () => void
  onConnected?: () => void
}

async function openExternalUrl(url: string | null | undefined) {
  if (!url) return
  if (Platform.OS === 'web') {
    window.open(url, '_blank', 'noopener,noreferrer')
    return
  }
  const canOpen = await Linking.canOpenURL(url)
  if (canOpen) await Linking.openURL(url)
}

export function ShepayEasyConnect({
  ui,
  shopId,
  connected,
  embedded = false,
  onClose,
  onConnected,
}: ShepayEasyConnectProps) {
  const dispatch = useAppDispatch()
  const toast = useAppToast()
  const loading = useAppSelector(selectVendorPaymentLoading)

  // Default to key+MID form — simplest path for most vendors.
  const [showNewSetup, setShowNewSetup] = useState(false)
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [shopCode, setShopCode] = useState('')
  const [webhookUrl, setWebhookUrl] = useState('')
  const [onboardingUrl, setOnboardingUrl] = useState('https://onboarding.payu.in')
  const [hubConfigured, setHubConfigured] = useState(true)
  const [previewLoading, setPreviewLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [merchantKey, setMerchantKey] = useState('')
  const [childMid, setChildMid] = useState('')
  const [revealKey, setRevealKey] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    let active = true
    setPreviewLoading(true)
    void (async () => {
      const preview = await paymentService.previewShepaySync(shopId)
      if (!active) return
      if (preview.success && preview.data) {
        setEmail(preview.data.email ?? '')
        setPhone(preview.data.phone ?? '')
        setShopCode(preview.data.shopCode ?? '')
        setWebhookUrl(preview.data.webhookUrl ?? '')
        setOnboardingUrl(preview.data.onboardingUrl || 'https://onboarding.payu.in')
        setHubConfigured(Boolean(preview.data.hubConfigured))
      }

      const creds = await paymentService.getPaymentCredentials(shopId, PAYMENT_PROVIDERS.PAYU)
      if (!active) return
      if (creds.success && creds.data?.credentials) {
        const c = creds.data.credentials
        if (c.merchant_key?.trim()) setMerchantKey(c.merchant_key.trim())
        if (c.child_merchant_key?.trim()) setMerchantKey(c.child_merchant_key.trim())
        if (c.child_mid?.trim()) setChildMid(c.child_mid.trim())
      }

      setPreviewLoading(false)
    })()
    return () => {
      active = false
    }
  }, [shopId])

  async function finishSuccess() {
    toast.show(PAYMENT_UI_COPY.connectSuccess, { tone: 'success' })
    onConnected?.()
    if (!embedded) onClose?.()
  }

  async function handleConnectExisting() {
    const errors: Record<string, string> = {}
    if (!merchantKey.trim()) errors.merchant_key = 'Please enter your merchant key'
    if (!childMid.trim()) errors.child_mid = 'Please enter your MID'
    if (Object.keys(errors).length) {
      setFieldErrors(errors)
      return
    }
    setFieldErrors({})
    setSyncing(true)
    try {
      await dispatch(
        savePaymentCredentials({
          shopId,
          provider: PAYMENT_PROVIDERS.PAYU,
          credentials: {
            merchant_key: merchantKey.trim(),
            child_merchant_key: merchantKey.trim(),
            child_mid: childMid.trim(),
            salt_key: 'platform',
            onboarded_via: 'sheconomy',
          },
          mode: 'live',
        }),
      ).unwrap()

      if (webhookUrl.trim()) {
        await dispatch(
          updatePaymentSettings({
            shopId,
            settings: { webhook_url: webhookUrl.trim() },
          }),
        ).unwrap()
      }

      await finishSuccess()
    } catch (error) {
      toast.show(PAYMENT_UI_COPY.connectFailed, {
        tone: 'danger',
        message: toFriendlyPaymentError(error),
      })
    } finally {
      setSyncing(false)
    }
  }

  async function handleFetchAndActivate() {
    setSyncing(true)
    try {
      await dispatch(
        connectShepayFromPayu({
          shopId,
          email: email.trim() || undefined,
          phone: phone.trim() || undefined,
        }),
      ).unwrap()
      await finishSuccess()
    } catch (error) {
      toast.show(PAYMENT_UI_COPY.shepayFetchFailed, {
        tone: 'danger',
        message: toFriendlyPaymentError(error),
      })
    } finally {
      setSyncing(false)
    }
  }

  async function handleDisconnect() {
    try {
      await dispatch(
        disconnectPaymentAccount({ shopId, provider: PAYMENT_PROVIDERS.PAYU }),
      ).unwrap()
      toast.show(PAYMENT_UI_COPY.disconnectSuccess, { tone: 'success' })
      setMerchantKey('')
      setChildMid('')
      onConnected?.()
      if (!embedded) onClose?.()
    } catch (error) {
      toast.show(PAYMENT_UI_COPY.disconnectFailed, {
        tone: 'danger',
        message: toFriendlyPaymentError(error),
      })
    }
  }

  if (previewLoading) {
    return (
      <XStack alignItems="center" gap="$2" paddingVertical="$4">
        <Spinner size="small" />
        <Text fontSize={13} color={ui.textMuted}>
          Loading…
        </Text>
      </XStack>
    )
  }

  const busy = syncing || loading.connecting

  if (showNewSetup) {
    return (
      <YStack gap="$4" width="100%">
        <Button
          tone="ghost"
          size="$2"
          alignSelf="flex-start"
          icon={<Icons.ArrowLeft size={16} color={ui.brand} />}
          onPress={() => setShowNewSetup(false)}
        >
          Back
        </Button>

        <YStack gap="$1">
          <Text fontSize={17} fontWeight="800" color={ui.text}>
            {PAYMENT_UI_COPY.shepayNewTitle}
          </Text>
          <Text fontSize={13} color={ui.textSecondary} lineHeight={20}>
            {PAYMENT_UI_COPY.shepayEasyBody}
          </Text>
        </YStack>

        <Field label="Your email">
          <Input
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            placeholder="you@example.com"
          />
        </Field>
        <Field label="Your mobile">
          <Input
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            placeholder="10-digit mobile"
          />
        </Field>

        {shopCode ? (
          <YStack gap="$1" padding="$3" borderRadius={radius.card} backgroundColor={ui.surfaceMuted}>
            <Text fontSize={11} fontWeight="700" color={ui.textMuted} textTransform="uppercase">
              {PAYMENT_UI_COPY.shepayShopCodeLabel}
            </Text>
            <Text fontSize={16} fontWeight="800" color={ui.text}>
              {shopCode}
            </Text>
          </YStack>
        ) : null}

        <Button
          size="$4"
          borderRadius={radius.chip}
          tone="outline"
          borderColor={ui.brand}
          color={ui.brand}
          fontWeight="700"
          icon={<Icons.ExternalLink size={16} color={ui.brand} />}
          onPress={() => void openExternalUrl(onboardingUrl)}
        >
          {PAYMENT_UI_COPY.shepayOpenPayu}
        </Button>

        <Button
          size="$4"
          borderRadius={radius.chip}
          backgroundColor={ui.brand}
          color="#fff"
          fontWeight="700"
          disabled={busy || !hubConfigured}
          icon={busy ? <Spinner size="small" color="white" /> : <Icons.Sparkles size={16} color="#fff" />}
          onPress={() => void handleFetchAndActivate()}
        >
          {busy ? PAYMENT_UI_COPY.shepayFetching : PAYMENT_UI_COPY.shepayFetchActivate}
        </Button>

        {!hubConfigured ? (
          <Text fontSize={12} color="#B45309" lineHeight={18}>
            {PAYMENT_UI_COPY.shepayHubMissing}
          </Text>
        ) : null}
      </YStack>
    )
  }

  return (
    <YStack gap="$4" width="100%">
      <YStack gap="$1">
        <Text fontSize={17} fontWeight="800" color={ui.text} letterSpacing={-0.2}>
          {connected ? 'Update your PayU details' : 'Enter your PayU details'}
        </Text>
        <Text fontSize={13} color={ui.textSecondary} lineHeight={20}>
          Just two fields from your PayU account. Everything else is handled for you.
        </Text>
      </YStack>

      <Field label="Merchant key" error={fieldErrors.merchant_key}>
        <XStack alignItems="center" position="relative">
          <Input
            flex={1}
            value={merchantKey}
            onChangeText={(value) => {
              setMerchantKey(value)
              if (fieldErrors.merchant_key) {
                setFieldErrors((current) => {
                  const next = { ...current }
                  delete next.merchant_key
                  return next
                })
              }
            }}
            placeholder="Paste merchant key"
            autoCapitalize="none"
            autoCorrect={false}
            secureTextEntry={!revealKey}
          />
          <YStack
            position="absolute"
            right={10}
            cursor="pointer"
            onPress={() => setRevealKey((v) => !v)}
          >
            {revealKey ? (
              <Icons.EyeOff size={18} color={ui.textMuted} />
            ) : (
              <Icons.Eye size={18} color={ui.textMuted} />
            )}
          </YStack>
        </XStack>
      </Field>

      <Field label="MID" error={fieldErrors.child_mid}>
        <Input
          value={childMid}
          onChangeText={(value) => {
            setChildMid(value)
            if (fieldErrors.child_mid) {
              setFieldErrors((current) => {
                const next = { ...current }
                delete next.child_mid
                return next
              })
            }
          }}
          placeholder="Paste MID number"
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="number-pad"
        />
      </Field>

      <Button
        size="$4"
        borderRadius={radius.chip}
        backgroundColor={ui.brand}
        color="#fff"
        fontWeight="700"
        disabled={busy}
        icon={
          busy ? <Spinner size="small" color="white" /> : <Icons.CheckCircle2 size={16} color="#fff" />
        }
        onPress={() => void handleConnectExisting()}
      >
        {busy ? 'Saving…' : connected ? 'Save changes' : 'Save & start receiving money'}
      </Button>

      <Button tone="ghost" size="$3" onPress={() => setShowNewSetup(true)}>
        Don’t have PayU yet? Set up here
      </Button>

      {connected ? (
        <Button
          tone="outline"
          size="$3"
          borderRadius={radius.chip}
          borderColor="#DC2626"
          color="#DC2626"
          disabled={busy}
          onPress={() => void handleDisconnect()}
        >
          {PAYMENT_UI_COPY.disconnect}
        </Button>
      ) : null}

      {!embedded && onClose ? (
        <Button tone="outline" size="$3" borderRadius={radius.chip} onPress={onClose}>
          {PAYMENT_UI_COPY.cancel}
        </Button>
      ) : null}
    </YStack>
  )
}
