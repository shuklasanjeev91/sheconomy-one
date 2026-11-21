import { useState } from 'react'

import { Button, Icons, Input, Switch, Text, XStack, YStack } from '~/components/ui'
import {
  buildChildSku,
  buildChildSkuMetadata,
  cartesianAxes,
  childSkuLabels,
  childSkuTempKey,
  ensureParentSku,
  parseVariationAxes,
  withVariationAxes,
  type VariationAxis,
} from '~/commerce/lib/listing-variant-skus'
import { MAX_VARIATION_PROPERTIES } from '~/lib/listing/product-catalog'
import type { ListingFormData, ListingVariationInsert } from '~/lib/listing/listing.type'
import type { AppUiTokens } from '~/lib/theme/app-ui'

import {
  ListingFormRow,
  ListingPublishCard,
  ListingPublishFieldError,
} from '~/commerce/components/vendor/listing-publish/ListingPublishCard'
import {
  LISTING_METADATA_KEYS,
  PRODUCT_STRUCTURES,
} from '~/commerce/components/vendor/listing-publish/listing-publish.constants'
import { readMetadataBoolean } from '~/commerce/components/vendor/listing-publish/listing-publish.utils'

const PROPERTY_PRESETS = ['Primary color', 'Secondary color', 'Size', 'Material', 'Style'] as const

type VariationsSectionProps = {
  ui: AppUiTokens
  formData: ListingFormData
  errors: Record<string, string>
  currencySymbol: string
  onUpdate: <K extends keyof ListingFormData>(field: K, value: ListingFormData[K]) => void
  onUpdateMetadata: (key: string, value: unknown) => void
}

export function VariationsSection({
  ui,
  formData,
  errors,
  currencySymbol,
  onUpdate,
  onUpdateMetadata,
}: VariationsSectionProps) {
  const meta = (formData.listing_metadata ?? {}) as Record<string, unknown>
  const variations = formData.variations ?? []
  const [axes, setAxes] = useState<VariationAxis[]>(() => parseVariationAxes(formData.listing_metadata))
  const [drafts, setDrafts] = useState<Record<number, string>>({})
  const [variantError, setVariantError] = useState<string | null>(null)
  const enabled = variations.some((row) => String(row.variation_value ?? '').trim()) || axes.length > 0
  const pricesVary = readMetadataBoolean(meta, LISTING_METADATA_KEYS.VARIATION_PRICES_VARY, true)
  const quantitiesVary = readMetadataBoolean(meta, LISTING_METADATA_KEYS.VARIATION_QUANTITIES_VARY, true)
  const skusVary = readMetadataBoolean(meta, LISTING_METADATA_KEYS.VARIATION_SKUS_VARY, false)
  const processingVaries = readMetadataBoolean(meta, LISTING_METADATA_KEYS.VARIATION_PROCESSING_VARIES, false)
  const visibilityVaries = readMetadataBoolean(meta, LISTING_METADATA_KEYS.VARIATION_VISIBILITY_VARIES, false)

  function persistAxes(next: VariationAxis[]) {
    setAxes(next)
    onUpdate('listing_metadata', withVariationAxes(meta, next) as ListingFormData['listing_metadata'])
  }

  function turnOff() {
    persistAxes([])
    onUpdate('variations', [])
    onUpdate(
      'images',
      (formData.images ?? []).map((image) => ({ ...image, variant_temp_key: null, variation_id: null })),
    )
    onUpdateMetadata(LISTING_METADATA_KEYS.PRODUCT_STRUCTURE, PRODUCT_STRUCTURES.SIMPLE)
    setVariantError(null)
  }

  function addProperty() {
    if (axes.length >= MAX_VARIATION_PROPERTIES) return
    const unused = PROPERTY_PRESETS.find((name) => !axes.some((axis) => axis.name === name))
    persistAxes([...axes, { name: unused ?? `Option ${axes.length + 1}`, values: [] }])
  }

  function addValue(index: number) {
    const raw = (drafts[index] ?? '').trim()
    const axis = axes[index]
    if (!raw || !axis || axis.values.includes(raw)) {
      setDrafts((current) => ({ ...current, [index]: '' }))
      return
    }
    persistAxes(axes.map((row, i) => (i === index ? { ...row, values: [...row.values, raw] } : row)))
    setDrafts((current) => ({ ...current, [index]: '' }))
  }

  function buildCombinations() {
    const { combinations, error } = cartesianAxes(axes.slice(0, MAX_VARIATION_PROPERTIES))
    setVariantError(error)
    if (!combinations.length) {
      setVariantError(error ?? 'Add a property and at least one option.')
      return
    }
    const basePrice = Number(formData.price) || 0
    const parentSku = ensureParentSku(formData.sku, formData.title)
    if (!String(formData.sku ?? '').trim()) onUpdate('sku', parentSku)
    const existing = new Map(
      variations.map((row) => {
        const rowMeta = row.variation_metadata as { tempKey?: string; options?: Record<string, string> } | null
        const key = rowMeta?.tempKey ?? (rowMeta?.options ? childSkuTempKey(rowMeta.options) : '')
        return [key, row] as const
      }),
    )
    const next: Partial<ListingVariationInsert>[] = combinations.map((options, index) => {
      const tempKey = childSkuTempKey(options)
      const labels = childSkuLabels(options)
      const prev = existing.get(tempKey)
      return {
        ...(prev ?? {}),
        variation_name: labels.variation_name,
        variation_value: labels.variation_value,
        price: pricesVary ? (prev?.price ?? basePrice) : basePrice,
        stock: quantitiesVary ? (prev?.stock ?? 0) : Number(formData.stock) || 0,
        sku: skusVary ? String(prev?.sku ?? '').trim() || buildChildSku(parentSku, options) : parentSku,
        processing_time_min: processingVaries ? prev?.processing_time_min ?? null : null,
        processing_time_max: processingVaries ? prev?.processing_time_max ?? null : null,
        is_visible: visibilityVaries ? prev?.is_visible !== false : true,
        is_available: prev?.is_available !== false,
        display_order: index,
        variation_metadata: buildChildSkuMetadata(options, tempKey) as never,
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

  function patchVariation(index: number, patch: Partial<ListingVariationInsert>) {
    const next = variations.map((row, i) => (i === index ? { ...row, ...patch } : row))
    onUpdate('variations', next)
  }

  return (
    <ListingPublishCard ui={ui} title="Variations">
      <XStack alignItems="center" justifyContent="space-between" gap="$3">
        <YStack flex={1} gap="$1">
          <Text fontSize={14} fontWeight="700" color={ui.text}>
            This listing has variations
          </Text>
          <Text fontSize={12} color={ui.textSecondary} lineHeight={18}>
            Add up to three options, such as color, size, and style. Price, quantity, SKU, processing time, and visibility can differ for each.
          </Text>
        </YStack>
        <Switch checked={enabled} onCheckedChange={(checked) => (checked ? addProperty() : turnOff())} />
      </XStack>

      {enabled ? (
        <YStack gap="$3">
          {axes.map((axis, index) => (
            <YStack key={`${axis.name}-${index}`} gap="$2">
              <XStack gap="$2" alignItems="center">
                <Input
                  flex={1}
                  value={axis.name}
                  onChangeText={(value) =>
                    persistAxes(axes.map((row, i) => (i === index ? { ...row, name: value } : row)))
                  }
                  placeholder="Property name"
                />
                <Button tone="ghost" size="$2" icon={<Icons.X size={14} />} onPress={() => persistAxes(axes.filter((_, i) => i !== index))} />
              </XStack>
              <XStack gap="$2" flexWrap="wrap">
                {axis.values.map((value) => (
                  <XStack
                    key={value}
                    alignItems="center"
                    gap="$1"
                    paddingHorizontal="$2"
                    paddingVertical="$1"
                    borderRadius={999}
                    backgroundColor={ui.surfaceMuted}
                  >
                    <Text fontSize={12} color={ui.text}>
                      {value}
                    </Text>
                    <Text
                      fontSize={12}
                      color={ui.textMuted}
                      cursor="pointer"
                      onPress={() =>
                        persistAxes(
                          axes.map((row, i) =>
                            i === index ? { ...row, values: row.values.filter((entry) => entry !== value) } : row,
                          ),
                        )
                      }
                    >
                      ×
                    </Text>
                  </XStack>
                ))}
              </XStack>
              <XStack gap="$2" flexWrap="wrap">
                <Input
                  flex={1}
                  minWidth={140}
                  value={drafts[index] ?? ''}
                  onChangeText={(value) => setDrafts((current) => ({ ...current, [index]: value }))}
                  placeholder="Add an option, such as Red"
                  onSubmitEditing={() => addValue(index)}
                />
                <Button tone="outline" size="$3" onPress={() => addValue(index)}>
                  Add
                </Button>
              </XStack>
            </YStack>
          ))}
          {axes.length < MAX_VARIATION_PROPERTIES ? (
            <Button tone="outline" size="$3" alignSelf="flex-start" onPress={addProperty}>
              Add a property
            </Button>
          ) : null}

          <YStack gap="$2">
            <VaryRow ui={ui} label="Prices vary" checked={pricesVary} onChange={(value) => onUpdateMetadata(LISTING_METADATA_KEYS.VARIATION_PRICES_VARY, value)} />
            <VaryRow ui={ui} label="Quantities vary" checked={quantitiesVary} onChange={(value) => onUpdateMetadata(LISTING_METADATA_KEYS.VARIATION_QUANTITIES_VARY, value)} />
            <VaryRow ui={ui} label="SKUs vary" checked={skusVary} onChange={(value) => onUpdateMetadata(LISTING_METADATA_KEYS.VARIATION_SKUS_VARY, value)} />
            <VaryRow ui={ui} label="Processing time varies" checked={processingVaries} onChange={(value) => onUpdateMetadata(LISTING_METADATA_KEYS.VARIATION_PROCESSING_VARIES, value)} />
            <VaryRow ui={ui} label="Visibility varies" checked={visibilityVaries} onChange={(value) => onUpdateMetadata(LISTING_METADATA_KEYS.VARIATION_VISIBILITY_VARIES, value)} />
          </YStack>

          <Button tone="primary" size="$3" alignSelf="flex-start" onPress={buildCombinations}>
            Update variations
          </Button>
          {variantError ? <ListingPublishFieldError ui={ui} message={variantError} /> : null}
          <ListingPublishFieldError ui={ui} message={errors.variations} />

          {variations.map((row, index) => (
            <YStack key={`${row.variation_name}-${row.variation_value}-${index}`} gap="$2" padding="$3" borderRadius={12} backgroundColor={ui.surfaceMuted}>
              <Text fontSize={13} fontWeight="700" color={ui.text}>
                {[row.variation_name, row.variation_value].filter(Boolean).join(': ')}
              </Text>
              <XStack gap="$2" flexWrap="wrap">
                {pricesVary ? (
                  <Input
                    flex={1}
                    minWidth={100}
                    value={row.price != null ? String(row.price) : ''}
                    onChangeText={(value) => patchVariation(index, { price: value === '' ? null : Number(value) })}
                    placeholder={`${currencySymbol} Price`}
                    keyboardType="numeric"
                  />
                ) : null}
                {quantitiesVary ? (
                  <Input
                    flex={1}
                    minWidth={100}
                    value={row.stock != null ? String(row.stock) : ''}
                    onChangeText={(value) => patchVariation(index, { stock: value === '' ? null : Number(value) })}
                    placeholder="Quantity"
                    keyboardType="numeric"
                  />
                ) : null}
                {skusVary ? (
                  <Input
                    flex={1}
                    minWidth={120}
                    value={row.sku ?? ''}
                    onChangeText={(value) => patchVariation(index, { sku: value })}
                    placeholder="SKU"
                  />
                ) : null}
                {processingVaries ? (
                  <>
                    <Input
                      flex={1}
                      minWidth={80}
                      value={row.processing_time_min != null ? String(row.processing_time_min) : ''}
                      onChangeText={(value) =>
                        patchVariation(index, { processing_time_min: value === '' ? null : Number(value) })
                      }
                      placeholder="Min days"
                      keyboardType="numeric"
                    />
                    <Input
                      flex={1}
                      minWidth={80}
                      value={row.processing_time_max != null ? String(row.processing_time_max) : ''}
                      onChangeText={(value) =>
                        patchVariation(index, { processing_time_max: value === '' ? null : Number(value) })
                      }
                      placeholder="Max days"
                      keyboardType="numeric"
                    />
                  </>
                ) : null}
                {visibilityVaries ? (
                  <XStack alignItems="center" gap="$2" minWidth={120}>
                    <Text fontSize={12} color={ui.textSecondary}>
                      Visible
                    </Text>
                    <Switch
                      checked={row.is_visible !== false}
                      onCheckedChange={(checked) => patchVariation(index, { is_visible: checked })}
                    />
                  </XStack>
                ) : null}
              </XStack>
              <VariationPhotos ui={ui} formData={formData} row={row} onUpdate={onUpdate} />
            </YStack>
          ))}
        </YStack>
      ) : (
        <ListingFormRow ui={ui} label="One price and quantity" hint="Turn variations on if size or color changes the offer.">
          <Text fontSize={13} color={ui.textSecondary}>
            Price and quantity above apply to the whole listing.
          </Text>
        </ListingFormRow>
      )}
    </ListingPublishCard>
  )
}

function variationLink(row: Partial<ListingVariationInsert>) {
  const tempKey = (row.variation_metadata as { tempKey?: string } | null)?.tempKey ?? null
  const variationId = (row as { id?: string | null }).id ?? null
  return { tempKey, variationId }
}

function VariationPhotos({
  ui,
  formData,
  row,
  onUpdate,
}: {
  ui: AppUiTokens
  formData: ListingFormData
  row: Partial<ListingVariationInsert>
  onUpdate: VariationsSectionProps['onUpdate']
}) {
  const photos = (formData.images ?? [])
    .map((image, index) => ({ image, index }))
    .filter(({ image }) => image.image_type !== 'video' && (image.image_url || image.blob))
  if (!photos.length) return null
  const link = variationLink(row)

  return (
    <YStack gap="$1">
      <Text fontSize={12} color={ui.textSecondary}>
        Link a photo
      </Text>
      <XStack gap="$2" flexWrap="wrap">
        {photos.map(({ image, index }, photoNumber) => {
          const linked =
            Boolean(link.tempKey && image.variant_temp_key === link.tempKey) ||
            Boolean(link.variationId && image.variation_id === link.variationId)
          return (
            <Text
              key={image.id ?? `${index}`}
              fontSize={12}
              fontWeight={linked ? '700' : '500'}
              color={linked ? ui.text : ui.textMuted}
              cursor="pointer"
              onPress={() => {
                const images = formData.images ?? []
                onUpdate(
                  'images',
                  images.map((item, i) => {
                    if (i !== index) return item
                    if (linked) return { ...item, variant_temp_key: null, variation_id: null }
                    return { ...item, variant_temp_key: link.tempKey, variation_id: link.variationId }
                  }),
                )
              }}
            >
              {linked ? `Photo ${photoNumber + 1} linked` : `Photo ${photoNumber + 1}`}
            </Text>
          )
        })}
      </XStack>
    </YStack>
  )
}

function VaryRow({
  ui,
  label,
  checked,
  onChange,
}: {
  ui: AppUiTokens
  label: string
  checked: boolean
  onChange: (value: boolean) => void
}) {
  return (
    <XStack alignItems="center" justifyContent="space-between">
      <Text fontSize={13} color={ui.text}>
        {label}
      </Text>
      <Switch checked={checked} onCheckedChange={onChange} />
    </XStack>
  )
}
