import { useEffect, useState } from 'react'

import { Button, Icons, Spinner, Text, XStack, YStack } from '~/components/ui'
import { useCoWorkTheme } from '~/co-work/lib/theme'

const LONG_WAIT_MS = 90_000

type MeetingWaitingRoomProps = {
  meetingTitle: string
  meetingCode: string
  hostPresent: boolean
  realtimeConnected: boolean
  realtimeDegraded: boolean
  error?: string | null
  onRetry: () => Promise<void>
  onCancel: () => Promise<void>
}

export function MeetingWaitingRoom({
  meetingTitle,
  meetingCode,
  hostPresent,
  realtimeConnected,
  realtimeDegraded,
  error,
  onRetry,
  onCancel,
}: MeetingWaitingRoomProps) {
  const { ui: coworkUi } = useCoWorkTheme()
  const [elapsedMs, setElapsedMs] = useState(0)
  const [action, setAction] = useState<'retry' | 'cancel' | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  useEffect(() => {
    const startedAt = Date.now()
    const timer = setInterval(() => setElapsedMs(Date.now() - startedAt), 1000)
    return () => clearInterval(timer)
  }, [])

  const run = async (next: 'retry' | 'cancel', task: () => Promise<void>) => {
    if (action) return
    setAction(next)
    setActionError(null)
    try {
      await task()
      if (next === 'retry') setElapsedMs(0)
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : 'Please try again.')
    } finally {
      setAction(null)
    }
  }

  const connectionLabel = realtimeConnected
    ? hostPresent
      ? 'Connected to the waiting room'
      : 'Waiting for the host to connect'
    : realtimeDegraded
      ? 'Reconnecting · requests are still checked automatically'
      : 'Connecting to the waiting room…'

  return (
    <YStack
      flex={1}
      width="100%"
      minHeight="100%"
      backgroundColor={coworkUi.pageBg}
      alignItems="center"
      justifyContent="center"
      padding="$5"
    >
      <YStack
        width="100%"
        maxWidth={520}
        padding="$6"
        borderRadius={24}
        backgroundColor={coworkUi.surface}
        borderWidth={1}
        borderColor={coworkUi.borderSoft}
        alignItems="center"
        gap="$4"
      >
        <YStack
          width={64}
          height={64}
          borderRadius={999}
          alignItems="center"
          justifyContent="center"
          backgroundColor={coworkUi.brandMuted}
          borderWidth={1}
          borderColor={coworkUi.borderAccent}
        >
          <Icons.Shield size={28} color={coworkUi.brandLight} />
        </YStack>

        <YStack gap="$2" alignItems="center">
          <Text fontSize={24} fontWeight="800" color={coworkUi.text} textAlign="center">
            Waiting for the host to let you in.
          </Text>
          <Text color={coworkUi.textSecondary} textAlign="center" lineHeight={21}>
            The host has received your request. You’ll enter {meetingTitle} as soon as they admit
            you.
          </Text>
        </YStack>

        <XStack
          alignItems="center"
          gap="$2"
          paddingHorizontal="$3"
          paddingVertical="$2"
          borderRadius={999}
          backgroundColor={realtimeDegraded ? coworkUi.warningMuted : coworkUi.liveMuted}
        >
          {!realtimeConnected && !realtimeDegraded ? (
            <Spinner size="small" color={coworkUi.brand} />
          ) : (
            <YStack
              width={8}
              height={8}
              borderRadius={999}
              backgroundColor={realtimeDegraded ? coworkUi.warning : hostPresent ? coworkUi.live : coworkUi.textMuted}
            />
          )}
          <Text
            fontSize={12}
            fontWeight="700"
            color={realtimeDegraded ? coworkUi.warning : coworkUi.textSecondary}
          >
            {connectionLabel}
          </Text>
        </XStack>

        {!hostPresent && realtimeConnected ? (
          <Text color={coworkUi.textMuted} textAlign="center" fontSize={13}>
            The host may have disconnected. This screen will update automatically when they return.
          </Text>
        ) : null}

        {elapsedMs >= LONG_WAIT_MS ? (
          <YStack
            width="100%"
            padding="$3"
            gap="$2"
            borderRadius={14}
            backgroundColor={coworkUi.warningMuted}
            borderWidth={1}
            borderColor={coworkUi.borderSoft}
          >
            <Text color={coworkUi.warning} fontWeight="700" textAlign="center">
              Still waiting?
            </Text>
            <Text color={coworkUi.textSecondary} fontSize={12} textAlign="center">
              Send the request again or leave the waiting room. You won’t remain on an indefinite
              loading screen.
            </Text>
          </YStack>
        ) : null}

        {error || actionError ? (
          <Text color={coworkUi.danger} fontSize={13} textAlign="center">
            {actionError ?? error}
          </Text>
        ) : null}

        <Text color={coworkUi.textMuted} fontSize={12}>
          Meeting ID: {meetingCode}
        </Text>

        <XStack width="100%" gap="$3" justifyContent="center" flexWrap="wrap">
          <Button
            tone="primary"
            size="$3"
            borderRadius={999}
            disabled={!!action}
            icon={action === 'retry' ? <Spinner size="small" /> : <Icons.RefreshCw size={16} />}
            onPress={() => void run('retry', onRetry)}
          >
            Send request again
          </Button>
          <Button
            tone="outline"
            size="$3"
            borderRadius={999}
            disabled={!!action}
            onPress={() => void run('cancel', onCancel)}
          >
            {action === 'cancel' ? 'Leaving…' : 'Cancel and go back'}
          </Button>
        </XStack>
      </YStack>
    </YStack>
  )
}
