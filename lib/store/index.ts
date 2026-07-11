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

import { profileCompletionReducer, profileReducer } from '~/lib/profile/profile.store'
import { shopReducer } from '~/lib/shop/shop.store'
import { listingReducer } from '~/lib/listing/listing.store'
import { listingAttributesReducer } from '~/lib/listing/listing-attributes.store'
import { listingImagesReducer } from '~/lib/listing/listing-images.store'
import { listingMaterialsReducer } from '~/lib/listing/listing-materials.store'
import { listingVariationsReducer } from '~/lib/listing/listing-variations.store'

import { persistStorage } from './storage'

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

const rootReducer = combineReducers({
  profile: profileReducer,
  profileCompletion: persistReducer(completionPersistConfig, profileCompletionReducer),
  shop: persistReducer(shopPersistConfig, shopReducer),
  listing: persistReducer(listingPersistConfig, listingReducer),
  listingImages: listingImagesReducer,
  listingVariations: listingVariationsReducer,
  listingAttributes: listingAttributesReducer,
  listingMaterials: listingMaterialsReducer,
})

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

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch
