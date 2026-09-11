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
  payuGroupIdForMode,
  resolvePayuPaymentMode,
  type PayuPaymentModeId,
} from '~/commerce/lib/payu-payment-modes'
import { launchPayuUpiIntent, payuUpiShouldShowQr } from '~/commerce/lib/payu-upi-launch'
import {
  createShepayPayuSession,
  fetchPayuBinInfo,
  verifyShepayPayuPayment,
} from '~/commerce/lib/shepay'
import { platformPayuService } from '~/lib/platform-payu'
import { Button, Input, Spinner, Text, XStack, YStack } from '~/components/ui'
import { useAppLayout } from '~/hooks/useAppLayout'
import type { AppUiTokens } from '~/lib/theme/app-ui'

export type CheckoutPayuSession = {
  actionUrl: string
  fields: Record<string, string>
  txnid: string
  paymentStepId?: string
  orderPaymentId?: string
  provider?: 'shepay' | 'platform_payu'
}

type PayuPickerSectionId = 'upi' | 'cards' | 'netbanking' | 'wallets' | 'more'

function pickerSectionForMode(mode: PayuPaymentModeId): PayuPickerSectionId {
  if (['emi', 'bnpl', 'paypal', 'pluxee', 'neft'].includes(mode)) return 'more'
  const group = payuGroupIdForMode(mode)
  if (group === 'cards' || group === 'upi' || group === 'netbanking' || group === 'wallets') {
    return group
  }
  return 'upi'
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
  /** Visible in the list but not selectable (net banking, wallets, EMI, etc.). */
  disabledMethodSections?: PayuPickerSectionId[]
  session: CheckoutPayuSession
  onPaid: () => void
  onFailed: (message: string) => void
  onCancel: () => void
  /** Nest inside checkout accordion — no outer card chrome. */
  embedded?: boolean
  /** Collapse online methods (e.g. COD selected) — no selection, accordion closed. */
  collapsed?: boolean
  /** Fired when bank OTP / UPI QR auth UI opens or closes. */
  onAuthActiveChange?: (active: boolean) => void
  /** Fired when the shopper interacts with online methods (switch back from COD). */
  onSelectOnline?: () => void
  /**
   * When set, called before the first charge if the session has no order payment yet.
   * Used to place the order + initiate PayU when the shopper taps Pay.
   */
  onEnsureSession?: () => Promise<CheckoutPayuSession | null>
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
  disabledMethodSections = [],
  session,
  onPaid,
  onFailed,
  onCancel,
  embedded = false,
  collapsed = false,
  onAuthActiveChange,
  onSelectOnline,
  onEnsureSession,
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
  const acsIframeRef = useRef<HTMLIFrameElement | null>(null)
  const sessionRef = useRef(session)
  const { isDesktop } = useAppLayout()

  useEffect(() => {
    sessionRef.current = session
  }, [session])

  const modeMeta = useMemo(() => resolvePayuPaymentMode(mode), [mode])
  const isPlatform =
    session.provider === 'platform_payu' ||
    Boolean(session.orderPaymentId) ||
    Boolean(onEnsureSession)
  const isCards = mode === 'cards'
  const isUpiAppMode =
    mode === 'upi_gpay' ||
    mode === 'upi_phonepe' ||
    mode === 'upi_paytm' ||
    mode === 'upi_intent' ||
    mode === 'upi_qr'
  const showQrForMode = payuUpiShouldShowQr(mode)
  const showPicker = !hideMethodPicker && !autoStart
  const authActive = Boolean(acsHtml || intentUri)
  const controlsLocked = authActive || busy || awaitingVerify
  const paidOnceRef = useRef(false)
  const disabledSections = useMemo(
    () => new Set(disabledMethodSections),
    [disabledMethodSections],
  )

  const cardFieldsNode = useMemo(() => {
    if (lockedCard) return null
    return (
      <YStack gap="$2.5">
        <YStack gap="$1">
          <Text fontSize={12} fontWeight="600" color={ui.text}>
            Card number
          </Text>
          <Input
            value={formatCardNumberDisplay(cardNumber)}
            onChangeText={(value) => setCardNumber(digitsOnly(value).slice(0, 19))}
            placeholder="1234 5678 9012 3456"
            keyboardType="number-pad"
            autoComplete="cc-number"
          />
          {binBusy ? (
            <Text fontSize={11} color={secondaryColor}>
              Checking card…
            </Text>
          ) : null}
          {binLabel ? (
            <Text fontSize={11} color={secondaryColor}>
              {binLabel}
            </Text>
          ) : null}
        </YStack>
        <YStack gap="$1">
          <Text fontSize={12} fontWeight="600" color={ui.text}>
            Name on card
          </Text>
          <Input
            value={cardName}
            onChangeText={setCardName}
            placeholder="As printed on card"
            autoCapitalize="words"
            autoComplete="cc-name"
          />
        </YStack>
        <XStack gap="$2" flexWrap="wrap">
          <YStack flex={1} minWidth={72} gap="$1">
            <Text fontSize={12} fontWeight="600" color={ui.text}>
              MM
            </Text>
            <Input
              value={cardExpMon}
              onChangeText={(value) => setCardExpMon(normalizeExpiryMonth(value))}
              placeholder="MM"
              keyboardType="number-pad"
              maxLength={2}
            />
          </YStack>
          <YStack flex={1} minWidth={88} gap="$1">
            <Text fontSize={12} fontWeight="600" color={ui.text}>
              YYYY
            </Text>
            <Input
              value={cardExpYr}
              onChangeText={(value) => setCardExpYr(digitsOnly(value).slice(0, 4))}
              placeholder="YYYY"
              keyboardType="number-pad"
              maxLength={4}
            />
          </YStack>
          <YStack flex={1} minWidth={72} gap="$1">
            <Text fontSize={12} fontWeight="600" color={ui.text}>
              CVV
            </Text>
            <Input
              value={cardCvv}
              onChangeText={(value) => setCardCvv(digitsOnly(value).slice(0, 4))}
              placeholder="CVV"
              keyboardType="number-pad"
              secureTextEntry
              maxLength={4}
            />
          </YStack>
        </XStack>
      </YStack>
    )
  }, [
    binBusy,
    binLabel,
    cardCvv,
    cardExpMon,
    cardExpYr,
    cardName,
    cardNumber,
    lockedCard,
    secondaryColor,
    ui.text,
  ])

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
    onAuthActiveChange?.(authActive)
  }, [authActive, onAuthActiveChange])

  function finishPaid() {
    if (paidOnceRef.current) return
    paidOnceRef.current = true
    setAcsHtml(null)
    setIntentUri(null)
    setBusy(false)
    setError(null)
    onPaid()
  }

  /** 3DS / bank OTP completes inside iframe — only then finish the order. */
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return

    function onEmbedReturn(event: MessageEvent) {
      const data = event.data as {
        type?: string
        status?: string
        txn?: string
        orderIds?: string[]
      } | null
      if (!data || data.type !== 'payu-embed-return') return
      if (event.origin !== window.location.origin) return

      if (data.status === 'success') {
        finishPaid()
        return
      }

      setAcsHtml(null)
      setBusy(false)
      onFailed('Payment was not completed — OTP / bank authentication failed or was cancelled.')
    }

    window.addEventListener('message', onEmbedReturn)
    return () => window.removeEventListener('message', onEmbedReturn)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- stable finishPaid via ref
  }, [onFailed])

  function isPayuEmbedReturnHref(href: string): boolean {
    return (
      href.includes('/payu-embed-return.html') ||
      href.includes('/payu-embed-return') ||
      href.includes('/orders/payu-return')
    )
  }

  function handleAcsIframeLoad() {
    if (Platform.OS !== 'web') return
    const frame = acsIframeRef.current
    if (!frame) return
    try {
      const href = frame.contentWindow?.location?.href ?? ''
      if (!href || href === 'about:blank') return
      if (!isPayuEmbedReturnHref(href)) return
      const parsed = new URL(href)
      const status = parsed.searchParams.get('status')?.toLowerCase()
      if (status === 'success') {
        finishPaid()
      } else if (status) {
        setAcsHtml(null)
        onFailed('Payment was not completed — OTP / bank authentication failed or was cancelled.')
      }
    } catch {
      // cross-origin while on bank page — expected
    }
  }

  /** Poll iframe when bank redirects back to our embed return (same-origin). */
  useEffect(() => {
    if (Platform.OS !== 'web' || !acsHtml) return
    const timer = window.setInterval(() => handleAcsIframeLoad(), 700)
    return () => window.clearInterval(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- poll while ACS iframe is open
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
      const lookup = isPlatform
        ? platformPayuService.fetchBinInfo(bin)
        : fetchPayuBinInfo(bin)
      void lookup.then((result) => {
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
  }, [cardNumber, isCards, hideMethodPicker, isPlatform, lockedCard?.bankcode])

  async function runVerifyAndFinish(nextTxnid: string) {
    setAwaitingVerify(true)
    const verified = isPlatform
      ? await platformPayuService.verifyPayment({
          txnid: nextTxnid,
          orderPaymentId: sessionRef.current.orderPaymentId,
        })
      : await verifyShepayPayuPayment({
          txnid: nextTxnid,
          paymentStepId: sessionRef.current.paymentStepId,
        })
    setAwaitingVerify(false)
    if (verified.data?.success) {
      finishPaid()
      return true
    }
    return false
  }

  async function handlePay() {
    onSelectOnline?.()
    if (disabledSections.has(pickerSectionForMode(mode))) {
      setError('This payment method is not available yet. Choose UPI or card.')
      return
    }
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
      let activeSession = sessionRef.current
      if (isPlatform && !activeSession.orderPaymentId && onEnsureSession) {
        const ensured = await onEnsureSession()
        if (!ensured?.orderPaymentId) {
          setError('Could not start checkout. Check your address and try again.')
          setBusy(false)
          return
        }
        activeSession = ensured
        sessionRef.current = ensured
        setTxnid(ensured.txnid || '')
      }

      const extras: Record<string, string> = {}
      if (vpa.trim()) extras.vpa = vpa.trim()

      const cardPayload =
        isCards && !lockedCard
          ? {
              number: cardNumber,
              name: cardName,
              exp_mon: cardExpMon,
              exp_yr: cardExpYr,
              cvv: cardCvv,
              bankcode: binBankcode,
            }
          : lockedCard
            ? {
                number: lockedCard.number,
                name: lockedCard.name,
                exp_mon: lockedCard.expMon,
                exp_yr: lockedCard.expYr,
                cvv: lockedCard.cvv,
                bankcode: lockedCard.bankcode ?? binBankcode,
              }
            : null

      const chargeResult = isPlatform
        ? await platformPayuService.chargePayment(activeSession.orderPaymentId ?? '', {
            payuMode: chargeMode,
            extraFields: Object.keys(extras).length ? extras : null,
            card: isCards ? cardPayload : null,
            threeDs2RequestData: isCards ? buildPayuThreeDS2RequestData() : null,
            appOrigin:
              Platform.OS === 'web' && typeof window !== 'undefined'
                ? window.location.origin
                : null,
            deviceInfo:
              Platform.OS === 'web' && typeof navigator !== 'undefined'
                ? navigator.userAgent
                : null,
          })
        : await createShepayPayuSession(activeSession.paymentStepId ?? '', {
            payuMode: chargeMode,
            extraFields: Object.keys(extras).length ? extras : null,
            checkoutStyle: 's2s',
            seamless: true,
            inline: true,
            card: isCards ? cardPayload : null,
            threeDs2RequestData: isCards ? buildPayuThreeDS2RequestData() : null,
          })

      if (chargeResult.error || !chargeResult.data) {
        setError(
          chargeResult.error ??
            (isPlatform ? 'Could not start PayU payment' : 'Could not start SHEPay payment'),
        )
        setBusy(false)
        return
      }

      const data = chargeResult.data
      setTxnid(data.txnid)

      if (data.flow === 'form_post' && data.action_url && data.fields) {
        savePayuBridgeSession(data.action_url, data.fields)
        if (Platform.OS === 'web') {
          submitPayuFormPost(data.action_url, data.fields)
          // The POST navigates this page away, so `busy` normally never matters.
          // If navigation is blocked we would otherwise strand the buyer on a
          // spinner with Cancel disabled, so give the state a way out.
          window.setTimeout(() => {
            setBusy(false)
            setError('Could not open the PayU payment page. Tap Retry payment to try again.')
          }, 8000)
          return
        }
        setAcsTitle('Continue to your bank / wallet')
        setAcsHtml(buildPayuAutoSubmitHtml(data.action_url, data.fields))
        setBusy(false)
        return
      }

      if (data.outcome === 'success') {
        const ok = await runVerifyAndFinish(data.txnid)
        setBusy(false)
        if (!ok) {
          setError('Payment not confirmed yet. Complete OTP if prompted, then try again.')
        }
        return
      }

      if (data.outcome === 'upi_intent' || data.intent_uri) {
        const uri = normalizePayuIntentUri(data.intent_uri)
        if (!uri) {
          setError(
            isPlatform
              ? 'PayU did not return a UPI payment link. Tap Retry or try Scan QR.'
              : 'SHEPay did not return a UPI payment link. Tap Retry or try Scan QR.',
          )
          setBusy(false)
          return
        }
        setIntentUri(uri)

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

      setError(data.message ?? (isPlatform ? 'Unexpected PayU response' : 'Unexpected SHEPay response'))
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

  const acsFrameHeight = isDesktop && authActive ? 520 : 480

  const acsWebFrame =
    acsHtml && Platform.OS === 'web' ? (
      <YStack
        width="100%"
        height={acsFrameHeight}
        borderRadius={12}
        overflow="hidden"
        borderWidth={1}
        borderColor={borderColor}
        backgroundColor="#fff"
      >
        <YStack padding="$2" gap="$1" backgroundColor={ui.surfaceMuted}>
          <Text fontSize={13} fontWeight="700" color={ui.text}>
            {acsTitle}
          </Text>
          <Text fontSize={11} color={secondaryColor} lineHeight={16}>
            Complete OTP or 3-D Secure in this window. We&apos;ll take you to order confirmation
            automatically.
          </Text>
        </YStack>
        {/* @ts-expect-error web-only iframe for ACS / bank OTP */}
        <iframe
          ref={acsIframeRef}
          name="payu_acs_frame"
          title="Bank authentication"
          srcDoc={acsHtml}
          onLoad={handleAcsIframeLoad}
          style={{ width: '100%', flex: 1, minHeight: 360, border: 'none' }}
          sandbox="allow-forms allow-scripts allow-same-origin allow-top-navigation allow-top-navigation-by-user-activation allow-popups allow-popups-to-escape-sandbox"
        />
        <XStack padding="$2" justifyContent="center">
          <Button tone="outline" borderRadius={999} size="$2" onPress={() => void handleIvePaid()}>
            Payment stuck? Tap here
          </Button>
        </XStack>
      </YStack>
    ) : null

  const acsNativeFrame =
    acsHtml && Platform.OS !== 'web' ? (
      <YStack
        width="100%"
        height={acsFrameHeight}
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
          <Button tone="outline" borderRadius={999} onPress={() => void handleIvePaid()}>
            Payment stuck? Tap here
          </Button>
        </XStack>
      </YStack>
    ) : null

  const paymentForm = (
    <YStack
      gap="$3"
      width="100%"
      flexShrink={0}
      minWidth={0}
      opacity={authActive ? 0.45 : 1}
      pointerEvents={authActive ? 'none' : 'auto'}
    >
      {(intentUri || authActive) && !collapsed ? (
        <YStack gap="$1">
          <Text fontSize={18} fontWeight="800" color={ui.text}>
            {intentUri && showQrForMode
              ? 'Scan QR to pay'
              : intentUri
                ? `Pay with ${modeMeta.label}`
                : 'Complete bank authentication →'}
          </Text>
          <Text fontSize={13} color={secondaryColor} lineHeight={18}>
            {authActive
              ? isDesktop
                ? 'Your card details are locked while you finish OTP on the right.'
                : 'Your card details are locked while you finish OTP below.'
              : amountLabel
                ? `Open ${modeMeta.shortLabel} or any UPI app and scan to pay ${amountLabel}.`
                : `Open ${modeMeta.shortLabel} or any UPI app and scan this QR to complete payment.`}
          </Text>
        </YStack>
      ) : null}

      {showPicker ? (
        <CheckoutPayuMethodPicker
          brandColor={brandColor}
          borderColor={borderColor}
          chipColor={chipColor}
          secondaryColor={secondaryColor}
          textColor={ui.text}
          mode={mode}
          collapsed={collapsed}
          onModeChange={(next) => {
            if (controlsLocked) return
            onSelectOnline?.()
            setMode(next === 'all' ? 'upi_gpay' : next)
            setIntentUri(null)
            setAcsHtml(null)
            setError(null)
            setNativeLaunchHint(null)
          }}
          vpa={vpa}
          onVpaChange={setVpa}
          cardFields={cardFieldsNode}
          disabledSectionIds={disabledMethodSections}
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

      {showPicker && !collapsed ? (
        <XStack gap="$2" flexWrap="wrap">
          <Button
            flex={1}
            minWidth={140}
            backgroundColor={brandColor}
            color={ui.onBrand}
            borderRadius={999}
            disabled={controlsLocked}
            onPress={() => void handlePay()}
          >
            {busy ? 'Starting…' : `Pay with ${modeMeta.shortLabel}`}
          </Button>
          <Button tone="outline" borderRadius={999} onPress={onCancel} disabled={busy || authActive}>
            Cancel
          </Button>
        </XStack>
      ) : !error && !collapsed ? (
        <Button
          tone="outline"
          borderRadius={999}
          onPress={onCancel}
          disabled={busy || authActive}
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

      {!isDesktop ? acsWebFrame : null}
      {!isDesktop ? acsNativeFrame : null}

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

  return (
    <YStack
      gap="$3"
      padding={embedded ? 0 : '$4'}
      borderRadius={embedded ? 0 : 14}
      borderWidth={embedded ? 0 : 1}
      borderColor={embedded ? 'transparent' : borderColor}
      backgroundColor={embedded ? 'transparent' : ui.surface}
      width="100%"
      flexShrink={0}
      alignSelf="stretch"
    >
      {isDesktop && authActive && Platform.OS === 'web' ? (
        <XStack gap="$4" width="100%" alignItems="flex-start" flexWrap="wrap">
          <YStack flex={1} minWidth={260} width="100%">
            {paymentForm}
          </YStack>
          <YStack flex={1} minWidth={280} maxWidth={520} width="100%">
            {acsWebFrame}
          </YStack>
        </XStack>
      ) : (
        paymentForm
      )}
    </YStack>
  )
}
