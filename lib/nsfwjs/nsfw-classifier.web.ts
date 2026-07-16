/**
 * NSFW.js Image Content Classifier - Browser Only Version
 *
 * Optimized TypeScript implementation for browser environments only.
 * This version is designed to work completely in the browser with images
 * sent from the frontend, avoiding server-side dependencies.
 *
 * Features:
 * - Browser-only environment (no server-side processing)
 * - Model caching and singleton pattern
 * - Multiple image input strategies (File, URL, HTMLElement, Base64)
 * - Comprehensive error handling with graceful fallbacks
 * - Memory management and tensor cleanup
 * - Configurable thresholds and timeouts
 * - Detailed logging and analytics
 *
 * Migrated 1:1 from the legacy `lib/nsfwjs/nsfw-classifier.js`; only static
 * types were added — the runtime behaviour is intentionally unchanged.
 */

import type * as TF from '@tensorflow/tfjs'

// ============= TYPES =============

type TensorFlow = typeof import('@tensorflow/tfjs')

/** Minimal structural view of the loaded model (layers *or* graph model). */
type LoadedNsfwModel = {
  predict: (x: TF.Tensor) => TF.Tensor | TF.Tensor[]
  dispose?: () => void
  inputs?: Array<{ shape: Array<number | null> }>
}

/** Supported image inputs for classification. */
export type NsfwImageInput = string | File | HTMLImageElement

export type NsfwInputType = 'base64' | 'url' | 'file' | 'element' | 'unknown'

export type NsfwVerdict = 'approved' | 'rejected'

export type NsfwScores = {
  drawing: number
  hentai: number
  neutral: number
  porn: number
  sexy: number
}

export type NsfwPrediction = { className: string; probability: number }

export type NsfwAnalysisResult = {
  verdict: NsfwVerdict
  confidence: number
  scores: NsfwScores
  rejectionReasons: string[]
  metadata: {
    analysisId: string
    timestamp: string
    thresholds?: Record<string, number>
    fallback?: boolean
    error?: string
    originalIndex?: number
    batchIndex?: number
  }
  debug?: unknown
}

export type NsfwAnalyzeOptions = {
  timeout?: number
  customThresholds?: Partial<Record<string, number>>
  includeDebugInfo?: boolean
}

export type NsfwBatchProgress = {
  processed: number
  total: number
  percentage: number
  currentChunk: number
  totalChunks: number
}

export type NsfwBatchOptions = {
  timeout?: number
  customThresholds?: Partial<Record<string, number>>
  includeDebugInfo?: boolean
  batchSize?: number
  onProgress?: (progress: NsfwBatchProgress) => void
}

export type NsfwBatchResult = {
  success: boolean
  batchId: string
  totalImages: number
  results: NsfwAnalysisResult[]
  statistics: {
    approved: number
    rejected: number
    failed: number
    successRate: number
  }
  timing: {
    totalTime: number
    averageTimePerImage: number
    imagesPerSecond: number
  }
  metadata: {
    batchId: string
    timestamp: string
    batchSize: number
    chunksProcessed: number
  }
}

type ProcessedImage = { tensor: TF.Tensor; metadata: Record<string, unknown> }

// Simple logger fallback for browser-only usage
const browserLogger = {
  info: (data: unknown, message: string) =>
    console.log(`[NSFW-Classifier INFO]: ${message}`, data),
  warn: (data: unknown, message: string) =>
    console.warn(`[NSFW-Classifier WARN]: ${message}`, data),
  error: (data: unknown, message: string) =>
    console.error(`[NSFW-Classifier ERROR]: ${message}`, data),
}

// Use browser logger
const logger = browserLogger
const logError = (error: Error, data: unknown) => {
  console.error('[NSFW-Classifier ERROR]:', error.message, data)
}

// Constants and Configuration
const CONFIG = {
  MODEL_PATH: '/nsfwjs-model/',
  MODEL_SIZE: 224,
  DEFAULT_TIMEOUT: 60000, // 1 minute timeout for analysis
  MODEL_LOAD_TIMEOUT: 120000, // 2 minutes for model loading
  REJECTION_THRESHOLDS: {
    porn: 0.7,
    sexy: 0.8,
    hentai: 0.7,
  } as Record<string, number>,
  MAX_RETRIES: 3,
  RETRY_DELAY: 1000,
  // Batch processing configuration
  MIN_BATCH_SIZE: 1,
  MAX_BATCH_SIZE: 15,
  OPTIMAL_BATCH_SIZE: 8, // Best performance/memory balance
}

// Global state management
let nsfwModel: LoadedNsfwModel | null = null
let tfInstance: TensorFlow | null = null
let isModelLoading = false
let modelLoadingPromise: Promise<LoadedNsfwModel> | null = null
let loadAttempts = 0

// Browser-only constants and configuration

/**
 * TensorFlow.js loader for browser environment
 * @returns TensorFlow.js instance
 */
const loadTensorFlow = async (): Promise<TensorFlow> => {
  if (tfInstance) {
    return tfInstance
  }

  logger.info(
    {
      component: 'nsfw-classifier',
      action: 'load_tensorflow',
      environment: 'browser',
    },
    'Loading TensorFlow.js in browser environment',
  )

  try {
    // Load browser TensorFlow.js
    const tf = await import('@tensorflow/tfjs')

    // Ensure TensorFlow is ready
    await tf.ready()

    // Optimize backend selection for best performance
    try {
      // Try WebGPU first (fastest if available)
      if (tf.setBackend && typeof tf.setBackend === 'function') {
        try {
          await tf.setBackend('webgpu')
          await tf.ready()
          logger.info(
            { component: 'nsfw-classifier' },
            'WebGPU backend enabled for maximum performance',
          )
        } catch (webgpuError) {
          // Fallback to WebGL
          try {
            await tf.setBackend('webgl')
            await tf.ready()
            logger.info(
              { component: 'nsfw-classifier' },
              'WebGL backend enabled for optimal performance',
            )
          } catch (webglError) {
            // Final fallback to CPU
            await tf.setBackend('cpu')
            await tf.ready()
            logger.warn(
              { component: 'nsfw-classifier' },
              'Using CPU backend - performance may be slower',
            )
          }
        }
      }
    } catch (backendError) {
      logger.warn(
        { component: 'nsfw-classifier', error: (backendError as Error).message },
        'Backend optimization failed, using default',
      )
    }

    // Enable production optimizations
    if (tf.enableProdMode && typeof tf.enableProdMode === 'function') {
      tf.enableProdMode()
    }

    tfInstance = tf
    return tf
  } catch (error) {
    logger.error(
      {
        component: 'nsfw-classifier',
        action: 'load_tensorflow',
        error: (error as Error).message,
      },
      'Failed to load TensorFlow.js',
    )

    throw new Error(`Failed to load TensorFlow.js: ${(error as Error).message}`)
  }
}

/**
 * Model path resolution for browser environment
 * @returns Resolved model path
 */
const resolveModelPath = (): string => {
  const modelPath = CONFIG.MODEL_PATH
  const baseUrl = window.location.origin

  // Ensure we have the correct path structure
  const normalizedPath = modelPath.startsWith('/') ? modelPath : `/${modelPath}`
  const pathWithoutTrailingSlash = normalizedPath.endsWith('/')
    ? normalizedPath.slice(0, -1)
    : normalizedPath

  // Construct the full URL to the model.json file
  const fullModelJsonPath = `${baseUrl}${pathWithoutTrailingSlash}/model.json`

  return fullModelJsonPath
}

/**
 * Enhanced model loader with retry logic and comprehensive error handling
 * @returns Loaded NSFWJS model
 */
export const loadNSFWModel = async (): Promise<LoadedNsfwModel> => {
  // Return cached model if available
  if (nsfwModel) {
    logger.info({ component: 'nsfw-classifier' }, 'Using cached NSFW model')
    return nsfwModel
  }

  // Return existing loading promise if model is being loaded
  if (isModelLoading && modelLoadingPromise) {
    logger.info(
      { component: 'nsfw-classifier' },
      'Model loading in progress, waiting for completion',
    )
    return modelLoadingPromise
  }

  // Start new loading process
  isModelLoading = true
  loadAttempts++

  modelLoadingPromise = (async () => {
    const startTime = Date.now()

    try {
      logger.info(
        {
          component: 'nsfw-classifier',
          action: 'load_model_start',
          attempt: loadAttempts,
        },
        'Starting NSFW model loading process',
      )

      // Load TensorFlow.js first
      const tf = await loadTensorFlow()
      // Enable production optimizations
      tf.enableProdMode()

      // Clean up any existing variables
      try {
        if (tf.disposeVariables) {
          tf.disposeVariables()
        }
      } catch (cleanupError) {
        logger.warn(
          { component: 'nsfw-classifier' },
          'Failed to clean TensorFlow variables',
        )
      }
      // Get model path
      const modelPath = resolveModelPath()
      console.log('Model path:', modelPath)

      logger.info(
        {
          component: 'nsfw-classifier',
          action: 'load_model',
          path: modelPath,
          size: CONFIG.MODEL_SIZE,
        },
        'Loading NSFW model directly with TensorFlow.js',
      )

      // Load model directly with TensorFlow.js instead of NSFWJS wrapper
      // This gives us more control over the loading process
      // Based on the model.json structure, this is a Keras layers model
      try {
        nsfwModel = (await tf.loadLayersModel(modelPath)) as unknown as LoadedNsfwModel
        logger.info(
          { component: 'nsfw-classifier' },
          'Successfully loaded model as layers model',
        )
      } catch (layersError) {
        // If layers model loading fails, try loading as a graph model
        logger.warn(
          {
            component: 'nsfw-classifier',
            error: (layersError as Error).message,
            originalPath: modelPath,
          },
          'Failed to load as layers model, trying graph model',
        )

        try {
          nsfwModel = (await tf.loadGraphModel(modelPath)) as unknown as LoadedNsfwModel
          logger.info(
            { component: 'nsfw-classifier' },
            'Successfully loaded model as graph model',
          )
        } catch (graphError) {
          logger.error(
            {
              component: 'nsfw-classifier',
              layersError: (layersError as Error).message,
              graphError: (graphError as Error).message,
            },
            'Failed to load model with both methods',
          )
          throw new Error(
            `Failed to load model: Layers model error: ${(layersError as Error).message}; Graph model error: ${(graphError as Error).message}`,
          )
        }
      }

      // Verify the model loaded correctly
      if (!nsfwModel || !nsfwModel.predict) {
        throw new Error('Model loaded but predict function not available')
      }

      // Check model input shape
      let inputShape: Array<number | null> | undefined
      try {
        if (nsfwModel.inputs && nsfwModel.inputs.length > 0) {
          inputShape = nsfwModel.inputs[0].shape
          logger.info(
            {
              component: 'nsfw-classifier',
              inputShape: inputShape,
            },
            'Model input shape detected',
          )
        }
      } catch (shapeError) {
        logger.warn(
          {
            component: 'nsfw-classifier',
            error: (shapeError as Error).message,
          },
          'Could not determine model input shape, using default',
        )
      }

      // Warm up the model with a dummy prediction to ensure it's ready
      const dummyInput = tf.zeros([1, CONFIG.MODEL_SIZE, CONFIG.MODEL_SIZE, 3])
      try {
        const warmupPrediction = nsfwModel.predict(dummyInput)
        if (warmupPrediction && typeof (warmupPrediction as TF.Tensor).dispose === 'function') {
          ;(warmupPrediction as TF.Tensor).dispose()
        }
        dummyInput.dispose()

        logger.info({ component: 'nsfw-classifier' }, 'Model warmup successful')
      } catch (warmupError) {
        logger.warn(
          { component: 'nsfw-classifier', error: (warmupError as Error).message },
          'Model warmup failed, but proceeding',
        )
        dummyInput.dispose()
      }

      const loadTime = Date.now() - startTime
      logger.info(
        {
          component: 'nsfw-classifier',
          action: 'load_model_success',
          loadTime: `${loadTime}ms`,
          attempt: loadAttempts,
        },
        'NSFW model loaded successfully',
      )

      return nsfwModel
    } catch (error) {
      const loadTime = Date.now() - startTime

      logError(error as Error, {
        component: 'nsfw-classifier',
        action: 'load_model_failed',
        attempt: loadAttempts,
        loadTime: `${loadTime}ms`,
      })
      // Reset state on failure
      nsfwModel = null

      // Implement retry logic for transient errors
      if (loadAttempts < CONFIG.MAX_RETRIES && isRetryableError(error as Error)) {
        logger.warn(
          {
            component: 'nsfw-classifier',
            attempt: loadAttempts,
            maxRetries: CONFIG.MAX_RETRIES,
          },
          `Retrying model load in ${CONFIG.RETRY_DELAY}ms`,
        )

        await new Promise((resolve) => setTimeout(resolve, CONFIG.RETRY_DELAY))
        isModelLoading = false
        modelLoadingPromise = null
        return loadNSFWModel() // Recursive retry
      }

      throw new Error(
        `NSFW model loading failed after ${loadAttempts} attempts: ${(error as Error).message}`,
      )
    } finally {
      isModelLoading = false
      modelLoadingPromise = null
    }
  })()

  return modelLoadingPromise
}

/**
 * Determine if error is retryable
 * @param error - Error to check
 * @returns True if error might be transient
 */
const isRetryableError = (error: Error): boolean => {
  const retryableMessages = ['fetch', 'network', 'timeout', 'connection', 'temporary']

  const errorMessage = error.message.toLowerCase()
  return retryableMessages.some((keyword) => errorMessage.includes(keyword))
}

/**
 * Enhanced image analysis with comprehensive error handling and fallbacks
 * @param imageInput - Image to analyze
 * @param options - Analysis options
 * @returns Analysis result
 */
export const analyzeImageContent = async (
  imageInput: NsfwImageInput,
  options: NsfwAnalyzeOptions = {},
): Promise<NsfwAnalysisResult> => {
  const {
    timeout = CONFIG.DEFAULT_TIMEOUT,
    customThresholds = {},
    includeDebugInfo = false,
  } = options
  const startTime = Date.now()
  const analysisId = Math.random().toString(36).substring(7)

  logger.info(
    {
      component: 'nsfw-classifier',
      action: 'analyze_start',
      analysisId,
      timeout,
      inputType: getInputType(imageInput),
    },
    'Starting image content analysis',
  )

  // Create timeout promise
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => {
      reject(new Error(`Image analysis timed out after ${timeout}ms`))
    }, timeout)
  })

  try {
    const result = await Promise.race([
      performImageAnalysis(imageInput, analysisId, customThresholds, includeDebugInfo),
      timeoutPromise,
    ])

    const analysisTime = Date.now() - startTime
    logger.info(
      {
        component: 'nsfw-classifier',
        action: 'analyze_success',
        analysisId,
        analysisTime: `${analysisTime}ms`,
        verdict: result.verdict,
      },
      'Image analysis completed successfully',
    )

    return result
  } catch (error) {
    const analysisTime = Date.now() - startTime

    logError(error as Error, {
      component: 'nsfw-classifier',
      action: 'analyze_failed',
      analysisId,
      analysisTime: `${analysisTime}ms`,
      inputType: getInputType(imageInput),
    })
    // Return safe fallback result instead of throwing
    const fallbackResult = createFallbackResult((error as Error).message, includeDebugInfo)

    logger.warn(
      {
        component: 'nsfw-classifier',
        analysisId,
        fallbackReason: (error as Error).message,
      },
      'Returning fallback analysis result',
    )

    return fallbackResult
  }
}

/**
 * Core image analysis implementation
 * @param imageInput - Image input
 * @param analysisId - Unique analysis ID
 * @param customThresholds - Custom rejection thresholds
 * @param includeDebugInfo - Include debug information
 * @returns Analysis result
 */
const performImageAnalysis = async (
  imageInput: NsfwImageInput,
  analysisId: string,
  customThresholds: Partial<Record<string, number>>,
  includeDebugInfo: boolean,
): Promise<NsfwAnalysisResult> => {
  const performanceStart = Date.now()

  // Load model and TensorFlow
  const tfLoadStart = Date.now()
  const tf = await loadTensorFlow()
  const model = await loadNSFWModel()
  const tfLoadTime = Date.now() - tfLoadStart

  console.log(`🚀 TensorFlow & Model load time: ${tfLoadTime}ms`)

  // Process image based on input type
  let processedImage: TF.Tensor | undefined
  let imageMetadata: Record<string, unknown> = {}

  try {
    const imageProcessStart = Date.now()
    const processingResult = await processImageInput(imageInput, tf)
    processedImage = processingResult.tensor
    imageMetadata = processingResult.metadata
    const imageProcessTime = Date.now() - imageProcessStart

    console.log(`📸 Image processing time: ${imageProcessTime}ms`)

    logger.info(
      {
        component: 'nsfw-classifier',
        analysisId,
        imageMetadata,
        processingTime: imageProcessTime,
      },
      'Image processed for analysis',
    )
    // Perform classification using direct TensorFlow.js model
    let rawPredictions: TF.Tensor | TF.Tensor[] | undefined
    let predictions: NsfwPrediction[] // Declare predictions variable outside try block

    try {
      const predictionStart = Date.now()

      // Add batch dimension for single image prediction
      const batchedImage = tf.tidy(() => {
        return (processedImage as TF.Tensor).expandDims(0) // Add batch dimension [1, 224, 224, 3]
      })

      // Optimize prediction by reducing memory allocation
      rawPredictions = model.predict(batchedImage)

      // Clean up batched tensor immediately
      batchedImage.dispose()

      // Handle both tensor and array of tensors
      const outputTensor = Array.isArray(rawPredictions) ? rawPredictions[0] : rawPredictions

      // Convert tensor to JavaScript array
      const predictionData = (await outputTensor.data()) as Float32Array
      const predictionTime = Date.now() - predictionStart

      console.log(`🧠 Model prediction time: ${predictionTime}ms`)

      // Dispose of raw predictions immediately to free memory
      if (Array.isArray(rawPredictions)) {
        rawPredictions.forEach((tensor) => {
          if (tensor && typeof tensor.dispose === 'function') {
            tensor.dispose()
          }
        })
      } else if (rawPredictions && typeof rawPredictions.dispose === 'function') {
        rawPredictions.dispose()
      }

      // Convert raw predictions to NSFW classification format
      // The model outputs 5 classes: drawing, hentai, neutral, porn, sexy
      const classLabels = ['drawing', 'hentai', 'neutral', 'porn', 'sexy']
      predictions = classLabels.map((className, index) => ({
        className,
        probability: predictionData[index] || 0,
      }))

      // Normalize probabilities to ensure they sum to 1
      const totalProb = predictions.reduce((sum, p) => sum + p.probability, 0)
      if (totalProb > 0) {
        predictions.forEach((p) => {
          p.probability = p.probability / totalProb
        })
      }

      const totalAnalysisTime = Date.now() - performanceStart
      console.log(`⚡ Total analysis time: ${totalAnalysisTime}ms`)

      logger.info(
        {
          component: 'nsfw-classifier',
          analysisId,
          predictionCount: predictions.length,
          rawScores: Object.fromEntries(
            predictions.map((p) => [p.className, p.probability.toFixed(3)]),
          ),
          timing: {
            tfLoad: tfLoadTime,
            imageProcess: imageProcessTime,
            prediction: predictionTime,
            total: totalAnalysisTime,
          },
        },
        'Classification completed with timing info',
      )
    } catch (predictionError) {
      console.log('❌ Prediction error:', (predictionError as Error).message)
      // Clean up any allocated tensors in case of error
      if (rawPredictions) {
        try {
          if (Array.isArray(rawPredictions)) {
            rawPredictions.forEach((tensor) => {
              if (tensor && typeof tensor.dispose === 'function') {
                tensor.dispose()
              }
            })
          } else if (typeof rawPredictions.dispose === 'function') {
            rawPredictions.dispose()
          }
        } catch (disposeError) {
          logger.warn(
            { component: 'nsfw-classifier', analysisId },
            'Failed to dispose prediction tensors after error',
          )
        }
      }
      throw predictionError
    }

    // Process and return results
    return processClassificationResults(predictions, customThresholds, {
      analysisId,
      imageMetadata,
      includeDebugInfo,
    })
  } finally {
    // Clean up tensors to prevent memory leaks
    if (processedImage && typeof processedImage.dispose === 'function') {
      try {
        processedImage.dispose()
      } catch (disposeError) {
        logger.warn(
          {
            component: 'nsfw-classifier',
            analysisId,
          },
          'Failed to dispose image tensor',
        )
      }
    }
  }
}

/**
 * Process different types of image inputs
 * @param imageInput - Image input
 * @param tf - TensorFlow.js instance
 * @returns Processed image tensor and metadata
 */
const processImageInput = async (
  imageInput: NsfwImageInput,
  tf: TensorFlow,
): Promise<ProcessedImage> => {
  const inputType = getInputType(imageInput)

  switch (inputType) {
    case 'url':
      return await loadImageFromUrl(imageInput as string, tf)
    case 'file':
      return await loadImageFromFile(imageInput as File, tf)
    case 'element':
      return await loadImageFromElement(imageInput as HTMLImageElement, tf)
    case 'base64':
      return await loadImageFromBase64(imageInput as string, tf)
    default:
      throw new Error(`Unsupported image input type: ${inputType}`)
  }
}

/**
 * Determine input type
 * @param input - Input to analyze
 * @returns Input type
 */
const getInputType = (input: unknown): NsfwInputType => {
  if (typeof input === 'string') {
    if (input.startsWith('data:image/')) {
      return 'base64'
    }
    return 'url'
  }

  if (typeof File !== 'undefined' && input instanceof File) {
    return 'file'
  }

  if (typeof HTMLImageElement !== 'undefined' && input instanceof HTMLImageElement) {
    return 'element'
  }

  return 'unknown'
}

/**
 * Load image from URL - Browser only (optimized)
 * @param imageUrl - Image URL
 * @param tf - TensorFlow.js instance
 * @returns Image tensor and metadata
 */
const loadImageFromUrl = async (imageUrl: string, tf: TensorFlow): Promise<ProcessedImage> => {
  const img = new Image()
  img.crossOrigin = 'anonymous'
  img.src = imageUrl

  return new Promise<ProcessedImage>((resolve, reject) => {
    img.onload = () => {
      try {
        // Optimized tensor creation (single image, no batch dimension yet)
        const tensor = tf.tidy(() => {
          return tf.browser
            .fromPixels(img)
            .resizeNearestNeighbor([CONFIG.MODEL_SIZE, CONFIG.MODEL_SIZE])
            .toFloat()
            .div(tf.scalar(255.0))
        })

        resolve({
          tensor,
          metadata: {
            width: img.width,
            height: img.height,
            source: 'browser_url',
          },
        })
      } catch (error) {
        reject(error)
      }
    }

    img.onerror = () => {
      reject(new Error(`Failed to load image from URL: ${imageUrl}`))
    }
  })
}

/**
 * Load image from File object - Browser only (optimized)
 * @param file - File object
 * @param tf - TensorFlow.js instance
 * @returns Image tensor and metadata
 */
const loadImageFromFile = async (file: File, tf: TensorFlow): Promise<ProcessedImage> => {
  return new Promise<ProcessedImage>((resolve, reject) => {
    const reader = new FileReader()

    reader.onload = (e) => {
      const img = new Image()

      img.onload = () => {
        try {
          // Optimized tensor creation (single image, no batch dimension yet)
          const tensor = tf.tidy(() => {
            return tf.browser
              .fromPixels(img)
              .resizeNearestNeighbor([CONFIG.MODEL_SIZE, CONFIG.MODEL_SIZE])
              .toFloat()
              .div(tf.scalar(255.0))
          })

          resolve({
            tensor,
            metadata: {
              width: img.width,
              height: img.height,
              size: file.size,
              type: file.type,
              source: 'browser_file',
            },
          })
        } catch (error) {
          reject(error)
        }
      }

      img.onerror = () => reject(new Error('Failed to load image from file'))
      img.src = e.target?.result as string
    }

    reader.onerror = () => reject(new Error('Failed to read file'))
    reader.readAsDataURL(file)
  })
}

/**
 * Load image from HTML element - Browser only (optimized)
 * @param element - Image element
 * @param tf - TensorFlow.js instance
 * @returns Image tensor and metadata
 */
const loadImageFromElement = async (
  element: HTMLImageElement,
  tf: TensorFlow,
): Promise<ProcessedImage> => {
  // Optimized tensor creation (single image, no batch dimension yet)
  const tensor = tf.tidy(() => {
    return tf.browser
      .fromPixels(element)
      .resizeNearestNeighbor([CONFIG.MODEL_SIZE, CONFIG.MODEL_SIZE])
      .toFloat()
      .div(tf.scalar(255.0))
  })

  return {
    tensor,
    metadata: {
      width: element.width,
      height: element.height,
      source: 'browser_element',
    },
  }
}

/**
 * Load image from base64 data - Browser only
 * @param base64Data - Base64 image data
 * @param tf - TensorFlow.js instance
 * @returns Image tensor and metadata
 */
const loadImageFromBase64 = async (
  base64Data: string,
  tf: TensorFlow,
): Promise<ProcessedImage> => {
  const img = new Image()
  img.src = base64Data

  return new Promise<ProcessedImage>((resolve, reject) => {
    img.onload = () => {
      try {
        // Optimized tensor creation (single image, no batch dimension yet)
        const tensor = tf.tidy(() => {
          return tf.browser
            .fromPixels(img)
            .resizeNearestNeighbor([CONFIG.MODEL_SIZE, CONFIG.MODEL_SIZE])
            .toFloat()
            .div(tf.scalar(255.0))
        })

        resolve({
          tensor,
          metadata: {
            width: img.width,
            height: img.height,
            source: 'browser_base64',
          },
        })
      } catch (error) {
        reject(error)
      }
    }

    img.onerror = () => reject(new Error('Failed to load base64 image'))
  })
}

type ProcessOptions = {
  analysisId: string
  imageMetadata: Record<string, unknown>
  includeDebugInfo: boolean
  originalIndex?: number
  startTime?: number
}

/**
 * Process classification results with custom thresholds
 * @param predictions - Model predictions
 * @param customThresholds - Custom rejection thresholds
 * @param options - Processing options
 * @returns Processed result
 */
const processClassificationResults = (
  predictions: NsfwPrediction[],
  customThresholds: Partial<Record<string, number>>,
  options: ProcessOptions,
): NsfwAnalysisResult => {
  const { analysisId, imageMetadata, includeDebugInfo, originalIndex } = options

  // Merge custom thresholds with defaults
  const thresholds = { ...CONFIG.REJECTION_THRESHOLDS, ...customThresholds } as Record<
    string,
    number
  >

  // Convert predictions to scores object
  const scores = predictions.reduce(
    (acc, prediction) => {
      const className = prediction.className.toLowerCase() as keyof NsfwScores
      acc[className] = prediction.probability
      return acc
    },
    { porn: 0, sexy: 0, hentai: 0, neutral: 0, drawing: 0 } as NsfwScores,
  )

  // Determine rejection reasons based on thresholds
  const rejectionReasons: string[] = []

  Object.entries(thresholds).forEach(([category, threshold]) => {
    const score = (scores as Record<string, number>)[category]
    if (score > threshold) {
      rejectionReasons.push(
        `${category.charAt(0).toUpperCase() + category.slice(1)} content detected (${(
          score * 100
        ).toFixed(1)}%)`,
      )
    }
  })

  // Determine final verdict
  const verdict: NsfwVerdict = rejectionReasons.length > 0 ? 'rejected' : 'approved'

  // Build result object
  const result: NsfwAnalysisResult = {
    verdict,
    confidence: Math.max(...Object.values(scores)),
    scores,
    rejectionReasons,
    metadata: {
      analysisId,
      timestamp: new Date().toISOString(),
      thresholds: thresholds,
    },
  }

  // Add originalIndex if provided (for batch processing)
  if (typeof originalIndex === 'number') {
    result.metadata.originalIndex = originalIndex
  }

  // Add debug information if requested
  if (includeDebugInfo) {
    result.debug = {
      predictions,
      imageMetadata,
      processingTime: Date.now() - (options.startTime || Date.now()),
    }
  }

  return result
}

/**
 * Create fallback result for failed analyses
 * @param errorMessage - Error message
 * @param includeDebugInfo - Include debug information
 * @returns Fallback result
 */
const createFallbackResult = (
  errorMessage: string,
  includeDebugInfo: boolean,
): NsfwAnalysisResult => {
  const result: NsfwAnalysisResult = {
    verdict: 'approved', // Safe default - approve rather than block due to technical issues
    confidence: 0.0,
    scores: {
      porn: 0,
      sexy: 0,
      hentai: 0,
      neutral: 1.0,
      drawing: 0,
    },
    rejectionReasons: [],
    metadata: {
      analysisId: 'fallback',
      timestamp: new Date().toISOString(),
      fallback: true,
      error: errorMessage,
    },
  }

  if (includeDebugInfo) {
    result.debug = {
      fallbackReason: errorMessage,
      note: 'Analysis failed, returning safe default result',
    }
  }

  return result
}

/**
 * Validate image before analysis
 * @param imageInput - Image to validate
 * @returns Validation result
 */
export const validateImageInput = async (
  imageInput: unknown,
): Promise<{ valid: boolean; error?: string; inputType: NsfwInputType }> => {
  try {
    const inputType = getInputType(imageInput)

    if (inputType === 'unknown') {
      return {
        valid: false,
        error: 'Unsupported image input type',
        inputType,
      }
    }

    // Additional validation based on input type
    if (inputType === 'file') {
      const file = imageInput as File
      if (!file.type.startsWith('image/')) {
        return {
          valid: false,
          error: 'File is not an image',
          inputType,
        }
      }

      if (file.size > 10 * 1024 * 1024) {
        // 10MB limit
        return {
          valid: false,
          error: 'Image file too large (max 10MB)',
          inputType,
        }
      }
    }

    return {
      valid: true,
      inputType,
    }
  } catch (error) {
    return {
      valid: false,
      error: (error as Error).message,
      inputType: 'unknown',
    }
  }
}

/**
 * Clean up resources and reset model cache
 */
export const cleanup = async (): Promise<void> => {
  try {
    if (nsfwModel) {
      if (typeof nsfwModel.dispose === 'function') {
        nsfwModel.dispose()
      }
      nsfwModel = null
    }

    if (tfInstance && typeof tfInstance.disposeVariables === 'function') {
      tfInstance.disposeVariables()
    }

    loadAttempts = 0
    isModelLoading = false
    modelLoadingPromise = null

    logger.info({ component: 'nsfw-classifier' }, 'Cleanup completed')
  } catch (error) {
    logError(error as Error, {
      component: 'nsfw-classifier',
      action: 'cleanup',
    })
  }
}

/**
 * Get current model status and configuration
 * @returns Status information
 */
export const getModelStatus = () => {
  return {
    modelLoaded: !!nsfwModel,
    isLoading: isModelLoading,
    loadAttempts,
    config: CONFIG,
    environment: 'browser' as const,
    tensorflowLoaded: !!tfInstance,
  }
}

// Export configuration for external use
export { CONFIG }

/**
 * Enhanced batch processing for multiple images
 * @param imageInputs - Array of images to analyze (1-15 images)
 * @param options - Analysis options
 * @returns Batch analysis result
 */
export const analyzeBatchImageContent = async (
  imageInputs: NsfwImageInput[],
  options: NsfwBatchOptions = {},
): Promise<NsfwBatchResult> => {
  const {
    timeout = CONFIG.DEFAULT_TIMEOUT * 2, // Longer timeout for batches
    customThresholds = {},
    includeDebugInfo = false,
    batchSize = CONFIG.OPTIMAL_BATCH_SIZE,
    onProgress = () => {}, // Progress callback
  } = options

  const startTime = Date.now()
  const batchId = Math.random().toString(36).substring(7)

  // Validate inputs
  if (!Array.isArray(imageInputs)) {
    throw new Error('imageInputs must be an array')
  }

  if (imageInputs.length < CONFIG.MIN_BATCH_SIZE || imageInputs.length > CONFIG.MAX_BATCH_SIZE) {
    throw new Error(
      `Batch size must be between ${CONFIG.MIN_BATCH_SIZE} and ${CONFIG.MAX_BATCH_SIZE} images`,
    )
  }

  logger.info(
    {
      component: 'nsfw-classifier',
      action: 'batch_analyze_start',
      batchId,
      imageCount: imageInputs.length,
      batchSize,
      timeout,
    },
    'Starting batch image content analysis',
  )

  try {
    const results: NsfwAnalysisResult[] = []
    let processedCount = 0

    // Process images in chunks to optimize memory usage
    for (let i = 0; i < imageInputs.length; i += batchSize) {
      const chunk = imageInputs.slice(i, i + batchSize)

      logger.info(
        {
          component: 'nsfw-classifier',
          batchId,
          chunkStart: i,
          chunkSize: chunk.length,
        },
        `Processing chunk ${Math.floor(i / batchSize) + 1}`,
      )

      // Process chunk using optimized batch prediction
      const chunkResults = await performBatchAnalysis(chunk, {
        batchId,
        customThresholds,
        includeDebugInfo,
        chunkIndex: Math.floor(i / batchSize),
      })

      results.push(...chunkResults)
      processedCount += chunk.length

      // Report progress
      onProgress({
        processed: processedCount,
        total: imageInputs.length,
        percentage: (processedCount / imageInputs.length) * 100,
        currentChunk: Math.floor(i / batchSize) + 1,
        totalChunks: Math.ceil(imageInputs.length / batchSize),
      })

      // Small delay between chunks to prevent browser freeze
      if (i + batchSize < imageInputs.length) {
        await new Promise((resolve) => setTimeout(resolve, 50))
      }
    }

    const totalTime = Date.now() - startTime
    const avgTimePerImage = totalTime / imageInputs.length

    // Calculate batch statistics
    const approvedCount = results.filter((r) => r.verdict === 'approved').length
    const rejectedCount = results.filter((r) => r.verdict === 'rejected').length
    const failedCount = results.filter((r) => r.metadata?.fallback).length

    const batchResult: NsfwBatchResult = {
      success: true,
      batchId,
      totalImages: imageInputs.length,
      results,
      statistics: {
        approved: approvedCount,
        rejected: rejectedCount,
        failed: failedCount,
        successRate: ((results.length - failedCount) / results.length) * 100,
      },
      timing: {
        totalTime,
        averageTimePerImage: avgTimePerImage,
        imagesPerSecond: (imageInputs.length / totalTime) * 1000,
      },
      metadata: {
        batchId,
        timestamp: new Date().toISOString(),
        batchSize,
        chunksProcessed: Math.ceil(imageInputs.length / batchSize),
      },
    }

    logger.info(
      {
        component: 'nsfw-classifier',
        action: 'batch_analyze_success',
        batchId,
        totalTime: `${totalTime}ms`,
        avgTime: `${avgTimePerImage.toFixed(1)}ms`,
        approved: approvedCount,
        rejected: rejectedCount,
      },
      'Batch analysis completed successfully',
    )

    return batchResult
  } catch (error) {
    const totalTime = Date.now() - startTime

    logError(error as Error, {
      component: 'nsfw-classifier',
      action: 'batch_analyze_failed',
      batchId,
      imageCount: imageInputs.length,
      totalTime: `${totalTime}ms`,
    })

    throw new Error(`Batch analysis failed: ${(error as Error).message}`)
  }
}

type BatchAnalysisOptions = {
  batchId: string
  customThresholds: Partial<Record<string, number>>
  includeDebugInfo: boolean
  chunkIndex: number
}

/**
 * Optimized batch analysis for a chunk of images
 * @param imageChunk - Chunk of images to process
 * @param options - Processing options
 * @returns Array of analysis results
 */
const performBatchAnalysis = async (
  imageChunk: NsfwImageInput[],
  options: BatchAnalysisOptions,
): Promise<NsfwAnalysisResult[]> => {
  const { batchId, customThresholds, includeDebugInfo, chunkIndex } = options
  const startTime = Date.now()

  try {
    // Load model and TensorFlow once for the entire chunk
    const tf = await loadTensorFlow()
    const model = await loadNSFWModel()

    // Process all images in parallel to create tensors
    const imageProcessingPromises = imageChunk.map(async (imageInput, index) => {
      try {
        const processingResult = await processImageInput(imageInput, tf)
        return {
          index,
          tensor: processingResult.tensor as TF.Tensor | null,
          metadata: processingResult.metadata,
          success: true,
          error: undefined as string | undefined,
        }
      } catch (error) {
        logger.warn(
          {
            component: 'nsfw-classifier',
            batchId,
            chunkIndex,
            imageIndex: index,
            error: (error as Error).message,
          },
          'Failed to process image in batch',
        )
        return {
          index,
          tensor: null as TF.Tensor | null,
          metadata: {} as Record<string, unknown>,
          success: false,
          error: (error as Error).message,
        }
      }
    })

    const imageProcessingResults = await Promise.all(imageProcessingPromises)
    const validResults = imageProcessingResults.filter((r) => r.success)
    const failedResults = imageProcessingResults.filter((r) => !r.success)

    console.log(
      `📸 Batch processing: ${validResults.length}/${imageChunk.length} images processed successfully`,
    )

    let batchPredictionResults: NsfwAnalysisResult[] = []
    if (validResults.length > 0) {
      // Create batch tensor by stacking all image tensors (add batch dimension)
      const batchTensor = tf.tidy(() => {
        const tensors = validResults.map((r) => r.tensor as TF.Tensor)
        return tf.stack(tensors, 0) // Stack along new batch dimension
      })

      console.log(`🧠 Batch tensor shape: [${batchTensor.shape.join(', ')}]`)

      // Perform batch prediction - much more efficient!
      const predictionStart = Date.now()
      const rawPredictions = model.predict(batchTensor)

      // Handle both tensor and array of tensors
      const outputTensor = Array.isArray(rawPredictions) ? rawPredictions[0] : rawPredictions

      // Convert tensor to JavaScript array
      const predictionData = (await outputTensor.data()) as Float32Array
      const predictionTime = Date.now() - predictionStart

      console.log(
        `🚀 Batch prediction time: ${predictionTime}ms for ${validResults.length} images (${(
          predictionTime / validResults.length
        ).toFixed(1)}ms per image)`,
      )

      // Clean up tensors
      batchTensor.dispose()
      validResults.forEach((r) => (r.tensor as TF.Tensor).dispose())
      if (Array.isArray(rawPredictions)) {
        rawPredictions.forEach((tensor) => {
          if (tensor && typeof tensor.dispose === 'function') {
            tensor.dispose()
          }
        })
      } else if (rawPredictions && typeof rawPredictions.dispose === 'function') {
        rawPredictions.dispose()
      }

      // Process predictions for each image
      const classLabels = ['drawing', 'hentai', 'neutral', 'porn', 'sexy']
      const numClasses = classLabels.length

      batchPredictionResults = validResults.map((result, batchIndex) => {
        const startIdx = batchIndex * numClasses
        const imageScores = predictionData.slice(startIdx, startIdx + numClasses)

        const predictions = classLabels.map((className, classIndex) => ({
          className,
          probability: imageScores[classIndex] || 0,
        }))

        // Normalize probabilities
        const totalProb = predictions.reduce((sum, p) => sum + p.probability, 0)
        if (totalProb > 0) {
          predictions.forEach((p) => {
            p.probability = p.probability / totalProb
          })
        }

        const analysisId = Math.random().toString(36).substring(7)
        return processClassificationResults(predictions, customThresholds, {
          analysisId,
          imageMetadata: result.metadata,
          includeDebugInfo,
          originalIndex: result.index,
        })
      })
    }

    // Handle failed images
    const results: NsfwAnalysisResult[] = []
    imageProcessingResults.forEach((processingResult, index) => {
      if (processingResult.success) {
        const batchResult = batchPredictionResults.find(
          (r) => r.metadata.originalIndex === processingResult.index,
        )
        if (batchResult) {
          // Remove originalIndex from metadata as it's internal
          delete batchResult.metadata.originalIndex
          results.push(batchResult)
        }
      } else {
        // Create fallback result for failed image
        const fallbackResult = createFallbackResult(
          processingResult.error ?? 'Unknown error',
          includeDebugInfo,
        )
        fallbackResult.metadata.originalIndex = processingResult.index
        fallbackResult.metadata.batchIndex = index
        delete fallbackResult.metadata.originalIndex
        results.push(fallbackResult)
      }
    })

    const totalTime = Date.now() - startTime
    console.log(`⚡ Total chunk processing time: ${totalTime}ms for ${imageChunk.length} images`)

    return results
  } catch (error) {
    console.error('❌ Batch processing error:', error)

    // Return fallback results for all images in the chunk
    return imageChunk.map((_, index) => {
      const fallbackResult = createFallbackResult(
        `Batch processing failed: ${(error as Error).message}`,
        includeDebugInfo,
      )
      fallbackResult.metadata.batchIndex = index
      return fallbackResult
    })
  }
}

/**
 * Validate batch image inputs before analysis
 * @param imageInputs - Array of images to validate
 * @returns Validation result
 */
export const validateBatchImageInputs = async (
  imageInputs: unknown,
): Promise<{
  valid: boolean
  error?: string
  imageCount?: number
  recommendedBatchSize?: number
  invalidImages?: Array<{ index: number; error?: string }>
}> => {
  try {
    if (!Array.isArray(imageInputs)) {
      return {
        valid: false,
        error: 'Input must be an array of images',
      }
    }

    if (imageInputs.length < CONFIG.MIN_BATCH_SIZE) {
      return {
        valid: false,
        error: `At least ${CONFIG.MIN_BATCH_SIZE} image is required`,
      }
    }

    if (imageInputs.length > CONFIG.MAX_BATCH_SIZE) {
      return {
        valid: false,
        error: `Maximum ${CONFIG.MAX_BATCH_SIZE} images allowed`,
      }
    }

    // Validate each image
    const validationResults = await Promise.all(
      imageInputs.map(async (imageInput, index) => {
        const result = await validateImageInput(imageInput)
        return {
          index,
          ...result,
        }
      }),
    )

    const invalidImages = validationResults.filter((r) => !r.valid)

    if (invalidImages.length > 0) {
      return {
        valid: false,
        error: `${invalidImages.length} invalid image(s) found`,
        invalidImages: invalidImages.map((img) => ({
          index: img.index,
          error: img.error,
        })),
      }
    }

    return {
      valid: true,
      imageCount: imageInputs.length,
      recommendedBatchSize: Math.min(imageInputs.length, CONFIG.OPTIMAL_BATCH_SIZE),
    }
  } catch (error) {
    return {
      valid: false,
      error: (error as Error).message,
    }
  }
}

/**
 * Get optimal batch size recommendation based on image count and device capabilities
 * @param imageCount - Number of images to process
 * @returns Batch configuration recommendation
 */
export const getBatchRecommendation = (
  imageCount: number,
): { batchSize: number; chunks: number; recommendation: string; description?: string } => {
  if (imageCount <= 0) {
    return {
      batchSize: CONFIG.MIN_BATCH_SIZE,
      chunks: 1,
      recommendation: 'invalid',
    }
  }

  if (imageCount <= 3) {
    return {
      batchSize: imageCount,
      chunks: 1,
      recommendation: 'small_batch',
      description: 'Process all images at once for fastest results',
    }
  }

  if (imageCount <= CONFIG.OPTIMAL_BATCH_SIZE) {
    return {
      batchSize: imageCount,
      chunks: 1,
      recommendation: 'optimal',
      description: 'Optimal batch size for best performance',
    }
  }

  // For larger batches, chunk them
  const chunks = Math.ceil(imageCount / CONFIG.OPTIMAL_BATCH_SIZE)
  return {
    batchSize: CONFIG.OPTIMAL_BATCH_SIZE,
    chunks,
    recommendation: 'chunked',
    description: `Will process in ${chunks} chunks for memory efficiency`,
  }
}
