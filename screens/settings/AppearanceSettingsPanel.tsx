import { useState } from 'react'
import { useUserScheme } from '@vxrn/color-scheme'
import { Platform } from 'react-native'

import { RegionPreferencesSheet } from '~/components/locale'
import { Button, Icons, RadioGroup, RadioGroupItemWithLabel, Text, XStack, YStack } from '~/components/ui'
import { SurfaceCard } from '~/components/layout'
import { radius } from '~/config/tokens'
import { ScreenZoomControls } from '~/components/media/ScreenZoomRoot'
import { SettingsPanel } from '~/components/settings/SettingsPanel'
import { useOptionalRegionPreferences } from '~/lib/locale'
import { useAppUi } from '~/lib/theme/useAppUi'
import { useScreenZoom } from '~/lib/zoom/ScreenZoomContext'
import { SCREEN_ZOOM_MAX, SCREEN_ZOOM_MIN } from '~/lib/zoom/zoom-levels'

export function AppearanceSettingsPanel() {
  const ui = useAppUi()
  const scheme = useUserScheme()
  const zoom = useScreenZoom()
  const region = useOptionalRegionPreferences()
  const [regionOpen, setRegionOpen] = useState(false)

  return (
    <SettingsPanel title="Appearance" description="Theme, region, and text size apply on this device">
      <SurfaceCard padding="$4" gap="$3" borderRadius={radius.card}>
        <XStack alignItems="center" gap="$2">
          <Icons.Globe size={18} color={ui.brand} />
          <Text color={ui.text} fontSize={15} fontWeight="700">
            Country, currency & language
          </Text>
        </XStack>
        <Text color={ui.textMuted} fontSize={13} lineHeight={19}>
          Auto-detected from your device. Change anytime — like Etsy&apos;s region settings.
        </Text>
        <Text color={ui.text} fontSize={14} fontWeight="600">
          {region?.ready ? region.summaryLabel : 'Detecting…'}
        </Text>
        <Button
          tone="outline"
          size="$3"
          borderRadius={999}
          alignSelf="flex-start"
          disabled={!region?.ready}
          onPress={() => setRegionOpen(true)}
        >
          Update settings
        </Button>
        <RegionPreferencesSheet open={regionOpen} onOpenChange={setRegionOpen} />
      </SurfaceCard>

      <SurfaceCard padding="$4" gap="$4" borderRadius={radius.card}>
        <Text color={ui.textSecondary} fontSize={14}>
          Theme
        </Text>
        <RadioGroup value={scheme.setting} onValueChange={(v) => scheme.set(v as 'light' | 'dark' | 'system')}>
          <RadioGroupItemWithLabel
            value="light"
            label="Light"
            selected={scheme.setting === 'light'}
            onSelect={() => scheme.set('light')}
          />
          <RadioGroupItemWithLabel
            value="dark"
            label="Dark"
            selected={scheme.setting === 'dark'}
            onSelect={() => scheme.set('dark')}
          />
          <RadioGroupItemWithLabel
            value="system"
            label="Match system"
            selected={scheme.setting === 'system'}
            onSelect={() => scheme.set('system')}
          />
        </RadioGroup>
      </SurfaceCard>

      <SurfaceCard padding="$4" gap="$3" borderRadius={radius.card}>
        <Text color={ui.text} fontSize={15} fontWeight="700">
          Text & screen zoom
        </Text>
        <Text color={ui.textMuted} fontSize={13} lineHeight={19}>
          Tap + repeatedly to enlarge every word on screen (and every image). Works like LinkedIn-style
          display zoom on web. On iOS/Android, use system display size settings for accessibility zoom
          so buttons and switches stay fully tappable.
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
