import { useEffect, useState } from 'react'

import { Button, Icons, Spinner, Text, XStack, YStack } from '~/components/ui'
import { MeetingAudioTestModal } from '~/co-work/components/MeetingAudioTestModal'
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
  const [showAudioTest, setShowAudioTest] = useState(false)

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
      ? 'Waiting room connected'
      : 'Waiting for host to join'
    : realtimeDegraded
      ? 'Reconnecting to waiting room…'
      : 'Connecting to waiting room…'

  return (
    <YStack
      flex={1}
      width="100%"
      minHeight="100%"
      backgroundColor="#0c080a"
      alignItems="center"
      justifyContent="center"
      padding="$5"
    >
      {/* Zoom Centered Waiting Box */}
      <YStack
        width="100%"
        maxWidth="100%"
        padding="$6"
        borderRadius={20}
        backgroundColor="rgba(22, 18, 24, 0.96)"
        borderWidth={1}
        borderColor="rgba(255, 255, 255, 0.12)"
        alignItems="center"
        gap="$4"
        style={{
          boxShadow: '0 24px 64px rgba(0, 0, 0, 0.7)',
        }}
      >
        {/* Pulsing indicator */}
        <YStack
          width={64}
          height={64}
          borderRadius={999}
          alignItems="center"
          justifyContent="center"
          backgroundColor="rgba(224, 30, 90, 0.12)"
          borderWidth={1}
          borderColor="rgba(224, 30, 90, 0.3)"
        >
          <Spinner size="large" color={coworkUi.brand} />
        </YStack>

        <YStack gap="$2" alignItems="center">
          <Text fontSize={22} fontWeight="800" color="#ffffff" textAlign="center" letterSpacing={-0.3}>
            Please wait, the meeting host will let you in soon.
          </Text>
          <Text color={coworkUi.brandLight} fontSize={16} fontWeight="700" textAlign="center">
            {meetingTitle}
          </Text>
        </YStack>

        {/* Connection status pill */}
        <XStack
          alignItems="center"
          gap="$2"
          paddingHorizontal="$3"
          paddingVertical="$1.5"
          borderRadius={999}
          backgroundColor="rgba(255, 255, 255, 0.06)"
          borderWidth={1}
          borderColor="rgba(255, 255, 255, 0.1)"
        >
          <YStack
            width={8}
            height={8}
            borderRadius={999}
            backgroundColor={realtimeDegraded ? '#F59E0B' : hostPresent ? '#10B981' : '#E01E5A'}
          />
          <Text fontSize={12} fontWeight="600" color={coworkUi.textSecondary}>
            {connectionLabel}
          </Text>
        </XStack>

        {elapsedMs >= LONG_WAIT_MS ? (
          <YStack
            width="100%"
            padding="$3"
            gap="$1.5"
            borderRadius={10}
            backgroundColor="rgba(245, 158, 11, 0.1)"
            borderWidth={1}
            borderColor="rgba(245, 158, 11, 0.25)"
          >
            <Text color="#F59E0B" fontWeight="700" fontSize={13} textAlign="center">
              Still waiting?
            </Text>
            <Text color={coworkUi.textSecondary} fontSize={12} textAlign="center">
              The host may be wrapping up. You can send the request again or leave.
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

        {/* Zoom Waiting Room Action Buttons */}
        <YStack width="100%" gap="$2.5" paddingTop="$2">
          {/* Test Computer Audio Button */}
          <Button
            tone="outline"
            size="$4"
            borderRadius={10}
            borderColor="rgba(255, 255, 255, 0.16)"
            backgroundColor="rgba(255, 255, 255, 0.05)"
            icon={<Icons.Volume2 size={17} color="#fff" />}
            onPress={() => setShowAudioTest(true)}
          >
            <Text fontSize={14} fontWeight="700" color="#fff">
              Test Computer Audio
            </Text>
          </Button>

          <XStack width="100%" gap="$2.5">
            <Button
              flex={1}
              tone="outline"
              size="$4"
              borderRadius={10}
              disabled={!!action}
              borderColor="rgba(255, 255, 255, 0.16)"
              backgroundColor="rgba(255, 255, 255, 0.05)"
              icon={action === 'retry' ? <Spinner size="small" /> : <Icons.RefreshCw size={15} color="#fff" />}
              onPress={() => void run('retry', onRetry)}
            >
              <Text fontSize={13} fontWeight="600" color="#fff">
                Send Again
              </Text>
            </Button>

            <Button
              flex={1}
              tone="outline"
              size="$4"
              borderRadius={10}
              disabled={!!action}
              borderColor="rgba(239, 68, 68, 0.3)"
              backgroundColor="rgba(239, 68, 68, 0.08)"
              onPress={() => void run('cancel', onCancel)}
            >
              <Text fontSize={13} fontWeight="600" color="#EF4444">
                {action === 'cancel' ? 'Leaving…' : 'Leave Meeting'}
              </Text>
            </Button>
          </XStack>
        </YStack>
      </YStack>

      {/* Interactive Audio Test Modal */}
      {showAudioTest ? (
        <MeetingAudioTestModal
          open={showAudioTest}
          onOpenChange={setShowAudioTest}
          onClose={() => setShowAudioTest(false)}
        />
      ) : null}
    </YStack>
  )
}
