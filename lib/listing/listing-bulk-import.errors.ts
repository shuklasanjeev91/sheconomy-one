import { toFriendlyListingError } from './listing.errors'

function extractErrorText(errorInput: unknown): string {
  if (!errorInput) return ''
  if (typeof errorInput === 'string') return errorInput
  if (typeof errorInput === 'object' && errorInput !== null && 'message' in errorInput) {
    const message = (errorInput as { message?: unknown }).message
    if (typeof message === 'string') return message
  }
  try {
    return JSON.stringify(errorInput)
  } catch {
    return String(errorInput)
  }
}

/** Map orchestrator / DB errors to actionable bulk-import copy. */
export function toBulkImportRowError(errorInput: unknown, failedStep?: string | null): string {
  const raw = extractErrorText(errorInput)
  const normalized = raw.toLowerCase()

  if (
    normalized.includes('listings_slug_key') ||
    (normalized.includes('duplicate key value') && normalized.includes('slug'))
  ) {
    return 'Slug already exists. Remove slug to auto-generate one, or provide a unique slug for this row.'
  }

  if (
    normalized.includes('valid_image_url') ||
    normalized.includes('invalid image url')
  ) {
    return 'Image URL is invalid. Use a direct HTTPS image URL with an approved host and .jpg/.jpeg/.png extension.'
  }

  if (
    normalized.includes('information_schema.columns') ||
    (normalized.includes('404') && normalized.includes('information_schema'))
  ) {
    return 'A metadata check failed on the server. Please retry this row.'
  }

  if (
    normalized.includes('duplicate key value') ||
    normalized.includes('23505') ||
    normalized.includes('409')
  ) {
    return 'This row contains duplicate unique data. Update slug or other unique fields and retry.'
  }

  const friendly = toFriendlyListingError(errorInput)
  const stepPrefix = failedStep ? `${failedStep.replace(/_/g, ' ')}: ` : ''
  return `${stepPrefix}${friendly || 'Publish failed'}`
}

export function formatBulkImportParseError(error: unknown): string {
  if (error instanceof Error) return `Could not parse file: ${error.message}`
  return 'Could not parse file. Check the format and try again.'
}
