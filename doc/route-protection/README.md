# Route Protection — Developer Guide

Config-driven **role + gender** access control for sheconomy-one. This is the
migration of the old Next.js middleware + `useRouteProtection` system, adapted to
the **One (React Native + web)** app.

> **TL;DR** — Access rules live in **one config file**
> (`config/route-protection.config.ts`). Wrap a screen/section in
> **`<RouteGuard>`** (or a shortcut like `<RequireAdmin>`), or read state from
> **`useRouteProtection()`**. The guard shows a spinner while loading, inline
> sign-in for guests, a redirect for gender/verification gates, and a friendly
> **Access denied** screen when a role is insufficient.

---

## 1. Why this exists (and what changed from the old app)

The old app was **Next.js** and gated routes at the **edge** in `middleware.js`
(rate limiting, security headers, IP tracking, server auth, server push-notifier
auto-init). sheconomy-one is **One / React Native**, which has **no edge
middleware**, so:

| Old (Next.js) | New (One) |
|---|---|
| `middleware.js` (edge) | Client guards + Supabase **RLS** (the real gate) |
| `config/middleware.config.js` | **`config/route-protection.config.ts`** |
| `hooks/useRouteProtection.js` | **`hooks/useRouteProtection.ts`** |
| `withRouteProtection` HOC / status | **`<RouteGuard>`** component + shortcuts |
| `lib/auth-redirect.js` | folded into **`lib/auth/redirect.ts`** |
| server rate-limit / headers / IP | **omitted** (edge-only; not applicable) |
| server `NotificationService` | **deferred** (needs a server runtime) |
| `lib/utils/mobile-detection.js` | **`lib/utils/mobile-detection.ts`** (UA classifier only) |

**Two layers, no duplication:**

1. **Tier layer** (already shipped): `lib/auth/access.ts` + `AppAccessGate` gate
   feature areas by **gender tier** (`guest` / `male` / `female`) — this is what
   already stops non-female users from opening **community / chat**.
2. **Role layer** (this migration): `config/route-protection.config.ts` +
   `lib/auth/route-protection.ts` add **role** (Admin / Vendor / Member) gating
   for **/admin** and **/vendor**, plus the **women-first gender gate** on the
   seller surfaces.

---

## 2. File map

| File | What it holds |
|------|---------------|
| `config/route-protection.config.ts` | **The only place you edit access rules** — route→access table, role defaults, gender/verification lists, feature flags |
| `lib/auth/route-protection.ts` | Pure engine: `normalizeRole`, `resolveRouteAccess`, `resolveRoleAccess`, messages. **Single source of truth** shared by hook + guard |
| `hooks/useRouteProtection.ts` | React hooks: `useRouteProtection` + `useAdminProtection` / `useVendorProtection` / `useUserProtection` / `useGuestProtection` / `useChatProtection` / `useShopProtection` / `useShopCreationProtection` / `useCheckoutProtection` |
| `components/auth/RouteGuard.tsx` | `<RouteGuard>` + `<RequireAdmin>` + `<RequireVendorRole>` + `<AccessDenied>` |
| `lib/auth/redirect.ts` | `buildSignInUrl`, `getCurrentPathWithSearch`, `normalizeReturnPath`, `isSafeReturnPath` |
| `lib/auth/access.ts` | Existing **tier** (gender) layer — unchanged |
| `lib/utils/mobile-detection.ts` | `detectMobileDevice(userAgent)` classifier |

Roles are the app's canonical codes from `lib/profile/profile.type.ts`:
`USER_ROLES = { ADMIN: 'A', VENDOR: 'V', USER: 'U' }`.

---

## 3. The 30-second version

Protect a **section layout** (recommended — one wrap covers every child route):

```tsx
// app/admin/layout.tsx
import { RequireAdmin } from '~/components/auth/RouteGuard'

return <RequireAdmin>{/* admin UI */}</RequireAdmin>
```

```tsx
// app/vendor/_layout.tsx — admins + vendors, women-first (gender verified)
import { RequireVendorRole } from '~/components/auth/RouteGuard'

return <RequireVendorRole signInReturnTo="/vendor/myshop">{/* vendor UI */}</RequireVendorRole>
```

Protect a **single screen** with explicit roles:

```tsx
import { RouteGuard } from '~/components/auth/RouteGuard'
import { USER_ROLES } from '~/lib/profile/profile.type'

<RouteGuard allowedRoles={[USER_ROLES.ADMIN, USER_ROLES.VENDOR]} requireGenderVerification>
  <SellerTools />
</RouteGuard>
```

Read protection **state** yourself (e.g. to hide a button):

```tsx
import { useAdminProtection } from '~/hooks/useRouteProtection'

const { isChecking, isAuthorized } = useAdminProtection()
if (isChecking) return <Spinner />
if (!isAuthorized) return null
```

---

## 4. How a decision is made

`resolveRouteAccess({ pathname, isAuthenticated, role, gender, isVerified })`
returns one of:

| `status` | Meaning | What `<RouteGuard>` renders |
|---|---|---|
| `allow` | User may view the route | the children |
| `signin` | Guest hit a members-only route | inline `AuthSignInFlow` (returns here after sign-in) |
| `redirect` | Gender / verification gate, or guest-only page while signed in | `<Redirect href>` |
| `denied` | Signed in but **role** insufficient | friendly `<AccessDenied>` screen |

Order of checks (matches the old middleware):

1. `PUBLIC` → allow. `GUEST_ONLY` → redirect signed-in users home.
2. Not authenticated → `signin`.
3. **Gender gate** — if the route is in `GENDER_RESTRICTED_ROUTES` and the user
   isn't female (`gender === true`) → redirect to `/auth/verify-gender`.
4. **Verification gate** — if enabled and required and `!is_verified`.
5. **Role gate** — if `ROLE_BASED` and the user's role isn't allowed → `denied`.

**Admins bypass** the gender/verification gates by default
(`FEATURE_FLAGS.ADMIN_BYPASSES_RESTRICTIONS`), since they manage every surface.

---

## 5. Editing access (config only — no hardcoding)

Everything is in `config/route-protection.config.ts`.

**Add a protected area:**

```ts
export const ROUTE_ACCESS = [
  // more specific prefixes first!
  ['/admin', { access: 'ROLE_BASED', roles: [USER_ROLES.ADMIN] }],
  ['/vendor', { access: 'ROLE_BASED', roles: [USER_ROLES.ADMIN, USER_ROLES.VENDOR] }],
  ['/reports', { access: 'ROLE_BASED', roles: [USER_ROLES.ADMIN] }], // ← new
  // ...
]
```

**Make a route women-first:**

```ts
export const GENDER_RESTRICTED_ROUTES = ['/vendor', '/create-listing', '/reports']
```

**Change where a denied user is sent:**

```ts
export const DEFAULT_ROUTES = {
  [USER_ROLES.ADMIN]: '/admin',
  [USER_ROLES.VENDOR]: '/vendor',
  [USER_ROLES.USER]: '/',
}
```

**Toggle gates:**

```ts
export const FEATURE_FLAGS = {
  ENABLE_GENDER_VERIFICATION: true,
  ENABLE_VERIFICATION: false,
  ADMIN_BYPASSES_RESTRICTIONS: true,
}
```

---

## 6. Hook reference

`useRouteProtection(allowedRoles?, options?)` returns:

```ts
{
  isChecking: boolean          // auth/profile still loading — show a spinner
  isAuthorized: boolean        // may view the route
  decision: RouteAccessDecision | null
  errorMessage: string | null  // friendly text when blocked
  redirectPath: Href | null    // safe in-app href to send the user to
  needsSignIn: boolean         // guest hitting a members route
  userRole: 'A' | 'V' | 'U' | null
  isVerified: boolean
  isAuthenticated: boolean
}
```

- Pass `allowedRoles` for an explicit check; omit it to check the **current
  route** against the config table.
- `options`: `{ requireGenderVerification?, requireVerification?, allowUnauthenticated? }`.
- The hook is **pure state** — it never calls the router itself, so there are **no
  redirect race conditions**. Render `<RouteGuard>` or act on the fields.

Shortcuts: `useAdminProtection`, `useVendorProtection` (women-first),
`useUserProtection`, `useGuestProtection`, `useChatProtection`,
`useShopProtection`, `useShopCreationProtection`, `useCheckoutProtection`.

---

## 7. Server-side truth

These client guards are **UX** — they route people to the right place and show
clear messages. The **real** enforcement is **Supabase Row Level Security** on
every table (and admin checks like `isAdminUser` in `lib/orders/order.access.ts`).
Never rely on client guards for data security.

---

## 8. Gotchas

- **Prefix order matters** in `ROUTE_ACCESS` — list `'/admin/x'` before `'/admin'`
  if it needs different rules. Matching is first-hit by prefix.
- **`gender === true` means female.** That's the platform convention.
- Adding a role-gated area? A signed-in user without the right role sees the
  **Access denied** screen. Pass `redirectOnDeny` to silently bounce them instead.
- The **tier layer** still owns community/chat gender gating — don't re-add those
  to `GENDER_RESTRICTED_ROUTES` or you'll double-gate.
