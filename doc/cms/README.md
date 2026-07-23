# CMS Store — Developer Guide

Everything CMS-related lives in **`lib/cms/`** and is exposed through a
**Redux Toolkit** store. This guide is for UI developers who want to read CMS
state and dispatch CMS actions from admin/blog screens — content, categories,
tags, media, comments, likes, versions, SEO, and redirects.

> **TL;DR** — Import the typed hooks, read state with `useAppSelector`, and
> trigger work with `dispatch(thunk(args))`. Prefer thunks from the store; do
> **not** call `cms.service` from components. Like toggles update the UI
> **optimistically** and roll back if the server rejects them.

---

## 1. File map

| File | What it holds |
|------|---------------|
| `lib/cms/cms.type.ts` | All TypeScript types + constants (`CmsContent`, `CmsCategory`, `CMS_CONTENT_TYPES`, `CMS_VALIDATION`, …) |
| `lib/cms/cms.service.ts` | Typed Supabase data-access functions (network layer). You normally do **not** call these from UI — dispatch thunks instead. |
| `lib/cms/cms.store.ts` | Redux slice, async thunks, and sync actions. **This is your main entry point.** |
| `lib/cms/cms.utils.ts` | Pure helpers (`generateSlug`, `calculateSeoScore`, `buildMetaTags`, `pageToRange`, `autoExcerpt`, …) |
| `lib/cms/cms.validation.ts` | Zod schemas + field validators (`createContentSchema`, `cmsTitleValidator`, `parseOrThrow`, …) |
| `lib/cms/index.ts` | Barrel re-exports for convenient imports |
| `lib/store/index.ts` | Root store (`store`, `RootState`, `AppDispatch`) — CMS is registered as `cms` |
| `lib/store/hooks.ts` | **Typed hooks: `useAppDispatch`, `useAppSelector`** |

The Redux `<Provider>` is already wired at the app root (`app/_layout.tsx`), so
there is nothing to set up — just use the hooks.

DB schema: `supabase/migrations/20260717120000_cms_setup.sql`.

---

## 2. The 30-second version

```tsx
import { useEffect } from 'react'

import { useAppDispatch, useAppSelector } from '~/lib/store/hooks'
import { loadContents, createContent, publishContent } from '~/lib/cms'

export function AdminBlogList() {
  const dispatch = useAppDispatch()
  const items = useAppSelector((s) => s.cms.items)
  const isFetching = useAppSelector((s) => s.cms.isFetching)
  const contentError = useAppSelector((s) => s.cms.contentError)

  useEffect(() => {
    dispatch(loadContents({ type: 'post', page: 1, limit: 20 }))
  }, [dispatch])

  if (isFetching) return <Spinner />
  if (contentError) return <Text>{contentError}</Text>

  return (
    <>
      <Button
        onPress={() =>
          dispatch(
            createContent({
              type: 'post',
              title: 'Hello world',
              slug: 'hello-world',
              status: 'draft',
              body: 'First post',
            }),
          )
        }
      >
        New draft
      </Button>
      {items.map((post) => (
        <Button key={post.id} onPress={() => dispatch(publishContent({ id: post.id }))}>
          Publish {post.title}
        </Button>
      ))}
    </>
  )
}
```

---

## 3. State shape

`useAppSelector((s) => s.cms.<field>)`

### Content

| Field | Type | Meaning |
|-------|------|---------|
| `items` | `CmsContentDetail[]` | Paginated content list |
| `currentContent` | `CmsContentDetail \| null` | Single content row (detail / editor) |
| `contentMeta` | `CmsPaginationMeta` | `total`, `page`, `limit`, `hasNextPage`, … |
| `contentFilters` | `CmsListContentParams` | Last list filters (type, status, search, …) |
| `contentError` | `string \| null` | Last content-domain error |

### Taxonomy & media

| Field | Type | Meaning |
|-------|------|---------|
| `categories` | `CmsCategory[]` | Active categories |
| `currentCategory` | `CmsCategory \| null` | Selected category |
| `categoryError` | `string \| null` | Category error |
| `tags` | `CmsTag[]` | All tags |
| `tagError` | `string \| null` | Tag error |
| `mediaItems` | `CmsMedia[]` | Media library page |
| `mediaMeta` | `CmsPaginationMeta` | Media pagination |
| `isUploading` / `uploadProgress` | upload UI | Media upload progress |
| `mediaError` | `string \| null` | Media error |

### Engagement

| Field | Type | Meaning |
|-------|------|---------|
| `comments` | `CmsCommentWithAuthor[]` | Comments for the loaded content |
| `commentMeta` | `CmsPaginationMeta` | Comment pagination |
| `commentError` | `string \| null` | Comment error |
| `likedContentIds` | `Record<string, boolean>` | Whether the current user liked each content id |
| `likeCounts` | `Record<string, number>` | Like counts keyed by content id |
| `versions` | `CmsContentVersion[]` | Version history for current content |
| `versionError` | `string \| null` | Version error |

### SEO & redirects

| Field | Type | Meaning |
|-------|------|---------|
| `seoRecords` | `Record<string, CmsSeo>` | SEO by content id, `cat:<id>`, or `path:<path>` |
| `sitemapFeed` | `CmsSitemapFeedRow[]` | Rows from `cms_sitemap_feed` |
| `seoError` | `string \| null` | SEO error |
| `redirects` | `CmsRedirect[]` | Redirect rules |
| `redirectMeta` | `CmsPaginationMeta` | Redirect pagination |
| `redirectError` | `string \| null` | Redirect error |

### Shared flags

| Field | Type | Meaning |
|-------|------|---------|
| `isFetching` | `boolean` | A read/fetch is in flight |
| `isCreating` | `boolean` | A create is in flight |
| `isUpdating` | `boolean` | An update is in flight |
| `isDeleting` | `boolean` | A delete is in flight |

---

## 4. Optimistic UI (likes)

`toggleLike` follows the same three-phase lifecycle as profile mutations:

1. **`pending`** — flips `likedContentIds[contentId]` and adjusts `likeCounts` immediately.
2. **`fulfilled`** — reconciles with the server `{ liked, like_count }`.
3. **`rejected`** — rolls the optimistic flip back.

Other CMS writes update the list/current row on **fulfilled** (not full optimistic
patches). Show spinners from `isCreating` / `isUpdating` / `isDeleting` when needed.

---

## 5. Async thunks (dispatch these)

Import from `~/lib/cms` or `~/lib/cms/cms.store`. Dispatch as
`dispatch(thunkName(arg))`.

### Content — reading

| Thunk | Arg | Does |
|-------|-----|------|
| `loadContents` | `Partial<CmsListContentParams>?` | Paginated list → `items` + `contentMeta` (merges with stored filters) |
| `loadContentById` | `contentId: string` | Detail → `currentContent` |
| `loadContentBySlug` | `slug: string` | Detail by slug → `currentContent` |

### Content — writes

| Thunk | Arg | Does |
|-------|-----|------|
| `createContent` | payload matching `createContentSchema` | Creates draft (+ tags + first version) |
| `updateContent` | `{ id, payload }` | Updates content, syncs tags, snapshots version |
| `publishContent` | `{ id, publishedAt? }` | Sets status `published` |
| `scheduleContent` | `{ id, scheduledAt }` | Sets status `scheduled` |
| `archiveContent` | `id` | Sets status `archived` |
| `softDeleteContent` | `id` | Sets `deleted_at`, removes from `items` |
| `deleteContent` | `id` | Hard delete (admin) |
| `addGalleryItem` | `{ contentId, mediaId, sortOrder? }` | Attaches media, refreshes `currentContent` |
| `removeGalleryItem` | `{ contentMediaId, contentId }` | Detaches media, refreshes `currentContent` |

### Categories & tags

| Thunk | Arg |
|-------|-----|
| `loadCategories` | — |
| `loadCategoryById` | `id` |
| `createCategory` | `createCategorySchema` payload |
| `updateCategory` | `{ id, payload }` |
| `deleteCategory` | `{ id, mode?: 'soft' \| 'hard' }` (default `soft`) |
| `loadTags` | — |
| `createTag` | `createTagSchema` payload |
| `updateTag` | `{ id, payload }` |
| `deleteTag` | `id` |

### Media

| Thunk | Arg | Does |
|-------|-----|------|
| `loadMedia` | `{ folder?, media_type?, page?, limit? }?` | Media library page |
| `uploadMedia` | `{ file: CmsMediaUploadFile, options? }` | Upload to Storage + insert `cms_media` |
| `updateMedia` | `{ id, payload }` | Alt text / caption / folder |
| `deleteMedia` | `id` | Removes Storage object + DB row |

`CmsMediaUploadFile = { blob, mimeType, fileName, fileSize }`

### Comments & likes

| Thunk | Arg |
|-------|-----|
| `loadComments` | `listCommentsParamsSchema` shape (`content_id` required) |
| `createComment` | `{ content_id, body, parent_id? }` |
| `updateComment` | `{ id, body }` |
| `moderateComment` | `{ id, payload: { is_approved?, is_flagged?, deleted_at? } }` |
| `softDeleteComment` | `id` |
| `deleteComment` | `id` |
| `toggleLike` | `contentId` (optimistic) |
| `checkLike` | `contentId` |
| `loadContentLikes` | `contentId` | Everyone who liked → `contentLikes` (admin engagement) |

### Versions

| Thunk | Arg | Does |
|-------|-----|------|
| `loadVersions` | `contentId` | History → `versions` |
| `restoreVersion` | `versionId` | Restores title/body onto content, refreshes versions |

### SEO & redirects

| Thunk | Arg |
|-------|-----|
| `loadSeoByContentId` | `contentId` |
| `loadSeoByCategoryId` | `categoryId` |
| `loadSeoByPath` | `path` (e.g. `'/'`) |
| `upsertSeo` | `createSeoSchema` payload (exactly one of `content_id` / `category_id` / `custom_path`) |
| `updateSeo` | `{ id, payload }` |
| `deleteSeo` | `id` |
| `loadSitemapFeed` | — |
| `loadRedirects` | `{ page?, limit? }?` |
| `createRedirect` | `createRedirectSchema` payload |
| `updateRedirect` | `{ id, payload }` |
| `toggleRedirectActive` | `{ id, isActive }` |
| `deleteRedirect` | `id` |

---

## 6. Sync actions (dispatch for pure UI state)

Imported from `~/lib/cms`:

| Action | Arg | Does |
|--------|-----|------|
| `clearCurrentContent` | — | Clears `currentContent` + `contentError` |
| `resetContentFilters` | — | Resets list filters to defaults |
| `setCmsError` | `{ domain, error }` | Sets a domain error banner (`content` \| `category` \| `tag` \| `media` \| `comment` \| `version` \| `seo` \| `redirect`) |
| `resetCms` | — | Resets the whole CMS slice (e.g. on sign-out if needed) |

Sign-out already dispatches the global `resetStore`, which wipes every slice
including `cms`.

---

## 7. Reacting to success / failure

Thunks return a Promise you can `unwrap()`:

```tsx
async function onPublish(id: string) {
  try {
    await dispatch(publishContent({ id })).unwrap()
    toast.show('Published', { tone: 'success' })
  } catch (message) {
    toast.show('Publish failed', { tone: 'danger', message: String(message) })
  }
}
```

Or just `dispatch(...)` and render from the matching `*Error` field
(`contentError`, `mediaError`, …).

---

## 8. Validation helpers

Zod schemas live in `cms.validation.ts`. The store already parses payloads
inside create/update thunks via `parseOrThrow`.

For forms with `useFormValidation`:

```tsx
import { useFormValidation } from '~/hooks/useFormValidation'
import { cmsTitleValidator, cmsSlugValidator } from '~/lib/cms'

const form = useFormValidation({
  schema: {
    title: { validators: [cmsTitleValidator] },
    slug: { validators: [cmsSlugValidator] },
  },
})
```

Or validate an object before dispatching:

```tsx
import { createContentSchema, validateWithSchema } from '~/lib/cms'

const { isValid, errors, data } = validateWithSchema(createContentSchema, formValues)
if (!isValid) return toast.show(errors.join(', '))
dispatch(createContent(data))
```

Useful schemas: `createContentSchema`, `updateContentSchema`,
`createCategorySchema`, `createTagSchema`, `createCommentSchema`,
`createSeoSchema`, `createRedirectSchema`, `listContentParamsSchema`.

---

## 9. Utils (pure helpers)

From `~/lib/cms` / `cms.utils.ts` — safe to use in UI without dispatching:

| Helper | Use |
|--------|-----|
| `generateSlug(text)` | Title → URL slug |
| `uniquifySlug(base)` | Append timestamp suffix |
| `calculateSeoScore(content)` | 0–100 on-page score |
| `buildMetaTags(content, baseUrl)` | Meta / Open Graph / Twitter descriptors |
| `autoExcerpt(body, format)` | Generate excerpt from body |
| `isPublished(content)` | `status === 'published' && !deleted_at` |
| `mimeToMediaType(mime)` | Map MIME → `cms_media_type` |
| `pageToRange` / `buildPaginationMeta` | Pagination math |

---

## 10. Common recipes

**Admin content list with filters**

```tsx
dispatch(loadContents({ type: 'post', status: 'draft', search: query, page: 1 }))
const { items, contentMeta, isFetching } = useAppSelector((s) => s.cms)
```

**Next page**

```tsx
dispatch(loadContents({ page: contentMeta.page + 1 }))
```

**Editor load + save**

```tsx
useEffect(() => {
  dispatch(loadContentById(id))
}, [dispatch, id])

await dispatch(
  updateContent({
    id,
    payload: { title, body, tag_ids: selectedTagIds, change_note: 'Edited body' },
  }),
).unwrap()
```

**Upload cover image then attach**

```tsx
const media = await dispatch(
  uploadMedia({
    file: { blob, mimeType: blob.type, fileName: 'cover.jpg', fileSize: blob.size },
    options: { folder: '/covers', alt_text: 'Cover' },
  }),
).unwrap()

await dispatch(updateContent({ id: contentId, payload: { cover_image_id: media.id } })).unwrap()
```

**Auto slug from title**

```tsx
import { generateSlug } from '~/lib/cms'
const slug = generateSlug(title)
```

**Reset filters**

```tsx
dispatch(resetContentFilters())
dispatch(loadContents())
```

---

## 11. Constants you’ll use often

From `cms.type.ts`:

```ts
CMS_CONTENT_TYPES      // post | page | product | announcement
CMS_CONTENT_STATUSES   // draft | review | scheduled | published | archived
CMS_MEDIA_TYPES        // image | video | document | audio | other
CMS_MEDIA_BUCKETS      // PUBLIC: 'cms-media', PRIVATE: 'cms-private'
CMS_VALIDATION         // field length limits aligned to DB
DEFAULT_CONTENT_FILTERS
```

Roles / RLS: Admin (`A`) can publish/hard-delete; vendors (`V`) can create and
edit their own drafts; public can read published content. Enforced in Supabase,
not in the store.

---

## 12. Do / Don't

- ✅ Dispatch thunks/actions from components; read via `useAppSelector((s) => s.cms)`.
- ✅ Import from `~/lib/cms` (barrel) or `~/lib/cms/cms.store`.
- ✅ Use `.unwrap()` when you need success/error toasts.
- ✅ Use `generateSlug` / Zod schemas instead of hard-coding validation rules.
- ❌ Don't call `cms.service.*` directly from components (bypasses the store).
- ❌ Don't store `Blob`/`File` in Redux — pass them only as `uploadMedia` thunk args.
- ❌ Don't duplicate CMS table queries elsewhere; extend `cms.service` / thunks instead.
