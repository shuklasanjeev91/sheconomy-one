// deno-lint-ignore-file
/* eslint-disable */
// biome-ignore: needed import
import type { OneRouter } from 'one'

declare module 'one' {
  export namespace OneRouter {
    export interface __routes<T extends string = string> extends Record<string, unknown> {
      StaticRoutes:
        | `/`
        | `/(store)`
        | `/(store)/`
        | `/(store)/cart`
        | `/(store)/checkout`
        | `/(store)/favorites`
        | `/(store)/my-shops`
        | `/(store)/search`
        | `/(store)/shops`
        | `/_sitemap`
        | `/auth`
        | `/auth/sign-in`
        | `/auth/sign-up`
        | `/auth/verify-gender`
        | `/cart`
        | `/chat`
        | `/chat/`
        | `/checkout`
        | `/class`
        | `/class/`
        | `/class/audio`
        | `/co-work`
        | `/co-work/`
        | `/co-work/join`
        | `/co-work/meetings`
        | `/co-work/schedule`
        | `/community`
        | `/community/`
        | `/community/companies`
        | `/community/company/create`
        | `/community/create`
        | `/community/events`
        | `/community/events/create`
        | `/community/group/create`
        | `/community/groups`
        | `/community/jobs`
        | `/community/network`
        | `/community/people`
        | `/community/stories/create`
        | `/favorites`
        | `/my-shops`
        | `/notifications`
        | `/profile`
        | `/search`
        | `/settings`
        | `/shops`
        | `/ui-kit`
        | `/ui-kit/UiKitScreen`
      DynamicRoutes:
        | `/(store)/browse/${OneRouter.SingleRoutePart<T>}`
        | `/(store)/category/${OneRouter.SingleRoutePart<T>}`
        | `/(store)/listing/${OneRouter.SingleRoutePart<T>}`
        | `/(store)/shop/${OneRouter.SingleRoutePart<T>}`
        | `/browse/${OneRouter.SingleRoutePart<T>}`
        | `/category/${OneRouter.SingleRoutePart<T>}`
        | `/class/${OneRouter.SingleRoutePart<T>}`
        | `/co-work/meeting/${OneRouter.SingleRoutePart<T>}`
        | `/co-work/meeting/${OneRouter.SingleRoutePart<T>}/live`
        | `/community/company/${OneRouter.SingleRoutePart<T>}`
        | `/community/events/${OneRouter.SingleRoutePart<T>}`
        | `/community/group/${OneRouter.SingleRoutePart<T>}`
        | `/community/hashtag/${OneRouter.SingleRoutePart<T>}`
        | `/community/jobs/${OneRouter.SingleRoutePart<T>}`
        | `/community/people/${OneRouter.SingleRoutePart<T>}`
        | `/community/stories/${OneRouter.SingleRoutePart<T>}`
        | `/listing/${OneRouter.SingleRoutePart<T>}`
        | `/profile/${OneRouter.SingleRoutePart<T>}`
        | `/profile/${OneRouter.SingleRoutePart<T>}/connections`
        | `/profile/${OneRouter.SingleRoutePart<T>}/followers`
        | `/profile/${OneRouter.SingleRoutePart<T>}/following`
        | `/shop/${OneRouter.SingleRoutePart<T>}`
      DynamicRouteTemplate:
        | `/(store)/browse/[kind]`
        | `/(store)/category/[slug]`
        | `/(store)/listing/[slug]`
        | `/(store)/shop/[slug]`
        | `/browse/[kind]`
        | `/category/[slug]`
        | `/class/[slug]`
        | `/co-work/meeting/[code]`
        | `/co-work/meeting/[code]/live`
        | `/community/company/[slug]`
        | `/community/events/[id]`
        | `/community/group/[id]`
        | `/community/hashtag/[tag]`
        | `/community/jobs/[id]`
        | `/community/people/[tab]`
        | `/community/stories/[userId]`
        | `/listing/[slug]`
        | `/profile/[username]`
        | `/profile/[username]/connections`
        | `/profile/[username]/followers`
        | `/profile/[username]/following`
        | `/shop/[slug]`
      IsTyped: true
      RouteTypes: {
        '/(store)/browse/[kind]': RouteInfo<{ kind: string }>
        '/(store)/category/[slug]': RouteInfo<{ slug: string }>
        '/(store)/listing/[slug]': RouteInfo<{ slug: string }>
        '/(store)/shop/[slug]': RouteInfo<{ slug: string }>
        '/browse/[kind]': RouteInfo<{ kind: string }>
        '/category/[slug]': RouteInfo<{ slug: string }>
        '/class/[slug]': RouteInfo<{ slug: string }>
        '/co-work/meeting/[code]': RouteInfo<{ code: string }>
        '/co-work/meeting/[code]/live': RouteInfo<{ code: string }>
        '/community/company/[slug]': RouteInfo<{ slug: string }>
        '/community/events/[id]': RouteInfo<{ id: string }>
        '/community/group/[id]': RouteInfo<{ id: string }>
        '/community/hashtag/[tag]': RouteInfo<{ tag: string }>
        '/community/jobs/[id]': RouteInfo<{ id: string }>
        '/community/people/[tab]': RouteInfo<{ tab: string }>
        '/community/stories/[userId]': RouteInfo<{ userId: string }>
        '/listing/[slug]': RouteInfo<{ slug: string }>
        '/profile/[username]': RouteInfo<{ username: string }>
        '/profile/[username]/connections': RouteInfo<{ username: string }>
        '/profile/[username]/followers': RouteInfo<{ username: string }>
        '/profile/[username]/following': RouteInfo<{ username: string }>
        '/shop/[slug]': RouteInfo<{ slug: string }>
      }
    }
  }
}

/**
 * Helper type for route information
 */
type RouteInfo<Params = Record<string, never>> = {
  Params: Params
  LoaderProps: { path: string; search?: string; subdomain?: string; params: Params; request?: Request }
}