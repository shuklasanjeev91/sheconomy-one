import { compose, maxLength, minLength, required, type Validator } from '~/lib/validation'

import {
  PROFILE_ROLES,
  PROFILE_VALIDATION,
  type ProfileUpdate,
  type ProfileValidationResult,
  type UserRole,
} from '~/lib/profile/profile.type'
/**
 * Field-level validators built on top of the shared `~/lib/validation` helpers.
 * These are safe to plug directly into `useFormValidation` schemas.
 */
export const fullNameValidator: Validator = compose(
  required('Full name is required.'),
  minLength(
    PROFILE_VALIDATION.FULL_NAME.MIN_LENGTH,
    `Full name must be at least ${PROFILE_VALIDATION.FULL_NAME.MIN_LENGTH} characters long.`,
  ),
  maxLength(
    PROFILE_VALIDATION.FULL_NAME.MAX_LENGTH,
    `Full name must be less than ${PROFILE_VALIDATION.FULL_NAME.MAX_LENGTH} characters.`,
  ),
)

export const bioValidator: Validator = maxLength(
  PROFILE_VALIDATION.BIO.MAX_LENGTH,
  `Bio must be less than ${PROFILE_VALIDATION.BIO.MAX_LENGTH} characters.`,
)

export const businessNameValidator: Validator = maxLength(
  PROFILE_VALIDATION.BUSINESS_NAME.MAX_LENGTH,
  `Business name must be less than ${PROFILE_VALIDATION.BUSINESS_NAME.MAX_LENGTH} characters.`,
)

export function isValidRole(role: string | null | undefined): role is UserRole {
  return !!role && PROFILE_ROLES.includes(role as UserRole)
}

export const roleValidator: Validator = (value: string) =>
  !value || isValidRole(value) ? null : 'Invalid role selected.'

/**
 * Validate a partial profile update before persisting.
 * Only validates the fields that are actually present on the payload, matching
 * the old `validateProfileData` behaviour but aligned to the real `A/V/U` roles.
 */
export function validateProfileData(profileData: ProfileUpdate): ProfileValidationResult {
  const errors: string[] = []

  if (profileData.full_name !== undefined) {
    const fullName = profileData.full_name?.trim() ?? ''
    if (fullName.length < PROFILE_VALIDATION.FULL_NAME.MIN_LENGTH) {
      errors.push(
        `Full name must be at least ${PROFILE_VALIDATION.FULL_NAME.MIN_LENGTH} characters long.`,
      )
    }
    if (fullName.length > PROFILE_VALIDATION.FULL_NAME.MAX_LENGTH) {
      errors.push(
        `Full name must be less than ${PROFILE_VALIDATION.FULL_NAME.MAX_LENGTH} characters.`,
      )
    }
  }

  if (profileData.bio !== undefined && profileData.bio) {
    if (profileData.bio.length > PROFILE_VALIDATION.BIO.MAX_LENGTH) {
      errors.push(`Bio must be less than ${PROFILE_VALIDATION.BIO.MAX_LENGTH} characters.`)
    }
  }

  if (profileData.role !== undefined && profileData.role && !isValidRole(profileData.role)) {
    errors.push('Invalid role selected.')
  }

  if (profileData.business_name !== undefined && profileData.business_name) {
    if (profileData.business_name.length > PROFILE_VALIDATION.BUSINESS_NAME.MAX_LENGTH) {
      errors.push(
        `Business name must be less than ${PROFILE_VALIDATION.BUSINESS_NAME.MAX_LENGTH} characters.`,
      )
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  }
}
