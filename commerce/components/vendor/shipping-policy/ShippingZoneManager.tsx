import { Button, Field, Icons, Input, Text, XStack, YStack } from '~/components/ui'
import { radius } from '~/config/tokens'
import { formatCurrency } from '~/lib/format'
import { SHIPPING_POLICY_UI_COPY } from '~/lib/shipping-policy/shipping-policy-ui.copy'
import type { ShippingRate } from '~/lib/shipping-policy/shipping-policy.type'
import { sortRates, validateRateTierOverlap } from '~/lib/shipping-policy/shipping-policy-ui.utils'
import type { AppUiTokens } from '~/lib/theme/app-ui'

type ShippingZoneManagerProps = {
  ui: AppUiTokens
  rates: ShippingRate[]
  currencyCode: string
  disabled?: boolean
  error?: string
  onChange: (rates: ShippingRate[]) => void
}

function parseAmount(value: string): number {
  const parsed = Number.parseFloat(value.replace(/[^\d.-]/g, ''))
  return Number.isFinite(parsed) ? parsed : 0
}

function parseOptionalAmount(value: string): number | null {
  const trimmed = value.trim()
  if (!trimmed) return null
  const parsed = Number.parseFloat(trimmed.replace(/[^\d.-]/g, ''))
  return Number.isFinite(parsed) ? parsed : null
}

export function ShippingZoneManager({
  ui,
  rates,
  currencyCode,
  disabled,
  error,
  onChange,
}: ShippingZoneManagerProps) {
  const sortedRates = sortRates(rates)
  const overlapError = validateRateTierOverlap(sortedRates)

  function updateRate(index: number, patch: Partial<ShippingRate>) {
    const next = sortedRates.map((rate, i) => (i === index ? { ...rate, ...patch } : rate))
    onChange(next)
  }

  function removeRate(index: number) {
    onChange(sortedRates.filter((_, i) => i !== index))
  }

  function addRate() {
    const last = sortedRates[sortedRates.length - 1]
    const minOrder = last?.max_order != null ? last.max_order + 0.01 : (last?.min_order ?? 0) + 100
    onChange([
      ...sortedRates,
      {
        fee: 0,
        min_order: minOrder,
        max_order: null,
      },
    ])
  }

  const freeTier = sortedRates.find((rate) => rate.fee === 0 && (rate.min_order ?? 0) > 0)

  return (
    <YStack gap="$3">
      <YStack gap="$1">
        <Text fontSize={15} fontWeight="800" color={ui.text}>
          {SHIPPING_POLICY_UI_COPY.variableZonesTitle}
        </Text>
        <Text fontSize={12.5} color={ui.textMuted} lineHeight={18}>
          {SHIPPING_POLICY_UI_COPY.variableFreeHint}
        </Text>
        {freeTier ? (
          <Text fontSize={12.5} fontWeight="600" color={ui.brand}>
            {SHIPPING_POLICY_UI_COPY.variableFreeActive}{' '}
            {formatCurrency(freeTier.min_order, currencyCode)}
          </Text>
        ) : null}
      </YStack>

      {sortedRates.length === 0 ? (
        <YStack
          padding="$3"
          borderRadius={radius.chip}
          borderWidth={1}
          borderColor={ui.borderSubtle}
          backgroundColor={ui.surfaceMuted}
        >
          <Text fontSize={13} color={ui.textMuted}>
            {SHIPPING_POLICY_UI_COPY.zoneManagerNoRates}
          </Text>
        </YStack>
      ) : (
        <YStack gap="$2.5">
          {sortedRates.map((rate, index) => (
            <XStack
              key={`rate-${index}`}
              gap="$2"
              flexWrap="wrap"
              alignItems="flex-end"
              padding="$3"
              borderRadius={radius.chip}
              borderWidth={1}
              borderColor={ui.borderSubtle}
              backgroundColor={ui.surfaceMuted}
            >
              <Field label={SHIPPING_POLICY_UI_COPY.zoneManagerFee} flex={1} minWidth={100}>
                <Input
                  value={String(rate.fee ?? 0)}
                  onChangeText={(value) => updateRate(index, { fee: parseAmount(value) })}
                  keyboardType="decimal-pad"
                  disabled={disabled}
                />
              </Field>
              <Field label={SHIPPING_POLICY_UI_COPY.zoneManagerMinOrder} flex={1} minWidth={100}>
                <Input
                  value={String(rate.min_order ?? 0)}
                  onChangeText={(value) => updateRate(index, { min_order: parseAmount(value) })}
                  keyboardType="decimal-pad"
                  disabled={disabled}
                />
              </Field>
              <Field label={SHIPPING_POLICY_UI_COPY.zoneManagerMaxOrder} flex={1} minWidth={100}>
                <Input
                  value={rate.max_order != null ? String(rate.max_order) : ''}
                  onChangeText={(value) => updateRate(index, { max_order: parseOptionalAmount(value) })}
                  placeholder={SHIPPING_POLICY_UI_COPY.zoneManagerOptional}
                  keyboardType="decimal-pad"
                  disabled={disabled}
                />
              </Field>
              <Button
                tone="outline"
                size="$2"
                borderRadius={999}
                disabled={disabled}
                onPress={() => removeRate(index)}
                icon={<Icons.Trash2 size={14} color={ui.danger} />}
              >
                <Text color={ui.danger} fontSize={12}>
                  {SHIPPING_POLICY_UI_COPY.zoneManagerRemove}
                </Text>
              </Button>
            </XStack>
          ))}
        </YStack>
      )}

      <Button
        tone="outline"
        size="$3"
        borderRadius={999}
        alignSelf="flex-start"
        disabled={disabled}
        onPress={addRate}
        icon={<Icons.Plus size={15} />}
      >
        {SHIPPING_POLICY_UI_COPY.zoneManagerAddRate}
      </Button>

      {overlapError || error ? (
        <Text fontSize={12.5} color={ui.danger}>
          {overlapError ?? error}
        </Text>
      ) : null}
    </YStack>
  )
}
