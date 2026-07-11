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

import { persistStorage } from './storage'

const completionPersistConfig = {
  key: 'profile-completion',
  storage: persistStorage,
  whitelist: ['isBasicProfileCompleted', 'isBasicProfileSkipped'],
}

const rootReducer = combineReducers({
  profile: profileReducer,
  profileCompletion: persistReducer(completionPersistConfig, profileCompletionReducer),
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
