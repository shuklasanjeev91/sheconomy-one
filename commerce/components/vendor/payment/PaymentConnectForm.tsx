import { useCallback, useEffect, useMemo, useState } from 'react'
import { Linking, Platform } from 'react-native'

import {
  Button,
  Field,
  Icons,
  Input,
  ScrollView,
  Spinner,
  Text,
  TextArea,
  XStack,
  YStack,
  useAppToast,
} from '~/components/ui'
import { radius } from '~/config/tokens'
import { PAYMENT_UI_COPY, paymentConnectDescription } from '~/lib/payment/payment-ui.copy'
import { toFriendlyPaymentError } from '~/lib/payment/payment.errors'
import { paymentService } from '~/lib/payment'
import {
  buildEmptyCredentialValues,
  getConnectionTypeLabel,
  getDefaultProviderMode,
  getProviderFeesLabel,
  getProviderModeOptions,
  getProviderSettlementLabel,
  getRegionDisplayName,
  hasProviderCredentialForm,
  isOAuthProvider,
  isTestProviderMode,
} from '~/lib/payment/payment.utils'
import { PROVIDER_CREDENTIAL_FIELDS } from '~/lib/payment/payment.providers.config'
import {
  connectPaymentAccount,
  connectRazorpay,
  disconnectPaymentAccount,
  disconnectRazorpay,
  savePaymentCredentials,
  selectVendorPaymentLoading,
  updatePaymentSettings,
  validateRazorpayCredentials,
} from '~/lib/payment/payment.store'
import { PAYMENT_PROVIDERS } from '~/lib/payment/payment.constants'
import type { PaymentProviderConfig } from '~/lib/payment/payment.type'
import { validateProviderCredentialForm } from '~/lib/payment/payment.validation'
import { useAppDispatch, useAppSelector } from '~/lib/store/hooks'
import type { AppUiTokens } from '~/lib/theme/app-ui'

import { PaymentProviderIcon } from '~/commerce/components/vendor/payment/PaymentProviderIcon'
import { ShepayEasyConnect } from '~/commerce/components/vendor/payment/ShepayEasyConnect'

type PaymentConnectFormProps = {
  ui: AppUiTokens
  shopId: string
  provider: PaymentProviderConfig
  connected: boolean
  initialWebhookUrl?: string | null
  onClose: () => void
  onConnected?: () => void
}

function MetadataCell({ ui, label, value }: { ui: AppUiTokens; label: string; value: string }) {
  return (
    <YStack flex={1} minWidth={120} gap="$1">
      <Text fontSize={10} fontWeight="700" color={ui.textMuted} letterSpacing={0.6} textTransform="uppercase">
        {label}
      </Text>
      <Text fontSize={14} fontWeight="700" color={ui.text}>
        {value}
      </Text>
    </YStack>
  )
}

function isShepayProvider(provider: PaymentProviderConfig): boolean {
  return (
    provider.id === PAYMENT_PROVIDERS.PAYU ||
    String(provider.id).toLowerCase() === 'payu' ||
    provider.name === 'SHEPay'
  )
}

export function PaymentConnectForm({
  ui,
  shopId,
  provider,
  connected,
  initialWebhookUrl,
  onClose,
  onConnected,
}: PaymentConnectFormProps) {
  // SHEPay must never show the old credential/webhook form.
  if (isShepayProvider(provider)) {
    return (
      <YStack flex={1} minHeight={0}>
        <ScrollView
          flex={1}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 32, paddingTop: 4 }}
        >
          <ShepayEasyConnect
            ui={ui}
            shopId={shopId}
            connected={connected}
            onClose={onClose}
            onConnected={onConnected}
          />
        </ScrollView>
      </YStack>
    )
  }

  return (
    <PaymentConnectFormGeneric
      ui={ui}
      shopId={shopId}
      provider={provider}
      connected={connected}
      initialWebhookUrl={initialWebhookUrl}
      onClose={onClose}
      onConnected={onConnected}
    />
  )
}

/** Non-SHEPay providers only — keeps Razorpay / others unchanged. */
function PaymentConnectFormGeneric({
  ui,
  shopId,
  provider,
  connected,
  initialWebhookUrl,
  onClose,
  onConnected,
}: PaymentConnectFormProps) {
  const dispatch = useAppDispatch()
  const toast = useAppToast()
  const loading = useAppSelector(selectVendorPaymentLoading)

  const credentialConfig = PROVIDER_CREDENTIAL_FIELDS[provider.id]
  const modeOptions = getProviderModeOptions(provider.id)
  const modeKeys = Object.keys(modeOptions)
  const showCredentialForm = hasProviderCredentialForm(provider.id)
  const oauthFlow = isOAuthProvider(provider) && !showCredentialForm

  const [credentials, setCredentials] = useState<Record<string, string>>(() =>
    buildEmptyCredentialValues(provider.id),
  )
  const [mode, setMode] = useState(() => getDefaultProviderMode(provider.id))
  const [webhookUrl, setWebhookUrl] = useState(initialWebhookUrl ?? '')
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [revealedFields, setRevealedFields] = useState<Record<string, boolean>>({})
  const [testPassed, setTestPassed] = useState<boolean | null>(null)
  const [isValidating, setIsValidating] = useState(false)
  const [loadingExisting, setLoadingExisting] = useState(connected && showCredentialForm)

  useEffect(() => {
    if (!connected || !showCredentialForm) {
      setLoadingExisting(false)
      return
    }

    let active = true
    setLoadingExisting(true)
    void paymentService.getPaymentCredentials(shopId, provider.id).then((result) => {
      if (!active) return
      if (result.success && result.data?.credentials) {
        setCredentials((current) => ({ ...current, ...result.data!.credentials! }))
        if (result.data.mode) setMode(result.data.mode)
      }
      setLoadingExisting(false)
    })

    return () => {
      active = false
    }
  }, [connected, provider.id, shopId, showCredentialForm])

  const connectLabel = `${PAYMENT_UI_COPY.connectPrefix} ${provider.name}`

  const supportedMethods = useMemo(
    () => provider.features.filter((feature) => !feature.toLowerCase().includes('payment gateway')).slice(0, 4),
    [provider.features],
  )

  const patchCredential = useCallback((key: string, value: string) => {
    setCredentials((current) => ({ ...current, [key]: value }))
    setFieldErrors((current) => {
      if (!current[key]) return current
      const next = { ...current }
      delete next[key]
      return next
    })
    setTestPassed(null)
  }, [])

  async function openExternalUrl(url: string | null | undefined) {
    if (!url) return
    if (Platform.OS === 'web') {
      window.open(url, '_blank', 'noopener,noreferrer')
      return
    }
    const canOpen = await Linking.canOpenURL(url)
    if (canOpen) await Linking.openURL(url)
  }

  async function runValidationCheck() {
    const payload = { ...credentials, webhook_url: webhookUrl }
    const localResult = validateProviderCredentialForm(provider.id, payload)
    if (!localResult.isValid) {
      setFieldErrors(localResult.errors)
      setTestPassed(false)
      toast.show(PAYMENT_UI_COPY.testFailed, { tone: 'danger' })
      return
    }
    setFieldErrors({})

    if (provider.id === PAYMENT_PROVIDERS.RAZORPAY) {
      const keyId = credentials.key_id?.trim() ?? ''
      const keySecret = credentials.key_secret?.trim() ?? ''
      if (!keyId || !keySecret) {
        setTestPassed(false)
        toast.show(PAYMENT_UI_COPY.testFailed, {
          tone: 'danger',
          message: 'Key ID and Key Secret are required.',
        })
        return
      }

      setIsValidating(true)
      setTestPassed(null)
      try {
        const result = await dispatch(
          validateRazorpayCredentials({
            shopId,
            keyId,
            keySecret,
            mode: (mode === 'live' ? 'live' : 'test') as 'test' | 'live',
          }),
        ).unwrap()
        setTestPassed(true)
        toast.show(
          `${PAYMENT_UI_COPY.testSuccess} · ${result.maskedKeyId ?? keyId.slice(0, 12) + '…'}`,
          { tone: 'success' },
        )
      } catch (error) {
        setTestPassed(false)
        toast.show(PAYMENT_UI_COPY.testFailed, {
          tone: 'danger',
          message: toFriendlyPaymentError(error),
        })
      } finally {
        setIsValidating(false)
      }
      return
    }

    setTestPassed(true)
    toast.show(PAYMENT_UI_COPY.testSuccess, { tone: 'success' })
  }

  async function handleConnect() {
    const payload = { ...credentials, webhook_url: webhookUrl }
    const validation = validateProviderCredentialForm(provider.id, payload)
    if (!validation.isValid) {
      setFieldErrors(validation.errors)
      return
    }

    const { webhook_url: webhookValue, ...credentialValues } = payload

    try {
      if (provider.id === PAYMENT_PROVIDERS.RAZORPAY) {
        await dispatch(
          connectRazorpay({
            shopId,
            keyId: credentialValues.key_id?.trim() ?? '',
            keySecret: credentialValues.key_secret?.trim() ?? '',
            webhookSecret: credentialValues.webhook_secret?.trim() || undefined,
            webhookUrl: webhookValue?.trim() || undefined,
            mode: 'live' as 'test' | 'live',
          }),
        ).unwrap()
      } else {
        await dispatch(
          savePaymentCredentials({
            shopId,
            provider: provider.id,
            credentials: credentialValues,
            mode: 'live',
          }),
        ).unwrap()

        if (webhookValue?.trim()) {
          await dispatch(
            updatePaymentSettings({
              shopId,
              settings: { webhook_url: webhookValue.trim() },
            }),
          ).unwrap()
        }
      }

      toast.show(PAYMENT_UI_COPY.connectSuccess, { tone: 'success' })
      onConnected?.()
      onClose()
    } catch (error) {
      toast.show(PAYMENT_UI_COPY.connectFailed, {
        tone: 'danger',
        message: toFriendlyPaymentError(error),
      })
    }
  }

  async function handleDisconnect() {
    try {
      if (provider.id === PAYMENT_PROVIDERS.RAZORPAY) {
        await dispatch(disconnectRazorpay({ shopId })).unwrap()
      } else {
        await dispatch(disconnectPaymentAccount({ shopId, provider: provider.id })).unwrap()
      }
      toast.show(PAYMENT_UI_COPY.disconnectSuccess, { tone: 'success' })
      onConnected?.()
      onClose()
    } catch (error) {
      toast.show(PAYMENT_UI_COPY.disconnectFailed, {
        tone: 'danger',
        message: toFriendlyPaymentError(error),
      })
    }
  }

  if (loadingExisting) {
    return (
      <YStack flex={1} alignItems="center" justifyContent="center" padding="$6" gap="$3">
        <Spinner size="large" />
        <Text fontSize={13} color={ui.textMuted}>
          Loading provider settings…
        </Text>
      </YStack>
    )
  }

  return (
    <YStack flex={1} minHeight={0}>
      <ScrollView
        flex={1}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 32 }}
      >
        <YStack gap="$4">
          <XStack alignItems="center" gap="$3">
            <PaymentProviderIcon provider={provider} size={48} />
            <YStack gap="$1">
              <Text fontSize={13} color={ui.textSecondary} lineHeight={19}>
                {paymentConnectDescription(provider.name)}
              </Text>
            </YStack>
          </XStack>

          <YStack
            gap="$2.5"
            padding="$4"
            borderRadius={radius.card}
            backgroundColor={ui.roseSurface}
            borderWidth={1}
            borderColor={`${ui.brand}33`}
          >
            <XStack alignItems="center" gap="$2">
              <Icons.Shield size={18} color={ui.brand} />
              <Text
                fontSize={11}
                fontWeight="800"
                color={ui.brand}
                letterSpacing={0.5}
                textTransform="uppercase"
              >
                {PAYMENT_UI_COPY.secureStorageTitle}
              </Text>
            </XStack>
            <Text fontSize={13} color={ui.textSecondary} lineHeight={20}>
              {PAYMENT_UI_COPY.secureStorageBody}
            </Text>
          </YStack>

          <XStack gap="$3" flexWrap="wrap">
            <MetadataCell
              ui={ui}
              label={PAYMENT_UI_COPY.region}
              value={getRegionDisplayName(provider.region)}
            />
            <MetadataCell
              ui={ui}
              label={PAYMENT_UI_COPY.connection}
              value={getConnectionTypeLabel(provider.connectionType)}
            />
            <MetadataCell
              ui={ui}
              label={PAYMENT_UI_COPY.settlement}
              value={getProviderSettlementLabel(provider)}
            />
            <MetadataCell ui={ui} label={PAYMENT_UI_COPY.fees} value={getProviderFeesLabel(provider)} />
          </XStack>

          {oauthFlow ? (
            <YStack
              gap="$3"
              padding="$4"
              borderRadius={radius.card}
              borderWidth={1}
              borderColor={ui.borderSubtle}
            >
              <Text fontSize={14} color={ui.textSecondary} lineHeight={21}>
                Connect your {provider.name} account through the provider dashboard. After
                authorization, return here to confirm the connection.
              </Text>
              {provider.dashboardUrl ? (
                <Button
                  tone="outline"
                  size="$3"
                  borderRadius={999}
                  icon={<Icons.ExternalLink size={15} />}
                  onPress={() => void openExternalUrl(provider.dashboardUrl)}
                >
                  Open {provider.name} dashboard
                </Button>
              ) : null}
            </YStack>
          ) : showCredentialForm && credentialConfig ? (
            <YStack gap="$4">
              <YStack gap="$1">
                <Text fontSize={16} fontWeight="800" color={ui.text}>
                  {PAYMENT_UI_COPY.apiConfiguration}
                </Text>
                <Text fontSize={13} color={ui.textSecondary}>
                  {PAYMENT_UI_COPY.apiConfigurationHint}
                </Text>
              </YStack>

              {!credentialConfig.noModeSelector && modeKeys.length > 0 ? (
                <YStack gap="$2">
                  <Text fontSize={12} fontWeight="700" color={ui.textMuted}>
                    {PAYMENT_UI_COPY.environment}
                  </Text>
                  <XStack
                    borderWidth={1}
                    borderColor={ui.borderSubtle}
                    borderRadius={999}
                    padding={3}
                    backgroundColor={ui.surfaceMuted}
                    gap="$1"
                  >
                    {modeKeys.map((key) => {
                      const active = mode === key
                      return (
                        <Button
                          key={key}
                          flex={1}
                          size="$2.5"
                          borderRadius={999}
                          backgroundColor={active ? ui.brand : 'transparent'}
                          color={active ? 'white' : ui.textSecondary}
                          borderWidth={0}
                          onPress={() => {
                            setMode(key)
                            setTestPassed(null)
                          }}
                        >
                          {modeOptions[key]}
                        </Button>
                      )
                    })}
                  </XStack>
                </YStack>
              ) : null}

              {!credentialConfig.noModeSelector && isTestProviderMode(mode) ? (
                <XStack
                  gap="$2.5"
                  padding="$3"
                  borderRadius={radius.card}
                  backgroundColor="#FEF3C7"
                  borderWidth={1}
                  borderColor="#FCD34D"
                  alignItems="flex-start"
                >
                  <Icons.AlertTriangle size={16} color="#B45309" />
                  <Text flex={1} fontSize={12} color="#92400E" lineHeight={18}>
                    {PAYMENT_UI_COPY.testModeWarning}
                  </Text>
                </XStack>
              ) : !credentialConfig.noModeSelector && modeKeys.length > 0 ? (
                <XStack
                  gap="$2.5"
                  padding="$3"
                  borderRadius={radius.card}
                  backgroundColor={ui.roseSurface}
                  borderWidth={1}
                  borderColor={`${ui.brand}33`}
                  alignItems="flex-start"
                >
                  <Icons.AlertTriangle size={16} color={ui.brand} />
                  <Text flex={1} fontSize={12} color={ui.textSecondary} lineHeight={18}>
                    {PAYMENT_UI_COPY.liveModeWarning}
                  </Text>
                </XStack>
              ) : null}

              {credentialConfig.fields.map((field) => {
                const error = fieldErrors[field.key]
                const isPassword = field.type === 'password'
                const revealed = revealedFields[field.key]

                if (field.type === 'textarea') {
                  return (
                    <Field key={field.key} label={field.label} error={error}>
                      <TextArea
                        value={credentials[field.key] ?? ''}
                        onChangeText={(value) => patchCredential(field.key, value)}
                        placeholder={field.placeholder}
                        minHeight={96}
                      />
                    </Field>
                  )
                }

                return (
                  <Field
                    key={field.key}
                    label={`${field.label}${field.required ? ' *' : ''}`}
                    error={error}
                  >
                    <XStack alignItems="center" position="relative">
                      <Input
                        flex={1}
                        value={credentials[field.key] ?? ''}
                        onChangeText={(value) => patchCredential(field.key, value)}
                        placeholder={field.placeholder}
                        secureTextEntry={isPassword && !revealed}
                        autoCapitalize="none"
                        autoCorrect={false}
                      />
                      {isPassword ? (
                        <YStack
                          position="absolute"
                          right={10}
                          cursor="pointer"
                          onPress={() =>
                            setRevealedFields((current) => ({
                              ...current,
                              [field.key]: !current[field.key],
                            }))
                          }
                        >
                          {revealed ? (
                            <Icons.EyeOff size={18} color={ui.textMuted} />
                          ) : (
                            <Icons.Eye size={18} color={ui.textMuted} />
                          )}
                        </YStack>
                      ) : null}
                    </XStack>
                  </Field>
                )
              })}

              <Field label="Webhook URL (Optional)" error={fieldErrors.webhook_url}>
                <Input
                  value={webhookUrl}
                  onChangeText={(value) => {
                    setWebhookUrl(value)
                    if (fieldErrors.webhook_url) {
                      setFieldErrors((current) => {
                        const next = { ...current }
                        delete next.webhook_url
                        return next
                      })
                    }
                  }}
                  placeholder="https://your-domain.com/webhooks"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </Field>
              <Text fontSize={12} color={ui.textMuted}>
                {PAYMENT_UI_COPY.webhookHint}
              </Text>

              {provider.dashboardUrl || provider.website ? (
                <Button
                  tone="ghost"
                  size="$3"
                  alignSelf="flex-start"
                  icon={<Icons.ExternalLink size={14} />}
                  onPress={() => void openExternalUrl(provider.dashboardUrl || provider.website)}
                >
                  {PAYMENT_UI_COPY.viewDocumentation}
                </Button>
              ) : null}

              <YStack gap="$2">
                <Button
                  tone="outline"
                  size="$3"
                  borderRadius={999}
                  disabled={isValidating}
                  icon={
                    isValidating ? (
                      <Spinner size="small" />
                    ) : (
                      <Icons.FlaskConical size={15} color={ui.brand} />
                    )
                  }
                  onPress={() => void runValidationCheck()}
                >
                  {isValidating ? 'Validating…' : PAYMENT_UI_COPY.runTest}
                </Button>
                {testPassed === true ? (
                  <XStack gap="$2" alignItems="center">
                    <Icons.CheckCircle2 size={16} color={ui.success} />
                    <Text fontSize={12} color={ui.success}>
                      {PAYMENT_UI_COPY.testSuccess}
                    </Text>
                  </XStack>
                ) : testPassed === false ? (
                  <XStack gap="$2" alignItems="center">
                    <Icons.XCircle size={16} color={ui.danger} />
                    <Text fontSize={12} color={ui.danger}>
                      {PAYMENT_UI_COPY.testFailed}
                    </Text>
                  </XStack>
                ) : null}
              </YStack>

              <YStack gap="$2.5" paddingTop="$3" borderTopWidth={1} borderTopColor={ui.borderSubtle}>
                {connected ? (
                  <Button
                    tone="outline"
                    size="$4"
                    borderRadius={999}
                    borderColor="#DC2626"
                    color="#DC2626"
                    disabled={loading.connecting || loading.accounts}
                    onPress={() => void handleDisconnect()}
                  >
                    {PAYMENT_UI_COPY.disconnect}
                  </Button>
                ) : null}
                <XStack gap="$2.5">
                  <Button
                    tone="outline"
                    size="$4"
                    borderRadius={999}
                    flex={1}
                    borderColor={ui.brand}
                    color={ui.brand}
                    disabled={loading.connecting}
                    onPress={onClose}
                  >
                    {PAYMENT_UI_COPY.cancel}
                  </Button>
                  <Button
                    tone="primary"
                    size="$4"
                    borderRadius={999}
                    flex={1}
                    disabled={loading.connecting}
                    icon={
                      loading.connecting ? (
                        <Spinner size="small" color="white" />
                      ) : (
                        <Icons.Link size={16} color="white" />
                      )
                    }
                    onPress={() => void handleConnect()}
                  >
                    {connectLabel}
                  </Button>
                </XStack>
              </YStack>
            </YStack>
          ) : (
            <YStack gap="$3">
              <Text fontSize={14} color={ui.textSecondary}>
                Supported: {supportedMethods.join(', ') || '—'}
              </Text>
              <Button
                tone="primary"
                size="$4"
                borderRadius={999}
                onPress={() =>
                  void dispatch(
                    connectPaymentAccount({
                      shopId,
                      provider: provider.id,
                      merchantId: `${provider.id}_${Date.now()}`,
                    }),
                  )
                    .unwrap()
                    .then(() => {
                      toast.show(PAYMENT_UI_COPY.connectSuccess, { tone: 'success' })
                      onConnected?.()
                      onClose()
                    })
                    .catch((error) => {
                      toast.show(PAYMENT_UI_COPY.connectFailed, {
                        tone: 'danger',
                        message: toFriendlyPaymentError(error),
                      })
                    })
                }
              >
                {connectLabel}
              </Button>
            </YStack>
          )}
        </YStack>
      </ScrollView>
    </YStack>
  )
}
