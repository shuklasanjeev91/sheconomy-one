import type { ReactNode } from 'react'
import { useState } from 'react'
import {
  Pressable,
  StyleSheet,
  Text as RNText,
  View,
  useWindowDimensions,
} from 'react-native'

import {
  Icons,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectViewport,
  XStack,
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
  /** Speech-to-text language for this device (`auto` = follow region). */
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
  compact: { body: 16, speaker: 12, status: 12 },
  comfortable: { body: 20, speaker: 13, status: 13 },
  large: { body: 24, speaker: 14, status: 14 },
}

/**
 * Zoom-style captions. Uses RN View/Text + StyleSheet so Tamagui theme tokens
 * cannot wash the surface white (which made caption text invisible on iPad).
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
  // Keep captions clear of shared content + filmstrip when presenting.
  const top = layout.placement === 'top' ? topOffset ?? (presentationSafe ? 96 : 72) : undefined
  const bottom =
    layout.placement === 'bottom' ? bottomOffset ?? (presentationSafe ? 140 : 112) : undefined
  const horizontalInset = sideInset ?? 12
  const showSettings = !collapsed && settingsOpen

  const finalLines = lines.filter((line) => line.isFinal && line.text.trim()).slice(-3)
  const interimLine = [...lines].reverse().find((line) => !line.isFinal && line.text.trim())
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
              maxHeight: collapsed ? 56 : layout.maxHeight,
              paddingVertical: collapsed ? 10 : 14,
            },
          ]}
          pointerEvents="auto"
        >
          <View style={styles.header}>
            <RNText style={[styles.status, { fontSize: fonts.status }]} numberOfLines={1}>
              {collapsed
                ? liveText || finalLines[finalLines.length - 1]?.text || `CC · ${targetLangName || 'On'}`
                : `CC · ${targetLangName || 'Captions'}`}
            </RNText>
            <View style={styles.headerActions}>
              {!collapsed ? (
                <CaptionIconButton
                  label={settingsOpen ? 'Hide caption settings' : 'Caption settings'}
                  onPress={() => setSettingsOpen((open) => !open)}
                >
                  <Icons.Settings size={16} color="#fce7f3" />
                </CaptionIconButton>
              ) : null}
              <CaptionIconButton
                label={collapsed ? 'Expand captions' : 'Minimize captions'}
                onPress={() => onCollapsedChange?.(!collapsed)}
              >
                {collapsed ? (
                  <Icons.ChevronUp size={16} color="#fce7f3" />
                ) : (
                  <Icons.ChevronDown size={16} color="#fce7f3" />
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
              <RNText style={[styles.listening, { fontSize: fonts.body }]}>
                Listening… captions appear when someone speaks
              </RNText>
            )
          ) : null}

          {showSettings ? (
            <View style={styles.settings}>
              <XStack alignItems="center" justifyContent="space-between" gap="$2" flexWrap="wrap">
                {availableLanguages.length && targetLang && onTargetLangChange ? (
                  <Select value={targetLang} onValueChange={onTargetLangChange}>
                    <SelectTrigger
                      height={34}
                      width={effectiveWideLayout ? 168 : 148}
                      paddingHorizontal="$2"
                      backgroundColor="rgba(255,255,255,0.14)"
                      borderColor="rgba(255,255,255,0.28)"
                      iconAfter={<Icons.ChevronDown size={14} color="#fce7f3" />}
                      accessibilityLabel="Show captions in this language"
                    >
                      <Select.Value placeholder="Show me" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectViewport maxHeight={300}>
                        {availableLanguages.map((language, index) => (
                          <SelectItem key={language.code} value={language.code} index={index}>
                            <Select.ItemText>Show · {language.label}</Select.ItemText>
                          </SelectItem>
                        ))}
                      </SelectViewport>
                    </SelectContent>
                  </Select>
                ) : targetLangName ? (
                  <RNText style={styles.settingsHint}>Show · {targetLangName}</RNText>
                ) : null}
                <XStack alignItems="center" gap="$1">
                  {onPlacementChange && !presentationSafe ? (
                    <CaptionIconButton
                      label={`Move captions to ${layout.placement === 'top' ? 'bottom' : 'top'}`}
                      onPress={() => onPlacementChange(layout.placement === 'top' ? 'bottom' : 'top')}
                    >
                      {layout.placement === 'top' ? (
                        <Icons.ChevronDown size={16} color="#fce7f3" />
                      ) : (
                        <Icons.ChevronUp size={16} color="#fce7f3" />
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
                </XStack>
              </XStack>
              {availableLanguages.length && onSpokenLangChange ? (
                <Select value={spokenLang || 'auto'} onValueChange={onSpokenLangChange}>
                  <SelectTrigger
                    height={34}
                    width="100%"
                    maxWidth={effectiveWideLayout ? 280 : 220}
                    paddingHorizontal="$2"
                    backgroundColor="rgba(255,255,255,0.14)"
                    borderColor="rgba(255,255,255,0.28)"
                    iconAfter={<Icons.ChevronDown size={14} color="#fce7f3" />}
                    accessibilityLabel="I speak this language — used for speech recognition"
                  >
                    <Select.Value placeholder="I speak" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectViewport maxHeight={300}>
                      <SelectItem value="auto" index={0}>
                        <Select.ItemText>
                          I speak · Auto{spokenLangName ? ` (${spokenLangName})` : ''}
                        </Select.ItemText>
                      </SelectItem>
                      {availableLanguages.map((language, index) => (
                        <SelectItem key={language.code} value={language.code} index={index + 1}>
                          <Select.ItemText>I speak · {language.label}</Select.ItemText>
                        </SelectItem>
                      ))}
                    </SelectViewport>
                  </SelectContent>
                </Select>
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
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.28)',
    backgroundColor: 'rgba(0,0,0,0.88)',
    paddingHorizontal: 14,
    overflow: 'hidden',
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
    color: '#fce7f3',
  },
  body: {
    marginTop: 8,
    gap: 10,
    width: '100%',
  },
  listening: {
    marginTop: 8,
    fontWeight: '700',
    color: '#ffffff',
  },
  line: {
    width: '100%',
    gap: 2,
  },
  speaker: {
    fontWeight: '800',
    color: '#f9a8d4',
  },
  captionText: {
    color: '#ffffff',
    textShadowColor: 'rgba(0,0,0,0.65)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  settings: {
    marginTop: 10,
    gap: 6,
  },
  settingsHint: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(252,231,243,0.85)',
  },
  stepper: {
    color: '#fce7f3',
    fontWeight: '800',
    fontSize: 16,
  },
  iconBtn: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
  },
  errorBanner: {
    width: '100%',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: 'rgba(120, 53, 15, 0.95)',
    borderWidth: 1,
    borderColor: 'rgba(251, 191, 36, 0.5)',
  },
  errorText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#fde68a',
  },
})
