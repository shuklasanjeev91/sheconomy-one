import { useEffect, useState } from 'react'
import { Text, XStack } from '~/components/ui'
import { useCoWorkTheme } from '~/co-work/lib/theme'

type MeetingElapsedTimerProps = {
  /** ISO string or timestamp from `meeting.started_at` / room join time. */
  startedAt: string | number | null | undefined
  compact?: boolean
}

function formatElapsed(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  const mm = String(m).padStart(2, '0')
  const ss = String(s).padStart(2, '0')
  if (h > 0) return `${h}:${mm}:${ss}`
  return `${mm}:${ss}`
}

/**
 * Live elapsed meeting timer — SHEconomy Co-Work.
 * Shows HH:MM:SS (or MM:SS for meetings under one hour) since the meeting started.
 * Ticks every second. Gracefully handles undefined/null startedAt.
 */
export function MeetingElapsedTimer({ startedAt, compact = false }: MeetingElapsedTimerProps) {
  const { ui: coworkUi } = useCoWorkTheme()

  const getElapsedSeconds = () => {
    if (!startedAt) return 0
    const start = typeof startedAt === 'number' ? startedAt : new Date(startedAt).getTime()
    if (isNaN(start)) return 0
    return Math.max(0, Math.floor((Date.now() - start) / 1000))
  }

  const [elapsed, setElapsed] = useState(getElapsedSeconds)

  useEffect(() => {
    if (!startedAt) return
    const id = setInterval(() => {
      setElapsed(getElapsedSeconds())
    }, 1000)
    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startedAt])

  if (!startedAt) return null

  return (
    <XStack
      alignItems="center"
      paddingHorizontal={compact ? 6 : 8}
      paddingVertical={compact ? 2 : 3}
      borderRadius={6}
      backgroundColor="rgba(255,255,255,0.06)"
      borderWidth={1}
      borderColor="rgba(255,255,255,0.1)"
    >
      <Text
        fontSize={compact ? 11 : 12}
        fontWeight="700"
        color={coworkUi.textMuted}
        letterSpacing={0.5}
        fontVariant={['tabular-nums']}
      >
        {formatElapsed(elapsed)}
      </Text>
    </XStack>
  )
}
