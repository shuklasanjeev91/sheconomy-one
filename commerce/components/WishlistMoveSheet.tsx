import { useEffect, useState } from 'react'

import {
  createWishlistCollection,
  fetchWishlistCollections,
  moveWishlistItem,
  type WishlistCollection,
} from '~/commerce/lib/wishlist'
import { AppBottomSheet } from '~/components/ui/BottomSheet'
import { Button, Input, Spinner, Text, XStack, YStack, useAppToast } from '~/components/ui'
import { useAppUi } from '~/lib/theme/useAppUi'
import { useSupabase } from '~/providers/SupabaseProvider'

type WishlistMoveSheetProps = {
  open: boolean
  listingId: string | null
  onOpenChange: (open: boolean) => void
  onMoved?: () => void
}

/** Move a wishlist listing into a named collection (or All / uncategorized). */
export function WishlistMoveSheet({
  open,
  listingId,
  onOpenChange,
  onMoved,
}: WishlistMoveSheetProps) {
  const ui = useAppUi()
  const toast = useAppToast()
  const { user } = useSupabase()
  const [collections, setCollections] = useState<WishlistCollection[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [newName, setNewName] = useState('')

  useEffect(() => {
    if (!open || !user?.id) return
    setLoading(true)
    void fetchWishlistCollections(user.id).then((result) => {
      setCollections(result.collections)
      setLoading(false)
    })
  }, [open, user?.id])

  async function moveTo(collectionId: string | null) {
    if (!user?.id || !listingId) return
    setSaving(true)
    const { error } = await moveWishlistItem(user.id, listingId, collectionId)
    setSaving(false)
    if (error) {
      toast.show('Could not move item', { tone: 'danger', message: error })
      return
    }
    toast.show(collectionId ? 'Moved to collection' : 'Moved to All', { tone: 'success' })
    onOpenChange(false)
    onMoved?.()
  }

  async function createAndMove() {
    if (!user?.id || !listingId || !newName.trim()) return
    setSaving(true)
    const created = await createWishlistCollection(user.id, newName)
    if (created.error || !created.collection) {
      setSaving(false)
      toast.show('Could not create collection', { tone: 'danger', message: created.error ?? undefined })
      return
    }
    const { error } = await moveWishlistItem(user.id, listingId, created.collection.id)
    setSaving(false)
    if (error) {
      toast.show('Collection created, but move failed', { tone: 'danger', message: error })
      return
    }
    setNewName('')
    toast.show('Moved to new collection', { tone: 'success' })
    onOpenChange(false)
    onMoved?.()
  }

  return (
    <AppBottomSheet open={open} onOpenChange={onOpenChange} title="Move to collection">
      <YStack gap="$3" padding="$4">
        {loading ? (
          <Spinner />
        ) : (
          <>
            <Button
              tone="outline"
              size="$3"
              borderRadius={999}
              disabled={saving}
              onPress={() => void moveTo(null)}
            >
              All (uncategorized)
            </Button>
            {collections.map((collection) => (
              <Button
                key={collection.id}
                tone="outline"
                size="$3"
                borderRadius={999}
                disabled={saving}
                onPress={() => void moveTo(collection.id)}
              >
                {collection.name}
              </Button>
            ))}
            <XStack gap="$2" alignItems="center">
              <Input
                flex={1}
                value={newName}
                placeholder="New collection"
                onChangeText={setNewName}
              />
              <Button
                size="$3"
                tone="primary"
                borderRadius={999}
                disabled={saving || !newName.trim()}
                onPress={() => void createAndMove()}
              >
                Add
              </Button>
            </XStack>
            {saving ? (
              <Text fontSize={12} color={ui.textMuted}>
                Saving…
              </Text>
            ) : null}
          </>
        )}
      </YStack>
    </AppBottomSheet>
  )
}
