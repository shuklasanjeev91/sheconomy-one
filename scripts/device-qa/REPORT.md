# Device critical-flows QA report

Device: SM_G781B (`RZCT80X8MVA`) / `com.sheconomy.ecommerce` (release)
Auth: manual sign-in as `sanjeev.shukla@bioayurveda.in` (OTP automation skipped by request)
Method: adb deep links + uiautomator dumps (`scripts/device-qa/`)

**Totals:** PASS=44 WARN=2 FAIL=12 (n=58)

## Failures / warnings

| Status | Route | Notes |
|--------|-------|-------|
| FAIL | `/community` | error_ui (PushNotificationsProvider); ok |
| FAIL | `/community/saved` | error_ui (PushNotificationsProvider); ok |
| FAIL | `/class` | ok; logcat=07-22 12:44:38.658   629   629 I lmkd    : Reclaim 'com.sheconomy.ecommerce' (12185), uid 10907, oom_score_adj 0, state 2 to free 532428kB rss, 290412kB swap; reason:... |
| WARN | `/class/video` | sparse_ui |
| FAIL | `/profile` | error_ui (PushNotificationsProvider); ok |
| FAIL | `/settings/appearance` | error_ui (PushNotificationsProvider); ok |
| FAIL | `/settings/notifications` | error_ui (PushNotificationsProvider); ok |
| FAIL | `/settings/community` | error_ui (PushNotificationsProvider); ok |
| FAIL | `/settings/commerce` | error_ui (PushNotificationsProvider); ok |
| FAIL | `/settings/shop` | error_ui (PushNotificationsProvider); ok |
| FAIL | `/settings/class` | error_ui (PushNotificationsProvider); ok |
| FAIL | `/settings/co-work` | error_ui (PushNotificationsProvider); ok |
| WARN | `form/add_to_cart` | no CTA found |
| FAIL | `form/settings_appearance` | error_ui; tapped_theme=False |

## Full matrix

| Status | Route | Notes |
|--------|-------|-------|
| PASS | `/` | ok |
| PASS | `/shops` | ok |
| PASS | `/favorites` | ok |
| PASS | `/cart` | ok |
| PASS | `/search` | ok |
| PASS | `/browse/categories` | ok |
| PASS | `/orders` | ok |
| PASS | `/addresses` | ok |
| PASS | `/payment-methods` | ok |
| PASS | `/checkout` | ok |
| PASS | `/following` | ok |
| FAIL | `/community` | error_ui (PushNotificationsProvider); ok |
| PASS | `/community/network` | ok |
| PASS | `/community/create` | ok |
| PASS | `/community/jobs` | ok |
| PASS | `/community/groups` | ok |
| PASS | `/community/events` | ok |
| PASS | `/community/companies` | ok |
| PASS | `/community/stories` | ok |
| FAIL | `/community/saved` | error_ui (PushNotificationsProvider); ok |
| PASS | `/community/people` | ok |
| PASS | `/chat` | ok |
| PASS | `/chat/groups` | ok |
| PASS | `/chat/calls` | ok |
| FAIL | `/class` | ok; logcat=07-22 12:44:38.658   629   629 I lmkd    : Reclaim 'com.sheconomy.ecommerce' (12185), uid 10907, oom_score_adj 0, state 2 to free 532428kB rss, 290412kB swap; reason:... |
| WARN | `/class/video` | sparse_ui |
| PASS | `/class/audio` | ok |
| PASS | `/class/playlists` | ok |
| PASS | `/co-work` | ok |
| PASS | `/co-work/schedule` | ok |
| PASS | `/co-work/meetings` | ok |
| PASS | `/co-work/join` | ok |
| FAIL | `/profile` | error_ui (PushNotificationsProvider); ok |
| PASS | `/notifications` | ok |
| PASS | `/settings` | ok |
| PASS | `/settings/account` | ok |
| PASS | `/settings/security` | ok |
| FAIL | `/settings/appearance` | error_ui (PushNotificationsProvider); ok |
| FAIL | `/settings/notifications` | error_ui (PushNotificationsProvider); ok |
| PASS | `/settings/privacy` | ok |
| FAIL | `/settings/community` | error_ui (PushNotificationsProvider); ok |
| FAIL | `/settings/commerce` | error_ui (PushNotificationsProvider); ok |
| FAIL | `/settings/shop` | error_ui (PushNotificationsProvider); ok |
| FAIL | `/settings/class` | error_ui (PushNotificationsProvider); ok |
| FAIL | `/settings/co-work` | error_ui (PushNotificationsProvider); ok |
| PASS | `/settings/about` | ok |
| PASS | `/help` | ok |
| PASS | `/legal/terms` | ok |
| PASS | `/legal/privacy` | ok |
| PASS | `/vendor` | ok |
| PASS | `/vendor/myshop` | ok |
| PASS | `form/search` | query=saree; labels=33 |
| PASS | `form/open_shop_or_listing` | clicked=True |
| WARN | `form/add_to_cart` | no CTA found |
| PASS | `form/cart` | ok |
| PASS | `form/checkout_open` | stopped before payment; ok |
| PASS | `form/composer` | typed draft; back |
| FAIL | `form/settings_appearance` | error_ui; tapped_theme=False |

## Crash / product notes

1. **LMKD OOM on `/class`:** process reclaimed (`lmkd` min2x watermark). App relaunched; subsequent class sub-routes mostly recovered. Repro: deep-link `sheconomy://class` under memory pressure after long navigation session.
2. **Settings panels error boundary:** several `/settings/*` routes (community, commerce, shop, class, co-work, appearance, notifications) and some community/profile surfaces show `usePushNotifications must be used within PushNotificationsProvider`. Process stayed alive; UI is an error screen with Retry — **product bug**.
3. **Add to cart CTA:** shop open succeeded; listing-level Add to cart not found in automation (WARN). Cart and checkout routes still opened; **payment not completed**.
4. **Vendor routes:** `/vendor`, `/vendor/myshop` loaded without crash (PASS / expected gate or vendor UI).
5. **Auth tooling:** automated OTP path was abandoned; session established manually before route/forms pass.

## Artifacts

- `/tmp/device-qa/results.jsonl`
- `/tmp/device-qa/critical-flows.log`
- `/tmp/device-qa/key-forms.log`
- `scripts/device-qa/adb_ui.py`, `run_critical_flows.py`, `sign_in_email.py`
