import { useEffect, useState } from 'react'

import { CommercePanel } from '~/commerce/components'
import {
  DEFAULT_COMMERCE_FORM,
  fetchShopCommerceForm,
  saveShopCommerceForm,
  type ShopCommerceForm,
} from '~/commerce/lib/seller-commerce'
import type { VendorShop } from '~/hooks/useVendorShops'
import {
  Button,
  Icons,
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

  async function handleSave() {
    setIsSaving(true)
    const { error } = await saveShopCommerceForm(shop.id, {
      ...form,
      paymentManaged: true,
      paymentGateway: 'payu',
      shippingPartner: 'easyship',
    })
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
          0% SHEconomy commission on item price. Buyers pay online securely; every order ships with
          platform labels using your shipping credit.
        </Text>
      </YStack>

      <YStack gap="$3">
        <Text fontSize={15} fontWeight="700" color={ui.text}>
          How you get paid
        </Text>
        <XStack
          gap="$3"
          padding="$3.5"
          borderRadius={12}
          borderWidth={1.5}
          borderColor={ui.brand}
          backgroundColor={ui.chip}
          alignItems="flex-start"
        >
          <YStack paddingTop={2}>
            <Icons.ShieldCheck size={18} color={ui.brand} />
          </YStack>
          <YStack flex={1} minWidth={0} gap={2}>
            <XStack alignItems="center" gap="$2" flexWrap="wrap">
              <Text fontSize={14} fontWeight="700" color={ui.text}>
                Online payouts
              </Text>
              <Text
                fontSize={10}
                fontWeight="800"
                color={ui.onBrand}
                backgroundColor={ui.brand}
                paddingHorizontal="$2"
                paddingVertical={2}
                borderRadius={999}
              >
                Required
              </Text>
            </XStack>
            <Text fontSize={12} color={ui.textSecondary} lineHeight={17}>
              Buyers pay online. Funds settle to your payout account — 0% SHEconomy commission.
              Complete verification under Payment methods.
            </Text>
          </YStack>
        </XStack>
      </YStack>

      <YStack height={1} backgroundColor={ui.border} />

      <YStack gap="$3">
        <Text fontSize={15} fontWeight="700" color={ui.text}>
          How you ship orders
        </Text>
        <XStack
          gap="$3"
          padding="$3.5"
          borderRadius={12}
          borderWidth={1.5}
          borderColor={ui.brand}
          backgroundColor={ui.chip}
          alignItems="flex-start"
        >
          <YStack paddingTop={2}>
            <Icons.Truck size={18} color={ui.brand} />
          </YStack>
          <YStack flex={1} minWidth={0} gap={2}>
            <Text fontSize={14} fontWeight="700" color={ui.text}>
              Platform shipping labels
            </Text>
            <Text fontSize={12} color={ui.textSecondary} lineHeight={17}>
              Buyer-paid freight credits your shipping balance. Process every label from Orders —
              manual AWB entry is not available.
            </Text>
          </YStack>
        </XStack>
      </YStack>

      <Button
        tone="primary"
        size="$4"
        borderRadius={999}
        disabled={isSaving}
        onPress={() => void handleSave()}
        icon={isSaving ? <Spinner size="small" color="white" /> : undefined}
      >
        {isSaving ? 'Saving…' : 'Confirm payments & delivery'}
      </Button>
    </CommercePanel>
  )
}
