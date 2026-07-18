import { useEffect, useState } from 'react'

import { Separator, Text, useAppToast } from '~/components/ui'
import { ChannelPrefsCard } from '~/components/settings/ChannelPrefsCard'
import { PreferenceRow, SettingsPanel } from '~/components/settings/SettingsPanel'
import { useSettingsPushSync } from '~/components/settings/useSettingsPushSync'
import {
  fetchCommunityNotificationPrefs,
  saveCommunityNotificationPrefs,
  type CommunityNotificationPrefs,
} from '~/lib/notifications/community-preferences'
import { Icons } from '~/components/ui'
import { useSupabase } from '~/providers/SupabaseProvider'

const DEFAULT: CommunityNotificationPrefs = {
  inAppEnabled: true,
  emailEnabled: true,
  pushEnabled: true,
  whatsappEnabled: false,
  digestEmailEnabled: true,
  mentionsEnabled: true,
}

export function CommunitySettingsPanel() {
  const toast = useAppToast()
  const { user } = useSupabase()
  const { pushConfigured, permissionGranted, pushBusy, syncDevicePush } = useSettingsPushSync()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [prefs, setPrefs] = useState<CommunityNotificationPrefs>(DEFAULT)

  useEffect(() => {
    if (!user?.id) {
      setLoading(false)
      return
    }
    let active = true
    setLoading(true)
    void fetchCommunityNotificationPrefs(user.id).then((next) => {
      if (!active) return
      setPrefs(next)
      setLoading(false)
    })
    return () => {
      active = false
    }
  }, [user?.id])

  async function updatePref<K extends keyof CommunityNotificationPrefs>(
    key: K,
    value: CommunityNotificationPrefs[K],
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
    const { error } = await saveCommunityNotificationPrefs(user.id, next)
    setSaving(false)
    if (error) {
      toast.show('Could not save community alerts', { tone: 'danger', message: error })
      return
    }
    toast.show('Community alerts saved', { tone: 'success' })
  }

  return (
    <SettingsPanel
      title="Community"
      description="Connections, intros, mentions, and digest preferences"
    >
      <ChannelPrefsCard
        loading={loading}
        saving={saving}
        pushConfigured={pushConfigured}
        permissionGranted={permissionGranted}
        pushBusy={pushBusy || saving}
        prefs={prefs}
        emailSubtitle="Connections, intros, mentions, and digests"
        whatsappSubtitle="Invites, intros, and RSVPs via your account phone"
        onChange={(key, value) => void updatePref(key, value)}
        extraRows={
          <>
            <Separator />
            <PreferenceRow
              icon={Icons.Bell}
              title="Mentions"
              subtitle="When someone @mentions you in a post or comment"
              checked={prefs.mentionsEnabled}
              disabled={saving}
              onCheckedChange={(checked) => void updatePref('mentionsEnabled', checked)}
            />
            <Separator />
            <PreferenceRow
              icon={Icons.Mail}
              title="Email digests"
              subtitle="Weekly community and network suggestion digests"
              checked={prefs.digestEmailEnabled}
              disabled={saving}
              onCheckedChange={(checked) => void updatePref('digestEmailEnabled', checked)}
            />
          </>
        }
      />
      {!prefs.digestEmailEnabled ? (
        <Text fontSize={12} color="$color10" paddingHorizontal="$1">
          Digests are off — you will still get immediate alerts for other community activity.
        </Text>
      ) : null}
    </SettingsPanel>
  )
}
