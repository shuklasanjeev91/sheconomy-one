import { toImportPayload } from '~/features/contacts/services/normalize-contacts'
import type { ContactImportPayloadItem, SelectedContact } from '~/features/contacts/types'
import { supabase } from '~/lib/supabase/client'

export type ImportContactsResult = {
  success: boolean
  imported: number
  error?: string
}

/** Upload only user-confirmed contacts. Never includes full address book. */
export async function importSelectedContacts(
  contacts: SelectedContact[],
  consent: boolean,
): Promise<ImportContactsResult> {
  if (!consent) {
    return { success: false, imported: 0, error: 'Consent is required to import contacts.' }
  }

  const payload = toImportPayload(contacts)
  if (payload.length === 0) {
    return { success: false, imported: 0, error: 'Select at least one contact to import.' }
  }

  return importContactPayload(payload, consent)
}

export async function importContactPayload(
  contacts: ContactImportPayloadItem[],
  consent: boolean,
): Promise<ImportContactsResult> {
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, imported: 0, error: 'Please sign in again to import contacts.' }
  }

  const consentedAt = new Date().toISOString()
  const rows = contacts.map((contact) => ({
    user_id: user.id,
    display_name: contact.displayName,
    phone_numbers: contact.phoneNumbers,
    emails: contact.emails,
    consent: true,
    consented_at: consentedAt,
  }))

  const { error } = await supabase.from('user_imported_contacts' as never).insert(rows as never)

  if (error) {
    return {
      success: false,
      imported: 0,
      error: 'Could not save your selected contacts. Please try again.',
    }
  }

  return { success: true, imported: rows.length }
}
