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
        | `/(store)/following`
        | `/(store)/listing`
        | `/(store)/orders`
        | `/(store)/orders/payu`
        | `/(store)/orders/payu-return`
        | `/(store)/orders/razorpay-return`
        | `/(store)/orders/success`
        | `/(store)/payment-methods`
        | `/(store)/payment/failure`
        | `/(store)/payment/success`
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
        | `/admin/cms/categories`
        | `/admin/cms/comments`
        | `/admin/cms/media`
        | `/admin/cms/new`
        | `/admin/cms/redirects`
        | `/admin/cms/tags`
        | `/admin/company-pages`
        | `/admin/components/AdminAnalyticsManager`
        | `/admin/components/AdminCmsManager`
        | `/admin/components/AdminCompanyPagesManager`
        | `/admin/components/AdminGroupsManager`
        | `/admin/components/AdminSaleEventsManager`
        | `/admin/components/AdminSettingsManager`
        | `/admin/components/AdminShopsManager`
        | `/admin/components/CmsCoverImage`
        | `/admin/components/cms/AdminCmsCategoriesPage`
        | `/admin/components/cms/AdminCmsCommentsPage`
        | `/admin/components/cms/AdminCmsContentForm`
        | `/admin/components/cms/AdminCmsContentList`
        | `/admin/components/cms/AdminCmsMediaPage`
        | `/admin/components/cms/AdminCmsRedirectsPage`
        | `/admin/components/cms/AdminCmsTagsPage`
        | `/admin/components/cms/CmsMarkdownEditor`
        | `/admin/components/cms/CmsMediaPickerPanel`
        | `/admin/components/cms/CmsPageShell`
        | `/admin/components/cms/CmsSeoFields`
        | `/admin/components/cms/CmsTagsInput`
        | `/admin/components/cms/cmsNav`
        | `/admin/groups`
        | `/admin/layout`
        | `/admin/orders`
        | `/admin/payments`
        | `/admin/products`
        | `/admin/sale-events`
        | `/admin/settings`
        | `/admin/shops`
        | `/admin/users`
        | `/auth`
        | `/auth/callback`
        | `/auth/complete-profile`
        | `/auth/import-contacts`
        | `/auth/qr`
        | `/auth/sign-in`
        | `/auth/sign-up`
        | `/auth/verify-gender`
        | `/blog`
        | `/blogs`
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
        | `/class/playlists`
        | `/class/video`
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
        | `/following`
        | `/help`
        | `/legal/ads`
        | `/legal/cookies`
        | `/legal/privacy`
        | `/legal/terms`
        | `/listing`
        | `/notifications`
        | `/orders`
        | `/orders/payu`
        | `/orders/payu-return`
        | `/orders/razorpay-return`
        | `/orders/success`
        | `/payment-methods`
        | `/payment/failure`
        | `/payment/success`
        | `/payu-embed-return`
        | `/profile`
        | `/search`
        | `/seller/dashboard`
        | `/seller/dashboard/crm-helpers`
        | `/sellerlanding`
        | `/sellerlanding/`
        | `/settings`
        | `/settings/`
        | `/settings/about`
        | `/settings/account`
        | `/settings/appearance`
        | `/settings/chat`
        | `/settings/class`
        | `/settings/co-work`
        | `/settings/commerce`
        | `/settings/community`
        | `/settings/notifications`
        | `/settings/privacy`
        | `/settings/security`
        | `/settings/shop`
        | `/shop`
        | `/shops`
        | `/ui-kit`
        | `/ui-kit/UiKitScreen`
        | `/vendor`
        | `/vendor/`
        | `/vendor/ads`
        | `/vendor/ads/create`
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
        | `/(store)/orders/${OneRouter.SingleRoutePart<T>}`
        | `/(store)/shop/${OneRouter.SingleRoutePart<T>}`
        | `/(store)/shop/${OneRouter.SingleRoutePart<T>}/privacy`
        | `/(store)/shop/${OneRouter.SingleRoutePart<T>}/refunds`
        | `/(store)/shop/${OneRouter.SingleRoutePart<T>}/returns`
        | `/(store)/shop/${OneRouter.SingleRoutePart<T>}/shipping`
        | `/(store)/shop/${OneRouter.SingleRoutePart<T>}/terms`
        | `/admin/cms/${OneRouter.SingleRoutePart<T>}`
        | `/blog/${OneRouter.SingleRoutePart<T>}`
        | `/browse/${OneRouter.SingleRoutePart<T>}`
        | `/category/${OneRouter.SingleRoutePart<T>}`
        | `/chat/${OneRouter.SingleRoutePart<T>}`
        | `/chat/call/${OneRouter.SingleRoutePart<T>}`
        | `/class/${OneRouter.SingleRoutePart<T>}`
        | `/class/playlists/${OneRouter.SingleRoutePart<T>}`
        | `/co-work/meeting/${OneRouter.SingleRoutePart<T>}`
        | `/co-work/meeting/${OneRouter.SingleRoutePart<T>}/live`
        | `/co-work/recording/${OneRouter.SingleRoutePart<T>}`
        | `/community/article/${OneRouter.SingleRoutePart<T>}`
        | `/community/company/${OneRouter.SingleRoutePart<T>}`
        | `/community/events/${OneRouter.SingleRoutePart<T>}`
        | `/community/group/${OneRouter.SingleRoutePart<T>}`
        | `/community/hashtag/${OneRouter.SingleRoutePart<T>}`
        | `/community/jobs/${OneRouter.SingleRoutePart<T>}`
        | `/community/people/${OneRouter.SingleRoutePart<T>}`
        | `/community/post/${OneRouter.SingleRoutePart<T>}`
        | `/community/stories/${OneRouter.SingleRoutePart<T>}`
        | `/invite/${OneRouter.SingleRoutePart<T>}`
        | `/listing/${OneRouter.SingleRoutePart<T>}`
        | `/orders/${OneRouter.SingleRoutePart<T>}`
        | `/profile/${OneRouter.SingleRoutePart<T>}`
        | `/profile/${OneRouter.SingleRoutePart<T>}/connections`
        | `/profile/${OneRouter.SingleRoutePart<T>}/followers`
        | `/profile/${OneRouter.SingleRoutePart<T>}/following`
        | `/shop/${OneRouter.SingleRoutePart<T>}`
        | `/shop/${OneRouter.SingleRoutePart<T>}/privacy`
        | `/shop/${OneRouter.SingleRoutePart<T>}/refunds`
        | `/shop/${OneRouter.SingleRoutePart<T>}/returns`
        | `/shop/${OneRouter.SingleRoutePart<T>}/shipping`
        | `/shop/${OneRouter.SingleRoutePart<T>}/terms`
        | `/u/${OneRouter.SingleRoutePart<T>}`
        | `/w/${OneRouter.SingleRoutePart<T>}`
      DynamicRouteTemplate:
        | `/(store)/browse/[kind]`
        | `/(store)/category/[slug]`
        | `/(store)/listing/[slug]`
        | `/(store)/orders/[id]`
        | `/(store)/shop/[slug]`
        | `/(store)/shop/[slug]/privacy`
        | `/(store)/shop/[slug]/refunds`
        | `/(store)/shop/[slug]/returns`
        | `/(store)/shop/[slug]/shipping`
        | `/(store)/shop/[slug]/terms`
        | `/admin/cms/[id]`
        | `/blog/[slug]`
        | `/browse/[kind]`
        | `/category/[slug]`
        | `/chat/[id]`
        | `/chat/call/[code]`
        | `/class/[slug]`
        | `/class/playlists/[id]`
        | `/co-work/meeting/[code]`
        | `/co-work/meeting/[code]/live`
        | `/co-work/recording/[token]`
        | `/community/article/[id]`
        | `/community/company/[slug]`
        | `/community/events/[id]`
        | `/community/group/[id]`
        | `/community/hashtag/[tag]`
        | `/community/jobs/[id]`
        | `/community/people/[tab]`
        | `/community/post/[id]`
        | `/community/stories/[userId]`
        | `/invite/[code]`
        | `/listing/[slug]`
        | `/orders/[id]`
        | `/profile/[username]`
        | `/profile/[username]/connections`
        | `/profile/[username]/followers`
        | `/profile/[username]/following`
        | `/shop/[slug]`
        | `/shop/[slug]/privacy`
        | `/shop/[slug]/refunds`
        | `/shop/[slug]/returns`
        | `/shop/[slug]/shipping`
        | `/shop/[slug]/terms`
        | `/u/[username]`
        | `/w/[token]`
      IsTyped: true
      RouteTypes: {
        '/(store)/browse/[kind]': RouteInfo<{ kind: string }>
        '/(store)/category/[slug]': RouteInfo<{ slug: string }>
        '/(store)/listing/[slug]': RouteInfo<{ slug: string }>
        '/(store)/orders/[id]': RouteInfo<{ id: string }>
        '/(store)/shop/[slug]': RouteInfo<{ slug: string }>
        '/(store)/shop/[slug]/privacy': RouteInfo<{ slug: string }>
        '/(store)/shop/[slug]/refunds': RouteInfo<{ slug: string }>
        '/(store)/shop/[slug]/returns': RouteInfo<{ slug: string }>
        '/(store)/shop/[slug]/shipping': RouteInfo<{ slug: string }>
        '/(store)/shop/[slug]/terms': RouteInfo<{ slug: string }>
        '/admin/cms/[id]': RouteInfo<{ id: string }>
        '/blog/[slug]': RouteInfo<{ slug: string }>
        '/browse/[kind]': RouteInfo<{ kind: string }>
        '/category/[slug]': RouteInfo<{ slug: string }>
        '/chat/[id]': RouteInfo<{ id: string }>
        '/chat/call/[code]': RouteInfo<{ code: string }>
        '/class/[slug]': RouteInfo<{ slug: string }>
        '/class/playlists/[id]': RouteInfo<{ id: string }>
        '/co-work/meeting/[code]': RouteInfo<{ code: string }>
        '/co-work/meeting/[code]/live': RouteInfo<{ code: string }>
        '/co-work/recording/[token]': RouteInfo<{ token: string }>
        '/community/article/[id]': RouteInfo<{ id: string }>
        '/community/company/[slug]': RouteInfo<{ slug: string }>
        '/community/events/[id]': RouteInfo<{ id: string }>
        '/community/group/[id]': RouteInfo<{ id: string }>
        '/community/hashtag/[tag]': RouteInfo<{ tag: string }>
        '/community/jobs/[id]': RouteInfo<{ id: string }>
        '/community/people/[tab]': RouteInfo<{ tab: string }>
        '/community/post/[id]': RouteInfo<{ id: string }>
        '/community/stories/[userId]': RouteInfo<{ userId: string }>
        '/invite/[code]': RouteInfo<{ code: string }>
        '/listing/[slug]': RouteInfo<{ slug: string }>
        '/orders/[id]': RouteInfo<{ id: string }>
        '/profile/[username]': RouteInfo<{ username: string }>
        '/profile/[username]/connections': RouteInfo<{ username: string }>
        '/profile/[username]/followers': RouteInfo<{ username: string }>
        '/profile/[username]/following': RouteInfo<{ username: string }>
        '/shop/[slug]': RouteInfo<{ slug: string }>
        '/shop/[slug]/privacy': RouteInfo<{ slug: string }>
        '/shop/[slug]/refunds': RouteInfo<{ slug: string }>
        '/shop/[slug]/returns': RouteInfo<{ slug: string }>
        '/shop/[slug]/shipping': RouteInfo<{ slug: string }>
        '/shop/[slug]/terms': RouteInfo<{ slug: string }>
        '/u/[username]': RouteInfo<{ username: string }>
        '/w/[token]': RouteInfo<{ token: string }>
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