import { useUserScheme } from '@vxrn/color-scheme'
import { Link } from 'one'
import { useEffect, useState } from 'react'

import { AppPageHeader } from '~/components/layout/AppPageHeader'
import { BRAND_BLUE } from '~/community/lib/constants'
import {
  Button,
  Icons,
  ListItem,
  RadioGroup,
  RadioGroupItemWithLabel,
  Separator,
  Spinner,
  Switch,
  Text,
  XStack,
  YStack,
  useAppToast,
} from '~/components/ui'
import { SurfaceCard, FullWidthLayout, PageSection } from '~/components/layout'
import { radius } from '~/config/tokens'
import { useAuth } from '~/hooks/useAuth'
import { useAccess } from '~/hooks/useAccess'
import { useVendorShops } from '~/hooks/useVendorShops'
import {
  fetchCommerceNotificationPrefs,
  saveCommerceNotificationPrefs,
  type CommerceNotificationPrefs,
} from '~/lib/notifications/commerce-preferences'
import {
  fetchCommunityNotificationPrefs,
  saveCommunityNotificationPrefs,
  type CommunityNotificationPrefs,
} from '~/lib/notifications/community-preferences'
import {
  DEFAULT_CHANNEL_NOTIFICATION_PREFS,
  fetchChatNotificationPrefs,
  fetchClassNotificationPrefs,
  fetchCoworkNotificationPrefs,
  fetchShopNotificationPrefs,
  saveChatNotificationPrefs,
  saveClassNotificationPrefs,
  saveCoworkNotificationPrefs,
  saveShopNotificationPrefs,
  type ChannelNotificationPrefs,
} from '~/lib/notifications/product-preferences'
import { resolvePushPlatform } from '~/lib/notifications/push-config'
import { routes } from '~/lib/routes'
import { useAppUi } from '~/lib/theme/useAppUi'
import { useAiAssistOptional } from '~/providers/AiAssistProvider'
import { usePushNotifications } from '~/providers/PushNotificationsProvider'
import { useSupabase } from '~/providers/SupabaseProvider'

import { BRAND_NAME } from '~/config/brand'

export function SettingsScreen() {
  const ui = useAppUi()
  const scheme = useUserScheme()
  const toast = useAppToast()
  const { signOut } = useAuth()
  const { user } = useSupabase()
  const ai = useAiAssistOptional()
  const { canManageShops } = useAccess()
  const { shops } = useVendorShops()
  const showShopPrefs = canManageShops || shops.length > 0
  const {
    isConfigured: pushConfigured,
    permissionGranted,
    isBusy: pushBusy,
    enablePush,
    disablePush,
  } = usePushNotifications()
  const [isSigningOut, setIsSigningOut] = useState(false)
  const [prefsLoading, setPrefsLoading] = useState(true)
  const [savingKey, setSavingKey] = useState<string | null>(null)
  const [commercePrefs, setCommercePrefs] = useState<CommerceNotificationPrefs>({
    inAppEnabled: true,
    emailEnabled: true,
    pushEnabled: true,
    smsEnabled: false,
    whatsappEnabled: true,
    frequency: 'immediate',
  })
  const [communityPrefs, setCommunityPrefs] = useState<CommunityNotificationPrefs>({
    inAppEnabled: true,
    emailEnabled: true,
    pushEnabled: true,
    whatsappEnabled: false,
  })
  const [shopPrefs, setShopPrefs] = useState<ChannelNotificationPrefs>(DEFAULT_CHANNEL_NOTIFICATION_PREFS)
  const [chatPrefs, setChatPrefs] = useState<ChannelNotificationPrefs>(DEFAULT_CHANNEL_NOTIFICATION_PREFS)
  const [classPrefs, setClassPrefs] = useState<ChannelNotificationPrefs>(DEFAULT_CHANNEL_NOTIFICATION_PREFS)
  const [coworkPrefs, setCoworkPrefs] = useState<ChannelNotificationPrefs>(DEFAULT_CHANNEL_NOTIFICATION_PREFS)

  useEffect(() => {
    if (!user?.id) {
      setPrefsLoading(false)
      return
    }
    let active = true
    setPrefsLoading(true)
    void Promise.all([
      fetchCommerceNotificationPrefs(user.id),
      fetchCommunityNotificationPrefs(user.id),
      fetchShopNotificationPrefs(user.id),
      fetchChatNotificationPrefs(user.id),
      fetchClassNotificationPrefs(user.id),
      fetchCoworkNotificationPrefs(user.id),
    ]).then(([commerce, community, shop, chat, classAlerts, cowork]) => {
      if (!active) return
      setCommercePrefs(commerce)
      setCommunityPrefs(community)
      setShopPrefs(shop)
      setChatPrefs(chat)
      setClassPrefs(classAlerts)
      setCoworkPrefs(cowork)
      setPrefsLoading(false)
    })
    return () => {
      active = false
    }
  }, [user?.id])

  async function syncDevicePush(enabled: boolean): Promise<boolean> {
    if (enabled) {
      const result = await enablePush()
      if (!result.ok) {
        toast.show('Could not enable push', { tone: 'danger', message: result.error })
        return false
      }
      return true
    }
    const result = await disablePush()
    if (!result.ok) {
      toast.show('Could not disable push', { tone: 'danger', message: result.error })
      return false
    }
    return true
  }

  async function updateCommercePref<K extends keyof CommerceNotificationPrefs>(
    key: K,
    value: CommerceNotificationPrefs[K],
  ) {
    if (!user?.id) return
    const next = { ...commercePrefs, [key]: value }
    setSavingKey('commerce')
    if (key === 'pushEnabled') {
      const ok = await syncDevicePush(value === true)
      if (!ok) {
        setSavingKey(null)
        return
      }
    }
    setCommercePrefs(next)
    const { error } = await saveCommerceNotificationPrefs(user.id, next)
    setSavingKey(null)
    if (error) {
      toast.show('Could not save preferences', { tone: 'danger', message: error })
      return
    }
    toast.show('Commerce alerts saved', { tone: 'success' })
  }

  async function updateCommunityPref<K extends keyof CommunityNotificationPrefs>(
    key: K,
    value: CommunityNotificationPrefs[K],
  ) {
    if (!user?.id) return
    const next = { ...communityPrefs, [key]: value }
    setSavingKey('community')
    if (key === 'pushEnabled') {
      const ok = await syncDevicePush(value === true)
      if (!ok) {
        setSavingKey(null)
        return
      }
    }
    setCommunityPrefs(next)
    const { error } = await saveCommunityNotificationPrefs(user.id, next)
    setSavingKey(null)
    if (error) {
      toast.show('Could not save community alerts', { tone: 'danger', message: error })
      return
    }
    toast.show('Community alerts saved', { tone: 'success' })
  }

  async function updateChannelSection(
    section: 'shop' | 'chat' | 'class' | 'cowork',
    key: keyof ChannelNotificationPrefs,
    value: boolean,
    current: ChannelNotificationPrefs,
    setPrefs: (prefs: ChannelNotificationPrefs) => void,
    save: (userId: string, prefs: ChannelNotificationPrefs) => Promise<{ error: string | null }>,
    successLabel: string,
  ) {
    if (!user?.id) return
    const next = { ...current, [key]: value }
    setSavingKey(section)
    if (key === 'pushEnabled') {
      const ok = await syncDevicePush(value)
      if (!ok) {
        setSavingKey(null)
        return
      }
    }
    setPrefs(next)
    const { error } = await save(user.id, next)
    setSavingKey(null)
    if (error) {
      toast.show(`Could not save ${successLabel.toLowerCase()}`, { tone: 'danger', message: error })
      return
    }
    toast.show(`${successLabel} saved`, { tone: 'success' })
  }

  async function handleSignOut() {
    setIsSigningOut(true)
    const { error } = await signOut()
    setIsSigningOut(false)

    if (error) {
      toast.show('Sign out failed', { tone: 'danger', message: error })
      return
    }

    toast.show('Signed out', { tone: 'success' })
  }

  const pushBusyOrSaving = pushBusy || savingKey != null

  return (
    <FullWidthLayout scroll>
      <PageSection paddingVertical="$3">
        <YStack gap="$5" width="100%">
        <AppPageHeader
          title="Settings"
          subtitle={`Shared across Marketplace, Community, Chat, Classes, Co-Work, and Manage shop — one place for your ${BRAND_NAME} account`}
        />

        <SettingsSection title="Account">
          <SurfaceCard padding="$0" borderRadius={radius.card} overflow="hidden">
            <XStack
              alignItems="center"
              justifyContent="space-between"
              paddingHorizontal="$4"
              paddingVertical="$3"
            >
              <XStack gap="$3" alignItems="center" flex={1}>
                <Icons.LogOut size={18} color="$red10" />
                <YStack gap={2} flex={1} minWidth={0}>
                  <Text fontWeight="600" color={ui.text}>
                    Sign out
                  </Text>
                  <Text fontSize={13} color={ui.textMuted}>
                    Ends your session on this device
                  </Text>
                </YStack>
              </XStack>
              <Button
                tone="outline"
                size="$3"
                disabled={isSigningOut}
                onPress={handleSignOut}
              >
                {isSigningOut ? 'Signing out…' : 'Sign out'}
              </Button>
            </XStack>
          </SurfaceCard>
        </SettingsSection>

        <SettingsSection title="Appearance">
          <SurfaceCard padding="$4" gap="$4" borderRadius={radius.card}>
            <Text color={ui.textSecondary} fontSize={14}>
              Theme (applies to every tab)
            </Text>
            <RadioGroup value={scheme.setting} onValueChange={(v) => scheme.set(v as any)}>
              <RadioGroupItemWithLabel value="light" label="Light" />
              <RadioGroupItemWithLabel value="dark" label="Dark" />
              <RadioGroupItemWithLabel value="system" label="Match system" />
            </RadioGroup>
          </SurfaceCard>
        </SettingsSection>

        <SettingsSection title="Push on this device">
          <SurfaceCard padding="$0" borderRadius={radius.card} overflow="hidden">
            <PreferenceRow
              icon={Icons.Smartphone}
              title={`${PlatformLabel()} push`}
              subtitle={
                !pushConfigured
                  ? 'OneSignal App ID not configured — push needs a production build on iOS/Android'
                  : permissionGranted
                    ? 'Enabled for this browser or app install'
                    : 'Turn on to get alerts across Commerce, Community, Chat, Class, and Co-Work'
              }
              checked={permissionGranted}
              disabled={pushBusy || !pushConfigured}
              onCheckedChange={(checked) => void syncDevicePush(checked)}
            />
          </SurfaceCard>
        </SettingsSection>

        <ChannelPrefsCard
          title="Commerce alerts"
          loading={prefsLoading}
          saving={savingKey === 'commerce'}
          pushConfigured={pushConfigured}
          permissionGranted={permissionGranted}
          pushBusy={pushBusyOrSaving}
          prefs={{
            inAppEnabled: commercePrefs.inAppEnabled,
            emailEnabled: commercePrefs.emailEnabled,
            pushEnabled: commercePrefs.pushEnabled,
            whatsappEnabled: commercePrefs.whatsappEnabled,
          }}
          emailSubtitle="Orders, cart reminders, and restock alerts"
          whatsappSubtitle="Optional cart recovery via WhatsApp"
          onChange={(key, value) => void updateCommercePref(key, value)}
          extraRows={
            <>
              <Separator />
              <PreferenceRow
                icon={Icons.Phone}
                title="SMS"
                subtitle="Optional text reminders for abandoned carts"
                checked={commercePrefs.smsEnabled}
                disabled={savingKey === 'commerce'}
                onCheckedChange={(checked) => void updateCommercePref('smsEnabled', checked)}
              />
            </>
          }
        />

        {showShopPrefs ? (
          <ChannelPrefsCard
            title="Manage shop alerts"
            loading={prefsLoading}
            saving={savingKey === 'shop'}
            pushConfigured={pushConfigured}
            permissionGranted={permissionGranted}
            pushBusy={pushBusyOrSaving}
            prefs={shopPrefs}
            emailSubtitle="New orders, payments, and low-stock alerts"
            whatsappSubtitle="Optional seller order alerts on WhatsApp"
            onChange={(key, value) =>
              void updateChannelSection(
                'shop',
                key,
                value,
                shopPrefs,
                setShopPrefs,
                saveShopNotificationPrefs,
                'Manage shop alerts',
              )
            }
          />
        ) : null}

        <ChannelPrefsCard
          title="Community alerts"
          loading={prefsLoading}
          saving={savingKey === 'community'}
          pushConfigured={pushConfigured}
          permissionGranted={permissionGranted}
          pushBusy={pushBusyOrSaving}
          prefs={communityPrefs}
          emailSubtitle="Connections, intros, mentions, and digests"
          whatsappSubtitle="Invites, intros, and RSVPs via your account phone"
          onChange={(key, value) => void updateCommunityPref(key, value)}
        />

        <ChannelPrefsCard
          title="Chat alerts"
          loading={prefsLoading}
          saving={savingKey === 'chat'}
          pushConfigured={pushConfigured}
          permissionGranted={permissionGranted}
          pushBusy={pushBusyOrSaving}
          prefs={chatPrefs}
          emailSubtitle="Email for chat is optional; most alerts are in-app + push"
          whatsappSubtitle="Optional WhatsApp for important chat alerts"
          hideWhatsApp
          onChange={(key, value) =>
            void updateChannelSection(
              'chat',
              key,
              value,
              chatPrefs,
              setChatPrefs,
              saveChatNotificationPrefs,
              'Chat alerts',
            )
          }
        />

        <ChannelPrefsCard
          title="Class alerts"
          loading={prefsLoading}
          saving={savingKey === 'class'}
          pushConfigured={pushConfigured}
          permissionGranted={permissionGranted}
          pushBusy={pushBusyOrSaving}
          prefs={classPrefs}
          emailSubtitle="Enrollment confirmation and new lessons"
          whatsappSubtitle="Optional Class reminders on WhatsApp"
          onChange={(key, value) =>
            void updateChannelSection(
              'class',
              key,
              value,
              classPrefs,
              setClassPrefs,
              saveClassNotificationPrefs,
              'Class alerts',
            )
          }
        />

        <ChannelPrefsCard
          title="Co-Work alerts"
          loading={prefsLoading}
          saving={savingKey === 'cowork'}
          pushConfigured={pushConfigured}
          permissionGranted={permissionGranted}
          pushBusy={pushBusyOrSaving}
          prefs={coworkPrefs}
          emailSubtitle="Meeting invites, reminders, and recordings"
          whatsappSubtitle="Optional meeting reminders on WhatsApp"
          onChange={(key, value) =>
            void updateChannelSection(
              'cowork',
              key,
              value,
              coworkPrefs,
              setCoworkPrefs,
              saveCoworkNotificationPrefs,
              'Co-Work alerts',
            )
          }
        />

        <SettingsSection title="Privacy">
          <SurfaceCard padding="$0" borderRadius={radius.card} overflow="hidden">
            <PreferenceRow icon={Icons.Eye} title="Profile visibility" subtitle="Public" />
            <Separator />
            <PreferenceRow icon={Icons.Fingerprint} title="Biometric unlock" defaultChecked />
          </SurfaceCard>
        </SettingsSection>

        <SettingsSection title="About">
          <SurfaceCard padding="$0" borderRadius={radius.card} overflow="hidden">
            <Link href={routes.help} asChild>
              <XStack
                alignItems="center"
                gap="$3"
                paddingHorizontal="$4"
                paddingVertical="$3.5"
                hoverStyle={{ backgroundColor: ui.navHover }}
                cursor="pointer"
              >
                <Icons.HelpCircle size={18} color={ui.brand} />
                <YStack flex={1} gap={2}>
                  <Text fontSize={15} color={ui.text} fontWeight="600">
                    Help & Support
                  </Text>
                  <Text fontSize={13} color={ui.textMuted}>
                    FAQs and contact for Marketplace, Community, Chat, Class, Co-Work, and shops
                  </Text>
                </YStack>
                <Icons.ChevronRight size={16} color={ui.textMuted} />
              </XStack>
            </Link>
            <Separator />
            <XStack
              alignItems="center"
              gap="$3"
              paddingHorizontal="$4"
              paddingVertical="$3.5"
              hoverStyle={{ backgroundColor: ui.navHover }}
              cursor="pointer"
              onPress={() => ai?.openAssist()}
            >
              <Icons.Sparkles size={18} color={ui.brand} />
              <YStack flex={1} gap={2}>
                <Text fontSize={15} color={ui.text} fontWeight="600">
                  Ask SHEconomy AI
                </Text>
                <Text fontSize={13} color={ui.textMuted}>
                  Contextual tips for the tab you’re on
                </Text>
              </YStack>
              <Icons.ChevronRight size={16} color={ui.textMuted} />
            </XStack>
            <Separator />
            <ListItem
              icon={<Icons.Info size={18} color={BRAND_BLUE} />}
              title="Version"
              subTitle="1.0.0"
            />
          </SurfaceCard>
        </SettingsSection>
        </YStack>
      </PageSection>
    </FullWidthLayout>
  )
}

function ChannelPrefsCard({
  title,
  loading,
  saving,
  pushConfigured,
  permissionGranted,
  pushBusy,
  prefs,
  emailSubtitle,
  whatsappSubtitle,
  hideWhatsApp,
  onChange,
  extraRows,
}: {
  title: string
  loading: boolean
  saving: boolean
  pushConfigured: boolean
  permissionGranted: boolean
  pushBusy: boolean
  prefs: Pick<ChannelNotificationPrefs, 'inAppEnabled' | 'emailEnabled' | 'pushEnabled' | 'whatsappEnabled'>
  emailSubtitle: string
  whatsappSubtitle: string
  hideWhatsApp?: boolean
  onChange: (key: keyof ChannelNotificationPrefs, value: boolean) => void
  extraRows?: React.ReactNode
}) {
  const ui = useAppUi()

  return (
    <SettingsSection title={title}>
      <SurfaceCard padding="$0" borderRadius={radius.card} overflow="hidden">
        {loading ? (
          <XStack padding="$4" alignItems="center" gap="$2">
            <Spinner size="small" />
            <Text color={ui.textSecondary} fontSize={13}>
              Loading preferences…
            </Text>
          </XStack>
        ) : (
          <>
            <PreferenceRow
              icon={Icons.Bell}
              title="In-app"
              subtitle="Toasts + inbox on web, iOS, and Android"
              checked={prefs.inAppEnabled}
              disabled={saving}
              onCheckedChange={(checked) => onChange('inAppEnabled', checked)}
            />
            <Separator />
            <PreferenceRow
              icon={Icons.Mail}
              title="Email"
              subtitle={emailSubtitle}
              checked={prefs.emailEnabled}
              disabled={saving}
              onCheckedChange={(checked) => onChange('emailEnabled', checked)}
            />
            <Separator />
            <PreferenceRow
              icon={Icons.Smartphone}
              title="Push"
              subtitle={
                !pushConfigured
                  ? 'Push App ID not configured'
                  : permissionGranted
                    ? `On for this ${PlatformLabel()} device`
                    : 'Enable browser or device push alerts'
              }
              checked={prefs.pushEnabled && permissionGranted}
              disabled={saving || pushBusy || !pushConfigured}
              onCheckedChange={(checked) => onChange('pushEnabled', checked)}
            />
            {!hideWhatsApp ? (
              <>
                <Separator />
                <PreferenceRow
                  icon={Icons.MessageCircle}
                  title="WhatsApp"
                  subtitle={whatsappSubtitle}
                  checked={prefs.whatsappEnabled}
                  disabled={saving}
                  onCheckedChange={(checked) => onChange('whatsappEnabled', checked)}
                />
              </>
            ) : null}
            {extraRows}
          </>
        )}
      </SurfaceCard>
    </SettingsSection>
  )
}

function PlatformLabel() {
  const platform = resolvePushPlatform()
  if (platform === 'ios') return 'iOS'
  if (platform === 'android') return 'Android'
  return 'web'
}

function SettingsSection({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  const ui = useAppUi()

  return (
    <YStack gap="$2.5">
      <XStack gap="$2.5" alignItems="center">
        <YStack width={3} height={18} borderRadius={999} backgroundColor={ui.brand} opacity={0.85} />
        <Text fontWeight="700" fontSize={15} color={ui.text} letterSpacing={-0.15}>
          {title}
        </Text>
      </XStack>
      {children}
    </YStack>
  )
}

function PreferenceRow({
  icon: Icon,
  title,
  subtitle,
  defaultChecked,
  checked,
  disabled,
  onCheckedChange,
}: {
  icon: typeof Icons.Bell
  title: string
  subtitle?: string
  defaultChecked?: boolean
  checked?: boolean
  disabled?: boolean
  onCheckedChange?: (checked: boolean) => void
}) {
  const ui = useAppUi()

  return (
    <XStack
      alignItems="center"
      justifyContent="space-between"
      paddingHorizontal="$4"
      paddingVertical="$3.5"
      hoverStyle={{ backgroundColor: ui.navHover }}
      opacity={disabled ? 0.7 : 1}
    >
      <XStack alignItems="center" gap="$3" flex={1}>
        <Icon size={18} color={ui.textSecondary} />
        <YStack gap={2} flex={1} minWidth={0}>
          <Text fontSize={15} color={ui.text}>
            {title}
          </Text>
          {subtitle ? (
            <Text fontSize={13} color={ui.textMuted}>
              {subtitle}
            </Text>
          ) : null}
        </YStack>
      </XStack>
      {checked == null ? (
        <Switch defaultChecked={defaultChecked} disabled={disabled} />
      ) : (
        <Switch
          checked={checked}
          disabled={disabled}
          onCheckedChange={onCheckedChange}
        />
      )}
    </XStack>
  )
}
