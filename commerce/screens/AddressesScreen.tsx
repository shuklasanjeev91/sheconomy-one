import { useCallback, useEffect, useState } from 'react'

import {
  AddressForm,
  EMPTY_ADDRESS_INPUT,
  addressInputFromUserAddress,
} from '~/commerce/components/AddressForm'
import { CommercePageHeader, CommercePanel } from '~/commerce/components'
import {
  createUserAddress,
  deleteUserAddress,
  fetchUserAddresses,
  formatAddressBlock,
  setDefaultUserAddress,
  updateUserAddress,
  type AddressInput,
  type UserAddress,
} from '~/commerce/lib/addresses'
import { Button, Icons, Spinner, Text, XStack, YStack, useAppToast } from '~/components/ui'
import { FullWidthLayout, LAYOUT_STRETCH, PageSection, StickyRail } from '~/components/layout'
import { getShadowStyle, radius } from '~/config/tokens'
import { useAppLayout } from '~/hooks/useAppLayout'
import { useProfile } from '~/hooks/useProfile'
import { useAppUi } from '~/lib/theme/useAppUi'

const FORM_RAIL_WIDTH = 420

export function AddressesScreen() {
  const ui = useAppUi()
  const { isDesktop, isWide } = useAppLayout()
  const toast = useAppToast()
  const { user } = useProfile()
  const [addresses, setAddresses] = useState<UserAddress[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formValue, setFormValue] = useState<AddressInput>(EMPTY_ADDRESS_INPUT)
  const [makeDefault, setMakeDefault] = useState(false)

  const load = useCallback(async () => {
    setIsLoading(true)
    const result = await fetchUserAddresses(user?.id)
    setAddresses(result.addresses)
    setError(result.error)
    setIsLoading(false)
  }, [user?.id])

  useEffect(() => {
    void load()
  }, [load])

  function resetForm() {
    setFormValue(EMPTY_ADDRESS_INPUT)
    setMakeDefault(false)
    setShowAddForm(false)
    setEditingId(null)
  }

  function startAdd() {
    setEditingId(null)
    setFormValue(EMPTY_ADDRESS_INPUT)
    setMakeDefault(addresses.length === 0)
    setShowAddForm(true)
  }

  function startEdit(address: UserAddress) {
    setShowAddForm(false)
    setEditingId(address.id)
    setFormValue(addressInputFromUserAddress(address))
    setMakeDefault(address.is_default)
  }

  async function handleSave() {
    if (!user?.id) return

    setIsSaving(true)

    if (editingId) {
      const current = addresses.find((row) => row.id === editingId)
      const { error: saveError } = await updateUserAddress(user.id, editingId, formValue)
      if (saveError) {
        setIsSaving(false)
        toast.show('Could not update address', { tone: 'danger', message: saveError })
        return
      }
      if (makeDefault && !current?.is_default) {
        await setDefaultUserAddress(user.id, editingId)
      } else if (!makeDefault && current?.is_default) {
        const fallback = addresses.find((row) => row.id !== editingId)
        if (fallback) {
          await setDefaultUserAddress(user.id, fallback.id)
        }
      }
      toast.show('Address updated', { tone: 'success' })
    } else {
      const { address, error: saveError } = await createUserAddress(user.id, formValue, {
        isDefault: makeDefault,
      })
      if (saveError || !address) {
        setIsSaving(false)
        toast.show('Could not save address', { tone: 'danger', message: saveError ?? undefined })
        return
      }
      toast.show('Address added', { tone: 'success' })
    }

    setIsSaving(false)
    resetForm()
    void load()
  }

  async function handleSetDefault(address: UserAddress) {
    if (!user?.id || address.is_default) return
    const { error: updateError } = await setDefaultUserAddress(user.id, address.id)
    if (updateError) {
      toast.show('Could not update default', { tone: 'danger', message: updateError })
      return
    }
    void load()
  }

  async function handleDelete(address: UserAddress) {
    if (!user?.id) return
    const { error: removeError } = await deleteUserAddress(user.id, address.id)
    if (removeError) {
      toast.show('Could not delete address', { tone: 'danger', message: removeError })
      return
    }
    if (editingId === address.id) {
      resetForm()
    }
    toast.show('Address removed', { tone: 'success' })
    void load()
  }

  const isFormOpen = showAddForm || editingId !== null
  const defaultAddress = addresses.find((address) => address.is_default)

  const formPanel = isFormOpen ? (
    <CommercePanel padding="$5" gap="$3" width="100%" style={getShadowStyle('md')}>
      <Text fontWeight="700" fontSize={18} color={ui.text} letterSpacing={-0.2}>
        {editingId ? 'Edit address' : 'Add a new address'}
      </Text>
      <AddressForm
        value={formValue}
        onChange={setFormValue}
        onSubmit={() => void handleSave()}
        onCancel={resetForm}
        submitLabel={editingId ? 'Save changes' : 'Add address'}
        isSubmitting={isSaving}
        showDefaultToggle
        isDefault={makeDefault}
        onDefaultChange={setMakeDefault}
      />
    </CommercePanel>
  ) : (
    <CommercePanel padding="$5" gap="$4" width="100%" style={getShadowStyle('md')}>
      <Text fontWeight="700" fontSize={18} color={ui.text} letterSpacing={-0.2}>
        Delivery details
      </Text>
      <YStack gap="$2">
        <Text fontSize={14} color={ui.textSecondary} lineHeight={20}>
          Save addresses you ship to often. Your default address is pre-selected at checkout.
        </Text>
        {defaultAddress ? (
          <YStack
            gap="$1"
            padding="$3"
            borderRadius={radius.card}
            backgroundColor={ui.surfaceMuted}
            borderWidth={1}
            borderColor={ui.borderSubtle}
          >
            <Text fontSize={12} fontWeight="700" color={ui.brand}>
              Default address
            </Text>
            <Text fontSize={13} color={ui.textSecondary} lineHeight={18}>
              {formatAddressBlock(defaultAddress)}
            </Text>
          </YStack>
        ) : null}
      </YStack>
      <Button
        tone="primary"
        size="$4"
        borderRadius={999}
        width="100%"
        icon={<Icons.Plus size={18} />}
        onPress={startAdd}
      >
        Add a new address
      </Button>
    </CommercePanel>
  )

  return (
    <FullWidthLayout scroll>
      <PageSection paddingVertical="$6" {...LAYOUT_STRETCH}>
        <YStack gap="$6" width="100%" maxWidth="100%" alignSelf="stretch">
          <CommercePageHeader
            title="Delivery addresses"
            subtitle={
              addresses.length
                ? `${addresses.length} saved ${addresses.length === 1 ? 'address' : 'addresses'}`
                : 'Add, edit, and manage shipping addresses for your orders'
            }
          />

          {isLoading ? (
            <YStack alignItems="center" paddingVertical="$10">
              <Spinner size="large" />
            </YStack>
          ) : error ? (
            <Text color={ui.danger} fontSize={14}>
              {error}
            </Text>
          ) : (
            <XStack
              width="100%"
              maxWidth="100%"
              alignSelf="stretch"
              flexDirection={isDesktop ? 'row' : 'column'}
              alignItems="flex-start"
              gap={isWide ? 32 : 24}
            >
              <YStack flex={1} minWidth={0} width="100%" gap="$4">
                {addresses.length === 0 && !isFormOpen ? (
                  <CommercePanel padding="$8" alignItems="center" gap="$3" width="100%">
                    <YStack
                      width={56}
                      height={56}
                      borderRadius={radius.pill}
                      backgroundColor={ui.chip}
                      alignItems="center"
                      justifyContent="center"
                    >
                      <Icons.MapPin size={28} color={ui.brand} />
                    </YStack>
                    <Text fontWeight="700" fontSize={18} color={ui.text}>
                      No saved addresses
                    </Text>
                    <Text color={ui.textSecondary} fontSize={14} textAlign="center" maxWidth={420}>
                      Add a delivery address to speed up checkout and track orders to the right place.
                    </Text>
                    {!isDesktop ? (
                      <Button
                        tone="primary"
                        size="$4"
                        borderRadius={999}
                        icon={<Icons.Plus size={18} />}
                        onPress={startAdd}
                      >
                        Add your first address
                      </Button>
                    ) : null}
                  </CommercePanel>
                ) : (
                  <CommercePanel padding="$0" gap="$0" overflow="hidden" width="100%">
                    <XStack
                      alignItems="center"
                      gap="$2"
                      paddingHorizontal="$5"
                      paddingTop="$5"
                      paddingBottom="$3"
                      borderBottomWidth={1}
                      borderBottomColor={ui.borderSubtle}
                    >
                      <Icons.MapPin size={16} color={ui.brand} />
                      <Text fontWeight="700" fontSize={15} color={ui.text} letterSpacing={-0.15}>
                        Saved addresses
                      </Text>
                    </XStack>

                    <YStack width="100%">
                      {addresses.map((address, index) => (
                        <SavedAddressRow
                          key={address.id}
                          address={address}
                          isEditing={editingId === address.id}
                          isDesktop={isDesktop}
                          showDivider={index > 0}
                          onEdit={() => startEdit(address)}
                          onSetDefault={() => void handleSetDefault(address)}
                          onDelete={() => void handleDelete(address)}
                        />
                      ))}
                    </YStack>
                  </CommercePanel>
                )}

                {!isDesktop && isFormOpen ? formPanel : null}

                {!isDesktop && !isFormOpen && addresses.length > 0 ? (
                  <Button
                    tone="primary"
                    size="$4"
                    borderRadius={999}
                    alignSelf="stretch"
                    icon={<Icons.Plus size={18} />}
                    onPress={startAdd}
                  >
                    Add a new address
                  </Button>
                ) : null}
              </YStack>

              {isDesktop ? (
                <StickyRail width={FORM_RAIL_WIDTH} maxWidth="100%" flexShrink={0}>
                  {formPanel}
                </StickyRail>
              ) : null}
            </XStack>
          )}
        </YStack>
      </PageSection>
    </FullWidthLayout>
  )
}

function SavedAddressRow({
  address,
  isEditing,
  isDesktop,
  showDivider,
  onEdit,
  onSetDefault,
  onDelete,
}: {
  address: UserAddress
  isEditing: boolean
  isDesktop: boolean
  showDivider: boolean
  onEdit: () => void
  onSetDefault: () => void
  onDelete: () => void
}) {
  const ui = useAppUi()

  return (
    <YStack width="100%">
      {showDivider ? <YStack height={1} backgroundColor={ui.borderSubtle} /> : null}
      <XStack
        width="100%"
        paddingHorizontal="$5"
        paddingVertical="$4"
        gap="$4"
        alignItems={isDesktop ? 'center' : 'flex-start'}
        flexDirection={isDesktop ? 'row' : 'column'}
        backgroundColor={isEditing ? ui.surfaceMuted : 'transparent'}
        borderLeftWidth={isEditing ? 3 : 0}
        borderLeftColor={isEditing ? ui.brand : 'transparent'}
      >
        <XStack gap="$3" alignItems="flex-start" flex={1} minWidth={0} width="100%">
          <YStack
            width={44}
            height={44}
            borderRadius={radius.chip}
            backgroundColor={ui.chip}
            alignItems="center"
            justifyContent="center"
            flexShrink={0}
          >
            <Icons.MapPin size={22} color={ui.text} />
          </YStack>
          <YStack flex={1} gap={4} minWidth={0}>
            <XStack gap="$2" alignItems="center" flexWrap="wrap">
              <Text fontWeight="700" fontSize={15} color={ui.text}>
                {address.address_label || 'Address'}
              </Text>
              {address.is_default ? (
                <XStack
                  paddingHorizontal="$2"
                  paddingVertical={2}
                  borderRadius={999}
                  backgroundColor={ui.chip}
                >
                  <Text fontSize={11} fontWeight="700" color={ui.brand}>
                    Default
                  </Text>
                </XStack>
              ) : null}
            </XStack>
            <Text fontSize={14} color={ui.textSecondary} lineHeight={20}>
              {formatAddressBlock(address)}
            </Text>
          </YStack>
        </XStack>

        <XStack
          gap="$2"
          flexWrap="wrap"
          flexShrink={0}
          alignSelf={isDesktop ? 'center' : 'stretch'}
          justifyContent={isDesktop ? 'flex-end' : 'flex-start'}
        >
          <Button tone="outline" size="$2.5" borderRadius={999} onPress={onEdit}>
            Edit
          </Button>
          {!address.is_default ? (
            <Button tone="outline" size="$2.5" borderRadius={999} onPress={onSetDefault}>
              Set as default
            </Button>
          ) : null}
          <Button tone="outline" size="$2.5" borderRadius={999} onPress={onDelete}>
            Delete
          </Button>
        </XStack>
      </XStack>
    </YStack>
  )
}
