# Tab refocus reloads the page

**Symptom:** switch to another browser tab, come back to SHEconomy, and the page
flashes/blinks and re-runs from scratch — the console shows a fresh set of logs
that were already printed earlier.

This document is the diagnosis only. No code has been changed yet. The fix plan
is at the end so we can agree on scope before touching anything.

---

## TL;DR

There are **two independent causes**, and they produce almost the same symptom.

| # | Cause | Where it bites | Real page reload? |
|---|-------|----------------|-------------------|
| A | Vite dev-server HMR socket drops while the tab is hidden, then the Vite client calls `location.reload()` the moment the tab becomes visible again | `yarn dev` only | Yes — genuine `location.reload()` |
| B | Supabase re-emits `SIGNED_IN` on every hidden→visible transition, producing a brand-new `session` object that invalidates the whole auth context | dev **and** production | No — React re-render/refetch storm that *looks* like a reload |

Cause A explains "the whole page reloads and the console is wiped and replayed".
Cause B explains "everything spins/blinks again and the network tab lights up",
and it is the one that will still hurt users after deploy.

Both are real and both need fixing. Cause A is the one to confirm first, because
you are currently running `yarn dev` (Vite dev server on `localhost:8081`).

---

## Cause A — Vite HMR reconnect forces `location.reload()` on refocus

### The chain

1. The Vite HMR client keeps the dev socket alive by sending a `ping` on a
   `setInterval`, default every 30s:

```435:437:node_modules/vite/dist/client/client.mjs
			pingIntervalId = setInterval(() => {
				if (socket.readyState === socket.OPEN) socket.send(JSON.stringify({ type: "ping" }));
			}, pingInterval);
```

2. When the tab is backgrounded, Chrome throttles `setInterval` to at best once
   per minute, and after ~5 minutes it freezes timers entirely. The keepalive
   stops firing and the socket dies.

3. The socket `close` handler emits `vite:ws:disconnect`:

```416:427:node_modules/vite/dist/client/client.mjs
				socket.addEventListener("close", () => {
					if (!isOpened) {
						reject(/* @__PURE__ */ new Error("WebSocket closed without opened."));
						return;
					}
					onMessage({
						type: "custom",
						event: "vite:ws:disconnect",
						data: { webSocket: socket }
					});
					onDisconnection();
				});
```

4. The client handles that by polling for the server and then hard-reloading:

```991:1000:node_modules/vite/dist/client/client.mjs
			if (payload.event === "vite:ws:disconnect") {
				if (hasDocument && !willUnload) {
					console.log(`[vite] server connection lost. Polling for restart...`);
					const socket = payload.data.webSocket;
					const url = new URL(socket.url);
					url.search = "";
					await waitForSuccessfulPing(url.href);
					location.reload();
				}
			}
```

5. **This is the key part.** `waitForSuccessfulPing` deliberately refuses to ping
   while the tab is hidden — it parks on `waitForWindowShow` and only resumes
   once `document.visibilityState === 'visible'`:

```1170:1176:node_modules/vite/dist/client/client.mjs
	if (await ping()) return;
	await wait(ms);
	while (true) if (visibilityManager.currentState === "visible") {
		if (await ping()) break;
		await wait(ms);
	} else await waitForWindowShow(visibilityManager);
```

So the reload is **queued while you are away and fired the instant you come
back**. That is precisely the reported behaviour: nothing seems wrong until you
return to the tab, and then the page reloads.

### Why the socket drops here more than in a typical app

- Background-tab timer throttling (the primary trigger).
- Any dev-server restart terminates every client:

```17117:17119:node_modules/vite/dist/node/chunks/node.js
				wss.clients.forEach((client) => {
					client.terminate();
				});
```

- The Tamagui vite plugin writes a ~20 MB cache into `.tamagui/` during dev, and
  that directory is **not** excluded from the file watcher. Only `.vercel` and
  `dist` are:

```58:60:vite.config.ts
      watch: {
        ignored: ['**/.vercel/**', '**/dist/**'],
      },
```

  A write into a watched directory can trigger a `full-reload` message, which
  goes through the same `pageReload()` path. Medium confidence — worth
  eliminating regardless since it is a one-line change.

- There is also a config conflict worth noting. `vite.config.ts` sets
  `server.ws.path`, while `one`/`vxrn` still sets the deprecated `server.hmr.*`
  (the project even patches vxrn to rewrite `hmr:` → `ws:`). The dev server logs
  this on boot:

  ```
  `server.hmr.protocol/host/port/path/clientPort/timeout/server` is deprecated. Use `server.ws.*` instead.
  ```

  If the two ever disagree on path/port, the client reconnects to the wrong
  endpoint and you get a reload loop rather than a single reload.

### Confirming it

Open DevTools, tick **Preserve log**, switch away for ~2 minutes, come back. If
you see this line just before the reload, it is Cause A:

```
[vite] server connection lost. Polling for restart...
```

---

## Cause B — Supabase re-emits `SIGNED_IN` on every tab refocus

This one is environment-independent and will ship to production.

### The chain

1. `@supabase/auth-js` (v2.110.2) registers its own `visibilitychange` listener
   because `persistSession` and `autoRefreshToken` are both on:

```11:19:lib/supabase/client.ts
const authOptions = {
  flowType: 'pkce' as const,
  autoRefreshToken: true,
  persistSession: true,
  detectSessionInUrl: false,
  experimental: {
    passkey: true,
  },
}
```

2. On every hidden→visible transition it runs session recovery:

```4649:4679:node_modules/@supabase/auth-js/dist/main/GoTrueClient.js
    async _onVisibilityChanged(calledFromInitialize) {
        const methodName = `#_onVisibilityChanged(${calledFromInitialize})`;
        this._debug(methodName, 'visibilityState', document.visibilityState);
        if (document.visibilityState === 'visible') {
            if (this.autoRefreshToken) {
                this._startAutoRefresh();
            }
            if (!calledFromInitialize) {
                await this.initializePromise;
                // ...
                    await this._recoverAndRefresh();
```

3. `_recoverAndRefresh` ends by notifying subscribers with **`SIGNED_IN`** — not
   `TOKEN_REFRESHED` — even when the session is unchanged and still valid:

```4077:4082:node_modules/@supabase/auth-js/dist/main/GoTrueClient.js
            else {
                // no need to persist currentSession again, as we just loaded it from
                // local storage; persisting it again may overwrite a value saved by
                // another client with access to the same local storage
                await this._notifyAllSubscribers('SIGNED_IN', currentSession);
            }
```

4. `SupabaseProvider` treats that as a real sign-in:

```48:59:providers/SupabaseProvider.tsx
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, nextSession) => {
      setSession(nextSession)
      setIsLoading(false)
      if (event === 'SIGNED_IN' && nextSession?.user) {
        const provider =
          (nextSession.user.app_metadata?.provider as string | undefined) ?? null
        void recordLoginSession({ provider })
        void enrichProfileFromAuth(nextSession.user)
      }
    })
```

Two things go wrong here.

**B1 — unthrottled writes on every refocus.** `recordLoginSession` and
`enrichProfileFromAuth` fire every single time you come back to the tab.
`heartbeatLoginSession` has a 5-minute throttle, but this path does not use it:

```126:133:features/auth/services/login-sessions.ts
/** Throttled last-seen heartbeat for the current device. */
let lastHeartbeat = 0
export async function heartbeatLoginSession(): Promise<void> {
  const now = Date.now()
  if (now - lastHeartbeat < 5 * 60 * 1000) return
  lastHeartbeat = now
  await recordLoginSession()
}
```

`enrichProfileFromAuth` alone costs a `SELECT`, a conditional `UPDATE`, a
`calculate_profile_completion` RPC, and a second `SELECT`
(`features/auth/services/profile-enrichment.ts:76-132`). Add
`recordLoginSession`'s `getSession()` + `record_auth_login_session` RPC and every
tab switch is roughly six unnecessary round trips.

**B2 — the identity cascade, which is the visible "blink".**
`setSession(nextSession)` stores a **new object** even though `user.id` never
changed. The context value is memoised on the object, not the id:

```89:96:providers/SupabaseProvider.tsx
  const value = useMemo<SupabaseContextValue>(
    () => ({
      session,
      user: session?.user ?? null,
      isLoading,
    }),
    [session, isLoading],
  )
```

Every consumer whose effect depends on the `user` **object** therefore re-runs.
The worst offenders are mounted globally in `app/_layout.tsx:217-227`, so they
affect every route:

- `CartProvider` — `loadCart` deps are `[authLoading, tryAutoApply, user]` and it
  opens with `setIsLoading(true)`, so the cart flips to its loading state on
  every refocus (`commerce/hooks/useCart.tsx:149-221`).
- `FavoritesProvider` — same shape, `[authLoading, user]` plus
  `setIsLoading(true)` (`commerce/hooks/useFavorites.tsx:53-82`).
- `useProfile` — deps `[userId, authLoading, refreshToken, user]`, refetching the
  full `profiles` row (`hooks/useProfile.ts:81-179`).

Roughly 25 more hooks share this pattern, including `useUnreadNotifications`,
`useStories` (which also tears down and re-subscribes its realtime channel),
`useNetwork`, `usePostEngagement`, `useProfileFollow`, `useShopFollow`,
`useCompanyFollow`, and `useHashtagFollow`.

### What is *not* the cause

Worth recording so nobody re-investigates these:

- **`AppAccessGate` does not flash a spinner.** `useProfile` already guards this
  via `profileMatchesUser`, so `isLoading` stays `false` during a background
  refresh (`hooks/useProfile.ts:181-184`). That defence works.
- **`BiometricUnlockGate` is a no-op on web** — it returns `children` directly
  (`components/auth/BiometricUnlockGate.tsx:62`).
- **The service worker never forces a reload.** There is no `controllerchange`
  handler anywhere; `lib/pwa/register.ts` only registers and reuses.
- **redux-persist is not involved.** No `PersistGate`, no visibility-triggered
  rehydrate or purge; the store only resets on explicit sign-out.
- **`useAutoRefresh` is already well-behaved** — it only flushes an invalidation
  that was queued while blurred, and explicitly does not refetch on re-attach
  (`lib/cache/useAutoRefresh.ts:46-56`).
- **One's skew-protection hard reload is already patched off** in
  `vite.config.ts:363-384`. One's `handleSkewError` can still reload on a chunk
  404 (`node_modules/one/dist/esm/utils/dynamicImport.mjs:12-22`), but it is
  10s-debounced via `sessionStorage` and only triggers after a failed dynamic
  import — relevant after a production deploy, not on tab switch.

---

## Telling A and B apart in 30 seconds

1. DevTools → Console → enable **Preserve log**.
2. Switch tabs for two minutes, then come back.

| What you see | Cause | Meaning |
|---|---|---|
| `[vite] server connection lost. Polling for restart...` then logs restart from the very first line | A | Genuine `location.reload()` |
| No vite line, but a burst of `profiles` / `carts` / `wishlist` requests in the Network tab | B | React refetch storm, not a reload |
| Both | Both | Fix A first, then re-measure B |

A reliable tiebreaker: run `window.__t = Date.now()` in the console before
switching. If `window.__t` is `undefined` when you return, the page genuinely
reloaded (Cause A). If it still has a value, it was Cause B.

---

## Fix plan

Ordered by impact per unit of risk. Nothing here has been implemented yet.

### Phase 1 — stop the real reload (dev only, ~15 min, low risk)

1. Add `.tamagui`, `.expo`, `.vercel`, and `dist` to `server.watch.ignored` in
   `vite.config.ts` so plugin cache writes cannot trigger `full-reload`.
2. Raise the HMR keepalive so a throttled background tab does not look dead.
   Vite derives the client ping interval from the HMR timeout
   (`client.mjs:859-866`), so lifting it to a few minutes covers a normal tab
   switch.
3. Verify the `server.ws` vs vxrn `server.hmr` config conflict resolves to a
   single path/port, so a reconnect cannot land on the wrong endpoint.

**Expected result:** switching tabs in `yarn dev` no longer reloads the page.
Note this is a dev-experience fix only; it changes nothing for users.

### Phase 2 — stop the refetch storm at the source (~30 min, medium risk, ships to prod)

In `providers/SupabaseProvider.tsx`:

1. Ignore no-op auth events. If the incoming `nextSession.user.id` and
   `access_token` match what is already in state, do not call `setSession`.
   That single guard kills the entire cascade for the common case.
2. Only run `recordLoginSession` / `enrichProfileFromAuth` on a **genuine**
   sign-in — a transition from no user to a user — rather than on any
   `SIGNED_IN` event. Route the refocus case through the already-throttled
   `heartbeatLoginSession`.
3. Split the context so identity and token live apart: expose a stable
   `userId: string | null` that only changes when the id actually changes, and
   keep the volatile `session` on a separate context for the few consumers that
   genuinely need the access token.

**Expected result:** cart, favourites, and profile stop reloading on refocus, and
about six redundant round trips per tab switch disappear.

### Phase 3 — fix the dependency arrays (~1–2 h, low risk, mechanical)

Change `[user]` to `[user?.id]` across the affected hooks, starting with the
globally mounted ones (`useCart`, `useFavorites`, `useProfile`) and then the
per-screen ones (`useUnreadNotifications`, `useStories`, `useNetwork`,
`usePostEngagement`, `useProfileFollow`, `useShopFollow`, `useCompanyFollow`,
`useHashtagFollow`).

Phase 2 makes Phase 3 mostly redundant for the refocus case, but Phase 3 is what
prevents the same class of bug from coming back on the next token refresh,
`updateUser` call, or multi-tab broadcast.

### Phase 4 — verify

- Manual: tab away 5 minutes, return, confirm no reload and no request burst.
- Add a Playwright smoke test that backgrounds the page via CDP, waits, restores,
  and asserts a sentinel on `window` survived.

---

## Files involved

| File | Role |
|---|---|
| `providers/SupabaseProvider.tsx` | Root cause of B — re-broadcasts session identity on refocus |
| `vite.config.ts` | Root cause of A — watcher scope and HMR/ws configuration |
| `commerce/hooks/useCart.tsx` | Global consumer, `setIsLoading(true)` on every refocus |
| `commerce/hooks/useFavorites.tsx` | Global consumer, same pattern |
| `hooks/useProfile.ts` | Global consumer via `AppAccessGate` |
| `features/auth/services/login-sessions.ts` | Unthrottled RPC on the `SIGNED_IN` path |
| `features/auth/services/profile-enrichment.ts` | Up to 4 round trips per refocus |
| `app/_layout.tsx` | Provider tree that determines global blast radius |
