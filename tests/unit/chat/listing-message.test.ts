import { describe, expect, it } from 'vitest'

import { mapMessage } from '~/chat/lib/chats'
import {
  parseChatListingPayload,
  postProductToChatListing,
  listingDetailToChatListing,
} from '~/chat/lib/listing-message'
import type { PostProduct } from '~/community/lib/community'

const product: PostProduct = {
  listingId: 'listing-1',
  title: 'Silk scarf',
  price: 1200,
  currency: 'INR',
  imageUrl: 'https://cdn.example/scarf.jpg',
  slug: 'silk-scarf',
  shopName: 'Atelier',
}

describe('postProductToChatListing', () => {
  it('maps post product snapshots into chat listing payloads', () => {
    expect(postProductToChatListing(product)).toEqual({
      listingId: 'listing-1',
      title: 'Silk scarf',
      price: 1200,
      currency: 'INR',
      imageUrl: 'https://cdn.example/scarf.jpg',
      slug: 'silk-scarf',
      shopName: 'Atelier',
    })
  })

  it('returns null when required fields are missing', () => {
    expect(postProductToChatListing({ ...product, listingId: null })).toBeNull()
    expect(postProductToChatListing({ ...product, title: '' })).toBeNull()
  })
})

describe('parseChatListingPayload', () => {
  it('parses listing metadata from messages', () => {
    expect(
      parseChatListingPayload({
        type: 'listing',
        listingId: 'listing-1',
        title: 'Silk scarf',
        price: 1200,
        currency: 'INR',
        imageUrl: 'https://cdn.example/scarf.jpg',
        slug: 'silk-scarf',
        shopName: 'Atelier',
      }),
    ).toEqual({
      listingId: 'listing-1',
      title: 'Silk scarf',
      price: 1200,
      currency: 'INR',
      imageUrl: 'https://cdn.example/scarf.jpg',
      slug: 'silk-scarf',
      shopName: 'Atelier',
    })
  })
})

describe('listingDetailToChatListing', () => {
  it('maps listing detail rows into chat payloads', () => {
    expect(
      listingDetailToChatListing({
        id: 'listing-1',
        title: 'Silk scarf',
        price: 1200,
        currency: 'INR',
        slug: 'silk-scarf',
        imageUrl: 'https://cdn.example/scarf.jpg',
        shopName: 'Atelier',
      }),
    ).toEqual({
      listingId: 'listing-1',
      title: 'Silk scarf',
      price: 1200,
      currency: 'INR',
      imageUrl: 'https://cdn.example/scarf.jpg',
      slug: 'silk-scarf',
      shopName: 'Atelier',
    })
  })
})

describe('mapMessage listing', () => {
  it('maps listing message rows into chat messages', () => {
    const message = mapMessage({
      id: 'msg-1',
      conversation_id: 'chat-1',
      sender_id: 'user-1',
      content: '[Product] Silk scarf',
      message_type: 'listing',
      media_url: null,
      media_type: null,
      file_name: null,
      file_size: null,
      status: 'sent',
      created_at: '2026-08-22T00:00:00.000Z',
      reply_to_id: null,
      deleted_at: null,
      edited_at: null,
      metadata: {
        type: 'listing',
        listingId: 'listing-1',
        title: 'Silk scarf',
        price: 1200,
        currency: 'INR',
        imageUrl: 'https://cdn.example/scarf.jpg',
        slug: 'silk-scarf',
        shopName: 'Atelier',
      },
    })

    expect(message.type).toBe('listing')
    expect(message.listing?.title).toBe('Silk scarf')
  })
})
