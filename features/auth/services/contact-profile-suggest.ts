import { contactPickerService } from '~/lib/platform/contact-picker'

export type ContactProfileSuggestion = {
  fullName: string | null
  phone: string | null
  email: string | null
}

/**
 * Let the user pick a single contact (or Me card) to suggest profile fields.
 * Never uploads the address book — only returns selected fields for confirmation.
 */
export async function suggestProfileFromContacts(): Promise<{
  suggestion: ContactProfileSuggestion | null
  error: string | null
  cancelled?: boolean
}> {
  if (!contactPickerService.isSupported()) {
    return {
      suggestion: null,
      error: 'Contact picker is not available on this device.',
    }
  }

  try {
    const picked = await contactPickerService.pickContacts()
    if (!picked.length) {
      return { suggestion: null, error: null, cancelled: true }
    }

    const contact = picked[0]!
    const phone = contact.phoneNumbers[0]?.value?.trim() || null
    const email = contact.emails[0]?.value?.trim() || null
    const fullName = contact.displayName?.trim() || null

    if (!fullName && !phone && !email) {
      return { suggestion: null, error: 'Selected contact has no usable details.' }
    }

    return {
      suggestion: { fullName, phone, email },
      error: null,
    }
  } catch (error) {
    return {
      suggestion: null,
      error: error instanceof Error ? error.message : 'Could not read contacts.',
    }
  }
}

export function isContactProfileSuggestSupported(): boolean {
  return contactPickerService.isSupported()
}
