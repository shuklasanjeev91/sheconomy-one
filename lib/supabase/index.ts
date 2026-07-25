export { supabase } from '~/lib/supabase/client'
export { supabaseConfig } from '~/lib/supabase/env'
export { getSheconomyLogoUrl, getSheconomyFaviconUrl, SHECONOMY_LOGO_BUCKET } from '~/lib/supabase/brand'
export type { SheconomyLogoVariant } from '~/lib/supabase/brand'
export {
  COMMERCE_HORIZONTAL_PAGE_SIZE,
  COMMERCE_PAGE_SIZE,
  fetchCategoriesPage,
  fetchHomeBootstrap,
  fetchHomeCommerce,
  fetchListingFeedPage,
  fetchShopsPage,
  mapListingImages,
  mapListingRow,
  pickListingImage,
  sortListingImages,
} from '~/lib/supabase/commerce'
export type {
  CategorySummary,
  CommerceStats,
  HomeBootstrapData,
  ListingFeedKind,
  ListingImageSummary,
  ListingSummary,
  PaginatedResult,
  ShopSummary,
} from '~/lib/supabase/commerce'
export * from '~/lib/supabase/auth'
export type { Database, Json, Tables, TablesInsert, TablesUpdate } from '~/lib/supabase/database.types'
