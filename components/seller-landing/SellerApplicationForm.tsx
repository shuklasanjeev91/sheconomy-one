import { useCallback, useEffect, useRef, useState } from 'react'
import { Platform, TextInput } from 'react-native'
import { useRouter } from 'one'

import {
  AppBottomSheet,
  Button,
  Icons,
  Input,
  Spinner,
  Text,
  XStack,
  YStack,
  useAppToast,
} from '~/components/ui'
import { GenderVerificationModal } from '~/components/gender-verification/GenderVerificationModal'
import { PhoneInput } from '~/components/forms/PhoneInput'
import { BulkImportContent } from '~/commerce/components/vendor/bulk-import/BulkImportContent'
import { StepIndicator } from '~/components/seller-landing/StepIndicator'
import { radius } from '~/config/tokens'
import { useAuth } from '~/hooks/useAuth'
import { useAppLayout } from '~/hooks/useAppLayout'
import { useProfile } from '~/hooks/useProfile'
import { isValidPhone } from '~/lib/phone/phone'
import { commerceRoutes, vendorRoutes } from '~/lib/routes'
import { createShop } from '~/lib/shop/shop.store'
import type { Shop } from '~/lib/shop/shop.type'
import { useShopCategoryOptions } from '~/lib/shop/useShopCategoryOptions'
import { generateShopSlug } from '~/lib/shop/shop.utils'
import { shopNameValidator } from '~/lib/shop/shop.validation'
import { useAppDispatch } from '~/lib/store/hooks'
import { supabase } from '~/lib/supabase'
import { sendEmailOtp, sendPhoneOtp } from '~/lib/supabase/auth'
import { useAppUi } from '~/lib/theme/useAppUi'
import {
  clearLandingUrlFromStorage,
  clearUtmFromStorage,
  normalizeUtmSource,
  readLandingUrlFromStorage,
  readUtmFromStorage,
} from '~/lib/utm/utm.utils'

// ─── Types ────────────────────────────────────────────────────────────────────

type StepId = 1 | 2 | 3 | 4
type SignupMethod = 'email' | 'mobile'
type ShopNameStatus = 'idle' | 'checking' | 'available' | 'taken'

interface FormData {
  full_name: string
  email: string
  phone: string
  category: string
  business_name: string
}

interface FormErrors {
  full_name: string
  email: string
  phone: string
  category: string
  business_name: string
}

const EMPTY_FORM: FormData = {
  full_name: '',
  email: '',
  phone: '',
  category: '',
  business_name: '',
}

const EMPTY_ERRORS: FormErrors = {
  full_name: '',
  email: '',
  phone: '',
  category: '',
  business_name: '',
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtTime(secs: number): string {
  return `${Math.floor(secs / 60)}:${(secs % 60).toString().padStart(2, '0')}`
}

async function mergeLandingUrlIntoDeviceInfo(userId: string): Promise<void> {
  try {
    const landingUrl = readLandingUrlFromStorage()
    if (!landingUrl || !userId) return
    const { data: row } = await supabase
      .from('profiles')
      .select('device_info')
      .eq('id', userId)
      .single()
    const raw = row?.device_info
    const current: Record<string, unknown> =
      raw == null
        ? {}
        : typeof raw === 'object'
          ? (raw as Record<string, unknown>)
          : (() => {
              try {
                return JSON.parse(raw as string)
              } catch {
                return {}
              }
            })()
    if (current.landing_url) return
    await supabase
      .from('profiles')
      .update({
        device_info: {
          ...current,
          landing_url: landingUrl,
          landing_url_saved_at: new Date().toISOString(),
        },
      })
      .eq('id', userId)
  } catch {}
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ShopNameStatusBadge({
  status,
  slug,
  ui,
}: {
  status: ShopNameStatus
  slug: string
  ui: ReturnType<typeof useAppUi>
}) {
  if (status === 'idle') return null

  if (status === 'checking') {
    return (
      <XStack alignItems="center" gap="$1.5">
        <Spinner size="small" color={ui.textMuted} />
        <Text fontSize={12} color={ui.textMuted}>
          Checking availability…
        </Text>
      </XStack>
    )
  }

  if (status === 'available') {
    return (
      <YStack gap="$1">
        <XStack alignItems="center" gap="$1.5">
          <Icons.CheckCircle2 size={13} color="#16a34a" />
          <Text fontSize={12} color="#16a34a" fontWeight="600">
            Name is available!
          </Text>
        </XStack>
        <XStack alignItems="center" gap="$1">
          <Icons.Store size={12} color={ui.textMuted} />
          <Text fontSize={11} color={ui.textMuted}>
            Your shop URL:{' '}
            <Text fontSize={11} fontWeight="700" color={ui.textSecondary}>
              sheconomy.in/shops/{slug}
            </Text>
          </Text>
        </XStack>
      </YStack>
    )
  }

  return (
    <YStack
      backgroundColor="rgba(239,68,68,0.06)"
      borderWidth={1}
      borderColor="rgba(239,68,68,0.2)"
      borderRadius={radius.chip}
      padding="$2.5"
      gap="$0.5"
    >
      <XStack alignItems="center" gap="$1.5">
        <Icons.XCircle size={13} color="#ef4444" />
        <Text fontSize={12} color="#ef4444" fontWeight="700">
          This shop name is already taken
        </Text>
      </XStack>
      <Text fontSize={11} color="#ef4444">
        Try adding your city, specialty, or a unique word.
      </Text>
    </YStack>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function SellerApplicationForm() {
  const router = useRouter()
  const ui = useAppUi()
  const { isDesktop } = useAppLayout()
  const dispatch = useAppDispatch()
  const toast = useAppToast()
  const { isAuthenticated } = useAuth()
  // Use the live-fetched profile (queries Supabase on auth change) so that
  // gender / is_verified are always up-to-date and the step-mapping effect works.
  const { profile } = useProfile()

  // ── Step & auth state ──────────────────────────────────────────────────────
  const [currentStep, setCurrentStep] = useState<StepId>(1)
  const [userId, setUserId] = useState<string | null>(null)
  const [isGenderVerified, setIsGenderVerified] = useState(false)
  const [hasShop, setHasShop] = useState(false)
  const [isCheckingShop, setIsCheckingShop] = useState(true)
  const [createdShopData, setCreatedShopData] = useState<{
    id: string
    shop_name: string
    slug: string
  } | null>(null)

  // ── Form state ─────────────────────────────────────────────────────────────
  const [signupMethod, setSignupMethod] = useState<SignupMethod>('email')
  const [formData, setFormData] = useState<FormData>(EMPTY_FORM)
  const [formErrors, setFormErrors] = useState<FormErrors>(EMPTY_ERRORS)

  // ── OTP state ──────────────────────────────────────────────────────────────
  const [showOtpInput, setShowOtpInput] = useState(false)
  const [otp, setOtp] = useState(['', '', '', '', '', ''])
  const [otpError, setOtpError] = useState('')
  const [existingMsg, setExistingMsg] = useState('')
  const [isCheckingUser, setIsCheckingUser] = useState(false)
  const [isSendingOtp, setIsSendingOtp] = useState(false)
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false)
  const [otpExpiryTime, setOtpExpiryTime] = useState<number | null>(null)
  const [expiryCountdown, setExpiryCountdown] = useState(0)
  const [resendCountdown, setResendCountdown] = useState(0)

  // ── Shop state ─────────────────────────────────────────────────────────────
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [shopNameStatus, setShopNameStatus] = useState<ShopNameStatus>('idle')
  const [shopNameSlug, setShopNameSlug] = useState('')
  const shopNameDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [isCategorySheetOpen, setIsCategorySheetOpen] = useState(false)
  const { categories: shopCategories, loading: shopCategoriesLoading } = useShopCategoryOptions()

  // ── OTP input refs for focus chaining ─────────────────────────────────────
  const otpRefs = useRef<Array<TextInput | null>>([null, null, null, null, null, null])

  // ─────────────────────────────────────────────────────────────────────────
  // Initial setup: check for existing shop + map step from auth state
  // ─────────────────────────────────────────────────────────────────────────

  useEffect(() => {
    const checkShop = async () => {
      if (profile?.id) {
        try {
          const { data } = await supabase
            .from('shops')
            .select('id, shop_name, slug, is_active, verified')
            .eq('user_id', profile.id)
            .maybeSingle()
          if (data) {
            setHasShop(true)
            setCreatedShopData({ id: data.id, shop_name: data.shop_name ?? '', slug: data.slug ?? '' })
          } else {
            setHasShop(false)
          }
        } catch {
        } finally {
          setIsCheckingShop(false)
        }
      } else {
        setIsCheckingShop(false)
      }
    }
    checkShop()
  }, [profile])

  // Map step from auth state (same logic as old ApplicationForm)
  useEffect(() => {
    if (isCheckingShop) return
    if (hasShop) {
      setCurrentStep(4)
    } else if (isAuthenticated && profile?.gender && profile?.is_verified) {
      setCurrentStep(3)
      setUserId(profile.id)
      setIsGenderVerified(true)
      setFormData((p) => ({
        ...p,
        full_name: profile.full_name ?? '',
        email: profile.email ?? '',
        phone: profile.phone ?? '',
      }))
    } else if (isAuthenticated && profile && !profile.gender) {
      setCurrentStep(2)
      setUserId(profile.id)
      setFormData((p) => ({
        ...p,
        full_name: profile.full_name ?? '',
        email: profile.email ?? '',
        phone: profile.phone ?? '',
      }))
    } else if (!isAuthenticated) {
      setCurrentStep(1)
    }
  }, [isAuthenticated, profile, hasShop, isCheckingShop])

  // ─────────────────────────────────────────────────────────────────────────
  // OTP expiry timer
  // ─────────────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!otpExpiryTime || expiryCountdown <= 0) return
    const iv = setInterval(() => {
      const rem = Math.max(0, Math.floor((otpExpiryTime - Date.now()) / 1000))
      setExpiryCountdown(rem)
      if (rem === 0) {
        setOtp(['', '', '', '', '', ''])
        setOtpError('OTP expired. Please request a new one.')
        setShowOtpInput(false)
      }
      setResendCountdown(rem > 570 ? 600 - rem : 0)
    }, 1000)
    return () => clearInterval(iv)
  }, [otpExpiryTime, expiryCountdown])

  // ─────────────────────────────────────────────────────────────────────────
  // Debounced shop name availability check
  // ─────────────────────────────────────────────────────────────────────────

  const checkShopNameAvailability = useCallback(async (name: string) => {
    const trimmed = name.trim()
    if (!trimmed || trimmed.length < 2) {
      setShopNameStatus('idle')
      setShopNameSlug('')
      return
    }
    const slug = generateShopSlug(trimmed)
    if (!slug) {
      setShopNameStatus('idle')
      setShopNameSlug('')
      return
    }
    setShopNameSlug(slug)
    setShopNameStatus('checking')
    try {
      const { data, error } = await supabase
        .from('shops')
        .select('id')
        .or(`slug.eq.${slug},shop_name.ilike.${trimmed}`)
        .limit(1)
      if (error) {
        setShopNameStatus('idle')
        return
      }
      setShopNameStatus(data && data.length > 0 ? 'taken' : 'available')
    } catch {
      setShopNameStatus('idle')
    }
  }, [])

  useEffect(() => {
    if (currentStep !== 3) return
    if (shopNameDebounceRef.current) clearTimeout(shopNameDebounceRef.current)
    const name = formData.business_name
    if (!name || name.trim().length < 2) {
      setShopNameStatus('idle')
      setShopNameSlug('')
      return
    }
    shopNameDebounceRef.current = setTimeout(() => {
      checkShopNameAvailability(name)
    }, 600)
    return () => {
      if (shopNameDebounceRef.current) clearTimeout(shopNameDebounceRef.current)
    }
  }, [formData.business_name, currentStep, checkShopNameAvailability])

  // ─────────────────────────────────────────────────────────────────────────
  // Derived helpers
  // ─────────────────────────────────────────────────────────────────────────

  const getVisibleSteps = (): StepId[] => {
    const steps: StepId[] = []
    if (!isAuthenticated) steps.push(1)
    if (!profile?.gender || !profile?.is_verified) steps.push(2)
    if (!hasShop) steps.push(3)
    steps.push(4)
    return steps
  }

  const isSendOtpEnabled = (): boolean => {
    if (!formData.full_name.trim() || formData.full_name.trim().length < 2) return false
    if (signupMethod === 'email') return EMAIL_REGEX.test(formData.email.trim())
    return isValidPhone(formData.phone)
  }

  const isCreateShopDisabled =
    isSubmitting || shopNameStatus === 'taken' || shopNameStatus === 'checking'

  // ─────────────────────────────────────────────────────────────────────────
  // Form handlers
  // ─────────────────────────────────────────────────────────────────────────

  const handleInput = (field: keyof FormData, value: string) => {
    setFormData((p) => ({ ...p, [field]: value }))
    if (field !== 'phone' && formErrors[field]) {
      setFormErrors((p) => ({ ...p, [field]: '' }))
    }
    if (existingMsg) setExistingMsg('')
    if (field === 'business_name' && !value.trim()) {
      setShopNameStatus('idle')
      setShopNameSlug('')
    }
  }

  const validateStep1 = (): boolean => {
    const nameErr = !formData.full_name.trim()
      ? 'Name is required'
      : formData.full_name.trim().length < 2
        ? 'Minimum 2 characters'
        : ''
    const emailErr =
      signupMethod === 'email'
        ? !formData.email.trim()
          ? 'Email is required'
          : !EMAIL_REGEX.test(formData.email)
            ? 'Invalid email format'
            : ''
        : ''
    const phoneErr =
      signupMethod === 'mobile'
        ? !formData.phone
          ? 'Phone is required'
          : !isValidPhone(formData.phone)
            ? 'Enter a valid Indian mobile number'
            : ''
        : ''
    setFormErrors((p) => ({ ...p, full_name: nameErr, email: emailErr, phone: phoneErr }))
    return !nameErr && !emailErr && !phoneErr
  }

  const validateStep3 = (): boolean => {
    const categoryErr = !formData.category ? 'Please select a category' : ''
    const nameValidation = shopNameValidator(formData.business_name)
    const businessNameErr = nameValidation ?? ''
    setFormErrors((p) => ({ ...p, category: categoryErr, business_name: businessNameErr }))
    if (categoryErr || businessNameErr) {
      toast.show(categoryErr || businessNameErr, { tone: 'error' })
      return false
    }
    if (shopNameStatus === 'taken') {
      toast.show('Shop name unavailable — please choose a different name.', { tone: 'error' })
      return false
    }
    if (shopNameStatus === 'checking') {
      toast.show('Checking shop name availability…', { tone: 'error' })
      return false
    }
    return true
  }

  // ─────────────────────────────────────────────────────────────────────────
  // OTP flow
  // ─────────────────────────────────────────────────────────────────────────

  const checkUserExists = async () => {
    const col = signupMethod === 'email' ? 'email' : 'phone'
    const val = signupMethod === 'email' ? formData.email.trim() : formData.phone
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id,full_name,role,gender,is_verified')
        .eq(col, val)
        .single()
      if (error?.code === 'PGRST116') return { exists: false, user: null }
      return { exists: !!data, user: data ?? null }
    } catch {
      return { exists: false, user: null }
    }
  }

  const sendOtp = async (): Promise<{ success: boolean; error?: string }> => {
    setIsSendingOtp(true)
    try {
      if (signupMethod === 'email') {
        const { error } = await sendEmailOtp(formData.email.trim(), {
          fullName: formData.full_name,
        })
        if (error) throw error
      } else {
        const { error } = await sendPhoneOtp(formData.phone, {
          fullName: formData.full_name,
        })
        if (error) throw error
      }
      return { success: true }
    } catch (e: unknown) {
      return { success: false, error: (e as Error).message }
    } finally {
      setIsSendingOtp(false)
    }
  }

  const handleSendOTP = async () => {
    if (!validateStep1()) {
      toast.show(formErrors.phone || 'Please fix the errors before continuing.', { tone: 'error' })
      return
    }
    setIsCheckingUser(true)
    setExistingMsg('')
    try {
      const { exists, user } = await checkUserExists()
      if (exists && user) {
        if (user.role === 'V') {
          setExistingMsg(`Welcome back ${user.full_name}! You already have a seller account.`)
          return
        }
        // Existing non-vendor: merge UTM + skip OTP
        const latestUtm = readUtmFromStorage()
        if (latestUtm.utm_source) latestUtm.utm_source = normalizeUtmSource(latestUtm.utm_source)
        if (Object.keys(latestUtm).length > 0) {
          await supabase.from('profiles').update(latestUtm).eq('id', user.id)
        }
        await mergeLandingUrlIntoDeviceInfo(user.id)
        setUserId(user.id)
        if (user.gender && user.is_verified) {
          setCurrentStep(3)
          setIsGenderVerified(true)
        } else {
          setCurrentStep(2)
        }
        return
      }
      const result = await sendOtp()
      if (result.success) {
        setShowOtpInput(true)
        const expiry = Date.now() + 600_000
        setOtpExpiryTime(expiry)
        setExpiryCountdown(600)
        toast.show(`OTP sent to your ${signupMethod === 'email' ? 'email' : 'phone'}`, {
          tone: 'success',
        })
      } else {
        toast.show(result.error ?? 'Failed to send OTP', { tone: 'error' })
      }
    } finally {
      setIsCheckingUser(false)
    }
  }

  const handleVerifyOTP = async () => {
    const code = otp.join('')
    if (code.length !== 6) {
      setOtpError('Please enter the 6-digit OTP')
      return
    }
    setOtpError('')
    setIsVerifyingOtp(true)
    try {
      let verifyError: string | null = null
      if (signupMethod === 'email') {
        const { error } = await supabase.auth.verifyOtp({
          email: formData.email.trim(),
          token: code,
          type: 'email',
        })
        if (error) verifyError = error.message
      } else {
        const { error } = await supabase.auth.verifyOtp({
          phone: formData.phone,
          token: code,
          type: 'sms',
        })
        if (error) verifyError = error.message
      }
      if (verifyError) {
        setOtpError(verifyError)
        return
      }
      const {
        data: { user: authUser },
      } = await supabase.auth.getUser()
      const uid = authUser?.id
      if (!uid) return
      const latestUtm = readUtmFromStorage()
      if (latestUtm.utm_source) latestUtm.utm_source = normalizeUtmSource(latestUtm.utm_source)
      if (Object.keys(latestUtm).length > 0) {
        await supabase.from('profiles').update(latestUtm).eq('id', uid)
      }
      await mergeLandingUrlIntoDeviceInfo(uid)
      setUserId(uid)
      setCurrentStep(2)
      toast.show('OTP verified — let\'s verify your identity.', { tone: 'success' })
    } catch {
    } finally {
      setIsVerifyingOtp(false)
    }
  }

  const handleResend = async () => {
    if (resendCountdown > 0) return
    const result = await sendOtp()
    if (result.success) {
      setOtp(['', '', '', '', '', ''])
      setOtpError('')
      const expiry = Date.now() + 600_000
      setOtpExpiryTime(expiry)
      setExpiryCountdown(600)
      toast.show('New OTP sent', { tone: 'success' })
    }
  }

  const handleOtpChange = (index: number, val: string) => {
    const digits = val.replace(/\D/g, '')
    if (digits.length > 1) {
      // Paste: distribute digits starting from the current box
      const next = [...otp]
      digits.split('').slice(0, 6 - index).forEach((d, j) => {
        next[index + j] = d
      })
      setOtp(next)
      const lastFilled = Math.min(index + digits.length - 1, 5)
      otpRefs.current[lastFilled]?.focus()
      if (otpError) setOtpError('')
      return
    }
    if (!digits && val.length === 0) {
      const next = [...otp]
      next[index] = ''
      setOtp(next)
      return
    }
    if (!digits) return
    const next = [...otp]
    next[index] = digits
    setOtp(next)
    if (index < 5) {
      otpRefs.current[index + 1]?.focus()
    }
    if (otpError) setOtpError('')
  }

  const handleOtpKeyPress = (index: number, key: string) => {
    if (key === 'Backspace' && !otp[index] && index > 0) {
      const next = [...otp]
      next[index - 1] = ''
      setOtp(next)
      otpRefs.current[index - 1]?.focus()
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Face verification
  // ─────────────────────────────────────────────────────────────────────────

  const handleFaceVerified = useCallback(() => {
    // ── Advance the form immediately so the modal closes in this render cycle.
    // Doing this before any await prevents a post-success dismiss handler from
    // resetting the form after verification already succeeded.
    setIsGenderVerified(true)
    setCurrentStep(3)
    toast.show('Identity verified — set up your shop!', { tone: 'success' })

    // ── Fire-and-forget: persist verification data in the background ──────────
    const uid = userId || profile?.id
    if (uid) {
      void (async () => {
        try {
          const { data: existing } = await supabase
            .from('profiles')
            .select('device_info')
            .eq('id', uid)
            .single()
          const raw = existing?.device_info
          const currentDeviceInfo: Record<string, unknown> =
            raw == null
              ? {}
              : typeof raw === 'object'
                ? (raw as Record<string, unknown>)
                : (() => {
                    try {
                      return JSON.parse(raw as string)
                    } catch {
                      return {}
                    }
                  })()

          const verificationTracking: Record<string, unknown> = {
            face_verified_at: new Date().toISOString(),
            verification_source: 'sellerlanding_face_verification',
          }

          if (Platform.OS === 'web') {
            verificationTracking.screen = `${window.screen.width}x${window.screen.height}`
            verificationTracking.language = navigator.language
          }

          const landingUrl = readLandingUrlFromStorage()
          if (landingUrl && !currentDeviceInfo.landing_url) {
            verificationTracking.landing_url = landingUrl
            verificationTracking.landing_url_saved_at = new Date().toISOString()
          }

          await supabase
            .from('profiles')
            .update({
              gender: true,
              is_verified: true,
              device_info: { ...currentDeviceInfo, ...verificationTracking },
              updated_at: new Date().toISOString(),
            })
            .eq('id', uid)
        } catch {}
      })()
    }
  }, [userId, profile?.id, toast])

  /** App Store 5.1.1 — face check is optional; skip returns to limited browsing. */
  const handleVerificationSkip = useCallback(() => {
    setIsGenderVerified(false)
    setCurrentStep(1)
    toast.show('Skipped verification — you can still use Commerce, Classes, and Co-Work.', {
      tone: 'success',
    })
    router.push(commerceRoutes.home)
  }, [router, toast])

  // ─────────────────────────────────────────────────────────────────────────
  // Shop creation
  // ─────────────────────────────────────────────────────────────────────────

  const handleCreateSellerAccount = async () => {
    if (!validateStep3()) return
    setIsSubmitting(true)
    try {
      const latestUtm = readUtmFromStorage()
      if (latestUtm.utm_source) latestUtm.utm_source = normalizeUtmSource(latestUtm.utm_source)

      const profileId = userId || profile?.id
      if (!profileId) throw new Error('User not authenticated')

      // Update profile role + UTM
      const profileData: Record<string, unknown> = {
        role: 'V',
        gender: true,
        is_verified: true,
        business_name: formData.business_name.trim(),
        ...latestUtm,
        updated_at: new Date().toISOString(),
      }
      if (signupMethod === 'email' && formData.email.trim()) {
        profileData.email = formData.email.trim()
      }
      if (signupMethod === 'mobile' && formData.phone) {
        profileData.phone = formData.phone
      }
      await supabase.from('profiles').update(profileData).eq('id', profileId)
      await mergeLandingUrlIntoDeviceInfo(profileId)

      // Create shop via Redux thunk
      const slug = shopNameSlug || generateShopSlug(formData.business_name)
      const shopName = formData.business_name.trim()
      const result = await dispatch(
        createShop({
          formData: {
            shop_name: shopName,
            shop_description: `Welcome to my shop! I specialise in ${formData.category}.`,
            shop_categories: [formData.category],
            shop_currency: 'INR',
            ...(signupMethod === 'email' && formData.email.trim()
              ? { shop_email: formData.email.trim() }
              : {}),
            ...(signupMethod === 'mobile' && formData.phone
              ? { shop_phone_number: formData.phone }
              : {}),
          },
          userId: profileId,
        }),
      )

      if (createShop.rejected.match(result)) {
        const errMsg =
          typeof result.payload === 'string' ? result.payload : 'Failed to create shop'
        // Handle duplicate shop name (23505)
        if (errMsg.includes('23505') || errMsg.toLowerCase().includes('already exists')) {
          toast.show('A shop with this name already exists — please choose a different name.', {
            tone: 'error',
          })
        } else {
          toast.show(errMsg, { tone: 'error' })
        }
        return
      }

      const shop = result.payload as Shop | null
      if (shop) {
        setCreatedShopData({ id: shop.id, shop_name: shop.shop_name ?? '', slug: shop.slug ?? '' })
      }

      clearUtmFromStorage()
      clearLandingUrlFromStorage()
      setCurrentStep(4)
      toast.show('🎉 Shop created! Now add your first products.', { tone: 'success' })
    } catch (e: unknown) {
      toast.show((e as Error).message ?? 'Submission failed', { tone: 'error' })
    } finally {
      setIsSubmitting(false)
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Render helpers
  // ─────────────────────────────────────────────────────────────────────────

  const inputBorderColor = (err: string) =>
    err ? 'rgba(239,68,68,0.6)' : undefined

  const businessNameBorderColor = () => {
    if (formErrors.business_name) return 'rgba(239,68,68,0.6)'
    if (shopNameStatus === 'available') return 'rgba(22,163,74,0.5)'
    if (shopNameStatus === 'taken') return 'rgba(239,68,68,0.5)'
    if (shopNameStatus === 'checking') return ui.brand
    return undefined
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Loading state
  // ─────────────────────────────────────────────────────────────────────────

  if (isCheckingShop) {
    return (
      <YStack
        paddingVertical={80}
        alignItems="center"
        justifyContent="center"
        gap="$3"
        nativeID="seller-application-form"
      >
        <Spinner size="large" color={ui.brand} />
        <Text fontSize={13} color={ui.textMuted}>
          Checking your account…
        </Text>
      </YStack>
    )
  }

  const visibleSteps = getVisibleSteps()

  return (
    <YStack
      nativeID="seller-application-form"
      paddingVertical={isDesktop ? 80 : 56}
      paddingHorizontal={isDesktop ? '$8' : '$4'}
      backgroundColor={ui.surfaceMuted}
    >
      {/* Decorative blobs (web only) */}
      {Platform.OS === 'web' && (
        <>
          <YStack
            position="absolute"
            top={0}
            left="30%"
            width={384}
            height={384}
            borderRadius={999}
            backgroundColor={ui.roseSurface}
            opacity={0.5}
            pointerEvents="none"
            style={{ filter: 'blur(64px)' } as React.CSSProperties}
          />
          <YStack
            position="absolute"
            bottom={0}
            right="20%"
            width={320}
            height={320}
            borderRadius={999}
            backgroundColor="rgba(249,115,22,0.06)"
            opacity={0.5}
            pointerEvents="none"
            style={{ filter: 'blur(64px)' } as React.CSSProperties}
          />
        </>
      )}

      <YStack maxWidth={560} alignSelf="center" width="100%" position="relative" zIndex={1}>

        {/* Heading */}
        <YStack gap="$1" alignItems="center" marginBottom="$2">
          <Text fontSize={isDesktop ? 32 : 24} fontWeight="900" color={ui.text} textAlign="center">
            Become a Seller
          </Text>
          <Text fontSize={13} color={ui.textMuted} textAlign="center">
            Join thousands of women entrepreneurs on SHEconomy — free, forever.
          </Text>
        </YStack>

        {/* Step indicator */}
        {!hasShop && (
          <StepIndicator currentStep={currentStep} visibleSteps={visibleSteps} />
        )}

        {/* Card */}
        <YStack
          backgroundColor={ui.surface}
          borderRadius={radius.card}
          borderWidth={1}
          borderColor={ui.borderSubtle}
          overflow="hidden"
          shadowColor="rgba(0,0,0,0.07)"
          shadowOffset={{ width: 0, height: 8 }}
          shadowRadius={24}
          shadowOpacity={1}
        >
          {/* Top accent bar */}
          <YStack
            height={4}
            backgroundColor={ui.brand}
          />

          <YStack padding={isDesktop ? '$6' : '$5'} gap="$4">

            {/* ── STEP 1: OTP ────────────────────────────────────────────── */}
            {currentStep === 1 && !isAuthenticated && (
              <YStack gap="$4">
                <YStack gap="$0.5">
                  <Text fontSize={18} fontWeight="900" color={ui.text}>
                    Verify Your Identity
                  </Text>
                  <Text fontSize={13} color={ui.textMuted}>
                    Enter your details and verify with an OTP
                  </Text>
                </YStack>

                {existingMsg ? (
                  <XStack
                    backgroundColor="rgba(245,158,11,0.08)"
                    borderWidth={1}
                    borderColor="rgba(245,158,11,0.25)"
                    borderRadius={radius.chip}
                    padding="$3"
                    gap="$2"
                    alignItems="flex-start"
                  >
                    <Icons.AlertCircle size={16} color="#b45309" />
                    <Text fontSize={13} color="#92400e" flex={1}>
                      {existingMsg}
                    </Text>
                  </XStack>
                ) : null}

                {/* Full name */}
                <YStack gap="$1.5">
                  <XStack alignItems="center" gap="$1.5">
                    <Icons.User size={12} color={ui.brand} />
                    <Text fontSize={11} fontWeight="700" color={ui.textSecondary} letterSpacing={0.8} textTransform="uppercase">
                      Full Name <Text color={ui.brand}>*</Text>
                    </Text>
                  </XStack>
                  <Input
                    placeholder="Enter your full name"
                    value={formData.full_name}
                    onChangeText={(v) => handleInput('full_name', v)}
                    editable={!showOtpInput}
                    borderColor={inputBorderColor(formErrors.full_name)}
                    autoCapitalize="words"
                  />
                  {formErrors.full_name ? (
                    <XStack alignItems="center" gap="$1">
                      <Icons.AlertCircle size={12} color="#ef4444" />
                      <Text fontSize={12} color="#ef4444">{formErrors.full_name}</Text>
                    </XStack>
                  ) : null}
                </YStack>

                {/* Method toggle */}
                <YStack gap="$1.5">
                  <Text fontSize={11} fontWeight="700" color={ui.textSecondary} letterSpacing={0.8} textTransform="uppercase">
                    Verify Using <Text color={ui.brand}>*</Text>
                  </Text>
                  <XStack
                    backgroundColor={ui.surfaceMuted}
                    borderRadius={radius.chip}
                    padding="$1"
                    gap="$1"
                  >
                    {(['email', 'mobile'] as SignupMethod[]).map((m) => (
                      <XStack
                        key={m}
                        flex={1}
                        alignItems="center"
                        justifyContent="center"
                        gap="$1.5"
                        paddingVertical="$2"
                        borderRadius={radius.chip}
                        backgroundColor={signupMethod === m ? ui.surface : 'transparent'}
                        onPress={() => {
                          if (!showOtpInput) {
                            setSignupMethod(m)
                            setExistingMsg('')
                          }
                        }}
                        cursor="pointer"
                        pressStyle={{ opacity: 0.8 }}
                        shadowColor={signupMethod === m ? 'rgba(0,0,0,0.06)' : 'transparent'}
                        shadowOffset={{ width: 0, height: 1 }}
                        shadowRadius={4}
                        shadowOpacity={1}
                      >
                        {m === 'email' ? (
                          <Icons.Mail size={14} color={signupMethod === m ? ui.brand : ui.textMuted} />
                        ) : (
                          <Icons.Phone size={14} color={signupMethod === m ? ui.brand : ui.textMuted} />
                        )}
                        <Text
                          fontSize={13}
                          fontWeight={signupMethod === m ? '700' : '500'}
                          color={signupMethod === m ? ui.text : ui.textMuted}
                        >
                          {m === 'email' ? 'Email OTP' : 'Mobile OTP'}
                        </Text>
                      </XStack>
                    ))}
                  </XStack>
                </YStack>

                {/* Email input */}
                {signupMethod === 'email' && (
                  <YStack gap="$1.5">
                    <XStack alignItems="center" gap="$1.5">
                      <Icons.Mail size={12} color={ui.brand} />
                      <Text fontSize={11} fontWeight="700" color={ui.textSecondary} letterSpacing={0.8} textTransform="uppercase">
                        Email Address <Text color={ui.brand}>*</Text>
                      </Text>
                    </XStack>
                    <Input
                      placeholder="you@email.com"
                      value={formData.email}
                      onChangeText={(v) => handleInput('email', v)}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      editable={!showOtpInput}
                      borderColor={inputBorderColor(formErrors.email)}
                    />
                    {formErrors.email ? (
                      <XStack alignItems="center" gap="$1">
                        <Icons.AlertCircle size={12} color="#ef4444" />
                        <Text fontSize={12} color="#ef4444">{formErrors.email}</Text>
                      </XStack>
                    ) : null}
                  </YStack>
                )}

                {/* Phone input */}
                {signupMethod === 'mobile' && (
                  <YStack gap="$1.5">
                    <XStack alignItems="center" gap="$1.5">
                      <Icons.Phone size={12} color={ui.brand} />
                      <Text fontSize={11} fontWeight="700" color={ui.textSecondary} letterSpacing={0.8} textTransform="uppercase">
                        Mobile Number <Text color={ui.brand}>*</Text>
                      </Text>
                    </XStack>
                    <PhoneInput
                      value={formData.phone}
                      onChange={(v) => handleInput('phone', v)}
                      invalid={!!formErrors.phone}
                      disabled={showOtpInput}
                    />
                    {formErrors.phone ? (
                      <XStack alignItems="center" gap="$1">
                        <Icons.AlertCircle size={12} color="#ef4444" />
                        <Text fontSize={12} color="#ef4444">{formErrors.phone}</Text>
                      </XStack>
                    ) : null}
                    {!formErrors.phone && formData.phone && isValidPhone(formData.phone) && (
                      <XStack alignItems="center" gap="$1">
                        <Icons.CheckCircle2 size={12} color="#16a34a" />
                        <Text fontSize={12} color="#16a34a">Valid mobile number ✓</Text>
                      </XStack>
                    )}
                  </YStack>
                )}

                {/* Send OTP / OTP input */}
                {!showOtpInput ? (
                  <Button
                    tone="primary"
                    size="$4"
                    borderRadius={radius.card}
                    disabled={!isSendOtpEnabled() || isCheckingUser || isSendingOtp}
                    onPress={handleSendOTP}
                  >
                    <XStack alignItems="center" gap="$2">
                      {isCheckingUser || isSendingOtp ? (
                        <>
                          <Spinner size="small" color="white" />
                          <Text color="white" fontWeight="700">Sending…</Text>
                        </>
                      ) : (
                        <>
                          <Text color="white" fontWeight="700">Send OTP</Text>
                          <Icons.Send size={16} color="white" />
                        </>
                      )}
                    </XStack>
                  </Button>
                ) : (
                  <YStack
                    gap="$3"
                    borderRadius={radius.card}
                    borderWidth={1.5}
                    borderColor="rgba(249,115,22,0.2)"
                    backgroundColor="rgba(249,115,22,0.04)"
                    padding="$4"
                  >
                    {/* Timer + resend */}
                    <XStack alignItems="center" justifyContent="space-between">
                      <XStack alignItems="center" gap="$1.5">
                        <Icons.Clock size={13} color={ui.brand} />
                        <Text fontSize={12} color={ui.textMuted}>
                          Expires:{' '}
                          <Text fontSize={12} fontWeight="700" color={ui.brand}>
                            {fmtTime(expiryCountdown)}
                          </Text>
                        </Text>
                      </XStack>
                      <XStack
                        onPress={handleResend}
                        cursor={resendCountdown > 0 ? 'not-allowed' : 'pointer'}
                        alignItems="center"
                        gap="$1"
                        opacity={resendCountdown > 0 ? 0.4 : 1}
                      >
                        <Icons.RefreshCw size={12} color={ui.brand} />
                        <Text fontSize={12} fontWeight="600" color={ui.brand}>
                          {resendCountdown > 0 ? `Resend in ${resendCountdown}s` : 'Resend OTP'}
                        </Text>
                      </XStack>
                    </XStack>

                    {/* OTP boxes */}
                    <XStack gap="$2" justifyContent="center">
                      {[0, 1, 2, 3, 4, 5].map((i) => (
                        <TextInput
                          key={i}
                          ref={(r) => {
                            otpRefs.current[i] = r
                          }}
                          value={otp[i]}
                          onChangeText={(v) => handleOtpChange(i, v)}
                          onKeyPress={({ nativeEvent }) => handleOtpKeyPress(i, nativeEvent.key)}
                          // maxLength={6} lets paste flow through onChangeText; the handler distributes digits
                          maxLength={6}
                          editable={!isVerifyingOtp}
                          selectTextOnFocus
                          textContentType="oneTimeCode"
                          autoComplete={'one-time-code' as never}
                          {...(Platform.OS === 'web'
                            ? ({ inputMode: 'numeric' } as object)
                            : { keyboardType: 'number-pad' as never })}
                          style={{
                            width: 44,
                            height: 52,
                            borderRadius: radius.chip,
                            borderWidth: 2,
                            borderColor: otp[i] ? (ui.brand as string) : (ui.borderSubtle as string),
                            backgroundColor: otp[i] ? (ui.roseSurface as string) : (ui.surface as string),
                            color: otp[i] ? (ui.brand as string) : (ui.text as string),
                            fontSize: 22,
                            fontWeight: '900' as const,
                            textAlign: 'center' as const,
                            ...(Platform.OS === 'web'
                              ? { outlineWidth: 0, fontFamily: 'inherit' }
                              : {}),
                          }}
                        />
                      ))}
                    </XStack>

                    {otpError ? (
                      <XStack alignItems="center" gap="$1.5">
                        <Icons.AlertCircle size={13} color="#ef4444" />
                        <Text fontSize={12} color="#ef4444">{otpError}</Text>
                      </XStack>
                    ) : null}

                    <Button
                      tone="primary"
                      size="$4"
                      borderRadius={radius.card}
                      disabled={isVerifyingOtp || otp.join('').length !== 6}
                      onPress={handleVerifyOTP}
                    >
                      <XStack alignItems="center" gap="$2">
                        {isVerifyingOtp ? (
                          <>
                            <Spinner size="small" color="white" />
                            <Text color="white" fontWeight="700">Verifying…</Text>
                          </>
                        ) : (
                          <>
                            <Text color="white" fontWeight="700">Verify OTP</Text>
                            <Icons.ArrowRight size={16} color="white" />
                          </>
                        )}
                      </XStack>
                    </Button>
                  </YStack>
                )}

                {/* Trust badges */}
                <XStack justifyContent="center" gap="$4">
                  <XStack alignItems="center" gap="$1.5">
                    <Icons.Shield size={13} color={ui.textMuted} />
                    <Text fontSize={11} color={ui.textMuted}>Secure</Text>
                  </XStack>
                  <Text fontSize={11} color={ui.borderSubtle}>•</Text>
                  <XStack alignItems="center" gap="$1.5">
                    <Icons.Award size={13} color={ui.textMuted} />
                    <Text fontSize={11} color={ui.textMuted}>Women-Only</Text>
                  </XStack>
                  <Text fontSize={11} color={ui.borderSubtle}>•</Text>
                  <Text fontSize={11} color={ui.textMuted}>Free Forever</Text>
                </XStack>
              </YStack>
            )}

            {/* Authenticated but not verified — continue button */}
            {currentStep === 1 && isAuthenticated && !profile?.is_verified && (
              <YStack alignItems="center" gap="$4" paddingVertical="$4">
                <YStack
                  width={64}
                  height={64}
                  borderRadius={14}
                  backgroundColor={ui.roseSurface}
                  alignItems="center"
                  justifyContent="center"
                >
                  <Icons.User size={32} color={ui.brand} />
                </YStack>
                <YStack gap="$1" alignItems="center">
                  <Text fontSize={18} fontWeight="900" color={ui.text}>
                    Welcome back, {profile?.full_name}!
                  </Text>
                  <Text fontSize={13} color={ui.textMuted} textAlign="center">
                    Complete face verification to become a seller.
                  </Text>
                </YStack>
                <Button
                  tone="primary"
                  size="$4"
                  borderRadius={radius.card}
                  onPress={() => setCurrentStep(2)}
                >
                  <XStack alignItems="center" gap="$2">
                    <Text color="white" fontWeight="700">Continue to Face Verification</Text>
                    <Icons.ArrowRight size={16} color="white" />
                  </XStack>
                </Button>
              </YStack>
            )}

            {/* Authenticated + verified but no shop */}
            {currentStep === 1 && isAuthenticated && profile?.is_verified && !hasShop && (
              <YStack alignItems="center" gap="$4" paddingVertical="$4">
                <YStack
                  width={64}
                  height={64}
                  borderRadius={999}
                  backgroundColor="rgba(22,163,74,0.1)"
                  alignItems="center"
                  justifyContent="center"
                >
                  <Icons.CheckCircle2 size={32} color="#16a34a" />
                </YStack>
                <YStack gap="$1" alignItems="center">
                  <Text fontSize={18} fontWeight="900" color={ui.text}>
                    Welcome back, {profile?.full_name}!
                  </Text>
                  <Text fontSize={13} color={ui.textMuted} textAlign="center">
                    You're verified! Let's set up your shop.
                  </Text>
                </YStack>
                <Button
                  tone="primary"
                  size="$4"
                  borderRadius={radius.card}
                  onPress={() => setCurrentStep(3)}
                >
                  <XStack alignItems="center" gap="$2">
                    <Text color="white" fontWeight="700">Set Up Your Shop</Text>
                    <Icons.ArrowRight size={16} color="white" />
                  </XStack>
                </Button>
              </YStack>
            )}

            {/* ── STEP 2: Face Verification placeholder (modal overlays) ── */}
            {currentStep === 2 && !isGenderVerified && (
              <YStack alignItems="center" gap="$4" paddingVertical="$4">
                <YStack
                  width={64}
                  height={64}
                  borderRadius={14}
                  backgroundColor={ui.roseSurface}
                  alignItems="center"
                  justifyContent="center"
                >
                  <Icons.Camera size={32} color={ui.brand} />
                </YStack>
                <YStack gap="$1.5" alignItems="center">
                  <Text fontSize={18} fontWeight="900" color={ui.text}>
                    Face Verification
                  </Text>
                  <Text fontSize={13} color={ui.textMuted} textAlign="center" maxWidth={320}>
                    A quick liveness check to confirm you're eligible. The verification panel will
                    open automatically.
                  </Text>
                </YStack>
                <Spinner size="large" color={ui.brand} />
              </YStack>
            )}

            {/* ── STEP 3: Shop Setup ──────────────────────────────────────── */}
            {currentStep === 3 && !hasShop && (
              <YStack gap="$4">
                <YStack gap="$0.5">
                  <Text fontSize={18} fontWeight="900" color={ui.text}>
                    Set Up Your Shop
                  </Text>
                  <Text fontSize={13} color={ui.textMuted}>
                    Almost there! Tell us about your business.
                  </Text>
                </YStack>

                {/* Verified badge */}
                <XStack
                  backgroundColor="rgba(22,163,74,0.08)"
                  borderWidth={1}
                  borderColor="rgba(22,163,74,0.2)"
                  borderRadius={radius.chip}
                  padding="$3"
                  gap="$3"
                  alignItems="center"
                >
                  <YStack
                    width={32}
                    height={32}
                    borderRadius={999}
                    backgroundColor="rgba(22,163,74,0.12)"
                    alignItems="center"
                    justifyContent="center"
                  >
                    <Icons.CheckCircle2 size={16} color="#16a34a" />
                  </YStack>
                  <YStack>
                    <Text fontSize={13} fontWeight="800" color="#15803d">
                      Identity Verified ✓
                    </Text>
                    <Text fontSize={11} color="#16a34a">
                      You're eligible as a women entrepreneur
                    </Text>
                  </YStack>
                </XStack>

                {/* Shop Category — half-screen sheet picker */}
                <YStack gap="$1.5">
                  <Text fontSize={11} fontWeight="700" color={ui.textSecondary} letterSpacing={0.8} textTransform="uppercase">
                    Shop Category <Text color={ui.brand}>*</Text>
                  </Text>

                  {/* Trigger */}
                  <XStack
                    height={46}
                    borderRadius="$5"
                    borderWidth={1.5}
                    borderColor={formErrors.category ? 'rgba(239,68,68,0.6)' : ui.borderSubtle}
                    backgroundColor={ui.surface}
                    paddingHorizontal="$3.5"
                    alignItems="center"
                    justifyContent="space-between"
                    cursor="pointer"
                    onPress={() => setIsCategorySheetOpen(true)}
                    pressStyle={{ opacity: 0.75 }}
                  >
                    <Text
                      fontSize={14}
                      color={formData.category ? ui.text : ui.textMuted}
                      flex={1}
                      numberOfLines={1}
                    >
                      {formData.category || 'Select your shop category'}
                    </Text>
                    <Icons.ChevronDown size={16} color={ui.textMuted} />
                  </XStack>

                  {formErrors.category ? (
                    <XStack alignItems="center" gap="$1">
                      <Icons.AlertCircle size={12} color="#ef4444" />
                      <Text fontSize={12} color="#ef4444">{formErrors.category}</Text>
                    </XStack>
                  ) : null}

                  <AppBottomSheet
                    open={isCategorySheetOpen}
                    onOpenChange={setIsCategorySheetOpen}
                    title="Shop Category"
                  >
                    {shopCategoriesLoading ? (
                      <XStack alignItems="center" gap="$2" padding="$3">
                        <Spinner size="small" color={ui.brand} />
                        <Text fontSize={13} color={ui.textMuted}>
                          Loading categories…
                        </Text>
                      </XStack>
                    ) : null}
                    {!shopCategoriesLoading && shopCategories.length === 0 ? (
                      <Text fontSize={13} color={ui.textMuted} padding="$3">
                        No categories available yet.
                      </Text>
                    ) : null}
                    {shopCategories.map((cat) => {
                      const isSelected = formData.category === cat
                      return (
                        <XStack
                          key={cat}
                          paddingHorizontal="$3"
                          paddingVertical="$3"
                          borderRadius={radius.card}
                          alignItems="center"
                          justifyContent="space-between"
                          cursor="pointer"
                          onPress={() => {
                            handleInput('category', cat)
                            setIsCategorySheetOpen(false)
                          }}
                          pressStyle={{ backgroundColor: ui.surfaceHover }}
                          hoverStyle={{ backgroundColor: ui.surfaceHover }}
                          backgroundColor={isSelected ? ui.roseSurface : 'transparent'}
                        >
                          <Text
                            fontSize={15}
                            color={isSelected ? ui.brand : ui.text}
                            fontWeight={isSelected ? '700' : '400'}
                            flex={1}
                          >
                            {cat}
                          </Text>
                          {isSelected ? <Icons.CheckCircle2 size={18} color={ui.brand} /> : null}
                        </XStack>
                      )
                    })}
                  </AppBottomSheet>
                </YStack>

                {/* Business name */}
                <YStack gap="$1.5">
                  <Text fontSize={11} fontWeight="700" color={ui.textSecondary} letterSpacing={0.8} textTransform="uppercase">
                    Business Name <Text color={ui.brand}>*</Text>
                  </Text>
                  <XStack position="relative">
                    <Input
                      placeholder="Enter your business / shop name"
                      value={formData.business_name}
                      onChangeText={(v) => handleInput('business_name', v)}
                      borderColor={businessNameBorderColor()}
                      flex={1}
                    />
                    {/* Inline status icon */}
                    <YStack
                      position="absolute"
                      right={12}
                      top="50%"
                      transform={[{ translateY: -10 }]}
                    >
                      {shopNameStatus === 'checking' && (
                        <Spinner size="small" color={ui.brand} />
                      )}
                      {shopNameStatus === 'available' && (
                        <Icons.CheckCircle2 size={18} color="#16a34a" />
                      )}
                      {shopNameStatus === 'taken' && (
                        <Icons.XCircle size={18} color="#ef4444" />
                      )}
                    </YStack>
                  </XStack>

                  {formErrors.business_name ? (
                    <XStack alignItems="center" gap="$1">
                      <Icons.AlertCircle size={12} color="#ef4444" />
                      <Text fontSize={12} color="#ef4444">{formErrors.business_name}</Text>
                    </XStack>
                  ) : (
                    <ShopNameStatusBadge status={shopNameStatus} slug={shopNameSlug} ui={ui} />
                  )}

                  {!formErrors.business_name && shopNameStatus === 'idle' && (
                    <Text fontSize={11} color={ui.textMuted}>
                      This will be your public shop name
                    </Text>
                  )}
                </YStack>

                <Button
                  tone="primary"
                  size="$4"
                  borderRadius={radius.card}
                  disabled={isCreateShopDisabled}
                  onPress={handleCreateSellerAccount}
                >
                  <XStack alignItems="center" gap="$2">
                    {isSubmitting ? (
                      <>
                        <Spinner size="small" color="white" />
                        <Text color="white" fontWeight="700">Creating your shop…</Text>
                      </>
                    ) : shopNameStatus === 'checking' ? (
                      <>
                        <Spinner size="small" color="white" />
                        <Text color="white" fontWeight="700">Checking name…</Text>
                      </>
                    ) : shopNameStatus === 'taken' ? (
                      <>
                        <Icons.XCircle size={16} color="white" />
                        <Text color="white" fontWeight="700">Name Unavailable</Text>
                      </>
                    ) : (
                      <>
                        <Text color="white" fontWeight="700">Create My Shop</Text>
                        <Icons.Store size={16} color="white" />
                      </>
                    )}
                  </XStack>
                </Button>

                <Text fontSize={11} color={ui.textMuted} textAlign="center">
                  By proceeding you agree to our Seller Terms and Privacy Policy
                </Text>
              </YStack>
            )}

            {/* ── STEP 4: Bulk Product Import ─────────────────────────────── */}
            {currentStep === 4 && (
              <YStack gap="$4">
                {/* Shop created banner */}
                <XStack
                  backgroundColor={ui.brand}
                  borderRadius={radius.card}
                  padding="$4"
                  gap="$3"
                  alignItems="center"
                >
                  <YStack
                    width={48}
                    height={48}
                    borderRadius={12}
                    backgroundColor="rgba(255,255,255,0.2)"
                    alignItems="center"
                    justifyContent="center"
                    flexShrink={0}
                  >
                    <Icons.Store size={24} color="white" />
                  </YStack>
                  <YStack flex={1}>
                    <Text fontSize={15} fontWeight="900" color="white" lineHeight={20}>
                      {hasShop && !createdShopData
                        ? 'Welcome back!'
                        : `🎉 "${createdShopData?.shop_name}" is live!`}
                    </Text>
                    <Text fontSize={12} color="rgba(255,255,255,0.8)">
                      Now add your products to start selling
                    </Text>
                  </YStack>
                  <XStack
                    onPress={() => router.push(vendorRoutes.home)}
                    cursor="pointer"
                    alignItems="center"
                    gap="$1"
                    backgroundColor="rgba(255,255,255,0.2)"
                    paddingHorizontal="$2.5"
                    paddingVertical="$1.5"
                    borderRadius={radius.chip}
                    pressStyle={{ opacity: 0.75 }}
                  >
                    <Text fontSize={11} fontWeight="700" color="white">
                      Dashboard
                    </Text>
                    <Icons.ExternalLink size={12} color="white" />
                  </XStack>
                </XStack>

                {/* Upload options */}
                <XStack gap="$3">
                  <YStack
                    flex={1}
                    backgroundColor={ui.roseSurface}
                    borderRadius={radius.card}
                    borderWidth={1.5}
                    borderColor="rgba(224,92,151,0.2)"
                    padding="$3.5"
                    alignItems="center"
                    gap="$1.5"
                  >
                    <Icons.Upload size={22} color={ui.brand} />
                    <Text fontSize={12} fontWeight="800" color={ui.text}>
                      Bulk Import
                    </Text>
                    <Text fontSize={11} color={ui.textMuted}>
                      Upload CSV / Excel
                    </Text>
                  </YStack>
                  <YStack
                    flex={1}
                    backgroundColor={ui.surface}
                    borderRadius={radius.card}
                    borderWidth={1}
                    borderColor={ui.borderSubtle}
                    padding="$3.5"
                    alignItems="center"
                    gap="$1.5"
                    cursor="pointer"
                    pressStyle={{ opacity: 0.8 }}
                    hoverStyle={{ borderColor: ui.brand }}
                    onPress={() => router.push(vendorRoutes.createListing)}
                  >
                    <Icons.Package size={22} color={ui.textMuted} />
                    <Text fontSize={12} fontWeight="800" color={ui.text}>
                      Add Manually
                    </Text>
                    <Text fontSize={11} color={ui.textMuted}>
                      One product at a time
                    </Text>
                  </YStack>
                </XStack>

                {/* Bulk Import Component */}
                <YStack
                  borderRadius={radius.card}
                  borderWidth={1}
                  borderColor={ui.borderSubtle}
                  padding="$4"
                >
                  <BulkImportContent
                    ui={ui}
                    shopId={createdShopData?.id ?? profile?.id ?? ''}
                    isDesktop={isDesktop}
                    onImportComplete={() => {
                      toast.show('Products imported! Head to your dashboard.', { tone: 'success' })
                    }}
                  />
                </YStack>

                {/* Skip link */}
                <YStack alignItems="center" paddingTop="$1">
                  <Text
                    fontSize={13}
                    color={ui.textMuted}
                    textDecorationLine="underline"
                    cursor="pointer"
                    onPress={() => router.push(vendorRoutes.home)}
                    pressStyle={{ opacity: 0.7 }}
                  >
                    Skip for now — add products later
                  </Text>
                </YStack>
              </YStack>
            )}
          </YStack>
        </YStack>

        {/* Bottom trust badges */}
        {currentStep < 4 && (
          <XStack justifyContent="center" gap="$5" marginTop="$4">
            <XStack alignItems="center" gap="$1.5">
              <Icons.Shield size={14} color={ui.textMuted} />
              <Text fontSize={12} color={ui.textMuted}>Secure & Private</Text>
            </XStack>
            <XStack alignItems="center" gap="$1.5">
              <Icons.Award size={14} color={ui.textMuted} />
              <Text fontSize={12} color={ui.textMuted}>Women-Only</Text>
            </XStack>
            <XStack alignItems="center" gap="$1.5">
              <Icons.Sparkles size={14} color={ui.textMuted} />
              <Text fontSize={12} color={ui.textMuted}>Zero Cost</Text>
            </XStack>
          </XStack>
        )}
      </YStack>

      {/* Face verification modal — skip always available (camera data optional). */}
      <GenderVerificationModal
        open={currentStep === 2 && !isGenderVerified}
        dismissible
        onClose={handleVerificationSkip}
        onVerified={handleFaceVerified}
      />
    </YStack>
  )
}
