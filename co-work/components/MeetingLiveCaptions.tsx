import type { ReactNode } from 'react'
import { Pressable, useWindowDimensions } from 'react-native'

import {
  Icons,
  ScrollView,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectViewport,
  Text,
  XStack,
  YStack,
} from '~/components/ui'
import { formatCaptionTimestamp, type LiveCaptionLine } from '~/co-work/lib/live-captions'
import {
  captionOverlayLayout,
  type CaptionOverlayPlacement,
  type CaptionOverlaySize,
} from '~/co-work/lib/caption-overlay-layout'
import { coworkGlassStyle, useCoWorkTheme } from '~/co-work/lib/theme'
import { isWebRuntime } from '~/lib/platform/capabilities'
import { useAppLayout } from '~/hooks/useAppLayout'

type CaptionLanguageOption = { code: string; label: string }

type MeetingLiveCaptionsProps = {
  active: boolean
  currentCaption: string
  lines: LiveCaptionLine[]
  error?: string | null
  targetLang?: string
  targetLangName?: string
  showingTranslation?: boolean
  availableLanguages?: readonly CaptionLanguageOption[]
  collapsed?: boolean
  size?: CaptionOverlaySize
  placement?: CaptionOverlayPlacement
  presentationSafe?: boolean
  wideLayout?: boolean
  topOffset?: number
  bottomOffset?: number
  sideInset?: number
  onTargetLangChange?: (language: string) => void
  onCollapsedChange?: (collapsed: boolean) => void
  onSizeChange?: (size: CaptionOverlaySize) => void
  onPlacementChange?: (placement: CaptionOverlayPlacement) => void
}

const SIZE_ORDER: CaptionOverlaySize[] = ['compact', 'comfortable', 'large']

export function MeetingLiveCaptions({
  active,
  currentCaption,
  lines,
  error,
  targetLang,
  targetLangName,
  showingTranslation,
  availableLanguages = [],
  collapsed = false,
  size = 'comfortable',
  placement = 'bottom',
  presentationSafe = false,
  wideLayout,
  topOffset,
  bottomOffset,
  sideInset,
  onTargetLangChange,
  onCollapsedChange,
  onSizeChange,
  onPlacementChange,
}: MeetingLiveCaptionsProps) {
  const { ui: coworkUi } = useCoWorkTheme()
  const { width: viewportWidth, height: viewportHeight } = useWindowDimensions()
  const { isDesktop, isTablet } = useAppLayout()
  const effectiveWideLayout = wideLayout ?? (isDesktop || isTablet)

  if (!active && !error) return null

  const recent = lines.filter((line) => line.isFinal).slice(-2)
  const latest = recent[recent.length - 1]
  const layout = captionOverlayLayout({
    size,
    placement,
    viewportWidth,
    viewportHeight,
    presentationSafe,
    wideLayout: effectiveWideLayout,
    bottomOffsetHint: bottomOffset ? bottomOffset + 100 : undefined,
  })
  const sizeIndex = SIZE_ORDER.indexOf(size)
  const canShrink = sizeIndex > 0
  const canGrow = sizeIndex < SIZE_ORDER.length - 1
  const placementProps =
    layout.placement === 'top'
      ? { top: topOffset ?? (presentationSafe ? 88 : 72) }
      : { bottom: bottomOffset ?? (presentationSafe ? 124 : 112) }
  const horizontalInset = sideInset ?? 12

  return (
    <YStack
      position={isWebRuntime() ? ('fixed' as const) : ('absolute' as const)}
      left={horizontalInset}
      right={horizontalInset}
      {...placementProps}
      zIndex={22}
      pointerEvents="box-none"
      alignItems={layout.align}
      gap="$2"
    >
      {error ? (
        <YStack
          maxWidth={layout.maxWidth}
          width="100%"
          paddingHorizontal="$3"
          paddingVertical="$2"
          borderRadius={coworkUi.radius.card}
          backgroundColor={coworkUi.warningMuted}
          borderWidth={1}
          borderColor="rgba(251,191,36,0.35)"
          pointerEvents="none"
        >
          <Text fontSize={12} color={coworkUi.warning}>
            {error}
          </Text>
        </YStack>
      ) : null}

      {active ? (
        <YStack
          width={layout.maxWidth}
          maxWidth="100%"
          maxHeight={collapsed ? 48 : layout.maxHeight}
          paddingHorizontal={collapsed ? '$3' : '$3'}
          paddingVertical={collapsed ? '$2' : '$2.5'}
          borderRadius={16}
          borderWidth={1}
          borderColor="rgba(255,255,255,0.16)"
          backgroundColor="rgba(12, 8, 10, 0.78)"
          style={coworkGlassStyle(coworkUi, true)}
          gap="$2"
          pointerEvents="auto"
        >
          <XStack alignItems="center" justifyContent="space-between" gap="$2">
            <XStack alignItems="center" gap="$2" flex={1} minWidth={0}>
              <YStack width={8} height={8} borderRadius={999} backgroundColor={coworkUi.live} />
              <Text fontSize={10} fontWeight="800" color={coworkUi.brandLight} letterSpacing={1}>
                LIVE CAPTIONS
              </Text>
              {collapsed ? (
                <Text flex={1} fontSize={12} color={coworkUi.text} numberOfLines={1}>
                  {currentCaption || targetLangName || 'On'}
                </Text>
              ) : null}
            </XStack>
            <XStack alignItems="center" gap="$1">
              {!collapsed && onPlacementChange && !presentationSafe ? (
                <CaptionIconButton
                  label={`Move captions to ${layout.placement === 'top' ? 'bottom' : 'top'}`}
                  onPress={() => onPlacementChange(layout.placement === 'top' ? 'bottom' : 'top')}
                >
                  {layout.placement === 'top' ? (
                    <Icons.ChevronDown size={15} color={coworkUi.textSecondary} />
                  ) : (
                    <Icons.ChevronUp size={15} color={coworkUi.textSecondary} />
                  )}
                </CaptionIconButton>
              ) : null}
              <CaptionIconButton
                label={collapsed ? 'Expand captions' : 'Minimize captions'}
                onPress={() => onCollapsedChange?.(!collapsed)}
              >
                {collapsed ? (
                  <Icons.ChevronUp size={15} color={coworkUi.textSecondary} />
                ) : (
                  <Icons.ChevronDown size={15} color={coworkUi.textSecondary} />
                )}
              </CaptionIconButton>
            </XStack>
          </XStack>
          {!collapsed ? (
            <>
              <XStack alignItems="center" justifyContent="space-between" gap="$2" flexWrap="wrap">
                {availableLanguages.length && targetLang && onTargetLangChange ? (
                  <Select value={targetLang} onValueChange={onTargetLangChange}>
                    <SelectTrigger
                      height={32}
                      width={168}
                      paddingHorizontal="$2"
                      iconAfter={<Icons.ChevronDown size={14} color={coworkUi.textMuted} />}
                      accessibilityLabel="Caption language for this viewer only"
                    >
                      <Select.Value placeholder="Language" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectViewport maxHeight={300}>
                        {availableLanguages.map((language, index) => (
                          <SelectItem key={language.code} value={language.code} index={index}>
                            <Select.ItemText>{language.label}</Select.ItemText>
                          </SelectItem>
                        ))}
                      </SelectViewport>
                    </SelectContent>
                  </Select>
                ) : targetLangName ? (
                  <Text fontSize={10} fontWeight="700" color={coworkUi.textMuted}>
                    {targetLangName}
                  </Text>
                ) : null}
                <XStack alignItems="center" gap="$1">
                  <CaptionIconButton
                    label="Make captions smaller"
                    disabled={!canShrink}
                    onPress={() => canShrink && onSizeChange?.(SIZE_ORDER[sizeIndex - 1])}
                  >
                    <Text color={coworkUi.textSecondary} fontWeight="800">−</Text>
                  </CaptionIconButton>
                  <Text minWidth={70} textAlign="center" fontSize={9} color={coworkUi.textMuted}>
                    {showingTranslation || latest?.translated ? 'TRANSLATED' : size.toUpperCase()}
                  </Text>
                  <CaptionIconButton
                    label="Make captions larger"
                    disabled={!canGrow}
                    onPress={() => canGrow && onSizeChange?.(SIZE_ORDER[sizeIndex + 1])}
                  >
                    <Text color={coworkUi.textSecondary} fontWeight="800">+</Text>
                  </CaptionIconButton>
                </XStack>
              </XStack>
              <Text fontSize={10} color={coworkUi.textMuted}>
                Language applies to you only. Other participants keep their own captions.
              </Text>
              <ScrollView style={{ maxHeight: Math.max(44, layout.maxHeight - 108) }}>
                {latest?.speaker ? (
                  <Text fontSize={11} fontWeight="700" color={coworkUi.textSecondary}>
                    {latest.speaker}
                  </Text>
                ) : null}
                <Text
                  fontSize={size === 'compact' ? 14 : 16}
                  fontWeight="700"
                  color="#fff"
                  lineHeight={22}
                >
                  {currentCaption || `Listening · captions in ${targetLangName || 'your language'}…`}
                </Text>
                {latest?.translated && latest.originalText && latest.originalText !== latest.text ? (
                  <Text fontSize={11} color={coworkUi.textMuted} lineHeight={16}>
                    Original: {latest.originalText}
                  </Text>
                ) : null}
                {recent.length > 1 && size !== 'compact' ? (
                  <YStack gap={4} opacity={0.72} marginTop="$2">
                    {recent.slice(0, -1).map((line) => (
                      <Text key={line.id} fontSize={12} color={coworkUi.textSecondary} lineHeight={18}>
                        {line.speaker}: {line.text}
                      </Text>
                    ))}
                  </YStack>
                ) : null}
              </ScrollView>
            </>
          ) : null}
        </YStack>
      ) : null}

      {active && !collapsed && lines.length > 0 ? (
        <Text fontSize={10} color={coworkUi.textMuted}>
          Last update {formatCaptionTimestamp(lines[lines.length - 1]?.timestamp ?? Date.now())}
        </Text>
      ) : null}
    </YStack>
  )
}

function CaptionIconButton({
  label,
  disabled,
  onPress,
  children,
}: {
  label: string
  disabled?: boolean
  onPress: () => void
  children: ReactNode
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      hitSlop={8}
      style={({ pressed }) => ({
        width: 32,
        height: 32,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 8,
        opacity: disabled ? 0.35 : pressed ? 0.6 : 1,
      })}
    >
      {children}
    </Pressable>
  )
}
