import { useMemo, useState } from 'react'

import {
  Badge,
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
import { radius } from '~/config/tokens'
import { DISCOUNT_USER_TYPES } from '~/lib/discount/discount.constants'
import type { DiscountFormInput, DiscountType } from '~/lib/discount/discount.type'
import { DISCOUNT_UI_COPY } from '~/lib/discount/discount-ui.copy'
import {
  applyDiscountTypeChange,
  getAppliesToOptionsForType,
  getDiscountFormFieldVisibility,
  getDiscountTypeSelectOptions,
  type DiscountBogoUiState,
} from '~/lib/discount/discount-ui.utils'
import { generateDiscountCodeFromName } from '~/lib/discount/discount.utils'
import type { AppUiTokens } from '~/lib/theme/app-ui'

import { DiscountBogoPanel } from './DiscountBogoPanel'
import { DiscountEntityPicker } from './DiscountEntityPicker'
import { DiscountFormCard } from './DiscountFormCard'

export type DiscountCreateFormState = DiscountFormInput & {
  eligible_listings?: string[]
  eligible_categories?: string[]
}

type DiscountCreateFormProps = {
  ui: AppUiTokens
  shopId: string
  currency: string
  currencySymbol: string
  form: DiscountCreateFormState
  bogoUi: DiscountBogoUiState
  errors?: Record<string, string>
  busy?: boolean
  onChange: (form: DiscountCreateFormState) => void
  onBogoUiChange: (ui: DiscountBogoUiState) => void
  onSubmit: () => void
  onCancel: () => void
}

export function DiscountCreateForm({
  ui,
  shopId,
  currency,
  currencySymbol,
  form,
  bogoUi,
  errors,
  busy,
  onChange,
  onBogoUiChange,
  onSubmit,
  onCancel,
}: DiscountCreateFormProps) {
  const typeOptions = useMemo(() => getDiscountTypeSelectOptions(), [])
  const appliesOptions = useMemo(() => getAppliesToOptionsForType(form.discount_type), [form.discount_type])
  const visibility = useMemo(
    () => getDiscountFormFieldVisibility(form.discount_type, form.applies_to),
    [form.applies_to, form.discount_type],
  )
  const selectedTypeHint = typeOptions.find((row) => row.value === form.discount_type)?.hint
  const [advancedOpen, setAdvancedOpen] = useState(false)

  function patch(values: Partial<DiscountCreateFormState>) {
    onChange({ ...form, ...values })
  }

  function handleTypeChange(value: string) {
    onChange(applyDiscountTypeChange(form, value as DiscountType))
  }

  function handleGenerateCode() {
    const code = generateDiscountCodeFromName(form.discount_name)
    if (code) patch({ discount_code: code })
  }

  return (
    <YStack gap="$4">
      <DiscountFormCard ui={ui} title={DISCOUNT_UI_COPY.createPage.sections.basic}>
        <YStack gap="$3">
          <Field label={DISCOUNT_UI_COPY.form.name} required hint={DISCOUNT_UI_COPY.form.nameHint} error={errors?.discount_name}>
            <Input
              value={form.discount_name}
              onChangeText={(discount_name) => patch({ discount_name })}
              placeholder={DISCOUNT_UI_COPY.form.namePlaceholder}
            />
          </Field>

          <Field label={DISCOUNT_UI_COPY.form.code} hint={DISCOUNT_UI_COPY.form.codeHint} error={errors?.discount_code}>
            <XStack gap="$2" alignItems="center">
              <Input
                flex={1}
                value={form.discount_code ?? ''}
                onChangeText={(discount_code) => patch({ discount_code: discount_code.toUpperCase() })}
                placeholder={DISCOUNT_UI_COPY.form.codePlaceholder}
                autoCapitalize="characters"
              />
              <Button tone="primary" size="$3" onPress={handleGenerateCode} disabled={!form.discount_name.trim()}>
                {DISCOUNT_UI_COPY.form.generateCode}
              </Button>
            </XStack>
          </Field>

          <Field label={DISCOUNT_UI_COPY.form.description} hint={DISCOUNT_UI_COPY.form.descriptionHint} error={errors?.description}>
            <TextArea
              value={form.description ?? ''}
              onChangeText={(description) => patch({ description })}
              placeholder={DISCOUNT_UI_COPY.form.descriptionPlaceholder}
              minHeight={100}
            />
          </Field>
        </YStack>
      </DiscountFormCard>

      <DiscountFormCard ui={ui} title={DISCOUNT_UI_COPY.createPage.sections.valueRules}>
        <YStack gap="$3">
          <Field label={DISCOUNT_UI_COPY.form.type} required error={errors?.discount_type}>
            <Select value={form.discount_type} onValueChange={handleTypeChange}>
              <SelectTrigger width="100%" iconAfter={<Icons.ChevronDown size={16} color={ui.textMuted} />}>
                <Select.Value placeholder={DISCOUNT_UI_COPY.form.typePlaceholder} />
              </SelectTrigger>
              <SelectContent zIndex={300001}>
                <SelectViewport>
                  {typeOptions.map((option, index) => (
                    <SelectItem key={option.value} index={index} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectViewport>
              </SelectContent>
            </Select>
          </Field>
          {selectedTypeHint ? (
            <Text fontSize={12.5} color={ui.textMuted} lineHeight={18}>
              {selectedTypeHint}
            </Text>
          ) : null}

          {visibility.showDiscountValue ? (
            <Field
              label={DISCOUNT_UI_COPY.form.value}
              required
              hint={
                visibility.discountValueSuffix === 'percent'
                  ? DISCOUNT_UI_COPY.form.valuePercentHint
                  : DISCOUNT_UI_COPY.form.valueFixedHint
              }
              error={errors?.discount_value}
            >
              <XStack alignItems="center" gap="$2">
                <Input
                  flex={1}
                  value={String(form.discount_value ?? '')}
                  onChangeText={(discount_value) => patch({ discount_value })}
                  keyboardType="decimal-pad"
                  placeholder={visibility.discountValueSuffix === 'percent' ? '20' : '100'}
                />
                <Text fontSize={14} fontWeight="700" color={ui.textSecondary}>
                  {visibility.discountValueSuffix === 'percent' ? '%' : currencySymbol}
                </Text>
              </XStack>
            </Field>
          ) : null}

          {visibility.showMaxDiscountCap ? (
            <Field label={`${DISCOUNT_UI_COPY.form.maxCap} (${currencySymbol})`} hint={DISCOUNT_UI_COPY.form.maxCapHint} error={errors?.max_discount_amount}>
              <Input
                value={String(form.max_discount_amount ?? '')}
                onChangeText={(max_discount_amount) => patch({ max_discount_amount })}
                keyboardType="decimal-pad"
                placeholder="1000"
              />
            </Field>
          ) : null}

          {visibility.showAppliesTo ? (
            <Field label={DISCOUNT_UI_COPY.form.appliesTo} required error={errors?.applies_to}>
              <Select
                value={form.applies_to}
                onValueChange={(value) => patch({ applies_to: value as DiscountCreateFormState['applies_to'] })}
              >
                <SelectTrigger width="100%" iconAfter={<Icons.ChevronDown size={16} color={ui.textMuted} />}>
                  <Select.Value placeholder={DISCOUNT_UI_COPY.form.appliesToPlaceholder} />
                </SelectTrigger>
                <SelectContent zIndex={300001}>
                  <SelectViewport>
                    {appliesOptions.map((option, index) => (
                      <SelectItem key={option.value} index={index} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectViewport>
                </SelectContent>
              </Select>
            </Field>
          ) : null}

          {visibility.showEligibleListings ? (
            <Field label={DISCOUNT_UI_COPY.form.eligibleListings} error={errors?.eligible_listings}>
              <DiscountEntityPicker
                ui={ui}
                mode="products"
                shopId={shopId}
                currency={currency}
                selectedIds={form.eligible_listings ?? []}
                onChange={(eligible_listings) => patch({ eligible_listings })}
                searchPlaceholder={DISCOUNT_UI_COPY.form.searchProducts}
              />
            </Field>
          ) : null}

          {visibility.showEligibleCategories ? (
            <Field label={DISCOUNT_UI_COPY.form.eligibleCategories} error={errors?.eligible_categories}>
              <DiscountEntityPicker
                ui={ui}
                mode="categories"
                shopId={shopId}
                currency={currency}
                selectedIds={form.eligible_categories ?? []}
                onChange={(eligible_categories) => patch({ eligible_categories })}
                searchPlaceholder={DISCOUNT_UI_COPY.form.searchCategories}
              />
            </Field>
          ) : null}

          {visibility.showMinOrderAmount ? (
            <Field label={`${DISCOUNT_UI_COPY.form.minOrder} (${currencySymbol})`} hint={DISCOUNT_UI_COPY.form.minOrderHint} error={errors?.min_order_amount}>
              <Input
                value={String(form.min_order_amount ?? '')}
                onChangeText={(min_order_amount) => patch({ min_order_amount })}
                keyboardType="decimal-pad"
                placeholder="0"
              />
            </Field>
          ) : null}
        </YStack>
      </DiscountFormCard>

      {visibility.showBogoPanel ? (
        <DiscountBogoPanel
          ui={ui}
          shopId={shopId}
          currency={currency}
          form={form}
          bogoUi={bogoUi}
          errors={errors}
          onFormChange={onChange}
          onBogoUiChange={onBogoUiChange}
        />
      ) : null}

      <DiscountFormCard ui={ui} title={DISCOUNT_UI_COPY.createPage.sections.usage}>
        <XStack gap="$3" flexWrap="wrap">
          <Field label={DISCOUNT_UI_COPY.form.maxUses} hint={DISCOUNT_UI_COPY.form.maxUsesHint} flex={1} minWidth={180} error={errors?.max_uses_total}>
            <Input
              value={String(form.max_uses_total ?? '')}
              onChangeText={(max_uses_total) => patch({ max_uses_total })}
              keyboardType="number-pad"
              placeholder="100"
            />
          </Field>
          <Field
            label={DISCOUNT_UI_COPY.form.maxUsesPerCustomer}
            hint={DISCOUNT_UI_COPY.form.maxUsesPerCustomerHint}
            flex={1}
            minWidth={180}
            error={errors?.max_uses_per_customer}
          >
            <Input
              value={String(form.max_uses_per_customer ?? 1)}
              onChangeText={(max_uses_per_customer) => patch({ max_uses_per_customer })}
              keyboardType="number-pad"
              placeholder="1"
            />
          </Field>
        </XStack>
      </DiscountFormCard>

      <YStack
        borderRadius={radius.card}
        borderWidth={1}
        borderColor={ui.borderSubtle}
        backgroundColor={ui.surface}
        overflow="hidden"
      >
        <XStack
          alignItems="center"
          justifyContent="space-between"
          gap="$3"
          padding="$4"
          cursor="pointer"
          hoverStyle={{ backgroundColor: ui.surfaceMuted }}
          pressStyle={{ opacity: 0.92 }}
          onPress={() => setAdvancedOpen((open) => !open)}
        >
          <YStack flex={1} gap={2} minWidth={0}>
            <Text fontSize={15} fontWeight="800" color={ui.text}>
              {DISCOUNT_UI_COPY.createPage.sections.advanced}
            </Text>
            <Text fontSize={12.5} color={ui.textMuted} lineHeight={18}>
              {DISCOUNT_UI_COPY.createPage.sections.advancedHint}
            </Text>
          </YStack>
          <XStack alignItems="center" gap="$2" flexShrink={0}>
            <Badge tone="neutral">{DISCOUNT_UI_COPY.createPage.sections.optional}</Badge>
            {advancedOpen ? (
              <Icons.ChevronUp size={18} color={ui.textMuted} />
            ) : (
              <Icons.ChevronDown size={18} color={ui.textMuted} />
            )}
          </XStack>
        </XStack>

        {advancedOpen ? (
          <YStack gap="$3" paddingHorizontal="$4" paddingBottom="$4" borderTopWidth={1} borderTopColor={ui.borderSubtle}>
            <XStack gap="$3" flexWrap="wrap" paddingTop="$3">
              <Field label={DISCOUNT_UI_COPY.form.validFrom} flex={1} minWidth={180}>
                <Input
                  value={form.valid_from ?? ''}
                  onChangeText={(valid_from) => patch({ valid_from })}
                  placeholder="YYYY-MM-DD"
                />
              </Field>
              <Field label={DISCOUNT_UI_COPY.form.validUntil} flex={1} minWidth={180}>
                <Input
                  value={form.valid_until ?? ''}
                  onChangeText={(valid_until) => patch({ valid_until })}
                  placeholder="YYYY-MM-DD"
                />
              </Field>
            </XStack>

            <Field label={DISCOUNT_UI_COPY.form.eligibleUsers}>
              <Select
                value={form.eligible_user_types?.[0] ?? DISCOUNT_USER_TYPES.ALL}
                onValueChange={(value) =>
                  patch({ eligible_user_types: [value as typeof DISCOUNT_USER_TYPES.ALL] })
                }
              >
                <SelectTrigger width="100%">
                  <Select.Value />
                </SelectTrigger>
                <SelectContent zIndex={300001}>
                  <SelectViewport>
                    <SelectItem index={0} value={DISCOUNT_USER_TYPES.ALL}>
                      All customers
                    </SelectItem>
                    <SelectItem index={1} value={DISCOUNT_USER_TYPES.NEW}>
                      New customers
                    </SelectItem>
                    <SelectItem index={2} value={DISCOUNT_USER_TYPES.RETURNING}>
                      Returning customers
                    </SelectItem>
                    <SelectItem index={3} value={DISCOUNT_USER_TYPES.VIP}>
                      VIP customers
                    </SelectItem>
                  </SelectViewport>
                </SelectContent>
              </Select>
            </Field>

            <XStack alignItems="center" justifyContent="space-between" gap="$3">
              <YStack flex={1}>
                <Text fontSize={14} fontWeight="700" color={ui.text}>
                  {DISCOUNT_UI_COPY.form.activeOnCreate}
                </Text>
              </YStack>
              <Switch
                checked={form.is_active !== false}
                onCheckedChange={(checked) => patch({ is_active: checked === true })}
              />
            </XStack>
          </YStack>
        ) : null}
      </YStack>

      <XStack gap="$3" justifyContent="flex-end" flexWrap="wrap">
        <Button tone="outline" size="$4" onPress={onCancel} disabled={busy}>
          {DISCOUNT_UI_COPY.createPage.cancelButton}
        </Button>
        <Button tone="primary" size="$4" icon={<Icons.Save size={16} />} disabled={busy} onPress={onSubmit}>
          {DISCOUNT_UI_COPY.createPage.createButton}
        </Button>
      </XStack>
    </YStack>
  )
}
