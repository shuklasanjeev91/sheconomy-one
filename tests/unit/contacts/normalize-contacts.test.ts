import { describe, expect, it } from 'vitest'

import {
  createSelectedContact,
  mergeSelectedContacts,
  toImportPayload,
} from '~/features/contacts/services/normalize-contacts'

describe('contact normalization', () => {
  it('deduplicates phones and emails', () => {
    const contact = createSelectedContact({
      displayName: 'Ada',
      phoneNumbers: [
        { value: '+91 98765 43210' },
        { value: '+919876543210' },
      ],
      emails: [
        { value: 'ada@example.com' },
        { value: 'ADA@example.com' },
        { value: 'not-an-email' },
      ],
    })
    expect(contact.phoneNumbers.length).toBe(1)
    expect(contact.emails).toEqual([
      expect.objectContaining({ value: 'ada@example.com', selected: true }),
    ])
  })

  it('builds import payload without local ids or deselected fields', () => {
    const contacts = mergeSelectedContacts([
      createSelectedContact({
        localId: 'local-1',
        displayName: 'Ada',
        phoneNumbers: [{ value: '+919876543210' }],
        emails: [{ value: 'ada@example.com' }],
      }),
    ])
    contacts[0]!.emails[0]!.selected = false
    const payload = toImportPayload(contacts)
    expect(payload).toEqual([
      {
        displayName: 'Ada',
        phoneNumbers: [expect.stringMatching(/^\+91/)],
        emails: [],
      },
    ])
    expect(JSON.stringify(payload)).not.toContain('local-1')
  })

  it('skips unselected contacts', () => {
    const contact = createSelectedContact({
      displayName: 'Skip',
      phoneNumbers: [{ value: '+919999999999' }],
    })
    contact.selected = false
    expect(toImportPayload([contact])).toEqual([])
  })
})
