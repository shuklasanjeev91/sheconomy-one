/**
 * Adapter that plugs the browser NSFW classifier into the listing images
 * service. The images service declares a small `ImageModerator` contract and
 * screens every upload through whatever moderator is active; this module
 * fulfils that contract with `analyzeImageContent` / `analyzeBatchImageContent`
 * from `nsfw-classifier`, exactly as the legacy `listingImagesService` used the
 * classifier directly.
 *
 * Web-only: the classifier relies on `window`, `Image`, `FileReader` and
 * `tf.browser.*`, so this adapter must only be loaded in the browser (the
 * images service loads it lazily behind a `Platform.OS === 'web'` guard).
 */

import type {
  ImageModerationResult,
  ImageModerator,
} from '~/lib/listing/listing-images.service'
import { registerImageModerator } from '~/lib/listing/listing-images.service'

import {
  analyzeBatchImageContent,
  analyzeImageContent,
  loadNSFWModel,
  type NsfwAnalysisResult,
  type NsfwImageInput,
} from './nsfw-classifier'

/** Map a classifier result to the images-service moderation verdict shape. */
function mapResult(analysis: NsfwAnalysisResult): ImageModerationResult {
  return {
    verdict: analysis.verdict,
    reasons: analysis.rejectionReasons ?? [],
    confidence: analysis.confidence,
  }
}

/**
 * Normalise a `Blob | File` into an input the classifier understands. Files are
 * passed straight through; bare Blobs are wrapped in an object URL (revoked via
 * the returned `cleanup`).
 */
function toClassifierInput(image: Blob | File): { input: NsfwImageInput; cleanup: () => void } {
  if (typeof File !== 'undefined' && image instanceof File) {
    return { input: image, cleanup: () => {} }
  }
  const url = URL.createObjectURL(image)
  return { input: url, cleanup: () => URL.revokeObjectURL(url) }
}

/** The NSFW image moderator that satisfies the images-service contract. */
export const nsfwImageModerator: ImageModerator = {
  async analyze(image) {
    const { input, cleanup } = toClassifierInput(image)
    try {
      const result = await analyzeImageContent(input, { includeDebugInfo: false })
      return mapResult(result)
    } finally {
      cleanup()
    }
  },

  async analyzeBatch(images, onProgress) {
    const prepared = images.map(toClassifierInput)
    try {
      const batch = await analyzeBatchImageContent(
        prepared.map((p) => p.input),
        {
          includeDebugInfo: false,
          onProgress: (progress) =>
            onProgress?.({ processed: progress.processed, total: progress.total }),
        },
      )
      return { results: batch.results.map(mapResult) }
    } finally {
      prepared.forEach((p) => p.cleanup())
    }
  },
}

/**
 * Register the NSFW moderator with the images service. Call once at web app
 * startup so every upload is screened. Passing `preload: true` starts loading
 * the TensorFlow model in the background (recommended before opening an
 * image-upload dialog) so the first analysis isn't slowed by model download.
 */
export function registerNsfwImageModerator(options: { preload?: boolean } = {}): void {
  registerImageModerator(nsfwImageModerator)
  if (options.preload) {
    // Fire-and-forget: warm the model cache without blocking.
    void loadNSFWModel().catch(() => {
      // Loading failures are non-fatal; moderation fails open until it loads.
    })
  }
}
