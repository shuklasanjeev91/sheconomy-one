import { useState } from 'react'
import { Link } from 'one'

import { Button, Icons, Spinner, Text, XStack, YStack } from '~/components/ui'
import { PageCenter } from '~/components/layout'
import { useAppLayout } from '~/hooks/useAppLayout'
import { DEFAULT_SHOP_CURRENCY } from '~/lib/shop/shop.type'
import { commerceRoutes, vendorRoutes } from '~/lib/routes'
import { useAppSelector } from '~/lib/store/hooks'
import { useAppUi } from '~/lib/theme/useAppUi'

import { VendorListingDetailDrawer } from '~/commerce/screens/vendor/VendorListingDetailDrawer'
import { VendorListingsProductsTab } from '~/commerce/screens/vendor/VendorListingsProductsTab'
import { VendorListingsSectionsTab } from '~/commerce/screens/vendor/VendorListingsSectionsTab'

type InventoryTab = 'product' | 'section'

export function VendorListingsScreen() {
  const ui = useAppUi()
  const { isDesktop, safeBottom } = useAppLayout()
  const shop = useAppSelector((s) => s.shop.currentShop)
  const isLoadingMyShops = useAppSelector((s) => s.shop.isLoadingMyShops)
  const myShopsLoaded = useAppSelector((s) => s.shop.myShopsLoaded)

  const [activeTab, setActiveTab] = useState<InventoryTab>('product')
  const [selectedListingId, setSelectedListingId] = useState<string | null>(null)

  if (!shop && (isLoadingMyShops || !myShopsLoaded)) {
    return (
      <PageCenter>
        <Spinner size="large" />
      </PageCenter>
    )
  }

  if (!shop) {
    return (
      <YStack flex={1} alignItems="center" justifyContent="center" padding="$6" gap="$3" minHeight={360}>
        <YStack
          width={68}
          height={68}
          borderRadius={999}
          backgroundColor={ui.roseSurface}
          alignItems="center"
          justifyContent="center"
        >
          <Icons.Store size={30} color={ui.brand} />
        </YStack>
        <Text fontSize={18} fontWeight="800" color={ui.text}>
          No shop yet
        </Text>
        <Text fontSize={14} color={ui.textSecondary} textAlign="center" maxWidth={360}>
          Create your storefront to start managing products and inventory.
        </Text>
        <Link href={commerceRoutes.manageShop()} asChild>
          <Button tone="primary" size="$4" borderRadius={999}>
            Go to My Shops
          </Button>
        </Link>
      </YStack>
    )
  }

  const currency = shop.shop_currency || DEFAULT_SHOP_CURRENCY

  return (
    <>
      <YStack
        width="100%"
        maxWidth="100%"
        gap="$4"
        paddingHorizontal={isDesktop ? '$6' : '$4'}
        paddingTop={isDesktop ? '$6' : '$4'}
        paddingBottom={(isDesktop ? 32 : 24) + safeBottom}
      >
        <XStack alignItems="flex-start" justifyContent="space-between" gap="$3" flexWrap="wrap">
          <YStack gap="$1" flex={1} minWidth={0}>
            <Text fontSize={isDesktop ? 28 : 24} fontWeight="800" color={ui.text} letterSpacing={-0.5}>
              {activeTab === 'section' ? 'Shop Sections' : 'Inventory Management'}
            </Text>
            <Text fontSize={14} color={ui.textSecondary} maxWidth={620} lineHeight={20}>
              {activeTab === 'section'
                ? 'Organize your storefront collections to guide customers through your premium offerings.'
                : 'Organize, refine, and perfect your storefront offerings.'}
            </Text>
          </YStack>

          {activeTab !== 'section' ? (
            <Link href={vendorRoutes.createListing} asChild>
              <Button tone="primary" size="$3" borderRadius={999} icon={<Icons.Plus size={16} />}>
                Add Product
              </Button>
            </Link>
          ) : null}
        </XStack>

        <InventoryTabs ui={ui} activeTab={activeTab} onChange={setActiveTab} isDesktop={isDesktop} />

        {activeTab === 'product' ? (
          <VendorListingsProductsTab
            ui={ui}
            shopId={shop.id}
            currency={currency}
            isDesktop={isDesktop}
            onOpenListing={setSelectedListingId}
          />
        ) : (
          <VendorListingsSectionsTab
            ui={ui}
            shopId={shop.id}
            isDesktop={isDesktop}
            safeBottom={safeBottom}
          />
        )}
      </YStack>

      <VendorListingDetailDrawer
        ui={ui}
        open={Boolean(selectedListingId)}
        listingId={selectedListingId}
        currency={currency}
        isDesktop={isDesktop}
        safeBottom={safeBottom}
        onClose={() => setSelectedListingId(null)}
      />
    </>
  )
}

function InventoryTabs({
  ui,
  activeTab,
  onChange,
  isDesktop,
}: {
  ui: ReturnType<typeof useAppUi>
  activeTab: InventoryTab
  onChange: (tab: InventoryTab) => void
  isDesktop: boolean
}) {
  const tabs: { id: InventoryTab; label: string; icon: (typeof Icons)[keyof typeof Icons] }[] = [
    { id: 'product', label: 'Product', icon: Icons.Info },
    { id: 'section', label: 'Section', icon: Icons.LayoutList },
  ]

  return (
    <XStack
      gap="$1"
      padding="$1"
      borderRadius={999}
      borderWidth={1}
      borderColor={ui.borderSubtle}
      backgroundColor={ui.surface}
      alignSelf={isDesktop ? 'flex-start' : 'stretch'}
      width={isDesktop ? undefined : '100%'}
    >
      {tabs.map((tab) => {
        const Icon = tab.icon
        const active = activeTab === tab.id
        return (
          <XStack
            key={tab.id}
            flex={isDesktop ? undefined : 1}
            alignItems="center"
            justifyContent="center"
            gap="$1.5"
            paddingHorizontal="$4"
            paddingVertical="$2.5"
            borderRadius={999}
            cursor="pointer"
            backgroundColor={active ? ui.roseSurface : 'transparent'}
            borderBottomWidth={active ? 2 : 0}
            borderBottomColor={ui.brand}
            onPress={() => onChange(tab.id)}
          >
            <Icon size={14} color={active ? ui.brand : ui.textSecondary} />
            <Text fontSize={13} fontWeight="800" color={active ? ui.brand : ui.textSecondary}>
              {tab.label}
            </Text>
          </XStack>
        )
      })}
    </XStack>
  )
}
