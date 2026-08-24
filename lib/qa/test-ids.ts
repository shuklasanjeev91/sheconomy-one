/** Stable ids for device QA (WDA / Appium). Keep in sync with scripts/device-qa/ipad_crud_interactive.py */
export function qaSlug(label: string): string {
  return label
    .toLowerCase()
    .replace(/\+/g, 'plus')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

export const QA = {
  topTab: (label: string) => `qa-top-tab-${qaSlug(label)}`,
  bottomTab: (section: string, label: string) =>
    `qa-bottom-tab-${qaSlug(section)}-${qaSlug(label)}`,
  classMediaTab: (id: 'video' | 'audio' | 'playlists') => `qa-class-tab-${id}`,
  accountMenu: (id: string) => `qa-account-${id}`,
  settingsNav: (id: string) => `qa-settings-${id}`,
  postComposerInput: 'qa-post-composer-input',
  postSubmit: 'qa-post-submit',
  postMore: 'qa-post-more',
  postEdit: 'qa-post-edit',
  postDelete: 'qa-post-delete',
  postSave: 'qa-post-save',
  postUnsave: 'qa-post-unsave',
  postEditInput: 'qa-post-edit-input',
  postEditSave: 'qa-post-edit-save',
  postDeleteConfirm: 'qa-post-delete-confirm',
  listingAddToCart: 'qa-listing-add-to-cart',
  listingBuyNow: 'qa-listing-buy-now',
  listingFavorite: 'qa-listing-favorite',
  cartItemDelete: 'qa-cart-item-delete',
  profileEdit: 'qa-profile-edit',
  jobCreate: 'qa-job-create',
  groupCreate: 'qa-group-create',
  eventCreate: 'qa-event-create',
  addressAdd: 'qa-address-add',
  paymentAddCard: 'qa-payment-add-card',
  searchInput: 'qa-search-input',
} as const
