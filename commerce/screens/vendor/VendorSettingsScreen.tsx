import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { Platform } from 'react-native'
import { useLocalSearchParams } from 'one'

import {
  Avatar,
  Button,
  Field,
  Icons,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectViewport,
  Spinner,
  Switch,
  Text,
  TextArea,
  XStack,
  YStack,
  useAppToast,
} from '~/components/ui'
import { PageCenter } from '~/components/layout'
import { ImageUploadField, preparePickedImagesForUpload } from '~/components/media/ImageUploadField'
import { getShadowStyle, radius } from '~/config/tokens'
import { useAppLayout } from '~/hooks/useAppLayout'
import { useUploadProgress } from '~/hooks/useUploadProgress'
import type { PickedImage } from '~/lib/media/pick-image'
import * as shopService from '~/lib/shop/shop.service'
import {
  loadFormFromShop,
  loadMyShops,
  updateShop,
  updateShopField,
  validateForm,
} from '~/lib/shop/shop.store'
import {
  COMMON_SHOP_CATEGORIES,
  DEFAULT_SHOP_CURRENCY,
  SHOP_VALIDATION,
  SUPPORTED_CURRENCIES,
  type Shop,
  type ShopFormData,
  type ShopUpdate,
} from '~/lib/shop/shop.type'
import { shopToFormData } from '~/lib/shop/shop.utils'
import { validateShopData } from '~/lib/shop/shop.validation'
import { useAppDispatch, useAppSelector } from '~/lib/store/hooks'
import type { AppUiTokens } from '~/lib/theme/app-ui'
import { useAppUi } from '~/lib/theme/useAppUi'
import { useSupabase } from '~/providers/SupabaseProvider'

import {
  SETTINGS_SECTIONS,
  getSettingsSection,
  type SettingsSection,
  type SettingsSectionId,
} from '~/commerce/components/vendor/settings-nav'
import { VendorConnectSettings } from './VendorConnectSettings'
import { ShopCommercePanel } from '~/commerce/components/seller/ShopCommercePanel'
import { VendorReturnsSettingsPanel } from '~/commerce/components/seller/VendorReturnsSettingsPanel'
import { AppLink } from '~/components/navigation/AppLink'
import { appRoutes } from '~/lib/routes'

type IconType = (typeof Icons)[keyof typeof Icons]

/** Ordered week (Mon → Sun) with the storage keys used in `shop_hours`. */
const HOURS_DAYS = [
  { key: 'monday', label: 'Monday' },
  { key: 'tuesday', label: 'Tuesday' },
  { key: 'wednesday', label: 'Wednesday' },
  { key: 'thursday', label: 'Thursday' },
  { key: 'friday', label: 'Friday' },
  { key: 'saturday', label: 'Saturday' },
  { key: 'sunday', label: 'Sunday' },
] as const

const DEFAULT_OPEN_HOURS = '09:00-17:00'

/** Resolve a section id from the `?section=` query param, defaulting to General. */
function resolveSectionId(raw: string | string[] | undefined): SettingsSectionId {
  const value = Array.isArray(raw) ? raw[0] : raw
  const match = SETTINGS_SECTIONS.find((section) => section.id === value)
  return match?.id ?? 'general'
}

/** Read the tagline persisted alongside other shop metadata. */
function readTagline(shop: Shop | null): string {
  const metadata = (shop?.shop_metadata as Record<string, unknown> | null) ?? null
  const value = metadata?.tagline
  return typeof value === 'string' ? value : ''
}

// ============================================================================
// Screen
// ============================================================================

export function VendorSettingsScreen() {
  const ui = useAppUi()
  const { isDesktop, safeBottom } = useAppLayout()
  const dispatch = useAppDispatch()

  const shop = useAppSelector((s) => s.shop.currentShop)
  const isLoadingShops = useAppSelector((s) => s.shop.isLoadingShops)

  const params = useLocalSearchParams<{ section?: string }>()
  const activeId = resolveSectionId(params.section)
  const section = getSettingsSection(activeId)

  useEffect(() => {
    if (!shop) void dispatch(loadMyShops(undefined))
  }, [dispatch, shop])

  if (!shop && isLoadingShops) {
    return (
      <PageCenter>
        <Spinner size="large" />
      </PageCenter>
    )
  }

  if (!shop) {
    return (
      <YStack flex={1} alignItems="center" justifyContent="center" padding="$6" gap="$2" minHeight={320}>
        <YStack
          width={68}
          height={68}
          borderRadius={999}
          backgroundColor={ui.roseSurface}
          alignItems="center"
          justifyContent="center"
        >
          <Icons.Store size={30} color={ui.brand} />
        </YStack>
        <Text fontSize={16} fontWeight="800" color={ui.text}>
          No shop to configure
        </Text>
        <Text fontSize={13} color={ui.textSecondary} textAlign="center" maxWidth={320}>
          Create your storefront first, then come back to fine-tune its settings.
        </Text>
      </YStack>
    )
  }

  if (section.id === 'general') {
    return <GeneralSettings ui={ui} shop={shop} isDesktop={isDesktop} safeBottom={safeBottom} />
  }

  if (section.id === 'connect') {
    return <VendorConnectSettings ui={ui} shop={shop} isDesktop={isDesktop} safeBottom={safeBottom} />
  }

  if (section.id === 'payments' || section.id === 'shipping') {
    return (
      <YStack flex={1} minHeight={0} width="100%" maxWidth="100%">
        <SectionHeader ui={ui} section={section} isDesktop={isDesktop} />
        <YStack
          flex={1}
          paddingHorizontal={isDesktop ? '$6' : '$4'}
          paddingBottom={safeBottom + 24}
        >
          <ShopCommercePanel shop={shop as never} />
        </YStack>
      </YStack>
    )
  }

  if (section.id === 'returns') {
    return (
      <YStack flex={1} minHeight={0} width="100%" maxWidth="100%">
        <SectionHeader ui={ui} section={section} isDesktop={isDesktop} />
        <YStack
          flex={1}
          paddingHorizontal={isDesktop ? '$6' : '$4'}
          paddingBottom={safeBottom + 24}
        >
          <VendorReturnsSettingsPanel shopId={shop.id} />
        </YStack>
      </YStack>
    )
  }

  if (section.id === 'notifications') {
    return (
      <YStack flex={1} minHeight={0} width="100%" maxWidth="100%">
        <SectionHeader ui={ui} section={section} isDesktop={isDesktop} />
        <YStack
          flex={1}
          paddingHorizontal={isDesktop ? '$6' : '$4'}
          paddingBottom={safeBottom + 24}
        >
          <VendorNotificationsPanel shop={shop} ui={ui} />
        </YStack>
      </YStack>
    )
  }

  if (section.id === 'security') {
    return (
      <YStack flex={1} minHeight={0} width="100%" maxWidth="100%">
        <SectionHeader ui={ui} section={section} isDesktop={isDesktop} />
        <YStack
          flex={1}
          gap="$4"
          paddingHorizontal={isDesktop ? '$6' : '$4'}
          paddingBottom={safeBottom + 24}
        >
          <Text fontSize={14} color={ui.textSecondary} maxWidth={520}>
            Shop sign-in and recovery are managed on your account security page. Team roles for
            multi-user shops will appear here when available.
          </Text>
          <AppLink href={appRoutes.settingsSection('security')} asChild>
            <Button tone="primary" size="$4" borderRadius={999} alignSelf="flex-start" icon={<Icons.ShieldCheck size={16} />}>
              Open account security
            </Button>
          </AppLink>
          <AppLink href={appRoutes.settingsSection('notifications')} asChild>
            <Button tone="outline" size="$3" borderRadius={999} alignSelf="flex-start">
              Account notification preferences
            </Button>
          </AppLink>
        </YStack>
      </YStack>
    )
  }

  return (
    <YStack flex={1} minHeight={0} width="100%" maxWidth="100%">
      <SectionHeader ui={ui} section={section} isDesktop={isDesktop} />
      <ComingSoonSection ui={ui} section={section} isDesktop={isDesktop} />
    </YStack>
  )
}

// ============================================================================
// Notifications
// ============================================================================

type VendorNotifPrefs = {
  order_email: boolean
  low_stock_email: boolean
  marketing_insights: boolean
  customer_messages: boolean
}

function readVendorNotifPrefs(shop: Shop): VendorNotifPrefs {
  const metadata = (shop.shop_metadata as Record<string, unknown> | null) ?? {}
  const raw = (metadata.vendor_notifications as Record<string, unknown> | null) ?? {}
  return {
    order_email: raw.order_email !== false,
    low_stock_email: raw.low_stock_email !== false,
    marketing_insights: Boolean(raw.marketing_insights),
    customer_messages: raw.customer_messages !== false,
  }
}

function VendorNotificationsPanel({ shop, ui }: { shop: Shop; ui: AppUiTokens }) {
  const dispatch = useAppDispatch()
  const toast = useAppToast()
  const [prefs, setPrefs] = useState(() => readVendorNotifPrefs(shop))
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setPrefs(readVendorNotifPrefs(shop))
  }, [shop])

  async function save(next: VendorNotifPrefs) {
    setPrefs(next)
    setSaving(true)
    const metadata = {
      ...((shop.shop_metadata as Record<string, unknown> | null) ?? {}),
      vendor_notifications: next,
    }
    try {
      await dispatch(
        updateShop({
          shopId: shop.id,
          updates: { shop_metadata: metadata as ShopUpdate['shop_metadata'] },
        }),
      ).unwrap()
      toast.show('Notification preferences saved', { tone: 'success' })
    } catch (error) {
      toast.show('Could not save preferences', {
        tone: 'danger',
        message: error instanceof Error ? error.message : 'Try again.',
      })
    } finally {
      setSaving(false)
    }
  }

  const rows: Array<{ key: keyof VendorNotifPrefs; label: string; hint: string }> = [
    { key: 'order_email', label: 'Order updates', hint: 'Email when orders need packing or ship.' },
    { key: 'low_stock_email', label: 'Low stock alerts', hint: 'Warn when inventory runs low.' },
    { key: 'customer_messages', label: 'Customer messages', hint: 'Notify on new shop questions.' },
    { key: 'marketing_insights', label: 'Marketing insights', hint: 'Weekly tips and performance digests.' },
  ]

  return (
    <YStack gap="$3" maxWidth={560}>
      {rows.map((row) => (
        <XStack
          key={row.key}
          alignItems="center"
          justifyContent="space-between"
          gap="$3"
          padding="$3.5"
          borderRadius={radius.card}
          borderWidth={1}
          borderColor={ui.borderSubtle}
          backgroundColor={ui.surface}
        >
          <YStack flex={1} minWidth={0} gap={2}>
            <Text fontSize={14} fontWeight="700" color={ui.text}>
              {row.label}
            </Text>
            <Text fontSize={12} color={ui.textMuted}>
              {row.hint}
            </Text>
          </YStack>
          <Switch
            checked={prefs[row.key]}
            disabled={saving}
            onCheckedChange={(checked) => void save({ ...prefs, [row.key]: checked })}
          >
            <Switch.Thumb />
          </Switch>
        </XStack>
      ))}
    </YStack>
  )
}

// ============================================================================
// Section header
// ============================================================================

function SectionHeader({
  ui,
  section,
  isDesktop,
}: {
  ui: AppUiTokens
  section: SettingsSection
  isDesktop: boolean
}) {
  return (
    <YStack
      gap="$1"
      paddingHorizontal={isDesktop ? '$6' : '$4'}
      paddingTop={isDesktop ? '$6' : '$4'}
      paddingBottom="$2"
    >
      <Text fontSize={isDesktop ? 26 : 22} fontWeight="800" color={ui.text} letterSpacing={-0.5}>
        {section.label}
      </Text>
      <Text fontSize={14} color={ui.textSecondary} maxWidth={620}>
        {section.description}
      </Text>
    </YStack>
  )
}

// ============================================================================
// General settings form
// ============================================================================

type GeneralSettingsProps = {
  ui: AppUiTokens
  shop: Shop
  isDesktop: boolean
  safeBottom: number
}

function GeneralSettings({ ui, shop, isDesktop, safeBottom }: GeneralSettingsProps) {
  const dispatch = useAppDispatch()
  const toast = useAppToast()
  const { user } = useSupabase()

  const form = useAppSelector((s) => s.shop.formData)
  const validation = useAppSelector((s) => s.shop.validation)
  const isUpdating = useAppSelector((s) => s.shop.isUpdating)

  const [tagline, setTagline] = useState(() => readTagline(shop))
  const [logoImages, setLogoImages] = useState<PickedImage[]>([])
  const { progress: uploadProgress, track: trackUpload, reset: resetUpload } = useUploadProgress()
  const [editingHours, setEditingHours] = useState(
    () => Object.keys((shop.shop_hours as Record<string, string> | null) ?? {}).length > 0,
  )

  useEffect(() => {
    dispatch(loadFormFromShop(shopToFormData(shop)))
    setTagline(readTagline(shop))
    setLogoImages([])
    setEditingHours(Object.keys((shop.shop_hours as Record<string, string> | null) ?? {}).length > 0)
  }, [dispatch, shop.id])

  const errors = validation.errors
  const categories = form.shop_categories ?? []
  const categoryOptions = useMemo(
    () => Array.from(new Set<string>([...categories, ...COMMON_SHOP_CATEGORIES])),
    [categories],
  )
  const hours = form.shop_hours ?? {}
  const hasHours = Object.keys(hours).length > 0
  const currency = form.shop_currency || DEFAULT_SHOP_CURRENCY
  const logoPreview = logoImages[0]?.uri ?? shop.logo_url ?? undefined

  function setField<K extends keyof ShopFormData>(field: K, value: ShopFormData[K]) {
    dispatch(updateShopField({ field, value }))
  }

  function toggleCategory(category: string) {
    if (categories.includes(category)) {
      setField('shop_categories', categories.filter((item) => item !== category))
      return
    }
    if (categories.length >= SHOP_VALIDATION.CATEGORIES.MAX_SELECTED) {
      toast.show('Category limit reached', {
        tone: 'info',
        message: `You can select up to ${SHOP_VALIDATION.CATEGORIES.MAX_SELECTED} categories.`,
      })
      return
    }
    setField('shop_categories', [...categories, category])
  }

  function setDayOpen(dayKey: string, open: boolean) {
    const next = { ...hours }
    if (open) next[dayKey] = next[dayKey] && next[dayKey] !== 'Closed' ? next[dayKey] : DEFAULT_OPEN_HOURS
    else delete next[dayKey]
    setField('shop_hours', next)
  }

  function setDayHours(dayKey: string, value: string) {
    setField('shop_hours', { ...hours, [dayKey]: value })
  }

  async function handleSave() {
    dispatch(validateForm())
    const result = validateShopData(form)
    if (!result.isValid) {
      toast.show('Please fix the highlighted fields', {
        tone: 'danger',
        message: Object.values(result.errors)[0],
      })
      return
    }

    if (logoImages.length > 0) {
      if (!user?.id) {
        toast.show('Please sign in again', { tone: 'danger' })
        return
      }
      try {
        const [file] = await preparePickedImagesForUpload(logoImages.slice(0, 1))
        trackUpload(1)
        const response = await shopService.uploadShopLogo(user.id, shop.id, file, {
          onProgress: trackUpload,
        })
        if (!response.success) {
          throw new Error(response.error ?? 'Logo upload failed')
        }
        resetUpload()
        setLogoImages([])
      } catch (error) {
        resetUpload()
        toast.show('Logo upload failed', {
          tone: 'danger',
          message: error instanceof Error ? error.message : String(error),
        })
        return
      }
    }

    const metadata = {
      ...((shop.shop_metadata as Record<string, unknown> | null) ?? {}),
      tagline: tagline.trim() || null,
    }

    const updates: ShopUpdate = {
      shop_name: form.shop_name.trim(),
      shop_description: form.shop_description.trim() || null,
      shop_currency: currency,
      shop_categories: form.shop_categories,
      shop_hours: form.shop_hours as ShopUpdate['shop_hours'],
      shop_metadata: metadata as ShopUpdate['shop_metadata'],
    }

    try {
      await dispatch(updateShop({ shopId: shop.id, updates })).unwrap()
      toast.show('Changes saved', { tone: 'success', message: 'Your shop settings are up to date.' })
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
            General
          </Text>
          <Text fontSize={14} color={ui.textSecondary} maxWidth={620}>
            Configure your shop identity, hours, categories, and currency.
          </Text>
        </YStack>

        {/* Shop Identity */}
        <Card ui={ui}>
          <SectionTitle ui={ui} icon={Icons.Store} title="Shop Identity" />
          <YStack {...(isDesktop ? { flexDirection: 'row' } : {})} gap="$4" alignItems="flex-start">
            <YStack alignItems="center" gap="$2" width={isDesktop ? 200 : '100%'}>
              <Avatar size="$8" src={logoPreview} name={form.shop_name || shop.shop_name} />
              <ImageUploadField
                label=""
                value={logoImages}
                onChange={setLogoImages}
                disabled={isUpdating || (uploadProgress != null && uploadProgress > 0)}
                hint="Square images work best."
                uploadProgress={uploadProgress}
                uploadLabel="Uploading logo…"
              />
            </YStack>
            <YStack flex={1} minWidth={0} gap="$3.5" width={isDesktop ? undefined : '100%'}>
              <Field label="Shop Name" required error={errors.shop_name}>
                <Input
                  value={form.shop_name}
                  onChangeText={(value) => setField('shop_name', value)}
                  placeholder="Your shop name"
                />
              </Field>
              <Field label="Tagline">
                <Input value={tagline} onChangeText={setTagline} placeholder="The art of fine living" />
              </Field>
              <Field label="Description" error={errors.shop_description}>
                <TextArea
                  value={form.shop_description}
                  onChangeText={(value) => setField('shop_description', value)}
                  minHeight={110}
                  placeholder="Tell customers about your shop…"
                />
              </Field>
            </YStack>
          </YStack>
        </Card>

        {/* Shop Hours */}
        <Card ui={ui}>
          <XStack alignItems="center" justifyContent="space-between" gap="$2">
            <SectionTitle ui={ui} icon={Icons.Clock} title="Shop Hours" noMargin />
            <Button
              tone="outline"
              size="$2"
              borderRadius={999}
              icon={<Icons.Pencil size={14} />}
              onPress={() => setEditingHours((value) => !value)}
            >
              {editingHours ? 'Done' : hasHours ? 'Edit Hours' : 'Set Hours'}
            </Button>
          </XStack>

          {editingHours ? (
            <YStack gap="$2" marginTop="$1">
              {HOURS_DAYS.map((day) => {
                const value = hours[day.key]
                const isOpen = Boolean(value) && value !== 'Closed'
                return (
                  <XStack key={day.key} alignItems="center" gap="$3" minHeight={40}>
                    <XStack alignItems="center" gap="$2.5" width={140} minWidth={140}>
                      <Switch
                        checked={isOpen}
                        onCheckedChange={(checked) => setDayOpen(day.key, checked)}
                      />
                      <Text fontSize={13} fontWeight="600" color={ui.text}>
                        {day.label}
                      </Text>
                    </XStack>
                    {isOpen ? (
                      <Input
                        flex={1}
                        value={value}
                        onChangeText={(text) => setDayHours(day.key, text)}
                        placeholder={DEFAULT_OPEN_HOURS}
                        autoCapitalize="none"
                      />
                    ) : (
                      <Text flex={1} fontSize={13} color={ui.textMuted} fontWeight="600">
                        Closed
                      </Text>
                    )}
                  </XStack>
                )
              })}
              <Text fontSize={11.5} color={ui.textMuted} fontStyle="italic">
                Use a 24-hour range like {DEFAULT_OPEN_HOURS}. Toggle a day off to mark it closed.
              </Text>
            </YStack>
          ) : hasHours ? (
            <YStack gap="$1.5" marginTop="$1">
              {HOURS_DAYS.map((day) => {
                const value = hours[day.key]
                const isOpen = Boolean(value) && value !== 'Closed'
                return (
                  <XStack key={day.key} justifyContent="space-between" alignItems="center">
                    <Text fontSize={13} color={ui.textSecondary} fontWeight="600">
                      {day.label}
                    </Text>
                    <Text fontSize={13} color={isOpen ? ui.text : ui.textMuted} fontWeight="600">
                      {isOpen ? value : 'Closed'}
                    </Text>
                  </XStack>
                )
              })}
            </YStack>
          ) : (
            <XStack
              alignItems="center"
              justifyContent="space-between"
              gap="$2"
              padding="$3"
              borderRadius={radius.chip}
              backgroundColor={ui.surfaceMuted}
            >
              <XStack alignItems="center" gap="$2" flex={1} minWidth={0}>
                <Icons.Info size={15} color={ui.textMuted} />
                <Text fontSize={13} color={ui.textSecondary} fontWeight="600">
                  No Hours Set
                </Text>
              </XStack>
              <Text fontSize={10} fontWeight="700" color={ui.textMuted} letterSpacing={0.4}>
                DEFAULT: ALWAYS OPEN
              </Text>
            </XStack>
          )}
        </Card>

        {/* Categories */}
        <Card ui={ui}>
          <SectionTitle ui={ui} icon={Icons.Tags} title="Categories" />
          <XStack gap="$2" flexWrap="wrap">
            {categoryOptions.map((category) => {
              const active = categories.includes(category)
              return (
                <XStack
                  key={category}
                  alignItems="center"
                  gap="$1.5"
                  paddingHorizontal="$3"
                  paddingVertical="$2"
                  borderRadius={999}
                  borderWidth={1}
                  cursor="pointer"
                  animation="quick"
                  borderColor={active ? ui.brand : ui.borderSubtle}
                  backgroundColor={active ? ui.brand : ui.surfaceMuted}
                  pressStyle={{ opacity: 0.85 }}
                  onPress={() => toggleCategory(category)}
                >
                  <Text fontSize={12.5} fontWeight="700" color={active ? ui.onBrand : ui.text}>
                    {category}
                  </Text>
                  {active ? <Icons.Check size={13} color={ui.onBrand} /> : null}
                </XStack>
              )
            })}
            <XStack
              alignItems="center"
              gap="$1.5"
              paddingHorizontal="$3"
              paddingVertical="$2"
              borderRadius={999}
              borderWidth={1}
              borderStyle="dashed"
              cursor="pointer"
              borderColor={ui.borderSubtle}
              backgroundColor="transparent"
              pressStyle={{ opacity: 0.7 }}
              onPress={() =>
                toast.show('Custom categories coming soon', {
                  tone: 'info',
                  message: 'You’ll be able to add your own categories here.',
                })
              }
            >
              <Icons.Plus size={13} color={ui.textSecondary} />
              <Text fontSize={12.5} fontWeight="700" color={ui.textSecondary}>
                Add New
              </Text>
            </XStack>
          </XStack>
        </Card>

        {/* Shop Currency */}
        <Card ui={ui}>
          <SectionTitle ui={ui} icon={Icons.DollarSign} title="Shop Currency" />
          <Select value={currency} onValueChange={(value) => setField('shop_currency', value)}>
            <SelectTrigger width="100%" iconAfter={<Icons.ChevronDown size={16} color={ui.textMuted} />}>
              <Select.Value placeholder="Select a currency" />
            </SelectTrigger>
            <SelectContent zIndex={300000}>
              <SelectViewport>
                {SUPPORTED_CURRENCIES.map((option, index) => (
                  <SelectItem key={option.code} index={index} value={option.code}>
                    <Select.ItemText>
                      {option.name} ({option.code})
                    </Select.ItemText>
                  </SelectItem>
                ))}
              </SelectViewport>
            </SelectContent>
          </Select>
          <Text fontSize={11.5} color={ui.textMuted} fontStyle="italic">
            Note: Changing your currency will affect all product pricing and history.
          </Text>
        </Card>
      </YStack>

      {/* Sticky bottom action bar */}
      <XStack
        style={Platform.OS === 'web' ? ({ position: 'sticky', bottom: 0 } as const) : undefined}
        alignItems="center"
        justifyContent={isDesktop ? 'space-between' : 'stretch'}
        gap="$3"
        flexWrap="wrap"
        paddingHorizontal={isDesktop ? '$6' : '$4'}
        paddingTop="$3"
        paddingBottom={16 + (Platform.OS !== 'web' ? safeBottom : 0)}
        borderTopWidth={1}
        borderTopColor={ui.borderSubtle}
        backgroundColor={ui.surface}
        zIndex={20}
      >
        {isDesktop ? (
          <Text fontSize={12} color={ui.textMuted}>
            Changes apply across your storefront instantly.
          </Text>
        ) : null}
        <Button
          tone="primary"
          size="$4"
          borderRadius={999}
          flex={isDesktop ? undefined : 1}
          disabled={isUpdating}
          onPress={() => void handleSave()}
          icon={isUpdating ? <Spinner size="small" color="white" /> : <Icons.Check size={16} />}
        >
          {isUpdating ? 'Saving…' : 'Save Changes'}
        </Button>
      </XStack>
    </YStack>
  )
}

// ============================================================================
// Coming soon placeholder
// ============================================================================

function ComingSoonSection({
  ui,
  section,
  isDesktop,
}: {
  ui: AppUiTokens
  section: SettingsSection
  isDesktop: boolean
}) {
  const Icon = section.icon
  return (
    <YStack
      flex={1}
      alignItems="center"
      justifyContent="center"
      gap="$3"
      minHeight={320}
      paddingHorizontal={isDesktop ? '$6' : '$4'}
      paddingVertical="$6"
    >
      <YStack
        width={72}
        height={72}
        borderRadius={999}
        backgroundColor={ui.roseSurface}
        alignItems="center"
        justifyContent="center"
      >
        <Icon size={32} color={ui.brand} />
      </YStack>
      <XStack
        alignItems="center"
        gap={6}
        paddingHorizontal={10}
        paddingVertical={4}
        borderRadius={999}
        backgroundColor={ui.chip}
      >
        <Icons.Sparkles size={13} color={ui.brand} />
        <Text fontSize={11} fontWeight="700" color={ui.textSecondary} letterSpacing={0.4}>
          COMING SOON
        </Text>
      </XStack>
      <Text fontSize={14} color={ui.textSecondary} textAlign="center" maxWidth={420} lineHeight={21}>
        We’re building this section. Check back soon.
      </Text>
    </YStack>
  )
}

// ============================================================================
// Small building blocks
// ============================================================================

function Card({ ui, children }: { ui: AppUiTokens; children: ReactNode }) {
  return (
    <YStack
      gap="$3.5"
      padding="$5"
      borderRadius={radius.card}
      borderWidth={1}
      borderColor={ui.borderSubtle}
      backgroundColor={ui.surface}
      style={getShadowStyle('sm')}
    >
      {children}
    </YStack>
  )
}

function SectionTitle({
  ui,
  icon,
  title,
  noMargin,
}: {
  ui: AppUiTokens
  icon: IconType
  title: string
  noMargin?: boolean
}) {
  const Icon = icon
  return (
    <XStack alignItems="center" gap="$2" marginBottom={noMargin ? 0 : '$1'}>
      <YStack
        width={30}
        height={30}
        borderRadius={radius.chip}
        backgroundColor={ui.roseSurface}
        alignItems="center"
        justifyContent="center"
      >
        <Icon size={16} color={ui.brand} />
      </YStack>
      <Text fontSize={15} fontWeight="800" color={ui.text} letterSpacing={-0.2}>
        {title}
      </Text>
    </XStack>
  )
}
