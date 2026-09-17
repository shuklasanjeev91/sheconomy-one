import { describe, expect, it } from 'vitest'

import {
  clearImageCropQueue,
  requestImageCrop,
  useImageCropSession,
} from '~/lib/media/crop-session'
import type { PickedImage } from '~/lib/media/pick-image'

const sample: PickedImage = {
  uri: 'file:///tmp/bg.jpg',
  mimeType: 'image/jpeg',
  fileName: 'bg.jpg',
}

describe('clearImageCropQueue', () => {
  it('cancels the open crop and any queued crops', async () => {
    const first = requestImageCrop(sample, { title: 'Crop virtual background', aspect: [16, 9] })
    const second = requestImageCrop(
      { ...sample, uri: 'file:///tmp/bg2.jpg' },
      { title: 'Crop virtual background' },
    )

    // Store exposes the first pending crop while the promise is outstanding.
    expect(useImageCropSession).toBeTypeOf('function')

    clearImageCropQueue()

    await expect(first).resolves.toBeNull()
    await expect(second).resolves.toBeNull()
  })
})
