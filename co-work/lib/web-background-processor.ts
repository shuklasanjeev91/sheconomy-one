import type { ImageSegmenter } from '@mediapipe/tasks-vision'

import type { VirtualBackgroundSelection } from '~/co-work/lib/virtual-backgrounds'

const TASKS_VISION_VERSION = '0.10.14'
const WASM_BASE_URL = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${TASKS_VISION_VERSION}/wasm`
const SELFIE_MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/latest/selfie_segmenter.tflite'
/** Segmentation input width; the mask is upscaled with smoothing. */
const SEGMENT_WIDTH = 320
const OUTPUT_FPS = 24

export type WebBackgroundOptions =
  | { mode: 'disabled' }
  | { mode: 'blur'; blurRadius: number }
  | { mode: 'image'; imageUrl: string }

export function webBackgroundOptionsFor(selection: VirtualBackgroundSelection): WebBackgroundOptions {
  if (selection.mode === 'blur') {
    return { mode: 'blur', blurRadius: selection.blurRadius ?? 12 }
  }
  if (selection.mode === 'image' && selection.imageUrl) {
    return { mode: 'image', imageUrl: selection.imageUrl }
  }
  return { mode: 'disabled' }
}

export type WebBackgroundProcessorEvents = {
  maxFps?: number
  onFrameProcessed?: (info: { processingTimeMs: number }) => void
}

let segmenterPromise: Promise<ImageSegmenter> | null = null

async function createSegmenter(): Promise<ImageSegmenter> {
  const { FilesetResolver, ImageSegmenter } = await import('@mediapipe/tasks-vision')
  const fileset = await FilesetResolver.forVisionTasks(WASM_BASE_URL)
  const create = (delegate: 'GPU' | 'CPU') =>
    ImageSegmenter.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: SELFIE_MODEL_URL, delegate },
      runningMode: 'VIDEO',
      outputCategoryMask: false,
      outputConfidenceMasks: true,
    })
  try {
    return await create('GPU')
  } catch {
    return create('CPU')
  }
}

function loadSegmenter(): Promise<ImageSegmenter> {
  segmenterPromise ??= createSegmenter().catch((cause) => {
    segmenterPromise = null
    throw cause
  })
  return segmenterPromise
}

export function supportsWebBackgroundProcessor(): boolean {
  if (typeof document === 'undefined' || typeof WebAssembly !== 'object') return false
  const canvas = document.createElement('canvas')
  return typeof canvas.captureStream === 'function' && !!canvas.getContext('2d')
}

async function loadImage(url: string): Promise<HTMLImageElement> {
  const image = new Image()
  image.crossOrigin = 'anonymous'
  image.src = url
  await image.decode()
  return image
}

/** Worker-driven ticks keep the effect running while the tab is in the background. */
function startTicker(fps: number, onTick: () => void): () => void {
  const interval = Math.round(1000 / fps)
  try {
    const source = 'let t;onmessage=(e)=>{clearInterval(t);if(e.data>0)t=setInterval(()=>postMessage(0),e.data)}'
    const url = URL.createObjectURL(new Blob([source], { type: 'text/javascript' }))
    const worker = new Worker(url)
    URL.revokeObjectURL(url)
    worker.onmessage = onTick
    worker.postMessage(interval)
    return () => worker.terminate()
  } catch {
    const timer = setInterval(onTick, interval)
    return () => clearInterval(timer)
  }
}

function drawCover(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  width: number,
  height: number,
) {
  const scale = Math.max(width / image.naturalWidth, height / image.naturalHeight)
  const drawWidth = image.naturalWidth * scale
  const drawHeight = image.naturalHeight * scale
  ctx.drawImage(image, (width - drawWidth) / 2, (height - drawHeight) / 2, drawWidth, drawHeight)
}

/**
 * Blur / replace the camera background: MediaPipe selfie segmentation on a
 * small copy of each frame, composited onto a canvas whose stream is sent.
 */
export class WebBackgroundProcessor {
  private options: WebBackgroundOptions = { mode: 'disabled' }
  private readonly maxFps: number
  private readonly onFrameProcessed?: WebBackgroundProcessorEvents['onFrameProcessed']
  private segmenter: ImageSegmenter | null = null
  private image: HTMLImageElement | null = null
  private video: HTMLVideoElement | null = null
  private output: HTMLCanvasElement | null = null
  private outputTrack: MediaStreamTrack | null = null
  private stopTicker: (() => void) | null = null
  private readonly segmentCanvas: HTMLCanvasElement
  private readonly maskCanvas: HTMLCanvasElement
  private readonly blurCanvas: HTMLCanvasElement
  private maskImage: ImageData | null = null
  private hasMask = false
  private lastSegmentAt = 0
  private segmenting = false
  private readonly supportsFilter: boolean

  constructor(events: WebBackgroundProcessorEvents = {}) {
    this.maxFps = events.maxFps ?? 15
    this.onFrameProcessed = events.onFrameProcessed
    this.segmentCanvas = document.createElement('canvas')
    this.maskCanvas = document.createElement('canvas')
    this.blurCanvas = document.createElement('canvas')
    const probe = this.maskCanvas.getContext('2d')
    this.supportsFilter = !!probe && 'filter' in probe
  }

  /** Load the model / image for `options`; the running pipeline picks it up next frame. */
  async switchTo(options: WebBackgroundOptions): Promise<void> {
    if (options.mode !== 'disabled') this.segmenter = await loadSegmenter()
    this.image = options.mode === 'image' ? await loadImage(options.imageUrl) : null
    this.options = options
  }

  /** Start processing `input`; returns the canvas track to send instead. */
  async start(input: MediaStreamTrack): Promise<MediaStreamTrack> {
    this.stop()
    const video = document.createElement('video')
    video.muted = true
    video.playsInline = true
    video.srcObject = new MediaStream([input])
    await video.play()
    const settings = input.getSettings()
    const width = settings.width || video.videoWidth || 1280
    const height = settings.height || video.videoHeight || 720

    const output = document.createElement('canvas')
    output.width = width
    output.height = height
    this.segmentCanvas.width = SEGMENT_WIDTH
    this.segmentCanvas.height = Math.max(1, Math.round((SEGMENT_WIDTH * height) / width))
    this.blurCanvas.width = Math.max(1, Math.round(width / 16))
    this.blurCanvas.height = Math.max(1, Math.round(height / 16))

    const outputTrack = output.captureStream(OUTPUT_FPS).getVideoTracks()[0]
    if (!outputTrack) throw new Error('Background effect could not start on this browser.')
    try {
      outputTrack.contentHint = 'motion'
    } catch {
      // Not supported.
    }
    this.video = video
    this.output = output
    this.outputTrack = outputTrack
    this.hasMask = false
    this.stopTicker = startTicker(OUTPUT_FPS, () => this.renderFrame())
    return outputTrack
  }

  /** Stop the pipeline (not the input track). */
  stop() {
    this.stopTicker?.()
    this.stopTicker = null
    this.outputTrack?.stop()
    this.outputTrack = null
    if (this.video) {
      this.video.pause()
      this.video.srcObject = null
    }
    this.video = null
    this.output = null
    this.hasMask = false
  }

  private renderFrame() {
    const video = this.video
    const output = this.output
    if (!video || !output || video.readyState < 2) return
    const ctx = output.getContext('2d')
    if (!ctx) return
    const { width, height } = output

    if (this.options.mode === 'disabled' || !this.segmenter) {
      ctx.drawImage(video, 0, 0, width, height)
      return
    }
    this.maybeSegment(video)
    if (!this.hasMask) {
      ctx.drawImage(video, 0, 0, width, height)
      return
    }

    ctx.save()
    ctx.globalCompositeOperation = 'copy'
    if (this.supportsFilter) ctx.filter = 'blur(2px)'
    ctx.drawImage(this.maskCanvas, 0, 0, width, height)
    if (this.supportsFilter) ctx.filter = 'none'
    ctx.globalCompositeOperation = 'source-in'
    ctx.drawImage(video, 0, 0, width, height)
    ctx.globalCompositeOperation = 'destination-over'
    if (this.options.mode === 'image' && this.image) {
      drawCover(ctx, this.image, width, height)
    } else if (this.options.mode === 'blur') {
      if (this.supportsFilter) {
        ctx.filter = `blur(${this.options.blurRadius}px)`
        ctx.drawImage(video, 0, 0, width, height)
        ctx.filter = 'none'
      } else {
        const small = this.blurCanvas.getContext('2d')
        small?.drawImage(video, 0, 0, this.blurCanvas.width, this.blurCanvas.height)
        ctx.imageSmoothingEnabled = true
        ctx.drawImage(this.blurCanvas, 0, 0, width, height)
      }
    }
    ctx.restore()
  }

  private maybeSegment(video: HTMLVideoElement) {
    const segmenter = this.segmenter
    const now = performance.now()
    if (!segmenter || this.segmenting || now - this.lastSegmentAt < 1000 / this.maxFps) return
    this.lastSegmentAt = now
    this.segmenting = true
    const started = now
    try {
      const segmentCtx = this.segmentCanvas.getContext('2d', { willReadFrequently: true })
      if (!segmentCtx) return
      segmentCtx.drawImage(video, 0, 0, this.segmentCanvas.width, this.segmentCanvas.height)
      segmenter.segmentForVideo(this.segmentCanvas, now, (result) => {
        const mask = result.confidenceMasks?.[0]
        if (!mask) return
        const values = mask.getAsFloat32Array()
        if (this.maskCanvas.width !== mask.width || this.maskCanvas.height !== mask.height) {
          this.maskCanvas.width = mask.width
          this.maskCanvas.height = mask.height
          this.maskImage = null
        }
        const maskCtx = this.maskCanvas.getContext('2d')
        if (!maskCtx) return
        this.maskImage ??= maskCtx.createImageData(mask.width, mask.height)
        const data = this.maskImage.data
        for (let index = 0; index < values.length; index += 1) {
          const offset = index * 4
          data[offset] = 255
          data[offset + 1] = 255
          data[offset + 2] = 255
          data[offset + 3] = Math.round((values[index] ?? 0) * 255)
        }
        maskCtx.putImageData(this.maskImage, 0, 0)
        this.hasMask = true
      })
    } finally {
      this.segmenting = false
      this.onFrameProcessed?.({ processingTimeMs: performance.now() - started })
    }
  }
}
