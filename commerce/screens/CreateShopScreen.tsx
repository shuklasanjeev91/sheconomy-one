import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Platform } from 'react-native'
import { useRouter } from 'one'

import {
  Button,
  Icons,
  Input,
  ScrollView,
  Spinner,
  Text,
  TextArea,
  XStack,
  YStack,
  useAppToast,
} from '~/components/ui'
import { getShadowStyle, radius } from '~/config/tokens'
import { useAppLayout } from '~/hooks/useAppLayout'
import { useAuth } from '~/hooks/useAuth'
import { useProfile } from '~/hooks/useProfile'
import { draftShopWithAi } from '~/lib/ai'
import { PhoneInput } from '~/components/forms/PhoneInput'
import { overlayBackdropStyle } from '~/lib/layout/styles'
import { refreshProfiles } from '~/lib/profile/refresh'
import { USER_ROLES } from '~/lib/profile/profile.type'
import { updateProfile } from '~/lib/profile/profile.store'
import { vendorRoutes } from '~/lib/routes'
import { checkShopNameAvailability } from '~/lib/shop/shop.service'
import {
  EMPTY_SHOP_FORM_DATA,
  SHOP_CREATION_STEPS,
  SHOP_VALIDATION,
  SUPPORTED_CURRENCIES,
  type ShopCreationStep,
  type ShopFormData,
} from '~/lib/shop/shop.type'
import { createShop, loadMyShops } from '~/lib/shop/shop.store'
import { useShopCategoryOptions } from '~/lib/shop/useShopCategoryOptions'
import {
  isShopReadyForSubmission,
  validateShopData,
  validateShopField,
  validateShopStep,
} from '~/lib/shop/shop.validation'
import { persistStorage } from '~/lib/store/storage'
import { useAppDispatch, useAppSelector } from '~/lib/store/hooks'
import { supabase } from '~/lib/supabase/client'
import { useAppUi } from '~/lib/theme/useAppUi'
import { useUnsavedChangesGuard } from '~/hooks/useUnsavedChangesGuard'

/** Local-storage key holding the in-progress seller-setup draft. */
const DRAFT_STORAGE_KEY = 'sheconomy:create-shop-draft'
/** Seconds to wait before auto-redirecting to create the first listing. */
const REDIRECT_COUNTDOWN_SECONDS = 5
const CATEGORY_LIMIT = SHOP_VALIDATION.CATEGORIES.MAX_SELECTED
const INITIAL_CURRENCY_COUNT = 4

const STEP_ICONS = {
  store: Icons.Store,
  phone: Icons.Phone,
  tag: Icons.Tag,
  'dollar-sign': Icons.DollarSign,
  'share-2': Icons.Share2,
  'file-text': Icons.FileText,
} as const

const SOCIAL_FIELDS = [
  { platform: 'instagram', label: 'Instagram URL', icon: Icons.Instagram, placeholder: 'https://instagram.com/yourshop' },
  { platform: 'facebook', label: 'Page URL', icon: Icons.Facebook, placeholder: 'https://…' },
  { platform: 'twitter', label: 'Twitter / X URL', icon: Icons.Twitter, placeholder: 'https://twitter.com/yourshop' },
  { platform: 'linkedin', label: 'Profile URL', icon: Icons.Linkedin, placeholder: 'https://…' },
] as const

type Phase = 'form' | 'success'

function stepIconFor(icon: string) {
  return STEP_ICONS[icon as keyof typeof STEP_ICONS] ?? Icons.Store
}

/** Merge persisted-draft values over the empty defaults, ignoring stray keys. */
function normalizeDraft(raw: unknown): ShopFormData {
  if (!raw || typeof raw !== 'object') return { ...EMPTY_SHOP_FORM_DATA }
  const draft = raw as Partial<ShopFormData>
  return {
    ...EMPTY_SHOP_FORM_DATA,
    ...draft,
    shop_categories: Array.isArray(draft.shop_categories) ? draft.shop_categories : [],
    social_links: draft.social_links && typeof draft.social_links === 'object' ? draft.social_links : {},
    shop_hours: draft.shop_hours && typeof draft.shop_hours === 'object' ? draft.shop_hours : {},
    shop_metadata: draft.shop_metadata && typeof draft.shop_metadata === 'object' ? draft.shop_metadata : {},
    // GST fields - preserve boolean and string values, reset URIs
    gst_revenue_above_20l: typeof draft.gst_revenue_above_20l === 'boolean' ? draft.gst_revenue_above_20l : false,
    gst_number: typeof draft.gst_number === 'string' ? draft.gst_number : '',
    gst_document_path: typeof draft.gst_document_path === 'string' ? draft.gst_document_path : '',
    gst_document_uri: '', // Always reset - blob URLs don't survive page reloads
  }
}

export function CreateShopScreen() {
  const ui = useAppUi()
  const router = useRouter()
  const toast = useAppToast()
  const dispatch = useAppDispatch()
  const { isDesktop, safeBottom, desktopHeaderHeight } = useAppLayout()
  const { user } = useAuth()
  const { profile } = useProfile()

  const myShops = useAppSelector((s) => s.shop.myShops)
  const myShopsLoaded = useAppSelector((s) => s.shop.myShopsLoaded)
  const isLoadingMyShops = useAppSelector((s) => s.shop.isLoadingMyShops)

  const [phase, setPhase] = useState<Phase>('form')
  const [stepIndex, setStepIndex] = useState(0)
  const [formData, setFormData] = useState<ShopFormData>(() => ({ ...EMPTY_SHOP_FORM_DATA }))
  const [touched, setTouched] = useState<Record<string, boolean>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [hydrated, setHydrated] = useState(false)
  const [showAllCurrencies, setShowAllCurrencies] = useState(false)
  const [countdown, setCountdown] = useState(REDIRECT_COUNTDOWN_SECONDS)
  /** `null` = not checked yet / too short; true/false after availability settles. */
  const [nameAvailable, setNameAvailable] = useState<boolean | null>(null)
  const [nameChecking, setNameChecking] = useState(false)

  const hasSubmittedRef = useRef(false)

  const handleAvailabilityChange = useCallback((available: boolean | null, checking: boolean) => {
    setNameAvailable(available)
    setNameChecking(checking)
  }, [])

  // Vendors without a shop must be allowed through (they arrive here from
  // `/vendor/myshop` → "Create your shop"). Only owners who already have a
  // storefront should be bounced out of this flow.
  const alreadyHasShop = myShopsLoaded && myShops.length > 0

  // Reconcile shops for the signed-in account. Prefer the shared store flag so
  // we don't hang when `loadMyShops` is skipped as an in-flight duplicate.
  useEffect(() => {
    if (myShopsLoaded || isLoadingMyShops) return
    void dispatch(loadMyShops(undefined))
  }, [dispatch, myShopsLoaded, isLoadingMyShops])

  // Hydrate the saved draft + pre-fill contact details from the account.
  useEffect(() => {
    let cancelled = false
    void (async () => {
      let draft: ShopFormData = { ...EMPTY_SHOP_FORM_DATA }
      try {
        const stored = await persistStorage.getItem(DRAFT_STORAGE_KEY)
        if (stored) draft = normalizeDraft(JSON.parse(stored))
      } catch {
        // Corrupt draft — fall back to a clean form.
      }
      if (cancelled) return
      if (user?.email && !draft.shop_email) draft.shop_email = user.email
      if (user?.phone && !draft.shop_phone_number) {
        draft.shop_phone_number = user.phone.startsWith('+') ? user.phone : `+${user.phone}`
      }
      setFormData(draft)
      setHydrated(true)
    })()
    return () => {
      cancelled = true
    }
  }, [user?.email, user?.phone])

  // Persist the draft as the user edits (skip until the initial load completes).
  // Never persist gst_document_uri — it's a blob URL that won't survive reload.
  useEffect(() => {
    if (!hydrated || phase === 'success') return
    const { gst_document_uri, ...persistable } = formData
    // Also clean up any potential blob URL references in metadata
    if (persistable.shop_metadata && typeof persistable.shop_metadata === 'object') {
      const cleanMetadata = { ...persistable.shop_metadata }
      delete cleanMetadata._gst_doc_uri
      persistable.shop_metadata = cleanMetadata
    }
    void persistStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(persistable))
  }, [formData, hydrated, phase])

  useUnsavedChangesGuard({
    isDirty:
      hydrated &&
      phase !== 'success' &&
      !isSubmitting &&
      Boolean(formData.shop_name?.trim() || formData.shop_description?.trim()),
  })

  // Redirect users who already own a shop — vendors with zero shops stay here.
  useEffect(() => {
    if (phase === 'success' || isSubmitting || hasSubmittedRef.current) return
    if (!myShopsLoaded) return
    if (alreadyHasShop) {
      router.push(vendorRoutes.myShop)
    }
  }, [alreadyHasShop, myShopsLoaded, isSubmitting, phase, router])

  // Success countdown → create-listing (or Skip → dashboard).
  useEffect(() => {
    if (phase !== 'success') return
    if (countdown <= 0) {
      router.push(vendorRoutes.createListing)
      return
    }
    const timer = setTimeout(() => setCountdown((value) => value - 1), 1000)
    return () => clearTimeout(timer)
  }, [phase, countdown, router])

  const steps = SHOP_CREATION_STEPS
  const currentStep = steps[stepIndex]

  const stepCompletion = useMemo(() => {
    const map: Record<string, boolean> = {}
    for (const step of steps) {
      map[step.id] = validateShopStep(step.id, formData).isComplete
    }
    return map
  }, [formData, steps])

  const completionPercentage = useMemo(() => {
    const completed = steps.filter((step) => stepCompletion[step.id]).length
    return Math.round((completed / steps.length) * 100)
  }, [stepCompletion, steps])

  const setField = useCallback(<K extends keyof ShopFormData>(field: K, value: ShopFormData[K]) => {
    setFormData((current) => ({ ...current, [field]: value }))
    setTouched((current) => ({ ...current, [field as string]: true }))
    const { error } = validateShopField(field, value)
    setErrors((current) => {
      const next = { ...current }
      if (error) next[field as string] = error
      else delete next[field as string]
      if (field === 'shop_email' || field === 'shop_phone_number') delete next.shop_contact
      return next
    })
  }, [])

  const handleBlur = useCallback(
    (field: keyof ShopFormData) => {
      setTouched((current) => ({ ...current, [field]: true }))
      const { error } = validateShopField(field, formData[field])
      setErrors((current) => {
        const next = { ...current }
        if (error) next[field as string] = error
        else delete next[field as string]
        return next
      })
    },
    [formData],
  )

  const toggleCategory = useCallback(
    (category: string) => {
      setFormData((current) => {
        const selected = current.shop_categories ?? []
        const isSelected = selected.includes(category)
        if (isSelected) {
          return { ...current, shop_categories: selected.filter((item) => item !== category) }
        }
        if (selected.length >= CATEGORY_LIMIT) return current
        return { ...current, shop_categories: [...selected, category] }
      })
    },
    [],
  )

  const setSocialLink = useCallback((platform: string, value: string) => {
    setFormData((current) => ({
      ...current,
      social_links: { ...current.social_links, [platform]: value },
    }))
  }, [])

  const goToStep = useCallback((index: number) => {
    setStepIndex(Math.max(0, Math.min(index, SHOP_CREATION_STEPS.length - 1)))
  }, [])

  const validateCurrentStep = useCallback(
    (step: ShopCreationStep) => {
      const result = validateShopStep(step.id, formData)
      const touchedUpdate: Record<string, boolean> = {}
      step.fields.forEach((field) => {
        touchedUpdate[field] = true
      })
      setTouched((current) => ({ ...current, ...touchedUpdate }))
      setErrors((current) => ({ ...current, ...result.errors }))
      return result.isValid
    },
    [formData],
  )

  const handleNext = useCallback(() => {
    // GST step validation on Next press
    if (currentStep.id === 'gstCompliance') {
      if (formData.gst_revenue_above_20l) {
        const gstErrors: Record<string, string> = {}
        if (!formData.gst_number?.trim() || formData.gst_number.trim().length !== 15) {
          gstErrors.gst_number = 'Enter a valid 15-character GST number.'
        }
        if (!formData.gst_document_uri?.trim()) {
          gstErrors.gst_document_path = 'Please upload your GST certificate.'
        }
        if (Object.keys(gstErrors).length > 0) {
          setErrors((current) => ({ ...current, ...gstErrors }))
          toast.show('Please complete GST details', { tone: 'danger' })
          return
        }
      }
      setErrors({})
      goToStep(stepIndex + 1)
      return
    }

    if (!validateCurrentStep(currentStep)) {
      toast.show('Please fix the highlighted fields', { tone: 'danger' })
      return
    }
    if (currentStep.id === 'basicInfo' && nameChecking) {
      toast.show('Checking shop name…', { tone: 'info', message: 'Please wait a moment.' })
      return
    }
    if (currentStep.id === 'basicInfo' && nameAvailable === false) {
      toast.show('Shop name unavailable', {
        tone: 'danger',
        message: 'Choose a different name — this one is already taken.',
      })
      return
    }
    setErrors({})
    goToStep(stepIndex + 1)
  }, [currentStep, formData, goToStep, nameAvailable, nameChecking, stepIndex, toast, validateCurrentStep])

  const handleSubmit = useCallback(async () => {
    if (!user?.id) {
      toast.show('You need to be signed in', { tone: 'danger' })
      return
    }

    // GST validation on final submit
    if (formData.gst_revenue_above_20l) {
      const gstErrors: Record<string, string> = {}
      if (!formData.gst_number?.trim() || formData.gst_number.trim().length !== 15) {
        gstErrors.gst_number = 'Enter a valid 15-character GST number.'
      }
      if (!formData.gst_document_uri?.trim()) {
        gstErrors.gst_document_path = 'Please upload your GST certificate.'
      }
      if (Object.keys(gstErrors).length > 0) {
        setErrors((current) => ({ ...current, ...gstErrors }))
        const lastStep = steps.findIndex((s) => s.id === 'gstCompliance')
        if (lastStep >= 0) goToStep(lastStep)
        toast.show('GST details required', {
          tone: 'danger',
          message: 'Please complete your GST information.',
        })
        return
      }
    }

    const validation = validateShopData(formData)
    if (!validation.isValid) {
      setErrors(validation.errors)
      const firstStepWithError = steps.findIndex((step) =>
        step.fields.some((field) => validation.errors[field]),
      )
      if (firstStepWithError >= 0) goToStep(firstStepWithError)
      toast.show('Please fix the highlighted fields', {
        tone: 'danger',
        message: Object.values(validation.errors)[0],
      })
      return
    }

    if (nameAvailable === false) {
      goToStep(0)
      toast.show('Shop name unavailable', {
        tone: 'danger',
        message: 'Choose a different name — this one is already taken.',
      })
      return
    }

    // Final server-side availability check before create.
    const availability = await checkShopNameAvailability(formData.shop_name)
    if (!availability.success || !availability.data?.available) {
      goToStep(0)
      setNameAvailable(false)
      setErrors((current) => ({
        ...current,
        shop_name: availability.data?.slugTaken
          ? 'That URL slug is already taken. Try a slightly different name.'
          : 'This shop name is already taken. Try another.',
      }))
      toast.show('Shop name unavailable', { tone: 'danger' })
      return
    }

    const readiness = isShopReadyForSubmission(formData)
    if (!readiness.isReady) {
      toast.show('Some required details are missing', {
        tone: 'danger',
        message: `Missing: ${readiness.missingFields.join(', ')}`,
      })
      return
    }

    hasSubmittedRef.current = true
    setIsSubmitting(true)
    try {
      await dispatch(createShop({ formData, userId: user.id })).unwrap()

      // DB trigger promotes owner to V; client update remains an idempotent fallback.
      if (profile?.role !== USER_ROLES.ADMIN) {
        try {
          await dispatch(
            updateProfile({ userId: user.id, updates: { role: USER_ROLES.VENDOR } }),
          ).unwrap()
        } catch {
          // Non-fatal when the insert trigger already set the role.
        }
      }

      // Ensure profile cache reflects V before navigating into RequireVendorRole.
      refreshProfiles()
      const { data: roleRow } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .maybeSingle()
      const role = (roleRow as { role?: string | null } | null)?.role
      if (profile?.role !== USER_ROLES.ADMIN && role !== USER_ROLES.VENDOR && role !== USER_ROLES.ADMIN) {
        try {
          await dispatch(
            updateProfile({ userId: user.id, updates: { role: USER_ROLES.VENDOR } }),
          ).unwrap()
          refreshProfiles()
        } catch {
          hasSubmittedRef.current = false
          toast.show('Shop created, but vendor access is not ready yet', {
            tone: 'warning',
            message: 'Open Manage shop from the menu in a moment, or refresh and try again.',
          })
          setIsSubmitting(false)
          return
        }
      }

      await persistStorage.removeItem(DRAFT_STORAGE_KEY)
      toast.show('Shop created', {
        tone: 'success',
        message: 'Add payout details so the shop can appear after review.',
      })
      setCountdown(REDIRECT_COUNTDOWN_SECONDS)
      setPhase('success')
    } catch (message) {
      hasSubmittedRef.current = false
      toast.show('Could not create shop', { tone: 'danger', message: String(message) })
    } finally {
      setIsSubmitting(false)
    }
  }, [dispatch, formData, goToStep, nameAvailable, profile?.role, steps, toast, user?.id])

  // ---- Gate / loading states -------------------------------------------------

  const isBlocked = myShopsLoaded && alreadyHasShop
  if (phase === 'form' && (!myShopsLoaded || !hydrated || isBlocked)) {
    return (
      <YStack flex={1} minHeight={360} alignItems="center" justifyContent="center" gap="$3">
        <Spinner size="large" color={ui.brand} />
        <Text fontSize={13} color={ui.textMuted}>
          {isBlocked ? 'Redirecting…' : 'Preparing your seller setup…'}
        </Text>
      </YStack>
    )
  }

  const isLastStep = stepIndex === steps.length - 1

  const webShellHeight =
    Platform.OS === 'web' && isDesktop
      ? (`calc(100dvh - ${desktopHeaderHeight}px)` as const)
      : undefined

  return (
    <YStack
      flex={1}
      width="100%"
      backgroundColor={ui.background}
      minHeight={0}
      style={
        Platform.OS === 'web'
          ? isDesktop
            ? ({ height: webShellHeight, minHeight: webShellHeight, overflow: 'hidden' } as const)
            : // Mobile web: fill the AppShell column via flex — never clamp with
              // height/maxHeight 100% (parent content height can be indefinite and
              // the form collapses to a blank pane).
              ({ flex: 1, minHeight: 0, overflow: 'hidden' } as const)
          : undefined
      }
    >
      <XStack flex={1} minHeight={0} alignItems="stretch">
        {isDesktop ? (
          <StepSidebar
            ui={ui}
            steps={steps}
            stepIndex={stepIndex}
            stepCompletion={stepCompletion}
            onSelect={goToStep}
          />
        ) : null}

        <YStack flex={1} minWidth={0} minHeight={0}>
          <ScrollView
            flex={1}
            width="100%"
            minHeight={0}
            showsVerticalScrollIndicator
            keyboardShouldPersistTaps="handled"
            style={
              Platform.OS === 'web'
                ? ({
                    overflowY: 'auto',
                    minHeight: 0,
                    WebkitOverflowScrolling: 'touch',
                  } as const)
                : undefined
            }
            contentContainerStyle={{
              paddingHorizontal: isDesktop ? 32 : 16,
              paddingTop: 24,
              paddingBottom: (isDesktop ? 40 : 32) + safeBottom,
              maxWidth: '100%',
              width: '100%',
              alignSelf: 'stretch',
            }}
          >
            <ProgressHeader ui={ui} stepIndex={stepIndex} total={steps.length} percent={completionPercentage} />

            <YStack
              backgroundColor={ui.surface}
              borderRadius={radius.surface}
              borderWidth={1}
              borderColor={ui.borderSubtle}
              padding={isDesktop ? '$6' : '$4'}
              gap="$5"
              style={getShadowStyle('sm')}
            >
              <StepHeader ui={ui} step={currentStep} />

              {currentStep.id === 'basicInfo' ? (
                <BasicInfoStep
                  ui={ui}
                  formData={formData}
                  errors={errors}
                  touched={touched}
                  setField={setField}
                  onBlur={handleBlur}
                  onAvailabilityChange={handleAvailabilityChange}
                />
              ) : null}
              {currentStep.id === 'contact' ? (
                <ContactStep
                  ui={ui}
                  formData={formData}
                  errors={errors}
                  touched={touched}
                  setField={setField}
                  onBlur={handleBlur}
                  accountEmail={user?.email ?? null}
                />
              ) : null}
              {currentStep.id === 'categories' ? (
                <CategoriesStep ui={ui} formData={formData} onToggle={toggleCategory} />
              ) : null}
              {currentStep.id === 'currency' ? (
                <CurrencyStep
                  ui={ui}
                  formData={formData}
                  showAll={showAllCurrencies}
                  onShowAll={() => setShowAllCurrencies(true)}
                  onSelect={(code) => setField('shop_currency', code)}
                />
              ) : null}
              {currentStep.id === 'socialMedia' ? (
                <SocialStep ui={ui} formData={formData} errors={errors} onChange={setSocialLink} />
              ) : null}
              {currentStep.id === 'gstCompliance' ? (
                <GstStep
                  ui={ui}
                  formData={formData}
                  errors={errors}
                  setField={setField}
                />
              ) : null}
            </YStack>

            <XStack
              marginTop="$5"
              gap="$3"
              flexDirection={isDesktop ? 'row' : 'column-reverse'}
              justifyContent="space-between"
            >
              <Button
                tone="ghost"
                size="$4"
                borderRadius={999}
                disabled={stepIndex === 0}
                onPress={() => goToStep(stepIndex - 1)}
              >
                Previous
              </Button>

              {isLastStep ? (
                <Button
                  tone="primary"
                  size="$4"
                  borderRadius={999}
                  disabled={isSubmitting}
                  onPress={handleSubmit}
                  icon={
                    isSubmitting
                      ? <Spinner size="small" color="white" />
                      : <Icons.Store size={16} color="white" />
                  }
                >
                  {isSubmitting ? 'Creating shop…' : 'Create My Shop'}
                </Button>
              ) : (
                <Button
                  tone="primary"
                  size="$4"
                  borderRadius={999}
                  onPress={handleNext}
                  iconAfter={<Icons.ArrowRight size={16} color="white" />}
                >
                  Next Step
                </Button>
              )}
            </XStack>
          </ScrollView>
        </YStack>
      </XStack>

      {phase === 'success' ? (
        <SuccessOverlay
          ui={ui}
          countdown={countdown}
          onSkip={() => router.push(vendorRoutes.home)}
          onPayout={() => router.push(vendorRoutes.settingsSection('payments'))}
          onContinue={() => router.push(vendorRoutes.createListing)}
        />
      ) : null}
    </YStack>
  )
}

// ===========================================================================
// Sub-components
// ===========================================================================

type Ui = ReturnType<typeof useAppUi>

function StepSidebar({
  ui,
  steps,
  stepIndex,
  stepCompletion,
  onSelect,
}: {
  ui: Ui
  steps: readonly ShopCreationStep[]
  stepIndex: number
  stepCompletion: Record<string, boolean>
  onSelect: (index: number) => void
}) {
  return (
    <YStack
      width={248}
      backgroundColor={ui.surface}
      borderRightWidth={1}
      borderRightColor={ui.borderSubtle}
      paddingHorizontal="$4"
      paddingVertical="$5"
      gap="$4"
      style={Platform.OS === 'web' ? ({ position: 'sticky', top: 0 } as const) : undefined}
    >
      <YStack gap="$1">
        <Text fontSize={20} fontWeight="800" color={ui.brand} letterSpacing={-0.4}>
          Seller Setup
        </Text>
        <Text fontSize={12} color={ui.textMuted} fontWeight="600">
          Step {stepIndex + 1} of {steps.length}
        </Text>
      </YStack>

      <YStack gap="$1">
        {steps.map((step, index) => {
          const isActive = index === stepIndex
          const isDone = stepCompletion[step.id]
          const Icon = stepIconFor(step.icon)
          return (
            <XStack
              key={step.id}
              alignItems="center"
              gap="$3"
              paddingVertical="$3"
              paddingHorizontal="$3"
              borderRadius={radius.chip}
              cursor="pointer"
              backgroundColor={isActive ? ui.roseSurface : 'transparent'}
              hoverStyle={{ backgroundColor: isActive ? ui.roseSurface : ui.surfaceMuted }}
              pressStyle={{ opacity: 0.7 }}
              onPress={() => onSelect(index)}
            >
              <YStack
                width={26}
                height={26}
                borderRadius={999}
                alignItems="center"
                justifyContent="center"
                backgroundColor={isDone ? ui.brand : isActive ? ui.chip : 'transparent'}
              >
                {isDone ? (
                  <Icons.Check size={15} color={ui.onBrand} />
                ) : (
                  <Icon size={15} color={isActive ? ui.brand : ui.icon} />
                )}
              </YStack>
              <Text
                flex={1}
                fontSize={14}
                fontWeight={isActive ? '700' : '500'}
                color={isActive ? ui.brand : ui.textSecondary}
                numberOfLines={1}
              >
                {step.title}
              </Text>
              {isActive ? (
                <YStack width={3} height={20} borderRadius={999} backgroundColor={ui.brand} />
              ) : null}
            </XStack>
          )
        })}
      </YStack>

      <YStack flex={1} justifyContent="flex-end">
        <XStack
          alignItems="center"
          gap="$2"
          borderWidth={1}
          borderColor={ui.borderSubtle}
          borderRadius={radius.chip}
          paddingVertical="$2.5"
          paddingHorizontal="$3"
        >
          <Icons.Save size={14} color={ui.textMuted} />
          <Text fontSize={12} color={ui.textMuted} fontWeight="600">
            Progress saved automatically
          </Text>
        </XStack>
      </YStack>
    </YStack>
  )
}

function ProgressHeader({
  ui,
  stepIndex,
  total,
  percent,
}: {
  ui: Ui
  stepIndex: number
  total: number
  percent: number
}) {
  return (
    <YStack gap="$2" marginBottom="$4">
      <XStack justifyContent="space-between" alignItems="center">
        <Text fontSize={12} fontWeight="700" color={ui.textMuted} letterSpacing={0.4}>
          STEP {stepIndex + 1} OF {total}
        </Text>
        <Text fontSize={12} fontWeight="700" color={ui.brand}>
          {percent}%
        </Text>
      </XStack>
      <YStack height={6} borderRadius={999} backgroundColor={ui.chip} overflow="hidden">
        <YStack
          height="100%"
          width={`${percent}%`}
          borderRadius={999}
          backgroundColor={ui.brand}
          animation="quick"
        />
      </YStack>
    </YStack>
  )
}

function StepHeader({ ui, step }: { ui: Ui; step: ShopCreationStep }) {
  const Icon = stepIconFor(step.icon)
  return (
    <XStack gap="$3" alignItems="center">
      <YStack
        width={48}
        height={48}
        borderRadius={radius.chip}
        alignItems="center"
        justifyContent="center"
        backgroundColor={ui.roseSurface}
      >
        <Icon size={24} color={ui.brand} />
      </YStack>
      <YStack flex={1} minWidth={0}>
        <Text fontSize={22} fontWeight="800" color={ui.text} letterSpacing={-0.4}>
          {step.title}
        </Text>
        <Text fontSize={14} color={ui.textSecondary}>
          {step.subtitle}
        </Text>
      </YStack>
    </XStack>
  )
}

function Callout({
  ui,
  tone,
  icon,
  title,
  children,
}: {
  ui: Ui
  tone: 'brand' | 'warning'
  icon: React.ReactNode
  title: string
  children: string
}) {
  const bg = tone === 'warning' ? 'rgba(217, 119, 6, 0.08)' : ui.roseSurface
  const border = tone === 'warning' ? 'rgba(217, 119, 6, 0.28)' : 'rgba(216, 27, 96, 0.2)'
  const titleColor = tone === 'warning' ? '#b45309' : ui.brand
  return (
    <XStack
      gap="$3"
      padding="$3.5"
      borderRadius={radius.chip}
      backgroundColor={bg}
      borderWidth={1}
      borderColor={border}
    >
      <YStack marginTop={1}>{icon}</YStack>
      <YStack flex={1} minWidth={0} gap="$1">
        <Text fontSize={14} fontWeight="700" color={titleColor}>
          {title}
        </Text>
        <Text fontSize={13} color={ui.textSecondary} lineHeight={19}>
          {children}
        </Text>
      </YStack>
    </XStack>
  )
}

function FieldShell({
  ui,
  label,
  required,
  error,
  hint,
  children,
}: {
  ui: Ui
  label: string
  required?: boolean
  error?: string
  hint?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <YStack gap="$2">
      <Text fontSize={13} fontWeight="600" color={ui.text}>
        {label}
        {required ? <Text color={ui.brand}> *</Text> : null}
      </Text>
      {children}
      {error ? (
        <XStack gap="$1.5" alignItems="center">
          <Icons.AlertCircle size={13} color={ui.error} />
          <Text fontSize={12} color={ui.error}>
            {error}
          </Text>
        </XStack>
      ) : hint ? (
        typeof hint === 'string' ? (
          <Text fontSize={12} color={ui.textMuted}>
            {hint}
          </Text>
        ) : (
          hint
        )
      ) : null}
    </YStack>
  )
}

type StepBodyProps = {
  ui: Ui
  formData: ShopFormData
  errors: Record<string, string>
  touched: Record<string, boolean>
  setField: <K extends keyof ShopFormData>(field: K, value: ShopFormData[K]) => void
  onBlur: (field: keyof ShopFormData) => void
}

type NameAvailabilityStatus = 'idle' | 'checking' | 'available' | 'taken' | 'error'

function BasicInfoStep({
  ui,
  formData,
  errors,
  touched,
  setField,
  onBlur,
  onAvailabilityChange,
}: StepBodyProps & {
  onAvailabilityChange?: (available: boolean | null, checking: boolean) => void
}) {
  const toast = useAppToast()
  const descriptionLength = formData.shop_description?.length ?? 0
  const [availability, setAvailability] = useState<NameAvailabilityStatus>('idle')
  const [availabilityHint, setAvailabilityHint] = useState<string | null>(null)
  const [aiLoading, setAiLoading] = useState(false)
  const [nameSuggestions, setNameSuggestions] = useState<string[]>([])
  const checkSeq = useRef(0)

  useEffect(() => {
    const name = formData.shop_name.trim()
    if (name.length < SHOP_VALIDATION.NAME.MIN_LENGTH) {
      setAvailability('idle')
      setAvailabilityHint(null)
      onAvailabilityChange?.(null, false)
      return
    }

    setAvailability('checking')
    onAvailabilityChange?.(null, true)
    const seq = ++checkSeq.current
    const timer = setTimeout(() => {
      void (async () => {
        const result = await checkShopNameAvailability(name)
        if (seq !== checkSeq.current) return
        if (!result.success || !result.data) {
          setAvailability('error')
          setAvailabilityHint(result.error ?? 'Could not check availability.')
          onAvailabilityChange?.(null, false)
          return
        }
        if (result.data.available) {
          setAvailability('available')
          setAvailabilityHint(
            result.data.suggestedSlug
              ? `Available · your shop URL will use /shop/${result.data.suggestedSlug}`
              : 'This name is available.',
          )
          onAvailabilityChange?.(true, false)
        } else {
          setAvailability('taken')
          setAvailabilityHint(
            result.data.nameTaken
              ? 'This shop name is already taken. Try another.'
              : 'That URL slug is already taken. Try a slightly different name.',
          )
          onAvailabilityChange?.(false, false)
        }
      })()
    }, 450)

    return () => clearTimeout(timer)
  }, [formData.shop_name, onAvailabilityChange])

  async function suggestWithAi(focus: 'both' | 'names' | 'description' = 'both') {
    setAiLoading(true)
    try {
      const result = await draftShopWithAi({
        prompt:
          formData.shop_name.trim() ||
          formData.shop_description.trim() ||
          'Women-owned boutique with handmade and thoughtful products',
        categories: formData.shop_categories,
        currentName: formData.shop_name,
        currentDescription: formData.shop_description,
      })

      if (focus === 'both' || focus === 'names') {
        setNameSuggestions(result.names)
        if (result.names[0] && !formData.shop_name.trim()) {
          setField('shop_name', result.names[0])
        }
      }
      if ((focus === 'both' || focus === 'description') && result.description) {
        setField('shop_description', result.description)
      }
      toast.show('Suggestions ready', {
        tone: 'success',
        message: 'Generated by SHERPA — tap a name to use it.',
      })
    } catch (error) {
      toast.show('Could not suggest', {
        tone: 'danger',
        message:
          error instanceof Error && error.message
            ? error.message
            : 'SHERPA is unavailable. Try again in a moment.',
      })
    } finally {
      setAiLoading(false)
    }
  }

  const availabilityColor =
    availability === 'available'
      ? ui.badgeSuccessText
      : availability === 'taken' || availability === 'error'
        ? ui.error
        : ui.textMuted

  return (
    <YStack gap="$4">
      <Callout
        ui={ui}
        tone="brand"
        icon={<Icons.Lightbulb size={18} color={ui.brand} />}
        title="Make a great first impression"
      >
        Your shop name and description are the first things buyers see. Keep it clear, memorable,
        and reflective of your products.
      </Callout>
      <Callout
        ui={ui}
        tone="warning"
        icon={<Icons.AlertTriangle size={18} color="#b45309" />}
        title="Review prohibited items"
      >
        Before proceeding, ensure your inventory complies with our Prohibited Items Policy to avoid
        account suspension.
      </Callout>

      <XStack alignItems="center" justifyContent="space-between" gap="$2" flexWrap="wrap">
        <XStack alignItems="center" gap="$1.5">
          <Icons.Sparkles size={14} color={ui.brand} />
          <Text fontSize={12} fontWeight="700" color={ui.textMuted}>
            Suggest with AI
          </Text>
        </XStack>
        <XStack gap="$2" flexWrap="wrap">
          <XStack
            alignItems="center"
            gap={6}
            paddingHorizontal={10}
            paddingVertical={5}
            borderRadius={999}
            borderWidth={1}
            borderColor={ui.borderSubtle}
            backgroundColor={ui.surface}
            cursor="pointer"
            opacity={aiLoading ? 0.7 : 1}
            hoverStyle={{ backgroundColor: ui.surfaceMuted }}
            pressStyle={{ opacity: 0.85 }}
            onPress={() => { if (!aiLoading) void suggestWithAi('names') }}
          >
            {aiLoading
              ? <Spinner size="small" color={ui.brand} />
              : <Icons.Sparkles size={13} color={ui.brand} />}
            <Text fontSize={12} fontWeight="700" color={ui.brand}>
              Name ideas
            </Text>
          </XStack>
          <XStack
            alignItems="center"
            gap={6}
            paddingHorizontal={10}
            paddingVertical={5}
            borderRadius={999}
            borderWidth={1}
            borderColor={ui.borderSubtle}
            backgroundColor={ui.surface}
            cursor="pointer"
            opacity={aiLoading ? 0.7 : 1}
            hoverStyle={{ backgroundColor: ui.surfaceMuted }}
            pressStyle={{ opacity: 0.85 }}
            onPress={() => { if (!aiLoading) void suggestWithAi('description') }}
          >
            <Icons.Pencil size={13} color={ui.brand} />
            <Text fontSize={12} fontWeight="700" color={ui.brand}>
              Write description
            </Text>
          </XStack>
        </XStack>
      </XStack>

      {nameSuggestions.length > 0 ? (
        <YStack gap="$2">
          <Text fontSize={12} fontWeight="600" color={ui.textMuted}>
            Tap a name to use it
          </Text>
          <XStack gap="$2" flexWrap="wrap">
            {nameSuggestions.map((name) => {
              const selected = formData.shop_name.trim().toLowerCase() === name.toLowerCase()
              return (
                <XStack
                  key={name}
                  paddingHorizontal={12}
                  paddingVertical={8}
                  borderRadius={999}
                  borderWidth={1}
                  borderColor={selected ? ui.brand : ui.borderSubtle}
                  backgroundColor={selected ? ui.roseSurface : ui.surface}
                  cursor="pointer"
                  hoverStyle={{ backgroundColor: ui.surfaceMuted }}
                  pressStyle={{ opacity: 0.85 }}
                  onPress={() => setField('shop_name', name)}
                >
                  <Text
                    fontSize={12}
                    fontWeight="600"
                    color={selected ? ui.brand : ui.text}
                    numberOfLines={1}
                  >
                    {name}
                  </Text>
                </XStack>
              )
            })}
          </XStack>
        </YStack>
      ) : null}

      <FieldShell
        ui={ui}
        label="Shop Name"
        required
        error={
          touched.shop_name && errors.shop_name
            ? errors.shop_name
            : availability === 'taken'
              ? availabilityHint ?? 'This shop name is already taken.'
              : undefined
        }
        hint={
          availability === 'available' || availability === 'checking' || availability === 'error'
            ? (
                <XStack alignItems="center" gap="$1.5">
                  {availability === 'checking' ? (
                    <Spinner size="small" color={ui.textMuted} />
                  ) : availability === 'available' ? (
                    <Icons.Check size={13} color={availabilityColor} />
                  ) : (
                    <Icons.AlertCircle size={13} color={availabilityColor} />
                  )}
                  <Text fontSize={12} color={availabilityColor}>
                    {availability === 'checking'
                      ? 'Checking availability…'
                      : availabilityHint ?? 'Between 2 and 200 characters.'}
                  </Text>
                </XStack>
              )
            : 'Between 2 and 200 characters. We\'ll check if the name is free as you type.'
        }
      >
        <Input
          value={formData.shop_name}
          onChangeText={(value) => setField('shop_name', value)}
          onBlur={() => onBlur('shop_name')}
          placeholder="e.g. The Velvet Ribbon"
          maxLength={SHOP_VALIDATION.NAME.MAX_LENGTH}
          invalid={Boolean(
            (touched.shop_name && errors.shop_name) || availability === 'taken',
          )}
        />
      </FieldShell>

      <FieldShell
        ui={ui}
        label="Shop Description"
        error={touched.shop_description ? errors.shop_description : undefined}
        hint={
          <XStack justifyContent="space-between" alignItems="center" gap="$2">
            <Text fontSize={12} color={ui.textMuted} flex={1}>
              A brief summary of your brand ethos and offerings.
            </Text>
            <Text fontSize={12} color={ui.textMuted}>
              {descriptionLength}/{SHOP_VALIDATION.DESCRIPTION.MAX_LENGTH}
            </Text>
          </XStack>
        }
      >
        <TextArea
          value={formData.shop_description}
          onChangeText={(value) => setField('shop_description', value)}
          onBlur={() => onBlur('shop_description')}
          placeholder="Describe what makes your shop unique…"
          minHeight={120}
          maxLength={SHOP_VALIDATION.DESCRIPTION.MAX_LENGTH}
          invalid={Boolean(touched.shop_description && errors.shop_description)}
        />
      </FieldShell>
    </YStack>
  )
}

function ContactStep({
  ui,
  formData,
  errors,
  touched,
  setField,
  onBlur,
  accountEmail,
}: StepBodyProps & { accountEmail: string | null }) {
  const emailRequired = !formData.shop_phone_number?.trim()
  const phoneRequired = !formData.shop_email?.trim()
  return (
    <YStack gap="$4">
      <Callout
        ui={ui}
        tone="warning"
        icon={<Icons.Info size={18} color="#b45309" />}
        title="Contact information required"
      >
        Provide at least one contact method (email or phone) so customers can reach you.
      </Callout>

      <FieldShell
        ui={ui}
        label="Phone Number"
        required={phoneRequired}
        error={touched.shop_phone_number ? errors.shop_phone_number : undefined}
        hint="We'll check the number against your selected country code."
      >
        <PhoneInput
          value={formData.shop_phone_number}
          onChange={(value) => setField('shop_phone_number', value)}
          onBlur={() => onBlur('shop_phone_number')}
          invalid={Boolean(touched.shop_phone_number && errors.shop_phone_number)}
        />
      </FieldShell>

      <FieldShell
        ui={ui}
        label="Email Address"
        required={emailRequired}
        error={touched.shop_email ? errors.shop_email : undefined}
        hint={
          accountEmail && formData.shop_email === accountEmail
            ? 'This email is linked to your primary account.'
            : undefined
        }
      >
        <Input
          value={formData.shop_email}
          onChangeText={(value) => setField('shop_email', value)}
          onBlur={() => onBlur('shop_email')}
          placeholder="hello@yourshop.com"
          keyboardType="email-address"
          autoCapitalize="none"
          invalid={Boolean(touched.shop_email && errors.shop_email)}
        />
      </FieldShell>

      {errors.shop_contact ? (
        <XStack gap="$1.5" alignItems="center">
          <Icons.AlertCircle size={13} color={ui.error} />
          <Text fontSize={12} color={ui.error}>
            {errors.shop_contact}
          </Text>
        </XStack>
      ) : null}

      <FieldShell
        ui={ui}
        label="Website URL (optional)"
        error={touched.website_url ? errors.website_url : undefined}
      >
        <Input
          value={formData.website_url}
          onChangeText={(value) => setField('website_url', value)}
          onBlur={() => onBlur('website_url')}
          placeholder="https://www.yourstore.com"
          keyboardType="url"
          autoCapitalize="none"
          invalid={Boolean(touched.website_url && errors.website_url)}
        />
      </FieldShell>
    </YStack>
  )
}

function CategoriesStep({
  ui,
  formData,
  onToggle,
}: {
  ui: Ui
  formData: ShopFormData
  onToggle: (category: string) => void
}) {
  const selected = formData.shop_categories ?? []
  const { categories: fetched, loading, error } = useShopCategoryOptions()
  const options = useMemo(
    () => Array.from(new Set([...selected, ...fetched])),
    [fetched, selected],
  )

  return (
    <YStack gap="$4">
      <Callout
        ui={ui}
        tone="brand"
        icon={<Icons.Info size={18} color={ui.brand} />}
        title="Help customers find you"
      >
        Accurate categories ensure your products appear in the right search results and collections.
      </Callout>

      <XStack justifyContent="space-between" alignItems="center">
        <Text fontSize={13} fontWeight="700" color={ui.text}>
          Select Categories
        </Text>
        <XStack paddingHorizontal={10} paddingVertical={4} borderRadius={999} backgroundColor={ui.brand}>
          <Text fontSize={11} fontWeight="700" color={ui.onBrand}>
            {selected.length} of {CATEGORY_LIMIT} selected
          </Text>
        </XStack>
      </XStack>

      {loading ? (
        <XStack alignItems="center" gap="$2" paddingVertical="$4">
          <Spinner size="small" color={ui.brand} />
          <Text fontSize={13} color={ui.textMuted}>
            Loading categories…
          </Text>
        </XStack>
      ) : null}

      {error && !loading ? (
        <Text fontSize={13} color={ui.danger}>
          {error}
        </Text>
      ) : null}

      {!loading && !error && options.length === 0 ? (
        <Text fontSize={13} color={ui.textMuted}>
          No categories are available yet. Try again later.
        </Text>
      ) : null}

      {!loading && options.length > 0 ? (
        <XStack flexWrap="wrap" gap="$2.5">
          {options.map((category) => {
            const isSelected = selected.includes(category)
            const isDisabled = !isSelected && selected.length >= CATEGORY_LIMIT
            return (
              <XStack
                key={category}
                width="48%"
                minWidth={200}
                flexGrow={1}
                alignItems="center"
                gap="$2.5"
                paddingVertical="$3"
                paddingHorizontal="$3.5"
                borderRadius={radius.chip}
                borderWidth={1.5}
                borderColor={isSelected ? ui.brand : ui.borderSubtle}
                backgroundColor={isSelected ? ui.roseSurface : ui.surface}
                opacity={isDisabled ? 0.45 : 1}
                cursor={isDisabled ? 'not-allowed' : 'pointer'}
                hoverStyle={isDisabled ? undefined : { borderColor: ui.brand }}
                pressStyle={isDisabled ? undefined : { opacity: 0.7 }}
                onPress={() => {
                  if (!isDisabled) onToggle(category)
                }}
              >
                <Icons.Tag size={16} color={isSelected ? ui.brand : ui.icon} />
                <Text
                  flex={1}
                  fontSize={14}
                  fontWeight={isSelected ? '700' : '500'}
                  color={isSelected ? ui.text : ui.textSecondary}
                  numberOfLines={1}
                >
                  {category}
                </Text>
                <YStack
                  width={20}
                  height={20}
                  borderRadius={999}
                  alignItems="center"
                  justifyContent="center"
                  borderWidth={isSelected ? 0 : 1.5}
                  borderColor={ui.border}
                  backgroundColor={isSelected ? ui.brand : 'transparent'}
                >
                  {isSelected ? <Icons.Check size={12} color={ui.onBrand} /> : null}
                </YStack>
              </XStack>
            )
          })}
        </XStack>
      ) : null}
    </YStack>
  )
}

function CurrencyStep({
  ui,
  formData,
  showAll,
  onShowAll,
  onSelect,
}: {
  ui: Ui
  formData: ShopFormData
  showAll: boolean
  onShowAll: () => void
  onSelect: (code: string) => void
}) {
  const visible = showAll ? SUPPORTED_CURRENCIES : SUPPORTED_CURRENCIES.slice(0, INITIAL_CURRENCY_COUNT)
  return (
    <YStack gap="$4">
      <Callout
        ui={ui}
        tone="warning"
        icon={<Icons.Info size={18} color="#b45309" />}
        title="Choose pricing currency"
      >
        Select the primary currency you will use to price your products or services. This can be
        changed later in settings.
      </Callout>

      <XStack flexWrap="wrap" gap="$2.5">
        {visible.map((currency) => {
          const isSelected = formData.shop_currency === currency.code
          return (
            <XStack
              key={currency.code}
              width="48%"
              minWidth={200}
              flexGrow={1}
              alignItems="center"
              gap="$3"
              paddingVertical="$3.5"
              paddingHorizontal="$3.5"
              borderRadius={radius.chip}
              borderWidth={1.5}
              borderColor={isSelected ? ui.brand : ui.borderSubtle}
              backgroundColor={isSelected ? ui.roseSurface : ui.surface}
              cursor="pointer"
              hoverStyle={{ borderColor: ui.brand }}
              pressStyle={{ opacity: 0.7 }}
              onPress={() => onSelect(currency.code)}
            >
              <YStack
                width={36}
                height={36}
                borderRadius={999}
                alignItems="center"
                justifyContent="center"
                backgroundColor={isSelected ? ui.brand : ui.chip}
              >
                <Text fontSize={15} fontWeight="700" color={isSelected ? ui.onBrand : ui.textSecondary}>
                  {currency.symbol}
                </Text>
              </YStack>
              <YStack flex={1} minWidth={0}>
                <Text fontSize={15} fontWeight="700" color={ui.text}>
                  {currency.code}
                </Text>
                <Text fontSize={12} color={ui.textMuted} numberOfLines={1}>
                  {currency.name}
                </Text>
              </YStack>
              {isSelected ? <Icons.CheckCircle2 size={18} color={ui.brand} /> : null}
            </XStack>
          )
        })}
      </XStack>

      {!showAll ? (
        <YStack alignItems="center">
          <Text
            fontSize={13}
            fontWeight="700"
            color={ui.brand}
            cursor="pointer"
            onPress={onShowAll}
            pressStyle={{ opacity: 0.6 }}
          >
            Load more currencies
          </Text>
        </YStack>
      ) : null}
    </YStack>
  )
}

function SocialStep({
  ui,
  formData,
  errors,
  onChange,
}: {
  ui: Ui
  formData: ShopFormData
  errors: Record<string, string>
  onChange: (platform: string, value: string) => void
}) {
  return (
    <YStack gap="$4">
      <Callout
        ui={ui}
        tone="brand"
        icon={<Icons.Megaphone size={18} color={ui.brand} />}
        title="Expand your reach"
      >
        Linking your social accounts helps customers find you and builds trust. Connecting profiles
        is optional.
      </Callout>

      <XStack flexWrap="wrap" gap="$3.5">
        {SOCIAL_FIELDS.map(({ platform, label, icon: Icon, placeholder }) => {
          const error = errors[`social_${platform}`]
          return (
            <YStack key={platform} width="48%" minWidth={240} flexGrow={1} gap="$2">
              <Text fontSize={13} fontWeight="600" color={ui.text}>
                {label}
              </Text>
              <XStack
                alignItems="center"
                gap="$2"
                borderWidth={1}
                borderColor={error ? ui.error : ui.borderSubtle}
                borderRadius={radius.chip}
                paddingLeft="$3"
                backgroundColor={ui.surface}
              >
                <Icon size={16} color={ui.icon} />
                <Input
                  flex={1}
                  borderWidth={0}
                  paddingHorizontal="$2"
                  backgroundColor="transparent"
                  value={formData.social_links?.[platform] ?? ''}
                  onChangeText={(value) => onChange(platform, value)}
                  placeholder={placeholder}
                  autoCapitalize="none"
                  keyboardType="url"
                />
              </XStack>
              {error ? (
                <Text fontSize={12} color={ui.error}>
                  {error}
                </Text>
              ) : null}
            </YStack>
          )
        })}
      </XStack>
    </YStack>
  )
}

// ─── GstStep Component ───────────────────────────────────────────────────────

function GstStep({
  ui,
  formData,
  errors,
  setField,
}: {
  ui: Ui
  formData: ShopFormData
  errors: Record<string, string>
  setField: <K extends keyof ShopFormData>(field: K, value: ShopFormData[K]) => void
}) {
  const toast = useAppToast()
  const [fileName, setFileName] = useState<string | null>(null)

  const pickDocument = useCallback(async () => {
    try {
      if (Platform.OS === 'web') {
        const input = document.createElement('input')
        input.type = 'file'
        input.accept = 'application/pdf,image/jpeg,image/png,image/webp'
        input.onchange = async (e) => {
          const file = (e.target as HTMLInputElement).files?.[0]
          if (!file) return
          setFileName(file.name)
          const uri = URL.createObjectURL(file)
          setField('gst_document_uri', uri)
          setField('shop_metadata', {
            ...formData.shop_metadata,
            _gst_doc_mime: file.type,
            _gst_doc_name: file.name,
          })
        }
        input.click()
      } else {
        const { default: DocumentPicker } = await import('expo-document-picker')
        const result = await DocumentPicker.getDocumentAsync({
          type: ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'],
          copyToCacheDirectory: true,
        })
        if (result.canceled) return
        const asset = result.assets[0]
        if (!asset) return
        setFileName(asset.name)
        setField('gst_document_uri', asset.uri)
        setField('shop_metadata', {
          ...formData.shop_metadata,
          _gst_doc_mime: asset.mimeType ?? 'application/pdf',
          _gst_doc_name: asset.name,
        })
      }
    } catch {
      toast.show('Could not open file picker', { tone: 'danger' })
    }
  }, [formData.shop_metadata, setField, toast])

  const removeDocument = useCallback(() => {
    setFileName(null)
    setField('gst_document_uri', '')
    setField('gst_document_path', '')
    const meta = { ...formData.shop_metadata }
    delete meta._gst_doc_mime
    delete meta._gst_doc_name
    setField('shop_metadata', meta)
  }, [formData.shop_metadata, setField])

  return (
    <YStack gap="$5">
      <Callout
        ui={ui}
        tone="warning"
        icon={<Icons.FileText size={18} color="#b45309" />}
        title="GST Compliance (India)"
      >
        As per Indian tax law, businesses with annual revenue exceeding ₹20 Lakh must register for
        GST. Please declare your status honestly — false declarations may result in account
        suspension.
      </Callout>

      <XStack
        gap="$3"
        padding="$4"
        borderRadius={radius.chip}
        borderWidth={1.5}
        borderColor={formData.gst_revenue_above_20l ? ui.brand : ui.borderSubtle}
        backgroundColor={formData.gst_revenue_above_20l ? ui.roseSurface : ui.surface}
        cursor="pointer"
        pressStyle={{ opacity: 0.8 }}
        onPress={() => setField('gst_revenue_above_20l', !formData.gst_revenue_above_20l)}
      >
        <YStack
          width={22}
          height={22}
          borderRadius={6}
          borderWidth={2}
          borderColor={formData.gst_revenue_above_20l ? ui.brand : ui.border}
          backgroundColor={formData.gst_revenue_above_20l ? ui.brand : 'transparent'}
          alignItems="center"
          justifyContent="center"
          marginTop={2}
          flexShrink={0}
        >
          {formData.gst_revenue_above_20l
            ? <Icons.Check size={13} color={ui.onBrand} />
            : null}
        </YStack>

        <YStack flex={1} gap="$1">
          <Text fontSize={14} fontWeight="700" color={ui.text}>
            My annual revenue exceeds ₹20 Lakh
          </Text>
          <Text fontSize={13} color={ui.textSecondary} lineHeight={18}>
            I understand I am required to register for GST and submit my registration details below.
          </Text>
        </YStack>
      </XStack>

      {formData.gst_revenue_above_20l ? (
        <YStack gap="$4" animation="quick" enterStyle={{ opacity: 0, y: -8 }}>

          <FieldShell
            ui={ui}
            label="GST Registration Number"
            required
            error={errors.gst_number}
            hint="15-character GST number e.g. 22AAAAA0000A1Z5"
          >
            <Input
              value={formData.gst_number}
              onChangeText={(value) => setField('gst_number', value.toUpperCase().trim())}
              placeholder="22AAAAA0000A1Z5"
              autoCapitalize="characters"
              maxLength={15}
              invalid={Boolean(errors.gst_number)}
            />
          </FieldShell>

          <YStack gap="$2">
            <Text fontSize={13} fontWeight="600" color={ui.text}>
              GST Certificate / Document
              <Text color={ui.brand}> *</Text>
            </Text>

            {fileName ? (
              <XStack
                alignItems="center"
                gap="$3"
                padding="$3"
                borderRadius={radius.chip}
                borderWidth={1}
                borderColor={ui.brand}
                backgroundColor={ui.roseSurface}
              >
                <Icons.FileText size={18} color={ui.brand} />
                <Text flex={1} fontSize={13} color={ui.text} numberOfLines={1}>
                  {fileName}
                </Text>
                <XStack
                  padding="$1"
                  cursor="pointer"
                  pressStyle={{ opacity: 0.6 }}
                  onPress={removeDocument}
                >
                  <Icons.X size={16} color={ui.error} />
                </XStack>
              </XStack>
            ) : (
              <XStack
                alignItems="center"
                justifyContent="center"
                gap="$2"
                padding="$4"
                borderRadius={radius.chip}
                borderWidth={1.5}
                borderStyle="dashed"
                borderColor={errors.gst_document_path ? ui.error : ui.borderSubtle}
                backgroundColor={ui.surfaceMuted}
                cursor="pointer"
                hoverStyle={{ borderColor: ui.brand, backgroundColor: ui.roseSurface }}
                pressStyle={{ opacity: 0.8 }}
                onPress={pickDocument}
              >
                <Icons.Upload size={18} color={ui.icon} />
                <YStack>
                  <Text fontSize={13} fontWeight="700" color={ui.text}>
                    Upload GST Document
                  </Text>
                  <Text fontSize={11} color={ui.textMuted}>
                    PDF, JPG, PNG or WebP · Max 10 MB
                  </Text>
                </YStack>
              </XStack>
            )}

            {errors.gst_document_path ? (
              <XStack gap="$1.5" alignItems="center">
                <Icons.AlertCircle size={13} color={ui.error} />
                <Text fontSize={12} color={ui.error}>
                  {errors.gst_document_path}
                </Text>
              </XStack>
            ) : null}
          </YStack>

          <XStack
            gap="$3"
            padding="$3.5"
            borderRadius={radius.chip}
            backgroundColor="rgba(217, 119, 6, 0.06)"
            borderWidth={1}
            borderColor="rgba(217, 119, 6, 0.20)"
          >
            <Icons.Clock size={16} color="#b45309" />
            <Text fontSize={12} color="#b45309" flex={1} lineHeight={18}>
              GST documents are reviewed by our team within 2–3 business days. Your shop will be
              active immediately, but GST verification will be shown as pending until reviewed.
            </Text>
          </XStack>
        </YStack>
      ) : (
        <XStack
          gap="$3"
          padding="$4"
          borderRadius={radius.chip}
          backgroundColor={ui.surfaceMuted}
          borderWidth={1}
          borderColor={ui.borderSubtle}
        >
          <Icons.CheckCircle2 size={18} color={ui.badgeSuccessText} />
          <YStack flex={1} gap="$1">
            <Text fontSize={14} fontWeight="700" color={ui.text}>
              No GST Required
            </Text>
            <Text fontSize={13} color={ui.textSecondary} lineHeight={18}>
              Your shop is below the ₹20 Lakh threshold. No GST registration needed. You can update
              this later in shop settings if your revenue grows.
            </Text>
          </YStack>
        </XStack>
      )}
    </YStack>
  )
}

// ─── Success Overlay ─────────────────────────────────────────────────────────

function SuccessOverlay({
  ui,
  countdown,
  onSkip,
  onPayout,
  onContinue,
}: {
  ui: Ui
  countdown: number
  onSkip: () => void
  onPayout: () => void
  onContinue: () => void
}) {
  const nativeFullscreen = Platform.OS === 'ios' || Platform.OS === 'android'

  return (
    <YStack
      style={overlayBackdropStyle()}
      zIndex={500}
      alignItems="center"
      justifyContent={nativeFullscreen ? 'flex-start' : 'center'}
      padding={nativeFullscreen ? 0 : '$4'}
    >
      <YStack
        fullscreen
        backgroundColor="rgba(10, 10, 15, 0.55)"
        animation="quick"
        enterStyle={{ opacity: 0 }}
      />
      <YStack
        width="100%"
        maxWidth={nativeFullscreen ? '100%' : 420}
        flex={nativeFullscreen ? 1 : undefined}
        height={nativeFullscreen ? '100%' : undefined}
        backgroundColor={ui.surface}
        borderRadius={nativeFullscreen ? 0 : radius.surface}
        borderWidth={nativeFullscreen ? 0 : 1}
        borderColor={ui.borderSubtle}
        padding="$6"
        gap="$4"
        alignItems="center"
        justifyContent={nativeFullscreen ? 'center' : undefined}
        zIndex={1}
        animation="quick"
        enterStyle={{ opacity: 0, scale: 0.96, y: 8 }}
        style={nativeFullscreen ? undefined : getShadowStyle('lg')}
      >
        <YStack
          width={72}
          height={72}
          borderRadius={999}
          alignItems="center"
          justifyContent="center"
          backgroundColor={ui.roseSurface}
        >
          <Icons.PartyPopper size={34} color={ui.brand} />
        </YStack>

        <YStack gap="$2" alignItems="center">
          <Text fontSize={20} fontWeight="800" color={ui.text} textAlign="center">
            Your shop is created
          </Text>
          <Text fontSize={14} color={ui.textSecondary} textAlign="center" lineHeight={20}>
            Submit payout details so it can sell after review. You can add a product now.
            Redirecting in {countdown}s…
          </Text>
        </YStack>

        <YStack width="100%" gap="$2.5">
          <Button
            tone="primary"
            size="$4"
            borderRadius={999}
            onPress={onContinue}
            icon={<Icons.Plus size={16} color="white" />}
          >
            Create my first listing
          </Button>
          <Button tone="outline" size="$3" borderRadius={999} onPress={onPayout}>
            Add payout details
          </Button>
          <Button tone="ghost" size="$3" borderRadius={999} onPress={onSkip}>
            Skip — go to dashboard
          </Button>
        </YStack>
      </YStack>
    </YStack>
  )
}