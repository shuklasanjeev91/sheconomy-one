import { forwardRef } from 'react'
import type { GetProps } from 'tamagui'
import { Input as TInput, TextArea as TTextArea, YStack, SizableText } from 'tamagui'
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

export const Input = forwardRef<any, GetProps<typeof TInput> & { invalid?: boolean }>(function Input(
  { invalid, ...props },
  ref,
) {
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
      {...props}
    />
  )
})
Input.displayName = 'Input'

export const TextArea = forwardRef<any, GetProps<typeof TTextArea> & { invalid?: boolean }>(
  function TextArea({ invalid, ...props }, ref) {
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
        {...props}
      />
    )
  },
)
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