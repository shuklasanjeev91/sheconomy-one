import { forwardRef } from 'react'
import { Platform } from 'react-native'
import type { GetProps } from 'tamagui'
import { Input as TInput, TextArea as TTextArea, YStack } from 'tamagui'

import { AppTextField } from '~/components/forms/AppTextField'
import { SizableText } from '~/components/ui/Text'
import { BRAND_THEME } from '~/config/tokens'
import { WritingSuggestionBar } from '~/components/writing/WritingSuggestionBar'
import { useDictationField } from '~/hooks/useDictationField'

const sharedFieldStyle = {
  borderRadius: '$6',
  borderWidth: 1,
  borderColor: '$borderColor',
  backgroundColor: '$background',
  color: '$color12',
  placeholderTextColor: '$color9',
  paddingHorizontal: '$4',
  fontSize: '$4',
  fontWeight: '500',
  focusStyle: {
    borderColor: '$color9',
    backgroundColor: '$background',
    color: '$color12',
    outlineWidth: 0,
    borderWidth: 1.5,
    shadowColor: '$color8',
    shadowOpacity: 0.14,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
  },
  hoverStyle: {
    borderColor: '$color7',
  },
} as const

const embeddedFieldStyle = {
  focusStyle: {
    borderWidth: 0,
    backgroundColor: 'transparent',
    outlineWidth: 0,
    shadowOpacity: 0,
  },
  hoverStyle: {},
} as const

function isEmbeddedField(props: { borderWidth?: unknown; unstyled?: boolean }): boolean {
  return props.borderWidth === 0 || props.unstyled === true
}

type FieldControlExtra = {
  invalid?: boolean
  editable?: boolean
  accessibilityLabel?: string
  accessibilityHint?: string
  accessibilityRole?: string
  /** Spell and grammar chip. On for text areas, off for short inputs. */
  writingAssist?: boolean
  /** Skip a check while another suggestion panel is open. */
  writingPaused?: boolean
  /** Register for app-wide SHERPA dictation (default true). */
  dictation?: boolean
}

function withWritingAssist(
  field: React.ReactNode,
  options: {
    enabled: boolean
    paused?: boolean
    value?: unknown
    flex?: unknown
    onChangeText?: (text: string) => void
  },
) {
  if (!options.enabled) return field
  return (
    <YStack width="100%" minWidth={0} flex={typeof options.flex === 'number' ? options.flex : undefined}>
      {field}
      <WritingSuggestionBar
        value={options.value != null ? String(options.value) : ''}
        paused={Boolean(options.paused)}
        onApply={(next) => options.onChangeText?.(next)}
      />
    </YStack>
  )
}

function webSafeFieldProps<T extends FieldControlExtra>(props: T): T {
  if (Platform.OS !== 'web') return props

  const {
    editable,
    accessibilityLabel,
    accessibilityHint,
    accessibilityRole: _accessibilityRole,
    ...rest
  } = props

  return {
    ...rest,
    readOnly: editable === false,
    ...(accessibilityLabel ? { 'aria-label': accessibilityLabel } : null),
    ...(accessibilityHint ? { title: accessibilityHint } : null),
  } as T
}

type InputProps = GetProps<typeof TInput> & FieldControlExtra

/**
 * Web: Tamagui Input.
 * Native: RN-backed AppTextField so typing, paste, and autofill work reliably
 * across every screen (Tamagui Input shells often swallow Android touches).
 */
export const Input = forwardRef<any, InputProps>(function Input(
  { invalid, writingAssist = false, writingPaused = false, dictation = true, ...props },
  ref,
) {
  const dictationField = useDictationField({
    value: props.value,
    onChangeText: (props as { onChangeText?: (text: string) => void }).onChangeText,
    onFocus: props.onFocus as never,
    onBlur: props.onBlur as never,
    secureTextEntry: Boolean((props as { secureTextEntry?: boolean }).secureTextEntry),
    editable: props.editable,
    disabled: Boolean((props as { disabled?: boolean }).disabled),
    dictation,
  })

  if (Platform.OS !== 'web') {
    const {
      value,
      defaultValue,
      onChangeText,
      onBlur: _onBlur,
      onFocus: _onFocus,
      onSubmitEditing,
      placeholder,
      placeholderTextColor,
      editable,
      disabled,
      autoComplete,
      textContentType,
      keyboardType,
      inputMode,
      autoCapitalize,
      autoCorrect,
      secureTextEntry,
      returnKeyType,
      enterKeyHint,
      accessibilityLabel,
      maxLength,
      multiline,
      numberOfLines,
      autoFocus,
      borderWidth,
      unstyled,
      flex,
      width,
      height,
      fontSize,
      color,
    } = props as InputProps & {
      onChangeText?: (text: string) => void
      onSubmitEditing?: (event: unknown) => void
      disabled?: boolean
      autoComplete?: string
      textContentType?: string
      inputMode?: string
      enterKeyHint?: string
      maxLength?: number
      multiline?: boolean
      numberOfLines?: number
      autoFocus?: boolean
      defaultValue?: string
      flex?: number
      width?: number | string
      height?: number | string
      fontSize?: number
      color?: string
      placeholderTextColor?: string
    }

    const embedded = isEmbeddedField({ borderWidth, unstyled })
    const resolvedFontSize =
      typeof fontSize === 'number'
        ? fontSize
        : typeof fontSize === 'string' && /^\d+(\.\d+)?$/.test(fontSize)
          ? Number(fontSize)
          : undefined

    return withWritingAssist(
      <AppTextField
        ref={ref}
        value={value != null ? String(value) : defaultValue != null ? String(defaultValue) : undefined}
        onChangeText={onChangeText}
        onBlur={dictationField.onBlur as never}
        onFocus={dictationField.onFocus as never}
        onSubmitEditing={onSubmitEditing as never}
        placeholder={placeholder != null ? String(placeholder) : undefined}
        placeholderTextColor={
          typeof placeholderTextColor === 'string' ? placeholderTextColor : undefined
        }
        editable={editable}
        disabled={Boolean(disabled)}
        invalid={invalid}
        autoComplete={autoComplete as never}
        textContentType={textContentType as never}
        keyboardType={keyboardType as never}
        inputMode={inputMode as never}
        autoCapitalize={(autoCapitalize as never) ?? 'sentences'}
        autoCorrect={writingAssist ? autoCorrect !== false : (autoCorrect as never)}
        secureTextEntry={Boolean(secureTextEntry)}
        returnKeyType={returnKeyType as never}
        enterKeyHint={enterKeyHint as never}
        accessibilityLabel={accessibilityLabel}
        maxLength={maxLength}
        multiline={Boolean(multiline)}
        numberOfLines={numberOfLines}
        autoFocus={autoFocus}
        embedded={embedded}
        fontSize={resolvedFontSize}
        color={typeof color === 'string' ? color : undefined}
        containerStyle={{
          ...(typeof flex === 'number' ? { flex } : null),
          ...(width != null ? { width: width as never } : null),
          ...(height != null && !embedded
            ? { height: height as never, minHeight: height as never }
            : null),
          // Stretch into fixed-height search shells only — never force % height
          // when the parent sizes from minHeight alone.
          ...(embedded ? { alignSelf: 'stretch' as const } : null),
        }}
      />,
      {
        enabled: writingAssist,
        paused: writingPaused,
        value,
        flex,
        onChangeText,
      },
    )
  }

  const safeProps = webSafeFieldProps({
    ...props,
    onFocus: dictationField.onFocus as never,
    onBlur: dictationField.onBlur as never,
  })

  return withWritingAssist(
    <TInput
      ref={ref}
      theme={BRAND_THEME}
      height="$5"
      spellCheck={writingAssist}
      {...sharedFieldStyle}
      {...(invalid
        ? {
            borderColor: '$red8',
            focusStyle: {
              borderColor: '$red9',
              backgroundColor: '$background',
              outlineWidth: 0,
              borderWidth: 1.5,
            },
          }
        : null)}
      {...(isEmbeddedField(props) ? embeddedFieldStyle : null)}
      {...safeProps}
    />,
    {
      enabled: writingAssist,
      paused: writingPaused,
      value: props.value,
      flex: props.flex,
      onChangeText: (props as { onChangeText?: (text: string) => void }).onChangeText,
    },
  )
})
Input.displayName = 'Input'

export const TextArea = forwardRef<
  any,
  GetProps<typeof TTextArea> & FieldControlExtra
>(function TextArea(
  { invalid, writingAssist = true, writingPaused = false, dictation = true, ...props },
  ref,
) {
  const dictationField = useDictationField({
    value: props.value,
    onChangeText: (props as { onChangeText?: (text: string) => void }).onChangeText,
    onFocus: props.onFocus as never,
    onBlur: props.onBlur as never,
    editable: props.editable,
    disabled: Boolean((props as { disabled?: boolean }).disabled),
    dictation,
  })

  if (Platform.OS !== 'web') {
    const {
      value,
      onChangeText,
      onBlur: _onBlur,
      onFocus: _onFocus,
      placeholder,
      editable,
      disabled,
      accessibilityLabel,
      maxLength,
      numberOfLines,
      autoFocus,
      autoCapitalize,
      autoCorrect,
    } = props as GetProps<typeof TTextArea> &
      FieldControlExtra & {
        onChangeText?: (text: string) => void
        disabled?: boolean
        maxLength?: number
        numberOfLines?: number
        autoFocus?: boolean
      }

    return withWritingAssist(
      <AppTextField
        ref={ref}
        value={value != null ? String(value) : undefined}
        onChangeText={onChangeText}
        onBlur={dictationField.onBlur as never}
        onFocus={dictationField.onFocus as never}
        placeholder={placeholder != null ? String(placeholder) : undefined}
        editable={editable}
        disabled={Boolean(disabled)}
        invalid={invalid}
        accessibilityLabel={accessibilityLabel}
        maxLength={maxLength}
        multiline
        numberOfLines={numberOfLines ?? 4}
        autoFocus={autoFocus}
        autoCapitalize={(autoCapitalize as never) ?? 'sentences'}
        autoCorrect={autoCorrect !== false}
      />,
      {
        enabled: writingAssist,
        paused: writingPaused,
        value,
        flex: (props as { flex?: unknown }).flex,
        onChangeText,
      },
    )
  }

  const safeProps = webSafeFieldProps({
    ...props,
    onFocus: dictationField.onFocus as never,
    onBlur: dictationField.onBlur as never,
  })

  return withWritingAssist(
    <TTextArea
      ref={ref}
      theme={BRAND_THEME}
      minHeight={100}
      paddingVertical="$3"
      spellCheck={writingAssist}
      {...sharedFieldStyle}
      {...(invalid
        ? {
            borderColor: '$red8',
            focusStyle: {
              borderColor: '$red9',
              backgroundColor: '$background',
              outlineWidth: 0,
              borderWidth: 1.5,
            },
          }
        : null)}
      {...(isEmbeddedField(props) ? embeddedFieldStyle : null)}
      {...safeProps}
    />,
    {
      enabled: writingAssist,
      paused: writingPaused,
      value: props.value,
      flex: props.flex,
      onChangeText: (props as { onChangeText?: (text: string) => void }).onChangeText,
    },
  )
})
TextArea.displayName = 'TextArea'

export type FieldProps = {
  label?: string
  error?: string
  hint?: string
  required?: boolean
  children: React.ReactNode
  flex?: number
  minWidth?: number
}

/** Label + control + error/hint text, stacked with consistent spacing. */
export function Field({ label, error, hint, required, children, flex, minWidth }: FieldProps) {
  return (
    <YStack gap="$2" flex={flex} minWidth={minWidth}>
      {label ? (
        <SizableText size="$3" fontWeight="600" color="$color12">
          {label}
          {required ? <SizableText color="$red10"> *</SizableText> : null}
        </SizableText>
      ) : null}
      {children}
      {error ? (
        <SizableText size="$2" color="$red10">
          {error}
        </SizableText>
      ) : hint ? (
        <SizableText size="$2" color="$color10">
          {hint}
        </SizableText>
      ) : null}
    </YStack>
  )
}
