import {
  appRoutes,
  classRoutes,
  commerceRoutes,
  communityRoutes,
  coWorkRoutes,
} from '~/lib/routes'
import { buildAbsoluteUrl } from '~/lib/platform/url'

export function getProfileShareUrl(handle: string) {
  return buildAbsoluteUrl(appRoutes.userProfile(handle))
}

export function getPostShareUrl(postId: string) {
  return buildAbsoluteUrl(communityRoutes.post(postId))
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
  return buildAbsoluteUrl(coWorkRoutes.meeting(code))
}
