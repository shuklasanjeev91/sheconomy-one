import { useEffect, useRef, useState } from 'react'
import { Platform } from 'react-native'

import { Button, Icons, Text, XStack, YStack } from '~/components/ui'
import { useCoWorkTheme } from '~/co-work/lib/theme'

export function MeetingOpenInApp({ meetingCode }: { meetingCode: string }) {
  const { ui: coworkUi } = useCoWorkTheme()
  const [dismissed, setDismissed] = useState(false)
  const [attempted, setAttempted] = useState(false)
  const [installed, setInstalled] = useState<boolean | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    },
    [],
  )

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof navigator === 'undefined') return
    const relatedApps = (
      navigator as Navigator & {
        getInstalledRelatedApps?: () => Promise<Array<{ id?: string; platform?: string }>>
      }
    ).getInstalledRelatedApps
    if (!relatedApps) return
    let cancelled = false
    void relatedApps
      .call(navigator)
      .then((apps) => {
        if (!cancelled) {
          setInstalled(apps.some((app) => app.id === 'com.sheconomy.ecommerce'))
        }
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  if (Platform.OS !== 'web' || dismissed) return null

  const openApp = () => {
    if (typeof window === 'undefined') return
    setAttempted(true)
    const code = encodeURIComponent(meetingCode.replace(/\s/g, ''))
    window.location.href = `sheconomy://cowork/meeting/${code}`
    timerRef.current = setTimeout(() => setAttempted(true), 1400)
  }

  return (
    <YStack
      gap="$3"
      padding="$4"
      borderRadius={18}
      backgroundColor={coworkUi.brandMuted}
      borderWidth={1}
      borderColor={coworkUi.borderAccent}
    >
      <XStack gap="$3" alignItems="center">
        <Icons.Smartphone size={22} color={coworkUi.brandLight} />
        <YStack flex={1} gap={2}>
          <Text fontWeight="800" color={coworkUi.text}>
            {installed ? 'Sheconomy is installed' : 'Join in the Sheconomy app'}
          </Text>
          <Text fontSize={12} color={coworkUi.textSecondary}>
            If the app is installed, it can open this meeting directly.
          </Text>
        </YStack>
      </XStack>
      <XStack gap="$2" flexWrap="wrap">
        <Button tone="primary" borderRadius={999} onPress={openApp}>
          Open in Sheconomy
        </Button>
        <Button tone="outline" borderRadius={999} onPress={() => setDismissed(true)}>
          Continue in Browser
        </Button>
      </XStack>
      {attempted ? (
        <Text fontSize={11} color={coworkUi.textMuted}>
          App did not open? Continue in Browser to join here.
        </Text>
      ) : null}
    </YStack>
  )
}
