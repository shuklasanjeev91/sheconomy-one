import { appendCommunityAttribution } from '~/community/lib/post-product-live'
import {
  appRoutes,
  classRoutes,
  commerceRoutes,
  communityRoutes,
  coWorkRoutes,
} from '~/lib/routes'
import { buildAbsoluteUrl } from '~/lib/platform/url'
import { DEEP_LINK_ORIGIN } from '~/config/app-origin'

export function getProfileShareUrl(handle: string) {
  return buildAbsoluteUrl(appRoutes.userProfile(handle))
}

export function getCreatorHubShareUrl(handle: string) {
  return buildAbsoluteUrl(commerceRoutes.creatorHub(handle))
}

export function getPostShareUrl(postId: string) {
  return buildAbsoluteUrl(communityRoutes.post(postId))
}

export function getProfileShopShareUrl(handle: string) {
  return buildAbsoluteUrl(communityRoutes.profileShop(handle))
}

export function getShoppableFeedShareUrl() {
  return buildAbsoluteUrl(`${communityRoutes.home}?shoppable=1`)
}

/** Attributed listing URL for sharing products from community posts. */
export function getCommunityListingShareUrl(
  listingPath: string,
  postId?: string,
  source?: string,
) {
  return buildAbsoluteUrl(appendCommunityAttribution(listingPath, postId, source ? { source } : undefined))
}

export function getListingShareUrl(slug: string) {
  return buildAbsoluteUrl(commerceRoutes.listing(slug))
}

export function getShopShareUrl(slug: string) {
  return buildAbsoluteUrl(commerceRoutes.shop(slug))
}

export function getCompanyShareUrl(slug: string) {
  return buildAbsoluteUrl(communityRoutes.company(slug))
}

export function getGroupShareUrl(id: string) {
  return buildAbsoluteUrl(communityRoutes.group(id))
}

export function getEventShareUrl(id: string) {
  return buildAbsoluteUrl(communityRoutes.event(id))
}

export function getJobShareUrl(id: string) {
  return buildAbsoluteUrl(communityRoutes.job(id))
}

export function getHashtagShareUrl(tag: string) {
  const normalized = tag.replace(/^#/, '')
  return buildAbsoluteUrl(communityRoutes.hashtag(normalized))
}

export function getProgramShareUrl(slug: string) {
  return buildAbsoluteUrl(classRoutes.program(slug))
}

export function getMeetingShareUrl(code: string) {
  // Meeting links must use the host with valid AASA / Digital Asset Links.
  // Association crawlers do not follow the apex-domain redirect.
  return `${DEEP_LINK_ORIGIN}${coWorkRoutes.meeting(code)}`
}
