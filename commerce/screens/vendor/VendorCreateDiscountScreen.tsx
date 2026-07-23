import { useMemo, useState } from 'react'
import { useRouter } from 'one'

import { DiscountErrorBoundary } from '~/commerce/components/DiscountErrorBoundary'
import {
  DiscountCreateForm,
  type DiscountCreateFormState,
} from '~/commerce/components/vendor/discount/DiscountCreateForm'
import { Button, Icons, Text, XStack, YStack, useAppToast } from '~/components/ui'
import { getShadowStyle, radius } from '~/config/tokens'
import { useAppLayout } from '~/hooks/useAppLayout'
import { APPLIES_TO, DISCOUNT_FETCH_SCOPE, DISCOUNT_TYPES } from '~/lib/discount/discount.constants'
import { toFriendlyDiscountError } from '~/lib/discount/discount.errors'
import { DISCOUNT_UI_COPY } from '~/lib/discount/discount-ui.copy'
import type { DiscountBogoUiState } from '~/lib/discount/discount-ui.utils'
import { parseFormNumber } from '~/lib/discount/discount-ui.utils'
import {
  buildDefaultBogoRuleFormValues,
  buildDefaultDiscountFormValues,
  parseDiscountForm,
} from '~/lib/discount/discount.validation'
import {
  createBogoDiscount,
  createDiscountProfile,
} from '~/lib/discount/discount.store'
import { vendorRoutes } from '~/lib/routes'
import { getCurrentShopUtils } from '~/lib/shop/shop.utils'
import { useAppDispatch, useAppSelector } from '~/lib/store/hooks'
import { useAppUi } from '~/lib/theme/useAppUi'

type CreateStep = 'details' | 'posters'

export function VendorCreateDiscountScreen() {
  const ui = useAppUi()
  const router = useRouter()
  const dispatch = useAppDispatch()
  const toast = useAppToast()
  const { isDesktop, safeBottom } = useAppLayout()

  const shop = useAppSelector((state) => state.shop.currentShop)
  const profile = useAppSelector((state) => state.profile.profile)
  const loading = useAppSelector((state) => state.discount.loading)

  const [activeStep, setActiveStep] = useState<CreateStep>('details')
  const [createdDiscountId, setCreatedDiscountId] = useState<string | null>(null)
  const [form, setForm] = useState<DiscountCreateFormState>(() => ({
    ...buildDefaultDiscountFormValues(),
    eligible_listings: [],
    eligible_categories: [],
    bogo_rule: buildDefaultBogoRuleFormValues(),
  }))
  const [bogoUi, setBogoUi] = useState<DiscountBogoUiState>({
    scopeMode: 'products',
    sameAsBuy: true,
  })
  const [errors, setErrors] = useState<Record<string, string>>({})

  const shopUtils = useMemo(() => getCurrentShopUtils(shop), [shop])

  const accessContext = useMemo(
    () => ({
      userId: profile?.id,
      role: profile?.role,
    }),
    [profile?.id, profile?.role],
  )

  async function handleSubmit() {
    if (!shop?.id) return

    let submitForm = form
    if (form.discount_type === DISCOUNT_TYPES.BOGO && form.bogo_rule) {
      const rule = { ...form.bogo_rule }
      if (bogoUi.sameAsBuy) {
        if (bogoUi.scopeMode === 'products') {
          rule.get_listing_ids = rule.buy_listing_ids ?? []
        } else {
          rule.get_categories = rule.buy_categories ?? []
        }
      }
      submitForm = { ...form, bogo_rule: rule }
    }

    const validation = parseDiscountForm(submitForm)
    if (!validation.isValid) {
      const nextErrors: Record<string, string> = {}
      for (const message of validation.errors) {
        const [field] = message.split(':')
        if (field) nextErrors[field.trim()] = message
      }
      setErrors(nextErrors)
      toast.show(DISCOUNT_UI_COPY.createError, {
        tone: 'danger',
        message: validation.errors[0] ?? 'Please fix the highlighted fields.',
      })
      return
    }

    setErrors({})

    const minOrder = parseFormNumber(form.min_order_amount)
    const maxUses = parseFormNumber(form.max_uses_total)
    const maxUsesPerCustomer = parseFormNumber(form.max_uses_per_customer) ?? 1
    const maxCap = parseFormNumber(form.max_discount_amount)
    const discountValue =
      form.discount_type === DISCOUNT_TYPES.FREE_SHIPPING
        ? 0
        : parseFormNumber(form.discount_value) ?? 0

    const baseInput = {
      shop_id: shop.id,
      discount_name: form.discount_name.trim(),
      discount_code: form.discount_code?.trim() || null,
      description: form.description?.trim() || null,
      discount_type: form.discount_type,
      discount_value: discountValue,
      max_discount_amount: maxCap,
      applies_to: form.applies_to,
      min_order_amount: minOrder,
      max_uses_total: maxUses,
      max_uses_per_customer: maxUsesPerCustomer,
      eligible_user_types: form.eligible_user_types,
      eligible_listings:
        form.applies_to === APPLIES_TO.ITEM ? (form.eligible_listings ?? []) : null,
      eligible_categories:
        form.applies_to === APPLIES_TO.CATEGORY ? (form.eligible_categories ?? []) : null,
      valid_from: form.valid_from?.trim() || undefined,
      valid_until: form.valid_until?.trim() || null,
      is_active: form.is_active !== false,
      discount_currency: shop.shop_currency ?? shopUtils.currency,
    }

    try {
      if (form.discount_type === DISCOUNT_TYPES.BOGO) {
        const bogoRule = submitForm.bogo_rule ?? buildDefaultBogoRuleFormValues()
        const result = await dispatch(
          createBogoDiscount({
            discountData: baseInput,
            bogoRuleData: bogoRule,
            accessContext,
            scope: DISCOUNT_FETCH_SCOPE.VENDOR,
          }),
        ).unwrap()
        setCreatedDiscountId(result.id)
      } else {
        const result = await dispatch(
          createDiscountProfile({
            input: baseInput,
            accessContext,
            scope: DISCOUNT_FETCH_SCOPE.VENDOR,
          }),
        ).unwrap()
        setCreatedDiscountId(result.id)
      }

      toast.show(DISCOUNT_UI_COPY.createSuccess, { tone: 'success' })
      setActiveStep('posters')
    } catch (err) {
      toast.show(DISCOUNT_UI_COPY.createError, {
        tone: 'danger',
        message: toFriendlyDiscountError(err),
      })
    }
  }

  if (!shop) {
    return (
      <YStack padding="$6" alignItems="center" gap="$2">
        <Icons.Store size={30} color={ui.textMuted} />
        <Text fontSize={18} fontWeight="800" color={ui.text}>
          {DISCOUNT_UI_COPY.noShopTitle}
        </Text>
        <Text color={ui.textSecondary} textAlign="center">
          {DISCOUNT_UI_COPY.noShopBody}
        </Text>
      </YStack>
    )
  }

  return (
    <DiscountErrorBoundary scope="vendor-create-discount" onReset={() => setForm({ ...buildDefaultDiscountFormValues(), eligible_listings: [], eligible_categories: [], bogo_rule: buildDefaultBogoRuleFormValues() })}>
      <YStack
        width="100%"
        maxWidth={920}
        alignSelf="center"
        gap="$4"
        paddingHorizontal={isDesktop ? '$6' : '$4'}
        paddingTop={isDesktop ? '$6' : '$4'}
        paddingBottom={(isDesktop ? 32 : 24) + safeBottom}
      >
        <XStack alignItems="center" gap="$2" cursor="pointer" onPress={() => router.push(vendorRoutes.ads)}>
          <Icons.ChevronLeft size={18} color={ui.textSecondary} />
          <Text fontSize={13} fontWeight="700" color={ui.textSecondary}>
            {DISCOUNT_UI_COPY.createPage.backLabel}
          </Text>
        </XStack>

        <YStack
          gap="$2"
          padding="$5"
          borderRadius={radius.card}
          borderWidth={1}
          borderColor={ui.borderSubtle}
          backgroundColor={ui.surface}
          style={getShadowStyle('sm')}
        >
          <Text fontSize={isDesktop ? 28 : 23} fontWeight="800" color={ui.text}>
            {DISCOUNT_UI_COPY.createPage.title}
          </Text>
          <Text fontSize={13} color={ui.textSecondary}>
            {DISCOUNT_UI_COPY.createPage.subtitle}
          </Text>
        </YStack>

        <XStack
          alignSelf="flex-start"
          padding={4}
          borderRadius={999}
          borderWidth={1}
          borderColor={ui.borderSubtle}
          backgroundColor={ui.surfaceMuted}
          gap={4}
          flexWrap="wrap"
        >
          {(
            [
              { id: 'details' as const, label: DISCOUNT_UI_COPY.createPage.steps.details },
              {
                id: 'posters' as const,
                label: `${DISCOUNT_UI_COPY.createPage.steps.posters} ${DISCOUNT_UI_COPY.createPage.steps.postersLocked}`,
              },
            ] as const
          ).map((step) => {
            const active = activeStep === step.id
            const disabled = step.id === 'posters' && !createdDiscountId
            return (
              <XStack
                key={step.id}
                paddingHorizontal="$4"
                paddingVertical="$2"
                borderRadius={999}
                backgroundColor={active ? ui.surface : 'transparent'}
                borderWidth={active ? 1 : 0}
                borderColor={active ? ui.borderSubtle : 'transparent'}
                opacity={disabled ? 0.55 : 1}
                cursor={disabled ? 'not-allowed' : 'pointer'}
                onPress={() => {
                  if (disabled) return
                  setActiveStep(step.id)
                }}
              >
                <Text fontSize={13} fontWeight="800" color={active ? ui.brand : ui.textSecondary}>
                  {step.label}
                </Text>
              </XStack>
            )
          })}
        </XStack>

        {activeStep === 'details' ? (
          <DiscountCreateForm
            ui={ui}
            shopId={shop.id}
            currency={shopUtils.currency}
            currencySymbol={shopUtils.currencySymbol}
            form={form}
            bogoUi={bogoUi}
            errors={errors}
            busy={loading.creating || loading.bogoCreating}
            onChange={setForm}
            onBogoUiChange={setBogoUi}
            onSubmit={() => void handleSubmit()}
            onCancel={() => router.push(vendorRoutes.ads)}
          />
        ) : (
          <YStack
            gap="$3"
            padding="$6"
            borderRadius={radius.card}
            borderWidth={1}
            borderColor={ui.borderSubtle}
            backgroundColor={ui.surface}
            alignItems="center"
          >
            <Icons.Image size={36} color={ui.textMuted} />
            <Text fontSize={16} fontWeight="800" color={ui.text} textAlign="center">
              Marketing posters
            </Text>
            <Text fontSize={13} color={ui.textSecondary} textAlign="center" maxWidth={420} lineHeight={20}>
              {DISCOUNT_UI_COPY.createPage.saveFirstHint}
            </Text>
            <Text fontSize={12} color={ui.textMuted}>
              Discount ID: {createdDiscountId}
            </Text>
            <Button tone="primary" onPress={() => router.push(vendorRoutes.ads)}>
              Back to discounts
            </Button>
          </YStack>
        )}
      </YStack>
    </DiscountErrorBoundary>
  )
}
