import { useUserScheme } from '@vxrn/color-scheme'
import { Platform } from 'react-native'

import { RadioGroup, RadioGroupItemWithLabel, Text, XStack, YStack } from '~/components/ui'
import { SurfaceCard } from '~/components/layout'
import { radius } from '~/config/tokens'
import { ScreenZoomControls } from '~/components/media/ScreenZoomRoot'
import { SettingsPanel } from '~/components/settings/SettingsPanel'
import { useAppUi } from '~/lib/theme/useAppUi'
import { useScreenZoom } from '~/lib/zoom/ScreenZoomContext'
import { SCREEN_ZOOM_MAX, SCREEN_ZOOM_MIN } from '~/lib/zoom/zoom-levels'

export function AppearanceSettingsPanel() {
  const ui = useAppUi()
  const scheme = useUserScheme()
  const zoom = useScreenZoom()

  return (
    <SettingsPanel title="Appearance" description="Theme and text size apply on this device">
      <SurfaceCard padding="$4" gap="$4" borderRadius={radius.card}>
        <Text color={ui.textSecondary} fontSize={14}>
          Theme
        </Text>
        <RadioGroup value={scheme.setting} onValueChange={(v) => scheme.set(v as 'light' | 'dark' | 'system')}>
          <RadioGroupItemWithLabel value="light" label="Light" />
          <RadioGroupItemWithLabel value="dark" label="Dark" />
          <RadioGroupItemWithLabel value="system" label="Match system" />
        </RadioGroup>
      </SurfaceCard>

      <SurfaceCard padding="$4" gap="$3" borderRadius={radius.card}>
        <Text color={ui.text} fontSize={15} fontWeight="700">
          Text & screen zoom
        </Text>
        <Text color={ui.textMuted} fontSize={13} lineHeight={19}>
          Tap + repeatedly to enlarge every word on screen (and every image). Works like LinkedIn-style
          display zoom — not a single jump.
        </Text>
        <XStack alignItems="center" justifyContent="space-between" gap="$3" flexWrap="wrap">
          <YStack gap="$1" flex={1} minWidth={140}>
            <Text color={ui.textSecondary} fontSize={12} fontWeight="600">
              Current size
            </Text>
            <Text color={ui.text} fontSize={22} fontWeight="800">
              {zoom.percentLabel}
            </Text>
            <Text color={ui.textMuted} fontSize={12}>
              {Math.round(SCREEN_ZOOM_MIN * 100)}% – {Math.round(SCREEN_ZOOM_MAX * 100)}%
            </Text>
          </YStack>
          <ScreenZoomControls tone="light" />
        </XStack>
        {Platform.OS === 'web' ? (
          <Text color={ui.textMuted} fontSize={12}>
            Tip: you can also use browser zoom (Ctrl/Cmd and + / −) for an extra boost.
          </Text>
        ) : null}
      </SurfaceCard>
    </SettingsPanel>
  )
}
