import { useMemo } from 'react'

import {
  Checkbox,
  Field,
  Icons,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectViewport,
  Text,
  XStack,
  YStack,
} from '~/components/ui'
import { BOGO_GET_DISCOUNT_TYPES } from '~/lib/discount/discount.constants'
import type { BogoRuleInput, DiscountFormInput } from '~/lib/discount/discount.type'
import { DISCOUNT_UI_COPY } from '~/lib/discount/discount-ui.copy'
import {
  applyBogoTemplate,
  getBogoTemplateList,
  type BogoScopeMode,
  type DiscountBogoUiState,
} from '~/lib/discount/discount-ui.utils'
import type { AppUiTokens } from '~/lib/theme/app-ui'

import { DiscountEntityPicker } from './DiscountEntityPicker'
import { DiscountFormCard } from './DiscountFormCard'

type DiscountBogoPanelProps = {
  ui: AppUiTokens
  shopId: string
  currency: string
  form: DiscountFormInput
  bogoUi: DiscountBogoUiState
  errors?: Record<string, string>
  onFormChange: (form: DiscountFormInput) => void
  onBogoUiChange: (ui: DiscountBogoUiState) => void
}

export function DiscountBogoPanel({
  ui,
  shopId,
  currency,
  form,
  bogoUi,
  errors,
  onFormChange,
  onBogoUiChange,
}: DiscountBogoPanelProps) {
  const rule = form.bogo_rule ?? {}
  const templates = useMemo(() => getBogoTemplateList(), [])

  function patchRule(patch: Partial<BogoRuleInput>) {
    onFormChange({
      ...form,
      bogo_rule: { ...rule, ...patch },
    })
  }

  function handleTemplateSelect(templateId: string) {
    const template = templates.find((row) => row.id === templateId)
    if (!template) return
    const next = applyBogoTemplate(form, template)
    onFormChange(next.form)
    onBogoUiChange(next.ui)
  }

  const buyIds =
    bogoUi.scopeMode === 'products' ? (rule.buy_listing_ids ?? []) : (rule.buy_categories ?? [])
  const getIds =
    bogoUi.scopeMode === 'products' ? (rule.get_listing_ids ?? []) : (rule.get_categories ?? [])

  function handleBuyChange(ids: string[]) {
    if (bogoUi.scopeMode === 'products') {
      patchRule({ buy_listing_ids: ids })
      if (bogoUi.sameAsBuy) patchRule({ get_listing_ids: ids })
      return
    }
    patchRule({ buy_categories: ids })
    if (bogoUi.sameAsBuy) patchRule({ get_categories: ids })
  }

  function handleGetChange(ids: string[]) {
    if (bogoUi.scopeMode === 'products') {
      patchRule({ get_listing_ids: ids })
      return
    }
    patchRule({ get_categories: ids })
  }

  function setScopeMode(scopeMode: BogoScopeMode) {
    onBogoUiChange({ ...bogoUi, scopeMode })
    patchRule({
      buy_listing_ids: scopeMode === 'products' ? buyIds : [],
      get_listing_ids: scopeMode === 'products' && !bogoUi.sameAsBuy ? getIds : [],
      buy_categories: scopeMode === 'categories' ? buyIds : [],
      get_categories: scopeMode === 'categories' && !bogoUi.sameAsBuy ? getIds : [],
    })
  }

  return (
    <DiscountFormCard ui={ui} title={DISCOUNT_UI_COPY.createPage.sections.bogo}>
      <YStack gap="$3">
        <Text fontSize={13} fontWeight="800" color={ui.textSecondary}>
          {DISCOUNT_UI_COPY.form.bogoTemplates}
        </Text>
        <XStack gap="$2" flexWrap="wrap">
          {templates.slice(0, 6).map((template) => {
            const active = rule.template_id === template.id
            return (
              <XStack
                key={template.id}
                minWidth={150}
                maxWidth={220}
                flex={1}
                padding="$3"
                gap="$2"
                borderRadius={14}
                borderWidth={1}
                borderColor={active ? ui.brand : ui.borderSubtle}
                backgroundColor={active ? ui.roseSurface : ui.surfaceMuted}
                cursor="pointer"
                onPress={() => handleTemplateSelect(template.id)}
              >
                <Icons.Gift size={16} color={ui.brand} />
                <YStack flex={1} gap={2}>
                  <Text fontSize={12} fontWeight="800" color={ui.text}>
                    {template.label}
                  </Text>
                  <Text fontSize={11} color={ui.textMuted} numberOfLines={2}>
                    {template.description}
                  </Text>
                </YStack>
              </XStack>
            )
          })}
        </XStack>

        <XStack
          alignSelf="flex-start"
          padding={4}
          borderRadius={999}
          borderWidth={1}
          borderColor={ui.borderSubtle}
          backgroundColor={ui.surfaceMuted}
          gap={4}
        >
          {(['products', 'categories'] as const).map((mode) => {
            const active = bogoUi.scopeMode === mode
            return (
              <XStack
                key={mode}
                paddingHorizontal="$3"
                paddingVertical="$2"
                borderRadius={999}
                backgroundColor={active ? ui.surface : 'transparent'}
                borderWidth={active ? 1 : 0}
                borderColor={active ? ui.borderSubtle : 'transparent'}
                cursor="pointer"
                onPress={() => setScopeMode(mode)}
              >
                <Text fontSize={12} fontWeight="800" color={active ? ui.brand : ui.textSecondary}>
                  {mode === 'products'
                    ? DISCOUNT_UI_COPY.form.bogoScopeProducts
                    : DISCOUNT_UI_COPY.form.bogoScopeCategories}
                </Text>
              </XStack>
            )
          })}
        </XStack>

        <YStack gap="$2">
          <Text fontSize={13} fontWeight="800" color={ui.text}>
            {DISCOUNT_UI_COPY.form.bogoBuy}
          </Text>
          <DiscountEntityPicker
            ui={ui}
            mode={bogoUi.scopeMode}
            shopId={shopId}
            currency={currency}
            selectedIds={buyIds}
            onChange={handleBuyChange}
            searchPlaceholder={
              bogoUi.scopeMode === 'products'
                ? DISCOUNT_UI_COPY.form.searchProducts
                : DISCOUNT_UI_COPY.form.searchCategories
            }
          />
          <Field label={DISCOUNT_UI_COPY.form.bogoBuyQty} error={errors?.buy_quantity}>
            <Input
              value={String(rule.buy_quantity ?? 1)}
              onChangeText={(value) => patchRule({ buy_quantity: Number(value) || 1 })}
              keyboardType="number-pad"
            />
          </Field>
        </YStack>

        <XStack alignItems="center" gap="$2">
          <Checkbox
            checked={bogoUi.sameAsBuy}
            onCheckedChange={(checked) => {
              const sameAsBuy = checked === true
              onBogoUiChange({ ...bogoUi, sameAsBuy })
              if (sameAsBuy) {
                if (bogoUi.scopeMode === 'products') {
                  patchRule({ get_listing_ids: rule.buy_listing_ids ?? [] })
                } else {
                  patchRule({ get_categories: rule.buy_categories ?? [] })
                }
              }
            }}
          />
          <Text fontSize={13} color={ui.textSecondary} flex={1}>
            {DISCOUNT_UI_COPY.form.bogoSameAsBuy}
          </Text>
        </XStack>

        {!bogoUi.sameAsBuy ? (
          <YStack gap="$2">
            <Text fontSize={13} fontWeight="800" color={ui.text}>
              {DISCOUNT_UI_COPY.form.bogoGet}
            </Text>
            <DiscountEntityPicker
              ui={ui}
              mode={bogoUi.scopeMode}
              shopId={shopId}
              currency={currency}
              selectedIds={getIds}
              onChange={handleGetChange}
              searchPlaceholder={
                bogoUi.scopeMode === 'products'
                  ? DISCOUNT_UI_COPY.form.searchProducts
                  : DISCOUNT_UI_COPY.form.searchCategories
              }
            />
          </YStack>
        ) : null}

        <XStack gap="$3" flexWrap="wrap">
          <Field label={DISCOUNT_UI_COPY.form.bogoGetQty} flex={1} minWidth={120}>
            <Input
              value={String(rule.get_quantity ?? 1)}
              onChangeText={(value) => patchRule({ get_quantity: Number(value) || 1 })}
              keyboardType="number-pad"
            />
          </Field>
          <Field label={DISCOUNT_UI_COPY.form.bogoGetDiscount} flex={1} minWidth={180}>
            <Select
              value={rule.get_discount_type ?? BOGO_GET_DISCOUNT_TYPES.FREE}
              onValueChange={(value) => {
                const type = value as
                  | typeof BOGO_GET_DISCOUNT_TYPES.FREE
                  | typeof BOGO_GET_DISCOUNT_TYPES.PERCENTAGE
                patchRule({
                  get_discount_type: type,
                  get_discount_value:
                    type === BOGO_GET_DISCOUNT_TYPES.FREE ? 100 : (rule.get_discount_value ?? 50),
                })
              }}
            >
              <SelectTrigger width="100%">
                <Select.Value />
              </SelectTrigger>
              <SelectContent zIndex={300001}>
                <SelectViewport>
                  <SelectItem index={0} value={BOGO_GET_DISCOUNT_TYPES.FREE}>
                    {DISCOUNT_UI_COPY.form.bogoGetFree}
                  </SelectItem>
                  <SelectItem index={1} value={BOGO_GET_DISCOUNT_TYPES.PERCENTAGE}>
                    {DISCOUNT_UI_COPY.form.bogoGetPercent}
                  </SelectItem>
                </SelectViewport>
              </SelectContent>
            </Select>
          </Field>
          {rule.get_discount_type === BOGO_GET_DISCOUNT_TYPES.PERCENTAGE ? (
            <Field label="%" flex={1} minWidth={100}>
              <Input
                value={String(rule.get_discount_value ?? 50)}
                onChangeText={(value) => patchRule({ get_discount_value: Number(value) || 0 })}
                keyboardType="decimal-pad"
              />
            </Field>
          ) : null}
        </XStack>
      </YStack>
    </DiscountFormCard>
  )
}
