import {
  Button,
  Checkbox,
  Field,
  Icons,
  Input,
  Switch,
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

const GST_PRESETS = ['0', '5', '12', '18', '28'] as const

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
          <Field label={`Selling price (${currencySymbol})`} error={errors.price}>
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
          <ListingPublishFieldError ui={ui} message={errors.price} />

          <Field label={`MRP (${currencySymbol})`} error={errors.mrp}>
            <XStack alignItems="center" gap="$2">
              <Text fontSize={16} fontWeight="700" color={ui.textMuted}>
                {currencySymbol}
              </Text>
              <Input
                flex={1}
                value={formData.mrp != null && formData.mrp !== '' ? String(formData.mrp) : ''}
                onChangeText={(value) => onUpdate('mrp', value)}
                placeholder="Optional — shown struck through when higher"
                keyboardType="decimal-pad"
              />
            </XStack>
          </Field>
          <Text fontSize={11} color={ui.textMuted}>
            Leave blank if MRP equals selling price.
          </Text>

          <XStack alignItems="center" justifyContent="space-between" gap="$3" paddingVertical="$1">
            <YStack flex={1} gap="$0.5">
              <Text fontSize={13} fontWeight="700" color={ui.text}>
                Price inclusive of all taxes
              </Text>
              <Text fontSize={12} color={ui.textSecondary}>
                Shown on the product page under the price.
              </Text>
            </YStack>
            <Switch
              checked={formData.price_includes_tax ?? true}
              onCheckedChange={(checked) => onUpdate('price_includes_tax', !!checked)}
            />
          </XStack>

          <Field label="GST / tax %">
            <XStack gap="$2" flexWrap="wrap" marginBottom="$2">
              {GST_PRESETS.map((preset) => (
                <Button
                  key={preset}
                  tone={String(formData.tax_percent ?? '') === preset ? 'primary' : 'outline'}
                  size="$2"
                  borderRadius={999}
                  onPress={() => onUpdate('tax_percent', preset)}
                >
                  {preset}%
                </Button>
              ))}
            </XStack>
            <Input
              value={formData.tax_percent != null ? String(formData.tax_percent) : ''}
              onChangeText={(value) => onUpdate('tax_percent', value)}
              keyboardType="decimal-pad"
              placeholder="18"
            />
          </Field>

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
          <XStack alignItems="flex-start" gap="$3" paddingTop="$2">
            <Checkbox
              checked={readMetadataBoolean(meta, LISTING_METADATA_KEYS.ALLOW_PREORDER, false)}
              onCheckedChange={(checked) =>
                onUpdateMetadata(LISTING_METADATA_KEYS.ALLOW_PREORDER, !!checked)
              }
            />
            <YStack flex={1} gap="$0.5">
              <Text fontSize={13} fontWeight="700" color={ui.text}>
                Allow pre-orders when out of stock
              </Text>
              <Text fontSize={12} color={ui.textSecondary}>
                Buyers can pay now; you ship after restock.
              </Text>
            </YStack>
          </XStack>
          <Field label="Expected ship date (pre-order)">
            <Input
              value={readMetadataString(meta, LISTING_METADATA_KEYS.EXPECTED_SHIP_AT)}
              onChangeText={(value) => onUpdateMetadata(LISTING_METADATA_KEYS.EXPECTED_SHIP_AT, value)}
              placeholder="YYYY-MM-DD"
            />
          </Field>
          <XStack alignItems="flex-start" gap="$3">
            <Checkbox
              checked={readMetadataBoolean(meta, LISTING_METADATA_KEYS.REPLENISHABLE, false)}
              onCheckedChange={(checked) =>
                onUpdateMetadata(LISTING_METADATA_KEYS.REPLENISHABLE, !!checked)
              }
            />
            <YStack flex={1} gap="$0.5">
              <Text fontSize={13} fontWeight="700" color={ui.text}>
                Replenishable (scheduled reorder)
              </Text>
              <Text fontSize={12} color={ui.textSecondary}>
                Let buyers set a weekly or monthly reorder reminder.
              </Text>
            </YStack>
          </XStack>
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
