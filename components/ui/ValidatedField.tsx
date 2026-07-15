import type { GetProps } from 'tamagui'

import type { FormFieldState } from '~/hooks/useFormValidation'

import { Field } from './Input'
import { Input, TextArea } from './Input'

type SharedProps = {
  label?: string
  hint?: string
  required?: boolean
  field: FormFieldState
}

type ValidatedTextFieldProps = SharedProps &
  Omit<GetProps<typeof Input>, 'value' | 'onChangeText' | 'onBlur'>

export function ValidatedTextField({
  label,
  hint,
  required,
  field,
  flex,
  minWidth,
  ...inputProps
}: ValidatedTextFieldProps) {
  return (
    <Field
      label={label}
      required={required}
      hint={!field.showError ? hint : undefined}
      error={field.showError ? field.error ?? undefined : undefined}
      flex={flex}
      minWidth={minWidth}
    >
      <Input
        width="100%"
        value={field.value}
        onChangeText={field.onChange}
        onBlur={field.onBlur}
        invalid={field.showError && !!field.error}
        {...inputProps}
      />
    </Field>
  )
}

type ValidatedTextAreaProps = SharedProps &
  Omit<GetProps<typeof TextArea>, 'value' | 'onChangeText' | 'onBlur'>

export function ValidatedTextArea({
  label,
  hint,
  required,
  field,
  ...inputProps
}: ValidatedTextAreaProps) {
  return (
    <Field
      label={label}
      required={required}
      hint={!field.showError ? hint : undefined}
      error={field.showError ? field.error ?? undefined : undefined}
    >
      <TextArea
        value={field.value}
        onChangeText={field.onChange}
        onBlur={field.onBlur}
        invalid={field.showError && !!field.error}
        {...inputProps}
      />
    </Field>
  )
}