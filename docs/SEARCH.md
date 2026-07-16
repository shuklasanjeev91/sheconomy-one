# Unified app search

Cross-platform omnibox (web, iOS, Android) with Amazon/Etsy-style typeahead and a federated `/search` results page.

## Entry points

| Surface | Behavior |
|---------|----------|
| Desktop header | [`AppSearchField`](../components/search/AppSearchField.tsx) — dropdown suggestions |
| Mobile header | Same field — bottom sheet suggestions |
| Results | [`/search?q=&scope=`](../app/(store)/search/index.tsx) → [`UnifiedSearchScreen`](../components/search/UnifiedSearchScreen.tsx) |

Default scope follows the active tab (`listings` on commerce, `people` on community, path-specific scopes for jobs/companies/groups/posts/meetings/programs, `all` on Chat and bare `/search`).

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
