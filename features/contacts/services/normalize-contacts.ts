import { isValidEmailFormat } from '~/features/auth/validation'
import { normalizePhoneNumber } from '~/lib/phone/phone'
import { DEFAULT_COUNTRY } from '~/lib/phone/countries'
import type { ContactImportPayloadItem, SelectedContact } from '~/features/contacts/types'

function cleanPhone(raw: string): string {
  return raw.replace(/[^\d+]/g, '').trim()
}

function dedupeStrings(values: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const value of values) {
    const key = value.trim().toLowerCase()
    if (!key || seen.has(key)) continue
    seen.add(key)
    out.push(value.trim())
  }
  return out
}

export function createSelectedContact(input: {
  localId?: string
  displayName?: string
  phoneNumbers?: Array<{ label?: string; value: string }>
  emails?: Array<{ label?: string; value: string }>
}): SelectedContact {
  const phones = (input.phoneNumbers ?? [])
    .map((p) => {
      const value = cleanPhone(p.value)
      if (!value) return null
      const normalized = normalizePhoneNumber(value, DEFAULT_COUNTRY) || undefined
      return {
        label: p.label,
        value,
        normalizedValue: normalized,
        selected: true,
      }
    })
    .filter((p): p is NonNullable<typeof p> => Boolean(p))

  const uniquePhones: SelectedContact['phoneNumbers'] = []
  const phoneKeys = new Set<string>()
  for (const phone of phones) {
    const key = (phone.normalizedValue || phone.value).toLowerCase()
    if (phoneKeys.has(key)) continue
    phoneKeys.add(key)
    uniquePhones.push(phone)
  }

  const emails = (input.emails ?? [])
    .map((e) => {
      const value = e.value.trim().toLowerCase()
      if (!value || !isValidEmailFormat(value)) return null
      return { label: e.label, value, selected: true }
    })
    .filter((e): e is NonNullable<typeof e> => Boolean(e))

  const uniqueEmails: SelectedContact['emails'] = []
  const emailKeys = new Set<string>()
  for (const email of emails) {
    if (emailKeys.has(email.value)) continue
    emailKeys.add(email.value)
    uniqueEmails.push(email)
  }

  return {
    localId: input.localId || `local-${Math.random().toString(36).slice(2, 10)}`,
    displayName: (input.displayName || 'Contact').trim() || 'Contact',
    phoneNumbers: uniquePhones,
    emails: uniqueEmails,
    selected: true,
  }
}

export function mergeSelectedContacts(list: SelectedContact[]): SelectedContact[] {
  const byKey = new Map<string, SelectedContact>()
  for (const contact of list) {
    const phoneKey = contact.phoneNumbers
      .map((p) => (p.normalizedValue || p.value).toLowerCase())
      .sort()
      .join('|')
    const emailKey = contact.emails
      .map((e) => e.value)
      .sort()
      .join('|')
    const key = `${contact.displayName.toLowerCase()}::${phoneKey}::${emailKey}`
    if (!byKey.has(key)) byKey.set(key, contact)
  }
  return Array.from(byKey.values())
}

/** Build API payload — only confirmed/selected fields; no local device IDs. */
export function toImportPayload(contacts: SelectedContact[]): ContactImportPayloadItem[] {
  return contacts
    .filter((c) => c.selected)
    .map((c) => ({
      displayName: c.displayName,
      phoneNumbers: dedupeStrings(
        c.phoneNumbers
          .filter((p) => p.selected)
          .map((p) => p.normalizedValue || p.value)
          .filter(Boolean),
      ),
      emails: dedupeStrings(c.emails.filter((e) => e.selected).map((e) => e.value)),
    }))
    .filter((c) => c.phoneNumbers.length > 0 || c.emails.length > 0)
}
