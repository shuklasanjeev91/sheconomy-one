import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'

import { Field, Icons, Input, Spinner, Text, XStack, YStack, useAppToast } from '~/components/ui'
import { PhoneInput } from '~/components/forms/PhoneInput'
import { LocationFields } from '~/components/geo'
import { radius } from '~/config/tokens'
import {
  createDefaultGeoLocation,
  shopAddressToGeoParts,
  validateGeoLocationParts,
  type GeoLocationParts,
} from '~/lib/geo'
import { updateShop } from '~/lib/shop/shop.store'
import type { Shop, ShopUpdate, SocialPlatform } from '~/lib/shop/shop.type'
import { validateSocialLinks } from '~/lib/shop/shop.utils'
import { validateShopField } from '~/lib/shop/shop.validation'
import { useAppDispatch, useAppSelector } from '~/lib/store/hooks'
import type { AppUiTokens } from '~/lib/theme/app-ui'
import { useSupabase } from '~/providers/SupabaseProvider'

import {
  fetchShopAddressDetails,
  upsertShopAddressDetails,
} from '~/commerce/lib/shop-address'

import {
  SettingsCard,
  SettingsSaveBar,
  SettingsSectionTitle,
  type IconType,
} from '~/commerce/screens/vendor/vendor-settings-shared'

/** Social platforms editable on the Connect page, with display metadata. */
const SOCIAL_PLATFORM_FIELDS: readonly {
  key: SocialPlatform
  label: string
  icon: IconType
  placeholder: string
}[] = [
  { key: 'instagram', label: 'Instagram', icon: Icons.Instagram, placeholder: 'https://instagram.com/yourshop' },
  { key: 'facebook', label: 'Facebook', icon: Icons.Facebook, placeholder: 'https://facebook.com/yourshop' },
  { key: 'twitter', label: 'Twitter (X)', icon: Icons.Twitter, placeholder: 'https://x.com/yourshop' },
  { key: 'linkedin', label: 'LinkedIn', icon: Icons.Linkedin, placeholder: 'https://linkedin.com/company/yourshop' },
  { key: 'youtube', label: 'YouTube', icon: Icons.Youtube, placeholder: 'https://youtube.com/@yourshop' },
  { key: 'tiktok', label: 'TikTok', icon: Icons.Music2, placeholder: 'https://tiktok.com/@yourshop' },
]

/** Minimal shape check for a URL once an https:// scheme is ensured. */
const SOCIAL_URL_REGEX = /^https?:\/\/\S+\.\S{2,}/i

/** Prefix bare domains with https:// so users can paste links without a scheme. */
function ensureHttps(url: string): string {
  const trimmed = url.trim()
  if (!trimmed) return ''
  return trimmed.startsWith('http://') || trimmed.startsWith('https://') ? trimmed : `https://${trimmed}`
}

type VendorConnectSettingsProps = {
  ui: AppUiTokens
  shop: Shop
  isDesktop: boolean
  safeBottom: number
}

/**
 * Connect settings section: shop contact details (phone / email / website),
 * the shop's physical address (linked via `shops.shop_address_id`), and
 * social platform links. All changes are saved from the bottom bar.
 */
export function VendorConnectSettings({ ui, shop, isDesktop, safeBottom }: VendorConnectSettingsProps) {
  const dispatch = useAppDispatch()
  const toast = useAppToast()
  const { user } = useSupabase()

  const isUpdating = useAppSelector((s) => s.shop.isUpdating)

  const [phone, setPhone] = useState(shop.shop_phone_number ?? '')
  const [email, setEmail] = useState(shop.shop_email ?? '')
  const [website, setWebsite] = useState(shop.website_url ?? '')
  const [socials, setSocials] = useState<Record<string, string>>(() => ({
    ...((shop.social_links as Record<string, string> | null) ?? {}),
  }))

  const [addressLine1, setAddressLine1] = useState('')
  const [addressLine2, setAddressLine2] = useState('')
  const [geo, setGeo] = useState<GeoLocationParts>(() => createDefaultGeoLocation())
  const [isLoadingAddress, setIsLoadingAddress] = useState(true)
  const [isSavingAddress, setIsSavingAddress] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const isSaving = isUpdating || isSavingAddress

  function setPhoneValue(value: string) {
    setPhone(value)
    const { error } = validateShopField('shop_phone_number', value)
    setErrors((current) => {
      const next = { ...current }
      if (error) next.shop_phone_number = error
      else delete next.shop_phone_number
      delete next.shop_contact
      return next
    })
  }

  function setEmailValue(value: string) {
    setEmail(value)
    const { error } = validateShopField('shop_email', value)
    setErrors((current) => {
      const next = { ...current }
      if (error) next.shop_email = error
      else delete next.shop_email
      delete next.shop_contact
      return next
    })
  }

  function setWebsiteValue(value: string) {
    setWebsite(value)
    if (!value.trim()) {
      setErrors((current) => {
        const next = { ...current }
        delete next.website_url
        return next
      })
      return
    }
    const { error } = validateShopField('website_url', ensureHttps(value))
    setErrors((current) => {
      const next = { ...current }
      if (error) next.website_url = error
      else delete next.website_url
      return next
    })
  }

  // Re-seed local fields when a different shop row is loaded.
  useEffect(() => {
    setPhone(shop.shop_phone_number ?? '')
    setEmail(shop.shop_email ?? '')
    setWebsite(shop.website_url ?? '')
    setSocials({ ...((shop.social_links as Record<string, string> | null) ?? {}) })
    setErrors({})
  }, [shop.id])

  // Load the linked shop address (managed via shops.shop_address_id).
  useEffect(() => {
    let cancelled = false
    setIsLoadingAddress(true)
    void fetchShopAddressDetails(shop.id).then(({ address, error }) => {
      if (cancelled) return
      setIsLoadingAddress(false)
      if (error) {
        toast.show('Could not load shop address', { tone: 'danger', message: error })
        return
      }
      if (address) {
        setAddressLine1(address.address_line_1 ?? '')
        setAddressLine2(address.address_line_2 ?? '')
        setGeo(shopAddressToGeoParts(address))
      }
    })
    return () => {
      cancelled = true
    }
  }, [shop.id])

  function setSocial(platform: SocialPlatform, value: string) {
    setSocials((current) => ({ ...current, [platform]: value }))
  }

  function validate(): Record<string, string> {
    const next: Record<string, string> = {}
    const hasEmail = Boolean(email.trim())
    const hasPhone = Boolean(phone.trim())

    if (!hasEmail && !hasPhone) {
      next.shop_contact = 'Please provide either an email address or phone number.'
    }
    if (hasPhone) {
      const { error } = validateShopField('shop_phone_number', phone.trim())
      if (error) next.shop_phone_number = error
    }
    if (hasEmail) {
      const { error } = validateShopField('shop_email', email.trim())
      if (error) next.shop_email = error
    }
    if (website.trim()) {
      const { error } = validateShopField('website_url', ensureHttps(website))
      if (error) next.website_url = error
    }

    for (const platform of SOCIAL_PLATFORM_FIELDS) {
      const raw = (socials[platform.key] ?? '').trim()
      if (!raw) continue
      if (!SOCIAL_URL_REGEX.test(ensureHttps(raw))) {
        next[`social_${platform.key}`] = `Enter a valid ${platform.label} link.`
      }
    }

    const hasAnyAddress = Boolean(
      addressLine1.trim() || addressLine2.trim() || geo.city.trim() || (geo.postalCode ?? '').trim(),
    )
    if (hasAnyAddress) {
      if (addressLine1.trim().length < 3) {
        next.address_line_1 = 'Enter a street address (at least 3 characters).'
      }
      const geoError = validateGeoLocationParts(geo, { requirePostal: true })
      if (geoError) next.address_geo = geoError
    }

    return next
  }

  async function handleSave() {
    const nextErrors = validate()
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) {
      toast.show('Please fix the highlighted fields', {
        tone: 'danger',
        message: Object.values(nextErrors)[0],
      })
      return
    }

    const updates: ShopUpdate = {
      shop_phone_number: phone.trim() || null,
      shop_email: email.trim() || null,
      website_url: ensureHttps(website) || null,
      social_links: validateSocialLinks(socials) as ShopUpdate['social_links'],
    }

    try {
      await dispatch(updateShop({ shopId: shop.id, updates })).unwrap()

      if (addressLine1.trim()) {
        if (!user?.id) throw new Error('Please sign in again to save your shop address.')
        setIsSavingAddress(true)
        try {
          const { error } = await upsertShopAddressDetails(shop.id, user.id, {
            address_line_1: addressLine1,
            address_line_2: addressLine2,
            ...geo,
          })
          if (error) throw new Error(error)
        } finally {
          setIsSavingAddress(false)
        }
      }

      toast.show('Changes saved', {
        tone: 'success',
        message: 'Your contact details are up to date.',
      })
    } catch (error) {
      toast.show('Could not save changes', {
        tone: 'danger',
        message: error instanceof Error ? error.message : String(error),
      })
    }
  }

  return (
    <YStack flex={1} minHeight={0} width="100%" maxWidth="100%">
      <YStack
        gap="$4"
        paddingHorizontal={isDesktop ? '$6' : '$4'}
        paddingTop={isDesktop ? '$6' : '$4'}
        paddingBottom="$5"
      >
        <YStack gap="$1">
          <Text fontSize={isDesktop ? 26 : 22} fontWeight="800" color={ui.text} letterSpacing={-0.5}>
            Connect
          </Text>
          <Text fontSize={14} color={ui.textSecondary} maxWidth={620}>
            Manage your contact details, physical address, and social platforms so customers can
            reach you anywhere.
          </Text>
        </YStack>

        {/* Contact details */}
        <SettingsCard ui={ui}>
          <SettingsSectionTitle ui={ui} icon={Icons.Phone} title="Contact Details" />
          {errors.shop_contact ? (
            <XStack
              alignItems="center"
              gap="$2"
              padding="$2.5"
              borderRadius={radius.chip}
              backgroundColor={ui.roseSurface}
            >
              <Icons.AlertCircle size={14} color={ui.brand} />
              <Text fontSize={12.5} fontWeight="600" color={ui.brand}>
                {errors.shop_contact}
              </Text>
            </XStack>
          ) : null}
          <YStack gap="$3.5">
            <ContactFieldRow ui={ui} icon={Icons.Phone}>
              <Field label="Business Phone" error={errors.shop_phone_number} flex={1}>
                <PhoneInput
                  value={phone}
                  onChange={setPhoneValue}
                  invalid={Boolean(errors.shop_phone_number)}
                />
              </Field>
            </ContactFieldRow>
            <ContactFieldRow ui={ui} icon={Icons.Mail}>
              <Field label="Public Email" error={errors.shop_email} flex={1}>
                <Input
                  value={email}
                  onChangeText={setEmailValue}
                  placeholder="hello@yourshop.com"
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </Field>
            </ContactFieldRow>
            <ContactFieldRow ui={ui} icon={Icons.Globe}>
              <Field label="Brand Website" error={errors.website_url} flex={1}>
                <Input
                  value={website}
                  onChangeText={setWebsiteValue}
                  placeholder="https://www.yourshop.com"
                  keyboardType="url"
                  autoCapitalize="none"
                />
              </Field>
            </ContactFieldRow>
          </YStack>
        </SettingsCard>

        {/* Physical address */}
        <SettingsCard ui={ui}>
          <SettingsSectionTitle ui={ui} icon={Icons.MapPin} title="Physical Address" />
          {isLoadingAddress ? (
            <XStack alignItems="center" gap="$2" paddingVertical="$3">
              <Spinner size="small" color={ui.brand} />
              <Text fontSize={13} color={ui.textSecondary}>
                Loading shop address…
              </Text>
            </XStack>
          ) : (
            <YStack gap="$3.5">
              <Field label="Address Line 1" error={errors.address_line_1}>
                <Input
                  value={addressLine1}
                  onChangeText={setAddressLine1}
                  placeholder="Street address, building, floor"
                />
              </Field>
              <Field label="Address Line 2">
                <Input
                  value={addressLine2}
                  onChangeText={setAddressLine2}
                  placeholder="Landmark, suite (optional)"
                />
              </Field>
              <LocationFields value={geo} onChange={setGeo} disabled={isSaving} />
              {errors.address_geo ? (
                <Text fontSize={12.5} fontWeight="600" color={ui.danger}>
                  {errors.address_geo}
                </Text>
              ) : null}
              <Text fontSize={11.5} color={ui.textMuted} fontStyle="italic">
                Shown to customers as your shop location and used for shipping origin.
              </Text>
            </YStack>
          )}
        </SettingsCard>

        {/* Social platforms */}
        <SettingsCard ui={ui}>
          <SettingsSectionTitle ui={ui} icon={Icons.Share2} title="Social Platforms" />
          <XStack gap="$3.5" flexWrap="wrap">
            {SOCIAL_PLATFORM_FIELDS.map((platform) => (
              <YStack
                key={platform.key}
                width={isDesktop ? '48%' : '100%'}
                minWidth={isDesktop ? 260 : undefined}
              >
                <ContactFieldRow ui={ui} icon={platform.icon}>
                  <Field label={platform.label} error={errors[`social_${platform.key}`]} flex={1}>
                    <Input
                      value={socials[platform.key] ?? ''}
                      onChangeText={(value) => setSocial(platform.key, value)}
                      placeholder={platform.placeholder}
                      autoCapitalize="none"
                    />
                  </Field>
                </ContactFieldRow>
              </YStack>
            ))}
          </XStack>
          <Text fontSize={11.5} color={ui.textMuted} fontStyle="italic">
            Paste your profile links. Leave a field empty to unlink that platform.
          </Text>
        </SettingsCard>
      </YStack>

      <SettingsSaveBar
        ui={ui}
        isDesktop={isDesktop}
        safeBottom={safeBottom}
        isSaving={isSaving}
        onSave={() => void handleSave()}
      />
    </YStack>
  )
}

/** Icon chip + form field row used on the Connect page. */
function ContactFieldRow({
  ui,
  icon,
  children,
}: {
  ui: AppUiTokens
  icon: IconType
  children: ReactNode
}) {
  const Icon = icon
  return (
    <XStack gap="$3" alignItems="flex-start">
      <YStack
        width={36}
        height={36}
        marginTop={22}
        borderRadius={999}
        backgroundColor={ui.roseSurface}
        alignItems="center"
        justifyContent="center"
      >
        <Icon size={16} color={ui.brand} />
      </YStack>
      {children}
    </XStack>
  )
}
