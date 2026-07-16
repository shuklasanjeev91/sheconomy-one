/** Placeholder catalogue sections — real shop sections will replace this later. */

export type MockSectionProduct = {
  id: string
  title: string
  price: string
  imageUrl?: string
  status: 'active' | 'draft'
  note?: string
}

export type MockShopSection = {
  id: string
  title: string
  tag?: string
  itemCount: number
  activeCount: number
  draftCount: number
  lastUpdated: string
  activeProducts: MockSectionProduct[]
  draftProducts: MockSectionProduct[]
}

export const MOCK_SECTION_STATS = {
  totalSections: 12,
  activeProducts: 148,
  draftProducts: 24,
  unassigned: 7,
  topSection: 'Best Sellers',
  avgPerSection: 14,
} as const

export const MOCK_SHOP_SECTIONS: MockShopSection[] = [
  {
    id: 'best-sellers',
    title: 'Best Sellers',
    tag: 'Primary',
    itemCount: 32,
    activeCount: 28,
    draftCount: 4,
    lastUpdated: '2 days ago',
    activeProducts: [
      {
        id: 'p1',
        title: 'Artisan Ceramic Vase',
        price: '$125.00',
        imageUrl: 'https://images.unsplash.com/photo-1610701596007-11502861dcfa?w=120&h=120&fit=crop',
        status: 'active',
      },
      {
        id: 'p2',
        title: 'Lumina Gold Pendant',
        price: '$340.00',
        imageUrl: 'https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?w=120&h=120&fit=crop',
        status: 'active',
      },
    ],
    draftProducts: [
      {
        id: 'd1',
        title: 'Untitled Silk Scarf',
        price: 'Pending Pricing',
        status: 'draft',
        note: 'Pending Pricing',
      },
    ],
  },
  {
    id: 'new-arrivals',
    title: 'New Arrivals',
    itemCount: 18,
    activeCount: 16,
    draftCount: 2,
    lastUpdated: '5 days ago',
    activeProducts: [
      {
        id: 'p3',
        title: 'Midnight Bloom Silk Scarf',
        price: '$145.00',
        imageUrl: 'https://images.unsplash.com/photo-1601924994987-69e26d50dc26?w=120&h=120&fit=crop',
        status: 'active',
      },
    ],
    draftProducts: [
      {
        id: 'd2',
        title: 'Velvet Evening Clutch',
        price: 'Draft',
        status: 'draft',
      },
    ],
  },
  {
    id: 'seasonal-edit',
    title: 'Seasonal Edit',
    itemCount: 24,
    activeCount: 20,
    draftCount: 4,
    lastUpdated: '1 week ago',
    activeProducts: [],
    draftProducts: [],
  },
]
