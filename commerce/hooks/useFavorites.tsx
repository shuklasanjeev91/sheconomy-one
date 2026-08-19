import AsyncStorage from '@react-native-async-storage/async-storage'
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'

import {
  addWishlistItem,
  fetchWishlistListingIds,
  removeWishlistItem,
  syncLocalFavoritesToWishlist,
} from '~/commerce/lib/wishlist'
import { INVALIDATION_TOPICS, invalidateCache } from '~/lib/cache/invalidation'
import { useSupabase } from '~/providers/SupabaseProvider'

const LOCAL_FAVORITES_KEY = 'sheconomy:favorites'

type FavoritesContextValue = {
  favoriteIds: string[]
  isLoading: boolean
  isFavorite: (listingId: string) => boolean
  toggleFavorite: (listingId: string) => Promise<void>
}

const FavoritesContext = createContext<FavoritesContextValue | null>(null)

async function readLocalFavoriteIds(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(LOCAL_FAVORITES_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : []
  } catch {
    return []
  }
}

async function writeLocalFavoriteIds(ids: string[]) {
  await AsyncStorage.setItem(LOCAL_FAVORITES_KEY, JSON.stringify(ids))
}

export function FavoritesProvider({ children }: { children: ReactNode }) {
  const { user, isLoading: authLoading } = useSupabase()
  const [favoriteIds, setFavoriteIds] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const syncedRef = useRef(false)

  const loadFavorites = useCallback(async () => {
    if (authLoading) return

    setIsLoading(true)

    if (user) {
      const localIds = await readLocalFavoriteIds()
      if (localIds.length && !syncedRef.current) {
        await syncLocalFavoritesToWishlist(user.id, localIds)
        await writeLocalFavoriteIds([])
        syncedRef.current = true
      }

      const { listingIds, error } = await fetchWishlistListingIds(user.id)
      if (!error) {
        setFavoriteIds(listingIds)
      } else {
        setFavoriteIds([])
      }
    } else {
      const localIds = await readLocalFavoriteIds()
      setFavoriteIds(localIds)
    }

    setIsLoading(false)
  }, [authLoading, user])

  useEffect(() => {
    void loadFavorites()
  }, [loadFavorites])

  const isFavorite = useCallback(
    (listingId: string) => favoriteIds.includes(listingId),
    [favoriteIds],
  )

  const toggleFavorite = useCallback(
    async (listingId: string) => {
      const isSaved = favoriteIds.includes(listingId)

      if (user) {
        if (isSaved) {
          const { error } = await removeWishlistItem(user.id, listingId)
          if (error) return
          setFavoriteIds((current) => current.filter((id) => id !== listingId))
        } else {
          const { error } = await addWishlistItem(user.id, listingId)
          if (error) return
          setFavoriteIds((current) => [listingId, ...current.filter((id) => id !== listingId)])
        }
        invalidateCache(INVALIDATION_TOPICS.commerceWishlist)
        return
      }

      setFavoriteIds((current) => {
        const next = isSaved
          ? current.filter((id) => id !== listingId)
          : [listingId, ...current.filter((id) => id !== listingId)]
        void writeLocalFavoriteIds(next)
        return next
      })
    },
    [favoriteIds, user],
  )

  const value = useMemo(
    () => ({ favoriteIds, isLoading, isFavorite, toggleFavorite }),
    [favoriteIds, isLoading, isFavorite, toggleFavorite],
  )

  return <FavoritesContext.Provider value={value}>{children}</FavoritesContext.Provider>
}

export function useFavorites() {
  const context = useContext(FavoritesContext)
  if (!context) {
    throw new Error('useFavorites must be used within FavoritesProvider')
  }
  return context
}