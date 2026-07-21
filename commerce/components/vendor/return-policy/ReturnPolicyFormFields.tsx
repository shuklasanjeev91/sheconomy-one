import { useMemo } from 'react'

import { Field, Icons, Input, Select, SelectContent, SelectItem, SelectTrigger, SelectViewport, Switch, Text, TextArea, XStack, YStack } from '~/components/ui'
import { radius } from '~/config/tokens'
import { RETURN_POLICY_UI_COPY } from '~/lib/return-policy/return-policy-ui.copy'
import {
  getCharacterLimit,
  getReturnPolicyServiceOptions,
  getReturnPolicyWindowOptions,
  getReturnShippingOptions,
} from '~/lib/return-policy/return-policy-ui.utils'
import type { ReturnPolicyFormData } from '~/lib/return-policy/return-policy.type'
import type { AppUiTokens } from '~/lib/theme/app-ui'

const SERVICE_ICONS = {
  Undo2: Icons.Undo2,
  Repeat: Icons.Repeat,
  Banknote: Icons.Banknote,
} as const

type ReturnPolicyFormFieldsProps = {
  ui: AppUiTokens
  form: ReturnPolicyFormData
  errors: Record<string, string>
  disabled?: boolean
  onChange: (patch: Partial<ReturnPolicyFormData>) => void
}

export function ReturnPolicyFormFields({
  ui,
  form,
  errors,
  disabled,
  onChange,
}: ReturnPolicyFormFieldsProps) {
  const windowOptions = useMemo(() => getReturnPolicyWindowOptions(), [])
  const serviceOptions = useMemo(() => getReturnPolicyServiceOptions(), [])
  const shippingOptions = useMemo(() => getReturnShippingOptions(), [])

  const conditionLimit = getCharacterLimit('condition')
  const detailsLimit = getCharacterLimit('details')

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
            {RETURN_POLICY_UI_COPY.inactiveBanner}
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
        <Text fontSize={15} fontWeight="800" color={ui.text}>
          {RETURN_POLICY_UI_COPY.policyIdentity}
        </Text>
        <Field label={RETURN_POLICY_UI_COPY.policyNameLabel} required error={errors.policy_name}>
          <Input
            value={form.policy_name}
            onChangeText={(value) => onChange({ policy_name: value })}
            placeholder={RETURN_POLICY_UI_COPY.policyNamePlaceholder}
            disabled={disabled}
          />
        </Field>
        <Field label={RETURN_POLICY_UI_COPY.returnWindowLabel} error={errors.return_window_days}>
          <Select
            value={String(form.return_window_days)}
            onValueChange={(value) => onChange({ return_window_days: Number(value) })}
            disabled={disabled}
          >
            <SelectTrigger width="100%">
              <Select.Value placeholder={RETURN_POLICY_UI_COPY.returnWindowLabel} />
            </SelectTrigger>
            <SelectContent zIndex={300001}>
              <SelectViewport>
                {windowOptions.map((option, index) => (
                  <SelectItem key={option.value} index={index} value={String(option.value)}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectViewport>
            </SelectContent>
          </Select>
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
        <YStack gap="$1">
          <Text fontSize={15} fontWeight="800" color={ui.text}>
            {RETURN_POLICY_UI_COPY.acceptedServices}
          </Text>
          <Text fontSize={12.5} color={ui.textMuted}>
            {RETURN_POLICY_UI_COPY.acceptedServicesHint}
          </Text>
        </YStack>
        <XStack gap="$2.5" flexWrap="wrap">
          {serviceOptions.map((option) => {
            const Icon = SERVICE_ICONS[option.icon]
            const checked = form[option.id]
            return (
              <XStack
                key={option.id}
                alignItems="center"
                gap="$2"
                paddingHorizontal="$3"
                paddingVertical="$3"
                borderRadius={radius.chip}
                borderWidth={1}
                cursor={disabled ? 'default' : 'pointer'}
                borderColor={checked ? ui.brand : ui.borderSubtle}
                backgroundColor={checked ? ui.roseSurface : ui.surfaceMuted}
                flexBasis="30%"
                flexGrow={1}
                minWidth={140}
                onPress={disabled ? undefined : () => onChange({ [option.id]: !checked })}
              >
                <YStack
                  width={34}
                  height={34}
                  borderRadius={999}
                  alignItems="center"
                  justifyContent="center"
                  backgroundColor={checked ? ui.brand : ui.surface}
                >
                  <Icon size={16} color={checked ? ui.onBrand : ui.textSecondary} />
                </YStack>
                <Text flex={1} fontSize={13} fontWeight="700" color={ui.text}>
                  {option.label}
                </Text>
                {checked ? <Icons.Check size={16} color={ui.brand} /> : null}
              </XStack>
            )
          })}
        </XStack>
      </YStack>

      <YStack
        gap="$3"
        padding="$4"
        borderRadius={radius.card}
        borderWidth={1}
        borderColor={ui.borderSubtle}
        backgroundColor={ui.surface}
      >
        <YStack gap="$1">
          <Text fontSize={15} fontWeight="800" color={ui.text}>
            {RETURN_POLICY_UI_COPY.returnShipping}
          </Text>
          <Text fontSize={12.5} color={ui.textMuted}>
            {RETURN_POLICY_UI_COPY.returnShippingHint}
          </Text>
        </YStack>
        <YStack gap="$2">
          {shippingOptions.map((option) => {
            const selected = form.return_shipping_paid_by === option.value
            return (
              <XStack
                key={option.value}
                alignItems="center"
                gap="$2.5"
                padding="$3"
                borderRadius={radius.chip}
                borderWidth={1}
                cursor={disabled ? 'default' : 'pointer'}
                borderColor={selected ? ui.brand : ui.borderSubtle}
                backgroundColor={selected ? ui.roseSurface : ui.surfaceMuted}
                onPress={disabled ? undefined : () => onChange({ return_shipping_paid_by: option.value })}
              >
                <YStack
                  width={18}
                  height={18}
                  borderRadius={999}
                  borderWidth={2}
                  borderColor={selected ? ui.brand : ui.borderSubtle}
                  alignItems="center"
                  justifyContent="center"
                >
                  {selected ? <YStack width={8} height={8} borderRadius={999} backgroundColor={ui.brand} /> : null}
                </YStack>
                <Text fontSize={13} fontWeight="700" color={ui.text}>
                  {option.label}
                </Text>
              </XStack>
            )
          })}
        </YStack>
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
          {RETURN_POLICY_UI_COPY.policyDetails}
        </Text>
        <Field
          label={RETURN_POLICY_UI_COPY.conditionDescriptionLabel}
          error={errors.condition_description}
          hint={`${form.condition_description.length}/${conditionLimit}`}
        >
          <TextArea
            value={form.condition_description}
            onChangeText={(value) => onChange({ condition_description: value })}
            placeholder={RETURN_POLICY_UI_COPY.conditionDescriptionPlaceholder}
            minHeight={90}
            disabled={disabled}
          />
        </Field>
        <Field
          label={RETURN_POLICY_UI_COPY.policyDetailsLabel}
          error={errors.policy_details}
          hint={`${form.policy_details.length}/${detailsLimit}`}
        >
          <TextArea
            value={form.policy_details}
            onChangeText={(value) => onChange({ policy_details: value })}
            placeholder={RETURN_POLICY_UI_COPY.policyDetailsPlaceholder}
            minHeight={110}
            disabled={disabled}
          />
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
          {RETURN_POLICY_UI_COPY.policySettings}
        </Text>
        <XStack alignItems="center" justifyContent="space-between" gap="$3">
          <YStack flex={1} minWidth={0} gap={2}>
            <Text fontSize={13} fontWeight="700" color={ui.text}>
              {RETURN_POLICY_UI_COPY.defaultPolicy}
            </Text>
            <Text fontSize={12} color={ui.textMuted}>
              {RETURN_POLICY_UI_COPY.defaultPolicyHint}
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
            <Text fontSize={13} fontWeight="700" color={ui.text}>
              {RETURN_POLICY_UI_COPY.activePolicy}
            </Text>
            <Text fontSize={12} color={ui.textMuted}>
              {RETURN_POLICY_UI_COPY.activePolicyHint}
            </Text>
          </YStack>
          <Switch
            checked={form.is_active}
            disabled={disabled}
            onCheckedChange={(checked) => onChange({ is_active: checked })}
          />
        </XStack>
        {!form.is_active ? (
          <XStack
            gap="$2"
            padding="$2.5"
            borderRadius={radius.chip}
            backgroundColor="#FFFBEB"
            borderWidth={1}
            borderColor="#FDE68A"
            alignItems="center"
          >
            <Icons.Info size={16} color="#B45309" />
            <Text fontSize={12} color="#92400E" flex={1}>
              {RETURN_POLICY_UI_COPY.inactiveWarning}
            </Text>
          </XStack>
        ) : null}
      </YStack>
    </YStack>
  )
}
