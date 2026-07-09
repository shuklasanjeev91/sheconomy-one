import { useCallback, useMemo, useState } from 'react'

import { runValidators, type Validator } from '~/lib/validation'

type FieldSchema = {
  initialValue?: string
  validators?: Validator[]
}

export type FormSchema = Record<string, FieldSchema>

export type FormFieldState = {
  value: string
  setValue: (value: string) => void
  onChange: (value: string) => void
  onBlur: () => void
  touch: () => void
  reset: (value?: string) => void
  validate: () => string | null
  error: string | null
  showError: boolean
  isValid: boolean
}

export type FormFields<T extends FormSchema> = {
  [K in keyof T]: FormFieldState
}

export function useFormValidation<T extends FormSchema>(schema: T) {
  const initialValues = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(schema).map(([key, config]) => [key, config.initialValue ?? '']),
      ) as Record<keyof T & string, string>,
    [schema],
  )

  const [values, setValues] = useState<Record<keyof T & string, string>>(initialValues)
  const [dirty, setDirty] = useState<Partial<Record<keyof T & string, boolean>>>({})
  const [touched, setTouched] = useState<Partial<Record<keyof T & string, boolean>>>({})
  const [submitAttempted, setSubmitAttempted] = useState(false)

  const fields = useMemo(() => {
    const map = {} as FormFields<T>

    for (const key of Object.keys(schema) as (keyof T & string)[]) {
      const config = schema[key]
      const value = values[key] ?? ''
      const validators = config.validators ?? []
      const error = runValidators(value, validators)
      const showError = !!error && (dirty[key] || touched[key] || submitAttempted)

      map[key as keyof T] = {
        value,
        error,
        showError,
        isValid: !error,
        onChange: (next: string) => {
          setValues((current) => ({ ...current, [key]: next }))
          setDirty((current) => ({ ...current, [key]: true }))
        },
        setValue: (next: string) => {
          setValues((current) => ({ ...current, [key]: next }))
        },
        onBlur: () => {
          setTouched((current) => ({ ...current, [key]: true }))
        },
        touch: () => {
          setTouched((current) => ({ ...current, [key]: true }))
          setDirty((current) => ({ ...current, [key]: true }))
        },
        reset: (nextValue = config.initialValue ?? '') => {
          setValues((current) => ({ ...current, [key]: nextValue }))
          setDirty((current) => ({ ...current, [key]: false }))
          setTouched((current) => ({ ...current, [key]: false }))
        },
        validate: () => {
          setSubmitAttempted(true)
          setTouched((current) => ({ ...current, [key]: true }))
          return runValidators(value, validators)
        },
      } as FormFieldState
    }

    return map
  }, [dirty, schema, submitAttempted, touched, values])

  const isValid = useMemo(
    () => Object.keys(schema).every((key) => fields[key as keyof T]?.isValid),
    [fields, schema],
  )

  const validateAll = useCallback(() => {
    setSubmitAttempted(true)
    setTouched((current) => {
      const next = { ...current }
      for (const key of Object.keys(schema)) next[key] = true
      return next
    })

    let valid = true
    for (const key of Object.keys(schema) as (keyof T & string)[]) {
      const value = values[key] ?? ''
      const error = runValidators(value, schema[key].validators ?? [])
      if (error) valid = false
    }
    return valid
  }, [schema, values])

  const resetAll = useCallback(() => {
    setValues(initialValues)
    setDirty({})
    setTouched({})
    setSubmitAttempted(false)
  }, [initialValues])

  return {
    fields,
    values,
    isValid,
    validateAll,
    resetAll,
    submitAttempted,
  }
}

export type FormValidation<T extends FormSchema> = ReturnType<typeof useFormValidation<T>>
