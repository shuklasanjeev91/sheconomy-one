import { useMemo, useState } from 'react'

import {
  Field,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectViewport,
  ScrollView,
  Text,
  Input,
  XStack,
  YStack,
} from '~/components/ui'
import { radius } from '~/config/tokens'
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

const FAMILY_LABELS: Record<string, string> = {
  apparel: 'Clothes',
  beauty: 'Beauty',
  jewelry: 'Jewellery',
  food: 'Food',
  home: 'Home',
  kids: 'Kids',
  wellness: 'Wellness',
  electronics: 'Electronics',
  digital: 'Digital',
  general: 'Everyday',
}

const FAMILY_ORDER = [
  'apparel',
  'beauty',
  'jewelry',
  'food',
  'home',
  'kids',
  'wellness',
  'electronics',
  'digital',
  'general',
]

const BARCODE_LABELS: Record<string, string> = {
  ean: '13-digit barcode (most common in India)',
  upc: '12-digit barcode',
  gtin: '8, 12, 13, or 14 digits',
  isbn: 'Book number (ISBN)',
}

function familyLabel(family: string) {
  return FAMILY_LABELS[family] ?? 'Everyday'
}

export function IdentityStep({ ui, formData, errors, productTypes, onUpdate }: IdentityStepProps) {
  const isDigital = formData.listing_type === LISTING_TYPES.DIGITAL
  const identifier = formData.product_identifier ?? EMPTY_PRODUCT_IDENTIFIER
  const exempt = Boolean(identifier.gtin_exemption)
  const [query, setQuery] = useState('')
  const [family, setFamily] = useState<string | 'all'>('all')
  const [showAll, setShowAll] = useState(false)

  const families = useMemo(() => {
    const present = new Set(productTypes.map((type) => type.family))
    return FAMILY_ORDER.filter((key) => present.has(key))
  }, [productTypes])

  const selected = productTypes.find((type) => type.id === formData.product_type_id) ?? null
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return productTypes.filter((type) => {
      if (family !== 'all' && type.family !== family) return false
      if (!needle) return true
      return (
        type.name.toLowerCase().includes(needle) ||
        familyLabel(type.family).toLowerCase().includes(needle)
      )
    })
  }, [family, productTypes, query])

  const narrowed = Boolean(query.trim()) || family !== 'all' || showAll
  const visible = narrowed ? filtered.slice(0, 40) : filtered.slice(0, 8)

  function patchIdentifier(patch: Partial<typeof identifier>) {
    onUpdate('product_identifier', { ...identifier, ...patch })
  }

  return (
    <YStack gap="$4" width="100%">
      <ListingPublishCard ui={ui} title="What kind of product is this?">
        <Text fontSize={13} color={ui.textSecondary} lineHeight={20}>
          Search for something you recognise, such as saree, serum, or pickle. Later steps ask only
          for the details that kind of product needs. You can save a draft and come back.
        </Text>
        {selected ? (
          <YStack
            padding="$3"
            borderRadius={radius.card}
            backgroundColor={ui.roseSurface}
            borderWidth={1}
            borderColor={ui.brand}
            gap="$1"
          >
            <Text fontSize={12} fontWeight="700" color={ui.brand}>
              You chose
            </Text>
            <Text fontSize={16} fontWeight="800" color={ui.text}>
              {selected.name}
            </Text>
            <Text fontSize={12} color={ui.textMuted}>
              {familyLabel(selected.family)}. Change it any time before you publish.
            </Text>
          </YStack>
        ) : null}
        <Input
          value={query}
          onChangeText={(value) => {
            setQuery(value)
            setShowAll(false)
          }}
          placeholder="Search, such as saree, serum, or pickle"
        />
        <XStack gap="$2" flexWrap="wrap">
          <FamilyChip
            ui={ui}
            label="All"
            selected={family === 'all'}
            onPress={() => setFamily('all')}
          />
          {families.map((key) => (
            <FamilyChip
              key={key}
              ui={ui}
              label={familyLabel(key)}
              selected={family === key}
              onPress={() => setFamily(key)}
            />
          ))}
        </XStack>
        <ScrollView style={{ maxHeight: 280 }} showsVerticalScrollIndicator>
          <YStack gap="$1.5">
            {visible.map((type) => {
              const active = type.id === formData.product_type_id
              return (
                <XStack
                  key={type.id}
                  alignItems="center"
                  justifyContent="space-between"
                  gap="$3"
                  paddingHorizontal="$3"
                  paddingVertical="$2.5"
                  borderRadius={10}
                  borderWidth={1}
                  borderColor={active ? ui.brand : ui.borderSubtle}
                  backgroundColor={active ? ui.roseSurface : ui.surface}
                  cursor="pointer"
                  onPress={() => onUpdate('product_type_id', type.id)}
                  hoverStyle={{ borderColor: ui.brand }}
                >
                  <Text flex={1} fontSize={14} fontWeight={active ? '800' : '600'} color={ui.text}>
                    {type.name}
                  </Text>
                  <Text fontSize={12} color={ui.textMuted}>
                    {familyLabel(type.family)}
                  </Text>
                </XStack>
              )
            })}
            {visible.length === 0 ? (
              <Text fontSize={13} color={ui.textMuted} lineHeight={20}>
                Nothing matches that search. Try a simpler word, such as food or jewellery.
              </Text>
            ) : null}
          </YStack>
        </ScrollView>
        {!narrowed && filtered.length > visible.length ? (
          <Text
            fontSize={13}
            fontWeight="700"
            color={ui.brand}
            cursor="pointer"
            onPress={() => setShowAll(true)}
          >
            Show {filtered.length - visible.length} more
          </Text>
        ) : (
          <Text fontSize={12} color={ui.textMuted}>
            {filtered.length} kinds of products
            {query.trim() ? ' match your search' : ''}.
          </Text>
        )}
        <ListingPublishFieldError ui={ui} message={errors.product_type_id} />
      </ListingPublishCard>

      {isDigital ? (
        <ListingPublishCard ui={ui} title="Barcode">
          <Text fontSize={13} color={ui.textSecondary} lineHeight={20}>
            Downloads and digital files do not need a barcode.
          </Text>
        </ListingPublishCard>
      ) : (
        <>
          <ListingPublishCard ui={ui} title="Is this new?">
            <Text fontSize={13} color={ui.textSecondary} lineHeight={20}>
              Most products are new. Pick another option if someone has used it, or if you restored it.
            </Text>
            <XStack gap="$2" flexWrap="wrap">
              {ITEM_CONDITIONS.map((condition) => {
                const active = (formData.item_condition ?? 'new') === condition.value
                return (
                  <YStack
                    key={condition.value}
                    paddingHorizontal="$3"
                    paddingVertical="$2"
                    borderRadius={999}
                    borderWidth={1.5}
                    borderColor={active ? ui.brand : ui.borderSubtle}
                    backgroundColor={active ? ui.brand : ui.surface}
                    cursor="pointer"
                    onPress={() => onUpdate('item_condition', condition.value)}
                  >
                    <Text fontSize={13} fontWeight="700" color={active ? '#FFFFFF' : ui.text}>
                      {condition.label}
                    </Text>
                  </YStack>
                )
              })}
            </XStack>
            <ListingPublishFieldError ui={ui} message={errors.item_condition} />
          </ListingPublishCard>

          <ListingPublishCard ui={ui} title="Does it have a barcode?">
            <XStack gap="$3" flexWrap="wrap">
              <ChoiceCard
                ui={ui}
                title="Yes, it has a barcode"
                body="Type the numbers printed under the bars."
                selected={!exempt}
                onPress={() =>
                  patchIdentifier({
                    gtin_exemption: false,
                    gtin_exemption_reason: null,
                    product_id_type: identifier.product_id_type === 'none' ? 'ean' : identifier.product_id_type,
                  })
                }
              />
              <ChoiceCard
                ui={ui}
                title="No barcode"
                body="Handmade, your own brand, a set, or a spare part."
                selected={exempt}
                onPress={() =>
                  patchIdentifier({
                    gtin_exemption: true,
                    product_id_type: 'none',
                    product_id_value: '',
                    gtin_exemption_reason: identifier.gtin_exemption_reason,
                  })
                }
              />
            </XStack>

            {exempt ? (
              <Field label="Why is there no barcode?" error={errors.gtin_exemption_reason}>
                <Select
                  value={identifier.gtin_exemption_reason || undefined}
                  onValueChange={(value) => patchIdentifier({ gtin_exemption_reason: value })}
                >
                  <SelectTrigger width="100%">
                    <Select.Value placeholder="Choose the closest reason" />
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
                <Field label="What kind of barcode is it?">
                  <Select
                    value={identifier.product_id_type === 'none' ? 'ean' : identifier.product_id_type}
                    onValueChange={(value) =>
                      patchIdentifier({ product_id_type: value as ProductIdType })
                    }
                  >
                    <SelectTrigger width="100%">
                      <Select.Value placeholder="13-digit barcode" />
                    </SelectTrigger>
                    <SelectContent zIndex={300000}>
                      <SelectViewport>
                        {PRODUCT_ID_TYPES.filter((type) => type.value !== 'none').map((type, index) => (
                          <SelectItem key={type.value} index={index} value={type.value}>
                            <Select.ItemText>{BARCODE_LABELS[type.value] ?? type.label}</Select.ItemText>
                          </SelectItem>
                        ))}
                      </SelectViewport>
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Barcode number" error={errors.product_id_value}>
                  <Input
                    value={identifier.product_id_value ?? ''}
                    onChangeText={(value) => patchIdentifier({ product_id_value: value })}
                    placeholder="Numbers under the barcode"
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

function FamilyChip({
  ui,
  label,
  selected,
  onPress,
}: {
  ui: AppUiTokens
  label: string
  selected: boolean
  onPress: () => void
}) {
  return (
    <YStack
      paddingHorizontal="$3"
      paddingVertical="$1.5"
      borderRadius={999}
      borderWidth={1}
      borderColor={selected ? ui.brand : ui.borderSubtle}
      backgroundColor={selected ? ui.roseSurface : ui.surface}
      cursor="pointer"
      onPress={onPress}
    >
      <Text fontSize={12} fontWeight="700" color={selected ? ui.brand : ui.textSecondary}>
        {label}
      </Text>
    </YStack>
  )
}

function ChoiceCard({
  ui,
  title,
  body,
  selected,
  onPress,
}: {
  ui: AppUiTokens
  title: string
  body: string
  selected: boolean
  onPress: () => void
}) {
  return (
    <YStack
      flex={1}
      minWidth={220}
      gap="$1"
      padding="$3.5"
      borderRadius={radius.card}
      borderWidth={1.5}
      borderColor={selected ? ui.brand : ui.borderSubtle}
      backgroundColor={selected ? ui.roseSurface : ui.surface}
      cursor="pointer"
      onPress={onPress}
    >
      <Text fontSize={15} fontWeight="800" color={ui.text}>
        {title}
      </Text>
      <Text fontSize={12} color={ui.textMuted} lineHeight={18}>
        {body}
      </Text>
    </YStack>
  )
}
