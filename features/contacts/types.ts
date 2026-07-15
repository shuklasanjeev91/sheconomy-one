export type ContactPermissionStatus =
  | 'unsupported'
  | 'undetermined'
  | 'granted'
  | 'limited'
  | 'denied'
  | 'permanently_denied'

export type SelectedContact = {
  localId: string
  displayName: string
  phoneNumbers: Array<{
    label?: string
    value: string
    normalizedValue?: string
    selected: boolean
  }>
  emails: Array<{
    label?: string
    value: string
    selected: boolean
  }>
  selected: boolean
}

export type ContactImportPayloadItem = {
  displayName: string
  phoneNumbers: string[]
  emails: string[]
}

export interface ContactPickerService {
  isSupported(): boolean
  getPermissionStatus(): Promise<ContactPermissionStatus>
  requestPermission(): Promise<ContactPermissionStatus>
  openSystemSettings(): Promise<void>
  /** Opens a user-driven picker / selection UI. Never silent. */
  pickContacts(): Promise<SelectedContact[]>
}
