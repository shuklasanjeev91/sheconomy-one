import type { ReactNode } from 'react'
import { useState } from 'react'
import { Pressable, useWindowDimensions } from 'react-native'

import {
  Icons,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectViewport,
  Text,
  XStack,
  YStack,
} from '~/components/ui'
import { type LiveCaptionLine } from '~/co-work/lib/live-captions'
import {
  captionOverlayLayout,
  type CaptionOverlayPlacement,
  type CaptionOverlaySize,
} from '~/co-work/lib/caption-overlay-layout'
import { MEETING_CAPTIONS_Z_INDEX } from '~/co-work/lib/meeting-toolbar'
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

/** Zoom-style caption chrome: always dark + white text over video. */
const CAPTION_SURFACE = 'rgba(0, 0, 0, 0.82)'
const CAPTION_BORDER = 'rgba(255, 255, 255, 0.22)'
const CAPTION_TEXT = '#ffffff'
const CAPTION_TEXT_MUTED = 'rgba(255, 255, 255, 0.72)'
const CAPTION_SPEAKER = '#f9a8d4'

const FONT_BY_SIZE: Record<CaptionOverlaySize, { body: number; speaker: number; status: number }> = {
  compact: { body: 15, speaker: 11, status: 11 },
  comfortable: { body: 18, speaker: 12, status: 12 },
  large: { body: 22, speaker: 13, status: 13 },
}

export function MeetingLiveCaptions({
  active,
  currentCaption,
  lines,
  error,
  targetLang,
  targetLangName,
  showingTranslation: _showingTranslation,
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
  const [settingsOpen, setSettingsOpen] = useState(false)
  const { width: viewportWidth, height: viewportHeight } = useWindowDimensions()
  const { isDesktop, isTablet } = useAppLayout()
  const effectiveWideLayout = wideLayout ?? (isDesktop || isTablet)
  const layout = captionOverlayLayout({
    size,
    placement,
    viewportWidth,
    viewportHeight,
    presentationSafe,
    wideLayout: effectiveWideLayout,
    bottomOffsetHint: bottomOffset,
  })
  const fonts = FONT_BY_SIZE[size]
  const sizeIndex = SIZE_ORDER.indexOf(size)
  const canShrink = sizeIndex > 0
  const canGrow = sizeIndex < SIZE_ORDER.length - 1
  const placementProps =
    layout.placement === 'top'
      ? { top: topOffset ?? (presentationSafe ? 88 : 72) }
      : { bottom: bottomOffset ?? (presentationSafe ? 124 : 112) }
  const horizontalInset = sideInset ?? 12
  const showSettings = !collapsed && settingsOpen
  const finalLines = lines.filter((line) => line.isFinal && line.text.trim()).slice(-3)
  const latestFinal = finalLines[finalLines.length - 1]
  const liveText = currentCaption.trim()
  const liveIsNew =
    !!liveText &&
    liveText !== '…' &&
    liveText !== latestFinal?.text?.trim()
  const hasBody = finalLines.length > 0 || liveIsNew

  if (!active && !error) return null

  return (
    <YStack
      position="absolute"
      left={horizontalInset}
      right={horizontalInset}
      {...placementProps}
      zIndex={MEETING_CAPTIONS_Z_INDEX}
      elevation={MEETING_CAPTIONS_Z_INDEX}
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
          borderRadius={14}
          backgroundColor="rgba(120, 53, 15, 0.92)"
          borderWidth={1}
          borderColor="rgba(251, 191, 36, 0.45)"
          pointerEvents="none"
        >
          <Text fontSize={13} fontWeight="600" color="#fde68a">
            {error}
          </Text>
        </YStack>
      ) : null}

      {active ? (
        <YStack
          width={layout.maxWidth}
          maxWidth="100%"
          maxHeight={collapsed ? 52 : layout.maxHeight}
          paddingHorizontal={collapsed ? '$3' : '$3.5'}
          paddingVertical={collapsed ? '$2' : '$3'}
          borderRadius={14}
          borderWidth={1}
          borderColor={CAPTION_BORDER}
          backgroundColor={CAPTION_SURFACE}
          gap="$1.5"
          pointerEvents="auto"
          overflow="hidden"
        >
          <XStack alignItems="center" justifyContent="space-between" gap="$2">
            <Text
              flex={1}
              fontSize={fonts.status}
              fontWeight="700"
              color={CAPTION_TEXT_MUTED}
              numberOfLines={1}
            >
              {collapsed
                ? liveText || latestFinal?.text || targetLangName || 'Captions on'
                : `CC · ${targetLangName || 'Captions'}`}
            </Text>
            <XStack alignItems="center" gap="$1">
              {!collapsed ? (
                <CaptionIconButton
                  label={settingsOpen ? 'Hide caption settings' : 'Caption settings'}
                  onPress={() => setSettingsOpen((open) => !open)}
                >
                  <Icons.Settings size={15} color={CAPTION_TEXT_MUTED} />
                </CaptionIconButton>
              ) : null}
              <CaptionIconButton
                label={collapsed ? 'Expand captions' : 'Minimize captions'}
                onPress={() => onCollapsedChange?.(!collapsed)}
              >
                {collapsed ? (
                  <Icons.ChevronUp size={15} color={CAPTION_TEXT_MUTED} />
                ) : (
                  <Icons.ChevronDown size={15} color={CAPTION_TEXT_MUTED} />
                )}
              </CaptionIconButton>
            </XStack>
          </XStack>

          {!collapsed ? (
            hasBody ? (
              <YStack gap="$2" width="100%">
                {finalLines.map((line) => (
                  <CaptionLineRow
                    key={line.id}
                    speaker={line.speaker}
                    text={line.text}
                    fonts={fonts}
                  />
                ))}
                {liveIsNew ? (
                  <CaptionLineRow
                    speaker={latestFinal?.speaker || 'You'}
                    text={liveText}
                    fonts={fonts}
                    live
                  />
                ) : null}
              </YStack>
            ) : (
              <Text fontSize={fonts.body} fontWeight="600" color={CAPTION_TEXT} opacity={0.85}>
                Listening… speak to caption
              </Text>
            )
          ) : null}

          {showSettings ? (
            <>
              <XStack alignItems="center" justifyContent="space-between" gap="$2" flexWrap="wrap" marginTop="$1">
                {availableLanguages.length && targetLang && onTargetLangChange ? (
                  <Select value={targetLang} onValueChange={onTargetLangChange}>
                    <SelectTrigger
                      height={32}
                      width={168}
                      paddingHorizontal="$2"
                      backgroundColor="rgba(255,255,255,0.12)"
                      borderColor="rgba(255,255,255,0.2)"
                      iconAfter={<Icons.ChevronDown size={14} color={CAPTION_TEXT_MUTED} />}
                      accessibilityLabel="Caption language — listening and display for you only"
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
                  <Text fontSize={11} fontWeight="700" color={CAPTION_TEXT_MUTED}>
                    {targetLangName}
                  </Text>
                ) : null}
                <XStack alignItems="center" gap="$1">
                  {onPlacementChange && !presentationSafe ? (
                    <CaptionIconButton
                      label={`Move captions to ${layout.placement === 'top' ? 'bottom' : 'top'}`}
                      onPress={() => onPlacementChange(layout.placement === 'top' ? 'bottom' : 'top')}
                    >
                      {layout.placement === 'top' ? (
                        <Icons.ChevronDown size={15} color={CAPTION_TEXT_MUTED} />
                      ) : (
                        <Icons.ChevronUp size={15} color={CAPTION_TEXT_MUTED} />
                      )}
                    </CaptionIconButton>
                  ) : null}
                  <CaptionIconButton
                    label="Make captions smaller"
                    disabled={!canShrink}
                    onPress={() => canShrink && onSizeChange?.(SIZE_ORDER[sizeIndex - 1])}
                  >
                    <Text color={CAPTION_TEXT_MUTED} fontWeight="800">
                      −
                    </Text>
                  </CaptionIconButton>
                  <CaptionIconButton
                    label="Make captions larger"
                    disabled={!canGrow}
                    onPress={() => canGrow && onSizeChange?.(SIZE_ORDER[sizeIndex + 1])}
                  >
                    <Text color={CAPTION_TEXT_MUTED} fontWeight="800">
                      +
                    </Text>
                  </CaptionIconButton>
                </XStack>
              </XStack>
              <Text fontSize={10} color={CAPTION_TEXT_MUTED}>
                Language applies to you only.
              </Text>
            </>
          ) : null}
        </YStack>
      ) : null}
    </YStack>
  )
}

function CaptionLineRow({
  speaker,
  text,
  fonts,
  live = false,
}: {
  speaker?: string
  text: string
  fonts: { body: number; speaker: number; status: number }
  live?: boolean
}) {
  return (
    <YStack width="100%" gap={2}>
      {speaker ? (
        <Text fontSize={fonts.speaker} fontWeight="800" color={CAPTION_SPEAKER} numberOfLines={1}>
          {speaker}
        </Text>
      ) : null}
      <Text
        fontSize={fonts.body}
        fontWeight={live ? '700' : '600'}
        color={CAPTION_TEXT}
        lineHeight={fonts.body + 6}
        style={{
          textShadowColor: 'rgba(0,0,0,0.55)',
          textShadowOffset: { width: 0, height: 1 },
          textShadowRadius: 3,
        }}
      >
        {text}
      </Text>
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
        backgroundColor: pressed ? 'rgba(255,255,255,0.12)' : 'transparent',
        opacity: disabled ? 0.35 : 1,
      })}
    >
      {children}
    </Pressable>
  )
}
