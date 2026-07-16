/**
 * Marketplace search history — now backed by the unified app search history
 * so Shop and omnibox share the same recent terms (web + iOS + Android).
 */
export {
  clearAppSearchHistory as clearSearchHistory,
  getAppSearchHistorySnapshot,
  recordAppSearchTerm as recordSearchTerm,
  removeAppSearchTerm as removeSearchTerm,
  useAppSearchHistory as useSearchHistory,
} from '~/lib/search/history'
