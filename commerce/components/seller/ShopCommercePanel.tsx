import type { ReactNode } from 'react'
import { useEffect, useState } from 'react'

import { CommercePanel } from '~/commerce/components'
import {
  DEFAULT_COMMERCE_FORM,
  PAYMENT_GATEWAY_OPTIONS,
  SHIPPING_PARTNER_OPTIONS,
  fetchShopCommerceForm,
  saveShopCommerceForm,
  type CommerceOption,
  type ShopCommerceForm,
} from '~/commerce/lib/seller-commerce'
import type { VendorShop } from '~/hooks/useVendorShops'
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
import { useAppUi } from '~/lib/theme/useAppUi'

type ShopCommercePanelProps = {
  shop: VendorShop
}

export function ShopCommercePanel({ shop }: ShopCommercePanelProps) {
  const ui = useAppUi()
  const toast = useAppToast()
  const [form, setForm] = useState<ShopCommerceForm>(DEFAULT_COMMERCE_FORM)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    let active = true
    setIsLoading(true)
    void fetchShopCommerceForm(shop.id).then(({ form: loaded, error }) => {
      if (!active) return
      setForm(loaded)
      if (error) toast.show('Could not load payment settings', { tone: 'danger', message: error })
      setIsLoading(false)
    })
    return () => {
      active = false
    }
  }, [shop.id, toast])

  function patch(next: Partial<ShopCommerceForm>) {
    setForm((current) => ({ ...current, ...next }))
  }

  async function handleSave() {
    setIsSaving(true)
    const { error } = await saveShopCommerceForm(shop.id, form)
    setIsSaving(false)
    if (error) {
      toast.show('Could not save', { tone: 'danger', message: error })
      return
    }
    toast.show('Payment & delivery updated', { tone: 'success' })
  }

  if (isLoading) {
    return (
      <CommercePanel>
        <XStack alignItems="center" gap="$2" paddingVertical="$4">
          <Spinner size="small" />
          <Text fontSize={13} color={ui.textMuted}>
            Loading payment & delivery setup…
          </Text>
        </XStack>
      </CommercePanel>
    )
  }

  return (
    <CommercePanel gap="$5">
      <YStack gap="$1">
        <Text fontSize={18} fontWeight="700" color={ui.text}>
          Payments & delivery
        </Text>
        <Text fontSize={14} color={ui.textSecondary} lineHeight={20}>
          SHEconomy runs on a 0% commission model. Connect your own payment gateway and courier to
          get paid directly with no commission — or let SHEPay & SHEDelivery handle it for you.
        </Text>
      </YStack>

      {/* Payments */}
      <YStack gap="$3">
        <Text fontSize={15} fontWeight="700" color={ui.text}>
          How do you want to get paid?
        </Text>
        <OptionCard
          selected={!form.paymentManaged}
          icon={<Icons.Wallet size={18} color={ui.brand} />}
          title="Connect my own gateway"
          subtitle="Buyers pay you directly into your bank. 0% SHEconomy commission."
          badge="0% commission"
          onPress={() => patch({ paymentManaged: false })}
        />
        {!form.paymentManaged ? (
          <YStack gap="$3" paddingLeft="$3">
            <ChoiceRow
              label="Gateway"
              options={PAYMENT_GATEWAY_OPTIONS}
              value={form.paymentGateway}
              onChange={(value) => patch({ paymentGateway: value })}
            />
            <Field label="Account label (shown to you)">
              <Input
                value={form.paymentAccountLabel}
                placeholder="e.g. My Razorpay business account"
                onChangeText={(value) => patch({ paymentAccountLabel: value })}
              />
            </Field>
            <Field label="Publishable key ID (optional)">
              <Input
                value={form.paymentKeyId}
                placeholder="e.g. rzp_live_xxxxxxxx"
                autoCapitalize="none"
                onChangeText={(value) => patch({ paymentKeyId: value })}
              />
            </Field>
            <XStack gap="$2" alignItems="flex-start">
              <Icons.Info size={13} color={ui.textMuted} marginTop={2} />
              <Text fontSize={11} color={ui.textMuted} flex={1}>
                Never paste secret keys here. You&apos;ll securely connect your gateway credentials
                during payout onboarding.
              </Text>
            </XStack>
          </YStack>
        ) : null}

        <OptionCard
          selected={form.paymentManaged}
          icon={<Icons.ShieldCheck size={18} color={ui.brand} />}
          title="Use SHEPay (managed by SHEconomy)"
          subtitle="We securely collect payments and pay out to your bank. A small commission applies."
          onPress={() => patch({ paymentManaged: true })}
        />
      </YStack>

      <YStack height={1} backgroundColor={ui.border} />

      {/* Delivery */}
      <YStack gap="$3">
        <Text fontSize={15} fontWeight="700" color={ui.text}>
          How do you want to ship orders?
        </Text>
        <OptionCard
          selected={!form.shippingManaged}
          icon={<Icons.Truck size={18} color={ui.brand} />}
          title="Use my own courier"
          subtitle="Ship with your own logistics partner or in-house delivery."
          onPress={() => patch({ shippingManaged: false })}
        />
        {!form.shippingManaged ? (
          <YStack gap="$3" paddingLeft="$3">
            <ChoiceRow
              label="Courier partner"
              options={SHIPPING_PARTNER_OPTIONS}
              value={form.shippingPartner}
              onChange={(value) => patch({ shippingPartner: value })}
            />
            <Field label="Account label (optional)">
              <Input
                value={form.shippingAccountLabel}
                placeholder="e.g. My Shiprocket account"
                onChangeText={(value) => patch({ shippingAccountLabel: value })}
              />
            </Field>
          </YStack>
        ) : null}

        <OptionCard
          selected={form.shippingManaged}
          icon={<Icons.PackageCheck size={18} color={ui.brand} />}
          title="Use SHEDelivery (managed)"
          subtitle="SHEconomy arranges pickup and delivery for your orders."
          onPress={() => patch({ shippingManaged: true })}
        />
      </YStack>

      <Button
        tone="primary"
        size="$4"
        borderRadius={999}
        disabled={isSaving}
        onPress={() => void handleSave()}
        icon={isSaving ? <Spinner size="small" color="white" /> : undefined}
      >
        {isSaving ? 'Saving…' : 'Save payment & delivery'}
      </Button>
    </CommercePanel>
  )
}

function OptionCard({
  selected,
  icon,
  title,
  subtitle,
  badge,
  onPress,
}: {
  selected: boolean
  icon: ReactNode
  title: string
  subtitle: string
  badge?: string
  onPress: () => void
}) {
  const ui = useAppUi()
  return (
    <XStack
      gap="$3"
      padding="$3.5"
      borderRadius={12}
      borderWidth={1.5}
      borderColor={selected ? ui.brand : ui.border}
      backgroundColor={selected ? ui.chip : ui.surface}
      cursor="pointer"
      onPress={onPress}
      alignItems="flex-start"
    >
      <YStack paddingTop={2}>{icon}</YStack>
      <YStack flex={1} minWidth={0} gap={2}>
        <XStack alignItems="center" gap="$2" flexWrap="wrap">
          <Text fontSize={14} fontWeight="700" color={ui.text}>
            {title}
          </Text>
          {badge ? (
            <Text
              fontSize={10}
              fontWeight="800"
              color={ui.onBrand}
              backgroundColor={ui.brand}
              paddingHorizontal="$2"
              paddingVertical={2}
              borderRadius={999}
            >
              {badge}
            </Text>
          ) : null}
        </XStack>
        <Text fontSize={12} color={ui.textSecondary} lineHeight={17}>
          {subtitle}
        </Text>
      </YStack>
      <YStack paddingTop={2}>
        {selected ? (
          <Icons.CheckCircle2 size={20} color={ui.brand} />
        ) : (
          <Icons.Circle size={20} color={ui.border} />
        )}
      </YStack>
    </XStack>
  )
}

function ChoiceRow({
  label,
  options,
  value,
  onChange,
}: {
  label: string
  options: CommerceOption[]
  value: string
  onChange: (value: string) => void
}) {
  const ui = useAppUi()
  return (
    <YStack gap="$2">
      <Text fontSize={13} fontWeight="600" color={ui.text}>
        {label}
      </Text>
      <XStack gap="$2" flexWrap="wrap">
        {options.map((option) => {
          const selected = value === option.value
          return (
            <Text
              key={option.value}
              onPress={() => onChange(option.value)}
              fontSize={13}
              fontWeight="600"
              color={selected ? ui.onBrand : ui.text}
              backgroundColor={selected ? ui.brand : ui.surfaceMuted}
              borderColor={selected ? ui.brand : ui.border}
              borderWidth={1}
              paddingHorizontal="$3"
              paddingVertical="$2"
              borderRadius={999}
              cursor="pointer"
            >
              {option.label}
            </Text>
          )
        })}
      </XStack>
    </YStack>
  )
}
