import { forwardRef } from 'react'
import { Platform } from 'react-native'
import type { GetProps } from 'tamagui'
import { Input as TInput, TextArea as TTextArea, YStack } from 'tamagui'
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

/**
 * Fields embedded borderless inside a decorated container (search pills,
 * composers) must not draw their own focus border/glow/background — the
 * container owns the focus ring.
 */
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
  /** RN TextInput API — mapped to `readOnly` on web (Tamagui does not strip it). */
  editable?: boolean
  accessibilityLabel?: string
  accessibilityHint?: string
  accessibilityRole?: string
}

/**
 * Tamagui's web Input forwards unknown RN props onto the DOM node.
 * Map / strip them so React does not warn about `editable` / accessibility*.
 */
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

export const Input = forwardRef<
  any,
  GetProps<typeof TInput> & FieldControlExtra
>(function Input({ invalid, ...props }, ref) {
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
  /** Layout: let a field flex to share a row (applied to the wrapper, not the input). */
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
