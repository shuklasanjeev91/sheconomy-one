import { useEffect, useRef, useState } from 'react'
import { Linking, Platform } from 'react-native'

import { Button, Icons, Text, XStack, YStack } from '~/components/ui'
import { useCoWorkTheme } from '~/co-work/lib/theme'
import {
  ANDROID_PACKAGE_ID,
  ANDROID_PLAY_STORE_URL,
  IOS_APP_STORE_URL,
  buildAndroidAutoIntentUrl,
  buildAndroidIntentUrl,
  buildOpenInAppSchemeUrl,
  launchNativeApp,
  readAppInstalledHint,
} from '~/lib/platform/open-in-app'
import { detectMobileDevice, isInAppBrowser } from '~/lib/utils/mobile-detection'

const HANDOFF_KEY = 'sheconomy.meetingHandoff.'

function readHandoffDone(code: string): boolean {
  try {
    return window.sessionStorage.getItem(HANDOFF_KEY + code) === '1'
  } catch {
    return false
  }
}

function markHandoffDone(code: string) {
  try {
    window.sessionStorage.setItem(HANDOFF_KEY + code, '1')
  } catch {
    // ignore storage failures
  }
}

/**
 * Mobile-web bridge for meeting links the OS did not route into the app (typed or
 * pasted URLs, in-app browsers, old apex links). Opens the installed app straight
 * away wherever a missing app cannot raise an error, once per meeting per browser
 * session so coming back to the browser never bounces the user again.
 */
export function MeetingOpenInApp({ meetingCode }: { meetingCode: string }) {
  const { ui: coworkUi } = useCoWorkTheme()
  const code = meetingCode.replace(/\s/g, '')
  const meetingPath = `/co-work/meeting/${encodeURIComponent(code)}`
  const [device] = useState(() =>
    Platform.OS === 'web' ? detectMobileDevice() : null,
  )
  const mobileWeb = !!device && device.isMobile && (device.isAndroid || device.isIOS)
  const [installed, setInstalled] = useState<boolean | null>(() =>
    mobileWeb ? readAppInstalledHint() : null,
  )
  const [dismissed, setDismissed] = useState(false)
  const [opening, setOpening] = useState(false)
  const [missed, setMissed] = useState(false)
  const autoTriedRef = useRef(false)

  useEffect(() => {
    if (!mobileWeb || typeof navigator === 'undefined') return
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
        if (!cancelled && apps.some((app) => app.id === ANDROID_PACKAGE_ID)) setInstalled(true)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [mobileWeb])

  useEffect(() => {
    if (!mobileWeb || !device || !code || autoTriedRef.current) return
    // iOS Safari shows "address is invalid" for a missing app, so it only tries
    // automatically once a previous hand-off proved the app is installed.
    if (!(device.isAndroid || isInAppBrowser() || installed === true)) return
    if (readHandoffDone(code)) return

    autoTriedRef.current = true
    markHandoffDone(code)
    setOpening(true)
    launchNativeApp(
      device.isAndroid ? buildAndroidAutoIntentUrl(meetingPath) : buildOpenInAppSchemeUrl(meetingPath),
      {
        automatic: true,
        onResult: (opened) => {
          setOpening(false)
          if (!opened) {
            setMissed(true)
            setInstalled(false)
          }
        },
      },
    )
  }, [code, device, installed, meetingPath, mobileWeb])

  if (!mobileWeb || !device || dismissed) return null

  const openApp = () => {
    markHandoffDone(code)
    setOpening(true)
    launchNativeApp(
      device.isAndroid ? buildAndroidIntentUrl(meetingPath) : buildOpenInAppSchemeUrl(meetingPath),
      {
        onResult: (opened) => {
          setOpening(false)
          if (opened) setInstalled(true)
          else setMissed(true)
        },
      },
    )
  }

  const continueInBrowser = () => {
    markHandoffDone(code)
    setDismissed(true)
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
            {opening
              ? 'Opening the Sheconomy app…'
              : installed
                ? 'Join in the Sheconomy app'
                : 'Join faster in the Sheconomy app'}
          </Text>
          <Text fontSize={12} color={coworkUi.textSecondary}>
            {missed
              ? "The app didn't open. Install it, or continue here in the browser."
              : 'Opens this meeting in the app when it is installed.'}
          </Text>
        </YStack>
      </XStack>
      <XStack gap="$2" flexWrap="wrap">
        <Button tone="primary" borderRadius={999} onPress={openApp} disabled={opening}>
          Open in Sheconomy
        </Button>
        {missed ? (
          <Button
            tone="outline"
            borderRadius={999}
            onPress={() => void Linking.openURL(device.isAndroid ? ANDROID_PLAY_STORE_URL : IOS_APP_STORE_URL)}
          >
            Get the app
          </Button>
        ) : null}
        <Button tone="outline" borderRadius={999} onPress={continueInBrowser}>
          Continue in Browser
        </Button>
      </XStack>
    </YStack>
  )
}
