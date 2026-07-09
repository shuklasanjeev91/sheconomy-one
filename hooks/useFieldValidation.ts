import { useCallback, useMemo, useState } from 'react'

import { runValidators, type Validator } from '~/lib/validation'

type UseFieldValidationOptions = {
  initialValue?: string
  validators?: Validator[]
  /** When true, validate on every keystroke once the field is dirty. */
  validateOnChange?: boolean
}

export function useFieldValidation({
  initialValue = '',
  validators = [],
  validateOnChange = true,
}: UseFieldValidationOptions = {}) {
  const [value, setValue] = useState(initialValue)
  const [dirty, setDirty] = useState(false)
  const [touched, setTouched] = useState(false)
  const [submitAttempted, setSubmitAttempted] = useState(false)

  const error = useMemo(() => runValidators(value, validators), [value, validators])
  const isValid = !error
  const showError = !!error && (dirty || touched || submitAttempted)

  const onChange = useCallback(
    (next: string) => {
      setValue(next)
      setDirty(true)
    },
    [],
  )

  const onBlur = useCallback(() => {
    setTouched(true)
  }, [])

  const touch = useCallback(() => {
    setTouched(true)
    setDirty(true)
  }, [])

  const reset = useCallback(
    (nextValue = initialValue) => {
      setValue(nextValue)
      setDirty(false)
      setTouched(false)
      setSubmitAttempted(false)
    },
    [initialValue],
  )

  const validate = useCallback(() => {
    setSubmitAttempted(true)
    setTouched(true)
    return runValidators(value, validators)
  }, [value, validators])

  return {
    value,
    setValue,
    onChange,
    onBlur,
    touch,
    reset,
    validate,
    error,
    showError,
    isValid,
    dirty,
    touched,
    submitAttempted,
    setSubmitAttempted,
  }
}

export type FieldValidationState = ReturnType<typeof useFieldValidation>
