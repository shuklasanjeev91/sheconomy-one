import { useEffect, useMemo, useState } from 'react'

import { CommercePageHeader, CommercePanel } from '~/commerce/components'
import { AddressDeleteDrawer } from '~/commerce/components/address/AddressDeleteDrawer'
import { AddressFormDrawer } from '~/commerce/components/address/AddressFormDrawer'
import { AddressList } from '~/commerce/components/address/AddressList'
import { AddressStatsPanel } from '~/commerce/components/address/AddressStats'
import { Button, Icons, Spinner, Tabs, TabsList, TabsTrigger, Text, XStack, YStack, useAppToast } from '~/components/ui'
import { getShadowStyle, radius } from '~/config/tokens'
import { useAppLayout } from '~/hooks/useAppLayout'
import { useProfile } from '~/hooks/useProfile'
import {
  ADDRESS_TYPES,
  type Address,
  type AddressFormData,
  type AddressType,
} from '~/lib/address/address.type'
import {
  createAddress,
  deleteAddress,
  loadAddressStats,
  loadAddresses,
  setDefaultAddress,
  updateAddress,
} from '~/lib/address/address.store'
import { getAddressTypeLabel, groupAddressesByType } from '~/lib/address/address.utils'
import { useAppDispatch, useAppSelector } from '~/lib/store/hooks'
import { QA } from '~/lib/qa/test-ids'
import { useAppUi } from '~/lib/theme/useAppUi'

type AddressManagerProps = {
  /** When set, an admin loads addresses for this user instead of self. */
  targetUserId?: string | null
  title?: string
  subtitle?: string
}

export function AddressManager({
  targetUserId,
  title = 'Address management',
  subtitle = 'Manage your shipping, billing, and other addresses.',
}: AddressManagerProps) {
  const ui = useAppUi()
  const toast = useAppToast()
  const dispatch = useAppDispatch()
  const { isDesktop } = useAppLayout()
  const { user } = useProfile()

  const addresses = useAppSelector((s) => s.address.addresses)
  const stats = useAppSelector((s) => s.address.stats)
  const isLoading = useAppSelector((s) => s.address.isLoading)
  const isSaving = useAppSelector((s) => s.address.isSaving)
  const isDeleting = useAppSelector((s) => s.address.isDeleting)
  const error = useAppSelector((s) => s.address.error)

  const [activeTab, setActiveTab] = useState<'all' | AddressType>('all')
  const [formOpen, setFormOpen] = useState(false)
  const [editingAddress, setEditingAddress] = useState<Address | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Address | null>(null)

  const grouped = useMemo(() => groupAddressesByType(addresses), [addresses])

  const tabAddresses = useMemo(() => {
    if (activeTab === 'all') return addresses
    return addresses.filter((row) => row.address_type === activeTab)
  }, [activeTab, addresses])

  useEffect(() => {
    void dispatch(loadAddresses({ targetUserId, forceRefresh: true }))
    void dispatch(loadAddressStats(targetUserId ?? undefined))
  }, [dispatch, targetUserId])

  useEffect(() => {
    if (error) {
      toast.show('Address error', { tone: 'danger', message: error })
    }
  }, [error, toast])

  function openCreate() {
    setEditingAddress(null)
    setFormOpen(true)
  }

  function openEdit(address: Address) {
    setEditingAddress(address)
    setFormOpen(true)
  }

  async function handleSave(formData: AddressFormData) {
    try {
      if (editingAddress) {
        await dispatch(updateAddress({ addressId: editingAddress.id, input: formData })).unwrap()
        toast.show('Address updated', { tone: 'success', message: 'Your changes have been saved.' })
      } else {
        await dispatch(createAddress({ input: formData, userId: targetUserId ?? user?.id })).unwrap()
        toast.show('Address added', { tone: 'success', message: 'Your new address is ready to use.' })
      }
      setFormOpen(false)
      setEditingAddress(null)
      void dispatch(loadAddressStats(targetUserId ?? undefined))
    } catch (message) {
      toast.show(editingAddress ? 'Could not update address' : 'Could not add address', {
        tone: 'danger',
        message: String(message),
      })
    }
  }

  async function handleSetDefault(address: Address) {
    try {
      await dispatch(setDefaultAddress(address.id)).unwrap()
      toast.show('Default updated', {
        tone: 'success',
        message: `${getAddressTypeLabel(address.address_type)} default address changed.`,
      })
      void dispatch(loadAddressStats(targetUserId ?? undefined))
    } catch (message) {
      toast.show('Could not set default', { tone: 'danger', message: String(message) })
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return
    try {
      await dispatch(deleteAddress(deleteTarget.id)).unwrap()
      toast.show('Address deleted', { tone: 'success' })
      setDeleteTarget(null)
      void dispatch(loadAddressStats(targetUserId ?? undefined))
    } catch (message) {
      toast.show('Could not delete address', { tone: 'danger', message: String(message) })
    }
  }

  return (
    <YStack gap="$5" width="100%" maxWidth="100%">
      <XStack alignItems="flex-start" justifyContent="space-between" gap="$3" flexWrap="wrap">
        <CommercePageHeader title={title} subtitle={subtitle} />
        <Button
          tone="primary"
          size="$4"
          borderRadius={999}
          disabled={isLoading || isSaving}
          icon={<Icons.Plus size={18} />}
          onPress={openCreate}
          testID={QA.addressAdd}
          accessibilityLabel="Add address"
        >
          Add address
        </Button>
      </XStack>

      <AddressStatsPanel ui={ui} stats={stats} />

      {isLoading ? (
        <YStack alignItems="center" paddingVertical="$10">
          <Spinner size="large" />
        </YStack>
      ) : addresses.length === 0 ? (
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
            No addresses yet
          </Text>
          <Text color={ui.textSecondary} fontSize={14} textAlign="center" maxWidth={420}>
            Add your first address to speed up checkout and keep shipping details organised.
          </Text>
          <Button tone="primary" size="$4" borderRadius={999} icon={<Icons.Plus size={18} />} onPress={openCreate}>
            Add your first address
          </Button>
        </CommercePanel>
      ) : (
        <CommercePanel padding="$4" gap="$4" width="100%" style={getShadowStyle('md')}>
          <Text fontWeight="700" fontSize={16} color={ui.text}>
            Your addresses
          </Text>

          <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'all' | AddressType)}>
            <TabsList flexWrap="wrap" gap="$2">
              <TabsTrigger value="all" active={activeTab === 'all'}>
                <Text fontWeight="600">All ({addresses.length})</Text>
              </TabsTrigger>
              {ADDRESS_TYPES.map((type) => (
                <TabsTrigger key={type} value={type} active={activeTab === type}>
                  <Text fontWeight="600">
                    {getAddressTypeLabel(type)} ({grouped[type]?.length ?? 0})
                  </Text>
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          <AddressList
            ui={ui}
            addresses={tabAddresses}
            isDesktop={isDesktop}
            loading={isLoading}
            emptyMessage={
              activeTab === 'all'
                ? 'No addresses found'
                : `No ${getAddressTypeLabel(activeTab).toLowerCase()} addresses yet`
            }
            onEdit={openEdit}
            onSetDefault={(address) => void handleSetDefault(address)}
            onDelete={setDeleteTarget}
          />
        </CommercePanel>
      )}

      <AddressFormDrawer
        ui={ui}
        open={formOpen}
        isDesktop={isDesktop}
        editingAddress={editingAddress}
        submitting={isSaving}
        onClose={() => {
          setFormOpen(false)
          setEditingAddress(null)
        }}
        onSubmit={(formData) => void handleSave(formData)}
      />

      <AddressDeleteDrawer
        ui={ui}
        open={Boolean(deleteTarget)}
        isDesktop={isDesktop}
        address={deleteTarget}
        submitting={isDeleting}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => void handleDelete()}
      />
    </YStack>
  )
}
