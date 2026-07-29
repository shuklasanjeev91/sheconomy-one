import { combineReducers, configureStore } from '@reduxjs/toolkit'
import {
  FLUSH,
  PAUSE,
  PERSIST,
  PURGE,
  REGISTER,
  REHYDRATE,
  persistReducer,
  persistStore,
} from 'redux-persist'

import { addressReducer } from '~/lib/address/address.store'
import { cmsReducer } from '~/lib/cms/cms.store'
import { companyPageReducer } from '~/lib/company-page/company-page.store'
import { groupReducer } from '~/lib/group/group.store'
import { saleReducer } from '~/lib/sale-event/sale-event.store'
import { profileCompletionReducer, profileReducer } from '~/lib/profile/profile.store'
import { shopReducer } from '~/lib/shop/shop.store'
import { listingReducer } from '~/lib/listing/listing.store'
import { categoriesReducer } from '~/lib/listing/listing-categories.store'
import { listingAttributesReducer } from '~/lib/listing/listing-attributes.store'
import { listingImagesReducer } from '~/lib/listing/listing-images.store'
import { listingMaterialsReducer } from '~/lib/listing/listing-materials.store'
import { listingPublishReducer } from '~/lib/listing/listing-publish.store'
import { listingBulkImportReducer } from '~/lib/listing/listing-bulk-import.store'
import { listingVariationsReducer } from '~/lib/listing/listing-variations.store'
import { deliveryReducer } from '~/lib/orders/delivery.store'
import { fulfillmentReducer } from '~/lib/orders/fulfillment.store'
import { orderIssuesReducer } from '~/lib/orders/order-issue.store'
import { paymentReducer } from '~/lib/orders/payment.store'
import { vendorPaymentReducer } from '~/lib/payment/payment.store'
import { returnPolicyReducer } from '~/lib/return-policy/return-policy.store'
import { shippingPolicyReducer } from '~/lib/shipping-policy/shipping-policy.store'
import { listingReviewsReducer } from '~/lib/listing-reviews/listing-reviews.store'
import { salesAnalyticsReducer } from '~/lib/sales-analytics/sales-analytics.store'
import { discountReducer } from '~/lib/discount/discount.store'
import { vendorShippingReducer } from '~/lib/vendor-shipping/vendor-shipping.store'
import { shopReviewReducer } from '~/lib/shop-review/shop-review.store'
import { vendorOrdersReducer } from '~/lib/orders/vendor-orders.store'

import { persistStorage } from '~/lib/store/storage'

const completionPersistConfig = {
  key: 'profile-completion',
  storage: persistStorage,
  whitelist: ['isBasicProfileCompleted', 'isBasicProfileSkipped'],
}

const shopPersistConfig = {
  key: 'shop',
  storage: persistStorage,
  // Cache the owner's shops so the seller UI paints instantly on reload.
  whitelist: ['currentShop', 'myShops'],
}

const listingPersistConfig = {
  key: 'listing',
  storage: persistStorage,
  // Cache the owner's catalogue + form draft so the seller UI paints instantly.
  whitelist: ['myListings', 'formData'],
}

const categoriesPersistConfig = {
  key: 'categories',
  storage: persistStorage,
  // Cache the taxonomy + popular list so category pickers paint instantly.
  whitelist: ['categories', 'popularCategories', 'lastUpdated'],
}

const addressPersistConfig = {
  key: 'address',
  storage: persistStorage,
  whitelist: ['addresses', 'selectedAddressId'],
}

const appReducer = combineReducers({
  profile: profileReducer,
  profileCompletion: persistReducer(completionPersistConfig, profileCompletionReducer),
  shop: persistReducer(shopPersistConfig, shopReducer),
  address: persistReducer(addressPersistConfig, addressReducer),
  listing: persistReducer(listingPersistConfig, listingReducer),
  categories: persistReducer(categoriesPersistConfig, categoriesReducer),
  listingImages: listingImagesReducer,
  listingVariations: listingVariationsReducer,
  listingAttributes: listingAttributesReducer,
  listingMaterials: listingMaterialsReducer,
  listingPublish: listingPublishReducer,
  listingBulkImport: listingBulkImportReducer,
  vendorOrders: vendorOrdersReducer,
  vendorPayment: vendorPaymentReducer,
  returnPolicy: returnPolicyReducer,
  shippingPolicy: shippingPolicyReducer,
  listingReviews: listingReviewsReducer,
  salesAnalytics: salesAnalyticsReducer,
  discount: discountReducer,
  vendorShipping: vendorShippingReducer,
  shopReview: shopReviewReducer,
  payment: paymentReducer,
  orderIssues: orderIssuesReducer,
  fulfillment: fulfillmentReducer,
  delivery: deliveryReducer,
  cms: cmsReducer,
  sale: saleReducer,
  companyPage: companyPageReducer,
  group: groupReducer,
})

/** Dispatched on sign-out to wipe all in-memory state back to initial. */
export const RESET_STORE = 'app/resetStore' as const

export const resetStore = () => ({ type: RESET_STORE })

/**
 * Root reducer wrapper: on `RESET_STORE`, drop the entire tree so every slice
 * re-initialises. This prevents one account's cached data (e.g. the persisted
 * `currentShop`/`myShops`) from leaking into the next session after sign-out.
 */
const rootReducer: typeof appReducer = (state, action) => {
  if (action.type === RESET_STORE) {
    return appReducer(undefined, action)
  }
  return appReducer(state, action)
}

export const store = configureStore({
  reducer: rootReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: [FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER],
      },
    }),
})

export const persistor = persistStore(store)

export type RootState = ReturnType<typeof appReducer>
export type AppDispatch = typeof store.dispatch
