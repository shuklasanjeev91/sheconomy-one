import { beforeEach, describe, expect, it, vi } from 'vitest'

const storage = new Map<string, string>()

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn(async (key: string) => storage.get(key) ?? null),
    setItem: vi.fn(async (key: string, value: string) => {
      storage.set(key, value)
    }),
  },
}))

import {
  applyVendorInboxContextBatch,
  mergeVendorInboxContext,
  readVendorInboxContextEntries,
  saveVendorInboxContextEntry,
  vendorInboxContextKey,
} from '~/commerce/lib/vendor-inbox-notes'
import { hydrateVendorSlaInboxRowsWithContext, type VendorSlaInboxRow } from '~/commerce/lib/vendor-sla-inbox'

function row(overrides: Partial<VendorSlaInboxRow> & Pick<VendorSlaInboxRow, 'id' | 'kind' | 'severity' | 'title'>): VendorSlaInboxRow {
  return {
    id: overrides.id,
    kind: overrides.kind,
    severity: overrides.severity,
    title: overrides.title,
    description: 'Description',
    dueLabel: 'Waiting 2h',
    nextActionLabel: 'Open request',
    orderItemId: 'item-1',
    issueId: 'issue-1',
    orderId: 'order-1',
    orderNumber: '1001',
    customerName: 'Customer',
    productTitle: 'Product',
    tags: ['returns'],
    internalNote: null,
    internalTags: [],
    updatedAt: null,
    orderItem: null,
    issue: null,
    ...overrides,
  }
}

describe('vendor inbox notes', () => {
  beforeEach(() => {
    storage.clear()
  })

  it('persists and reloads a note entry keyed to the issue or item context', async () => {
    await saveVendorInboxContextEntry(
      'shop-1',
      { id: 'row-1', issueId: 'issue-1', orderItemId: 'item-1', orderId: 'order-1' },
      { note: 'Customer called back', tags: ['customer_called', 'watch_closely'] },
    )

    const entries = await readVendorInboxContextEntries('shop-1')
    expect(entries[0]?.key).toBe(vendorInboxContextKey({ id: 'row-1', issueId: 'issue-1', orderItemId: 'item-1', orderId: 'order-1' }))
    expect(entries[0]?.note).toBe('Customer called back')
    expect(entries[0]?.tags).toEqual(['customer_called', 'watch_closely'])
  })

  it('applies batch tags without duplicating existing values', async () => {
    await saveVendorInboxContextEntry(
      'shop-1',
      { id: 'row-1', issueId: 'issue-1', orderItemId: 'item-1', orderId: 'order-1' },
      { note: 'Need follow-up', tags: ['customer_called'] },
    )

    await applyVendorInboxContextBatch(
      'shop-1',
      [{ id: 'row-1', issueId: 'issue-1', orderItemId: 'item-1', orderId: 'order-1' }],
      { tags: ['customer_called', 'awaiting_stock'] },
    )

    const entries = await readVendorInboxContextEntries('shop-1')
    expect(entries[0]?.tags).toEqual(['customer_called', 'awaiting_stock'])
  })

  it('hydrates inbox rows with internal note and merged tags', async () => {
    const rows = [
      row({ id: 'row-1', kind: 'return_approval_pending', severity: 'high', title: 'Return request' }),
    ]
    const merged = mergeVendorInboxContext(rows, [
      {
        key: 'issue:issue-1',
        issueId: 'issue-1',
        orderItemId: 'item-1',
        orderId: 'order-1',
        note: 'Pickup escalated',
        tags: ['pickup_escalated'],
        updatedAt: 123,
      },
    ])

    expect(merged[0]?.internalNote).toBe('Pickup escalated')
    expect(merged[0]?.internalTags).toEqual(['pickup_escalated'])
    expect(merged[0]?.tags).toEqual(['returns', 'pickup_escalated'])
    expect(hydrateVendorSlaInboxRowsWithContext(rows, [
      {
        key: 'issue:issue-1',
        issueId: 'issue-1',
        orderItemId: 'item-1',
        orderId: 'order-1',
        note: 'Pickup escalated',
        tags: ['pickup_escalated'],
        updatedAt: 123,
      },
    ])[0]?.updatedAt).toBe(123)
  })
})
