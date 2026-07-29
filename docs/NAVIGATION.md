# Cross-platform navigation

SHEconomy uses **`router.push` only** for in-app navigation on **web, iOS, and Android**.

## Canonical APIs

| API | When to use |
|-----|-------------|
| [`navigateApp`](../lib/platform/navigate.ts) / [`pushApp`](../lib/platform/navigate.ts) | Imperative navigation (buttons, chips, effects) |
| [`usePushRoute`](../hooks/usePushRoute.ts) | Components that want a `push()` helper from a hook |
| [`pressNavigate`](../components/navigation/AppLink.tsx) | Button / Pressable that owns the gesture |
| [`AppLink`](../components/navigation/AppLink.tsx) | Declarative links (cards, nav items, text links) |
| [`openAppPath`](../lib/platform/linking.ts) | Push / deep-link handlers while the app is open |

All of the above call `router.push` from `one` on every platform.

## Do not use for in-app routes

- `router.replace` (disabled / aliased to push)
- `window.location.href` / `assign` / `replace` (except last-resort recovery when the root navigator is not mounted)
- `Link` from `one` outside `AppLink` (removed — `AppLink` uses `navigateApp`)
- `Linking.openURL` for in-app paths (use `openAppPath` / `navigateApp`; `Linking` is for true externals only)

## Platform notes

- **Web:** `navigateApp` wraps `router.push` in `startTransition` so chrome stays responsive.
- **iOS / Android:** `router.push` runs immediately (no transition deferral) so tab taps stay snappy on Hermes.
- **Back:** [`useAppBackNavigation`](../hooks/useAppBackNavigation.ts) uses `router.back()` when history exists, otherwise `navigateApp` to a section fallback.

## Example

```tsx
import { AppLink, pressNavigate } from '~/components/navigation'
import { navigateApp } from '~/lib/platform/navigate'
import { usePushRoute } from '~/hooks/usePushRoute'
import { commerceRoutes } from '~/lib/routes'

// Declarative
<AppLink href={commerceRoutes.cart}>Cart</AppLink>

// Imperative
navigateApp(commerceRoutes.checkout)

// Hook
const { push } = usePushRoute()
push(commerceRoutes.home)

// Button
<Button onPress={() => pressNavigate(commerceRoutes.orders)}>Orders</Button>
```
