import {
  Field,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectViewport,
  Switch,
  Text,
  Input,
  Icons,
  XStack,
  YStack,
} from '~/components/ui'
import { LISTING_TYPES } from '~/lib/listing/listing.type'
import type { ListingFormData } from '~/lib/listing/listing.type'
import {
  EMPTY_PRODUCT_IDENTIFIER,
  GTIN_EXEMPTION_REASONS,
  ITEM_CONDITIONS,
  PRODUCT_ID_TYPES,
  type ProductIdType,
} from '~/lib/listing/product-catalog'
import type { AppUiTokens } from '~/lib/theme/app-ui'

import {
  ListingPublishCard,
  ListingPublishFieldError,
} from '~/commerce/components/vendor/listing-publish/ListingPublishCard'

type ProductTypeOption = {
  id: string
  name: string
  family: string
  category_id: string | null
}

type IdentityStepProps = {
  ui: AppUiTokens
  formData: ListingFormData
  errors: Record<string, string>
  productTypes: ProductTypeOption[]
  onUpdate: <K extends keyof ListingFormData>(field: K, value: ListingFormData[K]) => void
}

export function IdentityStep({ ui, formData, errors, productTypes, onUpdate }: IdentityStepProps) {
  const isDigital = formData.listing_type === LISTING_TYPES.DIGITAL
  const identifier = formData.product_identifier ?? EMPTY_PRODUCT_IDENTIFIER
  const exempt = Boolean(identifier.gtin_exemption)

  function patchIdentifier(patch: Partial<typeof identifier>) {
    onUpdate('product_identifier', { ...identifier, ...patch })
  }

  return (
    <YStack gap="$4" width="100%">
      <ListingPublishCard ui={ui} title="Product type">
        <Field label="Product type" error={errors.product_type_id}>
          <Select
            value={formData.product_type_id || undefined}
            onValueChange={(value) => onUpdate('product_type_id', value || null)}
          >
            <SelectTrigger width="100%" iconAfter={<Icons.ChevronDown size={14} color={ui.textMuted} />}>
              <Select.Value placeholder="Choose a product type" />
            </SelectTrigger>
            <SelectContent zIndex={300000}>
              <SelectViewport>
                {productTypes.map((type, index) => (
                  <SelectItem key={type.id} index={index} value={type.id}>
                    <Select.ItemText>{type.name}</Select.ItemText>
                  </SelectItem>
                ))}
              </SelectViewport>
            </SelectContent>
          </Select>
        </Field>
        <ListingPublishFieldError ui={ui} message={errors.product_type_id} />
        <Text fontSize={12} color={ui.textMuted} lineHeight={18}>
          Required attributes and compliance documents follow the product type. Browse categories
          can suggest one, and you can change it here.
        </Text>
      </ListingPublishCard>

      {isDigital ? (
        <ListingPublishCard ui={ui} title="Product ID">
          <Text fontSize={13} color={ui.textSecondary} lineHeight={20}>
            Digital products do not need a barcode or GTIN exemption.
          </Text>
        </ListingPublishCard>
      ) : (
        <>
          <ListingPublishCard ui={ui} title="Condition">
            <Field label="Item condition" error={errors.item_condition}>
              <Select
                value={formData.item_condition ?? 'new'}
                onValueChange={(value) => onUpdate('item_condition', value)}
              >
                <SelectTrigger width="100%" iconAfter={<Icons.ChevronDown size={14} color={ui.textMuted} />}>
                  <Select.Value placeholder="Condition" />
                </SelectTrigger>
                <SelectContent zIndex={300000}>
                  <SelectViewport>
                    {ITEM_CONDITIONS.map((condition, index) => (
                      <SelectItem key={condition.value} index={index} value={condition.value}>
                        <Select.ItemText>{condition.label}</Select.ItemText>
                      </SelectItem>
                    ))}
                  </SelectViewport>
                </SelectContent>
              </Select>
            </Field>
            <ListingPublishFieldError ui={ui} message={errors.item_condition} />
          </ListingPublishCard>

          <ListingPublishCard ui={ui} title="Product ID">
            <XStack alignItems="center" justifyContent="space-between" gap="$3">
              <YStack flex={1} gap="$1">
                <Text fontSize={14} fontWeight="700" color={ui.text}>
                  GTIN exemption
                </Text>
                <Text fontSize={12} color={ui.textMuted} lineHeight={18}>
                  Use this for handmade goods, private label, bundles, or parts without a barcode.
                </Text>
              </YStack>
              <Switch
                checked={exempt}
                onCheckedChange={(checked) =>
                  patchIdentifier({
                    gtin_exemption: Boolean(checked),
                    product_id_type: checked ? 'none' : identifier.product_id_type,
                    product_id_value: checked ? '' : identifier.product_id_value,
                  })
                }
              />
            </XStack>

            {exempt ? (
              <Field label="Exemption reason" error={errors.gtin_exemption_reason}>
                <Select
                  value={identifier.gtin_exemption_reason || undefined}
                  onValueChange={(value) => patchIdentifier({ gtin_exemption_reason: value })}
                >
                  <SelectTrigger width="100%" iconAfter={<Icons.ChevronDown size={14} color={ui.textMuted} />}>
                    <Select.Value placeholder="Why is there no barcode?" />
                  </SelectTrigger>
                  <SelectContent zIndex={300000}>
                    <SelectViewport>
                      {GTIN_EXEMPTION_REASONS.map((reason, index) => (
                        <SelectItem key={reason.value} index={index} value={reason.value}>
                          <Select.ItemText>{reason.label}</Select.ItemText>
                        </SelectItem>
                      ))}
                    </SelectViewport>
                  </SelectContent>
                </Select>
              </Field>
            ) : (
              <YStack gap="$3">
                <Field label="ID type">
                  <Select
                    value={identifier.product_id_type === 'none' ? 'ean' : identifier.product_id_type}
                    onValueChange={(value) =>
                      patchIdentifier({ product_id_type: value as ProductIdType })
                    }
                  >
                    <SelectTrigger width="100%" iconAfter={<Icons.ChevronDown size={14} color={ui.textMuted} />}>
                      <Select.Value placeholder="UPC, EAN, GTIN, or ISBN" />
                    </SelectTrigger>
                    <SelectContent zIndex={300000}>
                      <SelectViewport>
                        {PRODUCT_ID_TYPES.filter((type) => type.value !== 'none').map((type, index) => (
                          <SelectItem key={type.value} index={index} value={type.value}>
                            <Select.ItemText>{type.label}</Select.ItemText>
                          </SelectItem>
                        ))}
                      </SelectViewport>
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Product ID" error={errors.product_id_value}>
                  <Input
                    value={identifier.product_id_value ?? ''}
                    onChangeText={(value) => patchIdentifier({ product_id_value: value })}
                    placeholder="Digits from the barcode"
                    keyboardType="numeric"
                    invalid={!!errors.product_id_value}
                  />
                </Field>
              </YStack>
            )}
            <ListingPublishFieldError ui={ui} message={errors.gtin_exemption_reason || errors.product_id_value} />
          </ListingPublishCard>
        </>
      )}
    </YStack>
  )
}
