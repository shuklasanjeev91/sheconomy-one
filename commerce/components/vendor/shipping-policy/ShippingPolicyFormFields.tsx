import { useMemo } from 'react'

import { ShippingZoneManager } from '~/commerce/components/vendor/shipping-policy/ShippingZoneManager'
import {
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
import { radius } from '~/config/tokens'
import { formatCurrency } from '~/lib/format'
import { SHIPPING_PROCESSING_PRESETS, SHIPPING_RATE_TYPE } from '~/lib/shipping-policy/shipping-policy.constants'
import {
  SHIPPING_POLICY_UI_COPY,
  SHIPPING_RATE_TYPE_UI_OPTIONS,
} from '~/lib/shipping-policy/shipping-policy-ui.copy'
import {
  applyFixedFeeToForm,
  applyFreeThresholdToForm,
  applyProcessingPreset,
  applyRateTypeToForm,
  buildShopShippingZone,
  getProcessingPresetValue,
} from '~/lib/shipping-policy/shipping-policy-ui.utils'
import type { ShippingPolicyFormData } from '~/lib/shipping-policy/shipping-policy.type'
import type { AppUiTokens } from '~/lib/theme/app-ui'

type ShippingPolicyFormFieldsProps = {
  ui: AppUiTokens
  form: ShippingPolicyFormData
  errors: Record<string, string>
  currencyCode: string
  shopCountry?: string | null
  disabled?: boolean
  onChange: (patch: Partial<ShippingPolicyFormData>) => void
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

export function ShippingPolicyFormFields({
  ui,
  form,
  errors,
  currencyCode,
  shopCountry,
  disabled,
  onChange,
}: ShippingPolicyFormFieldsProps) {
  const processingValue = getProcessingPresetValue(form.processing_time_min, form.processing_time_max)
  const isFixed = form.shipping_rate_type === SHIPPING_RATE_TYPE.FIXED
  const isVariable = form.shipping_rate_type === SHIPPING_RATE_TYPE.VARIABLE

  const shopRates = useMemo(() => form.shipping_zones[0]?.rates ?? [], [form.shipping_zones])

  const summaryFee = formatCurrency(form.fixed_fee ?? 0, currencyCode)
  const summaryThreshold =
    form.free_shipping_threshold != null && form.free_shipping_threshold > 0
      ? formatCurrency(form.free_shipping_threshold, currencyCode)
      : null

  return (
    <YStack gap="$4">
      {!form.is_active ? (
        <XStack
          gap="$2.5"
          padding="$3"
          borderRadius={radius.chip}
          backgroundColor="#FEF2F2"
          borderWidth={1}
          borderColor="#FECACA"
          alignItems="flex-start"
        >
          <Icons.AlertTriangle size={18} color={ui.danger} />
          <Text flex={1} fontSize={12.5} color="#991B1B" lineHeight={18}>
            {SHIPPING_POLICY_UI_COPY.inactiveBanner}
          </Text>
        </XStack>
      ) : null}

      <YStack
        gap="$3.5"
        padding="$4"
        borderRadius={radius.card}
        borderWidth={1}
        borderColor={ui.borderSubtle}
        backgroundColor={ui.surface}
      >
        <YStack gap="$1">
          <Text fontSize={15} fontWeight="800" color={ui.text}>
            {SHIPPING_POLICY_UI_COPY.shopLevelHeader}
          </Text>
          <Text fontSize={12.5} color={ui.textMuted}>
            {SHIPPING_POLICY_UI_COPY.shopLevelSubtitle}
          </Text>
        </YStack>

        <Field label={SHIPPING_POLICY_UI_COPY.rateTypeLabel} error={errors.shipping_rate_type}>
          <Select
            value={form.shipping_rate_type}
            onValueChange={(value) =>
              onChange(applyRateTypeToForm(value as ShippingPolicyFormData['shipping_rate_type'], form, shopCountry))
            }
            disabled={disabled}
          >
            <SelectTrigger width="100%">
              <Select.Value placeholder={SHIPPING_POLICY_UI_COPY.rateTypePlaceholder} />
            </SelectTrigger>
            <SelectContent zIndex={300001}>
              <SelectViewport>
                {SHIPPING_RATE_TYPE_UI_OPTIONS.map((option, index) => (
                  <SelectItem key={option.value} index={index} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectViewport>
            </SelectContent>
          </Select>
        </Field>

        {SHIPPING_RATE_TYPE_UI_OPTIONS.map((option) => {
          if (option.value !== form.shipping_rate_type) return null
          return (
            <Text key={option.value} fontSize={12.5} color={ui.textMuted} lineHeight={18}>
              {option.hint}
            </Text>
          )
        })}
      </YStack>

      {isFixed ? (
        <YStack
          gap="$3.5"
          padding="$4"
          borderRadius={radius.card}
          borderWidth={1}
          borderColor={ui.borderSubtle}
          backgroundColor={ui.surface}
        >
          <Text fontSize={15} fontWeight="800" color={ui.text}>
            {SHIPPING_POLICY_UI_COPY.fixedRateTitle}
          </Text>
          <Field label={SHIPPING_POLICY_UI_COPY.deliveryFeeLabel} error={errors.fixed_fee ?? errors.shipping_zones}>
            <Input
              value={String(form.fixed_fee ?? 0)}
              onChangeText={(value) =>
                onChange(applyFixedFeeToForm(form, parseAmount(value), shopCountry))
              }
              placeholder={SHIPPING_POLICY_UI_COPY.deliveryFeePlaceholder}
              keyboardType="decimal-pad"
              disabled={disabled}
            />
            <Text fontSize={11.5} color={ui.textMuted}>
              {SHIPPING_POLICY_UI_COPY.deliveryFeeHint}
            </Text>
          </Field>
          <Field
            label={SHIPPING_POLICY_UI_COPY.freeShippingAboveLabel}
            error={errors.free_shipping_threshold}
          >
            <Input
              value={form.free_shipping_threshold != null ? String(form.free_shipping_threshold) : ''}
              onChangeText={(value) =>
                onChange(applyFreeThresholdToForm(form, parseOptionalAmount(value), shopCountry))
              }
              placeholder={SHIPPING_POLICY_UI_COPY.freeShippingAbovePlaceholder}
              keyboardType="decimal-pad"
              disabled={disabled}
            />
            <Text fontSize={11.5} color={ui.textMuted}>
              {SHIPPING_POLICY_UI_COPY.freeShippingAboveHint}
            </Text>
          </Field>
        </YStack>
      ) : null}

      {isVariable ? (
        <YStack
          gap="$3"
          padding="$4"
          borderRadius={radius.card}
          borderWidth={1}
          borderColor={ui.borderSubtle}
          backgroundColor={ui.surface}
        >
          <ShippingZoneManager
            ui={ui}
            rates={shopRates}
            currencyCode={currencyCode}
            disabled={disabled}
            error={errors.shipping_zones}
            onChange={(rates) => {
              const zones = form.shipping_zones.length
                ? [...form.shipping_zones]
                : [buildShopShippingZone(shopCountry, rates)]
              zones[0] = { ...zones[0], rates }
              onChange({ shipping_zones: zones })
            }}
          />
        </YStack>
      ) : null}

      <YStack
        gap="$3"
        padding="$4"
        borderRadius={radius.card}
        borderWidth={1}
        borderColor={ui.borderSubtle}
        backgroundColor={ui.surfaceMuted}
      >
        <Text fontSize={14} fontWeight="800" color={ui.text}>
          {SHIPPING_POLICY_UI_COPY.summaryTitle}
        </Text>
        <Text fontSize={13} color={ui.textSecondary}>
          {SHIPPING_POLICY_UI_COPY.summaryDeliveryFee}: {summaryFee}
        </Text>
        {summaryThreshold ? (
          <Text fontSize={13} color={ui.textSecondary}>
            {SHIPPING_POLICY_UI_COPY.summaryFreeShipping} {summaryThreshold}
          </Text>
        ) : null}
      </YStack>

      <YStack
        gap="$3.5"
        padding="$4"
        borderRadius={radius.card}
        borderWidth={1}
        borderColor={ui.borderSubtle}
        backgroundColor={ui.surface}
      >
        <Field
          label={SHIPPING_POLICY_UI_COPY.processingTimeLabel}
          error={errors.processing_time_min ?? errors.processing_time_max}
        >
          <Select
            value={processingValue}
            onValueChange={(value) => onChange(applyProcessingPreset(value))}
            disabled={disabled}
          >
            <SelectTrigger width="100%">
              <Select.Value placeholder={SHIPPING_POLICY_UI_COPY.processingTimeLabel} />
            </SelectTrigger>
            <SelectContent zIndex={300001}>
              <SelectViewport>
                {SHIPPING_PROCESSING_PRESETS.map((option, index) => (
                  <SelectItem key={option.value} index={index} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectViewport>
            </SelectContent>
          </Select>
          <Text fontSize={11.5} color={ui.textMuted}>
            {SHIPPING_POLICY_UI_COPY.processingTimeHint}
          </Text>
        </Field>
      </YStack>

      <YStack
        gap="$3"
        padding="$4"
        borderRadius={radius.card}
        borderWidth={1}
        borderColor={ui.borderSubtle}
        backgroundColor={ui.surface}
      >
        <Text fontSize={15} fontWeight="800" color={ui.text}>
          {SHIPPING_POLICY_UI_COPY.profileSettings}
        </Text>
        <XStack alignItems="center" justifyContent="space-between" gap="$3">
          <YStack flex={1} minWidth={0} gap={2}>
            <Text fontSize={14} fontWeight="700" color={ui.text}>
              {SHIPPING_POLICY_UI_COPY.defaultProfile}
            </Text>
            <Text fontSize={12} color={ui.textMuted}>
              {SHIPPING_POLICY_UI_COPY.defaultProfileHint}
            </Text>
          </YStack>
          <Switch
            checked={form.is_default}
            disabled={disabled}
            onCheckedChange={(checked) => onChange({ is_default: checked })}
          />
        </XStack>
        <XStack alignItems="center" justifyContent="space-between" gap="$3">
          <YStack flex={1} minWidth={0} gap={2}>
            <Text fontSize={14} fontWeight="700" color={ui.text}>
              {SHIPPING_POLICY_UI_COPY.activeProfile}
            </Text>
            <Text fontSize={12} color={ui.textMuted}>
              {SHIPPING_POLICY_UI_COPY.activePolicyHint}
            </Text>
          </YStack>
          <Switch
            checked={form.is_active}
            disabled={disabled}
            onCheckedChange={(checked) => onChange({ is_active: checked })}
          />
        </XStack>
      </YStack>
    </YStack>
  )
}
