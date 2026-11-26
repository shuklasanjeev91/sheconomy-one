/**
 * Native listing image moderator. Fail open on device — server vision
 * false-positives were blocking clothed fashion / portrait product shots.
 * Web listings still use on-device NSFWJS.
 */

import type {
  ImageModerationResult,
  ImageModerator,
} from '~/lib/listing/listing-images.service'

export const nsfwImageModerator: ImageModerator = {
  async analyze(_image) {
    const result: ImageModerationResult = {
      verdict: 'approved',
      reasons: [],
      confidence: 0,
    }
    return result
  },
}
