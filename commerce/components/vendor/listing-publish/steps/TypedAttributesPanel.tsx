import { useState } from 'react'

import {
  Button,
  Field,
  Input,
  Switch,
  Text,
  TextArea,
  XStack,
  YStack,
} from '~/components/ui'
import type { ListingFormData } from '~/lib/listing/listing.type'
import {
  attributeValuePresent,
  type ListingAttributeValueDraft,
  type ProductTypeAttributeDef,
  type ProductTypeCatalog,
} from '~/lib/listing/product-catalog'
import type { AppUiTokens } from '~/lib/theme/app-ui'

import { ListingPublishCard, ListingPublishFieldError } from '~/commerce/components/vendor/listing-publish/ListingPublishCard'

type TypedAttributesPanelProps = {
  ui: AppUiTokens
  formData: ListingFormData
  errors: Record<string, string>
  catalog: ProductTypeCatalog | null
  onUpdate: <K extends keyof ListingFormData>(field: K, value: ListingFormData[K]) => void
}

function draftFor(
  values: ListingAttributeValueDraft[],
  attributeId: string,
): ListingAttributeValueDraft {
  return (
    values.find((row) => row.attribute_id === attributeId) ?? {
      attribute_id: attributeId,
      value_text: '',
    }
  )
}

export function TypedAttributesPanel({
  ui,
  formData,
  errors,
  catalog,
  onUpdate,
}: TypedAttributesPanelProps) {
  const values = formData.attribute_values ?? []
  if (!catalog?.attributes.length) return null

  function write(next: ListingAttributeValueDraft) {
    const without = values.filter((row) => row.attribute_id !== next.attribute_id)
    onUpdate('attribute_values', [...without, next])
  }

  const ordered = [...catalog.attributes].sort((a, b) => a.display_order - b.display_order)

  return (
    <ListingPublishCard ui={ui} title={`${catalog.name} attributes`}>
      <Text fontSize={12} color={ui.textMuted} lineHeight={18}>
        Required fields come from this product type. Recommended fields help shoppers compare.
      </Text>
      {ordered.map((def) => (
        <AttributeField
          key={def.id}
          ui={ui}
          def={def}
          draft={draftFor(values, def.id)}
          error={errors[`attr_${def.code}`]}
          onChange={write}
        />
      ))}
    </ListingPublishCard>
  )
}

function AttributeField({
  ui,
  def,
  draft,
  error,
  onChange,
}: {
  ui: AppUiTokens
  def: ProductTypeAttributeDef
  draft: ListingAttributeValueDraft
  error?: string
  onChange: (next: ListingAttributeValueDraft) => void
}) {
  const label = def.is_required ? `${def.label} *` : def.is_recommended ? `${def.label} (recommended)` : def.label
  const selected = new Set(
    Array.isArray(draft.value_json) ? draft.value_json.map(String) : draft.value_text ? [draft.value_text] : [],
  )
  const [unit, setUnit] = useState(() => {
    const raw = draft.value_json
    if (raw && typeof raw === 'object' && !Array.isArray(raw) && 'unit' in raw) {
      return String((raw as { unit?: string }).unit || def.unit || '')
    }
    return def.unit || ''
  })

  return (
    <YStack gap="$1.5" width="100%">
      <Field label={label} error={error}>
        {def.data_type === 'boolean' ? (
          <XStack alignItems="center" minHeight={40} gap="$2">
            <Switch
              checked={Boolean(draft.value_boolean)}
              onCheckedChange={(checked) => onChange({ ...draft, value_boolean: Boolean(checked) })}
            />
            <Text fontSize={13} color={ui.textSecondary}>
              {draft.value_boolean ? 'Yes' : 'No'}
            </Text>
          </XStack>
        ) : def.data_type === 'enum' ? (
          <XStack gap="$2" flexWrap="wrap">
            {def.options.map((option) => {
              const active = draft.value_text === option.value
              return (
                <Button
                  key={option.value}
                  size="$2"
                  tone={active ? 'primary' : 'outline'}
                  onPress={() => onChange({ ...draft, value_text: option.value })}
                >
                  {option.label}
                </Button>
              )
            })}
          </XStack>
        ) : def.data_type === 'multi_enum' ? (
          <XStack gap="$2" flexWrap="wrap">
            {def.options.map((option) => {
              const active = selected.has(option.value)
              return (
                <Button
                  key={option.value}
                  size="$2"
                  tone={active ? 'primary' : 'outline'}
                  onPress={() => {
                    const next = new Set(selected)
                    if (active) next.delete(option.value)
                    else next.add(option.value)
                    onChange({ ...draft, value_json: [...next], value_text: null })
                  }}
                >
                  {option.label}
                </Button>
              )
            })}
          </XStack>
        ) : def.data_type === 'measurement' ? (
          <XStack gap="$2">
            <Input
              flex={1}
              keyboardType="decimal-pad"
              value={
                draft.value_json && typeof draft.value_json === 'object' && 'value' in (draft.value_json as object)
                  ? String((draft.value_json as { value?: unknown }).value ?? '')
                  : ''
              }
              onChangeText={(value) =>
                onChange({
                  ...draft,
                  value_json: { value, unit: unit || def.unit || '' },
                })
              }
              placeholder={def.unit || 'Amount'}
            />
            <Input
              width={90}
              value={unit}
              onChangeText={(nextUnit) => {
                setUnit(nextUnit)
                const current =
                  draft.value_json && typeof draft.value_json === 'object'
                    ? (draft.value_json as { value?: unknown }).value
                    : ''
                onChange({ ...draft, value_json: { value: current ?? '', unit: nextUnit } })
              }}
              placeholder={def.unit || 'Unit'}
            />
          </XStack>
        ) : def.data_type === 'text' && (def.max_length ?? 0) > 120 ? (
          <TextArea
            minHeight={72}
            value={draft.value_text ?? ''}
            onChangeText={(value) => onChange({ ...draft, value_text: value })}
          />
        ) : (
          <Input
            value={
              def.data_type === 'number'
                ? draft.value_number != null
                  ? String(draft.value_number)
                  : ''
                : (draft.value_text ?? '')
            }
            keyboardType={def.data_type === 'number' ? 'decimal-pad' : 'default'}
            placeholder={def.data_type === 'date' ? 'YYYY-MM-DD' : undefined}
            onChangeText={(value) =>
              def.data_type === 'number'
                ? onChange({ ...draft, value_number: value })
                : onChange({ ...draft, value_text: value })
            }
          />
        )}
      </Field>
      {!attributeValuePresent(def, draft) && def.description ? (
        <Text fontSize={11} color={ui.textMuted}>
          {def.description}
        </Text>
      ) : null}
      <ListingPublishFieldError ui={ui} message={error} />
    </YStack>
  )
}
