import { useMemo, useState } from 'react'
import { useWindowDimensions } from 'react-native'

import {
  Button,
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
  ListingFormRow,
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
  /** Offer commercial fields vs Variations Yes/No + SKU table. */
  panel?: 'full' | 'type-and-price' | 'variants'
  onUpdate: <K extends keyof ListingFormData>(field: K, value: ListingFormData[K]) => void
  onUpdateMetadata: (key: string, value: unknown) => void
  onStructureChange?: (next: ProductStructure) => void
}

export function ProductStructurePricingPanel({
  ui,
  formData,
  errors,
  currencySymbol,
  sellerCountryCode,
  panel = 'full',
  onUpdate,
  onUpdateMetadata,
  onStructureChange,
}: ProductStructurePricingPanelProps) {
  const toast = useAppToast()
  const { width: viewportWidth } = useWindowDimensions()
  const showSkuTableHeader = viewportWidth >= 900
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
  const rawStructure = resolveProductStructure(formData)
  // Legacy "grouped" listings open as Simple in the Amazon-style editor.
  const productStructure =
    rawStructure === PRODUCT_STRUCTURES.VARIABLE
      ? PRODUCT_STRUCTURES.VARIABLE
      : PRODUCT_STRUCTURES.SIMPLE
  const isVariable = productStructure === PRODUCT_STRUCTURES.VARIABLE
  const isSimple = productStructure === PRODUCT_STRUCTURES.SIMPLE
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
    if (next !== PRODUCT_STRUCTURES.SIMPLE && next !== PRODUCT_STRUCTURES.VARIABLE) return
    // Single metadata write — chained updates race on stale formData.
    const base = {
      ...((formData.listing_metadata ?? {}) as Record<string, unknown>),
      [LISTING_METADATA_KEYS.PRODUCT_STRUCTURE]: next,
      [LISTING_METADATA_KEYS.GROUPED_LISTING_IDS]: [],
    }
    if (next === PRODUCT_STRUCTURES.SIMPLE) {
      onUpdate('variations', [])
      setAxes([])
      setVariantError(null)
      onUpdate('listing_metadata', withVariationAxes(base, []) as ListingFormData['listing_metadata'])
    } else {
      const nextAxes = axes.length ? axes : [{ name: 'Color', values: [] as string[] }]
      setAxes(nextAxes)
      setVariantError(null)
      onUpdate(
        'listing_metadata',
        withVariationAxes(base, nextAxes) as ListingFormData['listing_metadata'],
      )
    }
    onStructureChange?.(next)
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

  const showOffer = panel === 'full' || panel === 'type-and-price'
  const showVariants = panel === 'full' || panel === 'variants'

  return (
    <YStack gap="$4" width="100%">
      {showOffer && isSimple ? (
        <ListingPublishCard ui={ui} title="Offer">
          <ListingFormRow ui={ui} label="Your price" required error={errors.price}>
            <XStack alignItems="center" gap="$2">
              <Text fontSize={15} fontWeight="700" color={ui.textMuted}>
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
          </ListingFormRow>

          <ListingFormRow
            ui={ui}
            label="List price (MRP)"
            hint="Optional. Shown struck through when higher than Your price."
            error={errors.mrp}
          >
            <XStack alignItems="center" gap="$2">
              <Text fontSize={15} fontWeight="700" color={ui.textMuted}>
                {currencySymbol}
              </Text>
              <Input
                flex={1}
                value={formData.mrp != null && formData.mrp !== '' ? String(formData.mrp) : ''}
                onChangeText={(value) => onUpdate('mrp', value)}
                placeholder="0.00"
                keyboardType="decimal-pad"
              />
            </XStack>
          </ListingFormRow>

          <ListingFormRow ui={ui} label="Price includes tax">
            <XStack alignItems="center" justifyContent="flex-start" gap="$3" minHeight={40}>
              <Switch
                checked={formData.price_includes_tax ?? true}
                onCheckedChange={(checked) => onUpdate('price_includes_tax', !!checked)}
              />
              <Text fontSize={13} color={ui.textSecondary}>
                Inclusive of all taxes
              </Text>
            </XStack>
          </ListingFormRow>

          <ListingFormRow ui={ui} label="GST / tax %">
            <YStack gap="$2" width="100%">
              <XStack gap="$2" flexWrap="wrap">
                {GST_PRESETS.map((preset) => (
                  <Button
                    key={preset}
                    tone={String(formData.tax_percent ?? '') === preset ? 'primary' : 'outline'}
                    size="$2"
                    borderRadius={8}
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
            </YStack>
          </ListingFormRow>

          <ListingFormRow ui={ui} label="Quantity" required error={errors.stock}>
            <Input
              value={formData.quantity != null ? String(formData.quantity) : ''}
              onChangeText={(value) => {
                onUpdate('quantity', value)
                onUpdate('stock', value)
              }}
              placeholder="e.g. 50"
              keyboardType="numeric"
            />
          </ListingFormRow>

          <ListingFormRow ui={ui} label="Seller SKU">
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
          </ListingFormRow>
        </ListingPublishCard>
      ) : null}

      {showOffer && isVariable ? (
        <ListingPublishCard ui={ui} title="Offer">
          <Text fontSize={13} color={ui.textSecondary} lineHeight={20}>
            Your price and quantity are set per variation. Open the Variations tab to edit each
            child SKU.
          </Text>
        </ListingPublishCard>
      ) : null}

      {showVariants ? (
        <ListingPublishCard ui={ui} title="Does this product have variations?">
          {isDigital ? (
            <Text fontSize={13} color={ui.textSecondary} lineHeight={20}>
              Digital products are sold as a single SKU. Set Your price on the Offer tab.
            </Text>
          ) : (
            <XStack gap="$2" flexWrap="wrap">
              {structureOptions.map((option) => {
                const selected = productStructure === option.value
                return (
                  <Button
                    key={option.value}
                    tone={selected ? 'primary' : 'outline'}
                    size="$3"
                    minWidth={88}
                    borderRadius={8}
                    onPress={() => setProductStructure(option.value)}
                  >
                    {option.label}
                  </Button>
                )
              })}
            </XStack>
          )}
          {!isDigital && isSimple ? (
            <Text fontSize={13} color={ui.textSecondary} lineHeight={20} marginTop="$2">
              Sold as a single SKU — set Your price on the Offer tab.
            </Text>
          ) : null}
        </ListingPublishCard>
      ) : null}

      {showVariants && isVariable && !isDigital ? (
        <>
          <ListingPublishCard
            ui={ui}
            title="Variation attributes"
            headerRight={
              <XStack gap="$3" alignItems="center">
                <Text
                  fontSize={12}
                  fontWeight="700"
                  color={ui.brand}
                  cursor="pointer"
                  onPress={addAxis}
                >
                  + Add theme
                </Text>
                <Text
                  fontSize={12}
                  fontWeight="700"
                  color={ui.brand}
                  cursor="pointer"
                  onPress={generateChildSkus}
                >
                  Apply
                </Text>
              </XStack>
            }
          >
            <ListingFormRow ui={ui} label="Parent SKU">
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
            </ListingFormRow>
            <ListingPublishFieldError
              ui={ui}
              message={errors.sku || errors.variations || variantError || undefined}
            />

            <YStack gap="$3">
              {axes.map((axis, axisIndex) => (
                <YStack
                  key={`axis-${axisIndex}`}
                  gap="$2"
                  padding="$3"
                  borderRadius={10}
                  borderWidth={1}
                  borderColor={ui.borderSubtle}
                  backgroundColor={ui.surfaceMuted}
                >
                  <XStack gap="$2" alignItems="flex-end" flexWrap="wrap">
                    <Field label="Theme" flex={1} minWidth={140}>
                      <Select
                        value={axis.name}
                        onValueChange={(value) => updateAxis(axisIndex, { name: value })}
                      >
                        <SelectTrigger
                          width="100%"
                          iconAfter={<Icons.ChevronDown size={14} color={ui.textMuted} />}
                        >
                          <Select.Value placeholder="Theme" />
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
                        borderRadius={8}
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
          </ListingPublishCard>

          <ListingPublishCard ui={ui} title="Variation listing">
            {variations.length === 0 ? (
              <Text fontSize={13} color={ui.textSecondary} lineHeight={20}>
                Add theme values, then press Apply to generate SKU rows.
              </Text>
            ) : (
              <YStack gap="$2" width="100%">
                {showSkuTableHeader ? (
                  <XStack
                    gap="$2"
                    paddingHorizontal="$2"
                    paddingBottom="$1"
                    borderBottomWidth={1}
                    borderBottomColor={ui.borderSubtle}
                  >
                    {[
                      { label: 'Variation', flex: 1.4 },
                      { label: 'Seller SKU', flex: 1.2 },
                      { label: 'Your price', flex: 0.9 },
                      { label: 'MRP', flex: 0.8 },
                      { label: 'Qty', flex: 0.7 },
                      { label: `Tax (${taxCountryLabel})`, flex: 0.9 },
                      { label: 'Images', flex: 1 },
                      { label: '', flex: 0.35 },
                    ].map((col) => (
                      <Text
                        key={col.label || 'actions'}
                        flex={col.flex}
                        fontSize={11}
                        fontWeight="700"
                        color={ui.textMuted}
                        textTransform="uppercase"
                        letterSpacing={0.3}
                      >
                        {col.label}
                      </Text>
                    ))}
                  </XStack>
                ) : null}

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
                      gap="$2"
                      padding="$3"
                      borderRadius={10}
                      borderWidth={1}
                      borderColor={ui.borderSubtle}
                      backgroundColor={ui.surface}
                    >
                      <XStack gap="$2" flexWrap="wrap" alignItems="flex-start">
                        <YStack flex={1.4} minWidth={120} gap={2} paddingTop={8}>
                          <Text fontSize={13} fontWeight="800" color={ui.text}>
                            {variation.variation_value || 'Child SKU'}
                          </Text>
                          <Text fontSize={11} color={ui.textMuted}>
                            {variation.variation_name}
                          </Text>
                        </YStack>

                        <YStack flex={1.2} minWidth={120} gap="$1">
                          {!showSkuTableHeader ? (
                            <Text fontSize={11} fontWeight="600" color={ui.textMuted}>
                              Seller SKU
                            </Text>
                          ) : null}
                          <XStack gap="$1.5" alignItems="center">
                            <Input
                              flex={1}
                              value={variation.sku ?? ''}
                              onChangeText={(value) => updateVariation(index, { sku: value })}
                              placeholder="SKU"
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
                        </YStack>

                        <YStack flex={0.9} minWidth={90} gap="$1">
                          {!showSkuTableHeader ? (
                            <Text fontSize={11} fontWeight="600" color={ui.textMuted}>
                              Your price
                            </Text>
                          ) : null}
                          <Input
                            value={String(variation.price ?? formData.price ?? 0)}
                            onChangeText={(value) => updateVariation(index, { price: value })}
                            keyboardType="numeric"
                          />
                        </YStack>

                        <YStack flex={0.8} minWidth={80} gap="$1">
                          {!showSkuTableHeader ? (
                            <Text fontSize={11} fontWeight="600" color={ui.textMuted}>
                              MRP
                            </Text>
                          ) : null}
                          <Input
                            value={String(variation.mrp ?? '')}
                            onChangeText={(value) => updateVariation(index, { mrp: value })}
                            keyboardType="numeric"
                          />
                        </YStack>

                        <YStack flex={0.7} minWidth={70} gap="$1">
                          {!showSkuTableHeader ? (
                            <Text fontSize={11} fontWeight="600" color={ui.textMuted}>
                              Qty
                            </Text>
                          ) : null}
                          <Input
                            value={String(variation.stock ?? 0)}
                            onChangeText={(value) => updateVariation(index, { stock: value })}
                            keyboardType="numeric"
                          />
                        </YStack>

                        <YStack flex={0.9} minWidth={100} gap="$1">
                          {!showSkuTableHeader ? (
                            <Text fontSize={11} fontWeight="600" color={ui.textMuted}>
                              Tax %
                            </Text>
                          ) : null}
                          <Select
                            value={String(variation.tax_percent ?? formData.tax_percent ?? '18')}
                            onValueChange={(value) => updateVariationTax(index, Number(value))}
                          >
                            <SelectTrigger
                              width="100%"
                              iconAfter={<Icons.ChevronDown size={14} color={ui.textMuted} />}
                            >
                              <Select.Value placeholder="%" />
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
                        </YStack>

                        <YStack flex={1} minWidth={120} gap="$1.5">
                          <XStack justifyContent="space-between" alignItems="center" gap="$2">
                            <Text fontSize={11} fontWeight="600" color={ui.textMuted}>
                              Images ({childImages.length})
                            </Text>
                            <Button
                              tone="outline"
                              size="$2"
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
                              Add
                            </Button>
                          </XStack>
                          {childImages.length ? (
                            <XStack gap="$1.5" flexWrap="wrap">
                              {childImages.map((image) => {
                                const globalIndex = images.indexOf(image)
                                const uri = image.image_url || ''
                                return (
                                  <YStack
                                    key={`${tempKey}-img-${globalIndex}-${uri || image.fileName || globalIndex}`}
                                    width={44}
                                    height={44}
                                    borderRadius={6}
                                    overflow="hidden"
                                    backgroundColor={ui.surfaceMuted}
                                    borderWidth={1}
                                    borderColor={ui.borderSubtle}
                                    position="relative"
                                  >
                                    {uri ? (
                                      <Image
                                        source={{ uri }}
                                        width={44}
                                        height={44}
                                        borderRadius={6}
                                      />
                                    ) : (
                                      <YStack flex={1} alignItems="center" justifyContent="center">
                                        <Icons.Image size={14} color={ui.textMuted} />
                                      </YStack>
                                    )}
                                    <XStack
                                      position="absolute"
                                      top={2}
                                      right={2}
                                      width={16}
                                      height={16}
                                      borderRadius={999}
                                      alignItems="center"
                                      justifyContent="center"
                                      backgroundColor="rgba(0,0,0,0.55)"
                                      cursor="pointer"
                                      onPress={() => {
                                        if (globalIndex >= 0) removeVariantImage(globalIndex)
                                      }}
                                    >
                                      <Icons.X size={10} color="#fff" />
                                    </XStack>
                                  </YStack>
                                )
                              })}
                            </XStack>
                          ) : null}
                        </YStack>

                        <XStack flex={0.35} minWidth={36} justifyContent="flex-end" paddingTop={4}>
                          <Button
                            tone="ghost"
                            size="$2"
                            icon={<Icons.X size={14} />}
                            onPress={() => removeVariation(index)}
                          />
                        </XStack>
                      </XStack>
                    </YStack>
                  )
                })}
              </YStack>
            )}
          </ListingPublishCard>
        </>
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
