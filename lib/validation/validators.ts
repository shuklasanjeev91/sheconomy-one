import { validatePostalCode } from '~/lib/geo'

export type Validator = (value: string) => string | null

export function compose(...validators: Validator[]): Validator {
  return (value: string) => {
    for (const validate of validators) {
      const error = validate(value)
      if (error) return error
    }
    return null
  }
}

export function required(message = 'This field is required.'): Validator {
  return (value: string) => (value.trim() ? null : message)
}

export function email(message = 'Enter a valid email address.'): Validator {
  return (value: string) => {
    if (!value.trim()) return null
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim().toLowerCase()) ? null : message
  }
}

export function minLength(min: number, message?: string): Validator {
  return (value: string) =>
    value.trim().length >= min
      ? null
      : (message ?? `Enter at least ${min} characters.`)
}

export function maxLength(max: number, message?: string): Validator {
  return (value: string) =>
    value.length <= max ? null : (message ?? `Must be ${max} characters or fewer.`)
}

export function pattern(regex: RegExp, message: string): Validator {
  return (value: string) => {
    if (!value.trim()) return null
    return regex.test(value) ? null : message
  }
}

export function url(message = 'Enter a valid URL (https://…).'): Validator {
  return (value: string) => {
    if (!value.trim()) return null
    try {
      const parsed = new URL(value.trim())
      return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? null : message
    } catch {
      return message
    }
  }
}

export function optionalUrl(message = 'Enter a valid URL (https://…).'): Validator {
  return (value: string) => (value.trim() ? url(message)(value) : null)
}

export function otp(min = 4, max = 8, message?: string): Validator {
  return (value: string) => {
    const trimmed = value.trim()
    if (!trimmed) return null
    const ok = /^\d+$/.test(trimmed) && trimmed.length >= min && trimmed.length <= max
    return ok ? null : (message ?? `Enter a ${min}–${max} digit code.`)
  }
}

export function slug(message = 'Use lowercase letters, numbers, and hyphens only.'): Validator {
  return pattern(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, message)
}

export function dateYmd(message = 'Use format YYYY-MM-DD.'): Validator {
  return (value: string) => {
    if (!value.trim()) return null
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value.trim())) return message
    const date = new Date(`${value.trim()}T00:00:00`)
    return Number.isNaN(date.getTime()) ? message : null
  }
}

export function timeHm(message = 'Use format HH:MM (24-hour).'): Validator {
  return pattern(/^([01]\d|2[0-3]):[0-5]\d$/, message)
}

export function postalCodeForCountry(countryCode = 'IN'): Validator {
  return (value: string) => {
    if (!value.trim()) return null
    return validatePostalCode(countryCode, value)
  }
}

export function postalCodeIN(): Validator {
  return postalCodeForCountry('IN')
}

export function numeric(message = 'Enter a valid number.'): Validator {
  return (value: string) => {
    if (!value.trim()) return null
    return Number.isFinite(Number(value)) ? null : message
  }
}

export function positiveNumber(message = 'Enter a number greater than 0.'): Validator {
  return (value: string) => {
    if (!value.trim()) return null
    const num = Number(value)
    return Number.isFinite(num) && num > 0 ? null : message
  }
}

export function oneOfRequired(message = 'Select an option.'): Validator {
  return required(message)
}

export function runValidators(value: string, validators: Validator[]): string | null {
  return compose(...validators)(value)
}
