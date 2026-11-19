import { useMemo, useState } from 'react'

import {
  Button,
  Checkbox,
  Field,
  Icons,
  Image,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectViewport,
  Spinner,
  Switch,
  Text,
  TextArea,
  XStack,
  YStack,
  useAppToast,
} from '~/components/ui'
import { LISTING_TYPES } from '~/lib/listing/listing.type'
import type { ListingFormData, ListingImageDraft, ListingVariationInsert } from '~/lib/listing/listing.type'
import { pickImagesWithCrop } from '~/lib/media/pick-and-crop'
import type { PickedImage } from '~/lib/media/pick-image'
import type { AppUiTokens } from '~/lib/theme/app-ui'
import { getCountryName, resolveCountryCode } from '~/lib/geo'
import { parseListingProductInfo } from '~/commerce/lib/listing-product-info'
import {
  buildChildSku,
  buildChildSkuMetadata,
  buildParentSkuFromTitle,
  cartesianAxes,
  childSkuLabels,
  childSkuTempKey,
  DEFAULT_TAX_COUNTRY,
  ensureParentSku,
  normalizeCountryCode,
  parseVariationAxes,
  seedTaxByCountry,
  withChildTaxByCountry,
  withVariationAxes,
  type VariationAxis,
} from '~/commerce/lib/listing-variant-skus'

import {
  ListingPublishCard,
  ListingPublishFieldError,
} from '~/commerce/components/vendor/listing-publish/ListingPublishCard'
import {
  LISTING_METADATA_KEYS,
  PRODUCT_STRUCTURE_OPTIONS,
  PRODUCT_STRUCTURES,
  type ProductStructure,
} from '~/commerce/components/vendor/listing-publish/listing-publish.constants'
import {
  readMetadataBoolean,
  readMetadataString,
  readMetadataStringList,
  readProductInfoString,
  resolveProductStructure,
} from '~/commerce/components/vendor/listing-publish/listing-publish.utils'

const AXIS_PRESETS = ['Color', 'Size', 'Material', 'Style'] as const
const GST_PRESETS = ['0', '5', '12', '18', '28'] as const

type ProductStructurePricingPanelProps = {
  ui: AppUiTokens
  formData: ListingFormData
  errors: Record<string, string>
  currencySymbol: string
  sellerCountryCode?: string | null
  onUpdate: <K extends keyof ListingFormData>(field: K, value: ListingFormData[K]) => void
  onUpdateMetadata: (key: string, value: unknown) => void
}

export function ProductStructurePricingPanel({
  ui,
  formData,
  errors,
  currencySymbol,
  sellerCountryCode,
  onUpdate,
  onUpdateMetadata,
}: ProductStructurePricingPanelProps) {
  const toast = useAppToast()
  const meta = (formData.listing_metadata ?? {}) as Record<string, unknown>
  const variations = formData.variations ?? []
  const images = formData.images ?? []
  const isDigital = formData.listing_type === LISTING_TYPES.DIGITAL
  const productInfo = parseListingProductInfo(formData.product_info)
  const [pickingVariantKey, setPickingVariantKey] = useState<string | null>(null)
  const taxCountry =
    normalizeCountryCode(sellerCountryCode) ||
    normalizeCountryCode(
      resolveCountryCode(readProductInfoString(formData.product_info, 'country_of_origin')),
    ) ||
    DEFAULT_TAX_COUNTRY
  const taxCountryLabel = getCountryName(taxCountry) || taxCountry
  const [axes, setAxes] = useState<VariationAxis[]>(() => {
    const fromMeta = parseVariationAxes(formData.listing_metadata)
    return fromMeta.length ? fromMeta : []
  })
  const productStructure = resolveProductStructure(formData)
  const isVariable = productStructure === PRODUCT_STRUCTURES.VARIABLE
  const isGrouped = productStructure === PRODUCT_STRUCTURES.GROUPED
  const isSimple = productStructure === PRODUCT_STRUCTURES.SIMPLE
  const groupedIds = readMetadataStringList(meta, LISTING_METADATA_KEYS.GROUPED_LISTING_IDS)
  const [groupedDraft, setGroupedDraft] = useState('')
  const [axisValueDraft, setAxisValueDraft] = useState<Record<number, string>>({})
  const [variantError, setVariantError] = useState<string | null>(null)

  const structureOptions = useMemo(
    () =>
      isDigital
        ? PRODUCT_STRUCTURE_OPTIONS.filter((option) => option.value === PRODUCT_STRUCTURES.SIMPLE)
        : PRODUCT_STRUCTURE_OPTIONS,
    [isDigital],
  )

  function setProductStructure(next: ProductStructure) {
    onUpdateMetadata(LISTING_METADATA_KEYS.PRODUCT_STRUCTURE, next)
    if (next === PRODUCT_STRUCTURES.SIMPLE) {
      onUpdate('variations', [])
      persistAxes([])
      setVariantError(null)
      onUpdateMetadata(LISTING_METADATA_KEYS.GROUPED_LISTING_IDS, [])
    } else if (next === PRODUCT_STRUCTURES.VARIABLE) {
      onUpdateMetadata(LISTING_METADATA_KEYS.GROUPED_LISTING_IDS, [])
      if (!axes.length) persistAxes([{ name: 'Color', values: [] }])
    } else if (next === PRODUCT_STRUCTURES.GROUPED) {
      onUpdate('variations', [])
      persistAxes([])
      setVariantError(null)
    }
  }

  function addGroupedListingId() {
    const id = groupedDraft.trim()
    if (!id || groupedIds.includes(id)) {
      setGroupedDraft('')
      return
    }
    onUpdateMetadata(LISTING_METADATA_KEYS.GROUPED_LISTING_IDS, [...groupedIds, id])
    setGroupedDraft('')
  }

  function removeGroupedListingId(id: string) {
    onUpdateMetadata(
      LISTING_METADATA_KEYS.GROUPED_LISTING_IDS,
      groupedIds.filter((row) => row !== id),
    )
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
        const rowMeta = row.variation_metadata as {
          tempKey?: string
          options?: Record<string, string>
        } | null
        const key =
          rowMeta?.tempKey ??
          (rowMeta?.options
            ? childSkuTempKey(rowMeta.options)
            : `${row.variation_name}|${row.variation_value}`)
        return [key, row] as const
      }),
    )

    const parentSku = ensureParentSku(formData.sku, formData.title)
    if (!String(formData.sku ?? '').trim()) {
      onUpdate('sku', parentSku)
    }

    const next: Partial<ListingVariationInsert>[] = combinations.map((options, index) => {
      const tempKey = childSkuTempKey(options)
      const labels = childSkuLabels(options)
      const prev = existingByKey.get(tempKey)
      const activeTax =
        prev?.tax_percent != null && Number.isFinite(Number(prev.tax_percent))
          ? Number(prev.tax_percent)
          : baseTax
      const taxMap = seedTaxByCountry(activeTax, taxCountry)
      const autoSku = buildChildSku(parentSku, options)
      return {
        ...(prev ?? {}),
        variation_name: labels.variation_name,
        variation_value: labels.variation_value,
        price: prev?.price ?? basePrice,
        mrp: prev?.mrp ?? baseMrp,
        tax_percent: activeTax,
        price_includes_tax:
          typeof prev?.price_includes_tax === 'boolean' ? prev.price_includes_tax : baseIncludes,
        hsn_code: prev?.hsn_code ?? baseHsn,
        weight: prev?.weight ?? formData.weight ?? null,
        stock: prev?.stock ?? 0,
        sku: String(prev?.sku ?? '').trim() || autoSku,
        display_order: index,
        is_available: prev?.is_available !== false,
        variation_metadata: buildChildSkuMetadata(options, tempKey, taxMap) as never,
      }
    })

    onUpdate('variations', next)
    onUpdateMetadata(LISTING_METADATA_KEYS.PRODUCT_STRUCTURE, PRODUCT_STRUCTURES.VARIABLE)
    const stockSum = next.reduce((sum, row) => sum + (Number(row.stock) || 0), 0)
    onUpdate('stock', stockSum)
    onUpdate('quantity', stockSum)
    const prices = next.map((row) => Number(row.price)).filter((n) => Number.isFinite(n) && n >= 0)
    if (prices.length) onUpdate('price', Math.min(...prices))
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
    if ('price' in patch) {
      const prices = next.map((row) => Number(row.price)).filter((n) => Number.isFinite(n) && n >= 0)
      if (prices.length) onUpdate('price', Math.min(...prices))
    }
  }

  function updateVariationTax(index: number, taxPercent: number) {
    const row = variations[index]
    if (!row) return
    updateVariation(index, {
      tax_percent: taxPercent,
      variation_metadata: withChildTaxByCountry(
        row.variation_metadata,
        seedTaxByCountry(taxPercent, taxCountry),
      ),
    })
  }

  function removeVariation(index: number) {
    const removed = variations[index]
    const rowMeta = removed?.variation_metadata as { tempKey?: string } | null
    const tempKey = rowMeta?.tempKey
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

  async function pickVariantImages(tempKey: string) {
    if (pickingVariantKey) return
    setPickingVariantKey(tempKey)
    try {
      const picked = await pickImagesWithCrop({
        multiple: true,
        maxCount: 8,
        aspect: 'listing',
        cropTitle: 'Crop variant photo',
      })
      if (!picked.length) return
      const drafts: ListingImageDraft[] = picked.map((file, index) =>
        pickedVariantToDraft(file, images.length + index, tempKey),
      )
      onUpdate('images', [...images, ...drafts])
    } catch (error) {
      toast.show('Could not add variant images', {
        tone: 'danger',
        message: error instanceof Error ? error.message : 'Try again with JPG, PNG, or WebP.',
      })
    } finally {
      setPickingVariantKey(null)
    }
  }

  function removeVariantImage(imageIndex: number) {
    onUpdate(
      'images',
      images.filter((_, i) => i !== imageIndex),
    )
  }

  return (
    <YStack gap="$4" width="100%">
      <ListingPublishCard ui={ui} title="Product type">
        <Text fontSize={12} color={ui.textMuted} lineHeight={18}>
          Like WooCommerce / Amazon — pick how this listing is sold, then set prices below.
        </Text>
        <XStack gap="$2" flexWrap="wrap">
          {structureOptions.map((option) => {
            const selected = productStructure === option.value
            return (
              <YStack
                key={option.value}
                flex={1}
                flexBasis={160}
                minWidth={160}
                gap="$1.5"
                padding="$3"
                borderRadius={14}
                borderWidth={selected ? 2 : 1}
                borderColor={selected ? ui.brand : ui.borderSubtle}
                backgroundColor={selected ? ui.roseSurface : ui.surface}
                cursor="pointer"
                role="button"
                tabIndex={0}
                onPress={() => setProductStructure(option.value)}
                hoverStyle={{ borderColor: ui.brand }}
                pressStyle={{ opacity: 0.92 }}
              >
                <Text fontSize={13} fontWeight="800" color={ui.text}>
                  {option.label}
                </Text>
                <Text fontSize={11.5} color={ui.textSecondary} lineHeight={16}>
                  {option.description}
                </Text>
              </YStack>
            )
          })}
        </XStack>
      </ListingPublishCard>

      {isSimple ? (
        <ListingPublishCard ui={ui} title="Offer price">
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

          <Field label="Quantity available">
            <Input
              value={formData.quantity != null ? String(formData.quantity) : ''}
              onChangeText={(value) => {
                onUpdate('quantity', value)
                onUpdate('stock', value)
              }}
              placeholder="e.g. 50"
              keyboardType="numeric"
            />
          </Field>

          <Field label="Seller SKU">
            <XStack gap="$2" alignItems="center">
              <Input
                flex={1}
                value={formData.sku ?? ''}
                onChangeText={(value) => onUpdate('sku', value)}
                placeholder="Auto from title if empty"
              />
              <Button
                tone="outline"
                size="$3"
                onPress={() => onUpdate('sku', buildParentSkuFromTitle(formData.title))}
              >
                Generate
              </Button>
            </XStack>
          </Field>

          <Field label="Pricing notes">
            <TextArea
              minHeight={100}
              value={readMetadataString(meta, LISTING_METADATA_KEYS.PRICING_NOTES)}
              onChangeText={(value) => onUpdateMetadata(LISTING_METADATA_KEYS.PRICING_NOTES, value)}
              placeholder="Seasonal pricing or special conditions…"
            />
          </Field>
        </ListingPublishCard>
      ) : null}

      {isSimple ? (
        <ListingPublishCard ui={ui} title="Inventory alerts">
          <Field label="Minimum order quantity">
            <Input
              value={readMetadataString(meta, LISTING_METADATA_KEYS.MIN_ORDER_QUANTITY, '1')}
              onChangeText={(value) => onUpdateMetadata(LISTING_METADATA_KEYS.MIN_ORDER_QUANTITY, value)}
              keyboardType="numeric"
            />
          </Field>
          <Field label="Low stock threshold">
            <XStack alignItems="center" gap="$2">
              <Input
                flex={1}
                value={readMetadataString(meta, LISTING_METADATA_KEYS.LOW_STOCK_THRESHOLD, '5')}
                onChangeText={(value) =>
                  onUpdateMetadata(LISTING_METADATA_KEYS.LOW_STOCK_THRESHOLD, value)
                }
                keyboardType="numeric"
              />
              <Icons.Bell size={16} color={ui.brand} />
            </XStack>
          </Field>
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
      ) : null}

      {isGrouped ? (
        <ListingPublishCard ui={ui} title="Grouped products">
          <Text fontSize={12} color={ui.textMuted} lineHeight={18}>
            Add listing IDs from your shop. Shoppers see this group and buy the linked products — no
            offer price on the group itself.
          </Text>
          <ListingPublishFieldError ui={ui} message={errors.grouped} />
          <XStack gap="$2" alignItems="flex-end" flexWrap="wrap">
            <Field label="Listing ID" flex={1} minWidth={220}>
              <Input
                value={groupedDraft}
                onChangeText={setGroupedDraft}
                placeholder="Paste a product listing UUID"
                onSubmitEditing={addGroupedListingId}
              />
            </Field>
            <Button tone="outline" size="$3" onPress={addGroupedListingId}>
              Add product
            </Button>
          </XStack>
          {groupedIds.length === 0 ? (
            <Text fontSize={12} color={ui.textSecondary}>
              No products linked yet.
            </Text>
          ) : (
            <YStack gap="$2">
              {groupedIds.map((id) => (
                <XStack
                  key={id}
                  alignItems="center"
                  justifyContent="space-between"
                  gap="$2"
                  padding="$3"
                  borderRadius={12}
                  backgroundColor={ui.surfaceMuted}
                >
                  <Text flex={1} fontSize={12} fontWeight="600" color={ui.text} numberOfLines={1}>
                    {id}
                  </Text>
                  <Button
                    tone="ghost"
                    size="$2"
                    icon={<Icons.X size={14} />}
                    onPress={() => removeGroupedListingId(id)}
                  />
                </XStack>
              ))}
            </YStack>
          )}
        </ListingPublishCard>
      ) : null}

      {isVariable ? (
        <ListingPublishCard
          ui={ui}
          title="Variations & SKU prices"
          headerRight={
            <XStack gap="$3" alignItems="center">
              <Text fontSize={12} fontWeight="700" color={ui.brand} cursor="pointer" onPress={addAxis}>
                + Option
              </Text>
              <Text
                fontSize={12}
                fontWeight="700"
                color={ui.brand}
                cursor="pointer"
                onPress={generateChildSkus}
              >
                Apply options
              </Text>
            </XStack>
          }
        >
          <Field label="Parent SKU">
            <XStack gap="$2" alignItems="center">
              <Input
                flex={1}
                value={formData.sku ?? ''}
                onChangeText={(value) => onUpdate('sku', value)}
                placeholder="Auto from title if empty"
              />
              <Button
                tone="outline"
                size="$3"
                onPress={() => onUpdate('sku', buildParentSkuFromTitle(formData.title))}
              >
                Generate
              </Button>
            </XStack>
          </Field>
          <ListingPublishFieldError
            ui={ui}
            message={errors.sku || errors.variations || variantError || undefined}
          />
          <Text fontSize={12} color={ui.textMuted} lineHeight={18}>
            Set price, tax, and stock on each variation below.
          </Text>

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
                      <SelectTrigger
                        width="100%"
                        iconAfter={<Icons.ChevronDown size={14} color={ui.textMuted} />}
                      >
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
              const rowMeta = variation.variation_metadata as {
                tempKey?: string
                options?: Record<string, string>
              } | null
              const tempKey = rowMeta?.tempKey ?? childSkuTempKey(rowMeta?.options ?? {})
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
                    <Field label="Stock" flex={1} minWidth={90}>
                      <Input
                        value={String(variation.stock ?? 0)}
                        onChangeText={(value) => updateVariation(index, { stock: value })}
                        keyboardType="numeric"
                      />
                    </Field>
                    <Field label="SKU" flex={1} minWidth={160}>
                      <XStack gap="$1.5" alignItems="center">
                        <Input
                          flex={1}
                          value={variation.sku ?? ''}
                          onChangeText={(value) => updateVariation(index, { sku: value })}
                          placeholder="Auto-generated"
                        />
                        <Button
                          tone="outline"
                          size="$2"
                          onPress={() => {
                            const metaOptions =
                              (variation.variation_metadata as {
                                options?: Record<string, string>
                              } | null)?.options ?? {}
                            const parentSku = ensureParentSku(formData.sku, formData.title)
                            updateVariation(index, {
                              sku: buildChildSku(parentSku, metaOptions),
                            })
                          }}
                        >
                          Auto
                        </Button>
                      </XStack>
                    </Field>
                    <Field label="HSN" flex={1} minWidth={110}>
                      <Input
                        value={variation.hsn_code ?? ''}
                        onChangeText={(value) => updateVariation(index, { hsn_code: value })}
                        placeholder="HSN / SAC"
                      />
                    </Field>
                    <Field label="Weight (kg)" flex={1} minWidth={100}>
                      <Input
                        value={String(variation.weight ?? '')}
                        onChangeText={(value) => updateVariation(index, { weight: value })}
                        keyboardType="numeric"
                      />
                    </Field>
                  </XStack>

                  <XStack gap="$2" flexWrap="wrap" alignItems="flex-end">
                    <Field label={`Tax % (${taxCountryLabel})`} flex={1} minWidth={140}>
                      <Select
                        value={String(variation.tax_percent ?? formData.tax_percent ?? '18')}
                        onValueChange={(value) => updateVariationTax(index, Number(value))}
                      >
                        <SelectTrigger
                          width="100%"
                          iconAfter={<Icons.ChevronDown size={14} color={ui.textMuted} />}
                        >
                          <Select.Value placeholder="Select %" />
                        </SelectTrigger>
                        <SelectContent zIndex={300000}>
                          <SelectViewport>
                            {GST_PRESETS.map((preset, presetIndex) => (
                              <SelectItem
                                key={`${tempKey}-tax-${preset}`}
                                index={presetIndex}
                                value={preset}
                              >
                                <Select.ItemText>{preset}%</Select.ItemText>
                              </SelectItem>
                            ))}
                          </SelectViewport>
                        </SelectContent>
                      </Select>
                    </Field>
                    <XStack alignItems="center" gap="$2" paddingBottom="$2" minWidth={140}>
                      <Switch
                        checked={Boolean(
                          variation.price_includes_tax ?? formData.price_includes_tax,
                        )}
                        onCheckedChange={(checked) =>
                          updateVariation(index, { price_includes_tax: checked })
                        }
                      />
                      <Text fontSize={12} color={ui.textSecondary}>
                        Includes tax
                      </Text>
                    </XStack>
                  </XStack>

                  <YStack gap="$2">
                    <XStack justifyContent="space-between" alignItems="center" gap="$2">
                      <Text fontSize={12} fontWeight="700" color={ui.textMuted}>
                        Variant images ({childImages.length})
                      </Text>
                      <Button
                        tone="outline"
                        size="$2"
                        borderRadius={999}
                        disabled={pickingVariantKey === tempKey}
                        icon={
                          pickingVariantKey === tempKey ? (
                            <Spinner size="small" color={ui.brand} />
                          ) : (
                            <Icons.ImagePlus size={14} color={ui.brand} />
                          )
                        }
                        onPress={() => void pickVariantImages(tempKey)}
                      >
                        {pickingVariantKey === tempKey ? 'Uploading…' : 'Upload media'}
                      </Button>
                    </XStack>

                    {childImages.length ? (
                      <XStack gap="$2" flexWrap="wrap">
                        {childImages.map((image) => {
                          const globalIndex = images.indexOf(image)
                          const uri = image.image_url || ''
                          return (
                            <YStack
                              key={`${tempKey}-img-${globalIndex}-${uri || image.fileName || globalIndex}`}
                              width={72}
                              height={72}
                              borderRadius={10}
                              overflow="hidden"
                              backgroundColor={ui.surfaceMuted}
                              borderWidth={1}
                              borderColor={ui.borderSubtle}
                              position="relative"
                            >
                              {uri ? (
                                <Image
                                  source={{ uri }}
                                  width={72}
                                  height={72}
                                  borderRadius={10}
                                />
                              ) : (
                                <YStack flex={1} alignItems="center" justifyContent="center">
                                  <Icons.Image size={18} color={ui.textMuted} />
                                </YStack>
                              )}
                              <XStack
                                position="absolute"
                                top={4}
                                right={4}
                                width={22}
                                height={22}
                                borderRadius={999}
                                alignItems="center"
                                justifyContent="center"
                                backgroundColor="rgba(0,0,0,0.55)"
                                cursor="pointer"
                                onPress={() => {
                                  if (globalIndex >= 0) removeVariantImage(globalIndex)
                                }}
                              >
                                <Icons.X size={12} color="#fff" />
                              </XStack>
                            </YStack>
                          )
                        })}
                      </XStack>
                    ) : (
                      <XStack
                        gap="$2"
                        padding="$3"
                        borderRadius={10}
                        borderWidth={1}
                        borderStyle="dashed"
                        borderColor={ui.borderSubtle}
                        alignItems="center"
                        cursor="pointer"
                        hoverStyle={{ borderColor: ui.brand, backgroundColor: ui.roseSurface }}
                        onPress={() => void pickVariantImages(tempKey)}
                      >
                        <Icons.ImagePlus size={18} color={ui.brand} />
                        <YStack flex={1} gap={2}>
                          <Text fontSize={13} fontWeight="700" color={ui.text}>
                            Add photos for this SKU
                          </Text>
                          <Text fontSize={11.5} color={ui.textMuted}>
                            Optional — buyers see these when this variant is selected.
                          </Text>
                        </YStack>
                      </XStack>
                    )}
                  </YStack>
                </YStack>
              )
            })}
          </YStack>
        </ListingPublishCard>
      ) : null}
    </YStack>
  )
}

function pickedVariantToDraft(
  picked: PickedImage,
  order: number,
  tempKey: string,
): ListingImageDraft {
  return {
    image_url: picked.uri,
    mimeType: picked.mimeType,
    fileName: picked.fileName,
    blob: picked.file,
    is_primary: false,
    display_order: order,
    file_size: picked.file?.size ?? null,
    variant_temp_key: tempKey,
  }
}
