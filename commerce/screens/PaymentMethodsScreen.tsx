import {
  addBuyerCardPaymentMethod,
  addBuyerUpiPaymentMethod,
  fetchBuyerPaymentMethods,
  removeBuyerPaymentMethod,
  setDefaultBuyerPaymentMethod,
} from '~/commerce/lib/buyer-account'
import {
  detectCardBrand,
  extractLastFour,
  normalizeExpYear,
  normalizeUpiId,
  parseExpMonth,
  parsePaymentMethod,
  paymentMethodSubtitle,
  paymentMethodTitle,
  type CardFundingType,
  type ParsedPaymentMethod,
  validateCardInput,
  validateUpiId,
} from '~/commerce/lib/payment-methods'
import { CommercePageHeader, CommercePanel } from '~/commerce/components'
import {
  Button,
  Field,
  Icons,
  Input,
  Spinner,
  Switch,
  Text,
  XStack,
  YStack,
  useAppToast,
} from '~/components/ui'
import { FullWidthLayout, PageSection } from '~/components/layout'
import { radius } from '~/config/tokens'
import { useProfile } from '~/hooks/useProfile'
import { useAppUi } from '~/lib/theme/useAppUi'
import { QA } from '~/lib/qa/test-ids'
import { useCallback, useEffect, useMemo, useState } from 'react'

type AddMode = 'card' | 'upi' | null

export function PaymentMethodsScreen() {
  const ui = useAppUi()
  const toast = useAppToast()
  const { user } = useProfile()
  const [methods, setMethods] = useState<ParsedPaymentMethod[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [addMode, setAddMode] = useState<AddMode>(null)

  const [cardNumber, setCardNumber] = useState('')
  const [cardholderName, setCardholderName] = useState('')
  const [expMonth, setExpMonth] = useState('')
  const [expYear, setExpYear] = useState('')
  const [cardType, setCardType] = useState<CardFundingType>('credit')
  const [cardLabel, setCardLabel] = useState('')
  const [cardDefault, setCardDefault] = useState(false)

  const [upiId, setUpiId] = useState('')
  const [upiLabel, setUpiLabel] = useState('')
  const [upiDefault, setUpiDefault] = useState(false)

  const load = useCallback(async () => {
    if (!user?.id) {
      setMethods([])
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    const result = await fetchBuyerPaymentMethods(user.id)
    setMethods((result.methods ?? []).map(parsePaymentMethod))
    setError(result.error)
    setIsLoading(false)
  }, [user?.id])

  useEffect(() => {
    void load()
  }, [load])

  const cardMethods = useMemo(() => methods.filter((method) => method.kind === 'card'), [methods])
  const upiMethods = useMemo(() => methods.filter((method) => method.kind === 'upi'), [methods])

  function resetCardForm() {
    setCardNumber('')
    setCardholderName('')
    setExpMonth('')
    setExpYear('')
    setCardType('credit')
    setCardLabel('')
    setCardDefault(false)
  }

  function resetUpiForm() {
    setUpiId('')
    setUpiLabel('')
    setUpiDefault(false)
  }

  async function handleAddCard() {
    if (!user?.id) return

    const validationError = validateCardInput({
      cardNumber,
      cardholderName,
      expMonth,
      expYear,
    })
    if (validationError) {
      toast.show('Check card details', { tone: 'danger', message: validationError })
      return
    }

    const month = parseExpMonth(expMonth)
    const year = normalizeExpYear(expYear)
    if (month === null || year === null) {
      toast.show('Check card details', { tone: 'danger', message: 'Enter a valid expiry date.' })
      return
    }

    setIsSaving(true)
    const { error: saveError } = await addBuyerCardPaymentMethod(user.id, {
      label: cardLabel.trim() || undefined,
      cardBrand: detectCardBrand(cardNumber),
      lastFour: extractLastFour(cardNumber),
      cardholderName,
      cardType,
      expMonth: month,
      expYear: year,
      isDefault: cardDefault || methods.length === 0,
    })
    setIsSaving(false)

    if (saveError) {
      toast.show('Could not save card', { tone: 'danger', message: saveError })
      return
    }

    resetCardForm()
    setAddMode(null)
    toast.show('Card saved', { tone: 'success' })
    void load()
  }

  async function handleAddUpi() {
    if (!user?.id) return

    const validationError = validateUpiId(upiId)
    if (validationError) {
      toast.show('Check UPI details', { tone: 'danger', message: validationError })
      return
    }

    setIsSaving(true)
    const { error: saveError } = await addBuyerUpiPaymentMethod(user.id, {
      label: upiLabel.trim() || undefined,
      upiId: normalizeUpiId(upiId),
      isDefault: upiDefault || methods.length === 0,
    })
    setIsSaving(false)

    if (saveError) {
      toast.show('Could not save UPI', { tone: 'danger', message: saveError })
      return
    }

    resetUpiForm()
    setAddMode(null)
    toast.show('UPI ID saved', { tone: 'success' })
    void load()
  }

  async function handleSetDefault(method: ParsedPaymentMethod) {
    if (!user?.id || method.is_default) return
    const { error: updateError } = await setDefaultBuyerPaymentMethod(user.id, method.id)
    if (updateError) {
      toast.show('Could not update default', { tone: 'danger', message: updateError })
      return
    }
    void load()
  }

  async function handleRemove(method: ParsedPaymentMethod) {
    if (!user?.id) return
    const { error: removeError } = await removeBuyerPaymentMethod(user.id, method.id)
    if (removeError) {
      toast.show('Could not remove payment method', { tone: 'danger', message: removeError })
      return
    }
    toast.show('Payment method removed', { tone: 'success' })
    void load()
  }

  return (
    <FullWidthLayout scroll>
      <PageSection paddingVertical="$6">
        <YStack gap="$5" width="100%" maxWidth="100%" alignSelf="stretch">
          <CommercePageHeader
            title="Payment methods"
            subtitle="Save debit cards, credit cards, and UPI IDs for faster checkout"
          />

          {isLoading ? (
            <YStack alignItems="center" paddingVertical="$8">
              <Spinner size="large" />
            </YStack>
          ) : error ? (
            <Text color={ui.danger} fontSize={14}>
              {error}
            </Text>
          ) : (
            <>
              <SavedMethodsSection
                title="Cards"
                emptyMessage="No saved cards yet"
                methods={cardMethods}
                onSetDefault={handleSetDefault}
                onRemove={handleRemove}
              />

              <SavedMethodsSection
                title="UPI"
                emptyMessage="No saved UPI IDs yet"
                methods={upiMethods}
                onSetDefault={handleSetDefault}
                onRemove={handleRemove}
              />

              <CommercePanel padding="$4" gap="$3">
                <Text fontWeight="700" fontSize={16} color={ui.text}>
                  Add a payment method
                </Text>
                <XStack gap="$2" flexWrap="wrap">
                  <Button
                    tone={addMode === 'card' ? 'primary' : 'outline'}
                    size="$3"
                    borderRadius={999}
                    icon={<Icons.CreditCard size={16} />}
                    onPress={() => setAddMode((mode) => (mode === 'card' ? null : 'card'))}
                    testID={QA.paymentAddCard}
                    accessibilityLabel="Add debit or credit card"
                  >
                    Debit / credit card
                  </Button>
                  <Button
                    tone={addMode === 'upi' ? 'primary' : 'outline'}
                    size="$3"
                    borderRadius={999}
                    icon={<Icons.Smartphone size={16} />}
                    onPress={() => setAddMode((mode) => (mode === 'upi' ? null : 'upi'))}
                  >
                    UPI
                  </Button>
                </XStack>

                {addMode === 'card' ? (
                  <YStack gap="$3" paddingTop="$2">
                    <Text fontSize={13} color={ui.textMuted} lineHeight={20}>
                      We only store the last 4 digits and expiry — never your full card number.
                    </Text>
                    <Field label="Card number">
                      <Input
                        value={cardNumber}
                        onChangeText={setCardNumber}
                        placeholder="1234 5678 9012 3456"
                        keyboardType="number-pad"
                        backgroundColor={ui.surface}
                      />
                    </Field>
                    <Field label="Name on card">
                      <Input
                        value={cardholderName}
                        onChangeText={setCardholderName}
                        placeholder="As printed on card"
                        autoCapitalize="words"
                        backgroundColor={ui.surface}
                      />
                    </Field>
                    <XStack gap="$3" flexWrap="wrap">
                      <Field label="Expiry month" flex={1} minWidth={120}>
                        <Input
                          value={expMonth}
                          onChangeText={setExpMonth}
                          placeholder="MM"
                          keyboardType="number-pad"
                          maxLength={2}
                          backgroundColor={ui.surface}
                        />
                      </Field>
                      <Field label="Expiry year" flex={1} minWidth={120}>
                        <Input
                          value={expYear}
                          onChangeText={setExpYear}
                          placeholder="YY"
                          keyboardType="number-pad"
                          maxLength={4}
                          backgroundColor={ui.surface}
                        />
                      </Field>
                    </XStack>
                    <XStack gap="$2" flexWrap="wrap">
                      <Button
                        tone={cardType === 'credit' ? 'primary' : 'outline'}
                        size="$3"
                        borderRadius={999}
                        onPress={() => setCardType('credit')}
                      >
                        Credit card
                      </Button>
                      <Button
                        tone={cardType === 'debit' ? 'primary' : 'outline'}
                        size="$3"
                        borderRadius={999}
                        onPress={() => setCardType('debit')}
                      >
                        Debit card
                      </Button>
                    </XStack>
                    <Field label="Nickname (optional)">
                      <Input
                        value={cardLabel}
                        onChangeText={setCardLabel}
                        placeholder="e.g. Personal HDFC"
                        backgroundColor={ui.surface}
                      />
                    </Field>
                    <DefaultToggle checked={cardDefault} onCheckedChange={setCardDefault} />
                    <Button
                      tone="primary"
                      size="$4"
                      borderRadius={999}
                      disabled={isSaving}
                      onPress={() => void handleAddCard()}
                    >
                      {isSaving ? 'Saving…' : 'Save card'}
                    </Button>
                  </YStack>
                ) : null}

                {addMode === 'upi' ? (
                  <YStack gap="$3" paddingTop="$2">
                    <Field label="UPI ID">
                      <Input
                        value={upiId}
                        onChangeText={setUpiId}
                        placeholder="yourname@bank"
                        autoCapitalize="none"
                        autoCorrect={false}
                        backgroundColor={ui.surface}
                      />
                    </Field>
                    <Field label="Nickname (optional)">
                      <Input
                        value={upiLabel}
                        onChangeText={setUpiLabel}
                        placeholder="e.g. PhonePe, Google Pay"
                        backgroundColor={ui.surface}
                      />
                    </Field>
                    <DefaultToggle checked={upiDefault} onCheckedChange={setUpiDefault} />
                    <Button
                      tone="primary"
                      size="$4"
                      borderRadius={999}
                      disabled={isSaving}
                      onPress={() => void handleAddUpi()}
                    >
                      {isSaving ? 'Saving…' : 'Save UPI ID'}
                    </Button>
                  </YStack>
                ) : null}
              </CommercePanel>
            </>
          )}
        </YStack>
      </PageSection>
    </FullWidthLayout>
  )
}

function SavedMethodsSection({
  title,
  emptyMessage,
  methods,
  onSetDefault,
  onRemove,
}: {
  title: string
  emptyMessage: string
  methods: ParsedPaymentMethod[]
  onSetDefault: (method: ParsedPaymentMethod) => void
  onRemove: (method: ParsedPaymentMethod) => void
}) {
  const ui = useAppUi()

  return (
    <YStack gap="$2" width="100%">
      <Text fontSize={13} fontWeight="700" color={ui.textMuted} letterSpacing={0.5} textTransform="uppercase">
        {title}
      </Text>
      {methods.length === 0 ? (
        <CommercePanel padding="$4">
          <Text fontSize={14} color={ui.textSecondary}>
            {emptyMessage}
          </Text>
        </CommercePanel>
      ) : (
        <YStack gap="$2" width="100%">
          {methods.map((method) => (
            <SavedPaymentMethodRow
              key={method.id}
              method={method}
              onSetDefault={() => onSetDefault(method)}
              onRemove={() => onRemove(method)}
            />
          ))}
        </YStack>
      )}
    </YStack>
  )
}

function SavedPaymentMethodRow({
  method,
  onSetDefault,
  onRemove,
}: {
  method: ParsedPaymentMethod
  onSetDefault: () => void
  onRemove: () => void
}) {
  const ui = useAppUi()
  const Icon = method.kind === 'upi' ? Icons.Smartphone : Icons.CreditCard

  return (
    <CommercePanel padding="$4" gap="$3">
      <XStack gap="$3" alignItems="center">
        <YStack
          width={44}
          height={44}
          borderRadius={radius.chip}
          backgroundColor={ui.chip}
          alignItems="center"
          justifyContent="center"
        >
          <Icon size={22} color={ui.text} />
        </YStack>
        <YStack flex={1} gap={2} minWidth={0}>
          <Text fontWeight="700" fontSize={15} color={ui.text} numberOfLines={1}>
            {paymentMethodTitle(method)}
          </Text>
          <Text fontSize={13} color={ui.textSecondary} numberOfLines={1}>
            {paymentMethodSubtitle(method)}
          </Text>
          {method.kind === 'card' && method.cardholderName ? (
            <Text fontSize={12} color={ui.textMuted} numberOfLines={1}>
              {method.cardholderName}
            </Text>
          ) : null}
        </YStack>
        {method.is_default ? (
          <Text fontSize={12} fontWeight="700" color={ui.brand}>
            Default
          </Text>
        ) : null}
      </XStack>
      <XStack gap="$2" flexWrap="wrap">
        {!method.is_default ? (
          <Button tone="outline" size="$2.5" borderRadius={999} onPress={onSetDefault}>
            Set as default
          </Button>
        ) : null}
        <Button tone="outline" size="$2.5" borderRadius={999} onPress={onRemove}>
          Remove
        </Button>
      </XStack>
    </CommercePanel>
  )
}

function DefaultToggle({
  checked,
  onCheckedChange,
}: {
  checked: boolean
  onCheckedChange: (value: boolean) => void
}) {
  const ui = useAppUi()
  return (
    <XStack alignItems="center" justifyContent="space-between" gap="$3">
      <Text fontSize={14} color={ui.text}>
        Set as default payment method
      </Text>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </XStack>
  )
}
