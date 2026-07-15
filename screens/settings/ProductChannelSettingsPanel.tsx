import { useCallback, useEffect, useState } from 'react'

import { useAppToast } from '~/components/ui'
import { ChannelPrefsCard } from '~/components/settings/ChannelPrefsCard'
import { SettingsPanel } from '~/components/settings/SettingsPanel'
import { useSettingsPushSync } from '~/components/settings/useSettingsPushSync'
import {
  DEFAULT_CHANNEL_NOTIFICATION_PREFS,
  type ChannelNotificationPrefs,
} from '~/lib/notifications/product-preferences'
import { useSupabase } from '~/providers/SupabaseProvider'

type ChannelLoader = (userId: string) => Promise<ChannelNotificationPrefs>
type ChannelSaver = (
  userId: string,
  prefs: ChannelNotificationPrefs,
) => Promise<{ error: string | null }>

export function ProductChannelSettingsPanel({
  title,
  description,
  successLabel,
  emailSubtitle,
  whatsappSubtitle,
  hideWhatsApp,
  fetchPrefs,
  savePrefs,
}: {
  title: string
  description: string
  successLabel: string
  emailSubtitle: string
  whatsappSubtitle: string
  hideWhatsApp?: boolean
  fetchPrefs: ChannelLoader
  savePrefs: ChannelSaver
}) {
  const toast = useAppToast()
  const { user } = useSupabase()
  const { pushConfigured, permissionGranted, pushBusy, syncDevicePush } = useSettingsPushSync()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [prefs, setPrefs] = useState<ChannelNotificationPrefs>(DEFAULT_CHANNEL_NOTIFICATION_PREFS)

  useEffect(() => {
    if (!user?.id) {
      setLoading(false)
      return
    }
    let active = true
    setLoading(true)
    void fetchPrefs(user.id).then((next) => {
      if (!active) return
      setPrefs(next)
      setLoading(false)
    })
    return () => {
      active = false
    }
    // Module-level fetchers are stable; omit from deps to avoid remount churn.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fetchPrefs identity is stable
  }, [user?.id])

  const updatePref = useCallback(
    async (key: keyof ChannelNotificationPrefs, value: boolean) => {
      if (!user?.id) return
      const next = { ...prefs, [key]: value }
      setSaving(true)
      if (key === 'pushEnabled') {
        const ok = await syncDevicePush(value)
        if (!ok) {
          setSaving(false)
          return
        }
      }
      setPrefs(next)
      const { error } = await savePrefs(user.id, next)
      setSaving(false)
      if (error) {
        toast.show(`Could not save ${successLabel.toLowerCase()}`, {
          tone: 'danger',
          message: error,
        })
        return
      }
      toast.show(`${successLabel} saved`, { tone: 'success' })
    },
    [user?.id, prefs, savePrefs, syncDevicePush, successLabel, toast],
  )

  return (
    <SettingsPanel title={title} description={description}>
      <ChannelPrefsCard
        loading={loading}
        saving={saving}
        pushConfigured={pushConfigured}
        permissionGranted={permissionGranted}
        pushBusy={pushBusy || saving}
        prefs={prefs}
        emailSubtitle={emailSubtitle}
        whatsappSubtitle={whatsappSubtitle}
        hideWhatsApp={hideWhatsApp}
        onChange={(key, value) => void updatePref(key, value)}
      />
    </SettingsPanel>
  )
}
