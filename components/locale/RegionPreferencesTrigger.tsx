import { useState } from 'react'

import { RegionPreferencesSheet } from '~/components/locale/RegionPreferencesSheet'
import { Icons, Text, XStack } from '~/components/ui'
import { useOptionalRegionPreferences } from '~/lib/locale/RegionPreferencesContext'
import { useAppUi } from '~/lib/theme/useAppUi'

type RegionPreferencesTriggerProps = {
  /** Compact for footers; `footerBar` is for the dark Etsy-style bottom bar. */
  variant?: 'footer' | 'footerBar' | 'row' | 'chip'
}

/**
 * Opens the Etsy-style region sheet. Shows country · language · currency summary.
 */
export function RegionPreferencesTrigger({ variant = 'footer' }: RegionPreferencesTriggerProps) {
  const ui = useAppUi()
  const prefs = useOptionalRegionPreferences()
  const [open, setOpen] = useState(false)

  if (!prefs?.ready) return null

  const isBar = variant === 'footerBar'
  const label =
    variant === 'chip'
      ? `${prefs.currencySymbol} ${prefs.currencyCode}`
      : variant === 'footer' || isBar
        ? `${prefs.countryName} · ${prefs.languageName} · ${prefs.currencySymbol} (${prefs.currencyCode})`
        : prefs.summaryLabel

  const borderColor = isBar ? 'rgba(255, 255, 255, 0.35)' : ui.borderSubtle
  const backgroundColor =
    variant === 'row' ? 'transparent' : isBar ? 'transparent' : ui.surface
  const iconColor = isBar ? 'rgba(255, 255, 255, 0.85)' : ui.textMuted
  const textColor = isBar ? '#ffffff' : ui.text

  return (
    <>
      <XStack
        alignItems="center"
        gap={variant === 'chip' ? 6 : 8}
        paddingHorizontal={variant === 'row' ? 0 : 10}
        paddingVertical={variant === 'row' ? 4 : 8}
        borderRadius={999}
        borderWidth={variant === 'row' ? 0 : 1}
        borderColor={borderColor}
        backgroundColor={backgroundColor}
        pressStyle={{ opacity: 0.85 }}
        cursor="pointer"
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel="Change country, language, and currency"
      >
        <Icons.Globe size={variant === 'chip' ? 14 : 16} color={iconColor} />
        <Text
          fontSize={variant === 'chip' ? 12 : 13}
          fontWeight="600"
          color={textColor}
          numberOfLines={1}
          flexShrink={1}
        >
          {label}
        </Text>
        {variant === 'row' ? <Icons.ChevronRight size={16} color={ui.textMuted} /> : null}
      </XStack>
      <RegionPreferencesSheet open={open} onOpenChange={setOpen} />
    </>
  )
}
