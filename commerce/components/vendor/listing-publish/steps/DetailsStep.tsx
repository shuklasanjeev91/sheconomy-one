import { useMemo, useState } from 'react'

import { GeoSelectField } from '~/components/geo/GeoSelectField'
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
  TextArea,
  XStack,
  YStack,
} from '~/components/ui'
import { DIGITAL_FILE_TYPES, LISTING_TYPES } from '~/lib/listing/listing.type'
import type { ListingFormData } from '~/lib/listing/listing.type'
import { detectFileTypeFromExtension } from '~/lib/listing/listing.utils'
import type { AppUiTokens } from '~/lib/theme/app-ui'
import {
  countryToOption,
  getAllGeoCountries,
  getCountryName,
  resolveCountryCode,
} from '~/lib/geo'
import {
  parseListingProductInfo,
  type ListingProductInfo,
} from '~/commerce/lib/listing-product-info'

import { ListingPublishCard, ListingPublishFieldError } from '~/commerce/components/vendor/listing-publish/ListingPublishCard'
import { LISTING_METADATA_KEYS } from '~/commerce/components/vendor/listing-publish/listing-publish.constants'
import {
  patchListingProductInfo,
  readMetadataString,
  readProductInfoString,
} from '~/commerce/components/vendor/listing-publish/listing-publish.utils'

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
  const isDigital = formData.listing_type === LISTING_TYPES.DIGITAL
  const productInfo = parseListingProductInfo(formData.product_info)
  const countryOptions = useMemo(() => getAllGeoCountries().map(countryToOption), [])
  const [showPackerImporter, setShowPackerImporter] = useState(
    Boolean(productInfo.packerName || productInfo.packerAddress || productInfo.importerName),
  )

  function updateProductInfo(patch: Partial<ListingProductInfo>) {
    const next = patchListingProductInfo(formData.product_info, patch)
    onUpdate('product_info', next)
    if (patch.countryOfOrigin !== undefined) {
      onUpdateMetadata(LISTING_METADATA_KEYS.COUNTRY_OF_ORIGIN, patch.countryOfOrigin ?? '')
    }
    if (patch.hsnCode !== undefined) {
      onUpdateMetadata(LISTING_METADATA_KEYS.HS_CODE, patch.hsnCode ?? '')
    }
  }

  function updateDigitalUrl(value: string) {
    onUpdate('digital_file_url', value)
    if (!formData.digital_file_type?.trim() && value.trim()) {
      onUpdate('digital_file_type', detectFileTypeFromExtension(value))
    }
  }

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
    <YStack gap="$4" width="100%">
      {isDigital ? (
        <ListingPublishCard ui={ui} title="Digital Delivery">
          <Field label="Download URL" error={errors.digital_file_url}>
            <Input
              width="100%"
              value={formData.digital_file_url ?? ''}
              onChangeText={updateDigitalUrl}
              placeholder="https://drive.example.com/my-pattern.pdf"
              autoCapitalize="none"
              keyboardType="url"
              invalid={!!errors.digital_file_url}
            />
          </Field>
          <Text fontSize={11} color={ui.textMuted}>
            Buyers receive this link once their payment is confirmed.
          </Text>
          <ListingPublishFieldError ui={ui} message={errors.digital_file_url} />

          <XStack gap="$3" flexWrap="wrap">
            <Field label="File Type" flex={1} minWidth={160} error={errors.digital_file_type}>
              <Select
                value={formData.digital_file_type ?? ''}
                onValueChange={(value) => onUpdate('digital_file_type', value)}
              >
                <SelectTrigger
                  width="100%"
                  iconAfter={<Icons.ChevronDown size={14} color={ui.textMuted} />}
                >
                  <Select.Value placeholder="Select a file type" />
                </SelectTrigger>
                <SelectContent zIndex={300000}>
                  <SelectViewport>
                    {DIGITAL_FILE_TYPES.map((fileType, index) => (
                      <SelectItem key={fileType.value} index={index} value={fileType.value}>
                        <Select.ItemText>{fileType.label}</Select.ItemText>
                      </SelectItem>
                    ))}
                  </SelectViewport>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Download Limit (Optional)" flex={1} minWidth={160}>
              <Input
                value={formData.download_limit != null ? String(formData.download_limit) : ''}
                onChangeText={(value) => onUpdate('download_limit', value === '' ? null : value)}
                placeholder="Unlimited"
                keyboardType="numeric"
              />
            </Field>
          </XStack>
          <ListingPublishFieldError ui={ui} message={errors.digital_file_type} />
        </ListingPublishCard>
      ) : null}

      {isDigital ? null : (
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
                <Field label="NAME" flex={2} minWidth={140}>
                  <Input
                    value={material.material_name ?? ''}
                    onChangeText={(value) => updateMaterial(index, { material_name: value })}
                  />
                </Field>
                <Field label="PERCENTAGE" flex={1} minWidth={96}>
                  <Input
                    value={material.percentage != null ? String(material.percentage) : ''}
                    onChangeText={(value) => updateMaterial(index, { percentage: value })}
                    keyboardType="numeric"
                  />
                </Field>
                <Field label="CERTIFICATION" flex={2} minWidth={140}>
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
      )}

      {isDigital ? null : (
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
              <XStack
                key={`variation-${index}`}
                gap="$2"
                alignItems="flex-end"
                flexWrap="wrap"
                padding="$3"
                borderRadius={12}
                backgroundColor={ui.surfaceMuted}
              >
                <Field label="Type" flex={1} minWidth={130}>
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
                <Field label="Value" flex={2} minWidth={140}>
                  <Input
                    value={variation.variation_value ?? ''}
                    onChangeText={(value) => updateVariation(index, { variation_value: value })}
                  />
                </Field>
                <Field label="Price Adj." flex={1} minWidth={100}>
                  <Input
                    value={String(variation.price_adjustment ?? 0)}
                    onChangeText={(value) => updateVariation(index, { price_adjustment: value })}
                    keyboardType="numeric"
                  />
                </Field>
                <Field label="Stock" flex={1} minWidth={90}>
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
      )}

      {isDigital ? null : (
        <ListingPublishCard ui={ui} title="Product information">
          <Text fontSize={12} color={ui.textMuted} lineHeight={18}>
            Shown on the product page under Product details. Manufacturer and country of origin are
            required for physical products.
          </Text>

          <XStack gap="$3" flexWrap="wrap">
            <Field label="Brand" flex={1} minWidth={160}>
              <Input
                value={readProductInfoString(formData.product_info, 'brand')}
                onChangeText={(value) => updateProductInfo({ brand: value })}
                placeholder="Your brand name"
              />
            </Field>
            <Field label="Generic name" flex={1} minWidth={160}>
              <Input
                value={readProductInfoString(formData.product_info, 'generic_name')}
                onChangeText={(value) => updateProductInfo({ genericName: value })}
                placeholder="e.g. Handwoven cotton stole"
              />
            </Field>
          </XStack>

          <Field label="Manufacturer name" required error={errors.manufacturer_name}>
            <Input
              value={readProductInfoString(formData.product_info, 'manufacturer_name')}
              onChangeText={(value) => updateProductInfo({ manufacturerName: value })}
              placeholder="Legal manufacturer / maker name"
              invalid={!!errors.manufacturer_name}
            />
          </Field>
          <ListingPublishFieldError ui={ui} message={errors.manufacturer_name} />

          <Field label="Manufacturer address">
            <TextArea
              minHeight={72}
              value={readProductInfoString(formData.product_info, 'manufacturer_address')}
              onChangeText={(value) => updateProductInfo({ manufacturerAddress: value })}
              placeholder="Full manufacturing address"
            />
          </Field>

          <GeoSelectField
            label="Country of origin"
            value={resolveCountryCode(
              productInfo.countryOfOrigin ||
                readMetadataString(meta, LISTING_METADATA_KEYS.COUNTRY_OF_ORIGIN),
            )}
            displayValue={
              productInfo.countryOfOrigin ||
              getCountryName(
                resolveCountryCode(readMetadataString(meta, LISTING_METADATA_KEYS.COUNTRY_OF_ORIGIN)),
              ) ||
              undefined
            }
            placeholder="Select country"
            options={countryOptions}
            onChange={(code, option) => {
              updateProductInfo({ countryOfOrigin: option.label || getCountryName(code) || code })
            }}
            sheetTitle="Select country of origin"
            searchPlaceholder="Search countries"
            showFlags
            required
          />
          <ListingPublishFieldError ui={ui} message={errors.country_of_origin} />

          <XStack gap="$3" flexWrap="wrap">
            <Field label="Manufactured on" flex={1} minWidth={160} error={errors.manufacturing_date}>
              <Input
                value={readProductInfoString(formData.product_info, 'manufacturing_date')}
                onChangeText={(value) => updateProductInfo({ manufacturingDate: value })}
                placeholder="YYYY-MM-DD"
              />
            </Field>
            <Field label="Best before / Expiry" flex={1} minWidth={160} error={errors.expiry_date}>
              <Input
                value={readProductInfoString(formData.product_info, 'expiry_date')}
                onChangeText={(value) => updateProductInfo({ expiryDate: value })}
                placeholder="YYYY-MM-DD"
                invalid={!!errors.expiry_date}
              />
            </Field>
          </XStack>
          <ListingPublishFieldError ui={ui} message={errors.expiry_date} />

          <XStack gap="$3" flexWrap="wrap">
            <Field label="Shelf life" flex={1} minWidth={140}>
              <Input
                value={readProductInfoString(formData.product_info, 'shelf_life')}
                onChangeText={(value) => updateProductInfo({ shelfLife: value })}
                placeholder="e.g. 12 months from manufacture"
              />
            </Field>
            <Field label="Net quantity" flex={1} minWidth={140}>
              <Input
                value={readProductInfoString(formData.product_info, 'net_quantity')}
                onChangeText={(value) => updateProductInfo({ netQuantity: value })}
                placeholder="e.g. 1 piece, 250 g"
              />
            </Field>
            <Field label="HSN code" flex={1} minWidth={120}>
              <Input
                value={
                  readProductInfoString(formData.product_info, 'hsn_code') ||
                  readMetadataString(meta, LISTING_METADATA_KEYS.HS_CODE)
                }
                onChangeText={(value) => updateProductInfo({ hsnCode: value })}
                placeholder="e.g. 6911"
                keyboardType="numeric"
              />
            </Field>
          </XStack>

          <XStack gap="$3" flexWrap="wrap">
            <Field label="Model / item no." flex={1} minWidth={140}>
              <Input
                value={readProductInfoString(formData.product_info, 'model_number')}
                onChangeText={(value) => updateProductInfo({ modelNumber: value })}
                placeholder="Optional style code"
              />
            </Field>
            <Field label="Warranty" flex={1} minWidth={140}>
              <Input
                value={readProductInfoString(formData.product_info, 'warranty')}
                onChangeText={(value) => updateProductInfo({ warranty: value })}
                placeholder="e.g. 6 months against defects"
              />
            </Field>
          </XStack>

          <Field label="Material / composition">
            <Input
              value={readProductInfoString(formData.product_info, 'material_composition')}
              onChangeText={(value) => updateProductInfo({ materialComposition: value })}
              placeholder="e.g. 100% cotton, ceramic, brass"
            />
          </Field>
          <Field label="Care instructions">
            <TextArea
              minHeight={72}
              value={readProductInfoString(formData.product_info, 'care_instructions')}
              onChangeText={(value) => updateProductInfo({ careInstructions: value })}
              placeholder="Wash, storage, and handling notes"
            />
          </Field>

          <Text
            fontSize={12}
            fontWeight="700"
            color={ui.brand}
            cursor="pointer"
            onPress={() => setShowPackerImporter((open) => !open)}
          >
            {showPackerImporter ? 'Hide packer / importer' : '+ Packer / importer (optional)'}
          </Text>
          {showPackerImporter ? (
            <YStack gap="$3">
              <Field label="Packer name">
                <Input
                  value={readProductInfoString(formData.product_info, 'packer_name')}
                  onChangeText={(value) => updateProductInfo({ packerName: value })}
                />
              </Field>
              <Field label="Packer address">
                <TextArea
                  minHeight={64}
                  value={readProductInfoString(formData.product_info, 'packer_address')}
                  onChangeText={(value) => updateProductInfo({ packerAddress: value })}
                />
              </Field>
              <Field label="Importer name">
                <Input
                  value={readProductInfoString(formData.product_info, 'importer_name')}
                  onChangeText={(value) => updateProductInfo({ importerName: value })}
                />
              </Field>
            </YStack>
          ) : null}
        </ListingPublishCard>
      )}

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
              <XStack
                key={`attr-${index}`}
                gap="$2"
                alignItems="flex-end"
                flexWrap="wrap"
                padding="$3"
                borderRadius={12}
                backgroundColor={ui.surfaceMuted}
              >
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

      {isDigital ? null : (
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
                value={
                  readProductInfoString(formData.product_info, 'hsn_code') ||
                  readMetadataString(meta, LISTING_METADATA_KEYS.HS_CODE)
                }
                onChangeText={(value) => updateProductInfo({ hsnCode: value })}
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
      )}

      {isDigital ? null : (
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
      )}
    </YStack>
  )
}
