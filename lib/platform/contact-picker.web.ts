import {
  createSelectedContact,
  mergeSelectedContacts,
} from '~/features/contacts/services/normalize-contacts'
import type { ContactPickerService, ContactPermissionStatus, SelectedContact } from '~/features/contacts/types'

type ContactInfo = {
  name?: Array<{ displayName?: string; givenName?: string; familyName?: string }>
  email?: Array<{ value?: string }>
  tel?: Array<{ value?: string }>
}

type ContactsManager = {
  select: (
    properties: string[],
    options?: { multiple?: boolean },
  ) => Promise<ContactInfo[]>
}

function getContactsManager(): ContactsManager | null {
  if (typeof navigator === 'undefined') return null
  const nav = navigator as Navigator & { contacts?: ContactsManager }
  return nav.contacts ?? null
}

export const contactPickerService: ContactPickerService = {
  isSupported() {
    return Boolean(getContactsManager())
  },

  async getPermissionStatus(): Promise<ContactPermissionStatus> {
    return this.isSupported() ? 'undetermined' : 'unsupported'
  },

  async requestPermission(): Promise<ContactPermissionStatus> {
    return this.isSupported() ? 'granted' : 'unsupported'
  },

  async openSystemSettings() {
    // Browsers have no deep link for contacts permission.
  },

  async pickContacts(): Promise<SelectedContact[]> {
    const manager = getContactsManager()
    if (!manager) return []

    try {
      const results = await manager.select(['name', 'email', 'tel'], { multiple: true })
      const mapped = (results ?? []).map((row, index) => {
        const name =
          row.name?.[0]?.displayName ||
          [row.name?.[0]?.givenName, row.name?.[0]?.familyName].filter(Boolean).join(' ')
        return createSelectedContact({
          localId: `web-${index}-${Date.now()}`,
          displayName: name || 'Contact',
          phoneNumbers: (row.tel ?? [])
            .map((t) => ({ value: t.value || '' }))
            .filter((t) => t.value),
          emails: (row.email ?? [])
            .map((e) => ({ value: e.value || '' }))
            .filter((e) => e.value),
        })
      })
      return mergeSelectedContacts(mapped)
    } catch {
      // User cancelled or browser denied — treat as empty selection.
      return []
    }
  },
}

export default contactPickerService
