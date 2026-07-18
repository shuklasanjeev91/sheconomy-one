import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'one'

import {
  Button,
  Icons,
  Input,
  Spinner,
  Text,
  TextArea,
  XStack,
  YStack,
  useAppToast,
} from '~/components/ui'
import { CountryCodePicker, DEFAULT_COUNTRY } from '~/components/auth/CountryCodePicker'
import { PageScroll, StickyRail } from '~/components/layout'
import { getShadowStyle, radius } from '~/config/tokens'
import { useAppLayout } from '~/hooks/useAppLayout'
import { useAuth } from '~/hooks/useAuth'
import { useProfile } from '~/hooks/useProfile'
import type { Country } from '~/lib/phone/countries'
import {
  formatPhoneForDisplay,
  nationalDigits,
  parseE164Phone,
  toE164Phone,
  validateNationalPhone,
} from '~/lib/phone/phone'
import { overlayBackdropStyle } from '~/lib/layout/styles'
import { refreshProfiles } from '~/lib/profile/refresh'
import { USER_ROLES } from '~/lib/profile/profile.type'
import { updateProfile } from '~/lib/profile/profile.store'
import { vendorRoutes } from '~/lib/routes'
import {
  COMMON_SHOP_CATEGORIES,
  EMPTY_SHOP_FORM_DATA,
  SHOP_CREATION_STEPS,
  SHOP_VALIDATION,
  SUPPORTED_CURRENCIES,
  type ShopCreationStep,
  type ShopFormData,
} from '~/lib/shop/shop.type'
import { createShop, loadMyShops } from '~/lib/shop/shop.store'
import {
  isShopReadyForSubmission,
  validateShopData,
  validateShopField,
  validateShopStep,
} from '~/lib/shop/shop.validation'
import { persistStorage } from '~/lib/store/storage'
import { useAppDispatch, useAppSelector } from '~/lib/store/hooks'
import { useAppUi } from '~/lib/theme/useAppUi'

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
  }
}

export function CreateShopScreen() {
  const ui = useAppUi()
  const router = useRouter()
  const toast = useAppToast()
  const dispatch = useAppDispatch()
  const { isDesktop, safeBottom } = useAppLayout()
  const { user } = useAuth()
  const { profile, isLoading: profileLoading } = useProfile()

  const myShops = useAppSelector((s) => s.shop.myShops)

  const [phase, setPhase] = useState<Phase>('form')
  const [stepIndex, setStepIndex] = useState(0)
  const [formData, setFormData] = useState<ShopFormData>(() => ({ ...EMPTY_SHOP_FORM_DATA }))
  const [touched, setTouched] = useState<Record<string, boolean>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [hydrated, setHydrated] = useState(false)
  const [shopsChecked, setShopsChecked] = useState(false)
  const [showAllCurrencies, setShowAllCurrencies] = useState(false)
  const [countdown, setCountdown] = useState(REDIRECT_COUNTDOWN_SECONDS)

  const hasSubmittedRef = useRef(false)

  const alreadyVendor = profile?.role === USER_ROLES.VENDOR
  const alreadyHasShop = shopsChecked && myShops.length > 0

  // Fetch the user's shops (reconciled against the signed-in account) so we can
  // block owners / vendors from the flow. Only trust the result once it lands —
  // persisted shop state can belong to a previous session.
  useEffect(() => {
    void dispatch(loadMyShops(undefined)).finally(() => setShopsChecked(true))
  }, [dispatch])

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
  useEffect(() => {
    if (!hydrated || phase === 'success') return
    void persistStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(formData))
  }, [formData, hydrated, phase])

  // Redirect users who shouldn't see the flow (vendors / existing shop owners).
  useEffect(() => {
    if (phase === 'success' || isSubmitting || hasSubmittedRef.current) return
    if (profileLoading || !shopsChecked) return
    if (alreadyVendor) {
      router.replace(vendorRoutes.home)
    } else if (alreadyHasShop) {
      router.replace(vendorRoutes.myShop)
    }
  }, [alreadyVendor, alreadyHasShop, profileLoading, shopsChecked, isSubmitting, phase, router])

  // Success countdown → create-listing (or Skip → dashboard).
  useEffect(() => {
    if (phase !== 'success') return
    if (countdown <= 0) {
      router.replace(vendorRoutes.createListing)
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
    setErrors((current) => {
      if (!current[field as string] && !current.shop_contact) return current
      const next = { ...current }
      delete next[field as string]
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
    if (!validateCurrentStep(currentStep)) {
      toast.show('Please fix the highlighted fields', { tone: 'danger' })
      return
    }
    setErrors({})
    goToStep(stepIndex + 1)
  }, [currentStep, goToStep, stepIndex, toast, validateCurrentStep])

  const handleSubmit = useCallback(async () => {
    if (!user?.id) {
      toast.show('You need to be signed in', { tone: 'danger' })
      return
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

      // Promote the account to a vendor, mirroring the legacy create-shop flow.
      // Admins keep their elevated role — opening a shop shouldn't demote them.
      if (profile?.role !== USER_ROLES.ADMIN) {
        try {
          await dispatch(
            updateProfile({ userId: user.id, updates: { role: USER_ROLES.VENDOR } }),
          ).unwrap()
        } catch {
          // Non-fatal: the create RPC may already set the role server-side.
        }
      }
      refreshProfiles()

      await persistStorage.removeItem(DRAFT_STORAGE_KEY)
      toast.show('Shop created', { tone: 'success', message: 'Your storefront is live.' })
      setCountdown(REDIRECT_COUNTDOWN_SECONDS)
      setPhase('success')
    } catch (message) {
      hasSubmittedRef.current = false
      toast.show('Could not create shop', { tone: 'danger', message: String(message) })
    } finally {
      setIsSubmitting(false)
    }
  }, [dispatch, formData, goToStep, profile?.role, steps, toast, user?.id])

  // ---- Gate / loading states -------------------------------------------------

  // Only gate the initial form phase — never tear down the success overlay
  // (a profile refetch after role promotion can briefly re-enter loading).
  const isBlocked = shopsChecked && !profileLoading && (alreadyVendor || alreadyHasShop)
  if (phase === 'form' && (profileLoading || !shopsChecked || !hydrated || isBlocked)) {
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

  const formBody = (
    <XStack width="100%" alignItems="flex-start" alignSelf="center" maxWidth={1200}>
      {isDesktop ? (
        <StickyRail
          width={248}
          flexShrink={0}
          backgroundColor={ui.surface}
          borderRightWidth={1}
          borderRightColor={ui.borderSubtle}
        >
          <StepSidebar
            ui={ui}
            steps={steps}
            stepIndex={stepIndex}
            stepCompletion={stepCompletion}
            onSelect={goToStep}
          />
        </StickyRail>
      ) : null}

      <YStack
        flex={1}
        flexGrow={1}
        flexShrink={1}
        minWidth={0}
        paddingHorizontal={isDesktop ? '$8' : '$4'}
        paddingTop="$6"
        paddingBottom={(isDesktop ? 40 : 32) + safeBottom}
      >
        <ProgressHeader ui={ui} stepIndex={stepIndex} total={steps.length} percent={completionPercentage} />

        <YStack
          width="100%"
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
            <BasicInfoStep ui={ui} formData={formData} errors={errors} touched={touched} setField={setField} onBlur={handleBlur} />
          ) : null}
          {currentStep.id === 'contact' ? (
            <ContactStep ui={ui} formData={formData} errors={errors} touched={touched} setField={setField} onBlur={handleBlur} accountEmail={user?.email ?? null} />
          ) : null}
          {currentStep.id === 'categories' ? (
            <CategoriesStep ui={ui} formData={formData} onToggle={toggleCategory} />
          ) : null}
          {currentStep.id === 'currency' ? (
            <CurrencyStep ui={ui} formData={formData} showAll={showAllCurrencies} onShowAll={() => setShowAllCurrencies(true)} onSelect={(code) => setField('shop_currency', code)} />
          ) : null}
          {currentStep.id === 'socialMedia' ? (
            <SocialStep ui={ui} formData={formData} errors={errors} onChange={setSocialLink} />
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
              icon={isSubmitting ? <Spinner size="small" color="white" /> : <Icons.Store size={16} color="white" />}
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
      </YStack>
    </XStack>
  )

  return (
    <YStack width="100%" backgroundColor={ui.background}>
      <PageScroll>{formBody}</PageScroll>

      {phase === 'success' ? (
        <SuccessOverlay
          ui={ui}
          countdown={countdown}
          onSkip={() => router.replace(vendorRoutes.home)}
          onContinue={() => router.replace(vendorRoutes.createListing)}
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
    <YStack paddingHorizontal="$4" paddingVertical="$5" gap="$4" width="100%">
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
              {isActive ? <YStack width={3} height={20} borderRadius={999} backgroundColor={ui.brand} /> : null}
            </XStack>
          )
        })}
      </YStack>

      <YStack>
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

function ProgressHeader({ ui, stepIndex, total, percent }: { ui: Ui; stepIndex: number; total: number; percent: number }) {
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
        <YStack height="100%" width={`${percent}%`} borderRadius={999} backgroundColor={ui.brand} animation="quick" />
      </YStack>
    </YStack>
  )
}

function StepHeader({ ui, step }: { ui: Ui; step: ShopCreationStep }) {
  const Icon = stepIconFor(step.icon)
  return (
    <XStack gap="$3" alignItems="center">
      <YStack width={48} height={48} borderRadius={radius.chip} alignItems="center" justifyContent="center" backgroundColor={ui.roseSurface}>
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
  const border = tone === 'warning' ? 'rgba(217, 119, 6, 0.28)' : 'rgba(208, 16, 96, 0.2)'
  const titleColor = tone === 'warning' ? '#b45309' : ui.brand
  return (
    <XStack gap="$3" padding="$3.5" borderRadius={radius.card} backgroundColor={bg} borderWidth={1} borderColor={border}>
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

function BasicInfoStep({ ui, formData, errors, touched, setField, onBlur }: StepBodyProps) {
  const descriptionLength = formData.shop_description?.length ?? 0
  return (
    <YStack gap="$4">
      <Callout ui={ui} tone="brand" icon={<Icons.Lightbulb size={18} color={ui.brand} />} title="Make a great first impression">
        Your shop name and description are the first things buyers see. Keep it clear, memorable, and reflective of your products.
      </Callout>
      <Callout ui={ui} tone="warning" icon={<Icons.AlertTriangle size={18} color="#b45309" />} title="Review prohibited items">
        Before proceeding, ensure your inventory complies with our Prohibited Items Policy to avoid account suspension.
      </Callout>

      <FieldShell ui={ui} label="Shop Name" required error={touched.shop_name ? errors.shop_name : undefined} hint="Between 2 and 200 characters.">
        <Input
          value={formData.shop_name}
          onChangeText={(value) => setField('shop_name', value)}
          onBlur={() => onBlur('shop_name')}
          placeholder="e.g. The Velvet Ribbon"
          maxLength={SHOP_VALIDATION.NAME.MAX_LENGTH}
          invalid={Boolean(touched.shop_name && errors.shop_name)}
        />
      </FieldShell>

      <FieldShell
        ui={ui}
        label="Shop Description"
        error={touched.shop_description ? errors.shop_description : undefined}
        hint={
          <XStack justifyContent="space-between">
            <Text fontSize={12} color={ui.textMuted}>
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

  const [phoneCountry, setPhoneCountry] = useState<Country>(() => {
    const parsed = parseE164Phone(formData.shop_phone_number?.trim() ?? '')
    return parsed?.country ?? DEFAULT_COUNTRY
  })
  const [phoneNational, setPhoneNational] = useState(() => {
    const parsed = parseE164Phone(formData.shop_phone_number?.trim() ?? '')
    return parsed?.nationalNumber ?? ''
  })

  useEffect(() => {
    if (phoneNational.trim()) return
    const e164 = formData.shop_phone_number?.trim()
    if (!e164) return
    const parsed = parseE164Phone(e164)
    if (parsed) {
      setPhoneCountry(parsed.country)
      setPhoneNational(parsed.nationalNumber)
    }
  }, [formData.shop_phone_number, phoneNational])

  const syncPhoneToForm = useCallback(
    (country: Country, national: string) => {
      const digits = nationalDigits(national).slice(0, country.maxLength)
      if (!digits) {
        setField('shop_phone_number', '')
        return
      }
      const result = validateNationalPhone(digits, country)
      setField('shop_phone_number', result.ok ? result.e164 : toE164Phone(country, digits))
    },
    [setField],
  )

  const handlePhoneCountryChange = useCallback(
    (country: Country) => {
      setPhoneCountry(country)
      const trimmed = phoneNational.slice(0, country.maxLength)
      setPhoneNational(trimmed)
      syncPhoneToForm(country, trimmed)
    },
    [phoneNational, syncPhoneToForm],
  )

  const handlePhoneNationalChange = useCallback(
    (value: string) => {
      const digits = nationalDigits(value).slice(0, phoneCountry.maxLength)
      setPhoneNational(digits)
      syncPhoneToForm(phoneCountry, digits)
    },
    [phoneCountry, syncPhoneToForm],
  )

  const phoneHint =
    phoneCountry.minLength === phoneCountry.maxLength
      ? `${phoneCountry.maxLength}-digit mobile number for ${phoneCountry.name}.`
      : `${phoneCountry.minLength}–${phoneCountry.maxLength}-digit mobile number for ${phoneCountry.name}.`

  return (
    <YStack gap="$4">
      <Callout ui={ui} tone="warning" icon={<Icons.Info size={18} color="#b45309" />} title="Contact information required">
        Provide at least one contact method (email or phone) so customers can reach you.
      </Callout>

      <FieldShell
        ui={ui}
        label="Phone Number"
        required={phoneRequired}
        error={touched.shop_phone_number ? errors.shop_phone_number : undefined}
        hint={phoneHint}
      >
        <XStack
          alignItems="center"
          gap="$2"
          borderWidth={1}
          borderColor={touched.shop_phone_number && errors.shop_phone_number ? ui.error : ui.borderSubtle}
          borderRadius={radius.chip}
          backgroundColor={ui.surface}
          overflow="hidden"
        >
          <CountryCodePicker value={phoneCountry} onChange={handlePhoneCountryChange} compact />
          <YStack width={1} height={28} backgroundColor={ui.borderSubtle} />
          <Input
            flex={1}
            borderWidth={0}
            backgroundColor="transparent"
            autoCapitalize="none"
            autoComplete="tel"
            textContentType="telephoneNumber"
            keyboardType="phone-pad"
            placeholder={phoneCountry.placeholder}
            value={phoneNational}
            onChangeText={handlePhoneNationalChange}
            onBlur={() => onBlur('shop_phone_number')}
            invalid={Boolean(touched.shop_phone_number && errors.shop_phone_number)}
            maxLength={phoneCountry.maxLength}
          />
        </XStack>
        {phoneNational && !errors.shop_phone_number ? (
          <Text fontSize={12} color={ui.textMuted} marginTop="$1">
            {formatPhoneForDisplay(toE164Phone(phoneCountry, phoneNational), phoneCountry)}
          </Text>
        ) : null}
      </FieldShell>

      <FieldShell
        ui={ui}
        label="Email Address"
        required={emailRequired}
        error={touched.shop_email ? errors.shop_email : undefined}
        hint={accountEmail && formData.shop_email === accountEmail ? 'This email is linked to your primary account.' : undefined}
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

      <FieldShell ui={ui} label="Website URL (optional)" error={touched.website_url ? errors.website_url : undefined}>
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

function CategoriesStep({ ui, formData, onToggle }: { ui: Ui; formData: ShopFormData; onToggle: (category: string) => void }) {
  const selected = formData.shop_categories ?? []
  return (
    <YStack gap="$4">
      <Callout ui={ui} tone="brand" icon={<Icons.Info size={18} color={ui.brand} />} title="Help customers find you">
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

      <XStack flexWrap="wrap" gap="$2.5">
        {COMMON_SHOP_CATEGORIES.map((category) => {
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
              <Text flex={1} fontSize={14} fontWeight={isSelected ? '700' : '500'} color={isSelected ? ui.text : ui.textSecondary} numberOfLines={1}>
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
      <Callout ui={ui} tone="warning" icon={<Icons.Info size={18} color="#b45309" />} title="Choose pricing currency">
        Select the primary currency you will use to price your products or services. This can be changed later in settings.
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
              <YStack width={36} height={36} borderRadius={999} alignItems="center" justifyContent="center" backgroundColor={isSelected ? ui.brand : ui.chip}>
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
          <Text fontSize={13} fontWeight="700" color={ui.brand} cursor="pointer" onPress={onShowAll} pressStyle={{ opacity: 0.6 }}>
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
      <Callout ui={ui} tone="brand" icon={<Icons.Megaphone size={18} color={ui.brand} />} title="Expand your reach">
        Linking your social accounts helps customers find you and builds trust. Connecting profiles is optional.
      </Callout>

      <XStack flexWrap="wrap" gap="$3.5">
        {SOCIAL_FIELDS.map(({ platform, label, icon: Icon, placeholder }) => {
          const error = errors[`social_${platform}`]
          return (
            <YStack key={platform} width="48%" minWidth={240} flexGrow={1} gap="$2">
              <Text fontSize={13} fontWeight="600" color={ui.text}>
                {label}
              </Text>
              <XStack alignItems="center" gap="$2" borderWidth={1} borderColor={error ? ui.error : ui.borderSubtle} borderRadius={radius.chip} paddingLeft="$3" backgroundColor={ui.surface}>
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

function SuccessOverlay({
  ui,
  countdown,
  onSkip,
  onContinue,
}: {
  ui: Ui
  countdown: number
  onSkip: () => void
  onContinue: () => void
}) {
  return (
    <YStack style={overlayBackdropStyle()} zIndex={500} alignItems="center" justifyContent="center" padding="$4">
      <YStack fullscreen backgroundColor="rgba(10, 10, 15, 0.55)" animation="quick" enterStyle={{ opacity: 0 }} />
      <YStack
        width="100%"
        maxWidth={420}
        backgroundColor={ui.surface}
        borderRadius={radius.surface}
        borderWidth={1}
        borderColor={ui.borderSubtle}
        padding="$6"
        gap="$4"
        alignItems="center"
        zIndex={1}
        animation="quick"
        enterStyle={{ opacity: 0, scale: 0.96, y: 8 }}
        style={getShadowStyle('lg')}
      >
        <YStack width={72} height={72} borderRadius={999} alignItems="center" justifyContent="center" backgroundColor={ui.roseSurface}>
          <Icons.PartyPopper size={34} color={ui.brand} />
        </YStack>

        <YStack gap="$2" alignItems="center">
          <Text fontSize={20} fontWeight="800" color={ui.text} textAlign="center">
            Your shop is live!
          </Text>
          <Text fontSize={14} color={ui.textSecondary} textAlign="center" lineHeight={20}>
            Let's add your first product. Redirecting to create a listing in {countdown}s…
          </Text>
        </YStack>

        <YStack width="100%" gap="$2.5">
          <Button tone="primary" size="$4" borderRadius={999} onPress={onContinue} icon={<Icons.Plus size={16} color="white" />}>
            Create my first listing
          </Button>
          <Button tone="ghost" size="$3" borderRadius={999} onPress={onSkip}>
            Skip — go to dashboard
          </Button>
        </YStack>
      </YStack>
    </YStack>
  )
}
