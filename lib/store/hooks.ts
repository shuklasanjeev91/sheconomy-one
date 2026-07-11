import { useDispatch, useSelector, useStore } from 'react-redux'
import type { TypedUseSelectorHook } from 'react-redux'

import type { AppDispatch, RootState, store } from './index'

/** Typed `useDispatch` — knows about async thunks. */
export const useAppDispatch = () => useDispatch<AppDispatch>()

/** Typed `useSelector`. */
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector

/** Typed `useStore`. */
export const useAppStore: () => typeof store = useStore
