import type { ReactNode } from 'react'
import { useMemo, useRef, useState } from 'react'
import {
  PanResponder,
  Platform,
  ScrollView,
  StyleSheet,
  Text as RNText,
  View,
  useWindowDimensions
} from 'react-native'
import { RnPressable as Pressable } from '~/co-work/components/RnPressable'

import { Icons } from '~/components/ui'
import { captionLooksLikeTargetLang } from '~/co-work/lib/caption-translate'
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
  liveSpeaker?: string
  lines: LiveCaptionLine[]
  error?: string | null
  targetLang?: string
  targetLangName?: string
  spokenLang?: string
  spokenLangName?: string
  showingTranslation?: boolean
  availableLanguages?: readonly CaptionLanguageOption[]
  collapsed?: boolean
  size?: CaptionOverlaySize
  placement?: CaptionOverlayPlacement
  offsetX?: number
  offsetY?: number
  presentationSafe?: boolean
  wideLayout?: boolean
  topOffset?: number
  bottomOffset?: number
  sideInset?: number
  /** Extra inset on the trailing edge when a Zoom-web side panel is open. */
  trailingInset?: number
  onTargetLangChange?: (language: string) => void
  onSpokenLangChange?: (language: string) => void
  onCollapsedChange?: (collapsed: boolean) => void
  onSizeChange?: (size: CaptionOverlaySize) => void
  onPlacementChange?: (placement: CaptionOverlayPlacement) => void
  onOffsetChange?: (offsetX: number, offsetY: number) => void
}

const SIZE_ORDER: CaptionOverlaySize[] = ['compact', 'comfortable', 'large']

const FONT_BY_SIZE: Record<CaptionOverlaySize, { body: number; speaker: number; status: number }> = {
  compact: { body: 17, speaker: 12, status: 13 },
  comfortable: { body: 21, speaker: 13, status: 14 },
  large: { body: 26, speaker: 14, status: 15 },
}

/** Opaque Sheconomy caption overlay — never translucent (iPad washed translucent black to white). */
const CAPTION_BG = '#0c080a'
const CAPTION_BORDER = '#D81B60'
const CAPTION_TEXT = '#FFFFFF'
const CAPTION_MUTED = '#FCE7F3'
const CAPTION_SPEAKER = '#F9A8D4'

/**
 * Zoom-style captions for web + iOS + Android.
 * Draggable overlay; shows only the latest live line (replaces previous).
 */
export function MeetingLiveCaptions({
  active,
  currentCaption,
  liveSpeaker,
  lines,
  error,
  targetLang,
  targetLangName,
  spokenLang = 'auto',
  spokenLangName,
  showingTranslation: _showingTranslation,
  availableLanguages = [],
  collapsed = false,
  size = 'comfortable',
  placement = 'bottom',
  offsetX = 0,
  offsetY = 0,
  presentationSafe = false,
  wideLayout,
  topOffset,
  bottomOffset,
  sideInset,
  trailingInset = 0,
  onTargetLangChange,
  onSpokenLangChange,
  onCollapsedChange,
  onSizeChange,
  onPlacementChange,
  onOffsetChange,
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
  const baseTop = layout.placement === 'top' ? topOffset ?? (presentationSafe ? 96 : 72) : undefined
  const baseBottom =
    layout.placement === 'bottom' ? bottomOffset ?? (presentationSafe ? 140 : 112) : undefined
  const horizontalInset = sideInset ?? 12
  const trailingEdgeInset = horizontalInset + Math.max(0, trailingInset)
  const showSettings = !collapsed && settingsOpen

  // Free-drag: horizontal always; vertical shifts top or bottom anchor.
  const dragX = offsetX
  const dragY = offsetY
  const offsetRef = useRef({ x: dragX, y: dragY })
  offsetRef.current = { x: dragX, y: dragY }
  const grantRef = useRef({ x: 0, y: 0 })
  const onOffsetChangeRef = useRef(onOffsetChange)
  onOffsetChangeRef.current = onOffsetChange
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_evt, gesture) =>
        Math.abs(gesture.dx) > 6 || Math.abs(gesture.dy) > 6,
      onPanResponderGrant: () => {
        grantRef.current = { ...offsetRef.current }
      },
      onPanResponderMove: (_evt, gesture) => {
        onOffsetChangeRef.current?.(
          grantRef.current.x + gesture.dx,
          grantRef.current.y + gesture.dy,
        )
      },
      onPanResponderRelease: (_evt, gesture) => {
        onOffsetChangeRef.current?.(
          Math.round(grantRef.current.x + gesture.dx),
          Math.round(grantRef.current.y + gesture.dy),
        )
      },
      onPanResponderTerminate: (_evt, gesture) => {
        onOffsetChangeRef.current?.(
          Math.round(grantRef.current.x + gesture.dx),
          Math.round(grantRef.current.y + gesture.dy),
        )
      },
    }),
  ).current

  // Only the latest line — never stack previous captions. Prefer translated/currentCaption.
  const latestFinal = useMemo(() => {
    const finals = lines.filter((line) => line.isFinal && line.text.trim())
    return finals.length > 0 ? finals[finals.length - 1] : null
  }, [lines])
  const liveText = currentCaption.trim()
  const fallbackFinal =
    latestFinal &&
    (!targetLang ||
      latestFinal.translated ||
      captionLooksLikeTargetLang(latestFinal.text, targetLang))
      ? latestFinal.text.trim()
      : ''
  const displayText = liveText || fallbackFinal
  // Hold the last non-empty line so STT gaps do not flash "Listening…"
  const stickyCaptionRef = useRef('')
  if (displayText) stickyCaptionRef.current = displayText
  if (!active) stickyCaptionRef.current = ''
  const stableText = displayText || stickyCaptionRef.current
  const displaySpeaker =
    liveSpeaker ||
    lines.find((line) => !line.isFinal)?.speaker ||
    latestFinal?.speaker ||
    'Speaking'
  const hasBody = !!stableText && stableText !== '…'

  if (!active && !error) return null

  const positionStyle =
    layout.placement === 'top'
      ? {
          top: (baseTop ?? 72) + dragY,
          bottom: undefined as number | undefined,
        }
      : {
          bottom: Math.max(8, (baseBottom ?? 112) - dragY),
          top: undefined as number | undefined,
        }

  return (
    <View
      pointerEvents="box-none"
      style={[
        styles.wrap,
        {
          left: Math.max(4, horizontalInset + dragX),
          right: Math.max(4, trailingEdgeInset - Math.min(0, dragX)),
          ...positionStyle,
          zIndex: MEETING_CAPTIONS_Z_INDEX,
          elevation: MEETING_CAPTIONS_Z_INDEX,
          alignItems:
            layout.align === 'flex-start'
              ? 'flex-start'
              : layout.align === 'flex-end'
                ? 'flex-end'
                : 'center',
        },
      ]}
    >
      {error ? (
        <View style={[styles.errorBanner, { maxWidth: layout.maxWidth }]}>
          <RNText style={styles.errorText}>{error}</RNText>
        </View>
      ) : null}

      {active ? (
        <View
          style={[
            styles.surface,
            {
              width: layout.maxWidth,
              maxHeight: showSettings
                ? Math.min(Math.round(viewportHeight * 0.62), Math.max(layout.maxHeight, 420))
                : collapsed
                  ? 58
                  : Math.min(layout.maxHeight, 160),
              paddingVertical: collapsed ? 10 : 14,
              transform: [{ translateX: 0 }],
            },
          ]}
          pointerEvents="auto"
          collapsable={false}
        >
          <View style={styles.header}>
            <View
              style={styles.dragHandle}
              accessibilityLabel="Drag to move captions"
              {...panResponder.panHandlers}
            >
              <RNText
                style={[styles.status, { fontSize: fonts.status }]}
                numberOfLines={1}
                allowFontScaling
              >
                {collapsed
                  ? stableText || `CC · ${targetLangName || 'On'}`
                  : `CC · ${targetLangName || 'Captions'} · Drag`}
              </RNText>
            </View>
            <View style={styles.headerActions}>
              {!collapsed ? (
                <CaptionIconButton
                  label={settingsOpen ? 'Hide caption settings' : 'Caption settings'}
                  selected={settingsOpen}
                  onPress={() => setSettingsOpen((open) => !open)}
                >
                  <Icons.Settings size={16} color={CAPTION_MUTED} />
                </CaptionIconButton>
              ) : null}
              <CaptionIconButton
                label={collapsed ? 'Expand captions' : 'Minimize captions'}
                onPress={() => onCollapsedChange?.(!collapsed)}
              >
                {collapsed ? (
                  <Icons.ChevronUp size={16} color={CAPTION_MUTED} />
                ) : (
                  <Icons.ChevronDown size={16} color={CAPTION_MUTED} />
                )}
              </CaptionIconButton>
            </View>
          </View>

          {!collapsed ? (
            hasBody ? (
              <View style={styles.body}>
                <CaptionLineRow
                  speaker={displaySpeaker}
                  text={stableText}
                  fonts={fonts}
                  live={!!liveText}
                />
              </View>
            ) : (
              <RNText style={[styles.listening, { fontSize: fonts.body }]} allowFontScaling>
                Listening… captions appear when someone speaks
              </RNText>
            )
          ) : null}

          {showSettings ? (
            <ScrollView
              style={styles.settingsScroll}
              contentContainerStyle={styles.settings}
              keyboardShouldPersistTaps="handled"
              nestedScrollEnabled
            >
              <View style={styles.settingsRow}>
                {availableLanguages.length && targetLang && onTargetLangChange ? (
                  <CaptionLanguageChips
                    label="Show"
                    value={targetLang}
                    options={availableLanguages}
                    onChange={onTargetLangChange}
                    wide={effectiveWideLayout}
                  />
                ) : targetLangName ? (
                  <RNText style={styles.settingsHint}>Show · {targetLangName}</RNText>
                ) : null}
                <View style={styles.headerActions}>
                  {onPlacementChange && !presentationSafe ? (
                    <CaptionIconButton
                      label={`Move captions to ${layout.placement === 'top' ? 'bottom' : 'top'}`}
                      onPress={() => {
                        onOffsetChange?.(0, 0)
                        onPlacementChange(layout.placement === 'top' ? 'bottom' : 'top')
                      }}
                    >
                      {layout.placement === 'top' ? (
                        <Icons.ChevronDown size={16} color={CAPTION_MUTED} />
                      ) : (
                        <Icons.ChevronUp size={16} color={CAPTION_MUTED} />
                      )}
                    </CaptionIconButton>
                  ) : null}
                  <CaptionIconButton
                    label="Make captions smaller"
                    disabled={!canShrink}
                    onPress={() => canShrink && onSizeChange?.(SIZE_ORDER[sizeIndex - 1])}
                  >
                    <RNText style={styles.stepper}>−</RNText>
                  </CaptionIconButton>
                  <CaptionIconButton
                    label="Make captions larger"
                    disabled={!canGrow}
                    onPress={() => canGrow && onSizeChange?.(SIZE_ORDER[sizeIndex + 1])}
                  >
                    <RNText style={styles.stepper}>+</RNText>
                  </CaptionIconButton>
                </View>
              </View>
              {availableLanguages.length && onSpokenLangChange ? (
                <CaptionLanguageChips
                  label="I speak"
                  value={spokenLang || 'auto'}
                  options={[
                    {
                      code: 'auto',
                      label: spokenLangName ? `Auto (${spokenLangName})` : 'Auto',
                    },
                    ...availableLanguages,
                  ]}
                  onChange={onSpokenLangChange}
                  wide={effectiveWideLayout}
                />
              ) : spokenLangName ? (
                <RNText style={styles.settingsHint}>I speak · {spokenLangName}</RNText>
              ) : null}
              <RNText style={styles.settingsHint}>
                Drag the caption box to move it. Only the latest line is shown, translated into your
                Show language.
              </RNText>
            </ScrollView>
          ) : null}
        </View>
      ) : null}
    </View>
  )
}

function CaptionLanguageChips({
  label,
  value,
  options,
  onChange,
  wide,
}: {
  label: string
  value: string
  options: readonly CaptionLanguageOption[]
  onChange: (code: string) => void
  wide: boolean
}) {
  return (
    <View style={[styles.chipBlock, { maxWidth: wide ? 320 : 240 }]}>
      <RNText style={styles.chipLabel}>{label}</RNText>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
        {options.map((option) => {
          const selected = option.code === value
          return (
            <Pressable
              key={option.code}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              onPress={() => onChange(option.code)}
              style={[styles.chip, selected && styles.chipSelected]}
            >
              <RNText style={[styles.chipText, selected && styles.chipTextSelected]} numberOfLines={1}>
                {option.label}
              </RNText>
            </Pressable>
          )
        })}
      </ScrollView>
    </View>
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
    <View style={styles.line}>
      {speaker ? (
        <RNText style={[styles.speaker, { fontSize: fonts.speaker }]} numberOfLines={1}>
          {speaker}
        </RNText>
      ) : null}
      <RNText
        style={[
          styles.captionText,
          {
            fontSize: fonts.body,
            lineHeight: fonts.body + 8,
            fontWeight: live ? '700' : '600',
          },
        ]}
        allowFontScaling
      >
        {text}
      </RNText>
    </View>
  )
}

function CaptionIconButton({
  label,
  disabled,
  selected,
  onPress,
  children,
}: {
  label: string
  disabled?: boolean
  selected?: boolean
  onPress: () => void
  children: ReactNode
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled, selected: !!selected }}
      disabled={disabled}
      onPress={onPress}
      hitSlop={10}
      style={({ pressed }) => [
        styles.iconBtn,
        selected && styles.iconBtnSelected,
        { opacity: disabled ? 0.35 : pressed ? 0.7 : 1 },
      ]}
    >
      {children}
    </Pressable>
  )
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    gap: 8,
  },
  surface: {
    maxWidth: '100%',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: CAPTION_BORDER,
    // Opaque — never rgba. Translucent black washed to white under iPad light theme.
    backgroundColor: CAPTION_BG,
    paddingHorizontal: 14,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOpacity: 0.45,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 4 },
      },
      android: {
        elevation: 8,
      },
      default: {},
    }),
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  dragHandle: {
    flex: 1,
    justifyContent: 'center',
    minHeight: 34,
  },
  settingsScroll: {
    marginTop: 10,
    flexGrow: 0,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  status: {
    flex: 1,
    fontWeight: '800',
    color: CAPTION_MUTED,
  },
  body: {
    marginTop: 8,
    gap: 10,
    width: '100%',
  },
  listening: {
    marginTop: 8,
    fontWeight: '700',
    color: CAPTION_TEXT,
  },
  line: {
    width: '100%',
    gap: 2,
  },
  speaker: {
    fontWeight: '800',
    color: CAPTION_SPEAKER,
  },
  captionText: {
    color: CAPTION_TEXT,
    textShadowColor: 'rgba(0,0,0,0.85)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  settings: {
    gap: 8,
    paddingBottom: 4,
  },
  settingsRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
    flexWrap: 'wrap',
  },
  settingsHint: {
    fontSize: 11,
    fontWeight: '600',
    color: CAPTION_MUTED,
  },
  chipBlock: {
    flexGrow: 1,
    gap: 4,
  },
  chipLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: CAPTION_SPEAKER,
  },
  chipScroll: {
    flexGrow: 0,
  },
  chip: {
    marginRight: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.28)',
    backgroundColor: '#1a1216',
  },
  chipSelected: {
    borderColor: CAPTION_BORDER,
    backgroundColor: '#3b0a22',
  },
  chipText: {
    fontSize: 12,
    fontWeight: '700',
    color: CAPTION_MUTED,
  },
  chipTextSelected: {
    color: CAPTION_TEXT,
  },
  stepper: {
    color: CAPTION_MUTED,
    fontWeight: '800',
    fontSize: 16,
  },
  iconBtn: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    backgroundColor: '#1a1216',
  },
  iconBtnSelected: {
    borderWidth: 1,
    borderColor: CAPTION_BORDER,
    backgroundColor: '#3b0a22',
  },
  errorBanner: {
    width: '100%',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: '#78350f',
    borderWidth: 1,
    borderColor: '#fbbf24',
  },
  errorText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#fde68a',
  },
})
