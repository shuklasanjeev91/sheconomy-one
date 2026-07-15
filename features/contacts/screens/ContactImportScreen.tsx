import { useMemo, useState } from 'react'
import { Platform } from 'react-native'

import { FullWidthLayout, LAYOUT_STRETCH, PageSection } from '~/components/layout'
import {
  Button,
  Icons,
  Spinner,
  Text,
  XStack,
  YStack,
  useAppToast,
} from '~/components/ui'
import { importSelectedContacts } from '~/features/contacts/services/import-contacts'
import type { ContactPermissionStatus, SelectedContact } from '~/features/contacts/types'
import { useAuth } from '~/hooks/useAuth'
import { contactPickerService } from '~/lib/platform/contact-picker'
import { useAppUi } from '~/lib/theme/useAppUi'

type ContactImportScreenProps = {
  returnTo?: string | null
}

export function ContactImportScreen({ returnTo }: ContactImportScreenProps) {
  const ui = useAppUi()
  const toast = useAppToast()
  const { completeSignIn } = useAuth()
  const [busy, setBusy] = useState(false)
  const [permission, setPermission] = useState<ContactPermissionStatus>('undetermined')
  const [contacts, setContacts] = useState<SelectedContact[]>([])
  const [unsupportedHint, setUnsupportedHint] = useState<string | null>(null)

  const selectedCount = useMemo(
    () => contacts.filter((c) => c.selected).length,
    [contacts],
  )

  async function finish() {
    await completeSignIn(returnTo)
  }

  async function handlePick() {
    setUnsupportedHint(null)
    if (!contactPickerService.isSupported()) {
      setUnsupportedHint(
        Platform.OS === 'web'
          ? 'Contact selection is not supported in this browser. You can continue without importing contacts.'
          : 'Contact selection is unavailable on this device. You can continue without importing contacts.',
      )
      return
    }

    setBusy(true)
    const status = await contactPickerService.requestPermission()
    setPermission(status)

    if (status === 'unsupported') {
      setUnsupportedHint(
        'Contact selection is not supported in this browser. You can continue without importing contacts.',
      )
      setBusy(false)
      return
    }

    if (status === 'denied' || status === 'permanently_denied') {
      setBusy(false)
      return
    }

    const picked = await contactPickerService.pickContacts()
    setContacts(picked)
    setBusy(false)

    if (picked.length === 0) {
      toast.show('No contacts selected', {
        tone: 'info',
        message: 'You can try again or continue without importing.',
      })
    }
  }

  async function handleImport() {
    setBusy(true)
    const result = await importSelectedContacts(contacts, true)
    setBusy(false)
    if (!result.success) {
      toast.show(result.error ?? 'Import failed', { tone: 'danger' })
      return
    }
    toast.show('Contacts saved', {
      tone: 'success',
      message: `${result.imported} contact${result.imported === 1 ? '' : 's'} imported.`,
    })
    await finish()
  }

  return (
    <FullWidthLayout scroll>
      <PageSection paddingVertical="$6" {...LAYOUT_STRETCH}>
        <YStack gap="$4" maxWidth={520} width="100%" alignSelf="center">
          <YStack gap="$2">
            <Text fontSize={24} fontWeight="800" color={ui.text} letterSpacing={-0.4}>
              Find people you know
            </Text>
            <Text fontSize={15} color={ui.textMuted} lineHeight={22}>
              We use only the contacts you select to help you find people you know. We do not
              upload your complete address book.
            </Text>
          </YStack>

          {unsupportedHint ? (
            <YStack
              padding="$3.5"
              borderRadius={14}
              backgroundColor={ui.surfaceMuted}
              borderWidth={1}
              borderColor={ui.borderSubtle}
              gap="$2"
            >
              <Text fontSize={14} color={ui.text} lineHeight={20}>
                {unsupportedHint}
              </Text>
            </YStack>
          ) : null}

          {(permission === 'denied' || permission === 'permanently_denied') && (
            <YStack
              padding="$3.5"
              borderRadius={14}
              backgroundColor="rgba(185, 28, 28, 0.06)"
              borderWidth={1}
              borderColor="rgba(185, 28, 28, 0.14)"
              gap="$3"
            >
              <Text fontSize={14} color={ui.error} lineHeight={20}>
                Contacts permission was denied. You can open Settings to allow access, or continue
                without importing.
              </Text>
              {permission === 'permanently_denied' ? (
                <Button
                  tone="outline"
                  onPress={() => void contactPickerService.openSystemSettings()}
                >
                  Open Settings
                </Button>
              ) : null}
            </YStack>
          )}

          <Button
            tone="primary"
            size="$4"
            borderRadius={999}
            disabled={busy}
            onPress={() => void handlePick()}
            icon={busy ? <Spinner size="small" color="white" /> : <Icons.Users size={18} />}
          >
            {busy ? 'Opening…' : 'Select contacts'}
          </Button>

          {contacts.length > 0 ? (
            <YStack gap="$3">
              <Text fontSize={14} fontWeight="700" color={ui.text}>
                Review selection ({selectedCount})
              </Text>
              {contacts.map((contact) => (
                <YStack
                  key={contact.localId}
                  padding="$3"
                  borderRadius={14}
                  borderWidth={1}
                  borderColor={ui.borderSubtle}
                  backgroundColor={ui.surface}
                  gap="$2"
                  opacity={contact.selected ? 1 : 0.55}
                >
                  <XStack justifyContent="space-between" alignItems="center" gap="$2">
                    <Text fontWeight="700" color={ui.text} flex={1}>
                      {contact.displayName}
                    </Text>
                    <Text
                      color={ui.brand}
                      fontWeight="700"
                      cursor="pointer"
                      onPress={() =>
                        setContacts((current) =>
                          current.map((c) =>
                            c.localId === contact.localId
                              ? { ...c, selected: !c.selected }
                              : c,
                          ),
                        )
                      }
                    >
                      {contact.selected ? 'Remove' : 'Include'}
                    </Text>
                  </XStack>
                  {contact.phoneNumbers.map((phone, index) => (
                    <XStack key={`${contact.localId}-p-${index}`} gap="$2" alignItems="center">
                      <Text
                        fontSize={13}
                        color={phone.selected ? ui.text : ui.textMuted}
                        flex={1}
                      >
                        {phone.normalizedValue || phone.value}
                      </Text>
                      <Text
                        fontSize={12}
                        color={ui.brand}
                        cursor="pointer"
                        onPress={() =>
                          setContacts((current) =>
                            current.map((c) =>
                              c.localId !== contact.localId
                                ? c
                                : {
                                    ...c,
                                    phoneNumbers: c.phoneNumbers.map((p, i) =>
                                      i === index ? { ...p, selected: !p.selected } : p,
                                    ),
                                  },
                            ),
                          )
                        }
                      >
                        {phone.selected ? 'Deselect' : 'Select'}
                      </Text>
                    </XStack>
                  ))}
                  {contact.emails.map((email, index) => (
                    <XStack key={`${contact.localId}-e-${index}`} gap="$2" alignItems="center">
                      <Text
                        fontSize={13}
                        color={email.selected ? ui.text : ui.textMuted}
                        flex={1}
                      >
                        {email.value}
                      </Text>
                      <Text
                        fontSize={12}
                        color={ui.brand}
                        cursor="pointer"
                        onPress={() =>
                          setContacts((current) =>
                            current.map((c) =>
                              c.localId !== contact.localId
                                ? c
                                : {
                                    ...c,
                                    emails: c.emails.map((e, i) =>
                                      i === index ? { ...e, selected: !e.selected } : e,
                                    ),
                                  },
                            ),
                          )
                        }
                      >
                        {email.selected ? 'Deselect' : 'Select'}
                      </Text>
                    </XStack>
                  ))}
                </YStack>
              ))}

              <Button
                tone="primary"
                size="$4"
                borderRadius={999}
                disabled={busy || selectedCount === 0}
                onPress={() => void handleImport()}
              >
                Import selected contacts
              </Button>
            </YStack>
          ) : null}

          <Button tone="ghost" size="$4" disabled={busy} onPress={() => void finish()}>
            Skip for now
          </Button>
        </YStack>
      </PageSection>
    </FullWidthLayout>
  )
}
