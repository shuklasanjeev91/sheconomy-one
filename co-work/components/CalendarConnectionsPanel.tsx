import { useLocalSearchParams } from 'one'
import { useCallback, useEffect, useState } from 'react'

import { Button, Spinner, Text, XStack, YStack, useAppToast } from '~/components/ui'
import { CoWorkSectionLabel } from '~/co-work/components/CoWorkUi'
import { useCoWorkTheme } from '~/co-work/lib/theme'
import { meetingFeatureFlags } from '~/co-work/lib/meeting-feature-flags'
import {
  calendarProviderLabel,
  connectCalendarProvider,
  fetchCalendarConnections,
  revokeCalendarConnection,
  type CalendarConnection,
  type CalendarProvider,
} from '~/lib/calendar/connections'

const PROVIDERS: CalendarProvider[] = ['google', 'microsoft']

/** Connect / disconnect Google + Outlook for automatic meeting event sync. */
export function CalendarConnectionsPanel({
  redirectTo = '/co-work/meetings',
}: {
  redirectTo?: string
}) {
  const { ui: coworkUi } = useCoWorkTheme()
  const toast = useAppToast()
  const params = useLocalSearchParams<{ calendar?: string | string[]; provider?: string | string[] }>()
  const [connections, setConnections] = useState<CalendarConnection[]>([])
  const [loading, setLoading] = useState(true)
  const [busyProvider, setBusyProvider] = useState<CalendarProvider | null>(null)

  const load = useCallback(async () => {
    if (!meetingFeatureFlags.calendarSync) {
      setConnections([])
      setLoading(false)
      return
    }
    try {
      setConnections(await fetchCalendarConnections())
    } catch {
      setConnections([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    const status = Array.isArray(params.calendar) ? params.calendar[0] : params.calendar
    if (!status) return
    const providerRaw = Array.isArray(params.provider) ? params.provider[0] : params.provider
    const providerLabel =
      providerRaw === 'google' || providerRaw === 'microsoft'
        ? calendarProviderLabel(providerRaw)
        : 'Calendar'
    if (status === 'connected') {
      toast.show(`${providerLabel} connected`, {
        tone: 'success',
        message: 'New scheduled meetings will sync automatically.',
      })
      void load()
    } else if (status === 'error') {
      toast.show(`Could not connect ${providerLabel}`, {
        tone: 'danger',
        message: 'Try connecting again from this panel.',
      })
    }
  }, [load, params.calendar, params.provider, toast])

  if (!meetingFeatureFlags.calendarSync) return null

  async function onConnect(provider: CalendarProvider) {
    setBusyProvider(provider)
    try {
      await connectCalendarProvider(provider, redirectTo)
      toast.show(`Continue in ${calendarProviderLabel(provider)}`, {
        tone: 'info',
        message: 'Authorize access, then return here. New meetings sync automatically.',
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Try again later.'
      toast.show(`Could not connect ${calendarProviderLabel(provider)}`, {
        tone: 'danger',
        message: message.includes('not configured')
          ? 'Calendar sync is not configured for this build yet.'
          : message.includes('Could not open')
            ? 'Could not open the authorization page. Check your browser or try again.'
            : message,
      })
    } finally {
      setBusyProvider(null)
    }
  }

  async function onDisconnect(provider: CalendarProvider) {
    setBusyProvider(provider)
    try {
      await revokeCalendarConnection(provider)
      toast.show(`${calendarProviderLabel(provider)} disconnected`, { tone: 'success' })
      await load()
    } catch (error) {
      toast.show(`Could not disconnect ${calendarProviderLabel(provider)}`, {
        tone: 'danger',
        message: error instanceof Error ? error.message : 'Try again later.',
      })
    } finally {
      setBusyProvider(null)
    }
  }

  return (
    <YStack
      gap="$3"
      padding="$4"
      borderRadius={16}
      borderWidth={1}
      borderColor={coworkUi.borderSoft}
      backgroundColor="rgba(255,255,255,0.04)"
    >
      <CoWorkSectionLabel>Calendars</CoWorkSectionLabel>
      <Text fontSize={13} color={coworkUi.textSecondary} lineHeight={18}>
        Connect Google or Outlook to add scheduled meetings automatically. ICS download stays
        available as a fallback.
      </Text>

      {loading ? (
        <XStack alignItems="center" gap="$2">
          <Spinner size="small" />
          <Text fontSize={13} color={coworkUi.textMuted}>
            Loading connections…
          </Text>
        </XStack>
      ) : (
        <YStack gap="$2">
          {PROVIDERS.map((provider) => {
            const connection = connections.find(
              (row) => row.provider === provider && row.status === 'active',
            )
            const busy = busyProvider === provider
            return (
              <XStack
                key={provider}
                alignItems="center"
                justifyContent="space-between"
                gap="$3"
                paddingVertical="$2"
              >
                <YStack flex={1} gap={2}>
                  <Text fontSize={14} fontWeight="700" color={coworkUi.text}>
                    {calendarProviderLabel(provider)}
                  </Text>
                  <Text fontSize={12} color={coworkUi.textMuted} numberOfLines={1}>
                    {connection
                      ? connection.provider_email || 'Connected'
                      : 'Not connected'}
                  </Text>
                </YStack>
                <Button
                  size="$2"
                  borderRadius={999}
                  tone={connection ? 'outline' : 'primary'}
                  disabled={busy}
                  icon={busy ? <Spinner size="small" color="white" /> : undefined}
                  onPress={() =>
                    void (connection ? onDisconnect(provider) : onConnect(provider))
                  }
                >
                  {busy ? 'Working…' : connection ? 'Disconnect' : 'Connect'}
                </Button>
              </XStack>
            )
          })}
        </YStack>
      )}
    </YStack>
  )
}
