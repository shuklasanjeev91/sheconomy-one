import { useCallback, useEffect, useMemo, useState } from 'react'

import { AUTH_LAYOUT } from '~/components/auth/auth-layout'
import { NativeDateField } from '~/components/forms/NativeDateField'
import { PhoneInput } from '~/components/forms/PhoneInput'
import { LocationPickerField, GeoSelectField } from '~/components/geo'
import { PageCenter } from '~/components/layout'
import { AvatarCaptureField } from '~/components/media/AvatarCaptureField'
import {
  Button,
  ConfirmDialog,
  Field,
  Icons,
  Input,
  Spinner,
  Text,
  XStack,
  YStack,
  useAppToast,
} from '~/components/ui'
import { OtpCodeInput } from '~/features/auth/components/OtpCodeInput'
import {
  isContactProfileSuggestSupported,
  suggestProfileFromContacts,
  type ContactProfileSuggestion,
} from '~/features/auth/services/contact-profile-suggest'
import { requestOnboardingLocation } from '~/features/auth/services/onboarding-location'
import {
  MEMBER_INTENTS,
  ONBOARDING_INTEREST_OPTIONS,
  markOnboardingCompleted,
  refreshCompletionPercentage,
  resolveOnboardingSteps,
  resolvePostOnboardingHref,
  shouldOfferContactsAfterOnboarding,
  updateOnboardingBasics,
  updateOnboardingIntents,
  updateOnboardingInterests,
  updateOnboardingPreferences,
} from '~/features/auth/services/onboarding'
import {
  detectCountryCode,
  detectDeviceTimezone,
  detectPreferredLanguage,
  enrichProfileFromAuth,
  fetchOnboardingProfile,
  type OnboardingProfile,
} from '~/features/auth/services/profile-enrichment'
import { importSocialProfileHints } from '~/features/auth/services/social-profile-hints'
import { isCompleteOtp, normalizeOtpDigits } from '~/features/auth/validation'
import { useAuth } from '~/hooks/useAuth'
import { getAllGeoCountries, getCountryName } from '~/lib/geo/data'
import { appRoutes, commerceRoutes } from '~/lib/routes'
import { DEFAULT_COUNTRY, findCountryByIso2 } from '~/lib/phone/countries'
import { isValidPhone, normalizePhoneNumber } from '~/lib/phone/phone'
import { supabase } from '~/lib/supabase/client'
import { useAppUi } from '~/lib/theme/useAppUi'
import { navigateApp, replaceApp } from '~/lib/platform/navigate'

type Step = 'basics' | 'phone' | 'prefs' | 'interests' | 'intents'

const LANGUAGE_OPTIONS = [
  { code: 'en', label: 'English' },
  { code: 'hi', label: 'Hindi' },
  { code: 'es', label: 'Spanish' },
  { code: 'fr', label: 'French' },
  { code: 'ar', label: 'Arabic' },
  { code: 'pt', label: 'Portuguese' },
]

type CompleteProfileFlowProps = {
  returnTo?: string | null
  isNewUser?: boolean
}

export function CompleteProfileFlow({ returnTo, isNewUser }: CompleteProfileFlowProps) {
  const ui = useAppUi()
  const toast = useAppToast()
  const { user, completeSignIn } = useAuth()
  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState<OnboardingProfile | null>(null)
  const [steps, setSteps] = useState<Step[]>(['basics', 'phone', 'prefs', 'interests', 'intents'])
  const [stepIndex, setStepIndex] = useState(0)
  const [completion, setCompletion] = useState(0)
  const [busy, setBusy] = useState(false)
  const [locating, setLocating] = useState(false)
  const [suggestOpen, setSuggestOpen] = useState(false)
  const [pendingSuggest, setPendingSuggest] = useState<ContactProfileSuggestion | null>(null)
  const [showNetworkContacts, setShowNetworkContacts] = useState(false)
  const [postOnboardingHref, setPostOnboardingHref] = useState<string | null>(null)

  const [fullName, setFullName] = useState('')
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [phoneE164, setPhoneE164] = useState('')
  const [phoneDefaultCountry, setPhoneDefaultCountry] = useState(DEFAULT_COUNTRY)
  const [otpSent, setOtpSent] = useState(false)
  const [otpCode, setOtpCode] = useState('')
  const [timezone, setTimezone] = useState(detectDeviceTimezone())
  const [countryCode, setCountryCode] = useState(detectCountryCode())
  const [language, setLanguage] = useState('en')
  const [locationLabel, setLocationLabel] = useState('')
  const [dateOfBirth, setDateOfBirth] = useState<string | null>(null)
  const [interests, setInterests] = useState<string[]>([])
  const [intents, setIntents] = useState<string[]>([])
  const [socialHintLine, setSocialHintLine] = useState<string | null>(null)

  const step = steps[stepIndex] ?? 'basics'
  const countryOptions = useMemo(
    () =>
      getAllGeoCountries().map((country) => ({
        value: country.isoCode,
        label: country.name,
      })),
    [],
  )

  const reload = useCallback(async () => {
    if (!user?.id) return
    await enrichProfileFromAuth(user)
    const row = await fetchOnboardingProfile(user.id)
    setProfile(row)
    const nextSteps = resolveOnboardingSteps(row)
    setSteps(nextSteps)
    setStepIndex(0)

    const hints = importSocialProfileHints(user)
    if (hints.providers.length) {
      setSocialHintLine(
        `Imported from ${hints.providers.map((p) => p.replace('_oidc', '')).join(', ')}`,
      )
    }

    if (row) {
      setFullName(row.full_name ?? hints.fullName ?? '')
      setAvatarUrl(row.avatar_url ?? hints.avatarUrl)
      setCompletion(row.profile_completion_percentage ?? 0)
      if (row.timezone) setTimezone(row.timezone)
      if (row.country_code) {
        setCountryCode(row.country_code)
        const phoneCountry = findCountryByIso2(row.country_code)
        if (phoneCountry) setPhoneDefaultCountry(phoneCountry)
      }
      if (row.preferred_language) setLanguage(row.preferred_language)
      else setLanguage(await detectPreferredLanguage())
      if (row.location) setLocationLabel(row.location)
      if (row.date_of_birth) setDateOfBirth(row.date_of_birth)
      if (row.interests?.length) setInterests(row.interests)
      if (row.member_intents?.length) setIntents(row.member_intents)
    } else {
      setFullName(hints.fullName ?? '')
      setAvatarUrl(hints.avatarUrl)
      setLanguage(await detectPreferredLanguage())
    }
    setLoading(false)
  }, [user])

  useEffect(() => {
    void reload()
  }, [reload])

  async function bumpCompletion() {
    if (!user?.id) return
    const pct = await refreshCompletionPercentage(user.id)
    setCompletion(pct)
  }

  function goToAdjacent(delta: number) {
    setStepIndex((i) => Math.max(0, Math.min(steps.length - 1, i + delta)))
  }

  async function finishOnboarding(options?: {
    goToShop?: boolean
    intents?: string[]
  }) {
    if (!user?.id) return
    await markOnboardingCompleted(user.id)
    if (options?.goToShop) {
      replaceApp(commerceRoutes.createShop)
      return
    }

    const savedIntents = options?.intents ?? intents
    const destination = resolvePostOnboardingHref(savedIntents, returnTo)
    setPostOnboardingHref(destination)

    if (
      shouldOfferContactsAfterOnboarding(savedIntents, returnTo) &&
      isContactProfileSuggestSupported()
    ) {
      setShowNetworkContacts(true)
      return
    }

    // Intent hubs (class/community/jobs/shop) skip the new-user contacts interrupt.
    await completeSignIn(destination, {
      skipOnboardingGate: true,
      isNewUser: false,
    })
  }

  async function goNext() {
    if (!user?.id) return
    setBusy(true)

    if (step === 'basics') {
      if (!fullName.trim()) {
        toast.show('Please add your name', { tone: 'warning' })
        setBusy(false)
        return
      }
      const { error } = await updateOnboardingBasics({ userId: user.id, fullName })
      if (error) {
        toast.show(error, { tone: 'danger' })
        setBusy(false)
        return
      }
    }

    if (step === 'prefs') {
      const { error } = await updateOnboardingPreferences({
        userId: user.id,
        countryCode,
        timezone,
        preferredLanguage: language,
        location: locationLabel.trim() || getCountryName(countryCode),
        dateOfBirth,
      })
      if (error) {
        toast.show(error, { tone: 'danger' })
        setBusy(false)
        return
      }
    }

    if (step === 'interests') {
      if (interests.length === 0) {
        toast.show('Pick at least one interest', { tone: 'warning' })
        setBusy(false)
        return
      }
      const { error } = await updateOnboardingInterests(user.id, interests)
      if (error) {
        toast.show(error, { tone: 'danger' })
        setBusy(false)
        return
      }
    }

    if (step === 'intents') {
      if (intents.length === 0) {
        toast.show('Select how you plan to use SHEconomy', { tone: 'warning' })
        setBusy(false)
        return
      }
      const { error } = await updateOnboardingIntents(user.id, intents)
      if (error) {
        toast.show(error, { tone: 'danger' })
        setBusy(false)
        return
      }
      setBusy(false)
      await finishOnboarding({ intents })
      return
    }

    await bumpCompletion()
    setBusy(false)
    goToAdjacent(1)
  }

  async function sendPhoneCode() {
    const e164 = phoneE164.trim()
    if (!isValidPhone(e164)) {
      toast.show('Enter a valid mobile number.', { tone: 'warning' })
      return
    }
    setBusy(true)
    const { error } = await supabase.auth.updateUser({ phone: e164 })
    setBusy(false)
    if (error) {
      toast.show(error.message, { tone: 'danger' })
      return
    }
    setOtpSent(true)
    toast.show('Code sent', { tone: 'success', message: `Sent to ${e164}` })
  }

  async function verifyPhoneCode() {
    const e164 = phoneE164.trim()
    if (!isValidPhone(e164)) return
    const code = normalizeOtpDigits(otpCode)
    if (!isCompleteOtp(code)) {
      toast.show('Enter the 6-digit code', { tone: 'warning' })
      return
    }
    setBusy(true)
    const { error } = await supabase.auth.verifyOtp({
      phone: e164,
      token: code,
      type: 'phone_change',
    })
    if (error) {
      const retry = await supabase.auth.verifyOtp({
        phone: e164,
        token: code,
        type: 'sms',
      })
      if (retry.error) {
        setBusy(false)
        toast.show(error.message, { tone: 'danger' })
        return
      }
    }
    await supabase
      .from('profiles')
      .update({ phone: e164, phone_verified: true } as never)
      .eq('id', user!.id)
    await bumpCompletion()
    setBusy(false)
    toast.show('Mobile verified', { tone: 'success' })
    goToAdjacent(1)
  }

  async function handleUseDeviceLanguage() {
    const code = await detectPreferredLanguage()
    setLanguage(code)
    toast.show('Using device language', { tone: 'success', message: code.toUpperCase() })
  }

  async function handleUseLocation() {
    setLocating(true)
    const result = await requestOnboardingLocation()
    setLocating(false)
    if (result.countryCode) {
      setCountryCode(result.countryCode)
      const phoneCountry = findCountryByIso2(result.countryCode)
      if (phoneCountry) setPhoneDefaultCountry(phoneCountry)
    }
    if (result.locationLabel) setLocationLabel(result.locationLabel)
    if (result.error && !result.latitude) {
      toast.show('Location unavailable', { tone: 'warning', message: result.error })
      return
    }
    toast.show('Location updated', { tone: 'success' })
  }

  async function handleSuggestFromContacts() {
    setBusy(true)
    const result = await suggestProfileFromContacts()
    setBusy(false)
    if (result.error) {
      toast.show(result.error, { tone: 'danger' })
      return
    }
    if (result.cancelled || !result.suggestion) return
    setPendingSuggest(result.suggestion)
    setSuggestOpen(true)
  }

  function applyContactSuggestion() {
    if (!pendingSuggest) return
    if (pendingSuggest.fullName) setFullName(pendingSuggest.fullName)
    if (pendingSuggest.phone) {
      setPhoneE164(normalizePhoneNumber(pendingSuggest.phone, phoneDefaultCountry))
    }
    setSuggestOpen(false)
    setPendingSuggest(null)
    toast.show('Details applied — review before continuing', { tone: 'success' })
  }

  if (loading) {
    return (
      <PageCenter>
        <Spinner size="large" />
      </PageCenter>
    )
  }

  if (showNetworkContacts) {
    return (
      <YStack gap="$5" width="100%" maxWidth={480} alignSelf="center" padding="$4">
        <YStack gap="$2">
          <Text fontSize={22} fontWeight="800" color={ui.text}>
            Find people you know
          </Text>
          <Text fontSize={14} color={ui.textMuted}>
            Optionally import contacts to grow your network. Only contacts you select are uploaded.
          </Text>
        </YStack>
        <Button
          tone="primary"
          size="$4"
          borderRadius={999}
          onPress={() => {
            const dest = postOnboardingHref ?? returnTo ?? ''
            const href = dest
              ? `${String(appRoutes.importContacts)}?returnTo=${encodeURIComponent(dest)}`
              : String(appRoutes.importContacts)
            navigateApp(href)
          }}
        >
          Select contacts
        </Button>
        <Button
          tone="outline"
          size="$4"
          borderRadius={999}
          onPress={() =>
            void completeSignIn(postOnboardingHref ?? returnTo, {
              skipOnboardingGate: true,
              isNewUser: Boolean(isNewUser),
            })
          }
        >
          Skip for now
        </Button>
      </YStack>
    )
  }

  return (
    <YStack gap="$5" width="100%" maxWidth={480} alignSelf="center" padding="$4">
      <YStack gap="$2">
        <Text fontSize={22} fontWeight="800" color={ui.text} letterSpacing={-0.3}>
          Complete your profile
        </Text>
        <Text fontSize={14} color={ui.textMuted}>
          A few details help SHEconomy personalize your experience.
        </Text>
        <CompletionRing percent={completion} />
        <Text fontSize={12} color={ui.textMuted}>
          Step {stepIndex + 1} of {steps.length}
        </Text>
      </YStack>

      {step === 'basics' ? (
        <YStack gap="$4">
          {user?.id ? (
            <AvatarCaptureField
              userId={user.id}
              avatarUrl={avatarUrl}
              onUploaded={(url) => {
                setAvatarUrl(url)
                setProfile((prev) => (prev ? { ...prev, avatar_url: url } : prev))
                void bumpCompletion()
              }}
              disabled={busy}
            />
          ) : null}
          {socialHintLine ? (
            <Text fontSize={12} color={ui.textMuted}>
              {socialHintLine}
            </Text>
          ) : null}
          <Field label="Full name">
            <Input
              value={fullName}
              onChangeText={setFullName}
              placeholder="Your name"
              autoCapitalize="words"
              autoComplete="name"
              {...({ textContentType: 'name' } as object)}
              returnKeyType="next"
              enterKeyHint="next"
              accessibilityLabel="Full name"
              height={52}
              borderRadius={AUTH_LAYOUT.inputRadius}
            />
          </Field>
          {isContactProfileSuggestSupported() ? (
            <Button
              tone="outline"
              size="$3"
              borderRadius={999}
              disabled={busy}
              onPress={() => void handleSuggestFromContacts()}
              icon={<Icons.Contact size={16} />}
            >
              Use contact details
            </Button>
          ) : null}
        </YStack>
      ) : null}

      {step === 'phone' ? (
        <YStack gap="$4">
          {profile?.phone_verified ? (
            <Text color={ui.textMuted}>Your mobile number is already verified.</Text>
          ) : otpSent ? (
            <>
              <Text color={ui.textMuted}>Enter the code we texted you.</Text>
              <OtpCodeInput value={otpCode} onChange={setOtpCode} />
              <Button
                tone="primary"
                size="$4"
                borderRadius={999}
                disabled={busy}
                onPress={() => void verifyPhoneCode()}
              >
                {busy ? 'Verifying…' : 'Verify mobile'}
              </Button>
            </>
          ) : (
            <>
              <Text color={ui.textMuted}>
                Verify a mobile number for account recovery and SMS alerts (optional but
                recommended).
              </Text>
              <PhoneInput
                value={phoneE164}
                onChange={setPhoneE164}
                defaultCountry={phoneDefaultCountry}
                compact
              />
              <XStack gap="$2">
                <Button
                  tone="primary"
                  size="$4"
                  borderRadius={999}
                  flex={2}
                  disabled={busy}
                  onPress={() => void sendPhoneCode()}
                >
                  {busy ? 'Sending…' : 'Send code'}
                </Button>
                <Button
                  tone="outline"
                  size="$4"
                  borderRadius={999}
                  flex={1}
                  disabled={busy}
                  onPress={() => goToAdjacent(1)}
                >
                  Skip
                </Button>
              </XStack>
            </>
          )}
        </YStack>
      ) : null}

      {step === 'prefs' ? (
        <YStack gap="$4">
          <XStack gap="$2" flexWrap="wrap">
            <Button
              tone="outline"
              size="$2"
              borderRadius={999}
              disabled={locating}
              onPress={() => void handleUseLocation()}
              icon={locating ? <Spinner size="small" /> : <Icons.MapPin size={16} />}
            >
              {locating ? 'Locating…' : 'Use my location'}
            </Button>
            <Button
              tone="outline"
              size="$2"
              borderRadius={999}
              onPress={() => void handleUseDeviceLanguage()}
              icon={<Icons.Languages size={16} />}
            >
              Use device language
            </Button>
          </XStack>

          <GeoSelectField
            label="Country"
            value={countryCode}
            placeholder="Select your country"
            options={countryOptions}
            showFlags
            sheetTitle="Select country"
            searchPlaceholder="Search countries"
            onChange={(code) => {
              setCountryCode(code)
              if (!locationLabel.trim()) setLocationLabel(getCountryName(code))
            }}
          />

          <LocationPickerField
            label="City / region"
            value={locationLabel}
            onChange={setLocationLabel}
          />

          <Field label="Time zone">
            <Input
              value={timezone}
              onChangeText={setTimezone}
              autoCapitalize="none"
              autoComplete="off"
              accessibilityLabel="Time zone"
              returnKeyType="next"
            />
          </Field>

          <Field label="Preferred language">
            <XStack gap="$2" flexWrap="wrap">
              {LANGUAGE_OPTIONS.map((opt) => {
                const selected = language === opt.code
                return (
                  <Button
                    key={opt.code}
                    size="$2"
                    tone={selected ? 'primary' : 'outline'}
                    onPress={() => setLanguage(opt.code)}
                  >
                    {opt.label}
                  </Button>
                )
              })}
            </XStack>
          </Field>

          <NativeDateField
            label="Date of birth (optional)"
            value={dateOfBirth}
            onChange={setDateOfBirth}
            maximumDate={new Date()}
            minimumDate={new Date(1920, 0, 1)}
          />
        </YStack>
      ) : null}

      {step === 'interests' ? (
        <YStack gap="$3">
          <Text color={ui.textMuted}>Choose topics you care about.</Text>
          <XStack gap="$2" flexWrap="wrap">
            {ONBOARDING_INTEREST_OPTIONS.map((item) => {
              const selected = interests.includes(item)
              return (
                <Button
                  key={item}
                  size="$2"
                  tone={selected ? 'primary' : 'outline'}
                  onPress={() => {
                    setInterests((prev) =>
                      selected ? prev.filter((x) => x !== item) : [...prev, item],
                    )
                  }}
                >
                  {item}
                </Button>
              )
            })}
          </XStack>
        </YStack>
      ) : null}

      {step === 'intents' ? (
        <YStack gap="$3">
          <Text color={ui.textMuted}>How do you want to use SHEconomy? Pick all that apply.</Text>
          {MEMBER_INTENTS.map((intent) => {
            const selected = intents.includes(intent.id)
            return (
              <XStack
                key={intent.id}
                padding="$3"
                borderRadius={12}
                borderWidth={1}
                borderColor={selected ? ui.brand : ui.borderSubtle}
                backgroundColor={selected ? ui.surfaceMuted : ui.surface}
                gap="$3"
                alignItems="center"
                pressStyle={{ opacity: 0.9 }}
                cursor="pointer"
                onPress={() => {
                  setIntents((prev) =>
                    selected ? prev.filter((x) => x !== intent.id) : [...prev, intent.id],
                  )
                }}
              >
                <YStack flex={1} gap={2}>
                  <Text fontWeight="700" color={ui.text}>
                    {intent.label}
                  </Text>
                  <Text fontSize={13} color={ui.textMuted}>
                    {intent.description}
                  </Text>
                </YStack>
                {selected ? <Icons.Check size={18} color={ui.brand} /> : null}
              </XStack>
            )
          })}
          {intents.includes('selling') ? (
            <Button
              tone="outline"
              size="$3"
              onPress={() => {
                void (async () => {
                  if (!user?.id) return
                  await updateOnboardingIntents(user.id, intents)
                  await finishOnboarding({ goToShop: true })
                })()
              }}
            >
              Set up shop now
            </Button>
          ) : null}
        </YStack>
      ) : null}

      {step !== 'phone' || profile?.phone_verified || otpSent ? (
        <XStack gap="$2">
          {stepIndex > 0 ? (
            <Button
              tone="outline"
              size="$4"
              borderRadius={999}
              flex={1}
              disabled={busy}
              onPress={() => goToAdjacent(-1)}
            >
              Back
            </Button>
          ) : null}
          {!(step === 'phone' && otpSent && !profile?.phone_verified) ? (
            <Button
              tone="primary"
              size="$4"
              borderRadius={999}
              flex={2}
              disabled={busy}
              onPress={() => void goNext()}
            >
              {busy ? 'Saving…' : step === 'intents' ? 'Finish' : 'Continue'}
            </Button>
          ) : null}
        </XStack>
      ) : (
        <XStack gap="$2">
          <Button
            tone="outline"
            size="$4"
            borderRadius={999}
            flex={1}
            disabled={busy}
            onPress={() => goToAdjacent(-1)}
          >
            Back
          </Button>
        </XStack>
      )}

      <ConfirmDialog
        open={suggestOpen}
        onOpenChange={setSuggestOpen}
        title="Apply contact details?"
        description={
          pendingSuggest
            ? [
                pendingSuggest.fullName ? `Name: ${pendingSuggest.fullName}` : null,
                pendingSuggest.phone ? `Phone: ${pendingSuggest.phone}` : null,
                pendingSuggest.email ? `Email: ${pendingSuggest.email}` : null,
              ]
                .filter(Boolean)
                .join(' · ') || 'Use the selected contact on your profile.'
            : 'Use the selected contact on your profile.'
        }
        confirmLabel="Apply"
        onConfirm={applyContactSuggestion}
      />
    </YStack>
  )
}

function CompletionRing({ percent }: { percent: number }) {
  const ui = useAppUi()
  const clamped = Math.max(0, Math.min(100, Math.round(percent)))
  return (
    <XStack
      alignItems="center"
      gap="$3"
      padding="$3"
      borderRadius={12}
      backgroundColor={ui.surfaceMuted}
      borderWidth={1}
      borderColor={ui.borderSubtle}
    >
      <YStack
        width={48}
        height={48}
        borderRadius={24}
        borderWidth={4}
        borderColor={ui.brand}
        alignItems="center"
        justifyContent="center"
      >
        <Text fontSize={12} fontWeight="800" color={ui.text}>
          {clamped}%
        </Text>
      </YStack>
      <YStack flex={1} gap={2}>
        <Text fontWeight="700" color={ui.text}>
          Profile completion
        </Text>
        <Text fontSize={12} color={ui.textMuted}>
          Keep going — a fuller profile unlocks better matches.
        </Text>
      </YStack>
    </XStack>
  )
}
