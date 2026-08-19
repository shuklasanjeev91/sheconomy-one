import { useEffect, useState } from 'react'
import type { Href } from 'one'

import { AppLink } from '~/components/navigation/AppLink'
import { Button, Icons, Separator, Text, XStack, YStack, useAppToast } from '~/components/ui'
import { SurfaceCard } from '~/components/layout'
import { ChannelPrefsCard } from '~/components/settings/ChannelPrefsCard'
import { PreferenceRow, SettingsPanel } from '~/components/settings/SettingsPanel'
import { useSettingsPushSync } from '~/components/settings/useSettingsPushSync'
import { radius } from '~/config/tokens'
import {
  fetchCommerceNotificationPrefs,
  saveCommerceNotificationPrefs,
  type CommerceNotificationPrefs,
} from '~/lib/notifications/commerce-preferences'
import { commerceRoutes } from '~/lib/routes'
import { useAppUi } from '~/lib/theme/useAppUi'
import { useSupabase } from '~/providers/SupabaseProvider'

const DEFAULT_COMMERCE: CommerceNotificationPrefs = {
  inAppEnabled: true,
  emailEnabled: true,
  pushEnabled: true,
  smsEnabled: false,
  whatsappEnabled: true,
  frequency: 'immediate',
}

function DeepLinkRow({
  href,
  icon: Icon,
  title,
  subtitle,
}: {
  href: Href
  icon: typeof Icons.Package
  title: string
  subtitle: string
}) {
  const ui = useAppUi()
  return (
    <AppLink href={href} asChild>
      <XStack
        alignItems="center"
        gap="$3"
        paddingHorizontal="$4"
        paddingVertical="$3.5"
        hoverStyle={{ backgroundColor: ui.navHover }}
        cursor="pointer"
      >
        <Icon size={18} color={ui.textSecondary} />
        <YStack flex={1} gap={2} minWidth={0}>
          <Text fontSize={15} color={ui.text} fontWeight="600">
            {title}
          </Text>
          <Text fontSize={13} color={ui.textMuted}>
            {subtitle}
          </Text>
        </YStack>
        <Icons.ChevronRight size={16} color={ui.textMuted} />
      </XStack>
    </AppLink>
  )
}

export function CommerceSettingsPanel() {
  const toast = useAppToast()
  const ui = useAppUi()
  const { user } = useSupabase()
  const { pushConfigured, permissionGranted, pushBusy, syncDevicePush } = useSettingsPushSync()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [prefs, setPrefs] = useState<CommerceNotificationPrefs>(DEFAULT_COMMERCE)

  useEffect(() => {
    if (!user?.id) {
      setLoading(false)
      return
    }
    let active = true
    setLoading(true)
    void fetchCommerceNotificationPrefs(user.id).then((next) => {
      if (!active) return
      setPrefs(next)
      setLoading(false)
    })
    return () => {
      active = false
    }
  }, [user?.id])

  async function updatePref<K extends keyof CommerceNotificationPrefs>(
    key: K,
    value: CommerceNotificationPrefs[K],
  ) {
    if (!user?.id) return
    const next = { ...prefs, [key]: value }
    setSaving(true)
    if (key === 'pushEnabled') {
      const ok = await syncDevicePush(value === true)
      if (!ok) {
        setSaving(false)
        return
      }
    }
    setPrefs(next)
    const { error } = await saveCommerceNotificationPrefs(user.id, next)
    setSaving(false)
    if (error) {
      toast.show('Could not save preferences', { tone: 'danger', message: error })
      return
    }
    toast.show('Commerce alerts saved', { tone: 'success' })
  }

  return (
    <SettingsPanel
      title="Marketplace"
      description="Buyer alerts for orders, returns, refund ETA updates, cart recovery, restock, and post-purchase reorder nudges — plus shortcuts to orders and checkout details"
    >
      <ChannelPrefsCard
        loading={loading}
        saving={saving}
        pushConfigured={pushConfigured}
        permissionGranted={permissionGranted}
        pushBusy={pushBusy || saving}
        prefs={prefs}
        emailSubtitle="Orders, return and refund ETA updates, restock alerts, and buy-again nudges"
        whatsappSubtitle="Optional cart recovery, reorder, and refund ETA nudges via WhatsApp"
        onChange={(key, value) => void updatePref(key, value)}
        extraRows={
          <>
            <Separator />
            <PreferenceRow
              icon={Icons.Phone}
              title="SMS"
              subtitle="Optional text reminders for abandoned carts"
              checked={prefs.smsEnabled}
              disabled={saving}
              onCheckedChange={(checked) => void updatePref('smsEnabled', checked)}
            />
            <Separator />
            <YStack paddingHorizontal="$4" paddingVertical="$3" gap="$2">
              <Text fontSize={15} fontWeight="600" color={ui.text}>
                Alert frequency
              </Text>
              <Text fontSize={13} color={ui.textMuted}>
                How often promotional marketplace alerts are delivered
              </Text>
              <XStack gap="$2" flexWrap="wrap">
                {(
                  [
                    { id: 'immediate', label: 'Immediate' },
                    { id: 'daily', label: 'Daily digest' },
                    { id: 'weekly', label: 'Weekly digest' },
                  ] as const
                ).map((option) => (
                  <Button
                    key={option.id}
                    size="$2"
                    tone={prefs.frequency === option.id ? 'primary' : 'outline'}
                    borderRadius={999}
                    disabled={saving}
                    onPress={() => void updatePref('frequency', option.id)}
                  >
                    {option.label}
                  </Button>
                ))}
              </XStack>
            </YStack>
          </>
        }
      />

      <SurfaceCard padding="$0" borderRadius={radius.card} overflow="hidden">
        <DeepLinkRow
          href={commerceRoutes.orders}
          icon={Icons.Package}
          title="Orders"
          subtitle="Track purchases and returns"
        />
        <Separator />
        <DeepLinkRow
          href={commerceRoutes.favorites}
          icon={Icons.Heart}
          title="Wishlist"
          subtitle="Saved items and collections"
        />
        <Separator />
        <DeepLinkRow
          href={commerceRoutes.following}
          icon={Icons.Store}
          title="Shops you follow"
          subtitle="Storefronts you follow for new listings"
        />
        <Separator />
        <DeepLinkRow
          href={commerceRoutes.addresses}
          icon={Icons.MapPin}
          title="Addresses"
          subtitle="Shipping and billing"
        />
        <Separator />
        <DeepLinkRow
          href={commerceRoutes.paymentMethods}
          icon={Icons.CreditCard}
          title="Payment methods"
          subtitle="Saved cards and wallets"
        />
      </SurfaceCard>
    </SettingsPanel>
  )
}
