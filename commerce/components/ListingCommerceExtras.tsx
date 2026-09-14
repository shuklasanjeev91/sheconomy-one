import { useEffect, useState } from 'react'

import { fetchActiveBundlesForListing, type ListingBundle } from '~/commerce/lib/listing-bundles'
import {
  fetchReorderSchedule,
  pauseReorderSchedule,
  upsertReorderSchedule,
  type ReorderCadence,
} from '~/commerce/lib/reorder-schedules'
import { Button, Text, XStack, YStack, useAppToast } from '~/components/ui'
import { LISTING_METADATA_KEYS } from '~/commerce/components/vendor/listing-publish/listing-publish.constants'
import { readMetadataBoolean, readMetadataString } from '~/commerce/components/vendor/listing-publish/listing-publish.utils'
import { useAppUi } from '~/lib/theme/useAppUi'
import { useSupabase } from '~/providers/SupabaseProvider'

export function ListingPreorderNote({ metadata }: { metadata: Record<string, unknown> | null | undefined }) {
  const ui = useAppUi()
  const allow = readMetadataBoolean(metadata ?? {}, LISTING_METADATA_KEYS.ALLOW_PREORDER, false)
  const shipAt = readMetadataString(metadata ?? {}, LISTING_METADATA_KEYS.EXPECTED_SHIP_AT)
  if (!allow) return null
  return (
    <Text fontSize={13} color={ui.brand} fontWeight="600">
      Pre-order available{shipAt ? ` · ships ${shipAt}` : ''}
    </Text>
  )
}

export function ListingBundleOffer({
  listingId,
  onAddBundle,
}: {
  listingId: string
  onAddBundle: (bundleId: string) => Promise<void>
}) {
  const ui = useAppUi()
  const [bundles, setBundles] = useState<ListingBundle[]>([])
  const [busyId, setBusyId] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    void fetchActiveBundlesForListing(listingId).then((rows) => {
      if (active) setBundles(rows)
    })
    return () => {
      active = false
    }
  }, [listingId])

  if (!bundles.length) return null

  return (
    <YStack gap="$2">
      <Text fontSize={14} fontWeight="800" color={ui.text}>
        Buy as a bundle
      </Text>
      {bundles.map((bundle) => (
        <YStack key={bundle.id} gap="$1">
          <Text fontSize={13} color={ui.text}>
            {bundle.title} · {bundle.bundle_price}
          </Text>
          <Button
            tone="outline"
            size="$2"
            disabled={busyId === bundle.id}
            onPress={() => {
              setBusyId(bundle.id)
              void onAddBundle(bundle.id).finally(() => setBusyId(null))
            }}
          >
            Add kit
          </Button>
        </YStack>
      ))}
    </YStack>
  )
}

export function ListingReorderScheduleCard({
  listingId,
  metadata,
}: {
  listingId: string
  metadata: Record<string, unknown> | null | undefined
}) {
  const ui = useAppUi()
  const toast = useAppToast()
  const { user } = useSupabase()
  const replenishable = readMetadataBoolean(metadata ?? {}, LISTING_METADATA_KEYS.REPLENISHABLE, false)
  const [cadence, setCadence] = useState<ReorderCadence>('monthly')
  const [scheduleId, setScheduleId] = useState<string | null>(null)
  const [paused, setPaused] = useState(false)

  useEffect(() => {
    if (!user?.id || !replenishable) return
    let active = true
    void fetchReorderSchedule(user.id, listingId).then((row) => {
      if (!active || !row) return
      setScheduleId(row.id)
      setPaused(row.paused)
      setCadence(row.cadence as ReorderCadence)
    })
    return () => {
      active = false
    }
  }, [listingId, replenishable, user?.id])

  if (!replenishable || !user?.id) return null

  return (
    <YStack gap="$2">
      <Text fontSize={14} fontWeight="800" color={ui.text}>
        Scheduled reorder
      </Text>
      <XStack gap="$2" flexWrap="wrap">
        {(['weekly', 'biweekly', 'monthly'] as const).map((option) => (
          <Button
            key={option}
            tone={cadence === option ? 'primary' : 'outline'}
            size="$2"
            onPress={() => setCadence(option)}
          >
            {option}
          </Button>
        ))}
      </XStack>
      <Button
        tone="outline"
        size="$3"
        onPress={() => {
          void upsertReorderSchedule({
            userId: user.id,
            listingId,
            cadence,
          }).then(({ error }) => {
            if (error) toast.show(error, { tone: 'danger' })
            else toast.show('Reorder reminder saved. We’ll ping you to checkout.', { tone: 'success' })
          })
        }}
      >
        {scheduleId ? 'Update reminder' : 'Remind me to reorder'}
      </Button>
      {scheduleId ? (
        <Button
          tone="ghost"
          size="$2"
          onPress={() => {
            void pauseReorderSchedule(scheduleId, !paused).then((error) => {
              if (error) toast.show(error, { tone: 'danger' })
              else setPaused(!paused)
            })
          }}
        >
          {paused ? 'Resume reminder' : 'Pause reminder'}
        </Button>
      ) : null}
    </YStack>
  )
}
