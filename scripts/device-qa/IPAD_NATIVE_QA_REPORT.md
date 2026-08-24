# iPad native QA report

- Started: `2026-08-24T10:13:34.346995+00:00`
- Device: iPad Pro USB `4B264D11-0D94-563C-9F1C-68B874AD0B3C` / `00008112-001E24500E81A01E`
- Bundle: `com.sheconomy.ecommerce`
- Method: deep-link route sweep via `devicectl --payload-url` + `idevicesyslog` error scan
- Note: Full tap/gesture automation needs WDA + sudo RSD tunnel (not available in this session)
- Base PID after cold launch: `1049`

## Summary
- Routes exercised: **51**
- Pass (launched + stayed alive): **51**
- Warn (alive but launch message unclear): **0**
- Fail (crashed / process gone): **0**
- Syslog error pattern hits: **0** (unique lines kept: 0)

## Failures
- None — app process stayed alive across all deep links.

## Warnings
- None

## Syslog error samples
- No matching JS/native error markers in syslog during the sweep.

## All routes
- **PASS** `store/home` `/` pid=1049 (4.92s)
- **PASS** `store/shops` `/shops` pid=1049 (4.89s)
- **PASS** `store/favorites` `/favorites` pid=1049 (4.88s)
- **PASS** `store/cart` `/cart` pid=1049 (4.91s)
- **PASS** `store/search` `/search` pid=1049 (4.92s)
- **PASS** `store/browse_categories` `/browse/categories` pid=1049 (4.94s)
- **PASS** `store/orders` `/orders` pid=1049 (4.93s)
- **PASS** `store/addresses` `/addresses` pid=1049 (4.91s)
- **PASS** `store/payment_methods` `/payment-methods` pid=1049 (4.91s)
- **PASS** `store/following` `/following` pid=1049 (4.92s)
- **PASS** `store/listing_sample` `/listing/red-striped-table-mat-corner-lotus-online` pid=1049 (4.91s)
- **PASS** `store/shop_sample` `/shop/sidscreation` pid=1049 (4.89s)
- **PASS** `store/category_sample` `/category/fashion` pid=1049 (4.91s)
- **PASS** `community/home` `/community` pid=1049 (4.93s)
- **PASS** `community/network` `/community/network` pid=1049 (4.93s)
- **PASS** `community/create` `/community/create` pid=1049 (4.93s)
- **PASS** `community/jobs` `/community/jobs` pid=1049 (4.94s)
- **PASS** `community/groups` `/community/groups` pid=1049 (4.93s)
- **PASS** `community/events` `/community/events` pid=1049 (4.93s)
- **PASS** `community/companies` `/community/companies` pid=1049 (4.92s)
- **PASS** `community/stories` `/community/stories` pid=1049 (4.94s)
- **PASS** `community/saved` `/community/saved` pid=1049 (4.92s)
- **PASS** `community/people` `/community/people` pid=1049 (4.95s)
- **PASS** `community/analytics` `/community/analytics` pid=1049 (4.95s)
- **PASS** `community/post_sample` `/community/post/46ff0197-62bc-4be4-94b2-5a8a0904354a` pid=1049 (4.96s)
- **PASS** `chat/home` `/chat` pid=1049 (4.91s)
- **PASS** `chat/groups` `/chat/groups` pid=1049 (4.94s)
- **PASS** `chat/calls` `/chat/calls` pid=1049 (4.94s)
- **PASS** `class/home` `/class` pid=1049 (4.88s)
- **PASS** `class/video` `/class/video` pid=1049 (4.9s)
- **PASS** `class/audio` `/class/audio` pid=1049 (4.94s)
- **PASS** `class/playlists` `/class/playlists` pid=1049 (4.93s)
- **PASS** `cowork/home` `/co-work` pid=1049 (4.94s)
- **PASS** `cowork/schedule` `/co-work/schedule` pid=1049 (4.93s)
- **PASS** `cowork/meetings` `/co-work/meetings` pid=1049 (4.92s)
- **PASS** `cowork/join` `/co-work/join` pid=1049 (4.94s)
- **PASS** `account/profile` `/profile` pid=1049 (4.93s)
- **PASS** `account/notifications` `/notifications` pid=1049 (4.93s)
- **PASS** `account/settings` `/settings` pid=1049 (4.92s)
- **PASS** `account/settings_account` `/settings/account` pid=1049 (4.93s)
- **PASS** `account/settings_security` `/settings/security` pid=1049 (4.95s)
- **PASS** `account/settings_appearance` `/settings/appearance` pid=1049 (4.93s)
- **PASS** `account/settings_notifications` `/settings/notifications` pid=1049 (4.94s)
- **PASS** `account/settings_privacy` `/settings/privacy` pid=1049 (4.95s)
- **PASS** `account/help` `/help` pid=1049 (4.92s)
- **PASS** `vendor/home` `/vendor` pid=1049 (4.93s)
- **PASS** `vendor/myshop` `/vendor/myshop` pid=1049 (4.93s)
- **PASS** `vendor/products` `/vendor/products` pid=1049 (4.93s)
- **PASS** `vendor/orders` `/vendor/orders` pid=1049 (4.93s)
- **PASS** `blog/home` `/blog` pid=1049 (4.93s)
- **PASS** `creator/hub_probe` `/u/yoreb96930` pid=1049 (4.94s)

---

## Follow-up (same day): interactive WDA taps

Completed from Cursor on the USB iPad:

- WDA runner `com.sheconomy.WebDriverAgentRunner.xctrunner` + `iproxy 8100`
- Top tabs Commerce / Community / Chat / Classes / Co-Work tapped and screenshot-verified
- Community bottom Home / Network / Create / Jobs / You verified
- Create post: **Post button visible** (AI FAB does not cover it)
- Full write-up: `.tmp/ipad-qa/IPAD_WDA_TAP_QA_REPORT.md`
- Screenshots: `.tmp/ipad-qa/wda-taps/`
