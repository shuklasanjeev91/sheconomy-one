import { Platform } from 'react-native'
import { useEffect, useMemo, useRef, useState, type ComponentType } from 'react'
import QRCode from 'react-native-qrcode-svg'

import { CheckoutPayuMethodPicker } from '~/commerce/components/CheckoutPayuMethodPicker'
import {
  buildPayuAutoSubmitHtml,
  savePayuBridgeSession,
  submitPayuFormPost,
} from '~/commerce/lib/payu-bridge'
import {
  buildPayuThreeDS2RequestData,
  digitsOnly,
  formatCardNumberDisplay,
  normalizeExpiryMonth,
  normalizeExpiryYear,
  resolvePayuCardPgBankcode,
  validatePayuCardInput,
} from '~/commerce/lib/payu-card'
import {
  normalizePayuIntentUri,
  resolvePayuPaymentMode,
  type PayuPaymentModeId,
} from '~/commerce/lib/payu-payment-modes'
import { launchPayuUpiIntent, payuUpiShouldShowQr } from '~/commerce/lib/payu-upi-launch'
import {
  createShepayPayuSession,
  fetchPayuBinInfo,
  verifyShepayPayuPayment,
} from '~/commerce/lib/shepay'
import { Button, Input, Spinner, Text, XStack, YStack } from '~/components/ui'
import type { AppUiTokens } from '~/lib/theme/app-ui'

export type CheckoutPayuSession = {
  actionUrl: string
  fields: Record<string, string>
  txnid: string
  paymentStepId: string
}

type CheckoutPayuPanelProps = {
  ui: AppUiTokens
  brandColor: string
  borderColor: string
  chipColor: string
  secondaryColor: string
  initialMode: PayuPaymentModeId
  initialVpa?: string
  /** Formatted amount e.g. "₹898.00" shown on QR screen */
  amountLabel?: string | null
  /** Skip method list and charge immediately (method chosen on checkout accordion). */
  autoStart?: boolean
  hideMethodPicker?: boolean
  card?: {
    number: string
    name: string
    expMon: string
    expYr: string
    cvv: string
    bankcode?: string
  } | null
  session: CheckoutPayuSession
  onPaid: () => void
  onFailed: (message: string) => void
  onCancel: () => void
}

export function CheckoutPayuPanel({
  ui,
  brandColor,
  borderColor,
  chipColor,
  secondaryColor,
  initialMode,
  initialVpa = '',
  amountLabel = null,
  autoStart = false,
  hideMethodPicker = false,
  card: lockedCard = null,
  session,
  onPaid,
  onFailed,
  onCancel,
}: CheckoutPayuPanelProps) {
  const [mode, setMode] = useState<PayuPaymentModeId>(
    initialMode === 'all' ? 'upi_gpay' : initialMode,
  )
  const [vpa, setVpa] = useState(initialVpa)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [intentUri, setIntentUri] = useState<string | null>(null)
  const [acsHtml, setAcsHtml] = useState<string | null>(null)
  const [acsTitle, setAcsTitle] = useState('Complete bank authentication')
  const [txnid, setTxnid] = useState(session.txnid || '')
  const [awaitingVerify, setAwaitingVerify] = useState(false)
  const [WebView, setWebView] = useState<ComponentType<Record<string, unknown>> | null>(null)

  const [cardNumber, setCardNumber] = useState(lockedCard?.number ?? '')
  const [cardName, setCardName] = useState(lockedCard?.name ?? '')
  const [cardExpMon, setCardExpMon] = useState(lockedCard?.expMon ?? '')
  const [cardExpYr, setCardExpYr] = useState(lockedCard?.expYr ?? '')
  const [cardCvv, setCardCvv] = useState(lockedCard?.cvv ?? '')
  const [binBankcode, setBinBankcode] = useState(lockedCard?.bankcode ?? 'CC')
  const [binLabel, setBinLabel] = useState<string | null>(null)
  const [binBusy, setBinBusy] = useState(false)
  const [nativeLaunchHint, setNativeLaunchHint] = useState<string | null>(null)
  const autoStartedRef = useRef(false)

  const modeMeta = useMemo(() => resolvePayuPaymentMode(mode), [mode])
  const isCards = mode === 'cards'
  const isUpiAppMode =
    mode === 'upi_gpay' ||
    mode === 'upi_phonepe' ||
    mode === 'upi_paytm' ||
    mode === 'upi_intent' ||
    mode === 'upi_qr'
  const showQrForMode = payuUpiShouldShowQr(mode)
  const showPicker = !hideMethodPicker && !autoStart

  /** Web cannot open GPay/PhonePe — charge generic INTENT so PayU returns a scannable QR. */
  const chargeMode: PayuPaymentModeId =
    Platform.OS === 'web' &&
    (mode === 'upi_gpay' || mode === 'upi_phonepe' || mode === 'upi_paytm')
      ? 'upi_intent'
      : mode

  useEffect(() => {
    if (Platform.OS === 'web' || !acsHtml) return
    let cancelled = false
    void import('react-native-webview')
      .then((module) => {
        if (!cancelled) setWebView(() => module.WebView as never)
      })
      .catch(() => {
        /* bridge screen is fallback */
      })
    return () => {
      cancelled = true
    }
  }, [acsHtml])

  useEffect(() => {
    if (!isCards || hideMethodPicker) return
    const bin = digitsOnly(cardNumber).slice(0, 6)
    if (bin.length < 6) {
      setBinLabel(null)
      setBinBankcode(lockedCard?.bankcode ?? 'CC')
      return
    }
    let cancelled = false
    const timer = setTimeout(() => {
      setBinBusy(true)
      void fetchPayuBinInfo(bin).then((result) => {
        if (cancelled) return
        setBinBusy(false)
        if (result.error || !result.data) {
          setBinLabel(null)
          setBinBankcode('CC')
          return
        }
        setBinBankcode(result.data.bankcode || 'CC')
        const parts = [
          result.data.card_type,
          result.data.issuing_bank,
          result.data.category,
          result.data.is_domestic ? 'domestic' : 'international',
        ].filter(Boolean)
        setBinLabel(parts.join(' · '))
      })
    }, 400)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [cardNumber, isCards, hideMethodPicker, lockedCard?.bankcode])

  async function runVerifyAndFinish(nextTxnid: string) {
    setAwaitingVerify(true)
    const verified = await verifyShepayPayuPayment({
      txnid: nextTxnid,
      paymentStepId: session.paymentStepId,
    })
    setAwaitingVerify(false)
    if (verified.data?.success) {
      onPaid()
      return true
    }
    return false
  }

  async function handlePay() {
    if (modeMeta.needsVpa && !vpa.trim()) {
      setError('Enter your UPI ID (e.g. name@oksbi)')
      return
    }
    if ((mode === 'netbanking' || mode === 'wallets') && !modeMeta.bankcode) {
      setError('Select a bank or wallet')
      return
    }

    if (isCards) {
      const cardError = validatePayuCardInput({
        number: cardNumber,
        name: cardName,
        expMon: cardExpMon,
        expYr: cardExpYr,
        cvv: cardCvv,
      })
      if (cardError) {
        setError(cardError)
        return
      }
    }

    setBusy(true)
    setError(null)
    setIntentUri(null)
    setAcsHtml(null)
    setNativeLaunchHint(null)
    try {
      const extras: Record<string, string> = {}
      if (vpa.trim()) extras.vpa = vpa.trim()

      const result = await createShepayPayuSession(session.paymentStepId, {
        payuMode: chargeMode,
        extraFields: Object.keys(extras).length ? extras : null,
        /** PayU Hosted Checkout — buyer picks UPI / cards / NB on PayU. */
        checkoutStyle: 'hosted',
        seamless: false,
        inline: false,
        card: null,
        threeDs2RequestData: null,
      })

      if (result.error || !result.data) {
        setError(result.error ?? 'Could not start SHEPay payment')
        setBusy(false)
        return
      }

      const data = result.data
      setTxnid(data.txnid)

      if (data.flow === 'form_post' && data.action_url && data.fields) {
        savePayuBridgeSession(data.action_url, data.fields)
        if (Platform.OS === 'web') {
          submitPayuFormPost(data.action_url, data.fields)
          return
        }
        // Native: auto-submit HTML in embedded WebView (same as ACS).
        setAcsTitle('Continue to your bank / wallet')
        setAcsHtml(buildPayuAutoSubmitHtml(data.action_url, data.fields))
        setBusy(false)
        return
      }

      if (data.outcome === 'success') {
        const ok = await runVerifyAndFinish(data.txnid)
        setBusy(false)
        if (!ok) onPaid()
        return
      }

      if (data.outcome === 'upi_intent' || data.intent_uri) {
        const uri = normalizePayuIntentUri(data.intent_uri)
        if (!uri) {
          setError('SHEPay did not return a UPI payment link. Tap Retry or try Scan QR.')
          setBusy(false)
          return
        }
        setIntentUri(uri)

        // Web: always show QR — never navigate to upi:// (browsers block it).
        // Native: open GPay / PhonePe / Paytm, keep QR as fallback.
        if (!showQrForMode && Platform.OS !== 'web') {
          const opened = await launchPayuUpiIntent(uri, mode)
          setNativeLaunchHint(
            opened
              ? `Opened ${modeMeta.shortLabel}. Complete payment in the app, then tap I’ve paid.`
              : `Couldn’t open ${modeMeta.shortLabel}. Scan the QR below instead.`,
          )
        }

        setBusy(false)
        return
      }

      if (data.outcome === 'acs' && data.acs_html) {
        setAcsTitle(isCards ? '3-D Secure authentication' : 'Complete bank / wallet payment')
        setAcsHtml(data.acs_html)
        setBusy(false)
        return
      }

      if (data.outcome === 'redirect' && data.redirect_url) {
        if (Platform.OS === 'web') {
          window.location.href = data.redirect_url
          return
        }
        setAcsTitle('Continue to your bank / wallet')
        setAcsHtml(
          `<!DOCTYPE html><html><head><meta charset="utf-8"/><meta http-equiv="refresh" content="0;url=${data.redirect_url.replace(/"/g, '')}"/></head><body><p>Redirecting…</p><a href="${data.redirect_url.replace(/"/g, '')}">Continue</a></body></html>`,
        )
        setBusy(false)
        return
      }

      if (data.outcome === 'pending') {
        setError(data.message ?? 'Complete payment in your bank / UPI app, then tap I’ve paid')
        setBusy(false)
        return
      }

      setError(data.message ?? 'Unexpected SHEPay response')
      setBusy(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Payment failed to start')
      setBusy(false)
    }
  }

  useEffect(() => {
    if (!autoStart) return
    if (autoStartedRef.current) return
    autoStartedRef.current = true
    void handlePay()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- charge once when order is ready
  }, [autoStart, session.paymentStepId])

  async function handleIvePaid() {
    if (!txnid) {
      onFailed('Missing transaction id')
      return
    }
    setBusy(true)
    const ok = await runVerifyAndFinish(txnid)
    setBusy(false)
    if (!ok) {
      setError('Payment not confirmed yet. Wait a moment or complete UPI/3DS, then try again.')
    }
  }

  return (
    <YStack
      gap="$3"
      padding="$4"
      borderRadius={14}
      borderWidth={1}
      borderColor={borderColor}
      backgroundColor={ui.surface}
      width="100%"
    >
      <YStack gap="$1">
        <Text fontSize={18} fontWeight="800" color={ui.text}>
          {intentUri && showQrForMode
            ? 'Scan QR to pay'
            : intentUri
              ? `Pay with ${modeMeta.label}`
              : showPicker
                ? 'Choose payment method'
                : `Pay with ${modeMeta.label}`}
        </Text>
        <Text fontSize={13} color={secondaryColor} lineHeight={18}>
          {intentUri && showQrForMode
            ? amountLabel
              ? `Open ${modeMeta.shortLabel} or any UPI app and scan to pay ${amountLabel}.`
              : `Open ${modeMeta.shortLabel} or any UPI app and scan this QR to complete payment.`
            : showPicker
              ? 'Select UPI, card, net banking or wallet — then place your order.'
              : 'Complete payment securely via SHEPay.'}
        </Text>
      </YStack>

      {showPicker ? (
        <CheckoutPayuMethodPicker
          brandColor={brandColor}
          borderColor={borderColor}
          chipColor={chipColor}
          secondaryColor={secondaryColor}
          textColor={ui.text}
          mode={mode}
          onModeChange={(next) => {
            setMode(next === 'all' ? 'upi_gpay' : next)
            setIntentUri(null)
            setAcsHtml(null)
            setError(null)
            setNativeLaunchHint(null)
          }}
          vpa={vpa}
          onVpaChange={setVpa}
        />
      ) : null}

      {error ? (
        <YStack gap="$2">
          <Text fontSize={13} color={ui.danger}>
            {error}
          </Text>
          <XStack gap="$2" flexWrap="wrap">
            <Button
              backgroundColor={brandColor}
              color={ui.onBrand}
              borderRadius={999}
              disabled={busy}
              onPress={() => {
                autoStartedRef.current = false
                void handlePay()
              }}
            >
              Retry payment
            </Button>
            <Button tone="outline" borderRadius={999} onPress={onCancel} disabled={busy}>
              Cancel payment
            </Button>
          </XStack>
        </YStack>
      ) : null}

      {nativeLaunchHint && !error ? (
        <Text fontSize={13} color={secondaryColor} lineHeight={18}>
          {nativeLaunchHint}
        </Text>
      ) : null}

      {showPicker ? (
        <XStack gap="$2" flexWrap="wrap">
          <Button
            flex={1}
            minWidth={140}
            backgroundColor={brandColor}
            color={ui.onBrand}
            borderRadius={999}
            disabled={busy || awaitingVerify}
            onPress={() => void handlePay()}
          >
            {busy ? 'Starting…' : `Pay with ${modeMeta.shortLabel}`}
          </Button>
          <Button tone="outline" borderRadius={999} onPress={onCancel} disabled={busy}>
            Cancel
          </Button>
        </XStack>
      ) : !error ? (
        <Button
          tone="outline"
          borderRadius={999}
          onPress={onCancel}
          disabled={busy}
          alignSelf="flex-start"
        >
          Cancel payment
        </Button>
      ) : null}

      {busy || awaitingVerify ? (
        <YStack alignItems="center" paddingVertical="$4">
          <Spinner size="large" />
          <Text fontSize={12} color={secondaryColor} marginTop="$2">
            {awaitingVerify
              ? 'Verifying with SHEPay…'
              : showQrForMode || isUpiAppMode
                ? 'Generating payment…'
                : 'Starting SHEPay payment…'}
          </Text>
        </YStack>
      ) : null}

      {acsHtml && Platform.OS === 'web' ? (
        <YStack
          width="100%"
          height={480}
          borderRadius={12}
          overflow="hidden"
          borderWidth={1}
          borderColor={borderColor}
          backgroundColor="#fff"
        >
          <Text fontSize={12} color={secondaryColor} padding="$2">
            {acsTitle}
          </Text>
          {/* @ts-expect-error web-only iframe for ACS / bank OTP */}
          <iframe
            title="SHEPay bank authentication"
            srcDoc={acsHtml}
            style={{ width: '100%', height: '100%', border: 'none' }}
            sandbox="allow-forms allow-scripts allow-same-origin allow-top-navigation allow-top-navigation-by-user-activation allow-popups"
          />
          <XStack padding="$2" justifyContent="center">
            <Button borderRadius={999} onPress={() => void handleIvePaid()}>
              I’ve completed payment
            </Button>
          </XStack>
        </YStack>
      ) : null}

      {acsHtml && Platform.OS !== 'web' ? (
        <YStack
          width="100%"
          height={480}
          borderRadius={12}
          overflow="hidden"
          borderWidth={1}
          borderColor={borderColor}
          backgroundColor="#fff"
        >
          <Text fontSize={12} color={secondaryColor} padding="$2">
            {acsTitle}
          </Text>
          {WebView ? (
            <WebView
              originWhitelist={['*']}
              source={{ html: acsHtml, baseUrl: 'https://sheconomy.in' }}
              style={{ flex: 1, width: '100%', minHeight: 400 }}
              javaScriptEnabled
              domStorageEnabled
              sharedCookiesEnabled
              startInLoadingState
            />
          ) : (
            <YStack flex={1} alignItems="center" justifyContent="center" padding="$4">
              <Spinner size="large" />
            </YStack>
          )}
          <XStack padding="$2" justifyContent="center">
            <Button borderRadius={999} onPress={() => void handleIvePaid()}>
              I’ve completed payment
            </Button>
          </XStack>
        </YStack>
      ) : null}

      {intentUri ? (
        <YStack
          gap="$3"
          alignItems="center"
          padding="$4"
          borderRadius={16}
          borderWidth={1}
          borderColor={borderColor}
          backgroundColor={ui.surfaceMuted}
          width="100%"
        >
          {amountLabel ? (
            <YStack alignItems="center" gap="$1">
              <Text fontSize={12} color={secondaryColor} fontWeight="600">
                Amount to pay
              </Text>
              <Text fontSize={28} fontWeight="800" color={ui.text}>
                {amountLabel}
              </Text>
            </YStack>
          ) : null}

          <Text fontSize={14} fontWeight="700" color={ui.text} textAlign="center">
            {showQrForMode
              ? `Scan with ${modeMeta.shortLabel} or any UPI app`
              : `Open ${modeMeta.label} or scan QR`}
          </Text>

          <YStack
            padding="$4"
            backgroundColor="#ffffff"
            borderRadius={16}
            alignItems="center"
            justifyContent="center"
            borderWidth={1}
            borderColor={borderColor}
          >
            <QRCode
              value={intentUri}
              size={showQrForMode ? 260 : 200}
              backgroundColor="#ffffff"
              color="#111111"
            />
          </YStack>

          <Text fontSize={12} color={secondaryColor} textAlign="center" lineHeight={18}>
            Keep this screen open until payment succeeds. After paying in your UPI app, tap I’ve paid.
          </Text>

          {txnid ? (
            <Text fontSize={11} color={secondaryColor}>
              Txn {txnid}
            </Text>
          ) : null}

          <XStack gap="$2" flexWrap="wrap" justifyContent="center">
            {Platform.OS !== 'web' ? (
              <Button
                backgroundColor={brandColor}
                color={ui.onBrand}
                borderRadius={999}
                onPress={() => {
                  void launchPayuUpiIntent(intentUri, mode).then((opened) => {
                    setNativeLaunchHint(
                      opened
                        ? `Opened ${modeMeta.shortLabel}. Complete payment, then tap I’ve paid.`
                        : `Couldn’t open ${modeMeta.shortLabel}. Scan the QR instead.`,
                    )
                  })
                }}
              >
                Open {modeMeta.shortLabel}
              </Button>
            ) : null}
            <Button
              backgroundColor={brandColor}
              color={ui.onBrand}
              borderRadius={999}
              onPress={() => void handleIvePaid()}
            >
              I’ve paid {amountLabel ? amountLabel : ''}
            </Button>
          </XStack>
        </YStack>
      ) : null}
    </YStack>
  )
}
