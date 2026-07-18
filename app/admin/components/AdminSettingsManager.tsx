import { useEffect, useState } from 'react'

import { Badge, Button, Spinner, Text, XStack, YStack } from '~/components/ui'
import { getShadowStyle, radius } from '~/config/tokens'
import { useAppLayout } from '~/hooks/useAppLayout'
import {
  fetchRemoteUpdateConfig,
  getAndroidPlayStoreUrl,
  getAppEnv,
  getIosStoreUrl,
  getUpdateConfigUrl,
} from '~/lib/updates/remote-config'
import type { RemoteUpdateConfig } from '~/lib/updates/types'
import { useAppUi } from '~/lib/theme/useAppUi'

export function AdminSettingsManager() {
  const ui = useAppUi()
  const { isDesktop, safeBottom } = useAppLayout()
  const [config, setConfig] = useState<RemoteUpdateConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void load()
  }, [])

  async function load() {
    setLoading(true)
    setError(null)
    const remote = await fetchRemoteUpdateConfig()
    setConfig(remote)
    if (!getUpdateConfigUrl()) {
      setError('EXPO_PUBLIC_UPDATE_CONFIG_URL is not set — showing local env only.')
    }
    setLoading(false)
  }

  const rows: { label: string; value: string }[] = [
    { label: 'App environment', value: getAppEnv() },
    { label: 'Update config URL', value: getUpdateConfigUrl() ?? '—' },
    { label: 'iOS App Store URL', value: getIosStoreUrl() ?? '—' },
    { label: 'Android Play Store URL', value: getAndroidPlayStoreUrl() ?? '—' },
    {
      label: 'Minimum supported version',
      value: config?.minimumSupportedVersion ?? '—',
    },
    { label: 'Latest version', value: config?.latestVersion ?? '—' },
    { label: 'Critical update', value: config ? String(config.critical) : '—' },
    {
      label: 'Maintenance mode',
      value: config ? String(config.maintenanceMode) : '—',
    },
    {
      label: 'Maintenance message',
      value: config?.maintenanceMessage ?? '—',
    },
  ]

  return (
    <YStack
      flex={1}
      gap="$4"
      paddingHorizontal={isDesktop ? '$6' : '$4'}
      paddingTop={isDesktop ? '$6' : '$4'}
      paddingBottom={safeBottom + 24}
    >
      <XStack justifyContent="space-between" alignItems="flex-start" gap="$3" flexWrap="wrap">
        <YStack gap="$1" flex={1} minWidth={200}>
          <Text fontSize={isDesktop ? 26 : 22} fontWeight="800" color={ui.text}>
            Settings
          </Text>
          <Text fontSize={14} color={ui.textSecondary}>
            Platform configuration from environment and remote update policy.
          </Text>
        </YStack>
        <Button size="$3" onPress={() => void load()} disabled={loading}>
          {loading ? <Spinner size="small" /> : <Text>Refresh</Text>}
        </Button>
      </XStack>

      {error ? (
        <Text fontSize={13} color={ui.textSecondary}>
          {error}
        </Text>
      ) : null}

      {loading && !config ? (
        <YStack alignItems="center" paddingVertical="$8">
          <Spinner size="large" />
        </YStack>
      ) : (
        <YStack
          gap="$0"
          borderRadius={radius.card}
          borderWidth={1}
          borderColor={ui.borderSubtle}
          backgroundColor={ui.surface}
          overflow="hidden"
          style={getShadowStyle('sm')}
        >
          {rows.map((row, index) => (
            <XStack
              key={row.label}
              paddingHorizontal="$4"
              paddingVertical="$3.5"
              gap="$3"
              borderTopWidth={index === 0 ? 0 : 1}
              borderColor={ui.borderSubtle}
              alignItems="flex-start"
            >
              <Text fontSize={13} fontWeight="600" color={ui.textSecondary} width={160}>
                {row.label}
              </Text>
              <Text fontSize={13} color={ui.text} flex={1}>
                {row.value}
              </Text>
              {row.label === 'Maintenance mode' && config?.maintenanceMode ? (
                <Badge>ON</Badge>
              ) : null}
            </XStack>
          ))}
        </YStack>
      )}
    </YStack>
  )
}
