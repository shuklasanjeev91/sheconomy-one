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
        | `/(store)/addresses`
        | `/(store)/browse`
        | `/(store)/cart`
        | `/(store)/category`
        | `/(store)/checkout`
        | `/(store)/favorites`
        | `/(store)/listing`
        | `/(store)/my-shops`
        | `/(store)/orders`
        | `/(store)/payment-methods`
        | `/(store)/search`
        | `/(store)/shop`
        | `/(store)/shops`
        | `/_sitemap`
        | `/addresses`
        | `/admin`
        | `/admin/`
        | `/admin/analytics`
        | `/admin/cart`
        | `/admin/categories`
        | `/admin/cms`
        | `/admin/company-pages`
        | `/admin/components/AdminShopsManager`
        | `/admin/groups`
        | `/admin/layout`
        | `/admin/moderation`
        | `/admin/orders`
        | `/admin/payments`
        | `/admin/products`
        | `/admin/sale-events`
        | `/admin/settings`
        | `/admin/shops`
        | `/admin/users`
        | `/auth`
        | `/auth/import-contacts`
        | `/auth/sign-in`
        | `/auth/sign-up`
        | `/auth/verify-gender`
        | `/browse`
        | `/cart`
        | `/category`
        | `/chat`
        | `/chat/`
        | `/chat/calls`
        | `/chat/groups`
        | `/checkout`
        | `/class`
        | `/class/`
        | `/class/audio`
        | `/co-work`
        | `/co-work/`
        | `/co-work/join`
        | `/co-work/meeting`
        | `/co-work/meetings`
        | `/co-work/schedule`
        | `/community`
        | `/community/`
        | `/community/analytics`
        | `/community/companies`
        | `/community/company`
        | `/community/company/create`
        | `/community/create`
        | `/community/events`
        | `/community/events/create`
        | `/community/group`
        | `/community/group/create`
        | `/community/groups`
        | `/community/hashtag`
        | `/community/jobs`
        | `/community/jobs/create`
        | `/community/network`
        | `/community/people`
        | `/community/post`
        | `/community/saved`
        | `/community/stories`
        | `/community/stories/create`
        | `/create-my-shop`
        | `/favorites`
        | `/help`
        | `/listing`
        | `/my-shops`
        | `/notifications`
        | `/orders`
        | `/payment-methods`
        | `/profile`
        | `/search`
        | `/settings`
        | `/shop`
        | `/shops`
        | `/ui-kit`
        | `/ui-kit/UiKitScreen`
        | `/vendor`
        | `/vendor/`
        | `/vendor/ads`
        | `/vendor/analytics`
        | `/vendor/create-listing`
        | `/vendor/delivery`
        | `/vendor/myshop`
        | `/vendor/myshop/edit`
        | `/vendor/orders`
        | `/vendor/products`
        | `/vendor/reviews`
        | `/vendor/settings`
      DynamicRoutes:
        | `/(store)/browse/${OneRouter.SingleRoutePart<T>}`
        | `/(store)/category/${OneRouter.SingleRoutePart<T>}`
        | `/(store)/listing/${OneRouter.SingleRoutePart<T>}`
        | `/(store)/my-shops/${OneRouter.SingleRoutePart<T>}`
        | `/(store)/shop/${OneRouter.SingleRoutePart<T>}`
        | `/browse/${OneRouter.SingleRoutePart<T>}`
        | `/category/${OneRouter.SingleRoutePart<T>}`
        | `/chat/${OneRouter.SingleRoutePart<T>}`
        | `/class/${OneRouter.SingleRoutePart<T>}`
        | `/co-work/meeting/${OneRouter.SingleRoutePart<T>}`
        | `/co-work/meeting/${OneRouter.SingleRoutePart<T>}/live`
        | `/community/company/${OneRouter.SingleRoutePart<T>}`
        | `/community/events/${OneRouter.SingleRoutePart<T>}`
        | `/community/group/${OneRouter.SingleRoutePart<T>}`
        | `/community/hashtag/${OneRouter.SingleRoutePart<T>}`
        | `/community/jobs/${OneRouter.SingleRoutePart<T>}`
        | `/community/people/${OneRouter.SingleRoutePart<T>}`
        | `/community/post/${OneRouter.SingleRoutePart<T>}`
        | `/community/stories/${OneRouter.SingleRoutePart<T>}`
        | `/listing/${OneRouter.SingleRoutePart<T>}`
        | `/my-shops/${OneRouter.SingleRoutePart<T>}`
        | `/profile/${OneRouter.SingleRoutePart<T>}`
        | `/profile/${OneRouter.SingleRoutePart<T>}/connections`
        | `/profile/${OneRouter.SingleRoutePart<T>}/followers`
        | `/profile/${OneRouter.SingleRoutePart<T>}/following`
        | `/shop/${OneRouter.SingleRoutePart<T>}`
      DynamicRouteTemplate:
        | `/(store)/browse/[kind]`
        | `/(store)/category/[slug]`
        | `/(store)/listing/[slug]`
        | `/(store)/my-shops/[shopId]`
        | `/(store)/shop/[slug]`
        | `/browse/[kind]`
        | `/category/[slug]`
        | `/chat/[id]`
        | `/class/[slug]`
        | `/co-work/meeting/[code]`
        | `/co-work/meeting/[code]/live`
        | `/community/company/[slug]`
        | `/community/events/[id]`
        | `/community/group/[id]`
        | `/community/hashtag/[tag]`
        | `/community/jobs/[id]`
        | `/community/people/[tab]`
        | `/community/post/[id]`
        | `/community/stories/[userId]`
        | `/listing/[slug]`
        | `/my-shops/[shopId]`
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
        '/(store)/my-shops/[shopId]': RouteInfo<{ shopId: string }>
        '/(store)/shop/[slug]': RouteInfo<{ slug: string }>
        '/browse/[kind]': RouteInfo<{ kind: string }>
        '/category/[slug]': RouteInfo<{ slug: string }>
        '/chat/[id]': RouteInfo<{ id: string }>
        '/class/[slug]': RouteInfo<{ slug: string }>
        '/co-work/meeting/[code]': RouteInfo<{ code: string }>
        '/co-work/meeting/[code]/live': RouteInfo<{ code: string }>
        '/community/company/[slug]': RouteInfo<{ slug: string }>
        '/community/events/[id]': RouteInfo<{ id: string }>
        '/community/group/[id]': RouteInfo<{ id: string }>
        '/community/hashtag/[tag]': RouteInfo<{ tag: string }>
        '/community/jobs/[id]': RouteInfo<{ id: string }>
        '/community/people/[tab]': RouteInfo<{ tab: string }>
        '/community/post/[id]': RouteInfo<{ id: string }>
        '/community/stories/[userId]': RouteInfo<{ userId: string }>
        '/listing/[slug]': RouteInfo<{ slug: string }>
        '/my-shops/[shopId]': RouteInfo<{ shopId: string }>
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