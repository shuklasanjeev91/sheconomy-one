import * as Contacts from 'expo-contacts'
import { Linking, Platform } from 'react-native'

import {
  createSelectedContact,
  mergeSelectedContacts,
} from '~/features/contacts/services/normalize-contacts'
import type {
  ContactPermissionStatus,
  ContactPickerService,
  SelectedContact,
} from '~/features/contacts/types'

function mapPermission(
  status: Contacts.PermissionStatus,
  canAskAgain?: boolean,
): ContactPermissionStatus {
  if (status === Contacts.PermissionStatus.GRANTED) return 'granted'
  if (status === 'limited' as Contacts.PermissionStatus) return 'limited'
  if (status === Contacts.PermissionStatus.DENIED) {
    return canAskAgain === false ? 'permanently_denied' : 'denied'
  }
  return 'undetermined'
}

async function pickViaSystemPicker(): Promise<SelectedContact[] | null> {
  const present = (
    Contacts as typeof Contacts & {
      presentContactPickerAsync?: () => Promise<Contacts.ExistingContact | null>
    }
  ).presentContactPickerAsync

  if (typeof present !== 'function') return null

  try {
    const contact = await present()
    if (!contact) return []
    return [
      createSelectedContact({
        localId: contact.id || `native-${Date.now()}`,
        displayName: contact.name || contact.firstName || 'Contact',
        phoneNumbers: (contact.phoneNumbers ?? []).map((p) => ({
          label: p.label,
          value: p.number || '',
        })),
        emails: (contact.emails ?? []).map((e) => ({
          label: e.label,
          value: e.email || '',
        })),
      }),
    ]
  } catch {
    return []
  }
}

export const contactPickerService: ContactPickerService = {
  isSupported() {
    return Platform.OS === 'ios' || Platform.OS === 'android'
  },

  async getPermissionStatus() {
    const current = await Contacts.getPermissionsAsync()
    return mapPermission(current.status, current.canAskAgain)
  },

  async requestPermission() {
    const current = await Contacts.requestPermissionsAsync()
    return mapPermission(current.status, current.canAskAgain)
  },

  async openSystemSettings() {
    await Linking.openSettings()
  },

  async pickContacts() {
    // Prefer one-shot system picker (no full address-book read).
    const viaPicker = await pickViaSystemPicker()
    if (viaPicker) return mergeSelectedContacts(viaPicker)

    const permission = await this.requestPermission()
    if (permission !== 'granted' && permission !== 'limited') {
      return []
    }

    // Fallback: load contacts only after explicit grant; caller uploads
    // only user-selected rows. Cap fetch to keep memory modest.
    const result = await Contacts.getContactsAsync({
      fields: [Contacts.Fields.Name, Contacts.Fields.PhoneNumbers, Contacts.Fields.Emails],
      pageSize: 200,
      pageOffset: 0,
      sort: Contacts.SortTypes.FirstName,
    })

    const mapped = (result.data ?? []).map((contact) =>
      createSelectedContact({
        localId: contact.id,
        displayName: contact.name || contact.firstName || 'Contact',
        phoneNumbers: (contact.phoneNumbers ?? []).map((p) => ({
          label: p.label,
          value: p.number || '',
        })),
        emails: (contact.emails ?? []).map((e) => ({
          label: e.label,
          value: e.email || '',
        })),
      }),
    )

    return mergeSelectedContacts(
      mapped.filter((c) => c.phoneNumbers.length > 0 || c.emails.length > 0),
    )
  },
}

export default contactPickerService
