import {
  Checkbox,
  Field,
  Icons,
  Input,
  Text,
  TextArea,
  XStack,
  YStack,
} from '~/components/ui'
import type { ListingFormData } from '~/lib/listing/listing.type'
import type { AppUiTokens } from '~/lib/theme/app-ui'

import { ListingPublishCard, ListingPublishFieldError, ListingPublishTip } from '~/commerce/components/vendor/listing-publish/ListingPublishCard'
import { LISTING_METADATA_KEYS, LISTING_PUBLISH_COPY } from '~/commerce/components/vendor/listing-publish/listing-publish.constants'
import { readMetadataBoolean, readMetadataString } from '~/commerce/components/vendor/listing-publish/listing-publish.utils'

type PricingStepProps = {
  ui: AppUiTokens
  formData: ListingFormData
  errors: Record<string, string>
  currencySymbol: string
  isDesktop: boolean
  onUpdate: <K extends keyof ListingFormData>(field: K, value: ListingFormData[K]) => void
  onUpdateMetadata: (key: string, value: unknown) => void
}

export function PricingStep({
  ui,
  formData,
  errors,
  currencySymbol,
  isDesktop,
  onUpdate,
  onUpdateMetadata,
}: PricingStepProps) {
  const meta = (formData.listing_metadata ?? {}) as Record<string, unknown>

  return (
    <XStack gap="$4" alignItems="flex-start" flexWrap="wrap">
      <YStack flex={1} minWidth={280} gap="$4">
        <ListingPublishCard ui={ui} title="Core Pricing">
          <Field label={`Price (${currencySymbol})`} error={errors.price}>
            <XStack alignItems="center" gap="$2">
              <Text fontSize={16} fontWeight="700" color={ui.textMuted}>
                {currencySymbol}
              </Text>
              <Input
                flex={1}
                value={String(formData.price ?? '')}
                onChangeText={(value) => onUpdate('price', value)}
                placeholder="0.00"
                keyboardType="decimal-pad"
                invalid={!!errors.price}
              />
            </XStack>
          </Field>
          <Text fontSize={11} color={ui.textMuted}>
            Customer will see total after taxes.
          </Text>
          <ListingPublishFieldError ui={ui} message={errors.price} />

          <Field label="Quantity Available">
            <Input
              value={formData.quantity != null ? String(formData.quantity) : ''}
              onChangeText={(value) => onUpdate('quantity', value)}
              placeholder="e.g. 50"
              keyboardType="numeric"
            />
          </Field>

          <Field label="Pricing Notes">
            <TextArea
              minHeight={100}
              value={readMetadataString(meta, LISTING_METADATA_KEYS.PRICING_NOTES)}
              onChangeText={(value) => onUpdateMetadata(LISTING_METADATA_KEYS.PRICING_NOTES, value)}
              placeholder="Mention any seasonal pricing logic or special conditions..."
            />
          </Field>
        </ListingPublishCard>

        <ListingPublishCard ui={ui} title="Advanced Settings">
          <Field label="Minimum Order Quantity">
            <Input
              value={readMetadataString(meta, LISTING_METADATA_KEYS.MIN_ORDER_QUANTITY, '1')}
              onChangeText={(value) => onUpdateMetadata(LISTING_METADATA_KEYS.MIN_ORDER_QUANTITY, value)}
              keyboardType="numeric"
            />
          </Field>
          <Field label="Low Stock Threshold">
            <XStack alignItems="center" gap="$2">
              <Input
                flex={1}
                value={readMetadataString(meta, LISTING_METADATA_KEYS.LOW_STOCK_THRESHOLD, '5')}
                onChangeText={(value) => onUpdateMetadata(LISTING_METADATA_KEYS.LOW_STOCK_THRESHOLD, value)}
                keyboardType="numeric"
              />
              <Icons.Bell size={16} color={ui.brand} />
            </XStack>
          </Field>
          <Text fontSize={11} color={ui.textMuted}>
            We&apos;ll alert you when stock hits this level.
          </Text>
        </ListingPublishCard>
      </YStack>

      <YStack width={isDesktop ? 300 : '100%'} maxWidth="100%" gap="$4">
        <ListingPublishCard ui={ui} title="Sales Options">
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
    </XStack>
  )
}
