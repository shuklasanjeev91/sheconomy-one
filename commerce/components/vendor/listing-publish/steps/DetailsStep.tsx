import {
  Button,
  Field,
  Icons,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectViewport,
  Switch,
  Text,
  XStack,
  YStack,
} from '~/components/ui'
import type { ListingFormData } from '~/lib/listing/listing.type'
import type { AppUiTokens } from '~/lib/theme/app-ui'

import { ListingPublishCard, ListingPublishFieldError } from '~/commerce/components/vendor/listing-publish/ListingPublishCard'
import { LISTING_METADATA_KEYS } from '~/commerce/components/vendor/listing-publish/listing-publish.constants'
import { readMetadataString } from '~/commerce/components/vendor/listing-publish/listing-publish.utils'

type DetailsStepProps = {
  ui: AppUiTokens
  formData: ListingFormData
  errors: Record<string, string>
  onUpdate: <K extends keyof ListingFormData>(field: K, value: ListingFormData[K]) => void
  onUpdateMetadata: (key: string, value: unknown) => void
}

const VARIATION_TYPES = ['Color', 'Size', 'Material', 'Style'] as const

export function DetailsStep({ ui, formData, errors, onUpdate, onUpdateMetadata }: DetailsStepProps) {
  const meta = (formData.listing_metadata ?? {}) as Record<string, unknown>
  const materials = formData.materials ?? []
  const variations = formData.variations ?? []
  const attributes = formData.attributes ?? []

  function addMaterial() {
    onUpdate('materials', [
      ...materials,
      { material_name: '', percentage: null, certification: '' },
    ])
  }

  function updateMaterial(index: number, patch: Record<string, unknown>) {
    const next = materials.map((row, i) => (i === index ? { ...row, ...patch } : row))
    onUpdate('materials', next)
  }

  function removeMaterial(index: number) {
    onUpdate('materials', materials.filter((_, i) => i !== index))
  }

  function addVariation() {
    onUpdate('variations', [
      ...variations,
      { variation_name: 'Color', variation_value: '', price_adjustment: 0, stock: 0 },
    ])
  }

  function updateVariation(index: number, patch: Record<string, unknown>) {
    const next = variations.map((row, i) => (i === index ? { ...row, ...patch } : row))
    onUpdate('variations', next)
  }

  function removeVariation(index: number) {
    onUpdate('variations', variations.filter((_, i) => i !== index))
  }

  function addAttribute() {
    onUpdate('attributes', [...attributes, { attribute_name: '', attribute_value: '' }])
  }

  function updateAttribute(index: number, patch: Record<string, unknown>) {
    const next = attributes.map((row, i) => (i === index ? { ...row, ...patch } : row))
    onUpdate('attributes', next)
  }

  function removeAttribute(index: number) {
    onUpdate('attributes', attributes.filter((_, i) => i !== index))
  }

  return (
    <YStack gap="$4">
      <ListingPublishCard
        ui={ui}
        title="Materials & Composition"
        headerRight={
          <Text fontSize={12} fontWeight="700" color={ui.brand} cursor="pointer" onPress={addMaterial}>
            + Add Material
          </Text>
        }
      >
        <Text fontSize={11} color={ui.danger} fontWeight="700">
          * Required
        </Text>
        <ListingPublishFieldError ui={ui} message={errors.materials} />
        <YStack gap="$2">
          {materials.map((material, index) => (
            <XStack
              key={`material-${index}`}
              gap="$2"
              alignItems="flex-end"
              flexWrap="wrap"
              padding="$3"
              borderRadius={12}
              backgroundColor={ui.roseSurface}
            >
              <Field label="NAME" flex={1} minWidth={140}>
                <Input
                  value={material.material_name ?? ''}
                  onChangeText={(value) => updateMaterial(index, { material_name: value })}
                />
              </Field>
              <Field label="PERCENTAGE" width={100}>
                <Input
                  value={material.percentage != null ? String(material.percentage) : ''}
                  onChangeText={(value) => updateMaterial(index, { percentage: value })}
                  keyboardType="numeric"
                />
              </Field>
              <Field label="CERTIFICATION" flex={1} minWidth={140}>
                <Input
                  value={material.certification ?? ''}
                  onChangeText={(value) => updateMaterial(index, { certification: value })}
                />
              </Field>
              <Button tone="ghost" size="$2" icon={<Icons.Trash2 size={14} />} onPress={() => removeMaterial(index)} />
            </XStack>
          ))}
        </YStack>
      </ListingPublishCard>

      <ListingPublishCard
        ui={ui}
        title="Product Variations"
        headerRight={
          <Text fontSize={12} fontWeight="700" color={ui.brand} cursor="pointer" onPress={addVariation}>
            + Add Variation
          </Text>
        }
      >
        <ListingPublishFieldError ui={ui} message={errors.variations} />
        <YStack gap="$2">
          {variations.map((variation, index) => (
            <XStack key={`variation-${index}`} gap="$2" alignItems="flex-end" flexWrap="wrap">
              <Field label="Type" width={140}>
                <Select
                  value={variation.variation_name ?? 'Color'}
                  onValueChange={(value) => updateVariation(index, { variation_name: value })}
                >
                  <SelectTrigger width="100%" iconAfter={<Icons.ChevronDown size={14} color={ui.textMuted} />}>
                    <Select.Value placeholder="Type" />
                  </SelectTrigger>
                  <SelectContent zIndex={300000}>
                    <SelectViewport>
                      {VARIATION_TYPES.map((type, typeIndex) => (
                        <SelectItem key={type} index={typeIndex} value={type}>
                          <Select.ItemText>{type}</Select.ItemText>
                        </SelectItem>
                      ))}
                    </SelectViewport>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Value" flex={1} minWidth={120}>
                <Input
                  value={variation.variation_value ?? ''}
                  onChangeText={(value) => updateVariation(index, { variation_value: value })}
                />
              </Field>
              <Field label="Price Adj." width={100}>
                <Input
                  value={String(variation.price_adjustment ?? 0)}
                  onChangeText={(value) => updateVariation(index, { price_adjustment: value })}
                  keyboardType="numeric"
                />
              </Field>
              <Field label="Stock" width={80}>
                <Input
                  value={String(variation.stock ?? 0)}
                  onChangeText={(value) => updateVariation(index, { stock: value })}
                  keyboardType="numeric"
                />
              </Field>
              <Button tone="ghost" size="$2" icon={<Icons.X size={14} />} onPress={() => removeVariation(index)} />
            </XStack>
          ))}
        </YStack>
      </ListingPublishCard>

      <ListingPublishCard
        ui={ui}
        title="Additional Attributes (Optional)"
        headerRight={
          <Text fontSize={12} fontWeight="700" color={ui.brand} cursor="pointer" onPress={addAttribute}>
            + Add Attribute
          </Text>
        }
      >
        {attributes.length === 0 ? (
          <YStack
            padding="$4"
            borderRadius={12}
            borderWidth={1}
            borderStyle="dashed"
            borderColor={ui.borderSubtle}
            alignItems="center"
          >
            <Text fontSize={13} color={ui.textMuted} textAlign="center">
              Define custom properties like Season, Care Instructions, or Designer.
            </Text>
          </YStack>
        ) : (
          <YStack gap="$2">
            {attributes.map((attr, index) => (
              <XStack key={`attr-${index}`} gap="$2" alignItems="flex-end" flexWrap="wrap">
                <Field label="Name" flex={1} minWidth={120}>
                  <Input
                    value={attr.attribute_name ?? ''}
                    onChangeText={(value) => updateAttribute(index, { attribute_name: value })}
                  />
                </Field>
                <Field label="Value" flex={1} minWidth={120}>
                  <Input
                    value={attr.attribute_value ?? ''}
                    onChangeText={(value) => updateAttribute(index, { attribute_value: value })}
                  />
                </Field>
                <Button tone="ghost" size="$2" icon={<Icons.X size={14} />} onPress={() => removeAttribute(index)} />
              </XStack>
            ))}
          </YStack>
        )}
      </ListingPublishCard>

      <ListingPublishCard ui={ui} title="Logistics & Inventory">
        <Field label="SKU (Stock Keeping Unit)">
          <XStack gap="$2" alignItems="center">
            <Input
              flex={1}
              value={formData.sku ?? ''}
              onChangeText={(value) => onUpdate('sku', value)}
              placeholder="Auto-generated if empty"
            />
            <Button
              tone="outline"
              size="$3"
              onPress={() => onUpdate('sku', `SKU-${Date.now().toString(36).toUpperCase()}`)}
            >
              Generate
            </Button>
          </XStack>
        </Field>

        <XStack gap="$3" flexWrap="wrap">
          <Field label="Initial Quantity" flex={1} minWidth={120} error={errors.stock}>
            <Input
              value={String(formData.stock ?? '')}
              onChangeText={(value) => onUpdate('stock', value)}
              keyboardType="numeric"
              invalid={!!errors.stock}
            />
          </Field>
          <Field label="Weight (grams)" flex={1} minWidth={120}>
            <Input
              value={formData.weight != null ? String(formData.weight) : ''}
              onChangeText={(value) => onUpdate('weight', value)}
              keyboardType="numeric"
            />
          </Field>
          <Field label="HS Code" flex={1} minWidth={120}>
            <Input
              value={readMetadataString(meta, LISTING_METADATA_KEYS.HS_CODE)}
              onChangeText={(value) => onUpdateMetadata(LISTING_METADATA_KEYS.HS_CODE, value)}
              keyboardType="numeric"
            />
          </Field>
        </XStack>

        <Field label="Package Dimensions (L × W × H cm)">
          <XStack gap="$2" flexWrap="wrap">
            <Input
              flex={1}
              minWidth={80}
              placeholder="Length"
              value={readMetadataString(meta, LISTING_METADATA_KEYS.PACKAGE_LENGTH_CM)}
              onChangeText={(value) => onUpdateMetadata(LISTING_METADATA_KEYS.PACKAGE_LENGTH_CM, value)}
              keyboardType="numeric"
            />
            <Input
              flex={1}
              minWidth={80}
              placeholder="Width"
              value={readMetadataString(meta, LISTING_METADATA_KEYS.PACKAGE_WIDTH_CM)}
              onChangeText={(value) => onUpdateMetadata(LISTING_METADATA_KEYS.PACKAGE_WIDTH_CM, value)}
              keyboardType="numeric"
            />
            <Input
              flex={1}
              minWidth={80}
              placeholder="Height"
              value={readMetadataString(meta, LISTING_METADATA_KEYS.PACKAGE_HEIGHT_CM)}
              onChangeText={(value) => onUpdateMetadata(LISTING_METADATA_KEYS.PACKAGE_HEIGHT_CM, value)}
              keyboardType="numeric"
            />
          </XStack>
        </Field>

        <ListingPublishFieldError ui={ui} message={errors.stock} />
      </ListingPublishCard>

      <ListingPublishCard ui={ui}>
        <XStack alignItems="center" justifyContent="space-between" gap="$3">
          <YStack flex={1} gap="$1">
            <Text fontSize={14} fontWeight="800" color={ui.text}>
              Physical Product
            </Text>
            <Text fontSize={12} color={ui.textSecondary} lineHeight={18}>
              This item requires physical delivery and will use the calculated shipping rates.
            </Text>
          </YStack>
          <Switch
            checked={formData.shipping_required ?? true}
            onCheckedChange={(checked) => onUpdate('shipping_required', !!checked)}
          />
        </XStack>
      </ListingPublishCard>
    </YStack>
  )
}
