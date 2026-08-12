# NSFW Image Classifier

Listing image moderation before upload.

- **Web:** on-device TensorFlow.js (`nsfw-classifier` + `public/nsfwjs-model/`).
- **Native (iOS/Android):** server-side via `ai-assist` `moderate_image`
  (`listing-image-moderator.native.ts` / `nsfw-classifier.native.ts`). Fail-closed
  when the edge moderator is unavailable.

This module is wired into the listing image pipeline
(`~/lib/listing/listing-images.service`) so every image upload is checked
automatically on web and native.

---

## 1. File map

| File | Role |
|------|------|
| `~/lib/nsfwjs/nsfw-classifier.ts` | The classifier. Model loading, single + batch analysis, tensor cleanup, fallbacks. **Faithful port of the old JS — logic unchanged.** |
| `~/lib/nsfwjs/listing-image-moderator.ts` | Adapter that exposes the classifier as the images service's `ImageModerator`, plus `registerNsfwImageModerator()`. |
| `~/lib/nsfwjs/nsfw.errors.ts` | Stable error codes + `toFriendlyNsfwError()` for user-facing messages. |
| `~/commerce/components/NsfwErrorBoundary.tsx` | Error boundary that renders friendly NSFW/model errors + a retry action. |
| `public/nsfwjs-model/` | Model assets: `model.json`, `group1-shard1of1` (weights), `README.md`. Served at `/nsfwjs-model/model.json`. |

Requires `@tensorflow/tfjs` (already a project dependency). The model is
`[batch, 224, 224, 3]` float32 and outputs 5 classes: `drawing`, `hentai`,
`neutral`, `porn`, `sexy`.

---

## 2. How it's wired (no setup needed for uploads)

`listing-images.service` screens every upload through `moderateImages(...)`
before touching storage. When no moderator has been registered, it **lazily
imports this classifier on web** and uses it as the default:

```
uploadImage / batchUploadImages
        │
        ▼
  moderateImages(blobs)
        │  no registered moderator?
        ▼
  resolveModerator()  ── web only ──▶  import('../nsfwjs/listing-image-moderator')
        │                                     │
        ▼                                     ▼
  approved → upload            analyze / analyzeBatch (TensorFlow.js)
  rejected → throws ListingError(NSFW_CONTENT)
```

- **Web**: analysis runs; rejected images abort the upload with a friendly
  `ListingError`.
- **Native / load failure / analysis error**: fail-open (image is approved),
  exactly like the legacy service.

The classifier module is only pulled into the bundle lazily (via dynamic
import) so it never ships to native and doesn't load TensorFlow until the first
upload.

### Optional: register / preload explicitly

To screen the model earlier (recommended just before opening an upload dialog),
call the register helper at web startup — it also warms the model cache:

```ts
import { registerNsfwImageModerator } from '~/lib/nsfwjs/listing-image-moderator'

if (Platform.OS === 'web') {
  registerNsfwImageModerator({ preload: true }) // starts downloading the model in the background
}
```

To swap in a custom moderator (e.g. a server-side check), use the images
service hook directly — it takes precedence over the default classifier:

```ts
import { registerImageModerator } from '~/lib/listing/listing-images.service'

registerImageModerator(myCustomModerator) // pass null to clear
```

---

## 3. Direct API (advanced)

You normally don't call the classifier directly — the images service does. But
it's exported for custom flows (previews, standalone checks).

### `analyzeImageContent(input, options?)`

Analyze a single image. `input` is a `File`, image URL string, `data:` base64
string, or `HTMLImageElement`.

```ts
import { analyzeImageContent } from '~/lib/nsfwjs/nsfw-classifier'

const result = await analyzeImageContent(file, {
  customThresholds: { porn: 0.8 }, // stricter/looser per class
  includeDebugInfo: false,
  timeout: 60000,
})

result.verdict            // 'approved' | 'rejected'
result.confidence         // highest class score
result.scores             // { drawing, hentai, neutral, porn, sexy }
result.rejectionReasons    // ['Porn content detected (91.2%)']
result.metadata.fallback  // true when analysis failed and a safe default was returned
```

**Fail-open:** if analysis throws (model download, timeout, etc.) it returns a
safe `verdict: 'approved'` fallback with `metadata.fallback === true` rather
than throwing.

### `analyzeBatchImageContent(inputs, options?)`

Analyze 1–15 images efficiently (chunked, batched tensor prediction) with an
`onProgress` callback.

```ts
const batch = await analyzeBatchImageContent(files, {
  onProgress: ({ processed, total, percentage }) => { /* update UI */ },
})
batch.results       // NsfwAnalysisResult[]
batch.statistics    // { approved, rejected, failed, successRate }
```

### Other exports

| Export | Purpose |
|--------|---------|
| `loadNSFWModel()` | Preload + cache the model (singleton, retries transient failures). |
| `validateImageInput(input)` / `validateBatchImageInputs(inputs)` | Pre-flight input validation. |
| `getBatchRecommendation(count)` | Suggested batch size / chunking. |
| `getModelStatus()` | `{ modelLoaded, isLoading, loadAttempts, config, tensorflowLoaded }`. |
| `cleanup()` | Dispose the model + TF variables, reset cache. |
| `CONFIG` | Read-only config (see below). |

---

## 4. Configuration (`CONFIG`)

```ts
{
  MODEL_PATH: '/nsfwjs-model/',
  MODEL_SIZE: 224,
  DEFAULT_TIMEOUT: 60000,        // per single analysis (ms)
  MODEL_LOAD_TIMEOUT: 120000,
  REJECTION_THRESHOLDS: { porn: 0.7, sexy: 0.8, hentai: 0.7 },
  MAX_RETRIES: 3,
  RETRY_DELAY: 1000,
  MIN_BATCH_SIZE: 1,
  MAX_BATCH_SIZE: 15,
  OPTIMAL_BATCH_SIZE: 8,
}
```

An image is **rejected** when any class score exceeds its threshold. Override
per call via `options.customThresholds`.

---

## 5. Error handling

Wrap image-upload / preview UI in the boundary so model or analysis failures
render a friendly message instead of a crash:

```tsx
import { NsfwErrorBoundary } from '~/commerce/components/NsfwErrorBoundary'

<NsfwErrorBoundary scope="ImageUpload" onReset={retry}>
  <ImageUploader />
</NsfwErrorBoundary>
```

For toasts/banners, map any thrown value to a message:

```ts
import { toFriendlyNsfwError, NSFW_ERROR_CODES } from '~/lib/nsfwjs/nsfw.errors'

toast.show(toFriendlyNsfwError(error))
```

| Code | When |
|------|------|
| `nsfw/content-rejected` | Image flagged as inappropriate |
| `nsfw/model-load-failed` | Model/TensorFlow failed to download |
| `nsfw/analysis-timeout` | Analysis exceeded the timeout |
| `nsfw/analysis-failed` | Prediction failed |
| `nsfw/unsupported-input` | Input isn't a supported image |
| `nsfw/unknown` | Anything else |

> Note: when an upload is rejected, the **images service** throws a
> `ListingError(NSFW_CONTENT)` — surface that with `toFriendlyListingError`.
> The NSFW error map above is for using the classifier directly.

---

## 6. Model assets

The weights live in `public/nsfwjs-model/` and are served statically at
`/nsfwjs-model/model.json` (resolved from `window.location.origin`). If you see
`Failed to load model from /nsfwjs-model/model.json`:

1. Confirm `public/nsfwjs-model/model.json` and `group1-shard1of1` exist.
2. Check the network tab for 404s and that the host serves `.json` + binary.
3. Check CORS if serving from another origin.

---

## 7. Notes & constraints

- **Browser only.** Uses `window`, `Image`, `FileReader`, `tf.browser.*`. Do
  not import `nsfw-classifier` on native — go through the images service, which
  guards with `Platform.OS === 'web'`.
- **First run is slow** (~10–25s) while the model downloads; cached afterwards.
  Preload with `registerNsfwImageModerator({ preload: true })` for a smoother UX.
- **Memory**: tensors are disposed automatically; batch sizes are capped at 15.
