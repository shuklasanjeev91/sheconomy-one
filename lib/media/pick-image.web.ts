import type { PickedDocument, PickImagesOptions, PickedImage } from '~/lib/media/pick-image'

export type { PickedDocument, PickedImage, PickImagesOptions }

export async function pickImages(options: PickImagesOptions = {}): Promise<PickedImage[]> {
  if (typeof document === 'undefined') return []

  const maxCount = options.maxCount ?? (options.multiple ? 5 : 1)

  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/jpeg,image/png,image/webp,image/gif'
    input.multiple = !!options.multiple
    input.style.display = 'none'

    input.onchange = () => {
      const files = Array.from(input.files ?? []).slice(0, maxCount)
      resolve(
        files.map((file) => ({
          uri: URL.createObjectURL(file),
          mimeType: file.type || 'image/jpeg',
          fileName: file.name,
          file,
        })),
      )
      input.remove()
    }

    input.oncancel = () => {
      resolve([])
      input.remove()
    }

    document.body.appendChild(input)
    input.click()
  })
}

export async function captureImage(): Promise<PickedImage | null> {
  if (typeof document === 'undefined') return null

  // Prefer a live camera (works on desktop + mobile web). Fall back to a file
  // input with `capture` when the camera API is missing or permission fails.
  const mediaDevices =
    typeof navigator !== 'undefined' ? navigator.mediaDevices : undefined
  if (mediaDevices?.getUserMedia) {
    try {
      return await captureFromLiveCamera(mediaDevices)
    } catch {
      // No camera / permission denied → fall back to the file picker below.
    }
  }
  return captureViaFileInput()
}

/** Opens a full-screen live camera overlay and resolves with the captured photo. */
async function captureFromLiveCamera(mediaDevices: MediaDevices): Promise<PickedImage | null> {
  let facingMode: 'environment' | 'user' = 'environment'
  let stream = await mediaDevices.getUserMedia({ video: { facingMode }, audio: false })

  return new Promise<PickedImage | null>((resolve) => {
    const overlay = document.createElement('div')
    overlay.style.cssText =
      'position:fixed;inset:0;z-index:2147483647;background:#000;display:flex;flex-direction:column;align-items:center;justify-content:center;'

    const video = document.createElement('video')
    video.autoplay = true
    video.muted = true
    video.playsInline = true
    video.setAttribute('playsinline', 'true')
    video.style.cssText = 'width:100%;height:100%;object-fit:contain;'
    overlay.appendChild(video)

    const closeBtn = document.createElement('button')
    closeBtn.setAttribute('aria-label', 'Close camera')
    closeBtn.textContent = '✕'
    closeBtn.style.cssText =
      'position:absolute;top:16px;right:16px;width:44px;height:44px;border-radius:999px;border:none;background:rgba(0,0,0,0.55);color:#fff;font-size:20px;cursor:pointer;'
    overlay.appendChild(closeBtn)

    const switchBtn = document.createElement('button')
    switchBtn.setAttribute('aria-label', 'Switch camera')
    switchBtn.textContent = '⟳'
    switchBtn.style.cssText =
      'position:absolute;top:16px;left:16px;width:44px;height:44px;border-radius:999px;border:none;background:rgba(0,0,0,0.55);color:#fff;font-size:22px;cursor:pointer;'
    overlay.appendChild(switchBtn)

    const shutter = document.createElement('button')
    shutter.setAttribute('aria-label', 'Take photo')
    shutter.style.cssText =
      'position:absolute;bottom:34px;left:50%;transform:translateX(-50%);width:72px;height:72px;border-radius:999px;background:#fff;border:5px solid rgba(255,255,255,0.5);cursor:pointer;'
    overlay.appendChild(shutter)

    function stopStream() {
      stream.getTracks().forEach((track) => track.stop())
    }

    function cleanup() {
      stopStream()
      overlay.remove()
    }

    function finish(result: PickedImage | null) {
      cleanup()
      resolve(result)
    }

    closeBtn.onclick = () => finish(null)

    switchBtn.onclick = async () => {
      facingMode = facingMode === 'environment' ? 'user' : 'environment'
      stopStream()
      try {
        stream = await mediaDevices.getUserMedia({ video: { facingMode }, audio: false })
        video.srcObject = stream
        await video.play()
      } catch {
        finish(null)
      }
    }

    shutter.onclick = () => {
      const canvas = document.createElement('canvas')
      canvas.width = video.videoWidth || 1280
      canvas.height = video.videoHeight || 720
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        finish(null)
        return
      }
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            finish(null)
            return
          }
          const fileName = `camera-${Date.now()}.jpg`
          const file = new File([blob], fileName, { type: 'image/jpeg' })
          finish({
            uri: URL.createObjectURL(file),
            mimeType: 'image/jpeg',
            fileName,
            file,
          })
        },
        'image/jpeg',
        0.9,
      )
    }

    video.srcObject = stream
    document.body.appendChild(overlay)
    void video.play()
  })
}

/** Legacy path: a hidden file input that opens the camera on mobile browsers. */
function captureViaFileInput(): Promise<PickedImage | null> {
  if (typeof document === 'undefined') return Promise.resolve(null)

  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    input.setAttribute('capture', 'environment')
    input.style.display = 'none'

    input.onchange = () => {
      const file = input.files?.[0]
      resolve(
        file
          ? {
              uri: URL.createObjectURL(file),
              mimeType: file.type || 'image/jpeg',
              fileName: file.name,
              file,
            }
          : null,
      )
      input.remove()
    }

    input.oncancel = () => {
      resolve(null)
      input.remove()
    }

    document.body.appendChild(input)
    input.click()
  })
}

export async function pickDocument(): Promise<PickedDocument | null> {
  if (typeof document === 'undefined') return null

  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept =
      'application/pdf,application/msword,application/vnd.openxmlformats-officedocument.*,application/vnd.ms-excel,application/vnd.ms-powerpoint,text/plain,application/zip,audio/*,video/*'
    input.style.display = 'none'

    input.onchange = () => {
      const file = input.files?.[0]
      resolve(
        file
          ? {
              uri: URL.createObjectURL(file),
              mimeType: file.type || 'application/octet-stream',
              fileName: file.name,
              fileSize: file.size,
              file,
            }
          : null,
      )
      input.remove()
    }

    input.oncancel = () => {
      resolve(null)
      input.remove()
    }

    document.body.appendChild(input)
    input.click()
  })
}

export async function pickedImageToBlob(image: PickedImage): Promise<Blob> {
  if (image.file) return image.file
  const response = await fetch(image.uri)
  if (!response.ok) {
    throw new Error('Could not read the selected image.')
  }
  return response.blob()
}

export function releasePickedImage(image: PickedImage) {
  if (image.file || !image.uri.startsWith('blob:')) return
  URL.revokeObjectURL(image.uri)
}
