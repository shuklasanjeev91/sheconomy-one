# Screen health report (blank / empty / error / complete)

Device: SM_G781B (`RZCT80X8MVA`) / release `com.sheconomy.ecommerce`
Focus: detect **complete**, **empty**, **blank**, and **error** screens after signed-in session.

- complete: 35
- empty (intentional): 5
- blank: 1
- error: 10
- auth_wall (unexpected): 0
- loading: 0
- crash: 1

## Problems (blank / error / crash / unexpected auth)

| Kind | Route | Notes | Sample |
|------|-------|-------|--------|
| error | `/community` | error on route | Search; Close; Search everywhere |
| error | `/community/saved` | error on route | Search; Close; Search everywhere |
| crash | `/class` | lmkd OOM; content=20 | Search; Close; Search everywhere |
| error | `/profile` | error on route | Error on route "profile/index"; View config getter callback for component `style` must be a function |
| error | `/settings/appearance` | error on route | Appearance; Error on route "appearance"; useScreenZoom must be used within ScreenZoomProvider |
| error | `/settings/notifications` | error on route | Error on route "notifications"; usePushNotifications must be used within PushNotificationsProvider;  |
| error | `/settings/community` | error on route | Error on route "community"; usePushNotifications must be used within PushNotificationsProvider; Retr |
| error | `/settings/commerce` | error on route | Marketplace; Error on route "commerce"; usePushNotifications must be used within PushNotificationsPr |
| error | `/settings/shop` | error on route | Manage shop; Error on route "shop"; usePushNotifications must be used within PushNotificationsProvid |
| error | `/settings/class` | error on route | Error on route "class"; usePushNotifications must be used within PushNotificationsProvider; Retry |
| error | `/settings/co-work` | error on route | Error on route "co-work"; usePushNotifications must be used within PushNotificationsProvider; Retry |
| blank | `/auth/sign-in` | content_labels=0 | Notifications (F8) |

## Empty states (OK if intentional)

| Route | Notes | Sample |
|-------|-------|--------|
| `/cart` | intentional empty state | Your SHEconomy cart is empty; Browse shops and add something you love.; Discover today's finds |
| `/payment-methods` | intentional empty state | Search; Close; Search everywhere |
| `/checkout` | intentional empty state | Search; Close; Search everywhere |
| `/community/jobs` | intentional empty state | Search; Close; Search everywhere |
| `/settings/privacy` | intentional empty state | Privacy; Profile visibility; Public — everyone can find your profile |

## Full matrix

| Status | Kind | Route | Content# | Notes |
|--------|------|-------|----------|-------|
| PASS | complete | `/` | 28 | content=28 |
| PASS | complete | `/shops` | 15 | content=15 |
| PASS | complete | `/favorites` | 34 | content=34 |
| WARN | empty | `/cart` | 16 | intentional empty state |
| PASS | complete | `/search` | 16 | content=16 |
| PASS | complete | `/browse/categories` | 7 | content=7 |
| PASS | complete | `/orders` | 36 | content=36 |
| PASS | complete | `/addresses` | 15 | content=15 |
| WARN | empty | `/payment-methods` | 18 | intentional empty state |
| WARN | empty | `/checkout` | 20 | intentional empty state |
| PASS | complete | `/following` | 10 | content=10 |
| FAIL | error | `/community` | 13 | error on route |
| PASS | complete | `/community/network` | 22 | content=22 |
| PASS | complete | `/community/create` | 27 | content=27 |
| WARN | empty | `/community/jobs` | 17 | intentional empty state |
| PASS | complete | `/community/groups` | 27 | content=27 |
| PASS | complete | `/community/events` | 19 | content=19 |
| PASS | complete | `/community/companies` | 28 | content=28 |
| PASS | complete | `/community/stories` | 14 | content=14 |
| FAIL | error | `/community/saved` | 13 | error on route |
| PASS | complete | `/community/people` | 41 | content=41 |
| PASS | complete | `/chat` | 54 | content=54 |
| PASS | complete | `/chat/groups` | 11 | content=11 |
| PASS | complete | `/chat/calls` | 49 | content=49 |
| FAIL | crash | `/class` | 20 | lmkd OOM; content=20 |
| PASS | complete | `/class/video` | 29 | content=29 |
| PASS | complete | `/class/audio` | 18 | content=18 |
| PASS | complete | `/class/playlists` | 10 | content=10 |
| PASS | complete | `/co-work` | 28 | content=28 |
| PASS | complete | `/co-work/schedule` | 17 | content=17 |
| PASS | complete | `/co-work/meetings` | 31 | content=31 |
| PASS | complete | `/co-work/join` | 19 | content=19 |
| FAIL | error | `/profile` | 9 | error on route |
| PASS | complete | `/notifications` | 24 | content=24 |
| PASS | complete | `/settings` | 19 | content=19 |
| PASS | complete | `/settings/account` | 16 | content=16 |
| PASS | complete | `/settings/security` | 29 | content=29 |
| FAIL | error | `/settings/appearance` | 10 | error on route |
| FAIL | error | `/settings/notifications` | 9 | error on route |
| WARN | empty | `/settings/privacy` | 12 | intentional empty state |
| FAIL | error | `/settings/community` | 9 | error on route |
| FAIL | error | `/settings/commerce` | 10 | error on route |
| FAIL | error | `/settings/shop` | 10 | error on route |
| FAIL | error | `/settings/class` | 9 | error on route |
| FAIL | error | `/settings/co-work` | 9 | error on route |
| PASS | complete | `/settings/about` | 10 | content=10 |
| PASS | complete | `/help` | 23 | content=23 |
| PASS | complete | `/legal/terms` | 14 | content=14 |
| PASS | complete | `/legal/privacy` | 14 | content=14 |
| PASS | complete | `/vendor` | 17 | content=17 |
| PASS | complete | `/vendor/myshop` | 17 | content=17 |
| FAIL | blank | `/auth/sign-in` | 0 | content_labels=0 |

Artifacts: `/tmp/device-qa/screen-health.jsonl`, `/tmp/device-qa/screen-health-report.md`
