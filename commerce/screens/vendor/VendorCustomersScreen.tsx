import { useEffect, useMemo, useState } from 'react'

import { VendorNoShopState } from '~/commerce/components/vendor/VendorShopGate'
import {
  CRM_PRESET_TAGS,
  rfmSegmentLabel,
} from '~/commerce/lib/customer-crm-scoring'
import {
  addShopCustomerNote,
  addShopCustomerTag,
  fetchShopCustomerCrm,
  fetchShopCustomerJourneys,
  fetchShopCustomerNotes,
  fetchShopCustomerPurchases,
  filterShopCustomers,
  removeShopCustomerTag,
  runShopCustomerJourneys,
  setShopCustomerJourneyActive,
  type ShopCustomerCrmRow,
  type ShopCustomerJourney,
  type ShopCustomerNote,
  type ShopCustomerPurchase,
} from '~/commerce/lib/shop-customer-crm'
import { PageCenter } from '~/components/layout'
import {
  Button,
  Input,
  Spinner,
  Switch,
  Text,
  XStack,
  YStack,
  useAppToast,
} from '~/components/ui'
import { useAppLayout } from '~/hooks/useAppLayout'
import { useVendorCurrency } from '~/hooks/useVendorCurrency'
import { useAppSelector } from '~/lib/store/hooks'
import { useAppUi } from '~/lib/theme/useAppUi'

const FILTERS = [
  { id: 'all' as const, label: 'All' },
  { id: 'champion' as const, label: 'Champions' },
  { id: 'loyal' as const, label: 'Loyal' },
  { id: 'new' as const, label: 'New' },
  { id: 'at_risk' as const, label: 'At risk' },
  { id: 'high_intent' as const, label: 'High intent' },
  { id: 'churn_risk' as const, label: 'Churn risk' },
]

export function VendorCustomersScreen() {
  const ui = useAppUi()
  const toast = useAppToast()
  const { isDesktop, safeBottom } = useAppLayout()
  const { formatAmount } = useVendorCurrency()
  const shop = useAppSelector((state) => state.shop.currentShop)

  const [rows, setRows] = useState<ShopCustomerCrmRow[]>([])
  const [journeys, setJourneys] = useState<ShopCustomerJourney[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<(typeof FILTERS)[number]['id']>('all')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [notes, setNotes] = useState<ShopCustomerNote[]>([])
  const [purchases, setPurchases] = useState<ShopCustomerPurchase[]>([])
  const [noteDraft, setNoteDraft] = useState('')
  const [tagDraft, setTagDraft] = useState('')

  const selected = rows.find((row) => row.customer_id === selectedId) ?? null
  const visible = useMemo(() => filterShopCustomers(rows, query, filter), [rows, query, filter])

  const summary = useMemo(() => {
    const atRisk = rows.filter((row) => row.churn_score >= 60).length
    const highIntent = rows.filter((row) => row.intent_score >= 50).length
    const avgClv =
      rows.length === 0 ? 0 : rows.reduce((sum, row) => sum + row.predicted_clv, 0) / rows.length
    return { atRisk, highIntent, avgClv, total: rows.length }
  }, [rows])

  async function reload() {
    if (!shop?.id) return
    const [nextRows, nextJourneys] = await Promise.all([
      fetchShopCustomerCrm(shop.id),
      fetchShopCustomerJourneys(shop.id),
    ])
    setRows(nextRows)
    setJourneys(nextJourneys)
    setSelectedId((current) => current ?? nextRows[0]?.customer_id ?? null)
  }

  useEffect(() => {
    if (!shop?.id) {
      setLoading(false)
      return
    }
    setLoading(true)
    void reload().finally(() => setLoading(false))
  }, [shop?.id])

  useEffect(() => {
    if (!shop?.id || !selectedId) {
      setNotes([])
      setPurchases([])
      return
    }
    void Promise.all([
      fetchShopCustomerNotes(shop.id, selectedId),
      fetchShopCustomerPurchases(shop.id, selectedId),
    ]).then(([nextNotes, nextPurchases]) => {
      setNotes(nextNotes)
      setPurchases(nextPurchases)
    })
  }, [shop?.id, selectedId])

  if (!shop) {
    return (
      <VendorNoShopState
        ui={ui}
        title="No shop yet"
        body="Create a shop first to see your Customer 360 CRM."
      />
    )
  }

  if (loading) {
    return (
      <PageCenter>
        <Spinner size="large" />
      </PageCenter>
    )
  }

  return (
    <YStack
      width="100%"
      gap="$4"
      paddingHorizontal={isDesktop ? '$6' : '$4'}
      paddingTop={isDesktop ? '$6' : '$4'}
      paddingBottom={(isDesktop ? 32 : 24) + safeBottom}
    >
      <YStack gap="$1">
        <Text fontSize={isDesktop ? 28 : 23} fontWeight="800" color={ui.text}>
          Customers
        </Text>
        <Text fontSize={13} color={ui.textSecondary}>
          Shop-scoped 360 profiles with RFM segments, lifetime value, churn, and purchase intent.
        </Text>
      </YStack>

      <XStack gap="$3" flexWrap="wrap">
        <SummaryCard ui={ui} label="Customers" value={String(summary.total)} />
        <SummaryCard ui={ui} label="Churn risk" value={String(summary.atRisk)} />
        <SummaryCard ui={ui} label="High intent" value={String(summary.highIntent)} />
        <SummaryCard ui={ui} label="Avg predicted CLV" value={formatAmount(summary.avgClv)} />
      </XStack>

      <Input value={query} onChangeText={setQuery} placeholder="Search name, handle, or tag" />

      <XStack gap="$2" flexWrap="wrap">
        {FILTERS.map((item) => {
          const active = filter === item.id
          return (
            <Button
              key={item.id}
              size="$2"
              chromeless={!active}
              onPress={() => setFilter(item.id)}
            >
              {item.label}
            </Button>
          )
        })}
      </XStack>

      <XStack gap="$4" flexWrap="wrap" alignItems="flex-start">
        <YStack flex={1} minWidth={280} gap="$2">
          {visible.length === 0 ? (
            <Text color={ui.textSecondary}>No customers match this view yet.</Text>
          ) : (
            visible.map((row) => {
              const active = row.customer_id === selectedId
              return (
                <YStack
                  key={row.customer_id}
                  padding="$3"
                  borderWidth={1}
                  borderColor={active ? ui.brand : ui.borderSubtle}
                  borderRadius={14}
                  backgroundColor={active ? ui.surface : 'transparent'}
                  onPress={() => setSelectedId(row.customer_id)}
                  cursor="pointer"
                  gap="$1"
                >
                  <XStack justifyContent="space-between" gap="$2">
                    <Text fontWeight="800" color={ui.text} flex={1}>
                      {row.display_name}
                    </Text>
                    <Text fontSize={12} color={ui.textSecondary}>
                      {rfmSegmentLabel(row.rfm_segment)}
                    </Text>
                  </XStack>
                  <Text fontSize={12} color={ui.textSecondary}>
                    {row.total_orders} orders · {formatAmount(row.clv)} CLV · churn {row.churn_score} ·
                    intent {row.intent_score}
                  </Text>
                </YStack>
              )
            })
          )}
        </YStack>

        {selected ? (
          <YStack
            flex={1}
            minWidth={300}
            gap="$3"
            padding="$4"
            borderWidth={1}
            borderColor={ui.borderSubtle}
            borderRadius={16}
          >
            <Text fontSize={20} fontWeight="800" color={ui.text}>
              {selected.display_name}
            </Text>
            <Text fontSize={13} color={ui.textSecondary}>
              {selected.username ? `@${selected.username}` : 'No handle'} ·{' '}
              {selected.is_follower ? 'Follower' : 'Not following'}
            </Text>
            <Text color={ui.text}>{selected.insight}</Text>
            <XStack gap="$3" flexWrap="wrap">
              <Metric label="Spend" value={formatAmount(selected.total_spent)} ui={ui} />
              <Metric label="Predicted CLV" value={formatAmount(selected.predicted_clv)} ui={ui} />
              <Metric label="AOV" value={formatAmount(selected.average_order_value)} ui={ui} />
              <Metric label="Churn" value={String(selected.churn_score)} ui={ui} />
              <Metric label="Intent" value={String(selected.intent_score)} ui={ui} />
              <Metric
                label="Last order"
                value={
                  selected.days_since_last_order == null
                    ? 'Never'
                    : `${selected.days_since_last_order}d ago`
                }
                ui={ui}
              />
            </XStack>

            <Text fontWeight="800" color={ui.text}>
              Tags
            </Text>
            <XStack gap="$2" flexWrap="wrap">
              {selected.tags.map((tag) => (
                <Button
                  key={tag}
                  size="$2"
                  chromeless
                  onPress={async () => {
                    const ok = await removeShopCustomerTag(shop.id, selected.customer_id, tag)
                    if (ok) {
                      setRows((current) =>
                        current.map((row) =>
                          row.customer_id === selected.customer_id
                            ? { ...row, tags: row.tags.filter((item) => item !== tag) }
                            : row,
                        ),
                      )
                    }
                  }}
                >
                  {tag} ×
                </Button>
              ))}
              {CRM_PRESET_TAGS.filter((tag) => !selected.tags.includes(tag)).map((tag) => (
                <Button
                  key={`preset-${tag}`}
                  size="$2"
                  chromeless
                  onPress={async () => {
                    const ok = await addShopCustomerTag(shop.id, selected.customer_id, tag)
                    if (ok) {
                      setRows((current) =>
                        current.map((row) =>
                          row.customer_id === selected.customer_id
                            ? { ...row, tags: [...row.tags, tag] }
                            : row,
                        ),
                      )
                    }
                  }}
                >
                  + {tag}
                </Button>
              ))}
            </XStack>
            <XStack gap="$2">
              <Input flex={1} value={tagDraft} onChangeText={setTagDraft} placeholder="Custom tag" />
              <Button
                size="$3"
                onPress={async () => {
                  const ok = await addShopCustomerTag(shop.id, selected.customer_id, tagDraft)
                  if (ok) {
                    const next = tagDraft.trim().toLowerCase().slice(0, 40)
                    setRows((current) =>
                      current.map((row) =>
                        row.customer_id === selected.customer_id && !row.tags.includes(next)
                          ? { ...row, tags: [...row.tags, next] }
                          : row,
                      ),
                    )
                    setTagDraft('')
                  }
                }}
              >
                Add
              </Button>
            </XStack>

            <Text fontWeight="800" color={ui.text}>
              Notes
            </Text>
            <XStack gap="$2">
              <Input flex={1} value={noteDraft} onChangeText={setNoteDraft} placeholder="Internal note" />
              <Button
                size="$3"
                onPress={async () => {
                  const saved = await addShopCustomerNote(shop.id, selected.customer_id, noteDraft)
                  if (saved) {
                    setNotes((current) => [saved, ...current])
                    setNoteDraft('')
                  }
                }}
              >
                Save
              </Button>
            </XStack>
            {notes.map((note) => (
              <Text key={note.id} fontSize={13} color={ui.textSecondary}>
                {new Date(note.created_at).toLocaleString()} — {note.body}
              </Text>
            ))}

            <Text fontWeight="800" color={ui.text}>
              Recent purchases
            </Text>
            {purchases.length === 0 ? (
              <Text fontSize={13} color={ui.textSecondary}>
                No recorded sales yet.
              </Text>
            ) : (
              purchases.map((item, index) => (
                <Text key={`${item.order_number}-${index}`} fontSize={13} color={ui.textSecondary}>
                  {item.product_title} · {formatAmount(item.total_revenue)} · {item.order_number}
                </Text>
              ))
            )}
          </YStack>
        ) : null}
      </XStack>

      <YStack gap="$3" padding="$4" borderWidth={1} borderColor={ui.borderSubtle} borderRadius={16}>
        <XStack justifyContent="space-between" alignItems="center" gap="$3" flexWrap="wrap">
          <YStack flex={1} gap="$1">
            <Text fontSize={16} fontWeight="800" color={ui.text}>
              Automated journeys
            </Text>
            <Text fontSize={13} color={ui.textSecondary}>
              Off by default. When on, matching shoppers get an in-app / push / email nudge on cooldown.
            </Text>
          </YStack>
          <Button
            size="$3"
            onPress={async () => {
              const sent = await runShopCustomerJourneys(shop.id)
              toast.show(sent ? `Sent ${sent} journey message${sent === 1 ? '' : 's'}` : 'No matching sends')
            }}
          >
            Run now
          </Button>
        </XStack>
        {journeys.map((journey) => (
          <XStack key={journey.id} justifyContent="space-between" alignItems="center" gap="$3">
            <YStack flex={1} gap="$1">
              <Text fontWeight="700" color={ui.text}>
                {journey.name}
              </Text>
              <Text fontSize={12} color={ui.textSecondary}>
                {journey.title} · every {journey.cooldown_days} days
              </Text>
            </YStack>
            <Switch
              checked={journey.is_active}
              onCheckedChange={async (next) => {
                const ok = await setShopCustomerJourneyActive(journey.id, next)
                if (ok) {
                  setJourneys((current) =>
                    current.map((item) =>
                      item.id === journey.id ? { ...item, is_active: next } : item,
                    ),
                  )
                }
              }}
            />
          </XStack>
        ))}
      </YStack>
    </YStack>
  )
}

function SummaryCard({
  ui,
  label,
  value,
}: {
  ui: ReturnType<typeof useAppUi>
  label: string
  value: string
}) {
  return (
    <YStack
      minWidth={140}
      flex={1}
      padding="$3"
      borderWidth={1}
      borderColor={ui.borderSubtle}
      borderRadius={14}
      gap="$1"
    >
      <Text fontSize={12} color={ui.textSecondary}>
        {label}
      </Text>
      <Text fontSize={18} fontWeight="800" color={ui.text}>
        {value}
      </Text>
    </YStack>
  )
}

function Metric({
  label,
  value,
  ui,
}: {
  label: string
  value: string
  ui: ReturnType<typeof useAppUi>
}) {
  return (
    <YStack minWidth={110} gap="$1">
      <Text fontSize={11} color={ui.textSecondary}>
        {label}
      </Text>
      <Text fontWeight="700" color={ui.text}>
        {value}
      </Text>
    </YStack>
  )
}
