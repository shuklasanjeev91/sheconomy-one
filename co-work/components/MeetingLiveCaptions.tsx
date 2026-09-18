import type { ReactNode } from 'react'
import { useMemo, useState } from 'react'
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text as RNText,
  View,
  useWindowDimensions,
} from 'react-native'

import { Icons } from '~/components/ui'
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
  spokenLang?: string
  spokenLangName?: string
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
  onSpokenLangChange?: (language: string) => void
  onCollapsedChange?: (collapsed: boolean) => void
  onSizeChange?: (size: CaptionOverlaySize) => void
  onPlacementChange?: (placement: CaptionOverlayPlacement) => void
}

const SIZE_ORDER: CaptionOverlaySize[] = ['compact', 'comfortable', 'large']

const FONT_BY_SIZE: Record<CaptionOverlaySize, { body: number; speaker: number; status: number }> = {
  compact: { body: 17, speaker: 12, status: 13 },
  comfortable: { body: 21, speaker: 13, status: 14 },
  large: { body: 26, speaker: 14, status: 15 },
}

/** Opaque Sheconomy caption chrome — never translucent (iPad washed translucent black to white). */
const CAPTION_BG = '#0c080a'
const CAPTION_BORDER = '#D81B60'
const CAPTION_TEXT = '#FFFFFF'
const CAPTION_MUTED = '#FCE7F3'
const CAPTION_SPEAKER = '#F9A8D4'

/**
 * Zoom-style captions for web + iOS + Android.
 * Pure RN View/Text/StyleSheet only — Tamagui theme tokens previously painted a
 * near-white surface over white text on iPad (empty white caption bar).
 */
export function MeetingLiveCaptions({
  active,
  currentCaption,
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
  presentationSafe = false,
  wideLayout,
  topOffset,
  bottomOffset,
  sideInset,
  onTargetLangChange,
  onSpokenLangChange,
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
  const top = layout.placement === 'top' ? topOffset ?? (presentationSafe ? 96 : 72) : undefined
  const bottom =
    layout.placement === 'bottom' ? bottomOffset ?? (presentationSafe ? 140 : 112) : undefined
  const horizontalInset = sideInset ?? 12
  const showSettings = !collapsed && settingsOpen

  const finalLines = useMemo(
    () => lines.filter((line) => line.isFinal && line.text.trim()).slice(-3),
    [lines],
  )
  const interimLine = useMemo(
    () => [...lines].reverse().find((line) => !line.isFinal && line.text.trim()),
    [lines],
  )
  const liveText = (currentCaption.trim() || interimLine?.text || '').trim()
  const liveIsNew =
    !!liveText &&
    liveText !== '…' &&
    liveText !== finalLines[finalLines.length - 1]?.text?.trim()
  const hasBody = finalLines.length > 0 || liveIsNew
  const liveSpeaker = interimLine?.speaker || finalLines[finalLines.length - 1]?.speaker || 'Speaking'

  if (!active && !error) return null

  return (
    <View
      pointerEvents="box-none"
      style={[
        styles.wrap,
        {
          left: horizontalInset,
          right: horizontalInset,
          top,
          bottom,
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
              maxHeight: collapsed ? 58 : layout.maxHeight,
              paddingVertical: collapsed ? 10 : 14,
            },
          ]}
          pointerEvents="auto"
          // iOS: prevent parent theme / blending from washing the bar white.
          collapsable={false}
        >
          <View style={styles.header}>
            <RNText
              style={[styles.status, { fontSize: fonts.status }]}
              numberOfLines={1}
              allowFontScaling
            >
              {collapsed
                ? liveText ||
                  finalLines[finalLines.length - 1]?.text ||
                  `CC · ${targetLangName || 'On'}`
                : `CC · ${targetLangName || 'Captions'}`}
            </RNText>
            <View style={styles.headerActions}>
              {!collapsed ? (
                <CaptionIconButton
                  label={settingsOpen ? 'Hide caption settings' : 'Caption settings'}
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
                    speaker={liveSpeaker}
                    text={liveText}
                    fonts={fonts}
                    live
                  />
                ) : null}
              </View>
            ) : (
              <RNText style={[styles.listening, { fontSize: fonts.body }]} allowFontScaling>
                Listening… captions appear when someone speaks
              </RNText>
            )
          ) : null}

          {showSettings ? (
            <View style={styles.settings}>
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
                      onPress={() =>
                        onPlacementChange(layout.placement === 'top' ? 'bottom' : 'top')
                      }
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
                You see captions in your display language. Speech recognition follows what you speak
                so peers can read you in theirs.
              </RNText>
            </View>
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
      style={({ pressed }) => [
        styles.iconBtn,
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
    marginTop: 10,
    gap: 8,
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
