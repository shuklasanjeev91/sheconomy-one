import { Checkbox, Text, XStack, YStack } from '~/components/ui'
import type { ListingFormData } from '~/lib/listing/listing.type'
import type { AppUiTokens } from '~/lib/theme/app-ui'

import {
  ListingPublishCard,
  ListingPublishTip,
} from '~/commerce/components/vendor/listing-publish/ListingPublishCard'
import {
  LISTING_METADATA_KEYS,
  LISTING_PUBLISH_COPY,
} from '~/commerce/components/vendor/listing-publish/listing-publish.constants'
import { readMetadataBoolean } from '~/commerce/components/vendor/listing-publish/listing-publish.utils'
import { ProductStructurePricingPanel } from '~/commerce/components/vendor/listing-publish/steps/ProductStructurePricingPanel'

type PricingStepProps = {
  ui: AppUiTokens
  formData: ListingFormData
  errors: Record<string, string>
  currencySymbol: string
  isDesktop: boolean
  sellerCountryCode?: string | null
  panel?: 'full' | 'type-and-price' | 'variants'
  onUpdate: <K extends keyof ListingFormData>(field: K, value: ListingFormData[K]) => void
  onUpdateMetadata: (key: string, value: unknown) => void
}

export function PricingStep({
  ui,
  formData,
  errors,
  currencySymbol,
  isDesktop,
  sellerCountryCode,
  panel = 'full',
  onUpdate,
  onUpdateMetadata,
}: PricingStepProps) {
  const meta = (formData.listing_metadata ?? {}) as Record<string, unknown>
  const showSidebar = panel !== 'variants'

  return (
    <XStack gap="$4" alignItems="flex-start" flexWrap="wrap">
      <YStack flex={1} minWidth={280} gap="$4">
        <ProductStructurePricingPanel
          ui={ui}
          formData={formData}
          errors={errors}
          currencySymbol={currencySymbol}
          sellerCountryCode={sellerCountryCode}
          panel={panel}
          onUpdate={onUpdate}
          onUpdateMetadata={onUpdateMetadata}
        />
      </YStack>

      {showSidebar ? (
        <YStack width={isDesktop ? 260 : '100%'} maxWidth="100%" gap="$4">
          <ListingPublishCard ui={ui} title="Sales options">
            <XStack alignItems="flex-start" gap="$3">
              <Checkbox
                checked={readMetadataBoolean(meta, LISTING_METADATA_KEYS.ACCEPT_OFFERS, false)}
                onCheckedChange={(checked) =>
                  onUpdateMetadata(LISTING_METADATA_KEYS.ACCEPT_OFFERS, !!checked)
                }
              />
              <YStack flex={1} gap="$0.5">
                <Text fontSize={13} fontWeight="700" color={ui.text}>
                  Accept offers from buyers
                </Text>
                <Text fontSize={12} color={ui.textSecondary}>
                  Allow price negotiation for this product.
                </Text>
              </YStack>
            </XStack>

            <XStack alignItems="flex-start" gap="$3">
              <Checkbox
                checked={readMetadataBoolean(meta, LISTING_METADATA_KEYS.OFFER_BULK_DISCOUNTS, false)}
                onCheckedChange={(checked) =>
                  onUpdateMetadata(LISTING_METADATA_KEYS.OFFER_BULK_DISCOUNTS, !!checked)
                }
              />
              <YStack flex={1} gap="$0.5">
                <Text fontSize={13} fontWeight="700" color={ui.text}>
                  Offer bulk discounts
                </Text>
                <Text fontSize={12} color={ui.textSecondary}>
                  Apply tiered pricing for large orders.
                </Text>
              </YStack>
            </XStack>
          </ListingPublishCard>

          <ListingPublishTip
            ui={ui}
            solid
            title="EXPERT TIP"
            body={LISTING_PUBLISH_COPY.EXPERT_TIP_PRICING}
          />
        </YStack>
      ) : null}
    </XStack>
  )
}
