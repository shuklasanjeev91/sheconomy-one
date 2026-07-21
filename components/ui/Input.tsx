import { forwardRef } from 'react'
import { Platform } from 'react-native'
import type { GetProps } from 'tamagui'
import { Input as TInput, TextArea as TTextArea, YStack } from 'tamagui'

import { AppTextField } from '~/components/forms/AppTextField'
import { SizableText } from './Text'
import { BRAND_THEME } from '~/config/tokens'

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
    ...(editable === false ? { readOnly: true } : null),
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
export const Input = forwardRef<any, InputProps>(function Input({ invalid, ...props }, ref) {
  if (Platform.OS !== 'web') {
    const {
      value,
      defaultValue,
      onChangeText,
      onBlur,
      onFocus,
      placeholder,
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
    } = props as InputProps & {
      onChangeText?: (text: string) => void
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
    }

    const embedded = isEmbeddedField({ borderWidth, unstyled })

    return (
      <AppTextField
        ref={ref}
        value={value != null ? String(value) : defaultValue != null ? String(defaultValue) : undefined}
        onChangeText={onChangeText}
        onBlur={onBlur as never}
        onFocus={onFocus as never}
        placeholder={placeholder != null ? String(placeholder) : undefined}
        editable={editable}
        disabled={Boolean(disabled)}
        invalid={invalid}
        autoComplete={autoComplete as never}
        textContentType={textContentType as never}
        keyboardType={keyboardType as never}
        inputMode={inputMode as never}
        autoCapitalize={(autoCapitalize as never) ?? 'sentences'}
        autoCorrect={autoCorrect as never}
        secureTextEntry={Boolean(secureTextEntry)}
        returnKeyType={returnKeyType as never}
        enterKeyHint={enterKeyHint as never}
        accessibilityLabel={accessibilityLabel}
        maxLength={maxLength}
        multiline={Boolean(multiline)}
        numberOfLines={numberOfLines}
        autoFocus={autoFocus}
        embedded={embedded}
        containerStyle={{
          ...(typeof flex === 'number' ? { flex } : null),
          ...(width != null ? { width: width as never } : null),
          ...(height != null && !embedded ? { minHeight: height as never } : null),
        }}
      />
    )
  }

  const safeProps = webSafeFieldProps(props)

  return (
    <TInput
      ref={ref}
      theme={BRAND_THEME}
      height="$5"
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
    />
  )
})
Input.displayName = 'Input'

export const TextArea = forwardRef<
  any,
  GetProps<typeof TTextArea> & FieldControlExtra
>(function TextArea({ invalid, ...props }, ref) {
  if (Platform.OS !== 'web') {
    const {
      value,
      onChangeText,
      onBlur,
      onFocus,
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

    return (
      <AppTextField
        ref={ref}
        value={value != null ? String(value) : undefined}
        onChangeText={onChangeText}
        onBlur={onBlur as never}
        onFocus={onFocus as never}
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
      />
    )
  }

  const safeProps = webSafeFieldProps(props)

  return (
    <TTextArea
      ref={ref}
      theme={BRAND_THEME}
      minHeight={100}
      paddingVertical="$3"
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
    />
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
