import { useMemo, useState } from 'react'
import { Platform } from 'react-native'

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
import {
  buildChildSkuMetadata,
  cartesianAxes,
  childSkuLabels,
  childSkuTempKey,
  parseVariationAxes,
  withVariationAxes,
  type VariationAxis,
} from '~/commerce/lib/listing-variant-skus'
import type { ListingImageDraft, ListingVariationInsert } from '~/lib/listing/listing.type'

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

const AXIS_PRESETS = ['Color', 'Size', 'Material', 'Style'] as const

export function DetailsStep({ ui, formData, errors, onUpdate, onUpdateMetadata }: DetailsStepProps) {
  const meta = (formData.listing_metadata ?? {}) as Record<string, unknown>
  const materials = formData.materials ?? []
  const variations = formData.variations ?? []
  const attributes = formData.attributes ?? []
  const images = formData.images ?? []
  const isDigital = formData.listing_type === LISTING_TYPES.DIGITAL
  const productInfo = parseListingProductInfo(formData.product_info)
  const countryOptions = useMemo(() => getAllGeoCountries().map(countryToOption), [])
  const [showPackerImporter, setShowPackerImporter] = useState(
    Boolean(productInfo.packerName || productInfo.packerAddress || productInfo.importerName),
  )
  const [axes, setAxes] = useState<VariationAxis[]>(() => {
    const fromMeta = parseVariationAxes(formData.listing_metadata)
    if (fromMeta.length) return fromMeta
    return [{ name: 'Color', values: [] }]
  })
  const [axisValueDraft, setAxisValueDraft] = useState<Record<number, string>>({})
  const [variantError, setVariantError] = useState<string | null>(null)

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

  function persistAxes(nextAxes: VariationAxis[]) {
    setAxes(nextAxes)
    const nextMeta = withVariationAxes(
      (formData.listing_metadata ?? {}) as Record<string, unknown>,
      nextAxes,
    )
    onUpdate('listing_metadata', nextMeta as ListingFormData['listing_metadata'])
  }

  function addAxis() {
    const unused = AXIS_PRESETS.find((name) => !axes.some((axis) => axis.name === name))
    persistAxes([...axes, { name: unused ?? `Option ${axes.length + 1}`, values: [] }])
  }

  function updateAxis(index: number, patch: Partial<VariationAxis>) {
    persistAxes(axes.map((axis, i) => (i === index ? { ...axis, ...patch } : axis)))
  }

  function removeAxis(index: number) {
    persistAxes(axes.filter((_, i) => i !== index))
  }

  function addAxisValue(index: number) {
    const raw = (axisValueDraft[index] ?? '').trim()
    if (!raw) return
    const axis = axes[index]
    if (!axis) return
    if (axis.values.includes(raw)) {
      setAxisValueDraft((current) => ({ ...current, [index]: '' }))
      return
    }
    updateAxis(index, { values: [...axis.values, raw] })
    setAxisValueDraft((current) => ({ ...current, [index]: '' }))
  }

  function generateChildSkus() {
    const { combinations, error } = cartesianAxes(axes)
    setVariantError(error)
    if (!combinations.length) {
      setVariantError(error ?? 'Add at least one axis with values, then generate SKUs.')
      return
    }

    const basePrice = Number(formData.price) || 0
    const baseMrp = Number(formData.mrp) || null
    const baseTax = Number(formData.tax_percent) || null
    const baseIncludes = Boolean(formData.price_includes_tax)
    const baseHsn = productInfo.hsnCode ?? ''
    const existingByKey = new Map(
      variations.map((row) => {
        const meta = row.variation_metadata as { tempKey?: string; options?: Record<string, string> } | null
        const key =
          meta?.tempKey ??
          (meta?.options ? childSkuTempKey(meta.options) : `${row.variation_name}|${row.variation_value}`)
        return [key, row] as const
      }),
    )

    const next: Partial<ListingVariationInsert>[] = combinations.map((options, index) => {
      const tempKey = childSkuTempKey(options)
      const labels = childSkuLabels(options)
      const prev = existingByKey.get(tempKey)
      return {
        ...(prev ?? {}),
        variation_name: labels.variation_name,
        variation_value: labels.variation_value,
        price: prev?.price ?? basePrice,
        mrp: prev?.mrp ?? baseMrp,
        tax_percent: prev?.tax_percent ?? baseTax,
        price_includes_tax:
          typeof prev?.price_includes_tax === 'boolean' ? prev.price_includes_tax : baseIncludes,
        hsn_code: prev?.hsn_code ?? baseHsn,
        weight: prev?.weight ?? formData.weight ?? null,
        stock: prev?.stock ?? 0,
        sku: prev?.sku ?? '',
        display_order: index,
        is_available: prev?.is_available !== false,
        variation_metadata: buildChildSkuMetadata(options, tempKey) as never,
      }
    })

    onUpdate('variations', next)
    const stockSum = next.reduce((sum, row) => sum + (Number(row.stock) || 0), 0)
    onUpdate('stock', stockSum)
    onUpdate('quantity', stockSum)
    persistAxes(axes)
  }

  function updateVariation(index: number, patch: Record<string, unknown>) {
    const next = variations.map((row, i) => (i === index ? { ...row, ...patch } : row))
    onUpdate('variations', next)
    if ('stock' in patch) {
      const stockSum = next.reduce((sum, row) => sum + (Number(row.stock) || 0), 0)
      onUpdate('stock', stockSum)
      onUpdate('quantity', stockSum)
    }
  }

  function removeVariation(index: number) {
    const removed = variations[index]
    const meta = removed?.variation_metadata as { tempKey?: string } | null
    const tempKey = meta?.tempKey
    onUpdate(
      'variations',
      variations.filter((_, i) => i !== index),
    )
    if (tempKey) {
      onUpdate(
        'images',
        images.filter((img) => img.variant_temp_key !== tempKey),
      )
    }
  }

  function addVariantImages(tempKey: string, files: FileList | null) {
    if (!files?.length) return
    const drafts: ListingImageDraft[] = Array.from(files).map((file, index) => ({
      blob: file,
      mimeType: file.type || 'image/jpeg',
      fileName: file.name,
      display_order: images.length + index,
      is_primary: false,
      variant_temp_key: tempKey,
    }))
    onUpdate('images', [...images, ...drafts])
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
          title="Variant SKUs"
          headerRight={
            <XStack gap="$3" alignItems="center">
              <Text fontSize={12} fontWeight="700" color={ui.brand} cursor="pointer" onPress={addAxis}>
                + Axis
              </Text>
              <Text fontSize={12} fontWeight="700" color={ui.brand} cursor="pointer" onPress={generateChildSkus}>
                Generate SKUs
              </Text>
            </XStack>
          }
        >
          <Text fontSize={12} color={ui.textMuted} lineHeight={18}>
            Define options (Color, Size, …), generate combinations, then set price, tax, HSN, stock, and
            images per child SKU — like Amazon parent/child listings.
          </Text>
          <ListingPublishFieldError ui={ui} message={errors.variations || variantError || undefined} />

          <YStack gap="$3">
            {axes.map((axis, axisIndex) => (
              <YStack
                key={`axis-${axisIndex}`}
                gap="$2"
                padding="$3"
                borderRadius={12}
                backgroundColor={ui.surfaceMuted}
              >
                <XStack gap="$2" alignItems="flex-end" flexWrap="wrap">
                  <Field label="Option name" flex={1} minWidth={140}>
                    <Select
                      value={axis.name}
                      onValueChange={(value) => updateAxis(axisIndex, { name: value })}
                    >
                      <SelectTrigger width="100%" iconAfter={<Icons.ChevronDown size={14} color={ui.textMuted} />}>
                        <Select.Value placeholder="Option" />
                      </SelectTrigger>
                      <SelectContent zIndex={300000}>
                        <SelectViewport>
                          {AXIS_PRESETS.map((type, typeIndex) => (
                            <SelectItem key={type} index={typeIndex} value={type}>
                              <Select.ItemText>{type}</Select.ItemText>
                            </SelectItem>
                          ))}
                        </SelectViewport>
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label="Add value" flex={2} minWidth={160}>
                    <Input
                      value={axisValueDraft[axisIndex] ?? ''}
                      onChangeText={(value) =>
                        setAxisValueDraft((current) => ({ ...current, [axisIndex]: value }))
                      }
                      onSubmitEditing={() => addAxisValue(axisIndex)}
                      placeholder="e.g. Red"
                    />
                  </Field>
                  <Button tone="outline" size="$3" onPress={() => addAxisValue(axisIndex)}>
                    Add
                  </Button>
                  <Button
                    tone="ghost"
                    size="$2"
                    icon={<Icons.Trash2 size={14} />}
                    onPress={() => removeAxis(axisIndex)}
                  />
                </XStack>
                <XStack gap="$2" flexWrap="wrap">
                  {axis.values.map((value) => (
                    <XStack
                      key={`${axis.name}-${value}`}
                      paddingHorizontal="$2.5"
                      paddingVertical={4}
                      borderRadius={999}
                      backgroundColor={ui.surface}
                      borderWidth={1}
                      borderColor={ui.borderSubtle}
                      alignItems="center"
                      gap="$1.5"
                    >
                      <Text fontSize={12} fontWeight="600" color={ui.text}>
                        {value}
                      </Text>
                      <Text
                        fontSize={12}
                        color={ui.textMuted}
                        cursor="pointer"
                        onPress={() =>
                          updateAxis(axisIndex, {
                            values: axis.values.filter((entry) => entry !== value),
                          })
                        }
                      >
                        ×
                      </Text>
                    </XStack>
                  ))}
                </XStack>
              </YStack>
            ))}
          </YStack>

          <YStack gap="$3" marginTop="$2">
            {variations.map((variation, index) => {
              const meta = variation.variation_metadata as {
                tempKey?: string
                options?: Record<string, string>
              } | null
              const tempKey = meta?.tempKey ?? childSkuTempKey(meta?.options ?? {})
              const childImages = images.filter((img) => img.variant_temp_key === tempKey)
              return (
                <YStack
                  key={tempKey || `variation-${index}`}
                  gap="$2.5"
                  padding="$3"
                  borderRadius={12}
                  borderWidth={1}
                  borderColor={ui.borderSubtle}
                  backgroundColor={ui.surface}
                >
                  <XStack justifyContent="space-between" alignItems="center" gap="$2">
                    <YStack flex={1} minWidth={0} gap={2}>
                      <Text fontSize={14} fontWeight="800" color={ui.text}>
                        {variation.variation_value || 'Child SKU'}
                      </Text>
                      <Text fontSize={11.5} color={ui.textMuted}>
                        {variation.variation_name}
                      </Text>
                    </YStack>
                    <Button
                      tone="ghost"
                      size="$2"
                      icon={<Icons.X size={14} />}
                      onPress={() => removeVariation(index)}
                    />
                  </XStack>

                  <XStack gap="$2" flexWrap="wrap">
                    <Field label="Price" flex={1} minWidth={110}>
                      <Input
                        value={String(variation.price ?? formData.price ?? 0)}
                        onChangeText={(value) => updateVariation(index, { price: value })}
                        keyboardType="numeric"
                      />
                    </Field>
                    <Field label="MRP" flex={1} minWidth={110}>
                      <Input
                        value={String(variation.mrp ?? '')}
                        onChangeText={(value) => updateVariation(index, { mrp: value })}
                        keyboardType="numeric"
                      />
                    </Field>
                    <Field label="Tax %" flex={1} minWidth={90}>
                      <Input
                        value={String(variation.tax_percent ?? formData.tax_percent ?? '')}
                        onChangeText={(value) => updateVariation(index, { tax_percent: value })}
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
                  </XStack>

                  <XStack gap="$2" flexWrap="wrap" alignItems="center">
                    <Field label="SKU" flex={1} minWidth={140}>
                      <Input
                        value={variation.sku ?? ''}
                        onChangeText={(value) => updateVariation(index, { sku: value })}
                        placeholder="Child SKU"
                      />
                    </Field>
                    <Field label="HSN" flex={1} minWidth={120}>
                      <Input
                        value={variation.hsn_code ?? ''}
                        onChangeText={(value) => updateVariation(index, { hsn_code: value })}
                        placeholder="HSN / SAC"
                      />
                    </Field>
                    <Field label="Weight (kg)" flex={1} minWidth={110}>
                      <Input
                        value={String(variation.weight ?? '')}
                        onChangeText={(value) => updateVariation(index, { weight: value })}
                        keyboardType="numeric"
                      />
                    </Field>
                    <XStack alignItems="center" gap="$2" paddingTop="$4">
                      <Switch
                        checked={Boolean(
                          variation.price_includes_tax ?? formData.price_includes_tax,
                        )}
                        onCheckedChange={(checked) =>
                          updateVariation(index, { price_includes_tax: checked })
                        }
                      />
                      <Text fontSize={12} color={ui.textSecondary}>
                        Price includes tax
                      </Text>
                    </XStack>
                  </XStack>

                  <YStack gap="$1.5">
                    <Text fontSize={12} fontWeight="700" color={ui.textMuted}>
                      Variant images ({childImages.length})
                    </Text>
                    {Platform.OS === 'web' ? (
                      // eslint-disable-next-line react/forbid-elements -- web-only gallery picker
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={(event) => {
                          addVariantImages(tempKey, (event.target as HTMLInputElement).files)
                          ;(event.target as HTMLInputElement).value = ''
                        }}
                      />
                    ) : (
                      <Text fontSize={12} color={ui.textMuted}>
                        Add variant images from web publish for now.
                      </Text>
                    )}
                  </YStack>
                </YStack>
              )
            })}
          </YStack>
        </ListingPublishCard>
      )}

      {isDigital ? null : (
        <ListingPublishCard ui={ui} title="Product information">
          <Text fontSize={12} color={ui.textMuted} lineHeight={18}>
            Product details: brand, manufacturer, country of origin, and key features
            are required before publish. Shown on the product page under Product details.
          </Text>

          <XStack gap="$3" flexWrap="wrap">
            <Field label="Brand" required flex={1} minWidth={160} error={errors.brand}>
              <Input
                value={readProductInfoString(formData.product_info, 'brand')}
                onChangeText={(value) => updateProductInfo({ brand: value })}
                placeholder="Your brand name"
                invalid={!!errors.brand}
              />
            </Field>
            <Field label="Generic name" required flex={1} minWidth={160} error={errors.generic_name}>
              <Input
                value={readProductInfoString(formData.product_info, 'generic_name')}
                onChangeText={(value) => updateProductInfo({ genericName: value })}
                placeholder="e.g. Handwoven cotton stole"
                invalid={!!errors.generic_name}
              />
            </Field>
          </XStack>
          <ListingPublishFieldError ui={ui} message={errors.brand || errors.generic_name} />

          <Field label="Key features (one per line)" required error={errors.key_features}>
            <TextArea
              minHeight={110}
              value={readProductInfoString(formData.product_info, 'key_features')}
              onChangeText={(value) => updateProductInfo({ keyFeatures: value })}
              placeholder={
                'Handwoven on a traditional loom\n100% handloom cotton\nNatural vegetable dyes\n'
              }
              invalid={!!errors.key_features}
            />
          </Field>
          <Text fontSize={11} color={ui.textMuted}>
            Add at least 3 bullets. Buyers see these as product highlights.
          </Text>
          <ListingPublishFieldError ui={ui} message={errors.key_features} />

          <Field label="Manufacturer name" required error={errors.manufacturer_name}>
            <Input
              value={readProductInfoString(formData.product_info, 'manufacturer_name')}
              onChangeText={(value) => updateProductInfo({ manufacturerName: value })}
              placeholder="Legal manufacturer / maker name"
              invalid={!!errors.manufacturer_name}
            />
          </Field>
          <ListingPublishFieldError ui={ui} message={errors.manufacturer_name} />

          <Field label="Manufacturer address" required error={errors.manufacturer_address}>
            <TextArea
              minHeight={72}
              value={readProductInfoString(formData.product_info, 'manufacturer_address')}
              onChangeText={(value) => updateProductInfo({ manufacturerAddress: value })}
              placeholder="Full manufacturing address"
              invalid={!!errors.manufacturer_address}
            />
          </Field>
          <ListingPublishFieldError ui={ui} message={errors.manufacturer_address} />

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
