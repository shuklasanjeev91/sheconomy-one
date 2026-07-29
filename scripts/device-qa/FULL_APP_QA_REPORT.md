# Full application device QA report

Device: SM_G781B / release `com.sheconomy.ecommerce`
Scope: static routes, section tabs, bottom tabs, safe buttons, key forms
Excluded: real PayU charge, Sign out, Delete account, LiveKit media stress

**Totals:** PASS=92 WARN=13 FAIL=4 (n=109)
**Kinds:** {'ok': 88, 'blank': 2, 'oom': 1, 'empty': 13, 'role_gated': 5}

## Failures

| Type | Route | Kind | Notes | Sample |
|------|-------|------|-------|--------|
| section_tab | `tab:Class` | blank | tapped=True | ;  |
| section_tab | `tab:Co-Work` | ok | tapped=False | ; ; ; Phone; Messages |
| route | `/class` | oom |  | Search; Close; Vcqa testqa tesvyt; Clear search; SUGGESTIONS; No quick matches — |
| form | `form:search` | blank | no field |  |

## Warnings

| Type | Route | Kind | Notes |
|------|-------|------|-------|
| route | `/legal/terms` | empty |  |
| route | `/legal/privacy` | empty |  |
| route | `/legal/cookies` | empty |  |
| route | `/legal/ads` | empty |  |
| route | `/vendor` | empty |  |
| route | `/vendor/myshop` | empty |  |
| route | `/vendor/myshop/edit` | empty |  |
| route | `/vendor/products` | empty |  |
| route | `/vendor/orders` | empty |  |
| route | `/vendor/analytics` | empty |  |
| route | `/vendor/delivery` | empty |  |
| route | `/vendor/ads` | empty |  |
| route | `/vendor/reviews` | empty |  |

## Full matrix

| Status | Type | Route | Kind | Buttons tapped |
|--------|------|-------|------|----------------|
| PASS | section_tab | `tab:Home` | ok |  |
| PASS | section_tab | `tab:Community` | ok |  |
| PASS | section_tab | `tab:Chat` | ok |  |
| PASS | section_tab | `tab:Classes` | ok |  |
| FAIL | section_tab | `tab:Class` | blank |  |
| FAIL | section_tab | `tab:Co-Work` | ok |  |
| PASS | route | `/` | ok |  |
| PASS | route | `/shops` | ok | Browser, Samsung News, Page 1 of 2, Default page |
| PASS | route | `/favorites` | ok | Following |
| PASS | route | `/cart` | ok | Following |
| PASS | route | `/search` | ok |  |
| PASS | route | `/browse` | ok | Add, All, New collection name |
| PASS | route | `/browse/categories` | ok | Browser, Samsung News, Page 1 of 2, Default page |
| PASS | route | `/browse/physical` | ok | Browser, Samsung News, Page 1 of 2, Default page |
| PASS | route | `/browse/digital` | ok | Browser, Samsung News, Page 1 of 2, Default page |
| PASS | route | `/orders` | ok | Browser, Samsung News, Page 1 of 2, Default page |
| PASS | route | `/orders/success` | ok | Browser, Samsung News, Page 1 of 2, Default page |
| PASS | route | `/addresses` | ok | Browser, Samsung News, Page 1 of 2, Default page |
| PASS | route | `/payment-methods` | ok | Browser, Samsung News, Page 1 of 2, Default page |
| PASS | route | `/checkout` | ok | Browser, Samsung News, Page 1 of 2, Default page |
| PASS | route | `/following` | ok |  |
| PASS | route | `/create-my-shop` | ok | Browser, Samsung News, Page 1 of 2, Default page |
| PASS | route | `/community` | ok |  |
| PASS | route | `/community/network` | ok |  |
| PASS | route | `/community/create` | ok | What do you want to talk about?, Post |
| PASS | route | `/community/jobs` | ok | Post a job, Vcqa test |
| PASS | route | `/community/jobs/create` | ok | Vcqa test, Full-time, Part-time |
| PASS | route | `/community/groups` | ok | Create group, Vcqa testqa test |
| PASS | route | `/community/group/create` | ok | Create group, Vcqa testqa test, Public |
| PASS | route | `/community/events` | ok | Create event, Vcqa testqa tesyt |
| PASS | route | `/community/events/create` | ok | networking, Vcqa testqa tesyt, SHEconomy founders meetup |
| PASS | route | `/community/companies` | ok | Create page, Vcqa testqa tesyt |
| PASS | route | `/community/company/create` | ok | Vcqa testqa tesyt, acme-studio |
| PASS | route | `/community/stories` | ok | Add story, Vcqa testqa tesyt |
| PASS | route | `/community/stories/create` | ok | Photo or video story, Share a moment..., Share to story |
| PASS | route | `/community/saved` | ok | Vcqa testqa tesyt |
| PASS | route | `/community/people` | ok | Vcqa testqa tesyt |
| PASS | route | `/community/people/followers` | ok | Browser, Samsung News, Page 1 of 2, Default page |
| PASS | route | `/community/people/following` | ok | Vcqa testqa tesvyt |
| PASS | route | `/community/analytics` | ok | Vcqa testqa tesvyt, People you may know |
| PASS | route | `/chat` | ok | Vcqa testqa tesvyt |
| PASS | route | `/chat/groups` | ok | Vcqa testqa tesvyt |
| PASS | route | `/chat/calls` | ok | Vcqa testqa tesvyt |
| FAIL | route | `/class` | oom |  |
| PASS | route | `/class/video` | ok |  |
| PASS | route | `/class/audio` | ok |  |
| PASS | route | `/class/playlists` | ok |  |
| PASS | route | `/co-work` | ok | Share meeting, Enable camera & mic, Calendar |
| PASS | route | `/co-work/schedule` | ok | e.g. Investor update Friday 5pm — review, Generate meeting d |
| PASS | route | `/co-work/meetings` | ok | Start, Lobby |
| PASS | route | `/co-work/join` | ok | Join meeting, ABC DEF GHI, Enable camera & mic |
| PASS | route | `/profile` | ok | Share, qa test |
| PASS | route | `/notifications` | ok | Mark all read, qa test |
| PASS | route | `/settings` | ok |  |
| PASS | route | `/settings/account` | ok |  |
| PASS | route | `/settings/security` | ok | Paste device code, Approve, Revoke |
| PASS | route | `/settings/appearance` | ok | Update settings, Zoom out, Zoom in |
| PASS | route | `/settings/notifications` | ok |  |
| PASS | route | `/settings/privacy` | ok |  |
| PASS | route | `/settings/community` | ok |  |
| PASS | route | `/settings/commerce` | ok | Immediate, Daily digest, Weekly digest |
| PASS | route | `/settings/shop` | ok |  |
| PASS | route | `/settings/class` | ok |  |
| PASS | route | `/settings/co-work` | ok |  |
| PASS | route | `/settings/chat` | ok |  |
| PASS | route | `/settings/about` | ok |  |
| PASS | route | `/help` | ok | Ask AI |
| WARN | route | `/legal/terms` | empty | Help me get started withqa test SHEconom, Send |
| WARN | route | `/legal/privacy` | empty | Send |
| WARN | route | `/legal/cookies` | empty | Send |
| WARN | route | `/legal/ads` | empty | Send |
| WARN | route | `/vendor` | empty | Edit Shop, Preview, Send |
| WARN | route | `/vendor/myshop` | empty | Edit Shop, Preview, Send |
| WARN | route | `/vendor/myshop/edit` | empty | Bioayurveda, Send |
| WARN | route | `/vendor/products` | empty | Add Product, Clear Filters, Apply |
| WARN | route | `/vendor/orders` | empty | Refresh, Send |
| WARN | route | `/vendor/analytics` | empty | Export CSV, Send |
| WARN | route | `/vendor/delivery` | empty | Export CSV, Send |
| WARN | route | `/vendor/ads` | empty | Create, Export CSV, Percentage |
| WARN | route | `/vendor/reviews` | empty | Export CSV, Write a public reply…, Reply |
| PASS | route | `/vendor/create-listing` | ok | Browser, Samsung News, Page 1 of 2, Default page |
| PASS | route | `/vendor/settings` | ok | Browser, Samsung News, Page 1 of 2, Default page |
| PASS | route | `/auth/sign-in` | ok | Browser, Samsung News, Page 1 of 2, Default page |
| PASS | route | `/auth/complete-profile` | ok | Browser, Samsung News, Page 1 of 2, Default page |
| PASS | route | `/auth/import-contacts` | ok | Browser, Samsung News, Page 1 of 2, Default page |
| PASS | route | `/auth/verify-gender` | ok | Browser, Samsung News, Page 1 of 2, Default page |
| PASS | route | `/auth/qr` | ok | Browser, Samsung News, Page 1 of 2, Default page |
| PASS | route | `/ui-kit` | ok | Browser, Samsung News, Page 1 of 2, Default page |
| PASS | route | `/admin` | ok | Browser, Samsung News, Page 1 of 2, Default page |
| PASS | route | `/admin/users` | role_gated |  |
| PASS | route | `/admin/products` | role_gated |  |
| PASS | route | `/admin/orders` | ok | Browser, Samsung News, Page 1 of 2, Default page |
| PASS | route | `/admin/shops` | ok | Browser, Samsung News, Page 1 of 2, Default page |
| PASS | route | `/admin/categories` | role_gated |  |
| PASS | route | `/admin/payments` | ok | Browser, Samsung News, Page 1 of 2, Default page |
| PASS | route | `/admin/analytics` | ok | Browser, Samsung News, Page 1 of 2, Default page |
| PASS | route | `/admin/cms` | ok | Browser, Samsung News, Page 1 of 2, Default page |
| PASS | route | `/admin/blog` | ok | Browser, Samsung News, Page 1 of 2, Default page |
| PASS | route | `/admin/moderation` | ok | Browser, Samsung News, Page 1 of 2, Default page |
| PASS | route | `/admin/settings` | role_gated |  |
| PASS | route | `/admin/cart` | role_gated |  |
| PASS | route | `/admin/sale-events` | ok | Browser, Samsung News, Page 1 of 2, Default page |
| PASS | route | `/admin/company-pages` | ok | Browser, Samsung News, Page 1 of 2, Default page |
| PASS | route | `/admin/groups` | ok | Browser, Samsung News, Page 1 of 2, Default page |
| PASS | dynamic | `open_from:/` | ok | Go to home |
| FAIL | form | `form:search` | blank |  |
| PASS | form | `form:composer` | ok |  |
| PASS | form | `form:checkout_open` | ok |  |
| PASS | form | `form:cowork_join` | ok |  |
