# Unified app search

Cross-platform omnibox (web, iOS, Android) with marketplace-style typeahead and a federated `/search` results page.

## Screen search bars

Inline list screens use [`ScreenSearchField`](../components/search/ScreenSearchField.tsx) + [`useScreenSearch`](../hooks/useScreenSearch.ts):

| Pattern | Screens |
|---------|---------|
| **Debounced API** (250ms) | Jobs, Companies, Groups, Vendor orders, GIF picker |
| **Instant client filter** | Network, Notifications, Saved posts, User lists, Help FAQ |
| **Submit → `/search`** | When `unifiedScope` is set (people, jobs, companies, groups, posts) |

Shared helpers: [`lib/search/filter.ts`](../lib/search/filter.ts) (`textMatchesQuery`, `filterBySearchQuery`).

## Entry points

| Surface | Behavior |
|---------|----------|
| Desktop header | [`AppSearchField`](../components/search/AppSearchField.tsx) — dropdown suggestions + camera / mic / Ask AI |
| Mobile header | Same field — bottom sheet suggestions |
| Results | [`/search?q=&scope=&mode=`](../app/(store)/search/index.tsx) → [`UnifiedSearchScreen`](../components/search/UnifiedSearchScreen.tsx) |

Default scope follows the active tab (`listings` on commerce, `people` on community, path-specific scopes for jobs/companies/groups/posts/meetings/programs, `all` on Chat and bare `/search`).

## Multimodal search

| Mode | How | Result |
|------|-----|--------|
| **Voice** | Mic in omnibox → on-device STT ([`useVoiceSearch`](../hooks/useVoiceSearch.ts)) | Fills query and submits classic `/search?q=` |
| **Image** | Camera icon → pick/capture → `describe_search_image` on `ai-assist` | Navigates `/search?q=<keywords>&scope=listings` |
| **Ask AI** | Sparkles / suggest-panel chip → `/search?q=…&mode=ai&scope=listings` | Edge `ai_search` rewrites NL → `search_listings` + summary strip |

Image and AI search require sign-in (edge `ai-assist` auth). Voice works offline on-device when the platform supports speech recognition.

## Scopes

| Scope | Source |
|-------|--------|
| `all` | Top hits from each available scope |
| `listings` | `search_listings` (+ optional personalized RPC) + listing filters |
| `categories` | `searchCategories` |
| `shops` | `getPublicShops` |
| `people` | `searchProfiles` |
| `companies` | `fetchCompanies` |
| `groups` | `fetchGroups` |
| `jobs` | `search_jobs` RPC |
| `posts` | `searchPosts` (`posts_with_stats` content `ilike`) |
| `programs` | [`searchPrograms`](../class/lib/program-search.ts) |
| `meetings` | [`searchMeetings`](../co-work/lib/meetings.ts) |

Legacy aliases still parse: `shop` → `listings`, `classes` → `programs`.

## Access gating

Uses [`canAccessFeature`](../lib/auth/access.ts):

- Guests: listings, categories, shops (+ All composites of those).
- Male: + programs, meetings.
- Female: + people, companies, groups, jobs, posts.

## History

Unified key: `sheconomy:app-search-history` ([`lib/search/history.ts`](../lib/search/history.ts)). Migrates once from `sheconomy:marketplace-search-history`.

## Verification matrix

| Check | Web | iOS | Android |
|-------|-----|-----|---------|
| Typeahead debounce ~250ms | ☐ | ☐ | ☐ |
| Submit opens `/search` with scope | ☐ | ☐ | ☐ |
| Scope tabs keep `q` | ☐ | ☐ | ☐ |
| Listing filters when `scope=listings` | ☐ | ☐ | ☐ |
| Guest cannot search Community scopes | ☐ | ☐ | ☐ |
| Classes tab defaults `scope=programs` | ☐ | ☐ | ☐ |
| Recent history shared across tabs | ☐ | ☐ | ☐ |
| Mic fills query and submits | ☐ | ☐ | ☐ |
| Camera/image → listing keyword search | ☐ | ☐ | ☐ |
| Ask AI → `/search?mode=ai` summary + listings | ☐ | ☐ | ☐ |
