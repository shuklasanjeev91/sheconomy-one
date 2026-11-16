import { useCallback, useEffect, useMemo, useState } from 'react'
import { AppLink } from '~/components/navigation'
import {
  Button,
  Input,
  Spinner,
  Text,
  XStack,
  YStack,
  useAppToast,
} from '~/components/ui'
import {
  fetchListingWarehouseStock,
  saveListingWarehouseStock,
  type ListingWarehouseStock,
} from '~/commerce/lib/warehouse-inventory'
import { vendorRoutes } from '~/lib/routes'
import type { AppUiTokens } from '~/lib/theme/app-ui'

type VendorListingWarehouseStockProps = {
  ui: AppUiTokens
  shopId: string
  listingId: string
  listingQuantity?: number | null
  compact?: boolean
  onSaved?: (listingQuantity: number | null) => void
}

export function VendorListingWarehouseStock({
  ui,
  shopId,
  listingId,
  listingQuantity,
  compact = false,
  onSaved,
}: VendorListingWarehouseStockProps) {
  const toast = useAppToast()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [stock, setStock] = useState<ListingWarehouseStock | null>(null)
  const [draftQty, setDraftQty] = useState<Record<string, string>>({})

  const load = useCallback(async () => {
    setLoading(true)
    const { stock: next, error } = await fetchListingWarehouseStock({
      shopId,
      listingId,
      listingQuantity,
    })
    setLoading(false)
    if (error) {
      toast.show('Could not load warehouse stock', { tone: 'danger', message: error })
      return
    }
    setStock(next)
    const draft: Record<string, string> = {}
    for (const row of next?.warehouses ?? []) {
      draft[row.warehouseId] = String(row.availableQuantity)
    }
    setDraftQty(draft)
  }, [listingId, listingQuantity, shopId, toast])

  useEffect(() => {
    void load()
  }, [load])

  const totalDraft = useMemo(() => {
    if (!stock?.warehouses.length) return listingQuantity ?? 0
    return stock.warehouses.reduce((sum, row) => {
      const raw = draftQty[row.warehouseId]
      const n = Number(raw)
      return sum + (Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0)
    }, 0)
  }, [draftQty, listingQuantity, stock?.warehouses])

  const dirty = useMemo(() => {
    if (!stock?.warehouses.length) return false
    return stock.warehouses.some((row) => {
      const n = Number(draftQty[row.warehouseId])
      const next = Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0
      return next !== row.availableQuantity
    })
  }, [draftQty, stock?.warehouses])

  async function handleSave() {
    if (!stock?.warehouses.length) return
    setSaving(true)
    const quantities = stock.warehouses.map((row) => {
      const n = Number(draftQty[row.warehouseId])
      return {
        warehouseId: row.warehouseId,
        availableQuantity: Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0,
      }
    })
    const result = await saveListingWarehouseStock({
      shopId,
      listingId,
      quantities,
    })
    setSaving(false)
    if (result.error) {
      toast.show('Could not save stock', { tone: 'danger', message: result.error })
      return
    }
    toast.show('Warehouse stock saved', {
      tone: 'success',
      message: `Total available: ${result.listingQuantity ?? totalDraft}`,
    })
    onSaved?.(result.listingQuantity)
    await load()
  }

  if (loading) {
    return (
      <XStack alignItems="center" gap="$2" paddingVertical="$2">
        <Spinner size="small" />
        <Text fontSize={12} color={ui.textMuted}>
          Loading warehouse stock…
        </Text>
      </XStack>
    )
  }

  if (!stock) return null

  if (!stock.warehouses.length) {
    return (
      <YStack
        gap="$2"
        padding={compact ? '$2' : '$3'}
        borderWidth={1}
        borderColor={ui.borderSubtle}
        borderRadius={12}
        backgroundColor={ui.surfaceMuted}
      >
        <Text fontSize={13} fontWeight="700" color={ui.text}>
          Inventory location
        </Text>
        <Text fontSize={12.5} color={ui.textMuted} lineHeight={18}>
          No warehouse set up yet. Stock stays on the listing and ship-from uses your{' '}
          <Text fontWeight="700" color={ui.text}>
            shop address
          </Text>
          .
        </Text>
        <Text fontSize={12} color={ui.textMuted}>
          Current stock: {stock.listingQuantity}
        </Text>
        <AppLink href={vendorRoutes.settingsSection('warehouse')}>
          <Text fontSize={13} fontWeight="700" color={ui.link} textDecorationLine="underline">
            Set up warehouse under Fulfillment
          </Text>
        </AppLink>
      </YStack>
    )
  }

  return (
    <YStack
      gap="$2.5"
      padding={compact ? '$2' : '$3'}
      borderWidth={1}
      borderColor={ui.borderSubtle}
      borderRadius={12}
      backgroundColor={ui.surface}
    >
      <XStack justifyContent="space-between" alignItems="center" gap="$2" flexWrap="wrap">
        <YStack gap={2} flex={1} minWidth={0}>
          <Text fontSize={13} fontWeight="800" color={ui.text}>
            Stock by warehouse
          </Text>
          <Text fontSize={11.5} color={ui.textMuted}>
            Ship-from: {stock.shipFromLabel}
          </Text>
        </YStack>
        <Text fontSize={12.5} fontWeight="700" color={ui.text}>
          Total {totalDraft}
        </Text>
      </XStack>

      {stock.warehouses.map((row) => (
        <XStack key={row.warehouseId} alignItems="center" gap="$3">
          <YStack flex={1} minWidth={0} gap={2}>
            <Text fontSize={13} fontWeight="700" color={ui.text} numberOfLines={1}>
              {row.warehouseName}
              {row.isDefault ? ' (default)' : ''}
            </Text>
          </YStack>
          <Input
            width={88}
            value={draftQty[row.warehouseId] ?? '0'}
            onChangeText={(value) =>
              setDraftQty((current) => ({
                ...current,
                [row.warehouseId]: value.replace(/[^\d]/g, ''),
              }))
            }
            keyboardType="number-pad"
            inputMode="numeric"
          />
        </XStack>
      ))}

      <XStack justifyContent="flex-end" gap="$2">
        <Button
          size="$3"
          disabled={!dirty || saving}
          onPress={() => void handleSave()}
          opacity={!dirty || saving ? 0.5 : 1}
        >
          {saving ? 'Saving…' : 'Save stock'}
        </Button>
      </XStack>
    </YStack>
  )
}
